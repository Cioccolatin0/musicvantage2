import React from 'react';
import { IconHome, IconFriends, IconJam, IconPlaylist, IconDownload } from '../Icons';

const iconMap = { home: IconHome, downloads: IconDownload, friends: IconFriends, jam: IconJam, playlists: IconPlaylist };

export default function MobileNav({ activeView, onNavigate, onOpenSearch, notifCount }) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'downloads', label: 'Downloads' },
    { id: 'friends', label: 'Friends' },
    { id: 'jam', label: 'Jam' },
    { id: 'playlists', label: 'Playlists' },
  ];

  return (
    <nav className="mobile-nav">
      {tabs.map(t => {
        const Icon = iconMap[t.id];
        return (
          <button key={t.id} className={`mobile-nav-btn ${activeView === t.id ? 'active' : ''}`} onClick={() => onNavigate(t.id)}>
            <span className="mobile-nav-icon">{Icon && <Icon size={20} />}</span>
            <span className="mobile-nav-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}