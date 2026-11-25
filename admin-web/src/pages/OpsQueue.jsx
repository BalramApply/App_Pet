import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, errMsg } from '../api/client.js';
import { useApi, PageHead, Spinner, ErrorBox, Table, Badge, fmtDateTime } from '../components/ui.jsx';
import SessionModal from '../components/SessionModal.jsx';

const baseColumns = [
  { key: 'n', title: 'Session', render: (s) => `#${s.sessionNumber}` },
  { key: 'pet', title: 'Pet', render: (s) => s.pet?.name || '-' },
  { key: 'customer', title: 'Client', render: (s) => (s.customer ? `${s.customer.name} (${s.customer.phone})` : '-') },
  { key: 'pro', title: 'Professional', render: (s) => (s.professional ? `${s.professional.name} (${s.professional.role})` : '-') },
  { key: 'when', title: 'Scheduled', render: (s) => fmtDateTime(s.scheduledDate) },
  { key: 'status', title: 'Status', render: (s) => <Badge value={s.status} /> },
];

function Section({ title, hint, rows, columns, empty, onRowClick }) {
  return (
    <>
      <h2 className="section">{title} <span className="badge">{rows.length}</span></h2>
      {hint ? <p className="sub" style={{ margin: '0 0 8px' }}>{hint}</p> : null}
      <Table columns={columns} rows={rows} empty={empty} onRowClick={onRowClick} />
    </>
  );
}

export default function OpsQueue() {
  const { data, loading, error, reload } = useApi(() => api.get('/admin/ops/attention').then((r) => r.data.data));
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [busyId, setBusyId] = useState('');
  const [openId, setOpenId] = useState(null);

  const retry = async (session) => {
    if (!window.confirm(`Retry wallet settlement for session #${session.sessionNumber}?`)) return;
    setBusyId(session._id);
    setNotice({ type: '', text: '' });
    try {
      const res = await api.post(`/admin/sessions/${session._id}/retry-settlement`);
      setNotice({ type: 'info', text: res.data.message });
      reload();
    } catch (e) {
      setNotice({ type: 'error', text: errMsg(e) });
    } finally {
      setBusyId('');
    }
  };

  const unsettledColumns = [
    ...baseColumns,
    {
      key: 'act',
      title: '',
      render: (s) => (
        <button className="btn small primary" disabled={busyId === s._id} onClick={(e) => { e.stopPropagation(); retry(s); }}>
          {busyId === s._id ? 'Working...' : 'Retry settlement'}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHead title="Ops queue" subtitle="Sessions that need an admin decision">
        <button className="btn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </PageHead>

      {notice.text ? <div className={`alert ${notice.type}`}>{notice.text}</div> : null}
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}

      {data ? (
        <>
          <Section
            title="Disputed or interrupted"
            hint="Click a row to resolve it: complete, cancel or schedule again."
            rows={data.disputedOrInterrupted}
            columns={baseColumns}
            onRowClick={(r) => setOpenId(r._id)}
            empty="No disputed or interrupted sessions."
          />
          <Section
            title="Completed but not settled"
            hint="The client balance was too low at completion. Top up the wallet, then retry."
            rows={data.completedButUnsettled}
            columns={unsettledColumns}
            onRowClick={(r) => setOpenId(r._id)}
            empty="Every completed session is settled."
          />
          <Section
            title="Overdue, not started"
            hint="Scheduled more than 2 hours ago and still not started."
            rows={data.overdueNotStarted}
            columns={baseColumns}
            onRowClick={(r) => setOpenId(r._id)}
            empty="No overdue sessions."
          />
          <Section
            title="Assigned to an unavailable professional"
            hint="The professional is suspended, deleted or no longer verified. Open the booking on the Bookings page to reassign."
            rows={data.assignedToUnavailableProfessional}
            columns={baseColumns}
            onRowClick={(r) => setOpenId(r._id)}
            empty="No stranded sessions."
          />
          <p className="sub">{data.note}</p>
        </>
      ) : null}
      {openId ? <SessionModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} /> : null}
    </>
  );
}