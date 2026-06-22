import React, { useState, useRef, useEffect, useCallback } from 'react';
import { search, getLyrics, socialRegister, socialLogin, getNotifications as fetchNotifs, getSocket } from './api';
import { formatDuration } from './utils';
import Sidebar from './Sidebar';
import PlayerBar from './PlayerBar';
import QueuePanel from './QueuePanel';
import LyricsPanel from './LyricsPanel';
import PlaylistsPanel from './PlaylistsPanel';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import ImportPlaylist from './ImportPlaylist';
import Chat from './components/Chat';
import Friends from './components/Friends';
import Notifications from './components/Notifications';
import JamSession from './components/JamSession';
import MobileNav from './components/MobileNav';
import { IconSearch, IconAdmin, IconImport, IconHome, IconChat, IconFriends, IconJam, IconPlaylist, IconQueue, IconLyrics, IconBell, IconUser } from './Icons';

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

  const ytPlayerRef = useRef(null);
  const progressRef = useRef(null);
  const startedRef = useRef(false);
  const repeatRef = useRef('off');
  const playNextRef = useRef(() => {});
  const userRef = useRef(null);

  useEffect(() => { userRef.current = user; }, [user]);

  const doSearch = useCallback(async (q, f) => {
    if (!q.trim()) return;
    setLoading(true); setError(''); setActiveView('home');
    try {
      const res = await search(q, f);
      setResults(res);
    } catch (e) { setError(e.message || 'Search failed'); }
    finally { setLoading(false); }
  }, []);

  const handleSubmit = (e) => { e.preventDefault(); doSearch(query, filter); };

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

  const playTrack = useCallback((track, trackList) => {
    if (trackList) setQueue(trackList);
    if (ytPlayerRef.current && currentTrack?.id === track.id) {
      try { ytPlayerRef.current.seekTo(0); ytPlayerRef.current.playVideo(); } catch {}
      return;
    }
    setCurrentTrack(track); setLoadingTrack(track.id); setPlaying(false);
    setLoadingStream(true); setStreamError(false); setCurrentTime(0); setDuration(0);
    setLyrics(null); setLiked(false);
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.loadVideoById(track.id); } catch {}
    }
  }, [currentTrack?.id]);

  const retryStream = useCallback(() => {
    if (!currentTrack || !ytPlayerRef.current) return;
    setStreamError(false); setLoadingStream(true);
    try { ytPlayerRef.current.loadVideoById(currentTrack.id); } catch { setLoadingStream(false); }
  }, [currentTrack]);

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
    if (!youtubeReady || !currentTrack) return;
    setLoadingStream(true); setStreamError(false);
    const p = ytPlayerRef.current;
    if (!p) {
      try {
        ytPlayerRef.current = new YT.Player('yt-player', {
          videoId: currentTrack.id, height: '240', width: '100%',
          playerVars: { autoplay: 1, modestbranding: 1, rel: 0, controls: 0, playsinline: 1, fs: 0 },
          events: {
            onReady: (e) => { e.target.playVideo(); },
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
    } else {
      try { p.loadVideoById(currentTrack.id); } catch { setLoadingStream(false); setStreamError(true); }
    }
  }, [currentTrack?.id, youtubeReady]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      try { const p = ytPlayerRef.current; if (p && p.getCurrentTime) { setCurrentTime(p.getCurrentTime() || 0); setDuration(p.getDuration() || 0); } } catch {}
    }, 250);
    return () => clearInterval(interval);
  }, [playing, currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack || !playing) return;
    getLyrics(currentTrack.id).then(l => setLyrics(l)).catch(() => {});
  }, [currentTrack?.id]);

  const togglePlay = () => {
    const p = ytPlayerRef.current;
    if (!p || loadingStream) return;
    try { if (playing) p.pauseVideo(); else p.playVideo(); } catch {}
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
    const p = ytPlayerRef.current; const bar = progressRef.current;
    if (!p || !bar) return;
    try { const rect = bar.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width; p.seekTo(pct * (p.getDuration() || 0), true); } catch {}
  };

  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { playNextRef.current = playNext; }, [playNext]);
  useEffect(() => { try { if (ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(volume * 100); } catch {} }, [volume]);

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

  const toggleShuffle = () => setShuffle(s => !s);
  const toggleRepeat = () => setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');
  const removeFromQueue = (idx) => setQueue(q => q.filter((_, i) => i !== idx));
  const handleNavigate = (view) => { setActiveView(view); setSidebarCollapsed(true); };
  const createPlaylist = (name) => setPlaylists(pl => [...pl, { name, tracks: [] }]);
  const addToPlaylist = (playlistIdx) => {
    if (!currentTrack) return;
    setPlaylists(pl => pl.map((p, i) => i === playlistIdx ? { ...p, tracks: [...p.tracks, currentTrack] } : p));
    setShowPlaylists(false);
  };

  // Social auth
  const handleRegister = async (username, password) => {
    const u = await socialRegister(username, password);
    if (u && u.id) { setUser(u); setShowAuth(false); return true; }
    return false;
  };
  const handleLogin = async (username, password) => {
    const u = await socialLogin(username, password);
    if (u && u.id) { setUser(u); setShowAuth(false); return true; }
    return false;
  };
  const handleLogout = () => setUser(null);

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

  return (
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
          <div className={`sidebar-link ${activeView === 'social' ? 'active' : ''}`} onClick={() => handleNavigate('social')}>
            <span className="icon"><IconChat /></span><span>Social</span>
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
          <div className={`sidebar-link ${activeView === 'queue' ? 'active' : ''}`} onClick={() => handleNavigate('queue')}>
            <span className="icon"><IconQueue /></span><span>Queue</span>
          </div>
          <div className={`sidebar-link ${activeView === 'lyrics' ? 'active' : ''}`} onClick={() => handleNavigate('lyrics')}>
            <span className="icon"><IconLyrics /></span><span>Lyrics</span>
          </div>
          <div className={`sidebar-link ${activeView === 'import' ? 'active' : ''}`} onClick={() => handleNavigate('import')}>
            <span className="icon"><IconImport /></span><span>Import</span>
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
            !sidebarCollapsed && <button className="btn-primary" style={{ width: '100%', padding: '8px 12px', fontSize: 13 }} onClick={() => setShowAuth(true)}>Sign In</button>
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
              <input type="text" placeholder="Search songs, albums, artists..." value={query} onChange={e => setQuery(e.target.value)} />
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
            {!user && <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setShowAuth(true)}>Sign In</button>}
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
              <div className="section-header"><h2>Your Playlists</h2></div>
              {playlists.length === 0 ? <p className="panel-empty">No playlists yet</p> : (
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
          )}

          {activeView === 'lyrics' && (
            <div className="tab-view">
              <div className="section-header"><h2>Lyrics</h2></div>
              {currentTrack ? (
                <div className="lyrics-content">
                  <div className="lyrics-track-info">
                    <img src={currentTrack.thumbnail} alt={currentTrack.title} />
                    <div><h3>{currentTrack.title}</h3><p>{currentTrack.artist}</p></div>
                  </div>
                  <div className="lyrics-text">
                    <p className="lyrics-placeholder">No lyrics available for this track.<br />Lyrics will appear here when available.</p>
                  </div>
                </div>
              ) : <p className="panel-empty">Select a track to view lyrics</p>}
            </div>
          )}

          {activeView === 'admin' && !adminLoggedIn && <AdminLogin onLogin={() => setAdminLoggedIn(true)} />}
          {activeView === 'admin' && adminLoggedIn && <AdminDashboard onLogout={() => setAdminLoggedIn(false)} />}
          {activeView === 'import' && <ImportPlaylist onPlayTrack={playTrack} />}

          {activeView === 'home' && (
            <>
              {!results && !loading && !error && (
                <div className="hero">
                  <div className="hero-glow" />
                  <h2>Listen to any song, anytime</h2>
                  <p>Search millions of tracks powered by YouTube</p>
                </div>
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
                  {(filter === 'all' || filter === 'artist') && artists.length > 0 && (
                    <section className="section">
                      <h3>Artists</h3>
                      <div className="scroll-row">
                        {artists.map(a => (
                          <div key={a.id} className="card card-artist" onClick={() => { setQuery(a.title); doSearch(a.title, 'all'); }}>
                            <img className="card-img" src={a.thumbnail} alt={a.title} loading="lazy" />
                            <div className="card-body"><h4>{a.title}</h4><p>Artist</p></div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {(filter === 'all' || filter === 'album') && albums.length > 0 && (
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
                  {(filter === 'all' || filter === 'track') && tracks.length > 0 && (
                    <section className="section">
                      {filter === 'all' && <h3>Songs</h3>}
                      <div className="track-list">
                        {tracks.map((t, i) => {
                          const isActive = currentTrack?.id === t.id;
                          const isLoading = loadingTrack === t.id;
                          return (
                            <div key={t.id} className={`track-item ${isActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`} onClick={() => playTrack(t, tracks)}>
                              <span className="track-num">{isLoading ? <div className="spinner sm" /> : isActive && playing ? <IconMusicNote size={14} /> : i + 1}</span>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info"><h4>{t.title}</h4><p>{t.artist}</p></div>
                              <span className="track-duration">{formatDuration(t.duration)}</span>
                              <button className="icon-btn track-more" onClick={e => { e.stopPropagation(); setCurrentTrack(t); setShowPlaylists(true); }} title="Add to playlist">
                                <svg style={{ width: 16, height: 16, fill: 'currentColor' }} viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {filter === 'album' && albums.length > 0 && (
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
                  {filter === 'artist' && artists.length > 0 && (
                    <section className="section">
                      <h3>Artists</h3>
                      <div className="scroll-row">
                        {artists.map(a => (
                          <div key={a.id} className="card card-artist" onClick={() => { setQuery(a.title); doSearch(a.title, 'all'); }}>
                            <img className="card-img" src={a.thumbnail} alt={a.title} loading="lazy" />
                            <div className="card-body"><h4>{a.title}</h4><p>Artist</p></div>
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
          onToggleLike={() => setLiked(l => !l)}
          onToggleMode={() => setPlayMode(m => m === 'music' ? 'video' : 'music')}
        />
      )}

      {showQueue && <QueuePanel queue={queue} currentTrack={currentTrack} onPlayTrack={playTrack} onRemove={removeFromQueue} onClose={() => setShowQueue(false)} />}
      {showLyrics && <LyricsPanel track={currentTrack} lyrics={lyrics} onClose={() => setShowLyrics(false)} />}
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

      <div id="yt-player" style={{
        position: 'fixed', left: playMode === 'video' ? 'auto' : '1px',
        bottom: playMode === 'video' ? '90px' : '1px',
        right: playMode === 'video' ? '10px' : 'auto',
        zIndex: playMode === 'video' ? 100 : 1,
        width: playMode === 'video' ? '360px' : '1px',
        height: playMode === 'video' ? '203px' : '1px',
        opacity: playMode === 'video' ? 1 : 0.01,
        pointerEvents: playMode === 'video' ? 'auto' : 'none',
        transition: 'all 0.3s ease'
      }} />
    </div>
  );
}

function AuthModal({ onLogin, onRegister, onClose, onLogout, user }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!username.trim() || !password.trim()) { setError('Fill all fields'); return; }
    const fn = mode === 'login' ? onLogin : onRegister;
    const ok = await fn(username.trim(), password);
    if (!ok) setError(mode === 'login' ? 'Invalid credentials' : 'Username taken');
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
            </div>
            <button className="btn-secondary" onClick={onLogout}>Sign Out</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn-primary">{mode === 'login' ? 'Sign In' : 'Register'}</button>
            <button type="button" className="btn-secondary" onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Create account' : 'Already have an account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;