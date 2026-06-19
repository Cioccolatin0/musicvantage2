import React, { useState } from 'react';
import { adminLogin, setAdminToken } from './api';

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
  };

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-logo">S</div>
        <h2>Admin Panel</h2>
        <p className="admin-login-sub">Enter the admin password to manage API keys</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="admin-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
