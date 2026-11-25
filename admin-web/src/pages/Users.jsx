import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, errMsg } from '../api/Client.js';
import {
  PageHead, Spinner, ErrorBox, Table, Badge, Modal, Pager, Field, SecretBox,
} from '../components/ui.jsx';
import {
  useApi, useDebounced, inr, label, fmtDateTime,
} from '../components/ui.jsx';

const PRO_ROLES = ['walker', 'trainer', 'groomer', 'vet', 'paravet', 'counsellor', 'relationship_manager'];
const ALL_ROLES = ['pet_parent', ...PRO_ROLES];

function CreateStaffModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: 'trainer', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form };
      if (!body.password) delete body.password;
      if (!body.email) delete body.email;
      const res = await api.post('/admin/staff', body);
      setResult(res.data.data);
      onCreated();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add staff account" onClose={onClose}>
      {result ? (
        <>
          <div className="alert info">Created {result.user.name} ({label(result.user.role)}). Verify their profile on the Professionals page.</div>
          {result.temporaryPassword ? <SecretBox title="Temporary password" value={result.temporaryPassword} /> : null}
          <button className="btn primary" onClick={onClose}>Done</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <ErrorBox message={error} />
          <Field label="Full name"><input value={form.name} onChange={set('name')} required /></Field>
          <Field label="Mobile number"><input value={form.phone} onChange={set('phone')} inputMode="tel" required /></Field>
          <Field label="Email (optional)"><input value={form.email} onChange={set('email')} type="email" /></Field>
          <Field label="Role">
            <select value={form.role} onChange={set('role')}>
              {PRO_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
            </select>
          </Field>
          <Field label="Password (leave empty to generate one)"><input value={form.password} onChange={set('password')} type="text" /></Field>
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function EditForm({ user, rms, onSaved, run }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email || '',
    role: user.role,
    rm: user.profile?.assignedRelationshipManager?._id || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e) => {
    e.preventDefault();
    const body = { name: form.name, email: form.email, role: form.role };
    if (user.role === 'pet_parent') body.assignedRelationshipManager = form.rm || null;
    run(async () => {
      const res = await api.put(`/admin/users/${user._id}`, body);
      onSaved();
      const warnings = res.data.data.warnings || [];
      return warnings.length ? `Saved. ${warnings.join(' ')}` : 'Saved.';
    });
  };

  return (
    <form onSubmit={save}>
      <div className="inline">
        <Field label="Name"><input value={form.name} onChange={set('name')} /></Field>
        <Field label="Email"><input value={form.email} onChange={set('email')} /></Field>
      </div>
      <div className="inline" style={{ marginTop: 10 }}>
        <Field label="Role">
          <select value={form.role} onChange={set('role')}>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
          </select>
        </Field>
        {user.role === 'pet_parent' ? (
          <Field label="Relationship manager">
            <select value={form.rm} onChange={set('rm')}>
              <option value="">None</option>
              {rms.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </Field>
        ) : null}
        <button className="btn primary" type="submit">Save changes</button>
      </div>
    </form>
  );
}

function UserDetailModal({ id, onClose, onChanged }) {
  const { data, loading, error, reload } = useApi(() => api.get(`/admin/users/${id}`).then((r) => r.data.data), [id]);
  const rmsQuery = useApi(() => api.get('/admin/users', { params: { role: 'relationship_manager', accountStatus: 'active', limit: 100 } }).then((r) => r.data.data.users), []);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [wallet, setWallet] = useState({ amount: '', type: 'credit', category: 'admin_topup', note: '' });

  // Runs an action, shows its message, and refreshes both detail and list
  const run = async (fn) => {
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const text = await fn();
      setNotice({ type: 'info', text: text || 'Done.' });
      reload();
      onChanged();
    } catch (e) {
      setNotice({ type: 'error', text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const u = data?.user;
  const toggleStatus = () => {
    const next = u.accountStatus === 'suspended' ? 'active' : 'suspended';
    if (!window.confirm(`${next === 'suspended' ? 'Suspend' : 'Reactivate'} ${u.name}?`)) return;
    run(async () => {
      const res = await api.put(`/admin/users/${u._id}`, { accountStatus: next });
      const w = res.data.data.warnings || [];
      return `Account ${next}. ${w.join(' ')}`;
    });
  };

  const resetPassword = () => {
    if (!window.confirm(`Reset the password for ${u.name}? They will be signed out everywhere.`)) return;
    setSecret('');
    run(async () => {
      const res = await api.post(`/admin/users/${u._id}/reset-password`, newPassword ? { newPassword } : {});
      if (res.data.data.temporaryPassword) setSecret(res.data.data.temporaryPassword);
      setNewPassword('');
      return 'Password reset.';
    });
  };

  const adjustWallet = (e) => {
    e.preventDefault();
    const amount = Number(wallet.amount);
    if (!(amount > 0)) {
      setNotice({ type: 'error', text: 'Enter an amount greater than 0.' });
      return;
    }
    const verb = wallet.type === 'credit' ? 'Credit' : 'Debit';
    if (!window.confirm(`${verb} ${inr(amount)} ${wallet.type === 'credit' ? 'to' : 'from'} ${u.name}'s wallet?`)) return;
    run(async () => {
      await api.post('/admin/wallet/credit', {
        userId: u._id, amount, type: wallet.type, category: wallet.category, note: wallet.note,
      });
      setWallet({ amount: '', type: 'credit', category: 'admin_topup', note: '' });
      return `Wallet ${wallet.type === 'credit' ? 'credited' : 'debited'}.`;
    });
  };

  const isAdmin = u?.role === 'admin';

  return (
    <Modal title={u ? u.name : 'User'} onClose={onClose} wide>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {notice.text ? <div className={`alert ${notice.type}`}>{notice.text}</div> : null}
      {secret ? <SecretBox title="Temporary password" value={secret} /> : null}

      {u ? (
        <>
          <div className="two">
            <div className="card">
              <div className="kv"><span>Phone</span><strong>{u.phone}</strong></div>
              <div className="kv"><span>Email</span><strong>{u.email || '-'}</strong></div>
              <div className="kv"><span>Role</span><Badge value={u.role} /></div>
              <div className="kv"><span>Status</span><Badge value={u.accountStatus} /></div>
              <div className="kv"><span>Joined</span><span>{fmtDateTime(u.createdAt)}</span></div>
              <div className="kv"><span>Last login</span><span>{fmtDateTime(u.authenticationMetadata?.lastLoginAt)}</span></div>
            </div>
            <div className="card">
              <div className="kv"><span>Wallet balance</span><strong>{inr(u.walletBalance)}</strong></div>
              <div className="kv"><span>Pets</span><strong>{data.counts.pets}</strong></div>
              <div className="kv"><span>Bookings</span><strong>{data.counts.bookings}</strong></div>
              <div className="kv"><span>Open sessions</span><strong>{data.counts.openSessions}</strong></div>
              <div className="kv"><span>Relationship manager</span><span>{u.profile?.assignedRelationshipManager?.name || '-'}</span></div>
            </div>
          </div>

          {isAdmin ? (
            <div className="alert info" style={{ marginTop: 14 }}>Admin accounts cannot be edited here.</div>
          ) : (
            <>
              <h3>Edit</h3>
              <EditForm key={`${u._id}-${u.role}-${u.name}`} user={u} rms={rmsQuery.data || []} onSaved={() => {}} run={run} />

              <h3>Account actions</h3>
              <div className="inline">
                <button className={`btn ${u.accountStatus === 'suspended' ? 'ok' : 'danger'}`} disabled={busy || u.accountStatus === 'deleted'} onClick={toggleStatus}>
                  {u.accountStatus === 'suspended' ? 'Reactivate account' : 'Suspend account'}
                </button>
                <Field label="New password (optional)"><input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave empty to generate" /></Field>
                <button className="btn" disabled={busy} onClick={resetPassword}>Reset password</button>
              </div>

              <h3>Wallet adjustment</h3>
              <form className="inline" onSubmit={adjustWallet}>
                <Field label="Amount (INR)"><input type="number" min="1" step="1" value={wallet.amount} onChange={(e) => setWallet((w) => ({ ...w, amount: e.target.value }))} /></Field>
                <Field label="Type">
                  <select value={wallet.type} onChange={(e) => setWallet((w) => ({ ...w, type: e.target.value, category: e.target.value === 'credit' ? 'admin_topup' : 'adjustment' }))}>
                    <option value="credit">Credit (add)</option>
                    <option value="debit">Debit (remove)</option>
                  </select>
                </Field>
                <Field label="Category">
                  <select value={wallet.category} onChange={(e) => setWallet((w) => ({ ...w, category: e.target.value }))}>
                    {(wallet.type === 'credit' ? ['admin_topup', 'refund', 'adjustment'] : ['adjustment']).map((c) => <option key={c} value={c}>{label(c)}</option>)}
                  </select>
                </Field>
                <Field label="Note"><input value={wallet.note} onChange={(e) => setWallet((w) => ({ ...w, note: e.target.value }))} placeholder="e.g. UPI ref 1234" /></Field>
                <button className="btn primary" type="submit" disabled={busy}>Apply</button>
              </form>
            </>
          )}

          <h3>Recent wallet entries</h3>
          <Table
            columns={[
              { key: 'd', title: 'Date', render: (t) => fmtDateTime(t.createdAt) },
              { key: 'c', title: 'Category', render: (t) => label(t.category) },
              { key: 'a', title: 'Amount', render: (t) => `${t.type === 'credit' ? '+' : '-'}${inr(t.amount)}` },
              { key: 'b', title: 'Balance after', render: (t) => inr(t.balanceAfter) },
            ]}
            rows={data.recentTransactions}
            empty="No wallet activity yet."
          />
        </>
      ) : null}
    </Modal>
  );
}

export default function Users() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/users', {
      params: { q: dq || undefined, role: role || undefined, accountStatus: status || undefined, page, limit: 20 },
    }).then((r) => r.data.data),
    [dq, role, status, page]
  );

  const columns = [
    { key: 'name', title: 'Name', render: (u) => <strong>{u.name}</strong> },
    { key: 'phone', title: 'Phone', render: (u) => u.phone },
    { key: 'role', title: 'Role', render: (u) => <Badge value={u.role} /> },
    { key: 'status', title: 'Status', render: (u) => <Badge value={u.accountStatus} /> },
    {
      key: 'ver', title: 'Verification',
      render: (u) => (u.professionalProfile ? <Badge value={u.professionalProfile.verificationStatus} /> : '-'),
    },
    { key: 'wallet', title: 'Wallet', render: (u) => inr(u.walletBalance) },
    { key: 'joined', title: 'Joined', render: (u) => fmtDateTime(u.createdAt) },
  ];

  return (
    <>
      <PageHead title="Users & staff" subtitle="Pet parents, professionals and managers">
        <button className="btn primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Add staff</button>
      </PageHead>

      <div className="filters">
        <input
          placeholder="Search name, phone or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {[...ALL_ROLES, 'admin'].map((r) => <option key={r} value={r}>{label(r)}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {['active', 'suspended', 'pending_verification', 'deleted'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
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
                {data.users.map((u) => (
                  <tr key={u._id} className="clickable" onClick={() => setSelectedId(u._id)}>
                    {columns.map((c) => <td key={c.key}>{c.render(u)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.users.length === 0 ? <div className="empty">No users match.</div> : null}
          </div>
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}

      {selectedId ? <UserDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} /> : null}
      {showCreate ? <CreateStaffModal onClose={() => setShowCreate(false)} onCreated={reload} /> : null}
    </>
  );
}