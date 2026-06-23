import React, { useState, useRef, useEffect, useCallback } from 'react';
import { search, getLyrics, getArtistInfo, getRelatedTracks, socialRegister, socialLogin, getNotifications as fetchNotifs, getSocket, getStreamUrl, downloadAudioBlob } from './api';
import { formatDuration } from './utils';
import { getCachedSearch, setCachedSearch, getRecentTracks, addRecentTrack, getDownloads, addDownload, removeDownload, isDownloaded, saveAudioBlob, getAudioUrl } from './cache';

function getFavorites() { try { return JSON.parse(localStorage.getItem('sv_favorites') || '[]'); } catch { return []; } }
function saveFavorites(favs) { try { localStorage.setItem('sv_favorites', JSON.stringify(favs)); } catch {} }
import Sidebar from './Sidebar';
import PlayerBar from './PlayerBar';
import QueuePanel from './QueuePanel';
import PlaylistsPanel from './PlaylistsPanel';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import ImportPlaylist from './ImportPlaylist';
import Chat from './components/Chat';
import Friends from './components/Friends';
import Notifications from './components/Notifications';
import JamSession from './components/JamSession';
import MobileNav from './components/MobileNav';
import { IconSearch, IconAdmin, IconImport, IconHome, IconChat, IconFriends, IconJam, IconPlaylist, IconQueue, IconBell, IconUser, IconMusicNote, IconDownload } from './Icons';

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [volume, setVolume] = useState(0.7);
  const [liked, setLiked] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(null);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [playMode, setPlayMode] = useState('music');
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showImportInPlaylists, setShowImportInPlaylists] = useState(false);
  const [artistInfo, setArtistInfo] = useState(null);
  const [artistLoading, setArtistLoading] = useState(false);
  const [recentTracks, setRecentTracks] = useState(() => getRecentTracks());
  const [downloads, setDownloads] = useState(() => getDownloads());
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [recommended, setRecommended] = useState([]);

  const ytPlayerRef = useRef(null);
  const progressRef = useRef(null);
  const startedRef = useRef(false);
  const repeatRef = useRef('off');
  const playNextRef = useRef(() => {});
  const userRef = useRef(null);
  const searchTimerRef = useRef(null);
  const bgAudioRef = useRef(null);
  const streamUrlCache = useRef(new Map());

  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sv_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.currentTrack) setCurrentTrack(s.currentTrack);
        if (s.queue) setQueue(s.queue);
        if (s.shuffle) setShuffle(s.shuffle);
        if (s.repeat) setRepeat(s.repeat);
        if (s.volume) setVolume(s.volume);
      }
      const savedUser = localStorage.getItem('sv_user');
      if (savedUser) setUser(JSON.parse(savedUser));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sv_state', JSON.stringify({ currentTrack, queue, shuffle, repeat, volume }));
    } catch {}
  }, [currentTrack, queue, shuffle, repeat, volume]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem('sv_user', JSON.stringify(user));
      else localStorage.removeItem('sv_user');
    } catch {}
  }, [user]);

  const doSearch = useCallback(async (q, f, skipCache) => {
    if (!q.trim()) return;
    setLoading(true); setError(''); setActiveView('home');
    if (!skipCache) {
      const cached = getCachedSearch(q);
      if (cached && (cached.mainTrack || (cached.tracks && cached.tracks.length > 0))) {
        setResults(cached); setLoading(false); return;
      }
    }
    try {
      const res = await search(q, f);
      if (res.mainTrack || (res.tracks && res.tracks.length > 0)) setCachedSearch(q, res);
      setResults(res);
    } catch (e) { setError(e.message || 'Search failed'); }
    finally { setLoading(false); }
  }, []);

  const handleSubmit = (e) => { e.preventDefault(); if (searchTimerRef.current) clearTimeout(searchTimerRef.current); doSearch(query, filter); };
  const handleQueryChange = (val) => {
    setQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (val.trim().length > 1) {
      searchTimerRef.current = setTimeout(() => doSearch(val, filter), 400);
    }
  };

  const getShuffledIndex = useCallback((currentIdx, arrLength) => {
    if (arrLength <= 1) return -1;
    let next; do { next = Math.floor(Math.random() * arrLength); } while (next === currentIdx);
    return next;
  }, []);

  const getNextTrack = useCallback(() => {
    if (!queue.length || !currentTrack) return null;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (shuffle) { const n = getShuffledIndex(idx, queue.length); return n >= 0 ? queue[n] : null; }
    if (idx >= 0 && idx < queue.length - 1) return queue[idx + 1];
    if (repeat === 'all' && idx >= 0) return queue[0];
    return null;
  }, [queue, currentTrack, shuffle, repeat, getShuffledIndex]);

  // Pre-fetch stream URLs so we can start <audio> during user gesture
  const prefetchStreamUrl = useCallback((trackId) => {
    if (streamUrlCache.current.has(trackId)) return;
    getStreamUrl(trackId).then(url => {
      if (url) streamUrlCache.current.set(trackId, url);
    }).catch(() => {});
  }, []);

  // Pre-fetch top 5 tracks when results change
  useEffect(() => {
    if (!results) return;
    const tracks = results.tracks || [];
    tracks.slice(0, 5).forEach(t => prefetchStreamUrl(t.id));
  }, [results]);

  // Pre-fetch next tracks in queue
  useEffect(() => {
    if (!currentTrack || !queue.length) return;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (idx >= 0) {
      queue.slice(idx + 1, idx + 4).forEach(t => prefetchStreamUrl(t.id));
    }
  }, [currentTrack?.id, queue]);

  const playTrack = useCallback((track, trackList) => {
    if (trackList) setQueue(trackList);
    setCurrentTrack(track); setLoadingTrack(track.id); setPlaying(false);
    setLoadingStream(true); setStreamError(false); setCurrentTime(0); setDuration(0);
    setLyrics(null); setLiked(favorites.some(t => t.id === track.id));
    addRecentTrack(track);
    setRecentTracks(getRecentTracks());

    // Pause YouTube player (music mode uses <audio> element natively)
    const p = ytPlayerRef.current;
    if (p) { try { p.pauseVideo(); } catch {} }

    // Stop previous background audio
    const prevBg = bgAudioRef.current;
    if (prevBg) { try { prevBg.pause(); } catch {} bgAudioRef.current = null; }

    // Start <audio> element as PRIMARY player (not muted!)
    // iOS lets native <audio> play in background if started by user gesture + MediaSession
    const cachedUrl = streamUrlCache.current.get(track.id);
    const startAudio = (url) => {
      try {
        const bg = new Audio();
        bg.preload = 'auto';
        bg.src = url;
        bg.volume = volume;
        bg.onended = () => {
          if (repeatRef.current === 'one') { bg.currentTime = 0; bg.play().catch(() => {}); }
          else { playNextRef.current(); }
        };
        bg.oncanplay = () => {
          bgAudioRef.current = bg;
          bg.play().then(() => {
            setPlaying(true); setLoadingStream(false); setLoadingTrack(null);
          }).catch(() => {});
        };
        bg.onerror = () => { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); };
      } catch { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); }
    };

    if (cachedUrl) {
      startAudio(cachedUrl);
    } else {
      getStreamUrl(track.id).then(url => {
        if (url) {
          streamUrlCache.current.set(track.id, url);
          if (currentTrack?.id === track.id || !currentTrack) startAudio(url);
        } else { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); }
      }).catch(() => { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); });
    }
  }, [currentTrack?.id, volume]);

  const retryStream = useCallback(() => {
    if (!currentTrack) return;
    setStreamError(false); setLoadingStream(true);
    const cachedUrl = streamUrlCache.current.get(currentTrack.id);
    if (cachedUrl) {
      try {
        const bg = new Audio(cachedUrl);
        bg.preload = 'auto';
        bg.volume = volume;
        bg.onended = () => { playNextRef.current(); };
        bg.oncanplay = () => {
          bgAudioRef.current = bg;
          bg.play().then(() => { setPlaying(true); setLoadingStream(false); setLoadingTrack(null); }).catch(() => {});
        };
        bg.onerror = () => { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); };
      } catch { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); }
    } else {
      getStreamUrl(currentTrack.id).then(url => {
        if (url) {
          streamUrlCache.current.set(currentTrack.id, url);
          const bg = new Audio(url);
          bg.preload = 'auto';
          bg.volume = volume;
          bg.onended = () => { playNextRef.current(); };
          bg.oncanplay = () => {
            bgAudioRef.current = bg;
            bg.play().then(() => { setPlaying(true); setLoadingStream(false); setLoadingTrack(null); }).catch(() => {});
          };
          bg.onerror = () => { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); };
        } else { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); }
      }).catch(() => { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); });
    }
  }, [currentTrack, volume]);

  useEffect(() => {
    if (window.YT && window.YT.Player) { setYoutubeReady(true); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(tag, first);
    window.onYouTubeIframeAPIReady = () => setYoutubeReady(true);
    return () => { window.onYouTubeIframeAPIReady = null; };
  }, []);

  useEffect(() => {
    if (!youtubeReady || ytPlayerRef.current) return;
    try {
      ytPlayerRef.current = new YT.Player('yt-player', {
        height: '1', width: '1',
        playerVars: { modestbranding: 1, rel: 0, controls: 0, playsinline: 1, fs: 0, disablekb: 1 },
        events: {
          onReady: () => {},
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) { setPlaying(true); setLoadingStream(false); setLoadingTrack(null); setStreamError(false); }
            else if (e.data === YT.PlayerState.PAUSED) { setPlaying(false); }
            else if (e.data === YT.PlayerState.ENDED) { setPlaying(false); if (repeatRef.current === 'one') { try { e.target.seekTo(0); e.target.playVideo(); } catch {} } else { playNextRef.current(); } }
            else if (e.data === YT.PlayerState.CUED) { setLoadingStream(false); }
          },
          onError: () => { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); }
        }
      });
    } catch { setLoadingStream(false); setLoadingTrack(null); setStreamError(true); }
  }, [youtubeReady]);

  useEffect(() => {
    const el = document.getElementById('yt-player');
    if (!el) return;
    if (playMode === 'video') {
      el.style.cssText = 'position:fixed;left:auto;bottom:90px;right:10px;z-index:100;width:360px;height:203px;opacity:1;pointer-events:auto;transition:all 0.3s ease';
    } else {
      el.style.cssText = 'position:fixed;left:1px;bottom:1px;right:auto;z-index:1;width:1px;height:1px;opacity:0.01;pointer-events:none;transition:all 0.3s ease';
    }
  }, [playMode]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      try {
        const bg = bgAudioRef.current;
        if (bg && bg.src && !bg.paused) {
          setCurrentTime(bg.currentTime || 0);
          setDuration(bg.duration || 0);
        } else {
          const p = ytPlayerRef.current;
          if (p && p.getCurrentTime) { setCurrentTime(p.getCurrentTime() || 0); setDuration(p.getDuration() || 0); }
        }
      } catch {}
    }, 250);
    return () => clearInterval(interval);
  }, [playing, currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack) return;
    setLyrics(null);
    getLyrics(currentTrack.id).then(l => setLyrics(l)).catch(() => {});
  }, [currentTrack?.id]);

  const togglePlay = () => {
    const bg = bgAudioRef.current;
    if (bg && bg.src) {
      try { if (playing) bg.pause(); else bg.play(); } catch {}
    } else {
      const p = ytPlayerRef.current;
      if (!p || loadingStream) return;
      try { if (playing) p.pauseVideo(); else p.playVideo(); } catch {}
    }
  };

  const playNext = useCallback(() => {
    const next = getNextTrack();
    if (next) playTrack(next, queue);
  }, [getNextTrack, playTrack, queue]);

  const playPrev = () => {
    if (!queue.length || !currentTrack) return;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (idx > 0) playTrack(queue[idx - 1], queue);
  };

  const handleProgressClick = (e) => {
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const dur = bgAudioRef.current?.duration || ytPlayerRef.current?.getDuration?.() || 0;
    const seekTo = pct * dur;
    try {
      if (bgAudioRef.current && bgAudioRef.current.src && !bgAudioRef.current.paused) {
        bgAudioRef.current.currentTime = seekTo;
      } else {
        const p = ytPlayerRef.current;
        if (p) p.seekTo(seekTo, true);
      }
    } catch {}
  };

  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { playNextRef.current = playNext; }, [playNext]);
  useEffect(() => {
    try {
      if (bgAudioRef.current) bgAudioRef.current.volume = volume;
      if (ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(volume * 100);
    } catch {}
  }, [volume]);

  const togglePlayRef = useRef(togglePlay);
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlayRef.current(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // No visibilitychange handler needed — native <audio> plays in background on iOS
  // Just cleanup on unmount
  useEffect(() => {
    return () => {
      const bg = bgAudioRef.current;
      if (bg) { bg.pause(); bg.src = ''; }
    };
  }, []);

  // MediaSession: lock screen / notification center controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: currentTrack.thumbnail ? [{ src: currentTrack.thumbnail, sizes: '480x480', type: 'image/jpeg' }] : []
    });
    navigator.mediaSession.setActionHandler('play', () => { togglePlayRef.current(); });
    navigator.mediaSession.setActionHandler('pause', () => { togglePlayRef.current(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { playPrev(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { playNext(); });
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.thumbnail]);

  const toggleShuffle = () => setShuffle(s => !s);
  const toggleRepeat = () => setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');
  const removeFromQueue = (idx) => setQueue(q => q.filter((_, i) => i !== idx));
  const handleNavigate = (view) => { setActiveView(view); };
  const handleArtistClick = async (artist) => {
    setArtistLoading(true); setArtistInfo(null); setActiveView('home');
    try {
      const info = await getArtistInfo(artist.id);
      setArtistInfo(info || artist);
    } catch { setArtistInfo(artist); }
    setArtistLoading(false);
  };
  const createPlaylist = (name) => setPlaylists(pl => [...pl, { name, tracks: [] }]);
  const addToPlaylist = (playlistIdx) => {
    if (!currentTrack) return;
    setPlaylists(pl => pl.map((p, i) => i === playlistIdx ? { ...p, tracks: [...p.tracks, currentTrack] } : p));
    setShowPlaylists(false);
  };
  const toggleDownload = async (track) => {
    if (isDownloaded(track.id)) {
      removeDownload(track.id);
      setDownloads(getDownloads());
    } else {
      setDownloadingIds(prev => new Set(prev).add(track.id));
      try {
        const blob = await downloadAudioBlob(track.id);
        if (blob) {
          await saveAudioBlob(track.id, blob);
          addDownload(track);
          setDownloads(getDownloads());
        }
      } catch {}
      setDownloadingIds(prev => { const next = new Set(prev); next.delete(track.id); return next; });
    }
  };
  const toggleFavorite = (track) => {
    const favs = getFavorites();
    const exists = favs.find(t => t.id === track.id);
    const updated = exists ? favs.filter(t => t.id !== track.id) : [...favs, { id: track.id, title: track.title, artist: track.artist, thumbnail: track.thumbnail, duration: track.duration }];
    saveFavorites(updated);
    setFavorites(updated);
    if (currentTrack?.id === track.id) setLiked(!exists);
  };

  // Social auth
  const handleRegister = async (username, email, password, referralCode) => {
    const u = await socialRegister(username, email, password, referralCode || undefined);
    if (u && u.id) { setUser(u); setShowAuth(false); return true; }
    return u?.error || 'Registration failed';
  };
  const handleLogin = async (identifier, password) => {
    const u = await socialLogin(identifier, password);
    if (u && u.id) { setUser(u); setShowAuth(false); return true; }
    return u?.error || 'Invalid credentials';
  };
  const handleLogout = () => setUser(null);

  useEffect(() => {
    if (!results && recentTracks.length > 0) {
      const artist = recentTracks[0]?.artist;
      if (artist && artist !== 'Unknown') {
        getRelatedTracks(artist).then(tracks => {
          setRecommended(tracks.filter(t => !recentTracks.find(r => r.id === t.id)).slice(0, 10));
        }).catch(() => {});
      }
    }
  }, [recentTracks, results]);

  // Notifications polling
  useEffect(() => {
    if (!user) return;
    const load = () => fetchNotifs(user.id).then(setNotifs).catch(() => {});
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [user]);

  // Socket for notifications
  useEffect(() => {
    if (!user) return;
    const startSocket = () => {
      const socket = getSocket();
      if (!socket) { setTimeout(startSocket, 1000); return; }
      socket.on('notification', () => { fetchNotifs(user.id).then(setNotifs).catch(() => {}); });
    };
    startSocket();
  }, [user]);

  const tracks = results?.tracks || [];
  const albums = results?.albums || [];
  const artists = results?.artists || [];
  const mainTrack = results?.mainTrack || null;
  const variations = results?.variations || [];
  const relatedTracks = results?.relatedTracks || [];
  const similarTracks = results?.similarTracks || [];

  return (
    <>
    <div className="app">
      {/* Mobile menu overlay */}
      {!sidebarCollapsed && window.innerWidth <= 768 && (
        <div className="modal-overlay" onClick={() => setSidebarCollapsed(true)} style={{ zIndex: 49 }} />
      )}
      <div className={`sidebar ${!sidebarCollapsed ? 'open' : 'collapsed'}`}>
        <div className="sidebar-logo">{!sidebarCollapsed ? 'Soundusic' : 'S'}</div>
        <div className="sidebar-links">
          <div className={`sidebar-link ${activeView === 'home' ? 'active' : ''}`} onClick={() => handleNavigate('home')}>
            <span className="icon"><IconHome /></span><span>Home</span>
          </div>
          <div className={`sidebar-link ${activeView === 'downloads' ? 'active' : ''}`} onClick={() => handleNavigate('downloads')}>
            <span className="icon"><svg style={{ width: 20, height: 20, fill: 'currentColor' }} viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></span><span>Downloads</span>
          </div>
          <div className={`sidebar-link ${activeView === 'friends' ? 'active' : ''}`} onClick={() => handleNavigate('friends')}>
            <span className="icon"><IconFriends /></span><span>Friends</span>
          </div>
          <div className={`sidebar-link ${activeView === 'jam' ? 'active' : ''}`} onClick={() => handleNavigate('jam')}>
            <span className="icon"><IconJam /></span><span>Jam</span>
          </div>
          <div className={`sidebar-link ${activeView === 'playlists' ? 'active' : ''}`} onClick={() => handleNavigate('playlists')}>
            <span className="icon"><IconPlaylist /></span><span>Playlists</span>
          </div>
          <div className={`sidebar-link ${activeView === 'admin' ? 'active' : ''}`} onClick={() => handleNavigate('admin')}>
            <span className="icon"><IconAdmin /></span><span>Admin</span>
          </div>
        </div>
        <div className="sidebar-auth">
          {user ? (
            <div className="header-user" onClick={() => setShowAuth(true)}>
              <div className="avatar" style={{ background: user.color }}>{user.username[0]}</div>
              {!sidebarCollapsed && <span style={{ fontSize: 13 }}>{user.username}</span>}
            </div>
          ) : (
            !sidebarCollapsed && <button className="btn-primary" style={{ width: '100%', padding: '8px 12px', fontSize: 13 }} onClick={() => { setShowAuth(true); if (window.innerWidth <= 768) setSidebarCollapsed(true); }}>Sign In</button>
          )}
        </div>
      </div>

      <div className="main-area">
        <header className="header">
          <button className="icon-btn sidebar-toggle" onClick={() => setSidebarCollapsed(c => !c)}>
            <svg style={{ width: 22, height: 22, fill: 'currentColor' }} viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" /></svg>
          </button>
          <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-wrap">
              <IconSearch size={16} />
              <input type="text" placeholder="Search songs, albums, artists..." value={query} onChange={e => handleQueryChange(e.target.value)} />
            </div>
            <button type="submit">Search</button>
          </form>
          <div className="header-actions">
            {user && (
              <>
                <button className="icon-btn" onClick={() => setShowNotifs(true)} title="Notifications" style={{ position: 'relative' }}>
                  <IconBell size={18} />
                  {notifs.length > 0 && <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--primary)', color: '#fff', fontSize: 9, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{notifs.length}</span>}
                </button>
                <button className="icon-btn" onClick={() => { setShowChat(true); setShowNotifs(false); }} title="Chat"><IconChat size={18} /></button>
              </>
            )}
            {!user && <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => { setShowAuth(true); if (window.innerWidth <= 768) setSidebarCollapsed(true); }}>Sign In</button>}
          </div>
        </header>

        <main className="content">
          {activeView === 'social' && user && (
            <div className="social-section">
              <div className="section-header"><h2>Social</h2></div>
              {user ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Chat with friends or start a conversation</p>
                  <div className="friend-list" style={{ maxWidth: 300, margin: '0 auto' }}>
                    <div className="friend-item" onClick={() => setShowChat(true)} style={{ cursor: 'pointer' }}>
                      <IconChat size={24} />
                      <div className="friend-info"><strong>Open Chat</strong></div>
                    </div>
                    <div className="friend-item" onClick={() => handleNavigate('friends')} style={{ cursor: 'pointer' }}>
                      <IconFriends size={24} />
                      <div className="friend-info"><strong>Friends</strong></div>
                    </div>
                    <div className="friend-item" onClick={() => handleNavigate('jam')} style={{ cursor: 'pointer' }}>
                      <IconJam size={24} />
                      <div className="friend-info"><strong>Jam Sessions</strong></div>
                    </div>
                  </div>
                </div>
              ) : <p className="panel-empty">Sign in to use social features</p>}
            </div>
          )}

          {activeView === 'friends' && (
            user ? <Friends userId={user.id} userColor={user.color} /> : <p className="panel-empty">Sign in to add friends</p>
          )}

          {activeView === 'jam' && (
            user ? <JamSession userId={user.id} username={user.username} userColor={user.color} currentTrack={currentTrack} playing={playing} currentTime={currentTime} onPlayTrack={playTrack} /> : <p className="panel-empty">Sign in to join a Jam</p>
          )}

          {activeView === 'playlists' && (
            <div className="playlists-view">
              <div className="section-header">
                <h2>Your Playlists</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => {
                    const name = prompt('Playlist name:');
                    if (name?.trim()) createPlaylist(name.trim());
                  }}>+ New Playlist</button>
                  <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setShowImportInPlaylists(s => !s)}>
                    {showImportInPlaylists ? 'Hide Import' : 'Import'}
                  </button>
                </div>
              </div>
              {showImportInPlaylists && <ImportPlaylist onPlayTrack={playTrack} />}
              {playlists.length === 0 && !showImportInPlaylists ? <p className="panel-empty">No playlists yet</p> : (
                <div className="playlists-grid">
                  {playlists.map((pl, i) => (
                    <div key={i} className="playlist-card" onClick={() => playTrack(pl.tracks[0], pl.tracks)}>
                      <div className="playlist-card-img">
                        {pl.tracks[0] ? <img src={pl.tracks[0].thumbnail} alt="" /> : <div className="playlist-placeholder"><IconMusicNote size={24} /></div>}
                      </div>
                      <div className="playlist-card-body"><h4>{pl.name}</h4><p>{pl.tracks.length} tracks</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === 'queue' && (
            <div className="tab-view">
              <div className="section-header"><h2>Queue {queue.length > 0 && `(${queue.length})`}</h2></div>
              {queue.length === 0 ? <p className="panel-empty">Queue is empty</p> : (
                <div className="track-list">
                  {queue.map((t, i) => (
                    <div key={`${t.id}-${i}`} className={`track-item ${currentTrack?.id === t.id ? 'active' : ''}`} onClick={() => playTrack(t, queue)}>
                      <span className="track-num">{i + 1}</span>
                      <img src={t.thumbnail} alt={t.title} loading="lazy" />
                      <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                      <span className="track-duration">{formatDuration(t.duration)}</span>
                      <button className="icon-btn" onClick={e => { e.stopPropagation(); removeFromQueue(i); }} title="Remove">
                        <svg style={{ width: 14, height: 14, fill: 'currentColor' }} viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )          }

          {artistInfo && !artistLoading && (
            <div className="panel-content artist-page">
              <div className="artist-header">
                <button className="btn-secondary" style={{ marginBottom: 12 }} onClick={() => setArtistInfo(null)}>← Back to results</button>
                {artistInfo.thumbnail && <img className="artist-header-img" src={artistInfo.thumbnail} alt={artistInfo.name} />}
                <h2>{artistInfo.name}</h2>
                {artistInfo.subscribers && <p className="text-secondary">{artistInfo.subscribers} subscribers</p>}
                {artistInfo.description && <p className="text-secondary artist-desc">{artistInfo.description}</p>}
              </div>
              {artistInfo.songs && artistInfo.songs.length > 0 && (
                <section className="section">
                  <h3>Songs</h3>
                  <div className="track-list">
                    {artistInfo.songs.map((t, i) => {
                      const isActive = currentTrack?.id === t.id;
                      return (
                        <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, artistInfo.songs)}>
                          <span className="track-num">{isActive && playing ? <IconMusicNote size={14} /> : i + 1}</span>
                          <img src={t.thumbnail} alt={t.title} loading="lazy" />
                          <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                          <span className="track-duration">{formatDuration(t.duration)}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              {artistInfo.albums && artistInfo.albums.length > 0 && (
                <section className="section">
                  <h3>Albums</h3>
                  <div className="scroll-row">
                    {artistInfo.albums.map(a => (
                      <div key={a.id} className="card card-album" onClick={() => { setQuery(a.title); doSearch(a.title, 'album'); }}>
                        {a.thumbnail && <img className="card-img" src={a.thumbnail} alt={a.title} loading="lazy" />}
                        <div className="card-body"><h4>{a.title}</h4>{a.year ? <p>{a.year}</p> : null}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {artistLoading && <p style={{ padding: 24 }}>Loading artist...</p>}

          {activeView === 'admin' && !adminLoggedIn && <AdminLogin onLogin={() => setAdminLoggedIn(true)} />}
          {activeView === 'admin' && adminLoggedIn && <AdminDashboard onLogout={() => setAdminLoggedIn(false)} user={user} />}
          {activeView === 'import' && <ImportPlaylist onPlayTrack={playTrack} />}

          {activeView === 'downloads' && (
            <div className="tab-view">
              <div className="section-header">
                <h2>Downloads</h2>
                {downloads.length > 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{downloads.length} tracks</span>}
              </div>
              {downloads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <IconDownload size={48} style={{ color: 'var(--text-secondary)', marginBottom: 16 }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No downloads yet</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>Tap the download icon on any track to save it for offline</p>
                </div>
              ) : (
                <div className="track-list">
                  {downloads.map((t, i) => {
                    const isActive = currentTrack?.id === t.id;
                    const isDownloading = downloadingIds.has(t.id);
                    return (
                      <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, downloads)}>
                        <img src={t.thumbnail} alt={t.title} loading="lazy" />
                        <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                        <span className="track-duration">{formatDuration(t.duration)}</span>
                        <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleDownload(t); }} title="Remove download">
                          <svg style={{ width: 16, height: 16, fill: 'var(--primary)' }} viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeView === 'home' && (
            <>
              {!results && !loading && !error && (
                <>
                  <div className="hero">
                    <div className="hero-glow" />
                    <h2>Listen to any song, anytime</h2>
                    <p>Search millions of tracks powered by YouTube</p>
                  </div>
                  {recentTracks.length > 0 && (
                    <section className="section">
                      <h3>Continue listening</h3>
                      <div className="track-list">
                        {recentTracks.slice(0, 8).map((t, i) => {
                          const isActive = currentTrack?.id === t.id;
                          return (
                            <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, recentTracks)}>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                              <span className="track-duration">{formatDuration(t.duration)}</span>
                              <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleDownload(t); }} title={isDownloaded(t.id) ? 'Remove download' : 'Download for offline'}>
                                <svg style={{ width: 16, height: 16, fill: isDownloaded(t.id) ? 'var(--primary)' : 'currentColor' }} viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {downloads.length > 0 && (
                    <section className="section">
                      <h3>Downloaded</h3>
                      <div className="track-list">
                        {downloads.slice(0, 6).map((t, i) => {
                          const isActive = currentTrack?.id === t.id;
                          return (
                            <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, downloads)}>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                              <span className="track-duration">{formatDuration(t.duration)}</span>
                              <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleDownload(t); }} title="Remove download">
                                <svg style={{ width: 16, height: 16, fill: 'var(--primary)' }} viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {favorites.length > 0 && (
                    <section className="section">
                      <h3>Favorites</h3>
                      <div className="track-list">
                        {favorites.slice(0, 8).map((t, i) => {
                          const isActive = currentTrack?.id === t.id;
                          return (
                            <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, favorites)}>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                              <span className="track-duration">{formatDuration(t.duration)}</span>
                              <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleFavorite(t); }} title="Remove from favorites">
                                <svg style={{ width: 16, height: 16, fill: 'var(--primary)' }} viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {recommended.length > 0 && (
                    <section className="section">
                      <h3>Recommended for you</h3>
                      <div className="track-list">
                        {recommended.map((t, i) => {
                          const isActive = currentTrack?.id === t.id;
                          return (
                            <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, recommended)}>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                              <span className="track-duration">{formatDuration(t.duration)}</span>
                              <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleDownload(t); }} title={isDownloaded(t.id) ? 'Remove download' : 'Download'}>
                                <svg style={{ width: 16, height: 16, fill: isDownloaded(t.id) ? 'var(--primary)' : 'currentColor' }} viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              )}
              {loading && (
                <div className="loading-skeleton">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="skeleton-row">
                      <div className="skeleton skeleton-img" />
                      <div className="skeleton skeleton-line w-60" />
                      <div className="skeleton skeleton-line w-30" />
                    </div>
                  ))}
                </div>
              )}
              {error && <div className="error">{error}</div>}
              {results && !loading && (
                <>
                  <div className="section-header">
                    <h2>Results for "{query}"</h2>
                    <div className="filter-tabs">
                      {['all', 'track', 'album', 'artist'].map(f => (
                        <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                          {f === 'all' ? 'All' : f === 'track' ? 'Songs' : f === 'album' ? 'Albums' : 'Artists'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {artists.length > 0 && (
                    <section className="section">
                      <h3>Artists</h3>
                      <div className="scroll-row">
                        {artists.map(a => (
                          <div key={a.id} className="card card-artist" onClick={() => handleArtistClick(a)}>
                            <img className="card-img" src={a.thumbnail} alt={a.title} loading="lazy" />
                            <div className="card-body"><h4>{a.title}</h4><p>Artist</p></div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {mainTrack && (
                    <section className="section">
                      <h3>Top result</h3>
                      <div className="main-result" onClick={() => playTrack(mainTrack, results?.tracks || [mainTrack])}>
                        <img className="main-result-img" src={mainTrack.thumbnail} alt={mainTrack.title} />
                        <div className="main-result-info">
                          <h3>{mainTrack.title}</h3>
                          <p>{mainTrack.artist}</p>
                          <span className="track-duration">{formatDuration(mainTrack.duration)}</span>
                        </div>
                        <button className="icon-btn track-more" onClick={e => { e.stopPropagation(); setCurrentTrack(mainTrack); setShowPlaylists(true); }}>+</button>
                      </div>
                    </section>
                  )}

                  {variations.length > 0 && (
                    <section className="section">
                      <h3>Variations</h3>
                      <div className="track-list">
                        {variations.map((t, i) => {
                          const isActive = currentTrack?.id === t.id;
                          return (
                            <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, results?.tracks || [])}>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                              <span className="track-duration">{formatDuration(t.duration)}</span>
                          <button className="icon-btn track-more" onClick={e => { e.stopPropagation(); setCurrentTrack(t); setShowPlaylists(true); }}>+</button>
                          <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleDownload(t); }} title={isDownloaded(t.id) ? 'Remove download' : 'Download'}>
                            <svg style={{ width: 16, height: 16, fill: isDownloaded(t.id) ? 'var(--primary)' : 'currentColor' }} viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {relatedTracks.length > 0 && (
                    <section className="section">
                      <h3>More by {mainTrack?.artist || 'this artist'}</h3>
                      <div className="track-list">
                        {relatedTracks.map((t, i) => {
                          const isActive = currentTrack?.id === t.id;
                          return (
                            <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, results?.tracks || [])}>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                              <span className="track-duration">{formatDuration(t.duration)}</span>
                              <button className="icon-btn track-more" onClick={e => { e.stopPropagation(); setCurrentTrack(t); setShowPlaylists(true); }}>+</button>
                              <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleDownload(t); }} title={isDownloaded(t.id) ? 'Remove download' : 'Download'}>
                                <svg style={{ width: 16, height: 16, fill: isDownloaded(t.id) ? 'var(--primary)' : 'currentColor' }} viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {similarTracks.length > 0 && (
                    <section className="section">
                      <h3>Similar tracks</h3>
                      <div className="track-list">
                        {similarTracks.map((t, i) => {
                          const isActive = currentTrack?.id === t.id;
                          return (
                            <div key={t.id} className={`track-item ${isActive ? 'active' : ''}`} onClick={() => playTrack(t, results?.tracks || [])}>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                              <span className="track-duration">{formatDuration(t.duration)}</span>
                              <button className="icon-btn track-more" onClick={e => { e.stopPropagation(); setCurrentTrack(t); setShowPlaylists(true); }}>+</button>
                              <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleDownload(t); }} title={isDownloaded(t.id) ? 'Remove download' : 'Download'}>
                                <svg style={{ width: 16, height: 16, fill: isDownloaded(t.id) ? 'var(--primary)' : 'currentColor' }} viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {albums.length > 0 && (
                    <section className="section">
                      <h3>Albums</h3>
                      <div className="scroll-row">
                        {albums.map(a => (
                          <div key={a.id} className="card card-album" onClick={() => { setQuery(a.title); doSearch(a.title, 'track'); }}>
                            <img className="card-img" src={a.thumbnail} alt={a.title} loading="lazy" />
                            <div className="card-body"><h4>{a.title}</h4><p>{a.artist}</p></div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <p>MusicVantage 2026 &mdash; <a href="mailto:edoardobevilacqua78@gmail.com">edoardobevilacqua78@gmail.com</a></p>
      </footer>

      <MobileNav activeView={activeView} onNavigate={handleNavigate} onOpenSearch={() => {}} notifCount={notifs.length} />

      {currentTrack && (
        <PlayerBar
          currentTrack={currentTrack}
          playing={playing}
          loadingStream={loadingStream}
          streamError={streamError}
          currentTime={currentTime}
          duration={duration}
          shuffle={shuffle}
          repeat={repeat}
          volume={volume}
          liked={liked}
          playMode={playMode}
          togglePlay={togglePlay}
          playPrev={playPrev}
          playNext={playNext}
          retryStream={retryStream}
          handleProgressClick={handleProgressClick}
          setVolume={setVolume}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          onOpenLyrics={() => setShowLyrics(true)}
          onOpenQueue={() => setShowQueue(true)}
          onOpenPlaylists={() => setShowPlaylists(true)}
          onToggleLike={() => currentTrack && toggleFavorite(currentTrack)}
          onToggleMode={() => setPlayMode(m => m === 'music' ? 'video' : 'music')}
          lyrics={lyrics}
          showLyrics={showLyrics}
          setShowLyrics={setShowLyrics}
        />
      )}

      {showQueue && <QueuePanel queue={queue} currentTrack={currentTrack} onPlayTrack={playTrack} onRemove={removeFromQueue} onClose={() => setShowQueue(false)} />}
      {showPlaylists && <PlaylistsPanel playlists={playlists} currentTrack={currentTrack} onAddToPlaylist={addToPlaylist} onCreatePlaylist={createPlaylist} onPlayTrack={playTrack} onClose={() => setShowPlaylists(false)} />}

      {showAuth && (
        <AuthModal
          onLogin={handleLogin}
          onRegister={handleRegister}
          onClose={() => setShowAuth(false)}
          onLogout={user ? handleLogout : null}
          user={user}
        />
      )}

      {showChat && user && <Chat room="general" userId={user.id} username={user.username} userColor={user.color} onClose={() => setShowChat(false)} />}
      {showNotifs && user && <Notifications userId={user.id} onClose={() => setShowNotifs(false)} />}

      </div>

      <footer className="app-footer">
        <p>MusicVantage 2026 &mdash; <a href="mailto:edoardobevilacqua78@gmail.com">edoardobevilacqua78@gmail.com</a></p>
      </footer>
    </>
  );
}

function AuthModal({ onLogin, onRegister, onClose, onLogout, user }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(() => new URLSearchParams(window.location.search).get('ref') || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (mode === 'login') {
      if ((!email.trim() && !username.trim()) || !password.trim()) { setError('Fill all fields'); return; }
      const fn = onLogin;
      const ok = await fn(email.trim() || username.trim(), password);
      if (ok === true) return;
      setError(typeof ok === 'string' ? ok : 'Invalid credentials');
    } else {
      if (!email.trim() || !username.trim() || !password.trim()) { setError('Fill all fields'); return; }
      if (!referralCode.trim()) { setError('Referral code required'); return; }
      const ok = await onRegister(username.trim(), email.trim(), password, referralCode.trim());
      if (ok === true) return;
      setError(typeof ok === 'string' ? ok : 'Registration failed');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel auth-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{user ? 'Account' : mode === 'login' ? 'Sign In' : 'Register'}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {user ? (
          <div className="auth-form">
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div className="friend-avatar" style={{ width: 48, height: 48, fontSize: 20, margin: '0 auto 12px', background: user.color }}>{user.username[0]}</div>
              <h3>{user.username}</h3>
              {user.email && <p className="text-secondary">{user.email}</p>}
            </div>
            <button className="btn-secondary" onClick={onLogout}>Sign Out</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'login' ? (
              <>
                <input value={email} onChange={e => { setEmail(e.target.value); setUsername(''); }} placeholder="Email or username" />
              </>
            ) : (
              <>
                <input value={referralCode} onChange={e => setReferralCode(e.target.value)} placeholder="Referral code *" autoFocus />
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" />
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
              </>
            )}
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn-primary">{mode === 'login' ? 'Sign In' : 'Register'}</button>
            <button type="button" className="btn-secondary" onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); setEmail(''); setUsername(''); setPassword(''); setReferralCode(''); }}>
              {mode === 'login' ? 'Create account' : 'Already have an account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;