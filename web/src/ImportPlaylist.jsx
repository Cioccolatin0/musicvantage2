import React, { useState } from 'react';
import { authFetch } from './api';

export default function ImportPlaylist({ onPlayTrack }) {
  const [url, setUrl] = useState('');
  const [tracksText, setTracksText] = useState('');
  const [mode, setMode] = useState('url');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [showSaved, setShowSaved] = useState(false);

  const handleImport = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const body = {};
      if (mode === 'url') {
        if (!url.trim()) { setError('Enter a playlist URL'); setLoading(false); return; }
        body.url = url.trim();
      } else {
        const lines = tracksText.split('\n').filter(Boolean).map(s => s.trim());
        if (lines.length === 0) { setError('Enter at least one track'); setLoading(false); return; }
        body.tracks = lines;
      }
      const res = await authFetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = async () => {
    try {
      const res = await authFetch('/api/playlists');
      const list = await res.json();
      setSavedPlaylists(list);
      setShowSaved(true);
    } catch {}
  };

  const deletePlaylist = async (id) => {
    if (!confirm('Delete this playlist?')) return;
    await authFetch(`/api/playlists/${id}`, { method: 'DELETE' }).catch(() => {});
    loadSaved();
  };

  return (
    <div className="import-view">
      <div className="section-header">
        <h2>Import Playlist</h2>
        <button className="filter-tabs button-like" onClick={() => { loadSaved(); setShowSaved(!showSaved); }}>
          {showSaved ? 'Hide Saved' : 'Saved Playlists'}
        </button>
      </div>

      {showSaved && (
        <section className="section">
          <h3>Saved Playlists ({savedPlaylists.length})</h3>
          {savedPlaylists.length === 0 ? (
            <p className="panel-empty">No saved playlists</p>
          ) : (
            <div className="track-list">
              {savedPlaylists.map(pl => (
                <div key={pl.id} className="track-item" onClick={() => {
                  authFetch(`/api/playlists/${pl.id}`).then(r => r.json()).then(data => {
                    if (data.tracks?.length) onPlayTrack(data.tracks[0], data.tracks);
                  }).catch(() => {});
                }}>
                  <span className="import-pl-icon">
                    {pl.source === 'youtube' ? '▶' : pl.source === 'spotify' ? '◉' : pl.source === 'apple-music' ? '○' : '♫'}
                  </span>
                  <div className="track-info">
                    <h4>{pl.name}</h4>
                    <p>{pl.count} tracks · {pl.source}</p>
                  </div>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); deletePlaylist(pl.id); }} title="Delete">
                    <svg style={{ width: 14, height: 14, fill: 'currentColor' }} viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="section">
        <div className="import-tabs">
          <button className={mode === 'url' ? 'active' : ''} onClick={() => setMode('url')}>Playlist URL</button>
          <button className={mode === 'tracks' ? 'active' : ''} onClick={() => setMode('tracks')}>Track List</button>
        </div>

        <form onSubmit={handleImport}>
          {mode === 'url' ? (
            <div>
              <input
                className="import-input"
                type="url"
                placeholder="YouTube / Spotify / Apple Music playlist URL"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
              <p className="import-hint">
                YouTube (yt-dlp), Spotify (scraping), Apple Music (best effort). Nessuna API key necessaria.
              </p>
            </div>
          ) : (
            <div>
              <textarea
                className="import-textarea"
                placeholder="One track per line, e.g.:&#10;Never Gonna Give You Up Rick Astley&#10;Bohemian Rhapsody Queen&#10;Imagine John Lennon"
                value={tracksText}
                onChange={e => setTracksText(e.target.value)}
                rows={8}
              />
              <p className="import-hint">Each line is searched on YouTube. Format: "Song Title Artist"</p>
            </div>
          )}

          {error && <div className="error" style={{ textAlign: 'left', padding: '8px 0' }}>{error}</div>}

          <button type="submit" className="import-btn" disabled={loading}>
            {loading ? 'Importing... (this may take a while)' : 'Import'}
          </button>
        </form>
      </section>

      {result && (
        <section className="section">
          <div className="import-result">
            <h3>{result.name}</h3>
            <p>{result.tracks.length} tracks imported</p>
          </div>
          <div className="track-list">
            {result.tracks.map((t, i) => (
              <div key={t.id} className="track-item" onClick={() => onPlayTrack(t, result.tracks)}>
                <span className="track-num">{i + 1}</span>
                <img src={t.thumbnail} alt={t.title} loading="lazy" />
                <div className="track-info">
                  <h4>{t.title}</h4>
                  <p>{t.artist}</p>
                </div>
                <span className="import-source-badge">{result.source === 'youtube' ? 'YouTube' : result.source === 'apple-music' ? 'Apple Music' : result.source}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
