import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client.js';
import {
  useApi, useDebounced, PageHead, Spinner, ErrorBox, Table, Badge, Modal, Pager, Field, label, fmtDateTime,
} from '../components/ui.jsx';

// The customer replied after the last staff reply (or staff never replied)
const awaitingStaff = (t) =>
  Boolean(t.lastUserReplyAt) && (!t.lastStaffReplyAt || new Date(t.lastUserReplyAt) > new Date(t.lastStaffReplyAt));

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const TYPES = ['emergency_sos', 'callback_request', 'complaint', 'reschedule_request', 'wallet_billing_inquiry', 'concern_report', 'email_inquiry'];

function TicketModal({ id, onClose, onChanged }) {
  const { data, loading, error, reload } = useApi(() => api.get(`/admin/support/tickets/${id}`).then((r) => r.data.data.ticket), [id]);
  const rms = useApi(() => api.get('/admin/users', { params: { role: 'relationship_manager', accountStatus: 'active', limit: 100 } }).then((r) => r.data.data.users), []);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        status: data.status,
        priority: data.priority,
        rm: data.assignedRelationshipManager?._id || '',
        summary: data.resolution?.summary || '',
      });
    }
  }, [data]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const body = { status: form.status, priority: form.priority, assignedRelationshipManager: form.rm || null };
      if (form.summary.trim()) body.resolutionSummary = form.summary;
      const res = await api.put(`/admin/support/tickets/${id}`, body);
      setNotice({ type: 'info', text: res.data.message });
      reload();
      onChanged();
    } catch (err) {
      setNotice({ type: 'error', text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const res = await api.post(`/admin/support/tickets/${id}/messages`, { body: reply, internal });
      setNotice({ type: 'info', text: res.data.message });
      setReply('');
      setInternal(false);
      reload();
      onChanged();
    } catch (err) {
      setNotice({ type: 'error', text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  const t = data;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={t ? `Ticket ${t.ticketNumber}` : 'Ticket'} onClose={onClose} wide>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {notice.text ? <div className={`alert ${notice.type}`}>{notice.text}</div> : null}
      {t && form ? (
        <>
          <div className="two">
            <div className="card">
              <div className="kv"><span>Type</span><Badge value={t.type === 'emergency_sos' ? 'critical' : t.type} /></div>
              <div className="kv"><span>Raised by</span><strong>{t.user?.name} ({t.user?.phone})</strong></div>
              <div className="kv"><span>Created</span><span>{fmtDateTime(t.createdAt)}</span></div>
              <div className="kv"><span>Subject</span><span>{t.subject || '-'}</span></div>
            </div>
            <div className="card">
              <div className="kv"><span>Booking</span><span>{t.booking ? `${t.booking.service?.title || 'Booking'} (${label(t.booking.status)})` : '-'}</span></div>
              <div className="kv"><span>Session</span><span>{t.session ? `#${t.session.sessionNumber} (${label(t.session.status)})` : '-'}</span></div>
              <div className="kv"><span>Professional</span><span>{t.professional?.name || '-'}</span></div>
              <div className="kv"><span>Resolved by</span><span>{t.resolution?.resolvedBy?.name || '-'}</span></div>
            </div>
          </div>
          <h3>Original request</h3>
          <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{t.notes}</div>

          <h3>Conversation</h3>
          <div className="thread">
            {(t.messages || []).length === 0 ? <div className="sub">No replies yet.</div> : null}
            {(t.messages || []).map((m) => (
              <div key={m._id} className={`msg ${m.authorRole === 'admin' ? 'staff' : 'client'} ${m.internal ? 'internal' : ''}`}>
                <div className="msg-meta">
                  {m.author?.name || label(m.authorRole)}{m.internal ? ' - internal note' : ''} - {fmtDateTime(m.createdAt)}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
              </div>
            ))}
          </div>
          {t.status === 'closed' ? (
            <p className="sub">This ticket is closed. Set it back to open below to reply.</p>
          ) : (
            <form onSubmit={sendReply}>
              <Field label="Reply to the customer, or leave a note">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} />
              </Field>
              <label className="check">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                Internal note (the customer cannot see it)
              </label>
              <button className="btn primary" type="submit" disabled={busy || !reply.trim()}>
                {internal ? 'Add note' : 'Send reply'}
              </button>
            </form>
          )}

          <h3>Handle ticket</h3>
          <form onSubmit={save}>
            <div className="inline">
              <Field label="Status">
                <select value={form.status} onChange={set('status')}>
                  {['open', 'in_review', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select value={form.priority} onChange={set('priority')}>
                  {[...PRIORITIES].reverse().map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </Field>
              <Field label="Relationship manager">
                <select value={form.rm} onChange={set('rm')}>
                  <option value="">Unassigned</option>
                  {(rms.data || []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Resolution summary (required to resolve)">
              <textarea value={form.summary} onChange={set('summary')} />
            </Field>
            <div style={{ marginTop: 12 }}><button className="btn primary" type="submit" disabled={busy}>Save</button></div>
          </form>
        </>
      ) : null}
    </Modal>
  );
}

export default function Support() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [openOnly, setOpenOnly] = useState(true);
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => { setPage(1); }, [dq, openOnly, priority, type, unassigned]);

  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/support/tickets', {
      params: {
        q: dq || undefined, openOnly: openOnly || undefined, priority: priority || undefined, type: type || undefined,
        unassigned: unassigned || undefined, sort: 'queue', page, limit: 20,
      },
    }).then((r) => r.data.data),
    [dq, openOnly, priority, type, unassigned, page]
  );

  const columns = [
    {
      key: 'n', title: 'Ticket',
      render: (t) => (
        <>
          <strong>{t.ticketNumber}</strong>
          {awaitingStaff(t) ? <span className="badge warn" style={{ marginLeft: 6 }}>customer replied</span> : null}
          {t.messageCount ? <span className="sub"> {t.messageCount} msg</span> : null}
        </>
      ),
    },
    { key: 't', title: 'Type', render: (t) => (t.type === 'emergency_sos' ? <Badge value="critical" /> : label(t.type)) },
    { key: 'p', title: 'Priority', render: (t) => <Badge value={t.priority} /> },
    { key: 's', title: 'Status', render: (t) => <Badge value={t.status} /> },
    { key: 'u', title: 'Client', render: (t) => t.user?.name || '-' },
    { key: 'm', title: 'Message', render: (t) => (t.subject || t.notes || '').slice(0, 60) },
    { key: 'r', title: 'Manager', render: (t) => t.assignedRelationshipManager?.name || '-' },
    { key: 'c', title: 'Created', render: (t) => fmtDateTime(t.createdAt) },
  ];

  const sum = data?.summary;

  return (
    <>
      <PageHead title="Support tickets" subtitle={sum ? `${sum.openSos} open SOS - ${Object.values(sum.openByPriority).reduce((a, b) => a + b, 0)} open in total` : ''} />
      <div className="filters">
        <input placeholder="Search ticket number or text" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{label(p)}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((p) => <option key={p} value={p}>{label(p)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open only</label>
        <label className="check"><input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} /> Unassigned</label>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <>
          <Table columns={columns} rows={data.tickets} empty="No tickets match." onRowClick={(t) => setSelectedId(t._id)} />
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}
      {selectedId ? <TicketModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} /> : null}
    </>
  );
}