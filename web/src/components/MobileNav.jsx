import React from 'react';

export default function MobileNav({ activeView, onNavigate, onOpenSearch, notifCount }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'social', label: 'Social', icon: '👥' },
    { id: 'friends', label: 'Friends', icon: '🤝' },
    { id: 'jam', label: 'Jam', icon: '🎧' },
    { id: 'playlists', label: 'Playlists', icon: '📋' },
  ];

  return (
    <nav className="mobile-nav">
      {tabs.map(t => (
        <button key={t.id} className={`mobile-nav-btn ${activeView === t.id ? 'active' : ''}`} onClick={() => onNavigate(t.id)}>
          <span className="mobile-nav-icon">{t.icon}</span>
          <span className="mobile-nav-label">{t.label}</span>
          {t.id === 'social' && notifCount > 0 && <span className="mobile-badge">{notifCount}</span>}
        </button>
      ))}
    </nav>
  );
}