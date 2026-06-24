import React, { useState, useRef, useEffect } from 'react';
import { IconPlay, IconPause, IconPrev, IconNext, IconShuffle, IconRepeat, IconRepeatOne, IconHeart, IconHeartFilled, IconMenu, IconShare, IconCheck, IconChevronDown, IconDownload, IconLyrics } from './Icons';
import { formatDuration } from './utils';

export default function ExpandedPlayer({
  currentTrack,
  playing,
  currentTime,
  duration,
  shuffle,
  repeat,
  volume,
  liked,
  lyrics,
  showLyrics,
  togglePlay,
  playPrev,
  playNext,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLike,
  setShowLyrics,
  handleProgressClick,
  setVolume,
  onClose
}) {
  const [showMenu, setShowMenu] = useState(false);
  const progressRef = useRef(null);
  const volumeRef = useRef(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const getBarPercentage = (e, ref) => {
    const rect = ref.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleProgressMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingProgress(true);
    const pct = getBarPercentage(e, progressRef);
    handleProgressClick(e, pct);
  };

  const handleVolumeMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    const pct = getBarPercentage(e, volumeRef);
    setVolume(pct);
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (isDraggingProgress && progressRef.current) {
        e.preventDefault();
        const pct = getBarPercentage(e, progressRef);
        handleProgressClick(e, pct);
      }
      if (isDraggingVolume && volumeRef.current) {
        e.preventDefault();
        const pct = getBarPercentage(e, volumeRef);
        setVolume(pct);
      }
    };

    const handleEnd = () => {
      setIsDraggingProgress(false);
      setIsDraggingVolume(false);
    };

    if (isDraggingProgress || isDraggingVolume) {
      window.addEventListener('mousemove', handleMove, { passive: false });
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
      window.addEventListener('touchcancel', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDraggingProgress, isDraggingVolume, handleProgressClick, setVolume]);

  if (!currentTrack) return null;

  return (
    <div className="expanded-player-overlay" onClick={onClose}>
      <div className="expanded-player" onClick={(e) => e.stopPropagation()}>
        <div className="expanded-player-header">
          <button className="icon-btn" onClick={onClose}>
            <IconChevronDown size={28} />
          </button>
          <div className="expanded-player-title">{currentTrack.artist}</div>
          <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
            <IconMenu size={28} />
          </button>
        </div>

        {showMenu && (
          <div className="expanded-player-menu">
            <div className="menu-item">
              <IconShare size={24} />
              <span>Condividi</span>
            </div>
            <div className="menu-item">
              <IconLyrics size={24} />
              <span>Testo • {showLyrics ? 'On' : 'Off'}</span>
            </div>
            <div className="menu-item">
              {liked ? <IconHeartFilled size={24} /> : <IconHeart size={24} />}
              <span>Aggiungi a Brani che ti piacciono</span>
            </div>
          </div>
        )}

        <div className="expanded-player-artwork">
          <img src={currentTrack.thumbnail} alt={currentTrack.title} />
        </div>

        <div className="expanded-player-info">
          <h2>{currentTrack.title}</h2>
          <p>{currentTrack.artist}</p>
        </div>

        <div className="expanded-player-progress">
          <span className="time">{formatDuration(currentTime)}</span>
          <div className="progress-bar" ref={progressRef} onMouseDown={handleProgressMouseDown} onTouchStart={handleProgressMouseDown}>
            <div className="progress-fill" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
            <div className="progress-thumb" style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
          </div>
          <span className="time">{formatDuration(duration)}</span>
        </div>

        <div className="expanded-player-controls">
          <button className={`icon-btn ${shuffle ? 'active' : ''}`} onClick={onToggleShuffle}>
            <IconShuffle size={32} />
          </button>
          <button className="icon-btn" onClick={playPrev}>
            <IconPrev size={36} />
          </button>
          <button className="play-btn" onClick={togglePlay}>
            {playing ? <IconPause size={40} /> : <IconPlay size={40} />}
          </button>
          <button className="icon-btn" onClick={playNext}>
            <IconNext size={36} />
          </button>
          <button className={`icon-btn ${repeat !== 'off' ? 'active' : ''}`} onClick={onToggleRepeat}>
            {repeat === 'one' ? <IconRepeatOne size={32} /> : <IconRepeat size={32} />}
          </button>
        </div>

        <div className="expanded-player-footer">
          <div className="volume-wrap">
            <IconDownload size={20} />
            <span>Lossless</span>
          </div>
          <div className="volume-wrap">
            <IconShare size={20} />
          </div>
          <div className="volume-wrap">
            <IconMenu size={20} />
          </div>
        </div>

        {showLyrics && lyrics && (
          <div className="expanded-player-lyrics">
            <div className="lyrics-header">
              <h3>Testo</h3>
              <div className="lyrics-actions">
                <button className="icon-btn"><IconShare size={20} /></button>
              </div>
            </div>
            <div className="lyrics-content">
              {lyrics.split('\n').map((line, i) => (
                <p key={i} className="lyrics-line">{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
