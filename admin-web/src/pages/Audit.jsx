import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApi, useDebounced, PageHead, Spinner, ErrorBox, Table, Badge, Modal, Pager, fmtDateTime } from '../components/ui.jsx';

export default function Audit() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [method, setMethod] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  useEffect(() => { setPage(1); }, [dq, method, success]);

  const { data, loading, error } = useApi(
    () => api.get('/admin/audit-logs', {
      params: { q: dq || undefined, method: method || undefined, success: success || undefined, page, limit: 30 },
    }).then((r) => r.data.data),
    [dq, method, success, page]
  );

  const columns = [
    { key: 't', title: 'When', render: (l) => fmtDateTime(l.createdAt) },
    { key: 'a', title: 'Admin', render: (l) => l.actor?.name || l.actorName || '-' },
    { key: 'x', title: 'Action', render: (l) => <code>{l.action.replace('/api/admin', '')}</code> },
    { key: 'i', title: 'Target', render: (l) => (l.targetId ? l.targetId.slice(-6) : '-') },
    { key: 's', title: 'Result', render: (l) => <Badge value={l.success ? 'completed' : 'rejected'} /> },
    { key: 'c', title: 'HTTP', render: (l) => l.statusCode },
  ];

  return (
    <>
      <PageHead title="Audit log" subtitle="Every change made through the admin API. Passwords are never stored." />
      <div className="filters">
        <input placeholder="Search action, e.g. reset-password" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">All methods</option>
          {['POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={success} onChange={(e) => setSuccess(e.target.value)}>
          <option value="">Succeeded or failed</option>
          <option value="true">Succeeded</option>
          <option value="false">Failed</option>
        </select>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <>
          <Table columns={columns} rows={data.logs} empty="No admin actions recorded yet." onRowClick={setOpen} />
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}
      {open ? (
        <Modal title="Request details" onClose={() => setOpen(null)}>
          <div className="kv"><span>Admin</span><strong>{open.actor?.name || open.actorName}</strong></div>
          <div className="kv"><span>Path</span><code>{open.method} {open.path}</code></div>
          <div className="kv"><span>HTTP status</span><strong>{open.statusCode}</strong></div>
          <div className="kv"><span>IP</span><span>{open.ip || '-'}</span></div>
          <h3>Request body</h3>
          <pre style={{ background: 'var(--bg)', padding: 12, borderRadius: 10, overflow: 'auto', fontSize: 12 }}>{JSON.stringify(open.requestBody, null, 2)}</pre>
        </Modal>
      ) : null}
    </>
  );
}