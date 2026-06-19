import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import { search } from './src/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const soundRef = useRef(null);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  const doSearch = useCallback(async (q, f) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await search(q, f);
      setResults(res);
    } catch (e) {
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => doSearch(query, filter);

  const playTrack = useCallback(async (track, trackQueue) => {
    if (trackQueue) setQueue(trackQueue);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
    setCurrentTrack(track);
    setPlaying(false);

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `http://localhost:3001/api/stream/${track.id}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPlaying(status.isPlaying);
          if (status.didJustFinish) {
            const idx = trackQueue ? trackQueue.findIndex(t => t.id === track.id) : -1;
            if (idx >= 0 && idx < trackQueue.length - 1) {
              playTrack(trackQueue[idx + 1], trackQueue);
            }
          }
        }
      });
    } catch (e) {
      console.error('Play error:', e);
    }
  }, []);

  const togglePlay = async () => {
    if (!soundRef.current) return;
    if (playing) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const playNext = () => {
    if (!queue.length || !currentTrack) return;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (idx >= 0 && idx < queue.length - 1) {
      playTrack(queue[idx + 1], queue);
    }
  };

  const playPrev = () => {
    if (!queue.length || !currentTrack) return;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (idx > 0) {
      playTrack(queue[idx - 1], queue);
    }
  };

  const tracks = results?.tracks || [];
  const albums = results?.albums || [];
  const artists = results?.artists || [];

  const renderTrack = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.trackItem, currentTrack?.id === item.id && styles.trackActive]}
      onPress={() => playTrack(item, tracks)}
    >
      <Text style={styles.trackNum}>{index + 1}</Text>
      <Image source={{ uri: item.thumbnail }} style={styles.trackImg} />
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <Text style={styles.trackDuration}>{formatDuration(item.duration)}</Text>
    </TouchableOpacity>
  );

  const renderCard = (item, type) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.card, type === 'artist' && styles.cardArtist]}
      onPress={() => { setQuery(item.title); doSearch(item.title, type === 'album' ? 'track' : 'all'); }}
    >
      <Image
        source={{ uri: item.thumbnail }}
        style={[styles.cardImg, type === 'artist' && styles.cardImgRound]}
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardSub}>{type === 'artist' ? 'Artist' : item.artist}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <View style={styles.header}>
        <Text style={styles.logo}>Soundusic</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Search songs, albums, artists..."
            placeholderTextColor="#727272"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {!results && !loading && !error && (
          <View style={styles.hero}>
            <Text style={styles.heroIcon}>🎵</Text>
            <Text style={styles.heroTitle}>Listen to any song, anytime</Text>
            <Text style={styles.heroSub}>Search millions of tracks</Text>
          </View>
        )}

        {loading && <ActivityIndicator size="large" color="#1db954" style={{ marginTop: 40 }} />}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {results && !loading && (
          <>
            {filter === 'all' && (
              <View style={styles.filterRow}>
                <Text style={styles.sectionTitle}>Results for "{query}"</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['all', 'track', 'album', 'artist'].map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                      onPress={() => setFilter(f)}
                    >
                      <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                        {f === 'all' ? 'All' : f === 'track' ? 'Songs' : f === 'album' ? 'Albums' : 'Artists'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {filter === 'all' && artists.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Artists</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {artists.map(a => renderCard(a, 'artist'))}
                </ScrollView>
              </View>
            )}

            {filter === 'all' && albums.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Albums</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {albums.map(a => renderCard(a, 'album'))}
                </ScrollView>
              </View>
            )}

            {(filter === 'all' || filter === 'track') && tracks.length > 0 && (
              <View style={styles.section}>
                {filter === 'all' && <Text style={styles.sectionTitle}>Songs</Text>}
                <FlatList
                  data={tracks}
                  renderItem={renderTrack}
                  keyExtractor={item => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {filter === 'album' && albums.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Albums</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {albums.map(a => renderCard(a, 'album'))}
                </ScrollView>
              </View>
            )}

            {filter === 'artist' && artists.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Artists</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {artists.map(a => renderCard(a, 'artist'))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {currentTrack && (
        <View style={styles.player}>
          <Image source={{ uri: currentTrack.thumbnail }} style={styles.playerImg} />
          <View style={styles.playerInfo}>
            <Text style={styles.playerTitle} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={styles.playerArtist} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>
          <TouchableOpacity onPress={playPrev} style={styles.playerBtn}>
            <Text style={styles.playerBtnText}>⏮</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
            <Text style={styles.playBtnText}>{playing ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={playNext} style={styles.playerBtn}>
            <Text style={styles.playerBtnText}>⏭</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  logo: { fontSize: 24, fontWeight: '700', color: '#1db954', marginBottom: 4 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchBtn: { backgroundColor: '#1db954', borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#000', fontWeight: '600', fontSize: 14 },
  content: { flex: 1 },
  contentInner: { paddingBottom: 100 },
  hero: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  heroIcon: { fontSize: 64, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4, color: '#fff' },
  heroSub: { fontSize: 14, color: '#b3b3b3' },
  error: { color: '#ff4444', textAlign: 'center', marginTop: 20 },
  filterRow: { marginBottom: 12, paddingHorizontal: 16 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1e1e1e', marginRight: 6 },
  filterBtnActive: { backgroundColor: '#1db954' },
  filterBtnText: { fontSize: 13, color: '#b3b3b3', fontWeight: '500' },
  filterBtnTextActive: { color: '#000' },
  section: { marginBottom: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12, color: '#fff' },
  card: { width: 150, marginRight: 10, backgroundColor: '#141414', borderRadius: 12, overflow: 'hidden' },
  cardArtist: { width: 130, alignItems: 'center' },
  cardImg: { width: '100%', aspectRatio: 1 },
  cardImgRound: { borderRadius: 75, width: 120, height: 120, marginTop: 10 },
  cardBody: { padding: 8 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#fff' },
  cardSub: { fontSize: 11, color: '#b3b3b3', marginTop: 2 },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  trackActive: { backgroundColor: '#1e1e1e' },
  trackNum: { width: 24, textAlign: 'center', color: '#727272', fontSize: 13 },
  trackImg: { width: 44, height: 44, borderRadius: 4, marginHorizontal: 10 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 14, fontWeight: '500', color: '#fff' },
  trackArtist: { fontSize: 12, color: '#b3b3b3' },
  trackDuration: { fontSize: 12, color: '#727272' },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    paddingBottom: 24,
  },
  playerImg: { width: 36, height: 36, borderRadius: 4 },
  playerInfo: { flex: 1, marginHorizontal: 10 },
  playerTitle: { fontSize: 13, fontWeight: '500', color: '#fff' },
  playerArtist: { fontSize: 11, color: '#b3b3b3' },
  playerBtn: { padding: 8 },
  playerBtnText: { fontSize: 18, color: '#fff' },
  playBtn: {
    backgroundColor: '#1db954',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  playBtnText: { fontSize: 16, color: '#000' },
});
