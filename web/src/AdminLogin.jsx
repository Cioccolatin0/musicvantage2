import React, { useState } from 'react';
import { adminLogin, setAdminToken, adminSocialLogin } from './api';

export default function AdminLogin({ onLogin }) {
  const [mode, setMode] = useState('app'); // 'app' or 'social'
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'app') {
      if (!password.trim()) return;
      setLoading(true);
      try {
        const token = await adminLogin(password);
        setAdminToken(token);
        onLogin(token);
      } catch {
        setError('Wrong password');
      } finally {
        setLoading(false);
      }
    } else {
      if (!email.trim() || !password.trim()) { setError('Fill all fields'); return; }
      setLoading(true);
      try {
        const result = await adminSocialLogin(email, password);
        if (result.error) { setError(result.error); return; }
        if (result.isAdmin) {
          setAdminToken('social');
          onLogin('social');
        } else {
          setError('Not an admin user');
        }
      } catch {
        setError('Login failed');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-logo">S</div>
        <h2>Admin Panel</h2>
        <p className="admin-login-sub">
          {mode === 'app' ? 'Enter the admin password to manage API keys' : 'Sign in with email & password'}
        </p>
        <form onSubmit={handleSubmit}>
          {mode === 'social' && (
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          )}
          <input
            type="password"
            placeholder={mode === 'app' ? 'Admin password' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus={mode === 'app'}
          />
          {error && <p className="admin-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => { setMode(m => m === 'app' ? 'social' : 'app'); setError(''); }}>
            {mode === 'app' ? 'Login with email' : 'Login with app password'}
          </button>
        </form>
      </div>
    </div>
  );
}
