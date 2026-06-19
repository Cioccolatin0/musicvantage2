import React, { useState, useEffect, useCallback } from 'react';
import { adminListApps, adminCreateApp, adminRevokeApp, adminChangePassword } from './api';

export default function AdminDashboard({ onLogout }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState('');
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminListApps();
      setApps(list);
    } catch {
      setError('Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setNewKey('');
    if (!newName.trim()) return;
    try {
      const result = await adminCreateApp(newName.trim());
      setNewKey(result.key);
      setNewName('');
      loadApps();
    } catch {
      setError('Failed to create app');
    }
  };

  const handleRevoke = async (name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await adminRevokeApp(name);
      loadApps();
    } catch {
      setError('Failed to revoke app');
    }
  };

  const handleChangePwd = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    if (newPwd.length < 4) { setPwdMsg('Password too short'); return; }
    try {
      await adminChangePassword(oldPwd, newPwd);
      setPwdMsg('Password changed');
      setOldPwd('');
      setNewPwd('');
      setPwdOpen(false);
    } catch {
      setPwdMsg('Wrong current password');
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
  };

  const keyStyle = (key) => ({
    fontFamily: 'monospace',
    fontSize: 12,
    background: 'rgba(255,255,255,0.05)',
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    wordBreak: 'break-all'
  });

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h2>Admin Panel</h2>
        <div className="admin-header-actions">
          <button className="admin-btn" onClick={() => setPwdOpen(o => !o)}>
            Change Password
          </button>
          <button className="admin-btn admin-btn-danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {pwdOpen && (
        <form className="admin-pwd-form" onSubmit={handleChangePwd}>
          <input type="password" placeholder="Current password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
          <input type="password" placeholder="New password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
          <button type="submit" className="admin-btn">Save</button>
          <button type="button" className="admin-btn" onClick={() => setPwdOpen(false)}>Cancel</button>
          {pwdMsg && <span className={pwdMsg === 'Password changed' ? 'admin-success' : 'admin-error'}>{pwdMsg}</span>}
        </form>
      )}

      {error && <div className="admin-error">{error}</div>}

      <section className="admin-section">
        <h3>Create New App</h3>
        <form className="admin-create-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="App name (e.g. my-music-app)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" className="admin-btn admin-btn-primary">Generate Key</button>
        </form>
        {newKey && (
          <div className="admin-new-key">
            <strong>API Key for "{newName}":</strong>
            <div style={keyStyle(newKey)} onClick={() => copyKey(newKey)} title="Click to copy">
              {newKey}
            </div>
            <p className="admin-hint">Copy this key now — you won't see it again.</p>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h3>Registered Apps</h3>
        {loading ? (
          <p>Loading...</p>
        ) : apps.length === 0 ? (
          <p className="admin-hint">No apps registered yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>App</th>
                <th>API Key</th>
                <th>Created</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.name}>
                  <td><strong>{app.name}</strong></td>
                  <td>
                    <code style={keyStyle(app.key)} onClick={() => copyKey(app.key)} title="Click to copy">
                      {app.key.slice(0, 12)}...
                    </code>
                  </td>
                  <td>{new Date(app.created).toLocaleDateString()}</td>
                  <td>{app.revoked ? <span className="admin-badge admin-badge-danger">Revoked</span> : <span className="admin-badge admin-badge-ok">Active</span>}</td>
                  <td>
                    {app.name !== 'web-ui' && (
                      <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleRevoke(app.name)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <h3>How to use in other apps</h3>
        <div className="admin-code-block">
          <pre>{`fetch('http://YOUR_SERVER:3001/api/search?q=never+gonna', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
})`}</pre>
        </div>
        <p className="admin-hint">Replace YOUR_SERVER with the IP/domain of this machine and YOUR_API_KEY with the key above.</p>
      </section>

      <button className="admin-btn" onClick={loadApps} style={{ marginTop: 16 }}>
        Refresh
      </button>
    </div>
  );
}
