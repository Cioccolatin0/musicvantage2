import React from 'react';
import { IconSearch, IconLibrary, IconChat, IconPlaylist } from '../Icons';

const iconMap = { search: IconSearch, library: IconLibrary, chat: IconChat, playlists: IconPlaylist };

export default function MobileNav({ activeView, onNavigate, onOpenSearch, notifCount }) {
  const tabs = [
    { id: 'search', label: 'Cerca' },
    { id: 'library', label: 'Libreria' },
    { id: 'chat', label: 'Chat' },
    { id: 'playlists', label: 'Playlists' },
  ];

  return (
    <nav className="mobile-nav">
      {tabs.map(t => {
        const Icon = iconMap[t.id];
        return (
          <button key={t.id} className={`mobile-nav-btn ${activeView === t.id ? 'active' : ''}`} onClick={() => {
            if (t.id === 'search') {
              onOpenSearch && onOpenSearch();
            } else {
              onNavigate(t.id);
            }
          }}>
            <span className="mobile-nav-icon">{Icon && <Icon size={20} />}</span>
            <span className="mobile-nav-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}