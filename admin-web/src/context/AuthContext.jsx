import { useCallback, useEffect, useState } from 'react';
import { api, tokens } from '../api/client.js';
import { AuthContext } from './AuthContextValue.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const reset = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokens.access) {
        setBooting(false);
        return;
      }
      try {
        const res = await api.get('/users/me');
        const me = res.data.data.user;
        if (alive) {
          if (me.role === 'admin') setUser(me);
          else reset();
        }
      } catch {
        if (alive) reset();
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reset]);

  useEffect(() => {
    window.addEventListener('pj-auth-expired', reset);
    return () => window.removeEventListener('pj-auth-expired', reset);
  }, [reset]);

  const login = async (phone, password) => {
    const res = await api.post('/auth/login', { phone: phone.trim(), password });
    const { user: u, accessToken, refreshToken } = res.data.data;
    if (u.role !== 'admin') {
      // Do not keep tokens for a non-admin account
      try {
        await api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${accessToken}` } });
      } catch {
        /* ignore */
      }
      throw new Error('This panel is for PetJeeva administrators only.');
    }
    tokens.set(accessToken, refreshToken);
    setUser(u);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* token may already be expired */
    }
    reset();
  };

  return <AuthContext.Provider value={{ user, booting, login, logout }}>{children}</AuthContext.Provider>;
}