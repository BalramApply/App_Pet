import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api/client.js';
import { ErrorBox } from '../components/ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !password) {
      setError('Enter your mobile number and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(phone, password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-badge" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <PawPrint size={22} color="#fff" />
        </span>
        <h1>PetJeeva Admin</h1>
        <p className="sub">Sign in with your administrator mobile number.</p>
        <div style={{ height: 12 }} />
        <ErrorBox message={error} />
        <label className="field">
          Mobile number
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="username" />
        </label>
        <label className="field">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}