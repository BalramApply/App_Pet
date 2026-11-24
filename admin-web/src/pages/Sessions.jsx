import React, { useEffect, useState } from 'react';
import { api } from '../api/Client.js'
import { useApi, PageHead, Spinner, ErrorBox, Table, Badge, Pager, label, fmtDateTime, inr } from '../components/ui.jsx';
import SessionModal from '../components/SessionModal.jsx';

const STATUSES = ['scheduled', 'professional_arrived', 'in_progress', 'duration_completed', 'completed', 'interrupted', 'disputed', 'cancelled'];

export default function Sessions() {
  const [status, setStatus] = useState('');
  const [settled, setSettled] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => { setPage(1); }, [status, settled]);

  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/sessions', {
      params: { status: status || undefined, walletSettled: settled || undefined, page, limit: 20 },
    }).then((r) => r.data.data),
    [status, settled, page]
  );

  const columns = [
    { key: 'n', title: 'Session', render: (s) => `#${s.sessionNumber}` },
    { key: 'pet', title: 'Pet', render: (s) => s.pet?.name || '-' },
    { key: 'c', title: 'Client', render: (s) => s.customer?.name || '-' },
    { key: 'p', title: 'Professional', render: (s) => s.professional?.name || '-' },
    { key: 'w', title: 'Scheduled', render: (s) => fmtDateTime(s.scheduledDate) },
    { key: 'st', title: 'Status', render: (s) => <Badge value={s.status} /> },
    { key: 'f', title: 'Fee', render: (s) => inr(s.sessionAmount) },
    { key: 'se', title: 'Settled', render: (s) => (s.walletSettled ? 'Yes' : 'No') },
  ];

  return (
    <>
      <PageHead title="Sessions" subtitle="Every individual visit, newest first" />
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select value={settled} onChange={(e) => setSettled(e.target.value)}>
          <option value="">Settled or not</option>
          <option value="false">Not settled</option>
          <option value="true">Settled</option>
        </select>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <>
          <Table columns={columns} rows={data.sessions} empty="No sessions match." onRowClick={(s) => setSelectedId(s._id)} />
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}
      {selectedId ? <SessionModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} /> : null}
    </>
  );
}