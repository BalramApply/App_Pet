import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client.js';
import { useApi, PageHead, Spinner, ErrorBox, Field, fmtDateTime } from '../components/ui.jsx';

const SUPPORT_FIELDS = [
  ['supportPhone', 'Support phone'],
  ['supportWhatsApp', 'WhatsApp number'],
  ['supportEmail', 'Support email'],
  ['supportHours', 'Support hours'],
  ['emergencyHelpline', 'Emergency helpline'],
];
const RULE_FIELDS = [
  ['registrationCodeExpiryMinutes', 'Registration code valid for (minutes)'],
  ['cancellationFreeWindowHours', 'Free cancellation window (hours before start)'],
  ['cancellationFeePercentage', 'Late cancellation fee (% of remaining value)'],
  ['defaultTrainerPayoutPercentage', 'Default professional payout (% of per-session price)'],
];
const POLICY_FIELDS = [
  ['cancellationPolicy', 'Cancellation policy'],
  ['walletPolicy', 'Wallet policy'],
  ['privacyPolicy', 'Privacy policy'],
];

function Section({ title, hint, onSave, children }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      await onSave();
      setNotice({ type: 'info', text: 'Saved.' });
    } catch (err) {
      setNotice({ type: 'error', text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
      <strong>{title}</strong>
      {hint ? <p className="sub">{hint}</p> : null}
      {notice.text ? <div className={`alert ${notice.type}`} style={{ marginTop: 10 }}>{notice.text}</div> : null}
      {children}
      <div style={{ marginTop: 14 }}><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button></div>
    </form>
  );
}

export default function Settings() {
  const { data, loading, error } = useApi(() => api.get('/admin/settings').then((r) => r.data.data), []);
  const [support, setSupport] = useState({});
  const [rules, setRules] = useState({});
  const [policies, setPolicies] = useState({});

  useEffect(() => {
    if (data) {
      setSupport({ ...(data.config.supportContact || {}) });
      setRules({ ...(data.config.operationalRules || {}) });
      setPolicies({ ...(data.config.policyDocuments || {}) });
    }
  }, [data]);

  if (loading && !data) return <Spinner />;

  return (
    <>
      <PageHead title="Settings" subtitle={data?.config?.updatedAt ? `Last changed ${fmtDateTime(data.config.updatedAt)}${data.config.updatedBy?.name ? ` by ${data.config.updatedBy.name}` : ''}` : 'No settings saved yet'} />
      <ErrorBox message={error} />

      <Section
        title="Support contact"
        hint="Shown to users on the Forgot Password popup and the Support tab in the app."
        onSave={() => api.put('/admin/settings', { supportContact: support })}
      >
        <div className="two">
          {SUPPORT_FIELDS.map(([k, text]) => (
            <Field key={k} label={text}><input value={support[k] || ''} onChange={(e) => setSupport((s) => ({ ...s, [k]: e.target.value }))} /></Field>
          ))}
        </div>
      </Section>

      <Section
        title="Operational rules"
        hint="The cancellation window and fee take effect only after the cancelBooking patch is applied in the backend."
        onSave={() => api.put('/admin/settings', { operationalRules: Object.fromEntries(RULE_FIELDS.map(([k]) => [k, Number(rules[k])])) })}
      >
        <div className="two">
          {RULE_FIELDS.map(([k, text]) => (
            <Field key={k} label={text}><input type="number" step="any" value={rules[k] ?? ''} onChange={(e) => setRules((r) => ({ ...r, [k]: e.target.value }))} /></Field>
          ))}
        </div>
      </Section>

      <Section title="Policy documents" onSave={() => api.put('/admin/settings', { policyDocuments: policies })}>
        {POLICY_FIELDS.map(([k, text]) => (
          <Field key={k} label={text}><textarea style={{ minHeight: 110 }} value={policies[k] || ''} onChange={(e) => setPolicies((p) => ({ ...p, [k]: e.target.value }))} /></Field>
        ))}
      </Section>
    </>
  );
}