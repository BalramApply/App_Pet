/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '../api/Client.js';

/* ----------------------------- helpers ----------------------------- */

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export const label = (s) => String(s || '').replace(/_/g, ' ');

// Loads data on mount and when deps change; call reload() to refresh
export function useApi(fn, deps = []) {
  const fnRef = useRef(fn);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  const depsKey = JSON.stringify(deps);
  const prevDepsKeyRef = useRef(depsKey);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let active = true;
    const depsChanged = prevDepsKeyRef.current !== depsKey;
    prevDepsKeyRef.current = depsKey;

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        if (depsChanged || tick > 0) {
          setState((prev) => ({ ...prev, loading: true, error: '' }));
        }
        return fnRef.current();
      })
      .then((data) => {
        if (data !== null && active) {
          setState({ data, loading: false, error: '' });
        }
      })
      .catch((e) => {
        if (active) {
          setState({ data: null, loading: false, error: errMsg(e) });
        }
      });

    return () => {
      active = false;
    };
  }, [depsKey, tick]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, reload };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// datetime-local value -> ISO string (throws a readable error if empty/invalid)
export const toISO = (value) => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new Error('Pick a valid date and time.');
  return d.toISOString();
};

// textarea text <-> array of non-empty lines
export const toLines = (text) =>
  String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export const fromLines = (arr) => (arr || []).join('\n');

/* ---------------------------- components --------------------------- */

export function Spinner({ size = 32, text }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 40,
        minHeight: 120,
      }}
      role="status"
      aria-live="polite"
    >
      <style>{'@keyframes pj-spin{to{transform:rotate(360deg)}}'}</style>
      <div
        style={{
          width: size,
          height: size,
          border: '3px solid #e5e7eb',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'pj-spin 0.8s linear infinite',
        }}
      />
      {text ? <span style={{ fontSize: 14, color: '#6b7280' }}>{text}</span> : null}
    </div>
  );
}

export function ErrorBox({ message, error, children, onRetry }) {
  const text = message || error || children;
  if (!text) return null;
  return (
    <div
      role="alert"
      style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#b91c1c',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span>{text}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            border: '1px solid #fca5a5',
            background: '#fff',
            color: '#b91c1c',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function PageHead({ title, subtitle, children, actions }) {
  const right = actions || children;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{title}</h1>
        {subtitle ? <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{subtitle}</p> : null}
      </div>
      {right ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{right}</div> : null}
    </div>
  );
}

export function StatCard({ label: title, title: altTitle, value, hint, sub, icon, accent = '#6366f1' }) {
  const heading = title || altTitle;
  const note = hint || sub;
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: '#6b7280', textTransform: 'capitalize' }}>{heading}</div>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value ?? 0}</div>
        {note ? <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{note}</div> : null}
      </div>
      {icon ? <div style={{ fontSize: 28 }}>{icon}</div> : null}
    </div>
  );
}

export function Empty({ children = 'Nothing to show yet.' }) {
  return <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>{children}</div>;
}

export function Badge({ children, color = '#6366f1' }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: `${color}1a`,
        color,
        borderRadius: 999,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
      }}
    >
      {typeof children === 'string' ? label(children) : children}
    </span>
  );
}

export function Modal({ open = true, title, onClose, children, width = 520 }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 12px',
  fontSize: 14,
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'top',
};

// columns: [{ key, header|label|title, render?(row, index), width?, align? }]
// rows: array of objects (alias: data)
export function Table({ columns = [], rows, data, empty = 'No records found.', onRowClick, rowKey = '_id', children }) {
  const list = rows || data || [];
  return (
    <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c.key || i} style={{ ...thStyle, width: c.width, textAlign: c.align || 'left' }}>
                  {c.header ?? c.label ?? c.title ?? c.key}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {children}
          {!children &&
            list.map((row, idx) => (
              <tr
                key={row[rowKey] ?? row.id ?? idx}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((c, i) => (
                  <td key={c.key || i} style={{ ...tdStyle, textAlign: c.align || 'left' }}>
                    {c.render ? c.render(row, idx) : (row[c.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {!children && list.length === 0 ? <Empty>{empty}</Empty> : null}
    </div>
  );
}

export function Pager({ page = 1, pages, totalPages, total, limit = 20, onChange, onPage, setPage }) {
  const totalPageCount = pages || totalPages || (total ? Math.max(1, Math.ceil(total / limit)) : 1);
  const go = (p) => {
    const next = Math.min(Math.max(1, p), totalPageCount);
    (onChange || onPage || setPage)?.(next);
  };
  if (totalPageCount <= 1) return null;
  const btn = (disabled) => ({
    border: '1px solid #d1d5db',
    background: '#fff',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
      <button type="button" style={btn(page <= 1)} disabled={page <= 1} onClick={() => go(page - 1)}>
        Prev
      </button>
      <span style={{ fontSize: 13, color: '#6b7280' }}>
        Page {page} of {totalPageCount}
        {total ? ` · ${total} total` : ''}
      </span>
      <button
        type="button"
        style={btn(page >= totalPageCount)}
        disabled={page >= totalPageCount}
        onClick={() => go(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  background: '#fff',
  fontFamily: 'inherit',
};

// Either wrap your own control as children, or pass type/value/onChange (and options for select)
export function Field({
  label: text,
  children,
  hint,
  error,
  type = 'text',
  value,
  onChange,
  options,
  placeholder,
  required,
  rows = 3,
  ...rest
}) {
  let control = children;
  if (!control) {
    if (type === 'textarea') {
      control = (
        <textarea
          style={inputStyle}
          rows={rows}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          {...rest}
        />
      );
    } else if (type === 'select') {
      control = (
        <select style={inputStyle} value={value ?? ''} onChange={onChange} required={required} {...rest}>
          {(options || []).map((o) =>
            typeof o === 'object' ? (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ) : (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ),
          )}
        </select>
      );
    } else {
      control = (
        <input
          style={inputStyle}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          {...rest}
        />
      );
    }
  }
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      {text ? (
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {text}
          {required ? <span style={{ color: '#dc2626' }}> *</span> : null}
        </span>
      ) : null}
      {control}
      {hint ? <span style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{hint}</span> : null}
      {error ? <span style={{ display: 'block', fontSize: 12, color: '#dc2626', marginTop: 4 }}>{error}</span> : null}
    </label>
  );
}

// Shows a one-time secret (e.g. a temporary password) with a copy button
export function SecretBox({ title = 'Copy this now. It will not be shown again.', value, secret, children, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = value || secret || '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      style={{
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 10,
        padding: 14,
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 13, color: '#92400e', marginBottom: 8 }}>{title}</div>
      {children}
      {text ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code
            style={{
              flex: 1,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 15,
              wordBreak: 'break-all',
            }}
          >
            {text}
          </code>
          <button
            type="button"
            onClick={copy}
            style={{
              border: '1px solid #d1d5db',
              background: '#fff',
              borderRadius: 6,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : null}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 10,
            border: 'none',
            background: 'transparent',
            color: '#92400e',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

// tabs: ['a', 'b'] or [{ key|value|id, label, count? }]
// active: value | active | current | tab ; change: onChange | onSelect | onTab | setTab
export function Tabs({ tabs = [], items, value, active, current, tab, onChange, onSelect, onTab, setTab }) {
  const list = tabs.length ? tabs : items || [];
  const selected = value ?? active ?? current ?? tab;
  const change = onChange || onSelect || onTab || setTab;

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: 16,
      }}
    >
      {list.map((t) => {
        const isObj = typeof t === 'object' && t !== null;
        const key = isObj ? (t.key ?? t.value ?? t.id) : t;
        const text = isObj ? (t.label ?? t.title ?? t.name ?? key) : label(t);
        const isActive = key === selected;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => change?.(key)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#4f46e5' : '#6b7280',
              borderBottom: isActive ? '2px solid #4f46e5' : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {text}
            {isObj && t.count != null ? ` (${t.count})` : ''}
          </button>
        );
      })}
    </div>
  );
}