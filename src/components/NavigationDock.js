'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AuctionMenuModals from '@/components/AuctionMenuModals';
import BidRulesModal from '@/components/BidRulesModal';

export default function NavigationDock({
  activeScreen,
  onScreenChange,
  onFullscreen,
  tournament,
  onRefresh,
  onDrawPlayer,
  onDrawJodi,
  onSelectTeamBid,
}) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'banner' | 'booster' | 'penalty' | 'jodi' | 'fortune' | 'tie' | 'overlay' | 'help' | null
  const [theme, setTheme] = useState('dark');
  const menuRef = useRef(null);
  const hamburgerRef = useRef(null);

  // Synchronize theme state with localStorage & document attribute
  useEffect(() => {
    const saved = localStorage.getItem('player_auction_theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('player_auction_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const screens = [
    { key: 'A', label: 'A', title: 'Auction Arena' },
    { key: 'S', label: 'S', title: 'Team Summary' },
    { key: 'P', label: 'P', title: 'Player Directory' },
    { key: 'C', label: 'C', title: 'Category Switcher' },
    { key: 'M', label: 'M', title: 'Admin Controls' },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(e.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMenuItemClick = async (action) => {
    setIsMenuOpen(false);

    switch (action) {
      case 'Theme':
      case 'Toggle Theme':
        toggleTheme();
        break;
      case 'Home':
        router.push('/');
        break;
      case 'Dashboard':
        router.push('/dashboard');
        break;
      case 'Banner':
        setActiveModal('banner');
        break;
      case 'Booster':
        setActiveModal('booster');
        break;
      case 'Penalty':
        setActiveModal('penalty');
        break;
      case 'Jodi':
        setActiveModal('jodi');
        break;
      case 'Fortune Wheel':
        setActiveModal('fortune');
        break;
      case 'Match Tie':
        setActiveModal('tie');
        break;
      case 'Bid Rules':
        setActiveModal('bidRules');
        break;
      case 'Overlay Link':
        setActiveModal('overlay');
        break;
      case 'Help':
        setActiveModal('help');
        break;
      case 'Logout':
        try {
          await fetch('/api/auth/login', { method: 'DELETE' });
        } catch (e) {
          console.error(e);
        }
        router.push('/');
        break;
      default:
        break;
    }
  };

  const menuItems = [
    'Home',
    'Dashboard',
    'Banner',
    'Bid Rules',
    'Booster',
    'Penalty',
    'Jodi',
    'Fortune Wheel',
    'Match Tie',
    'Overlay Link',
    'Help',
    'Logout',
  ];

  return (
    <>
      <nav className="nav-dock">
        {/* Screens: A, S, P, C, M */}
        {screens.map((s) => (
          <button
            key={s.key}
            className={`nav-dock__btn ${activeScreen === s.key ? 'active' : ''}`}
            onClick={() => {
              setIsMenuOpen(false);
              onScreenChange(s.key);
            }}
            title={s.title}
          >
            {s.label}
          </button>
        ))}

        {/* F (Fullscreen) */}
        <button
          className="nav-dock__btn"
          onClick={() => {
            setIsMenuOpen(false);
            if (onFullscreen) onFullscreen();
          }}
          title="Fullscreen (F)"
        >
          F
        </button>

        {/* ☰ (Hamburger Button) */}
        <button
          ref={hamburgerRef}
          className={`nav-dock__btn hamburger ${isMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          title="Menu Options"
        >
          ≡
        </button>

        {/* Reference 11-Item Menu popup directly above ≡ */}
        {isMenuOpen && (
          <div ref={menuRef} className="nav-dock__menu">
            {/* Theme Toggle in Menu */}
            <div
              className="nav-dock__theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
            >
              <div className="nav-dock__theme-toggle-left">
                <span className="nav-dock__theme-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span className="nav-dock__theme-text">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>
              <div className={`nav-dock__theme-switch ${theme}`}>
                <span className="nav-dock__theme-knob" />
              </div>
            </div>

            <div className="nav-dock__menu-divider" />

            {menuItems.map((item) => (
              <button
                key={item}
                className="nav-dock__menu-item"
                onClick={() => handleMenuItemClick(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Modals for Banner, Booster, Penalty, Jodi, Fortune Wheel, Match Tie, Overlay Link, Help */}
      <AuctionMenuModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        tournament={tournament}
        onRefresh={onRefresh}
        onDrawPlayer={onDrawPlayer}
        onDrawJodi={onDrawJodi}
        onSelectTeamBid={onSelectTeamBid}
      />

      {/* Bid Increment Rules Modal */}
      <BidRulesModal
        isOpen={activeModal === 'bidRules'}
        onClose={() => setActiveModal(null)}
        tournament={tournament}
        onRefresh={onRefresh}
      />
    </>
  );
}
