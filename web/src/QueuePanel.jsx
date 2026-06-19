import React from 'react';
import { IconClose, IconPlay } from './Icons';
import { formatDuration } from './utils';

export default function QueuePanel({ queue, currentTrack, onPlayTrack, onRemove, onClose }) {
  if (!queue.length) {
    return (
      <div className="panel-overlay" onClick={onClose}>
        <div className="panel queue-panel" onClick={e => e.stopPropagation()}>
          <div className="panel-header">
            <h2>Queue</h2>
            <button className="icon-btn" onClick={onClose}><IconClose size={20} /></button>
          </div>
          <p className="panel-empty">Queue is empty</p>
        </div>
      </div>
    );
  }
  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel queue-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Queue ({queue.length})</h2>
          <button className="icon-btn" onClick={onClose}><IconClose size={20} /></button>
        </div>
        <div className="panel-list">
          {queue.map((t, i) => (
            <div
              key={`${t.id}-${i}`}
              className={`panel-track ${currentTrack?.id === t.id ? 'active' : ''}`}
              onClick={() => onPlayTrack(t, queue)}
            >
              <img src={t.thumbnail} alt={t.title} />
              <div className="panel-track-info">
                <h4>{t.title}</h4>
                <p>{t.artist}</p>
              </div>
              <span className="panel-track-duration">{formatDuration(t.duration)}</span>
              <button className="icon-btn" onClick={e => { e.stopPropagation(); onRemove(i); }} title="Remove">
                <IconClose size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
