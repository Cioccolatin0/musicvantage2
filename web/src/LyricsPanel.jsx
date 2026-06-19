import React from 'react';
import { IconClose } from './Icons';

export default function LyricsPanel({ track, onClose }) {
  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel lyrics-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Lyrics</h2>
          <button className="icon-btn" onClick={onClose}><IconClose size={20} /></button>
        </div>
        {track ? (
          <div className="lyrics-content">
            <div className="lyrics-track-info">
              <img src={track.thumbnail} alt={track.title} />
              <div>
                <h3>{track.title}</h3>
                <p>{track.artist}</p>
              </div>
            </div>
            <div className="lyrics-text">
              <p className="lyrics-placeholder">
                No lyrics available for this track.<br />
                Lyrics will appear here when available.
              </p>
            </div>
          </div>
        ) : (
          <p className="panel-empty">Select a track to view lyrics</p>
        )}
      </div>
    </div>
  );
}
