import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { api, errMsg } from '../api/Client.js'
import {
  useApi, useDebounced, PageHead, Spinner, ErrorBox, Table, Badge, Modal, Pager, Field, label, fmtDateTime,
} from '../components/ui.jsx';

const PRO_ROLES = ['walker', 'trainer', 'groomer', 'vet', 'paravet', 'counsellor', 'relationship_manager'];
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-');
const isPast = (d) => d && new Date(d).getTime() < Date.now();

function ExpiryModal({ onClose, onChanged }) {
  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/professionals/expiring', { params: { days: 60 } }).then((r) => r.data.data.credentials),
    []
  );
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const call = async (dryRun) => {
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const res = await api.post('/admin/professionals/expire-overdue', { dryRun });
      setPreview(dryRun ? res.data.data.affected : null);
      setNotice({ type: 'info', text: res.data.message });
      if (!dryRun) {
        reload();
        onChanged();
      }
    } catch (e) {
      setNotice({ type: 'error', text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Credential expiry check (next 60 days)" onClose={onClose} wide>
      <ErrorBox message={error} />
      {notice.text ? <div className={`alert ${notice.type}`}>{notice.text}</div> : null}
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <Table
          columns={[
            { key: 'p', title: 'Professional', render: (c) => `${c.user?.name || '-'} (${label(c.professionalRole)})` },
            { key: 't', title: 'Credential', render: (c) => c.title },
            { key: 'e', title: 'Expires', render: (c) => fmtDate(c.expiryDate) },
            { key: 's', title: '', render: (c) => (c.expired ? <Badge value="expired" /> : <Badge value="pending" />) },
            { key: 'v', title: 'Profile', render: (c) => <Badge value={c.verificationStatus} /> },
          ]}
          rows={data}
          empty="No credentials expiring soon."
        />
      ) : null}
      <h3>Auto-expire</h3>
      <p className="sub">Moves verified professionals with an expired, verified credential to "expired". They stop receiving new bookings.</p>
      <div className="inline">
        <button className="btn" disabled={busy} onClick={() => call(true)}>Preview</button>
        {preview && preview.length > 0 ? (
          <button className="btn danger" disabled={busy} onClick={() => window.confirm(`Expire ${preview.length} professional(s)?`) && call(false)}>
            Apply to {preview.length}
          </button>
        ) : null}
      </div>
      {preview && preview.length > 0 ? (
        <ul>{preview.map((a) => <li key={a.profileId}>{a.user?.name} - {a.expiredCredentials.map((c) => c.title).join(', ')}</li>)}</ul>
      ) : null}
    </Modal>
  );
}

function ProfessionalDetailModal({ id, onClose, onChanged }) {
  const { data, loading, error, reload } = useApi(() => api.get(`/admin/professionals/${id}`).then((r) => r.data.data), [id]);
  const [notes, setNotes] = useState('');
  const [markAll, setMarkAll] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setNotes(data.professional.verificationNotes || '');
  }, [data]);

  const run = async (fn) => {
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const res = await fn();
      const warnings = res?.data?.data?.warnings || [];
      setNotice({ type: 'info', text: [res?.data?.message || 'Done.', ...warnings].join(' ') });
      reload();
      onChanged();
    } catch (e) {
      setNotice({ type: 'error', text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status) => {
    if (status === 'rejected' && !notes.trim()) {
      setNotice({ type: 'error', text: 'Add notes explaining the rejection first.' });
      return;
    }
    run(() => api.put(`/admin/professionals/${id}/verification`, { status, notes, markAllCredentialsVerified: markAll }));
  };

  const p = data?.professional;

  return (
    <Modal title={p?.user?.name || 'Professional'} onClose={onClose} wide>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {notice.text ? <div className={`alert ${notice.type}`}>{notice.text}</div> : null}

      {p ? (
        <>
          <div className="two">
            <div className="card">
              <div className="kv"><span>Role</span><strong>{label(p.professionalRole)}</strong></div>
              <div className="kv"><span>Phone</span><strong>{p.user?.phone}</strong></div>
              <div className="kv"><span>Account</span><Badge value={p.user?.accountStatus} /></div>
              <div className="kv"><span>Verification</span><Badge value={p.verificationStatus} /></div>
              <div className="kv"><span>Verified on</span><span>{fmtDateTime(p.verifiedAt)}</span></div>
              <div className="kv"><span>Experience</span><strong>{p.experienceYears} yrs</strong></div>
            </div>
            <div className="card">
              <div className="kv"><span>Rating</span><strong>{Number(p.averageRating || 0).toFixed(1)} ({p.totalEligibleReviews})</strong></div>
              <div className="kv"><span>Completed / assigned</span><strong>{p.totalCompletedSessions} / {p.totalAssignedSessions}</strong></div>
              <div className="kv"><span>Completion rate</span><strong>{p.completionPercentage}%</strong></div>
              <div className="kv"><span>Open sessions</span><strong>{data.openSessions}</strong></div>
              <div className="kv"><span>Reviews (published / flagged / hidden)</span><strong>{data.reviews.published} / {data.reviews.flagged} / {data.reviews.hidden}</strong></div>
              <div className="kv"><span>Available for bookings</span>
                <button className="btn small" disabled={busy} onClick={() => run(() => api.put(`/admin/professionals/${id}/availability`, { isAvailable: !p.isAvailable }))}>
                  {p.isAvailable ? 'Yes - set unavailable' : 'No - set available'}
                </button>
              </div>
            </div>
          </div>

          {p.bio ? <p className="sub" style={{ marginTop: 12 }}>{p.bio}</p> : null}
          {p.specializations?.length ? <p className="sub">Specializations: {p.specializations.join(', ')}</p> : null}
          {p.serviceAreas?.length ? <p className="sub">Areas: {p.serviceAreas.map((a) => [a.locality, a.city].filter(Boolean).join(', ')).join(' | ')}</p> : null}

          <h3>Credentials ({p.credentialSummary.verified}/{p.credentialSummary.total} verified)</h3>
          <Table
            columns={[
              { key: 't', title: 'Title', render: (c) => <strong>{c.title}</strong> },
              { key: 'i', title: 'Issuer', render: (c) => `${c.issuingBody}${c.credentialNumber ? ` #${c.credentialNumber}` : ''}` },
              { key: 'e', title: 'Expires', render: (c) => (isPast(c.expiryDate) ? <span style={{ color: 'var(--danger)' }}>{fmtDate(c.expiryDate)} (expired)</span> : fmtDate(c.expiryDate)) },
              { key: 'd', title: 'Document', render: (c) => (c.documentUrl ? <a href={c.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>View</a> : '-') },
              { key: 'v', title: 'Verified', render: (c) => <Badge value={c.verified ? 'verified' : 'pending'} /> },
              {
                key: 'a', title: '',
                render: (c) => (
                  <button className="btn small" disabled={busy || (!c.verified && isPast(c.expiryDate))} onClick={() => run(() => api.put(`/admin/professionals/${id}/credentials/${c._id}`, { verified: !c.verified }))}>
                    {c.verified ? 'Unverify' : 'Mark verified'}
                  </button>
                ),
              },
            ]}
            rows={p.credentials}
            empty="No credentials uploaded."
          />

          <h3>Verification decision</h3>
          <Field label="Notes (required to reject)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={markAll} onChange={(e) => setMarkAll(e.target.checked)} />
            When verifying, also mark all unexpired credentials as verified
          </label>
          <div className="row-actions">
            <button className="btn ok" disabled={busy} onClick={() => setStatus('verified')}>Verify</button>
            <button className="btn danger" disabled={busy} onClick={() => setStatus('rejected')}>Reject</button>
            <button className="btn" disabled={busy} onClick={() => setStatus('pending')}>Mark pending</button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}

export default function Professionals() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [status, setStatus] = useState('pending');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [showExpiry, setShowExpiry] = useState(false);

  useEffect(() => { setPage(1); }, [dq, status, role]);

  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/professionals', {
      params: { q: dq || undefined, status: status || undefined, role: role || undefined, page, limit: 20 },
    }).then((r) => r.data.data),
    [dq, status, role, page]
  );

  const columns = [
    { key: 'n', title: 'Name', render: (p) => <strong>{p.user?.name || '-'}</strong> },
    { key: 'ph', title: 'Phone', render: (p) => p.user?.phone || '-' },
    { key: 'r', title: 'Role', render: (p) => label(p.professionalRole) },
    { key: 's', title: 'Verification', render: (p) => <Badge value={p.verificationStatus} /> },
    { key: 'a', title: 'Account', render: (p) => <Badge value={p.user?.accountStatus} /> },
    {
      key: 'c', title: 'Credentials',
      render: (p) => {
        const c = p.credentialSummary;
        return `${c.verified}/${c.total} verified${c.expired ? `, ${c.expired} expired` : ''}${c.expiringWithin30Days ? `, ${c.expiringWithin30Days} expiring` : ''}`;
      },
    },
    { key: 'rt', title: 'Rating', render: (p) => `${Number(p.averageRating || 0).toFixed(1)} (${p.totalEligibleReviews})` },
    { key: 'av', title: 'Available', render: (p) => (p.isAvailable ? 'Yes' : 'No') },
  ];

  return (
    <>
      <PageHead title="Professionals" subtitle="Verify credentials before professionals can receive bookings">
        <button className="btn" onClick={() => setShowExpiry(true)}><Clock size={14} /> Expiry check</button>
      </PageHead>

      <div className="filters">
        <input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['pending', 'verified', 'rejected', 'expired'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {PRO_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
        </select>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr>{columns.map((c) => <th key={c.key}>{c.title}</th>)}</tr></thead>
              <tbody>
                {data.professionals.map((p) => (
                  <tr key={p._id} className="clickable" onClick={() => setSelectedId(p._id)}>
                    {columns.map((c) => <td key={c.key}>{c.render(p)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.professionals.length === 0 ? <div className="empty">No professionals match.</div> : null}
          </div>
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}

      {selectedId ? <ProfessionalDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} /> : null}
      {showExpiry ? <ExpiryModal onClose={() => setShowExpiry(false)} onChanged={reload} /> : null}
    </>
  );
}