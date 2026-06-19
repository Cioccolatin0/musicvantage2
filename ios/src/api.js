import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getBaseUrl() {
  if (__DEV__) {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
    if (Platform.OS === 'ios') {
      const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
      return `http://${host}:3001`;
    }
    return 'http://localhost:3001';
  }
  return 'http://localhost:3001';
}

const BASE = getBaseUrl();

export async function search(query, type = 'all') {
  const res = await fetch(`${BASE}/api/search?q=${encodeURIComponent(query)}&type=${type}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export function getStreamUrl(id) {
  return `${BASE}/api/stream/${id}`;
}

export { BASE };
