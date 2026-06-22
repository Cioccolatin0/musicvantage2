import React, { useState, useEffect, useCallback } from 'react';
import { adminListApps, adminCreateApp, adminRevokeApp, adminChangePassword, adminGetUsers, adminRemoveUserCodes, adminSetUserAdmin, generateReferralCode, getMyReferralCodes } from './api';

export default function AdminDashboard({ onLogout, user }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState('');
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  // Social users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [myCodes, setMyCodes] = useState([]);

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

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      setUsers(await adminGetUsers());
    } catch {}
    setUsersLoading(false);
  }, []);

  const loadMyCodes = useCallback(async () => {
    if (!user?.id) return;
    try { setMyCodes(await getMyReferralCodes(user.id)); } catch {}
  }, [user?.id]);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadMyCodes(); }, [loadMyCodes]);

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

  const handleRemoveCodes = async (userId) => {
    if (!confirm('Remove code limit for this user?')) return;
    try {
      await adminRemoveUserCodes(userId);
      loadUsers();
    } catch {}
  };

  const handleToggleAdmin = async (userId, isAdmin) => {
    try {
      await adminSetUserAdmin(userId, isAdmin);
      loadUsers();
    } catch {}
  };

  const handleGenerateCode = async () => {
    try {
      await generateReferralCode(user?.id);
      loadMyCodes();
    } catch {}
  };

  const copyKey = (key) => navigator.clipboard.writeText(key);

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

      {/* Referral Codes */}
      <section className="admin-section">
        <h3>My Referral Codes</h3>
        <button className="admin-btn admin-btn-primary" onClick={handleGenerateCode}>Generate New Code</button>
        {myCodes.length === 0 ? (
          <p className="admin-hint">No codes generated yet.</p>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Code</th><th>Used</th><th>Created</th></tr></thead>
            <tbody>
              {myCodes.map(c => (
                <tr key={c.code}>
                  <td><code onClick={() => copyKey(c.code)} style={{ cursor: 'pointer' }}>{c.code}</code></td>
                  <td>{c.used_by ? <span className="admin-badge admin-badge-ok">Used</span> : <span className="admin-badge">Available</span>}</td>
                  <td>{new Date(c.created).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Social Users */}
      <section className="admin-section">
        <h3>Registered Users ({users.length})</h3>
        {usersLoading ? (
          <p>Loading...</p>
        ) : users.length === 0 ? (
          <p className="admin-hint">No users registered.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Username</th><th>Color</th><th>Admin</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong></td>
                  <td><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: u.color, verticalAlign: 'middle' }} /></td>
                  <td>{u.is_admin ? <span className="admin-badge admin-badge-ok">Admin</span> : '—'}</td>
                  <td>{new Date(u.created).toLocaleDateString()}</td>
                  <td>
                    <button className="admin-btn admin-btn-sm" onClick={() => handleRemoveCodes(u.id)}>Remove code limit</button>
                    <button className="admin-btn admin-btn-sm" onClick={() => handleToggleAdmin(u.id, !u.is_admin)}>
                      {u.is_admin ? 'Demote' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* API Apps */}
      <section className="admin-section">
        <h3>Create New App</h3>
        <form className="admin-create-form" onSubmit={handleCreate}>
          <input type="text" placeholder="App name (e.g. my-music-app)" value={newName} onChange={e => setNewName(e.target.value)} />
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
            <thead><tr><th>App</th><th>API Key</th><th>Created</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.name}>
                  <td><strong>{app.name}</strong></td>
                  <td><code style={keyStyle(app.key)} onClick={() => copyKey(app.key)} title="Click to copy">{app.key.slice(0, 12)}...</code></td>
                  <td>{new Date(app.created).toLocaleDateString()}</td>
                  <td>{app.revoked ? <span className="admin-badge admin-badge-danger">Revoked</span> : <span className="admin-badge admin-badge-ok">Active</span>}</td>
                  <td>{app.name !== 'web-ui' && <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleRevoke(app.name)}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <button className="admin-btn" onClick={loadApps} style={{ marginTop: 16 }}>Refresh</button>
    </div>
  );
}
