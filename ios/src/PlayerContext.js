import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import Sound from 'react-native-sound';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState([]);
  const soundRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (soundRef.current) soundRef.current.release();
    };
  }, []);

  const playTrack = useCallback((track, trackQueue) => {
    if (trackQueue) setQueue(trackQueue);
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.release();
    }
    if (intervalRef.current) clearInterval(intervalRef.current);

    setCurrentTrack(track);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const url = track.streamUrl || `http://localhost:3001/api/stream/${track.id}`;
    const sound = new Sound(url, null, (err) => {
      if (err) {
        console.error('Sound load error:', err);
        return;
      }
      setDuration(sound.getDuration());
      sound.play((success) => {
        if (!success) {
          setPlaying(false);
        }
      });
      setPlaying(true);
      intervalRef.current = setInterval(() => {
        sound.getCurrentTime((time) => setCurrentTime(time));
      }, 500);
    });
    soundRef.current = sound;
  }, []);

  const togglePlay = useCallback(() => {
    if (!soundRef.current) return;
    if (playing) {
      soundRef.current.pause();
      setPlaying(false);
    } else {
      soundRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

  const playNext = useCallback(() => {
    if (!queue.length || !currentTrack) return;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (idx >= 0 && idx < queue.length - 1) {
      playTrack(queue[idx + 1], queue);
    }
  }, [queue, currentTrack, playTrack]);

  const playPrev = useCallback(() => {
    if (!queue.length || !currentTrack) return;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (idx > 0) {
      playTrack(queue[idx - 1], queue);
    }
  }, [queue, currentTrack, playTrack]);

  const seekTo = useCallback((time) => {
    if (!soundRef.current) return;
    soundRef.current.setCurrentTime(time);
    setCurrentTime(time);
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentTrack, playing, currentTime, duration, queue,
      playTrack, togglePlay, playNext, playPrev, seekTo
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
