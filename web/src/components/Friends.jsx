import React, { useState, useEffect } from 'react';
import { getFriends, searchUsers, sendFriendRequest, respondToFriend, getSocket } from '../api';

export default function Friends({ userId, userColor }) {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    loadFriends();
    const socket = getSocket();
    socket.on('friend-status', (data) => {
      setOnlineUsers(o => ({ ...o, [data.userId]: data.status }));
    });
    return () => socket.off('friend-status');
  }, [userId]);

  const loadFriends = async () => {
    const data = await getFriends(userId);
    setFriends(data.friends || []);
    setPending(data.pending || []);
  };

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 1) return setSearchResults([]);
    const res = await searchUsers(q);
    setSearchResults(res.filter(u => u.id !== userId));
  };

  const handleAddFriend = async (friendId) => {
    await sendFriendRequest(userId, friendId);
    setSearchResults(r => r.filter(u => u.id !== friendId));
  };

  const handleRespond = async (friendId, accept) => {
    await respondToFriend(userId, friendId, accept);
    loadFriends();
  };

  return (
    <div className="social-section">
      <div className="section-header">
        <h2>Friends</h2>
      </div>

      <div className="friends-search">
        <input type="text" placeholder="Search users..." value={searchQ} onChange={e => handleSearch(e.target.value)} />
      </div>

      {searchResults.length > 0 && (
        <div className="friend-list">
          {searchResults.map(u => (
            <div key={u.id} className="friend-item">
              <div className="friend-avatar" style={{ background: u.color }}>{u.username[0]}</div>
              <div className="friend-info"><strong>{u.username}</strong></div>
              <button className="icon-btn" onClick={() => handleAddFriend(u.id)} title="Add friend">+</button>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h4 style={{ margin: '12px 0 8px', opacity: 0.6 }}>Pending Requests</h4>
          <div className="friend-list">
            {pending.map(p => (
              <div key={p.id} className="friend-item">
                <div className="friend-avatar" style={{ background: p.color }}>{p.username[0]}</div>
                <div className="friend-info"><strong>{p.username}</strong></div>
                <div className="friend-actions">
                  <button className="icon-btn" style={{ color: '#4ade80' }} onClick={() => handleRespond(p.id, true)}>✓</button>
                  <button className="icon-btn" style={{ color: '#f87171' }} onClick={() => handleRespond(p.id, false)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {friends.length === 0 && pending.length === 0 && !searchQ && (
        <p className="panel-empty">Search for users to add friends</p>
      )}

      <div className="friend-list">
        {friends.map(f => (
          <div key={f.id} className="friend-item">
            <div className="friend-avatar" style={{ background: f.color }}>{f.username[0]}</div>
            <div className="friend-info">
              <strong>{f.username}</strong>
              <span className={`friend-status-dot ${onlineUsers[f.id] === 'online' ? 'online' : ''}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}