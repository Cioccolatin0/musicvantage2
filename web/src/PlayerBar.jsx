import React, { useRef } from 'react';
import { IconPrev, IconPlay, IconPause, IconNext, IconShuffle, IconRepeat, IconRepeatOne, IconLyrics, IconQueue, IconAdd, IconHeart, IconHeartFilled, IconVolume, IconList } from './Icons';
import { formatDuration } from './utils';

import { IconRefresh } from './Icons';

export default function PlayerBar({
  currentTrack, playing, loadingStream, streamError, currentTime, duration, shuffle, repeat,
  togglePlay, playPrev, playNext, retryStream, handleProgressClick, volume, setVolume,
  onToggleShuffle, onToggleRepeat, onOpenLyrics, onOpenQueue, onOpenPlaylists, liked, onToggleLike
}) {
  const progressRef = useRef(null);
  const volumeRef = useRef(null);

  const handleVolumeClick = (e) => {
    const bar = volumeRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(pct);
  };

  return (
    <div className="player-bar">
      <div className={`player-loading-bar ${loadingStream ? 'active' : ''}`} />
      <div className="player-glass" />
      <div className="player-inner">
        <div className="player-section left">
          <img className="player-thumb" src={currentTrack.thumbnail} alt={currentTrack.title} />
          <div className="player-track-info">
            <h4>{currentTrack.title}</h4>
            <p>{currentTrack.artist}</p>
          </div>
          <button className="icon-btn" onClick={onToggleLike} title="Like">
            {liked ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
          </button>
        </div>

        <div className="player-section center">
          <div className="player-controls-row">
            <button className={`icon-btn ${shuffle ? 'active' : ''}`} onClick={onToggleShuffle} title="Shuffle">
              <IconShuffle size={18} />
            </button>
            <button className="icon-btn" onClick={playPrev} title="Previous">
              <IconPrev size={20} />
            </button>
            <button className="play-btn" onClick={streamError ? retryStream : togglePlay} title={streamError ? 'Retry' : playing ? 'Pause' : 'Play'}>
              {loadingStream ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> :
                streamError ? <IconRefresh size={20} /> :
                playing ? <IconPause size={22} /> : <IconPlay size={22} />
              }
            </button>
            <button className="icon-btn" onClick={playNext} title="Next">
              <IconNext size={20} />
            </button>
            <button className={`icon-btn ${repeat !== 'off' ? 'active' : ''}`} onClick={onToggleRepeat} title="Repeat">
              {repeat === 'one' ? <IconRepeatOne size={18} /> : <IconRepeat size={18} />}
            </button>
          </div>
          <div className="player-progress-row">
            <span className="time">{formatDuration(currentTime)}</span>
            <div className="progress-bar" ref={progressRef} onClick={handleProgressClick}>
              <div className="progress-fill" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
              <div className="progress-thumb" style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
            </div>
            <span className="time">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="player-section right">
          <button className="icon-btn" onClick={onOpenLyrics} title="Lyrics">
            <IconLyrics size={18} />
          </button>
          <button className="icon-btn" onClick={onOpenQueue} title="Queue">
            <IconList size={18} />
          </button>
          <button className="icon-btn" onClick={onOpenPlaylists} title="Add to playlist">
            <IconAdd size={18} />
          </button>
          <div className="volume-wrap">
            <IconVolume size={16} />
            <div className="volume-bar" ref={volumeRef} onClick={handleVolumeClick}>
              <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
