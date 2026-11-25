import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '../api/client.js';

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