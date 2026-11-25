import { useState } from 'react';
import { api, errMsg } from '../api/client.js';
import {
  PageHead, Spinner, ErrorBox, Table, Badge, Modal, Pager, Field,
} from '../components/ui.jsx';
import {
  useApi, useDebounced, inr, label, fmtDateTime, toISO,
} from '../components/ui.jsx';
import SessionModal from '../components/SessionModal.jsx';

const ROLES_FOR_SERVICE = {
  Training: ['trainer'],
  Walking: ['walker'],
  Grooming: ['groomer'],
  Vaccination: ['vet', 'paravet'],
};

// Verified professionals who may serve this service type
function useCandidates(serviceType) {
  const { data } = useApi(
    () => api.get('/admin/professionals', { params: { status: 'verified', limit: 100 } }).then((r) => r.data.data.professionals),
    []
  );
  const allowed = ROLES_FOR_SERVICE[serviceType] || [];
  return (data || []).filter((p) => allowed.includes(p.professionalRole) && p.user?.accountStatus === 'active');
}

function BookingModal({ id, onClose, onChanged }) {
  const { data, loading, error, reload } = useApi(() => api.get(`/admin/bookings/${id}`).then((r) => r.data.data), [id]);
  const counsellors = useApi(
    () => api.get('/admin/users', { params: { role: 'counsellor', accountStatus: 'active', limit: 100 } }).then((r) => r.data.data.users),
    []
  );
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [reassign, setReassign] = useState({ professionalId: '', counsellorId: '', reason: '' });
  const [resched, setResched] = useState({ date: '', slot: '' });
  const [cancel, setCancel] = useState({ reason: '', noShowType: 'none' });
  const [makeUp, setMakeUp] = useState({ professionalId: '', date: '', slot: '', payout: '' });

  const b = data?.booking;
  const candidates = useCandidates(b?.service?.type);
  const open = b && !['completed', 'cancelled'].includes(b.status);

  const run = async (fn) => {
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const res = await fn();
      setNotice({ type: 'info', text: res?.data?.message || 'Done.' });
      reload();
      onChanged();
    } catch (e) {
      setNotice({ type: 'error', text: e.response ? errMsg(e) : e.message });
    } finally {
      setBusy(false);
    }
  };

  const submitReassign = (e) => {
    e.preventDefault();
    const body = { reason: reassign.reason };
    if (reassign.professionalId) body.professionalId = reassign.professionalId;
    if (reassign.counsellorId) body.counsellorId = reassign.counsellorId === 'none' ? null : reassign.counsellorId;
    if (!body.professionalId && body.counsellorId === undefined) {
      setNotice({ type: 'error', text: 'Choose a professional and/or counsellor.' });
      return;
    }
    if (!window.confirm('Apply this reassignment to all unstarted sessions?')) return;
    run(() => api.post(`/admin/bookings/${id}/reassign`, body));
  };

  const submitReschedule = (e) => {
    e.preventDefault();
    run(() => {
      const body = { scheduledDate: toISO(resched.date) };
      if (resched.slot.trim()) body.timeSlot = resched.slot.trim();
      return api.post(`/admin/bookings/${id}/reschedule`, body);
    });
  };

  const submitCancel = (e) => {
    e.preventDefault();
    if (!window.confirm('Cancel this booking and all its unfinished sessions?')) return;
    run(() => api.post(`/bookings/${id}/cancel`, { reason: cancel.reason || 'Cancelled by admin', noShowType: cancel.noShowType }));
  };

  const submitMakeUp = (e) => {
    e.preventDefault();
    run(() => {
      const body = { professionalId: makeUp.professionalId, scheduledDate: toISO(makeUp.date), timeSlot: makeUp.slot };
      if (makeUp.payout !== '') body.payoutAmount = Number(makeUp.payout);
      return api.post(`/admin/bookings/${id}/make-up`, body);
    });
  };

  const proOptions = (
    <>
      <option value="">Select professional</option>
      {candidates.map((p) => <option key={p.user._id} value={p.user._id}>{p.user.name} ({label(p.professionalRole)}, {Number(p.averageRating || 0).toFixed(1)})</option>)}
    </>
  );

  return (
    <Modal title={b ? `${b.service?.title || 'Booking'} - ${b.pet?.name || ''}` : 'Booking'} onClose={onClose} wide>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {notice.text ? <div className={`alert ${notice.type}`}>{notice.text}</div> : null}

      {b ? (
        <>
          <div className="two">
            <div className="card">
              <div className="kv"><span>Status</span><Badge value={b.status} /></div>
              <div className="kv"><span>Client</span><strong>{b.user?.name} ({b.user?.phone})</strong></div>
              <div className="kv"><span>Pet</span><span>{b.pet?.name} - {b.pet?.breed}</span></div>
              <div className="kv"><span>Package</span><span>{b.package?.name}</span></div>
              <div className="kv"><span>Type</span><span>{label(b.bookingType)}</span></div>
              <div className="kv"><span>Starts</span><span>{fmtDateTime(b.scheduledDate)} ({b.timeSlot})</span></div>
            </div>
            <div className="card">
              <div className="kv"><span>Professional</span><strong>{b.assignedProfessional?.name || '-'}</strong></div>
              <div className="kv"><span>Counsellor</span><strong>{b.assignedCounsellor?.name || '-'}</strong></div>
              <div className="kv"><span>Sessions done</span><strong>{b.completedSessionCount} / {b.totalSessionCount}</strong></div>
              <div className="kv"><span>Package total</span><strong>{inr(b.totalAmount)}</strong></div>
              <div className="kv"><span>Address</span><span>{b.addressSnapshot?.line1}, {b.addressSnapshot?.city}</span></div>
              <div className="kv"><span>Make-up</span><Badge value={b.makeUpSessionStatus} /></div>
            </div>
          </div>

          <h3>Sessions (click one to manage it)</h3>
          <Table
            columns={[
              { key: 'n', title: '#', render: (s) => s.sessionNumber },
              { key: 'p', title: 'Professional', render: (s) => s.professional?.name || '-' },
              { key: 'w', title: 'Scheduled', render: (s) => fmtDateTime(s.scheduledDate) },
              { key: 's', title: 'Status', render: (s) => <Badge value={s.status} /> },
              { key: 'a', title: 'Fee / payout', render: (s) => `${inr(s.sessionAmount)} / ${inr(s.professionalPayoutAmount)}` },
              { key: 'se', title: 'Settled', render: (s) => (s.walletSettled ? 'Yes' : 'No') },
            ]}
            rows={b.sessionIds}
            onRowClick={(s) => setSessionId(s._id)}
          />

          {open ? (
            <>
              <h3>Reassign</h3>
              <form className="inline" onSubmit={submitReassign}>
                <Field label="Professional"><select value={reassign.professionalId} onChange={(e) => setReassign((r) => ({ ...r, professionalId: e.target.value }))}>{proOptions}</select></Field>
                {b.service?.type === 'Training' ? (
                  <Field label="Counsellor">
                    <select value={reassign.counsellorId} onChange={(e) => setReassign((r) => ({ ...r, counsellorId: e.target.value }))}>
                      <option value="">Keep current</option>
                      <option value="none">Remove counsellor</option>
                      {(counsellors.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </Field>
                ) : null}
                <Field label="Reason"><input value={reassign.reason} onChange={(e) => setReassign((r) => ({ ...r, reason: e.target.value }))} /></Field>
                <button className="btn primary" type="submit" disabled={busy}>Reassign</button>
              </form>

              <h3>Reschedule all unstarted sessions</h3>
              <form className="inline" onSubmit={submitReschedule}>
                <Field label="New start"><input type="datetime-local" value={resched.date} onChange={(e) => setResched((r) => ({ ...r, date: e.target.value }))} /></Field>
                <Field label="Time slot (optional)"><input value={resched.slot} onChange={(e) => setResched((r) => ({ ...r, slot: e.target.value }))} placeholder="10:00 AM - 11:00 AM" /></Field>
                <button className="btn primary" type="submit" disabled={busy}>Reschedule</button>
              </form>

              <h3>Cancel booking</h3>
              <form className="inline" onSubmit={submitCancel}>
                <Field label="Scenario">
                  <select value={cancel.noShowType} onChange={(e) => setCancel((c) => ({ ...c, noShowType: e.target.value }))}>
                    <option value="none">Standard cancellation</option>
                    <option value="customer_no_show">Client no-show</option>
                    <option value="professional_no_show">Professional no-show (client gets a make-up)</option>
                  </select>
                </Field>
                <Field label="Reason"><input value={cancel.reason} onChange={(e) => setCancel((c) => ({ ...c, reason: e.target.value }))} /></Field>
                <button className="btn danger" type="submit" disabled={busy}>Cancel booking</button>
              </form>
            </>
          ) : null}

          {b.makeUpSessionStatus === 'eligible' ? (
            <>
              <h3>Schedule the make-up session (free for the client)</h3>
              <form className="inline" onSubmit={submitMakeUp}>
                <Field label="Professional"><select value={makeUp.professionalId} onChange={(e) => setMakeUp((m) => ({ ...m, professionalId: e.target.value }))}>{proOptions}</select></Field>
                <Field label="Date and time"><input type="datetime-local" value={makeUp.date} onChange={(e) => setMakeUp((m) => ({ ...m, date: e.target.value }))} /></Field>
                <Field label="Time slot"><input value={makeUp.slot} onChange={(e) => setMakeUp((m) => ({ ...m, slot: e.target.value }))} placeholder="10:00 AM - 11:00 AM" /></Field>
                <Field label="Payout (blank = usual)"><input type="number" min="0" value={makeUp.payout} onChange={(e) => setMakeUp((m) => ({ ...m, payout: e.target.value }))} /></Field>
                <button className="btn primary" type="submit" disabled={busy}>Schedule</button>
              </form>
              <p className="sub">The professional's payout is a platform cost, since the client is not charged.</p>
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
            empty="No wallet entries yet."
          />

          <h3>History</h3>
          <Table
            columns={[
              { key: 't', title: 'When', render: (l) => fmtDateTime(l.timestamp) },
              { key: 'a', title: 'Action', render: (l) => label(l.action) },
              { key: 'w', title: 'By', render: (l) => `${l.actor?.name || '-'} (${l.actorRole})` },
            ]}
            rows={data.auditLogs}
            empty="No history yet."
          />
        </>
      ) : null}

      {sessionId ? <SessionModal id={sessionId} onClose={() => setSessionId(null)} onChanged={() => { reload(); onChanged(); }} /> : null}
    </Modal>
  );
}

export default function Bookings() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/bookings', {
      params: { q: dq || undefined, status: status || undefined, bookingType: type || undefined, page, limit: 20 },
    }).then((r) => r.data.data),
    [dq, status, type, page]
  );

  const columns = [
    { key: 'c', title: 'Client', render: (b) => <strong>{b.user?.name || '-'}</strong> },
    { key: 'pet', title: 'Pet', render: (b) => b.pet?.name || '-' },
    { key: 'pk', title: 'Service / package', render: (b) => `${b.service?.type || ''} - ${b.package?.name || ''}` },
    { key: 'pr', title: 'Professional', render: (b) => b.assignedProfessional?.name || '-' },
    { key: 'w', title: 'Starts', render: (b) => `${fmtDateTime(b.scheduledDate)}` },
    { key: 's', title: 'Status', render: (b) => <Badge value={b.status} /> },
    { key: 'p', title: 'Sessions', render: (b) => `${b.completedSessionCount}/${b.totalSessionCount}` },
    { key: 'm', title: 'Make-up', render: (b) => (b.makeUpSessionStatus === 'eligible' ? <Badge value="pending" /> : '-') },
  ];

  return (
    <>
      <PageHead title="Bookings" subtitle="Packages and single sessions booked by pet parents" />
      <div className="filters">
        <input
          placeholder="Search client name or phone"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {['upcoming', 'active', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {['free_assessment', 'single_session', 'multi_session_package', 'replacement_session'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <>
          <Table columns={columns} rows={data.bookings} empty="No bookings match." onRowClick={(b) => setSelectedId(b._id)} />
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}
      {selectedId ? <BookingModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} /> : null}
    </>
  );
}