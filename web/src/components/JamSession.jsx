import React, { useState, useEffect } from 'react';
import { createJam, getActiveJams, joinJam, getJamParticipants, getSocket } from '../api';

export default function JamSession({ userId, username, userColor, currentTrack, playing, currentTime, onPlayTrack }) {
  const [jams, setJams] = useState([]);
  const [activeJam, setActiveJam] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [jamName, setJamName] = useState('');
  const [creating, setCreating] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    getActiveJams().then(setJams);
  }, []);

  useEffect(() => {
    if (!activeJam) return;
    socket.emit('join-jam', activeJam.id);
    const handler = (data) => {
      if (data.trackId && onPlayTrack) onPlayTrack({ id: data.trackId }, []);
    };
    socket.on('jam-state', handler);
    socket.on('participants', setParticipants);
    return () => { socket.emit('leave-jam', activeJam.id); socket.off('jam-state', handler); socket.off('participants', setParticipants); };
  }, [activeJam]);

  const handleCreate = async () => {
    if (!jamName.trim()) return;
    const jam = await createJam(userId, jamName.trim());
    setActiveJam(jam);
    setCreating(false);
  };

  const handleJoin = async (jam) => {
    setActiveJam(jam);
    await joinJam(jam.id, userId);
    const parts = await getJamParticipants(jam.id);
    setParticipants(parts);
    if (jam.track_id && onPlayTrack) onPlayTrack({ id: jam.track_id }, []);
  };

  const handleLeave = () => { setActiveJam(null); setParticipants([]); };

  const syncJam = () => {
    if (!activeJam || !currentTrack) return;
    socket.emit('jam-state', { sessionId: activeJam.id, trackId: currentTrack.id, position: currentTime, playing });
  };

  return (
    <div className="social-section">
      <div className="section-header"><h2>Jam Sessions</h2></div>
      {activeJam ? (
        <div className="jam-active">
          <div className="jam-banner"><h3>{activeJam.name}</h3><p>Host: {activeJam.host_username}</p></div>
          <div className="jam-participants">
            {participants.map(p => (
              <div key={p.id} className="jam-participant" style={{ borderColor: p.color }}>
                <div className="friend-avatar" style={{ background: p.color }}>{p.username[0]}</div>
                <span>{p.username}</span>
              </div>
            ))}
          </div>
          <div className="jam-controls">
            <button className="btn-primary" onClick={syncJam}>Sync Playback</button>
            <button className="btn-secondary" onClick={handleLeave}>Leave</button>
          </div>
        </div>
      ) : (
        <>
          <div className="jam-list">
            {jams.map(j => (
              <div key={j.id} className="jam-card" onClick={() => handleJoin(j)}>
                <div className="jam-card-info"><h4>{j.name}</h4><p>Hosted by {j.host_username}</p></div>
                <button className="icon-btn">▶</button>
              </div>
            ))}
          </div>
          {jams.length === 0 && !creating && <p className="panel-empty">No active sessions</p>}
          {creating ? (
            <form className="jam-create" onSubmit={e => { e.preventDefault(); handleCreate(); }}>
              <input value={jamName} onChange={e => setJamName(e.target.value)} placeholder="Session name..." />
              <button type="submit">Create</button>
              <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            </form>
          ) : <button className="btn-primary" onClick={() => setCreating(true)}>Start a Jam</button>}
        </>
      )}
    </div>
  );
}