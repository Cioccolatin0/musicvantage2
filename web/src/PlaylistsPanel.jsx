import React, { useState } from 'react';
import { IconClose, IconAdd } from './Icons';
import { formatDuration } from './utils';

export default function PlaylistsPanel({ playlists, currentTrack, onAddToPlaylist, onCreatePlaylist, onPlayTrack, onClose }) {
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreatePlaylist(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  const canAdd = currentTrack && playlists.length > 0;

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel playlists-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Playlists</h2>
          <button className="icon-btn" onClick={onClose}><IconClose size={20} /></button>
        </div>

        {currentTrack && (
          <div className="panel-add-track">
            <img src={currentTrack.thumbnail} alt={currentTrack.title} />
            <div>
              <h4>{currentTrack.title}</h4>
              <p>{currentTrack.artist}</p>
            </div>
          </div>
        )}

        {!showCreate ? (
          <button className="create-btn" onClick={() => setShowCreate(true)}>
            <IconAdd size={18} /> New Playlist
          </button>
        ) : (
          <div className="create-form">
            <input
              type="text"
              placeholder="Playlist name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button onClick={handleCreate}>Create</button>
            <button className="cancel-btn" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        )}

        {playlists.length === 0 ? (
          <p className="panel-empty">No playlists yet</p>
        ) : (
          <div className="panel-list">
            {playlists.map((pl, i) => (
              <div key={i} className="playlist-item">
                <div className="playlist-info" onClick={() => onPlayTrack(pl.tracks[0], pl.tracks)}>
                  <div className="playlist-thumb">{pl.tracks[0] ? <img src={pl.tracks[0].thumbnail} alt="" /> : <div className="playlist-placeholder" />}</div>
                  <div>
                    <h4>{pl.name}</h4>
                    <p>{pl.tracks.length} tracks</p>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => onAddToPlaylist(i)} title="Add current track" disabled={!canAdd}>
                  <IconAdd size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
