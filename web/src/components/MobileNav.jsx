import React from 'react';
import { IconHome, IconChat, IconFriends, IconJam, IconPlaylist } from '../Icons';

const iconMap = { home: IconHome, social: IconChat, friends: IconFriends, jam: IconJam, playlists: IconPlaylist };

export default function MobileNav({ activeView, onNavigate, onOpenSearch, notifCount }) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'social', label: 'Social' },
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
            {t.id === 'social' && notifCount > 0 && <span className="mobile-badge">{notifCount}</span>}
          </button>
        );
      })}
    </nav>
  );
}