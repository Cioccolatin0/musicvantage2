import React, { useState, useRef, useEffect, useCallback } from 'react';
import { search, prefetchStreamUrls, getLyrics } from './api';
import { formatDuration } from './utils';
import Sidebar from './Sidebar';
import PlayerBar from './PlayerBar';
import QueuePanel from './QueuePanel';
import LyricsPanel from './LyricsPanel';
import PlaylistsPanel from './PlaylistsPanel';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import ImportPlaylist from './ImportPlaylist';
import { IconSearch, IconAdmin, IconImport } from './Icons';

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

  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const progressRef = useRef(null);
  const streamCache = useRef({});
  const startedRef = useRef(false);
  const repeatRef = useRef('off');
  const playNextRef = useRef(() => {});

  const doSearch = useCallback(async (q, f) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setActiveView('home');
    try {
      const res = await search(q, f);
      setResults(res);
      const allIds = [...(res.tracks || []), ...(res.albums || [])].map(t => t.id).filter(Boolean);
      if (allIds.length) prefetchStreamUrls(allIds);
    } catch (e) {
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    doSearch(query, filter);
  };

  const getShuffledIndex = useCallback((currentIdx, arrLength) => {
    if (arrLength <= 1) return -1;
    let next;
    do { next = Math.floor(Math.random() * arrLength); } while (next === currentIdx);
    return next;
  }, []);

  const getNextTrack = useCallback(() => {
    if (!queue.length || !currentTrack) return null;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (shuffle) {
      const nextIdx = getShuffledIndex(idx, queue.length);
      return nextIdx >= 0 ? queue[nextIdx] : null;
    }
    if (idx >= 0 && idx < queue.length - 1) return queue[idx + 1];
    if (repeat === 'all' && idx >= 0) return queue[0];
    return null;
  }, [queue, currentTrack, shuffle, repeat, getShuffledIndex]);

  const preloadNextStream = useCallback(() => {
    const next = getNextTrack();
    if (next && !streamCache.current[next.id]) {
      getStreamUrl(next.id).then(url => { if (url) streamCache.current[next.id] = url; }).catch(() => {});
    }
  }, [getNextTrack]);

  const playTrack = useCallback((track, trackList) => {
    if (trackList) setQueue(trackList);
    if (ytPlayerRef.current && currentTrack?.id === track.id) {
      try { ytPlayerRef.current.seekTo(0); ytPlayerRef.current.playVideo(); } catch {}
      return;
    }
    setCurrentTrack(track);
    setLoadingTrack(track.id);
    setPlaying(false);
    setLoadingStream(true);
    setStreamError(false);
    setCurrentTime(0);
    setDuration(0);
    setLyrics(null);
    setLiked(false);
  }, [currentTrack?.id]);

  const retryStream = useCallback(() => {
    if (!currentTrack || !ytPlayerRef.current) return;
    setStreamError(false);
    setLoadingStream(true);
    try {
      ytPlayerRef.current.loadVideoById(currentTrack.id);
    } catch {
      setLoadingStream(false);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (playing) preloadNextStream();
  }, [playing, currentTrack?.id, preloadNextStream]);

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYoutubeReady(true);
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(tag, first);
    window.onYouTubeIframeAPIReady = () => setYoutubeReady(true);
    return () => { window.onYouTubeIframeAPIReady = null; };
  }, []);

  useEffect(() => {
    if (!youtubeReady || !currentTrack) return;
    setLoadingStream(true);
    setStreamError(false);
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch {}
      ytPlayerRef.current = null;
    }
    setTimeout(() => {
      try {
        ytPlayerRef.current = new YT.Player('yt-player', {
          videoId: currentTrack.id,
          height: '240',
          width: '100%',
          playerVars: {
            autoplay: 1, modestbranding: 1, rel: 0,
            controls: 0, playsinline: 1, fs: 0,
          },
          events: {
            onReady: (e) => { e.target.playVideo(); },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) {
                setPlaying(true);
                setLoadingStream(false);
                setLoadingTrack(null);
                setStreamError(false);
              } else if (e.data === YT.PlayerState.PAUSED) {
                setPlaying(false);
              } else if (e.data === YT.PlayerState.ENDED) {
                setPlaying(false);
                if (repeatRef.current === 'one') {
                  try { e.target.seekTo(0); e.target.playVideo(); } catch {}
                } else {
                  playNextRef.current();
                }
              } else if (e.data === YT.PlayerState.CUED) {
                setLoadingStream(false);
              }
            },
            onError: () => {
              setLoadingStream(false);
              setLoadingTrack(null);
              setStreamError(true);
            }
          }
        });
      } catch {
        setLoadingStream(false);
        setLoadingTrack(null);
        setStreamError(true);
      }
    }, 100);
  }, [currentTrack?.id, youtubeReady]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      try {
        const p = ytPlayerRef.current;
        if (p && p.getCurrentTime) {
          setCurrentTime(p.getCurrentTime() || 0);
          setDuration(p.getDuration() || 0);
        }
      } catch {}
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
    try {
      if (playing) { p.pauseVideo(); }
      else { p.playVideo(); }
    } catch {}
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

  const handleTimeUpdate = () => {};
  const handleEnded = () => {};
  const handleAudioError = () => {};

  const handleProgressClick = (e) => {
    const p = ytPlayerRef.current;
    const bar = progressRef.current;
    if (!p || !bar) return;
    try {
      const rect = bar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const d = p.getDuration() || 0;
      p.seekTo(pct * d, true);
    } catch {}
  };

  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { playNextRef.current = playNext; }, [playNext]);

  useEffect(() => {
    try { if (ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(volume * 100); } catch {}
  }, [volume]);

  const toggleShuffle = () => setShuffle(s => !s);
  const toggleRepeat = () => {
    setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');
  };

  const removeFromQueue = (idx) => {
    setQueue(q => q.filter((_, i) => i !== idx));
  };

  const handleNavigate = (view) => {
    setActiveView(view);
  };

  const createPlaylist = (name) => {
    setPlaylists(pl => [...pl, { name, tracks: [] }]);
  };

  const addToPlaylist = (playlistIdx) => {
    if (!currentTrack) return;
    setPlaylists(pl => pl.map((p, i) =>
      i === playlistIdx ? { ...p, tracks: [...p.tracks, currentTrack] } : p
    ));
    setShowPlaylists(false);
  };

  const tracks = results?.tracks || [];
  const albums = results?.albums || [];
  const artists = results?.artists || [];

  return (
    <div className="app">
      <Sidebar activeView={activeView} onNavigate={handleNavigate} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

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
        </header>

        <main className="content">
          {activeView === 'playlists' && (
            <div className="playlists-view">
              <div className="section-header">
                <h2>Your Playlists</h2>
              </div>
              {playlists.length === 0 ? (
                <p className="panel-empty">No playlists yet</p>
              ) : (
                <div className="playlists-grid">
                  {playlists.map((pl, i) => (
                    <div key={i} className="playlist-card" onClick={() => playTrack(pl.tracks[0], pl.tracks)}>
                      <div className="playlist-card-img">
                        {pl.tracks[0] ? <img src={pl.tracks[0].thumbnail} alt="" /> : <div className="playlist-placeholder" />}
                      </div>
                      <div className="playlist-card-body">
                        <h4>{pl.name}</h4>
                        <p>{pl.tracks.length} tracks</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === 'queue' && (
            <div className="tab-view">
              <div className="section-header">
                <h2>Queue {queue.length > 0 && `(${queue.length})`}</h2>
              </div>
              {queue.length === 0 ? (
                <p className="panel-empty">Queue is empty</p>
              ) : (
                <div className="track-list">
                  {queue.map((t, i) => (
                    <div
                      key={`${t.id}-${i}`}
                      className={`track-item ${currentTrack?.id === t.id ? 'active' : ''}`}
                      onClick={() => playTrack(t, queue)}
                    >
                      <span className="track-num">{i + 1}</span>
                      <img src={t.thumbnail} alt={t.title} loading="lazy" />
                      <div className="track-info">
                        <h4>{t.title}</h4>
                        <p>{t.artist}</p>
                      </div>
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
              <div className="section-header">
                <h2>Lyrics</h2>
              </div>
              {currentTrack ? (
                <div className="lyrics-content">
                  <div className="lyrics-track-info">
                    <img src={currentTrack.thumbnail} alt={currentTrack.title} />
                    <div>
                      <h3>{currentTrack.title}</h3>
                      <p>{currentTrack.artist}</p>
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
          )}

          {activeView === 'admin' && !adminLoggedIn && (
            <AdminLogin onLogin={() => setAdminLoggedIn(true)} />
          )}

          {activeView === 'admin' && adminLoggedIn && (
            <AdminDashboard onLogout={() => setAdminLoggedIn(false)} />
          )}

          {activeView === 'import' && (
            <ImportPlaylist onPlayTrack={playTrack} />
          )}

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
                            <div className="card-body">
                              <h4>{a.title}</h4>
                              <p>Artist</p>
                            </div>
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
                            <div className="card-body">
                              <h4>{a.title}</h4>
                              <p>{a.artist}</p>
                            </div>
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
                            <div
                              key={t.id}
                              className={`track-item ${isActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
                              onClick={() => playTrack(t, tracks)}
                            >
                              <span className="track-num">{isLoading ? <div className="spinner sm" /> : isActive && playing ? '♪' : i + 1}</span>
                              <img src={t.thumbnail} alt={t.title} loading="lazy" />
                              <div className="track-info">
                                <h4>{t.title}</h4>
                                <p>{t.artist}</p>
                              </div>
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
                            <div className="card-body">
                              <h4>{a.title}</h4>
                              <p>{a.artist}</p>
                            </div>
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
                            <div className="card-body">
                              <h4>{a.title}</h4>
                              <p>Artist</p>
                            </div>
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

      {showQueue && (
        <QueuePanel queue={queue} currentTrack={currentTrack} onPlayTrack={playTrack} onRemove={removeFromQueue} onClose={() => setShowQueue(false)} />
      )}

      {showLyrics && (
        <LyricsPanel track={currentTrack} lyrics={lyrics} onClose={() => setShowLyrics(false)} />
      )}

      {showPlaylists && (
        <PlaylistsPanel playlists={playlists} currentTrack={currentTrack} onAddToPlaylist={addToPlaylist} onCreatePlaylist={createPlaylist} onPlayTrack={playTrack} onClose={() => setShowPlaylists(false)} />
      )}

      <div id="yt-player" style={{
        position: 'fixed', bottom: playMode === 'video' ? '90px' : '-9999px',
        right: '10px', zIndex: 100,
        width: playMode === 'video' ? '360px' : '320px',
        height: playMode === 'video' ? '203px' : '180px',
        opacity: playMode === 'video' ? 1 : 0,
        pointerEvents: playMode === 'video' ? 'auto' : 'none',
        transition: 'all 0.3s ease'
      }} />
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} onLoadedMetadata={handleTimeUpdate} onError={handleAudioError}
        style={{ display: 'none' }} />
    </div>
  );
}

export default App;
