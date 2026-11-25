import { useState } from 'react';
import { api, errMsg } from '../api/client.js';
import {
  useApi, Modal, Spinner, ErrorBox, Table, Badge, Field, inr, label, fmtDateTime,
} from './ui.jsx';

const pad2 = (n) => String(n).padStart(2, '0');

// Converts a Date / ISO string into { date: "YYYY-MM-DD", time: "HH:mm" } in local time
const splitDateTime = (val) => {
  if (!val) return { date: '', time: '' };
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
};

// Combines { date: "YYYY-MM-DD", time: "HH:mm" } -> ISO string (throws if incomplete/invalid)
const combineToISO = (dateStr, timeStr, fieldLabel) => {
  if (!dateStr || !timeStr) {
    throw new Error(`Select both date and time for ${fieldLabel}.`);
  }
  const [y, m, day] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const d = new Date(y, (m || 1) - 1, day || 1, hh || 0, mm || 0, 0, 0);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date or time for ${fieldLabel}.`);
  }
  return d.toISOString();
};

// Formats 24h hours/minutes as "07:30 AM"
const fmtTime12 = (dateObj) => {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
  let hours = dateObj.getHours();
  const minutes = pad2(dateObj.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${pad2(hours)}:${minutes} ${ampm}`;
};

// Formats as: "Schedule: Wed Nov 25 2026 • 07:30 AM - 08:30 AM"
const formatScheduleWindow = (prefix, startVal, endValOrMinutes) => {
  if (!startVal) return `${prefix}: -`;
  const start = new Date(startVal);
  if (Number.isNaN(start.getTime())) return `${prefix}: -`;

  const dayPart = start
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    .replace(/,/g, '');

  const startTimePart = fmtTime12(start);

  let end = null;
  if (typeof endValOrMinutes === 'number' && Number.isFinite(endValOrMinutes)) {
    end = new Date(start.getTime() + endValOrMinutes * 60 * 1000);
  } else if (endValOrMinutes) {
    const parsedEnd = new Date(endValOrMinutes);
    if (!Number.isNaN(parsedEnd.getTime())) end = parsedEnd;
  }

  if (!end) {
    return `${prefix}: ${dayPart} • ${startTimePart}`;
  }

  const endTimePart = fmtTime12(end);
  return `${prefix}: ${dayPart} • ${startTimePart} - ${endTimePart}`;
};

const getDefaultTiming = (session) => {
  if (!session) {
    return {
      schedDate: '',
      schedTime: '',
      durationMinutes: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      reason: '',
    };
  }
  const sched = splitDateTime(session.scheduledDate);
  const st = splitDateTime(session.startedAt);
  const en = splitDateTime(session.endedAt);

  // Default end date/time from endedAt, or from scheduledDate + scheduledDurationMinutes
  let defaultEnd = en;
  if (!defaultEnd.date && session.scheduledDate && session.scheduledDurationMinutes) {
    const computedEnd = new Date(
      new Date(session.scheduledDate).getTime() + Number(session.scheduledDurationMinutes) * 60000
    );
    defaultEnd = splitDateTime(computedEnd);
  }

  return {
    schedDate: sched.date,
    schedTime: sched.time,
    durationMinutes: session.scheduledDurationMinutes ?? '',
    startDate: st.date || sched.date,
    startTime: st.time,
    endDate: defaultEnd.date || sched.date,
    endTime: defaultEnd.time,
    reason: '',
  };
};

export default function SessionModal({ id, onClose, onChanged }) {
  const { data, loading, error, reload } = useApi(
    () => api.get(`/admin/sessions/${id}`).then((r) => r.data.data),
    [id]
  );
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const [timingDraft, setTimingDraft] = useState(null);
  const [timingSessionKey, setTimingSessionKey] = useState(null);

  const [resolve, setResolve] = useState({
    resolution: 'complete',
    notes: '',
    rescheduleDate: '',
    rescheduleTime: '',
    makeUp: false,
  });

  const s = data?.session;
  const currentSessionKey = s ? `${s._id || id}-${s.updatedAt || ''}` : null;
  const baseTiming = getDefaultTiming(s);

  const timing =
    timingDraft && timingSessionKey === currentSessionKey
      ? { ...baseTiming, ...timingDraft }
      : baseTiming;

  const setTiming = (updater) => {
    setTimingSessionKey(currentSessionKey);
    setTimingDraft((prev) => {
      const current =
        prev && timingSessionKey === currentSessionKey
          ? { ...baseTiming, ...prev }
          : baseTiming;
      return typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    });
  };

  const run = async (fn) => {
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const res = await fn();
      const d = res?.data?.data || {};
      const extra = d.settlementError ? ` Settlement problem: ${d.settlementError}` : '';
      setNotice({
        type: d.settlementError ? 'error' : 'info',
        text: `${res?.data?.message || 'Done.'}${extra}`,
      });
      setTimingDraft(null);
      await reload();
      onChanged && onChanged();
    } catch (e) {
      setNotice({ type: 'error', text: e.response ? errMsg(e) : e.message });
    } finally {
      setBusy(false);
    }
  };

  // Live preview: "Schedule: Wed Nov 25 2026 • 07:30 AM - 08:30 AM"
  const previewStartIso =
    timing.schedDate && timing.schedTime
      ? (() => {
          try {
            return combineToISO(timing.schedDate, timing.schedTime, 'Schedule');
          } catch {
            return null;
          }
        })()
      : null;

  const previewEndIso =
    timing.endDate && timing.endTime
      ? (() => {
          try {
            return combineToISO(timing.endDate, timing.endTime, 'End');
          } catch {
            return null;
          }
        })()
      : null;

  const submitTiming = (e) => {
    e.preventDefault();
    try {
      const payload = {};

      if (timing.schedDate || timing.schedTime) {
        payload.scheduledDate = combineToISO(timing.schedDate, timing.schedTime, 'Schedule');
      }

      if (timing.durationMinutes !== '' && timing.durationMinutes !== null) {
        payload.scheduledDurationMinutes = Number(timing.durationMinutes);
      }

      if (timing.startDate || timing.startTime) {
        payload.startedAt = combineToISO(timing.startDate, timing.startTime, 'Start');
      }

      if (timing.endDate || timing.endTime) {
        payload.endedAt = combineToISO(timing.endDate, timing.endTime, 'End');
      }

      if (timing.reason.trim()) {
        payload.reason = timing.reason.trim();
      }

      if (
        !payload.scheduledDate &&
        payload.scheduledDurationMinutes === undefined &&
        !payload.startedAt &&
        !payload.endedAt
      ) {
        setNotice({
          type: 'error',
          text: 'Enter at least one change: schedule date/time, duration, start date/time, or end date/time.',
        });
        return;
      }

      run(() => api.put(`/admin/sessions/${id}/schedule`, payload));
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  };

  const submitResolve = (e) => {
    e.preventDefault();
    if (!resolve.notes.trim()) {
      setNotice({ type: 'error', text: 'Resolution notes are required.' });
      return;
    }
    if (!window.confirm(`Resolve this session as "${resolve.resolution}"?`)) return;
    run(() => {
      const body = { resolution: resolve.resolution, notes: resolve.notes };
      if (resolve.resolution === 'reschedule') {
        body.scheduledDate = combineToISO(
          resolve.rescheduleDate,
          resolve.rescheduleTime || '09:00',
          'Reschedule'
        );
      }
      if (resolve.resolution === 'cancel') body.makeUpEligible = resolve.makeUp;
      return api.post(`/admin/sessions/${id}/resolve`, body);
    });
  };

  return (
    <Modal title={s ? `Session #${s.sessionNumber} - ${s.pet?.name || 'Pet'}` : 'Session'} onClose={onClose} wide>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {notice.text ? <div className={`alert ${notice.type}`}>{notice.text}</div> : null}

      {s ? (
        <>
          <div className="two">
            <div className="card">
              <div className="kv"><span>Status</span><Badge value={s.status} /></div>
              <div className="kv"><span>Client</span><strong>{s.customer?.name} ({s.customer?.phone})</strong></div>
              <div className="kv"><span>Professional</span><strong>{s.professional?.name} ({label(s.professional?.role)})</strong></div>
              <div className="kv">
                <strong>
                  {formatScheduleWindow(
                    'Schedule',
                    s.scheduledDate,
                    s.scheduledEndAt || s.scheduledDurationMinutes
                  )}
                </strong>
              </div>
              <div className="kv">
                <span>Started / ended</span>
                <span>{fmtDateTime(s.startedAt)} / {fmtDateTime(s.endedAt)}</span>
              </div>
            </div>
            <div className="card">
              <div className="kv"><span>Fee / payout</span><strong>{inr(s.sessionAmount)} / {inr(s.professionalPayoutAmount)}</strong></div>
              <div className="kv"><span>Wallet settled</span><Badge value={s.walletSettled ? 'settled' : 'pending'} /></div>
              <div className="kv"><span>Duration</span><span>{Math.round((s.actualDurationSeconds || 0) / 60)} of {s.scheduledDurationMinutes} min</span></div>
              <div className="kv"><span>Distance</span><span>{Number(s.distanceCovered || 0).toFixed(2)} km ({data.routePoints} GPS points)</span></div>
              <div className="kv"><span>Report score</span><span>{s.behaviorScores?.overallProgressScore ?? '-'}</span></div>
            </div>
          </div>

          {s.reportNotes || s.completionNotes ? (
            <p className="sub" style={{ marginTop: 12 }}>{s.completionNotes || s.reportNotes}</p>
          ) : null}

          {s.status === 'completed' && !s.walletSettled ? (
            <>
              <h3>Settlement</h3>
              <p className="sub">The session is completed but money has not moved. Make sure the client wallet has enough balance, then retry.</p>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => run(() => api.post(`/admin/sessions/${id}/retry-settlement`))}
              >
                Retry settlement
              </button>
            </>
          ) : null}

          {s.status !== 'cancelled' ? (
            <>
              <h3>Modify schedule, start/end date &amp; time, and duration</h3>
              {previewStartIso ? (
                <p className="sub">
                  <strong>
                    {formatScheduleWindow(
                      'Schedule',
                      previewStartIso,
                      previewEndIso || Number(timing.durationMinutes) || s.scheduledDurationMinutes
                    )}
                  </strong>
                </p>
              ) : null}

              <form onSubmit={submitTiming}>
                {s.status === 'scheduled' ? (
                  <div className="two">
                    <Field label="Scheduled start date">
                      <input
                        type="date"
                        value={timing.schedDate}
                        onChange={(e) => setTiming((t) => ({ ...t, schedDate: e.target.value }))}
                      />
                    </Field>
                    <Field label="Scheduled start time">
                      <input
                        type="time"
                        value={timing.schedTime}
                        onChange={(e) => setTiming((t) => ({ ...t, schedTime: e.target.value }))}
                      />
                    </Field>
                  </div>
                ) : null}

                <div className="two">
                  <Field label="Start date">
                    <input
                      type="date"
                      value={timing.startDate}
                      onChange={(e) => setTiming((t) => ({ ...t, startDate: e.target.value }))}
                    />
                  </Field>
                  <Field label="Start time">
                    <input
                      type="time"
                      value={timing.startTime}
                      onChange={(e) => setTiming((t) => ({ ...t, startTime: e.target.value }))}
                    />
                  </Field>
                </div>

                <div className="two">
                  <Field label="End date">
                    <input
                      type="date"
                      value={timing.endDate}
                      onChange={(e) => setTiming((t) => ({ ...t, endDate: e.target.value }))}
                    />
                  </Field>
                  <Field label="End time">
                    <input
                      type="time"
                      value={timing.endTime}
                      onChange={(e) => setTiming((t) => ({ ...t, endTime: e.target.value }))}
                    />
                  </Field>
                </div>

                <div className="two">
                  <Field label="Duration (minutes, 5-300)">
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={timing.durationMinutes}
                      onChange={(e) => setTiming((t) => ({ ...t, durationMinutes: e.target.value }))}
                    />
                  </Field>
                  <Field label="Reason / note (optional)">
                    <input
                      type="text"
                      placeholder="e.g., Adjusted session window"
                      value={timing.reason}
                      onChange={(e) => setTiming((t) => ({ ...t, reason: e.target.value }))}
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button className="btn primary" type="submit" disabled={busy}>
                    Save schedule &amp; timing
                  </button>
                </div>
              </form>
            </>
          ) : null}

          {['disputed', 'interrupted'].includes(s.status) ? (
            <>
              <h3>Resolve this {s.status} session</h3>
              <form onSubmit={submitResolve}>
                <div className="inline">
                  <Field label="Decision">
                    <select
                      value={resolve.resolution}
                      onChange={(e) => setResolve((r) => ({ ...r, resolution: e.target.value }))}
                    >
                      <option value="complete">Complete it and settle wallets</option>
                      <option value="cancel">Cancel it</option>
                      <option value="reschedule">Schedule it again</option>
                    </select>
                  </Field>
                  {resolve.resolution === 'reschedule' ? (
                    <>
                      <Field label="New date">
                        <input
                          type="date"
                          value={resolve.rescheduleDate}
                          onChange={(e) => setResolve((r) => ({ ...r, rescheduleDate: e.target.value }))}
                        />
                      </Field>
                      <Field label="New time">
                        <input
                          type="time"
                          value={resolve.rescheduleTime}
                          onChange={(e) => setResolve((r) => ({ ...r, rescheduleTime: e.target.value }))}
                        />
                      </Field>
                    </>
                  ) : null}
                </div>
                {resolve.resolution === 'cancel' ? (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={resolve.makeUp}
                      onChange={(e) => setResolve((r) => ({ ...r, makeUp: e.target.checked }))}
                    />
                    Make the client eligible for a free make-up session
                  </label>
                ) : null}
                <Field label="Notes (kept in the audit trail)">
                  <textarea
                    value={resolve.notes}
                    onChange={(e) => setResolve((r) => ({ ...r, notes: e.target.value }))}
                  />
                </Field>
                <div style={{ marginTop: 12 }}>
                  <button className="btn primary" type="submit" disabled={busy}>
                    Apply decision
                  </button>
                </div>
              </form>
            </>
          ) : null}

          <h3>Wallet entries</h3>
          <Table
            columns={[
              { key: 'd', title: 'Date', render: (t) => fmtDateTime(t.createdAt) },
              { key: 'c', title: 'Category', render: (t) => label(t.category) },
              { key: 'a', title: 'Amount', render: (t) => `${t.type === 'credit' ? '+' : '-'}${inr(t.amount)}` },
              { key: 'x', title: 'Description', render: (t) => t.description },
            ]}
            rows={data.transactions}
            empty="No wallet entries for this session."
          />

          <h3>History</h3>
          <Table
            columns={[
              { key: 't', title: 'When', render: (l) => fmtDateTime(l.timestamp) },
              { key: 'a', title: 'Action', render: (l) => label(l.action) },
              { key: 'w', title: 'By', render: (l) => `${l.actor?.name || '-'} (${l.actorRole})` },
              {
                key: 's',
                title: 'Status change',
                render: (l) =>
                  l.previousStatus || l.newStatus
                    ? `${label(l.previousStatus) || '-'} -> ${label(l.newStatus) || '-'}`
                    : '-',
              },
            ]}
            rows={data.auditLogs}
            empty="No history yet."
          />
        </>
      ) : null}
    </Modal>
  );
}