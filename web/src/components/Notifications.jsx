import React, { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead } from '../api';

export default function Notifications({ userId, onClose, onAcceptFriend, onViewPlaylist }) {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!userId) return;
    getNotifications(userId).then(setNotifs);
  }, [userId]);

  const markRead = async (n) => {
    await markNotificationRead(n.id);
    setNotifs(notifs.filter(x => x.id !== n.id));
    if (n.type === 'friend_request' && onAcceptFriend) onAcceptFriend(n.payload.from);
    if (n.type === 'playlist_share' && onViewPlaylist) onViewPlaylist(n.payload.playlistId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel notif-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Notifications</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {notifs.length === 0 ? (
          <p className="panel-empty">No notifications</p>
        ) : (
          <div className="notif-list">
            {notifs.map(n => (
              <div key={n.id} className="notif-item" onClick={() => markRead(n)}>
                <div className="notif-icon">
                  {n.type === 'friend_request' ? '👤' : n.type === 'playlist_share' ? '📋' : n.type === 'playlist_update' ? '🎵' : '🔔'}
                </div>
                <div className="notif-body">
                  <p>{n.type === 'friend_request' ? 'New friend request' : n.type === 'playlist_share' ? `Playlist shared with you` : n.type === 'playlist_update' ? 'Playlist updated' : 'Notification'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}