import React, { useRef, useState, useEffect } from 'react';
import { IconPrev, IconPlay, IconPause, IconNext, IconShuffle, IconRepeat, IconRepeatOne, IconLyrics, IconQueue, IconAdd, IconHeart, IconHeartFilled, IconVolume, IconList, IconMusicVideo, IconMusicNote, IconRefresh, IconClose } from './Icons';
import { formatDuration } from './utils';

export default function PlayerBar({
  currentTrack, playing, loadingStream, streamError, currentTime, duration, shuffle, repeat,
  togglePlay, playPrev, playNext, retryStream, handleProgressClick, volume, setVolume,
  onToggleShuffle, onToggleRepeat, onOpenLyrics, onOpenQueue, onOpenPlaylists, liked, onToggleLike,
  playMode, onToggleMode, lyrics, showLyrics, setShowLyrics, onExpand
}) {
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

  const handleVolumeClick = (e) => {
    const pct = getBarPercentage(e, volumeRef);
    setVolume(pct);
  };

  return (
    <div className="player-bar">
      <div className={`player-loading-bar ${loadingStream ? 'active' : ''}`} />
      <div className="player-glass" />
      <div className="player-inner">
        <div className="player-section left" onClick={onExpand} style={{ cursor: 'pointer' }}>
          <img className="player-thumb" src={currentTrack.thumbnail} alt={currentTrack.title} />
          <div className="player-track-info">
            <h4>{currentTrack.title}</h4>
            <p>{currentTrack.artist}</p>
          </div>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onToggleLike(); }} title="Like">
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
            <div className="progress-bar" ref={progressRef} onMouseDown={handleProgressMouseDown} onTouchStart={handleProgressMouseDown}>
              <div className="progress-fill" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
              <div className="progress-thumb" style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
            </div>
            <span className="time">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="player-section right">
          <button className={`icon-btn ${showLyrics ? 'active' : ''}`} onClick={() => setShowLyrics(s => !s)} title="Lyrics">
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
            <div className="volume-bar" ref={volumeRef} onMouseDown={handleVolumeMouseDown} onTouchStart={handleVolumeMouseDown}>
              <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
          <button className="icon-btn" onClick={onToggleMode} title={playMode === 'music' ? 'Show video' : 'Audio only'}>
            {playMode === 'music' ? <IconMusicNote size={18} /> : <IconMusicVideo size={18} />}
          </button>
        </div>
      </div>
      {showLyrics && (
        <div className="player-lyrics">
          <div className="player-lyrics-scroll">
            {lyrics ? lyrics.split('\n').map((line, i) => (
              <p key={i} className="player-lyrics-line">{line}</p>
            )) : <p className="text-secondary">Loading lyrics...</p>}
          </div>
        </div>
      )}
    </div>
  );
}