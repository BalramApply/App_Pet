import React from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi, PageHead, StatCard, Spinner, ErrorBox, inr, label, fmtDateTime } from '../components/ui.jsx';

const PRO_ROLES = ['walker', 'trainer', 'groomer', 'vet', 'paravet', 'counsellor', 'relationship_manager'];

const Breakdown = ({ title, data }) => (
  <div className="card">
    <strong>{title}</strong>
    <div style={{ marginTop: 8 }}>
      {Object.keys(data || {}).length === 0 ? <div className="sub">No data yet.</div> : null}
      {Object.entries(data || {}).map(([k, v]) => (
        <div className="kv" key={k}><span>{label(k)}</span><strong>{v}</strong></div>
      ))}
    </div>
  </div>
);

export default function Dashboard() {
  const { data, loading, error, reload } = useApi(() => api.get('/admin/dashboard/stats').then((r) => r.data.data));

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  const d = data;

  const byRole = d.users.byRole || {};
  const proCount = PRO_ROLES.reduce((sum, r) => sum + (byRole[r] || 0), 0);
  const sessionStatus = d.sessions.byStatus || {};
  const disputes = (sessionStatus.disputed || 0) + (sessionStatus.interrupted || 0);

  return (
    <>
      <PageHead title="Dashboard" subtitle={`Updated ${fmtDateTime(d.generatedAt)}`}>
        <button className="btn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </PageHead>

      <h2 className="section" style={{ marginTop: 0 }}>Needs attention</h2>
      <div className="grid">
        <StatCard label="Open SOS" value={d.support.openSos} tone={d.support.openSos ? 'danger' : 'ok'} hint="Emergency tickets" to="/support" />
        <StatCard label="Disputed / interrupted" value={disputes} tone={disputes ? 'danger' : 'ok'} hint="Sessions to resolve" to="/ops" />
        <StatCard label="Completed, not settled" value={d.sessions.completedButUnsettled} tone={d.sessions.completedButUnsettled ? 'warn' : 'ok'} hint="Wallet settlement failed" to="/ops" />
        <StatCard label="Pending verification" value={d.professionals.pendingVerification} tone={d.professionals.pendingVerification ? 'warn' : 'ok'} hint="Professionals waiting" to="/professionals" />
        <StatCard label="Open tickets" value={d.support.openTickets} hint="Open + in review" to="/support" />
      </div>

      <h2 className="section">Today &amp; this week</h2>
      <div className="grid">
        <StatCard label="Sessions today" value={d.sessions.scheduledToday} hint="IST, excluding cancelled" />
        <StatCard label="Bookings (7 days)" value={d.bookings.createdLast7Days} />
        <StatCard label="New pet parents (7 days)" value={d.users.newPetParentsLast7Days} />
        <StatCard label="Pet parents" value={byRole.pet_parent || 0} />
        <StatCard label="Professionals" value={proCount} hint={`${d.professionals.verified} verified`} />
      </div>

      <h2 className="section">Wallet &amp; revenue</h2>
      <div className="grid">
        <StatCard label="Session revenue (30d)" value={inr(d.wallet.sessionRevenueLast30Days)} hint={`${d.wallet.settledSessionsLast30Days} settled sessions`} tone="ok" />
        <StatCard label="Admin top-ups (30d)" value={inr(d.wallet.adminTopupsLast30Days)} />
        <StatCard label="Client wallet balances" value={inr(d.wallet.clientBalanceTotal)} hint="Held for clients" />
        <StatCard label="Professional balances" value={inr(d.wallet.professionalBalanceTotal)} hint="Earned, not withdrawn" />
      </div>

      <div className="two">
        <Breakdown title="Bookings by status" data={d.bookings.byStatus} />
        <Breakdown title="Sessions by status" data={d.sessions.byStatus} />
        <Breakdown title="Open tickets by priority" data={d.support.openByPriority} />
        <Breakdown title="Accounts by status" data={d.users.byStatus} />
      </div>
    </>
  );
}