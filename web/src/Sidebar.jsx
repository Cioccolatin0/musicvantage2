import React from 'react';
import { IconHome, IconSearch, IconPlaylist, IconQueue, IconLyrics, IconImport, IconAdmin } from './Icons';

const navItems = [
  { id: 'home', label: 'Home', icon: IconHome },
  { id: 'playlists', label: 'Playlists', icon: IconPlaylist },
  { id: 'queue', label: 'Queue', icon: IconQueue },
  { id: 'lyrics', label: 'Lyrics', icon: IconLyrics },
  { id: 'import', label: 'Import', icon: IconImport },
];

const bottomItems = [
  { id: 'admin', label: 'Admin', icon: IconAdmin },
];

export default function Sidebar({ activeView, onNavigate, collapsed, onToggle }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h1 className="logo">S</h1>
        {!collapsed && <span className="logo-text">oundusic</span>}
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon size={22} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <nav className="sidebar-nav sidebar-bottom">
        {bottomItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon size={22} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
