import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, errMsg } from '../api/client.js';
import { PageHead, Spinner, ErrorBox, Table, Badge, Pager } from '../components/ui.jsx';
import { useApi, useDebounced, label, fmtDateTime } from '../components/uiHelpers.js';

export default function Reviews() {
  const [status, setStatus] = useState('flagged');
  const [maxRating, setMaxRating] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [busyId, setBusyId] = useState('');

  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/reviews', {
      params: { moderationStatus: status || undefined, maxRating: maxRating || undefined, q: dq || undefined, page, limit: 20 },
    }).then((r) => r.data.data),
    [status, maxRating, dq, page]
  );

  const moderate = async (review, next) => {
    if (!window.confirm(`Mark this review as ${next}? ${review.professional?.name}'s rating will be recalculated.`)) return;
    setBusyId(review._id);
    setNotice({ type: '', text: '' });
    try {
      const res = await api.put(`/admin/reviews/${review._id}/moderation`, { status: next });
      const r = res.data.data.rating;
      setNotice({ type: 'info', text: `${res.data.message} New rating: ${r.averageRating} from ${r.totalEligibleReviews} review(s).` });
      reload();
    } catch (e) {
      setNotice({ type: 'error', text: errMsg(e) });
    } finally {
      setBusyId('');
    }
  };

  const recalcAll = async () => {
    if (!window.confirm('Recalculate every professional\'s rating from published reviews?')) return;
    try {
      const res = await api.post('/admin/reviews/recalculate', {});
      setNotice({ type: 'info', text: res.data.message });
    } catch (e) {
      setNotice({ type: 'error', text: errMsg(e) });
    }
  };

  const columns = [
    { key: 'r', title: 'Rating', render: (r) => <strong style={{ color: 'var(--warning)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</strong> },
    { key: 't', title: 'Review', render: (r) => <div style={{ maxWidth: 320 }}>{r.reviewText || <span className="sub">No text</span>}</div> },
    { key: 'c', title: 'Client', render: (r) => r.customer?.name || '-' },
    { key: 'p', title: 'Professional', render: (r) => r.professional?.name || '-' },
    { key: 's', title: 'Status', render: (r) => <Badge value={r.moderationStatus} /> },
    { key: 'd', title: 'Date', render: (r) => fmtDateTime(r.createdAt) },
    {
      key: 'a', title: '',
      render: (r) => (
        <div className="row-actions">
          {['published', 'flagged', 'hidden'].filter((s) => s !== r.moderationStatus).map((s) => (
            <button key={s} className={`btn small ${s === 'hidden' ? 'danger' : s === 'published' ? 'ok' : ''}`} disabled={busyId === r._id} onClick={() => moderate(r, s)}>
              {label(s)}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHead title="Reviews" subtitle="Hidden and flagged reviews do not count toward a professional's rating">
        <button className="btn" onClick={recalcAll}><RefreshCw size={14} /> Recalculate all ratings</button>
      </PageHead>
      <div className="filters">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {['published', 'flagged', 'hidden'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select
          value={maxRating}
          onChange={(e) => {
            setMaxRating(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any rating</option>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n} star or lower</option>)}
        </select>
        <input
          placeholder="Search review text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {notice.text ? <div className={`alert ${notice.type}`}>{notice.text}</div> : null}
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <>
          <Table columns={columns} rows={data.reviews} empty="No reviews match." />
          <Pager pagination={data.pagination} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}