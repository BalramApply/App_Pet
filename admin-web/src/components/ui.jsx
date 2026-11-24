import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errMsg } from '../api/client.js';

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export const label = (s) => String(s || '').replace(/_/g, ' ');

// Loads data on mount; call reload() to refresh
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fn();
      setState({ data, loading: false, error: '' });
    } catch (e) {
      setState({ data: null, loading: false, error: errMsg(e) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run };
}

export const Spinner = () => <div className="spinner">Loading...</div>;

export const ErrorBox = ({ message }) => (message ? <div className="alert error">{message}</div> : null);

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="sub">{subtitle}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function StatCard({ label: text, value, hint, tone, to }) {
  const body = (
    <>
      <div className="label">{text}</div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </>
  );
  const cls = `card stat ${tone || ''}`;
  return to ? (
    <Link to={to} className={`${cls} link`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const TONES = {
  completed: 'ok', verified: 'ok', active: 'ok', published: 'ok', resolved: 'ok', settled: 'ok',
  disputed: 'danger', interrupted: 'danger', suspended: 'danger', rejected: 'danger', critical: 'danger', hidden: 'danger',
  scheduled: 'info', upcoming: 'info', in_progress: 'info', open: 'info', in_review: 'warn',
  pending: 'warn', flagged: 'warn', high: 'warn', expired: 'warn',
};

export const Badge = ({ value }) => <span className={`badge ${TONES[value] || ''}`}>{label(value)}</span>;

export function Table({ columns, rows, empty = 'Nothing here.', onRowClick }) {
  if (!rows || rows.length === 0) return <div className="table-wrap"><div className="empty">{empty}</div></div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row._id || i} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <strong>{title}</strong>
          <button type="button" className="btn small" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Pager({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  return (
    <div className="pager">
      <span className="sub">{total} total</span>
      <button className="btn small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button className="btn small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

export const Field = ({ label: text, children }) => (
  <label className="field">
    {text}
    {children}
  </label>
);

// Shows a one-time secret (temporary password) with a copy button
export function SecretBox({ title, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      /* clipboard may be blocked */
    }
  };
  return (
    <div className="secret">
      <div className="sub">{title}</div>
      <code>{value}</code>
      <button type="button" className="btn small" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      <div className="sub">Shown once. Share it with the user securely.</div>
    </div>
  );
}

// datetime-local value -> ISO string (throws a readable error if empty/invalid)
export const toISO = (value) => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new Error('Pick a valid date and time.');
  return d.toISOString();
};

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="filters">
      {tabs.map(([key, text]) => (
        <button key={key} type="button" className={`btn ${value === key ? 'primary' : ''}`} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  );
}

// textarea text <-> array of non-empty lines
export const toLines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
export const fromLines = (arr) => (arr || []).join('\n');