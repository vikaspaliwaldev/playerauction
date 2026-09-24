'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AuctionArenaLogo from '@/components/AuctionArenaLogo';

const SPORTS_LIST = [
  { id: 'all', label: 'ALL SPORTS', icon: '🏆' },
  { id: 'cricket', label: 'CRICKET', icon: '🏏' },
  { id: 'football', label: 'FOOTBALL', icon: '⚽' },
  { id: 'volleyball', label: 'VOLLEYBALL', icon: '🏐' },
  { id: 'badminton', label: 'BADMINTON', icon: '🏸' },
  { id: 'kabaddi', label: 'KABADDI', icon: '🤼' },
  { id: 'basketball', label: 'BASKETBALL', icon: '🏀' },
  { id: 'tennis', label: 'TENNIS', icon: '🎾' },
  { id: 'chess', label: 'CHESS', icon: '♟️' },
  { id: 'carrom', label: 'CARROM', icon: '🎯' },
];

export default function LandingPage() {
  // Theme state
  const [theme, setTheme] = useState('dark');

  // Drawer state for mobile
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');
  const searchInputRef = useRef(null);

  // Live Tournaments from database API
  const [tournaments, setTournaments] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  // Sync theme
  useEffect(() => {
    const saved = localStorage.getItem('player_auction_theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('player_auction_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // ⌘K focus shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch live public tournaments from API
  useEffect(() => {
    const fetchPublicTournaments = async () => {
      try {
        setLoadingTournaments(true);
        const res = await fetch('/api/tournaments/public');
        if (res.ok) {
          const data = await res.json();
          setTournaments(data.tournaments || []);
        }
      } catch (err) {
        console.error('Failed to load public tournaments:', err);
      } finally {
        setLoadingTournaments(false);
      }
    };

    fetchPublicTournaments();
  }, []);

  // Filter logic
  const filteredTournaments = tournaments.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      t.name.toLowerCase().includes(query) ||
      (t.sportType && t.sportType.toLowerCase().includes(query));

    const matchesSport =
      selectedSport === 'all' ||
      (t.sportType && t.sportType.toLowerCase() === selectedSport.toLowerCase());

    return matchesSearch && matchesSport;
  });



  return (
    <div className="arena-landing-layout">
      {/* Background Stadium Glow & Grid Pattern */}
      <div className="arena-bg-grid" />
      <div className="arena-glow-orb orb-1" />
      <div className="arena-glow-orb orb-2" />

      {/* TOP FIXED HEADER */}
      <header className="arena-header">
        <div className="arena-header__inner">
          <div className="arena-header__left">
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="arena-menu-btn"
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined icon-24">
                {drawerOpen ? 'close' : 'menu'}
              </span>
            </button>

            <Link href="/" className="arena-header__logo-link">
              <AuctionArenaLogo size="normal" />
            </Link>

            <div className="arena-live-tag">
              <span className="pulse-dot" />
              <span>LIVE</span>
            </div>
          </div>

          <nav className="arena-desktop-nav">
            <a href="#live-auctions" className="arena-nav-link active">
              Live Auctions
            </a>
            <a href="#features" className="arena-nav-link">
              Features
            </a>
            <a href="#how-it-works" className="arena-nav-link">
              How It Works
            </a>
          </nav>

          <div className="arena-header__actions">
            <a href="#live-auctions" className="btn-watch-chip-desktop">
              <span className="material-symbols-outlined icon-18">live_tv</span>
              <span>Watch Live</span>
            </a>

            <button
              onClick={toggleTheme}
              className="arena-theme-toggle"
              title="Toggle dark/light theme"
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined icon-18">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <Link href="/login" className="btn-portal-action">
              <span className="material-symbols-outlined icon-18">admin_panel_settings</span>
              <span>Host Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {drawerOpen && (
        <div className="arena-mobile-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <aside
            className="arena-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <AuctionArenaLogo size="small" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="drawer-close-btn"
              >
                ✕
              </button>
            </div>

            <nav className="drawer-nav">
              <a
                href="#live-auctions"
                onClick={() => setDrawerOpen(false)}
                className="drawer-link"
              >
                <span className="material-symbols-outlined icon-20">podium</span>
                <span>Live Auctions</span>
              </a>
              <a
                href="#simulator"
                onClick={() => setDrawerOpen(false)}
                className="drawer-link"
              >
                <span className="material-symbols-outlined icon-20">speed</span>
                <span>Interactive Demo</span>
              </a>
              <a
                href="#features"
                onClick={() => setDrawerOpen(false)}
                className="drawer-link"
              >
                <span className="material-symbols-outlined icon-20">bolt</span>
                <span>Features</span>
              </a>
              <a
                href="#how-it-works"
                onClick={() => setDrawerOpen(false)}
                className="drawer-link"
              >
                <span className="material-symbols-outlined icon-20">help_outline</span>
                <span>How It Works</span>
              </a>
              <a
                href="#sponsors"
                onClick={() => setDrawerOpen(false)}
                className="drawer-link"
              >
                <span className="material-symbols-outlined icon-20">token</span>
                <span>Sponsor Hub</span>
              </a>
            </nav>

            <div className="drawer-footer">
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                className="btn-drawer-portal"
              >
                <span className="material-symbols-outlined icon-18">admin_panel_settings</span>
                <span>Host Portal Login</span>
              </Link>
              <div className="drawer-meta-status">
                <span className="status-indicator">
                  <span className="status-dot green" />
                  <span>BROADCAST READY</span>
                </span>
                <span>v3.4.0</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT CONTAINER */}
      <main className="arena-main-content">
        {/* 1. HERO SECTION — Split: Info Left, Live Auctions Right */}
        <section className="arena-hero-section">
          <div className="arena-container">
            <div className="hero-grid" style={{ gridTemplateColumns: '1fr', gap: '40px' }}>
              {/* Desktop: 2 columns */}
              <div className="hero-split-row">
                {/* Left Column: Headlines & CTAs */}
                <div className="hero-text-col" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
                  <div className="hero-live-badge">
                    <span className="live-ping-dot">
                      <span className="ping-animate" />
                      <span className="ping-center" />
                    </span>
                    <span className="badge-text">LIVE PLAYER AUCTIONS</span>
                    <span className="badge-divider">·</span>
                    <span className="badge-latency">REAL-TIME 50MS</span>
                  </div>

                  <h1 className="hero-main-title">
                    Run Smarter.<br />
                    <span className="gradient-text">Auction Faster.</span><br />
                    Build Winning Teams.
                  </h1>

                  <p className="hero-description">
                    Everything you need to host professional player auctions — from player registration
                    and team purses to real-time bidding, stadium projector feeds, and broadcast analytics.
                  </p>

                  <div className="hero-cta-buttons">
                    <Link href="/login?tab=register" className="btn-hero-primary">
                      <span className="material-symbols-outlined icon-20">gavel</span>
                      <span>Host an Auction</span>
                    </Link>

                    <a href="#live-auctions" className="btn-hero-secondary">
                      <span className="material-symbols-outlined icon-20">tv</span>
                      <span>Watch Live Auctions</span>
                    </a>
                  </div>

                  <div className="hero-trust-note">
                    <span className="material-symbols-outlined icon-16 tertiary-color">verified</span>
                    <span>No account required to watch live broadcasts</span>
                  </div>
                </div>

                {/* Right Column: Compact Live Auctions Feed */}
                <div className="hero-live-feed-col">
                  <div className="hero-feed-header">
                    <span className="pulse-dot" />
                    <span className="hero-feed-title">LIVE AUCTIONS</span>
                    <span className="hero-feed-count">{filteredTournaments.length}</span>
                  </div>

                  {loadingTournaments ? (
                    <div className="hero-feed-loading">
                      <div className="spinner-large" />
                      <p>Loading...</p>
                    </div>
                  ) : filteredTournaments.length === 0 ? (
                    <div className="hero-feed-empty">
                      <span style={{ fontSize: '2rem' }}>🏆</span>
                      <p>No live tournaments right now</p>
                      <Link href="/login?tab=register" className="btn-hero-primary" style={{ fontSize: '0.8rem', padding: '8px 16px', height: 'auto' }}>
                        Host One Now
                      </Link>
                    </div>
                  ) : (
                    <div className="hero-feed-list">
                      {filteredTournaments.slice(0, 5).map((t) => (
                        <Link
                          key={t.id}
                          href={`/live/${t.id}`}
                          className="hero-feed-card"
                        >
                          <div className="hero-feed-card__top">
                            <span className="live-now-badge" style={{ fontSize: '0.6rem', padding: '2px 8px' }}>
                              <span className="pulse-mini" /> LIVE
                            </span>
                            <span className="sport-type-badge" style={{ fontSize: '0.6rem', padding: '2px 8px' }}>
                              {(t.sportType || 'CRICKET').toUpperCase()}
                            </span>
                          </div>
                          <h4 className="hero-feed-card__title">{t.name}</h4>
                          <div className="hero-feed-card__stats">
                            <span>{t.teamsCount} Teams</span>
                            <span>·</span>
                            <span>{t.soldCount}/{t.playersCount} Sold</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SEARCH & SPORTS FILTER CHIPS */}
        <section className="arena-search-section">
          <div className="arena-container">
            <div className="search-bar-wrapper">
              <span className="material-symbols-outlined search-icon">search</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tournaments, teams, or players..."
                className="search-input"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="search-clear-btn"
                  title="Clear search"
                >
                  ✕
                </button>
              ) : (
                <kbd className="search-cmd-kbd">⌘K</kbd>
              )}
            </div>

            {/* Horizontally Scrollable Sports Chips */}
            <div className="sports-chips-carousel">
              {SPORTS_LIST.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSport(sport.id)}
                  className={`sport-chip-item ${selectedSport === sport.id ? 'active' : ''}`}
                >
                  <span className="chip-icon">{sport.icon}</span>
                  <span className="chip-label">{sport.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 3. LIVE AUCTIONS HAPPENING NOW */}
        <section id="live-auctions" className="arena-tournaments-section">
          <div className="arena-container">
            <div className="section-title-bar">
              <div>
                <div className="transmission-status">
                  <span className="ping-dot-red" />
                  <span>TRANSMISSION ACTIVE</span>
                </div>
                <h2 className="section-headline">Live Auctions Happening Now</h2>
                <p className="section-caption">
                  Jump into a live player auction and follow every bid in real time with zero account creation.
                </p>
              </div>

              <span className="view-count-badge">
                {filteredTournaments.length} TOURNAMENT{filteredTournaments.length !== 1 ? 'S' : ''}
              </span>
            </div>

            {loadingTournaments ? (
              <div className="tournaments-loading-box">
                <div className="spinner-large" />
                <p>Loading real-time public auctions...</p>
              </div>
            ) : filteredTournaments.length === 0 ? (
              <div className="tournaments-empty-box">
                <div className="empty-trophy-icon">🏆</div>
                <h3>No Matching Tournaments Found</h3>
                <p>
                  {searchQuery || selectedSport !== 'all'
                    ? 'No tournaments match your current search or sport category filter.'
                    : 'No public tournaments are live right now. Host your own tournament in minutes!'}
                </p>
                <Link href="/login?tab=register" className="btn-hero-primary" style={{ marginTop: 16 }}>
                  Host a Tournament
                </Link>
              </div>
            ) : (
              <div className="arena-cards-grid">
                {filteredTournaments.map((t) => (
                  <div key={t.id} className="tournament-broadcast-card">
                    <div className="card-top-row">
                      <div className="card-tags">
                        <span className="live-now-badge">
                          <span className="pulse-mini" /> LIVE NOW
                        </span>
                        <span className="sport-type-badge">
                          {(t.sportType || 'CRICKET').toUpperCase()}
                        </span>
                      </div>
                      <div className="sensors-icon-box">
                        <span className="material-symbols-outlined icon-20">sensors</span>
                      </div>
                    </div>

                    <div className="card-body">
                      <h3 className="tournament-card-title">{t.name}</h3>
                      <div className="tournament-location-row">
                        <span className="material-symbols-outlined icon-16">stadium</span>
                        <span>Premier Sports Arena</span>
                      </div>
                    </div>

                    {/* Telemetry Grid */}
                    <div className="telemetry-stat-grid">
                      <div className="telemetry-stat-col">
                        <span className="telemetry-label">TEAMS</span>
                        <span className="telemetry-val">{t.teamsCount || 0}</span>
                      </div>
                      <div className="telemetry-stat-col">
                        <span className="telemetry-label">PLAYERS</span>
                        <span className="telemetry-val">{t.playersCount || 0}</span>
                      </div>
                      <div className="telemetry-stat-col">
                        <span className="telemetry-label">SOLD</span>
                        <span className="telemetry-val tertiary-color">{t.soldCount || 0}</span>
                      </div>
                      <div className="telemetry-stat-col">
                        <span className="telemetry-label">LISTS</span>
                        <span className="telemetry-val">{t.categoriesCount || 0}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="card-actions-row">
                      <Link
                        href={`/live/${t.id}`}
                        className="btn-watch-live-card"
                        title="Watch full spectator screen without login"
                      >
                        <span className="material-symbols-outlined icon-18">play_circle</span>
                        <span>Watch Live</span>
                      </Link>

                      <Link
                        href={`/auction/${t.id}`}
                        className="btn-view-hub-card"
                        title="Open Auction Console"
                      >
                        <span>View Hub</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 5. FEATURE HIGHLIGHTS (6 DEDICATED CARDS) */}
        <section id="features" className="arena-features-section">
          <div className="arena-container">
            <div className="section-title-bar text-center">
              <div className="telemetry-chip-violet">
                <span>ENGINEERED FOR SPORTS</span>
                <span className="dot-sep">·</span>
                <span>TOURNAMENT PRO GRADE</span>
              </div>
              <h2 className="section-headline mt-1">Everything You Need to Host Pro Auctions</h2>
              <p className="section-caption">
                Built specifically for intense hall auctions, LED projectors, and live social streams.
              </p>
            </div>

            <div className="features-grid-6">
              {/* Feature 1 */}
              <div className="feature-item-card">
                <div className="feature-icon-box violet">
                  <span className="material-symbols-outlined icon-28">cast</span>
                </div>
                <h3 className="feature-title">Dual Screen Projector Mode</h3>
                <p className="feature-desc">
                  Dedicated audience-facing screen designed for venue projectors, LED walls, and big screen
                  scoreboards with instant synchronized animations.
                </p>
                <div className="feature-mini-mockup">
                  <div className="mockup-line">
                    <span className="material-symbols-outlined icon-16 cyan-color">screenshot_monitor</span>
                    <span>PROJECTOR 4K VIEWPORT</span>
                  </div>
                  <span className="mockup-pill tertiary">ACTIVE OUTPUT</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="feature-item-card">
                <div className="feature-icon-box cyan">
                  <span className="material-symbols-outlined icon-28">videocam</span>
                </div>
                <h3 className="feature-title">OBS Live Streaming HUD</h3>
                <p className="feature-desc">
                  Transparent browser source overlays designed for YouTube and Facebook live broadcasts.
                  Plug-and-play dynamic broadcast lower-thirds.
                </p>
                <div className="feature-mini-mockup">
                  <div className="mockup-line">
                    <span className="live-mini-dot" />
                    <span>OBS URL: /live/[id]?overlay=true</span>
                  </div>
                  <span className="material-symbols-outlined icon-16">content_copy</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="feature-item-card">
                <div className="feature-icon-box emerald">
                  <span className="material-symbols-outlined icon-28">casino</span>
                </div>
                <h3 className="feature-title">Digital Chit Randomizer</h3>
                <p className="feature-desc">
                  Fair automated random draws for dramatic and transparent player selection. Eliminates manual
                  slips with verifiable seed generation.
                </p>
                <div className="feature-mini-mockup centered">
                  <span className="mockup-pill primary">CHIT #19</span>
                  <span className="lottery-spin-text">SPINNING LOTTERY...</span>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="feature-item-card">
                <div className="feature-icon-box violet">
                  <span className="material-symbols-outlined icon-28">rule</span>
                </div>
                <h3 className="feature-title">Category Quotas &amp; Rules</h3>
                <p className="feature-desc">
                  Automatically enforce squad purse limits, minimum bids, mandatory category quotas, and
                  configurable team squad sizes in real-time.
                </p>
                <div className="feature-mini-mockup wrap">
                  <span className="quota-tag">MAX LIST A: 2</span>
                  <span className="quota-tag">MAX LIST B: 2</span>
                  <span className="quota-tag safe">SQUAD: 8/10 SAFE</span>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="feature-item-card">
                <div className="feature-icon-box cyan">
                  <span className="material-symbols-outlined icon-28">token</span>
                </div>
                <h3 className="feature-title">Sponsor Showcase</h3>
                <p className="feature-desc">
                  Give local tournament sponsors premium visibility across auction screens, spectator mobile
                  views, and live broadcast tickers.
                </p>
                <div className="feature-mini-mockup partners">
                  <span>★ APEX SPORTS</span>
                  <span>⚡ PRIME HYDRATION</span>
                  <span>● TITAN GYM</span>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="feature-item-card">
                <div className="feature-icon-box emerald">
                  <span className="material-symbols-outlined icon-28">keyboard</span>
                </div>
                <h3 className="feature-title">Keyboard Turbo Bidding</h3>
                <p className="feature-desc">
                  One-key bidding shortcuts, accidental bid lock protection, and live broadcast audio cues for
                  lightning-fast hall operations.
                </p>
                <div className="feature-mini-mockup space-between">
                  <div className="keys-row">
                    <kbd className="mini-kbd">1</kbd>
                    <kbd className="mini-kbd">2</kbd>
                    <kbd className="mini-kbd">3</kbd>
                    <kbd className="mini-kbd">SPACE = SOLD</kbd>
                  </div>
                  <span className="audio-status">SOUND: ON</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. HOW IT WORKS (4-STEP WORKFLOW) */}
        <section id="how-it-works" className="arena-workflow-section">
          <div className="arena-container">
            <div className="section-title-bar text-center">
              <span className="telemetry-caption-cyan">SIMPLE TOURNAMENT LIFECYCLE</span>
              <h2 className="section-headline mt-1">How It Works</h2>
              <p className="section-caption">From setup to final team rosters in four straightforward steps.</p>
            </div>

            <div className="workflow-steps-grid">
              <div className="step-card">
                <div className="step-number-badge primary">01</div>
                <span className="step-phase primary-text">CREATE</span>
                <h4 className="step-title">Create Tournament</h4>
                <p className="step-desc">
                  Define your sport, team franchises, custom bidding rules, squad purse caps, and minimum player
                  thresholds.
                </p>
              </div>

              <div className="step-card">
                <div className="step-number-badge secondary">02</div>
                <span className="step-phase cyan-text">REGISTER</span>
                <h4 className="step-title">Add Players</h4>
                <p className="step-desc">
                  Let players register online through your custom shareable link or import entire spreadsheets via
                  Excel in one click.
                </p>
              </div>

              <div className="step-card">
                <div className="step-number-badge tertiary">03</div>
                <span className="step-phase emerald-text">AUCTION</span>
                <h4 className="step-title">Start Live Auction</h4>
                <p className="step-desc">
                  Draw players live, log bids through quick-action paddles, project to big screens, and broadcast
                  directly to thousands.
                </p>
              </div>

              <div className="step-card">
                <div className="step-number-badge muted">04</div>
                <span className="step-phase muted-text">BUILD</span>
                <h4 className="step-title">Build Your Squad</h4>
                <p className="step-desc">
                  Complete the auction and generate downloadable team squads, financial purse breakdowns, and player
                  contracts instantly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. DUAL ROLE CONTROL COMPARISON */}
        <section className="arena-roles-section">
          <div className="arena-container">
            <div className="section-title-bar text-center">
              <span className="telemetry-caption-violet">DUAL ROLE CONTROL</span>
              <h2 className="section-headline mt-1">Built for the Fastest Moments</h2>
              <p className="section-caption">
                Every stakeholder gets the razor-sharp cockpit they need to perform under pressure.
              </p>
            </div>

            <div className="roles-grid-2">
              {/* Role 1: Auctioneer Desk */}
              <div className="role-cockpit-card">
                <div className="role-header">
                  <div className="role-title-group">
                    <span className="material-symbols-outlined icon-22 primary-color">gavel</span>
                    <span className="role-title">AUCTIONEER DESK</span>
                  </div>
                  <span className="role-badge primary">MASTER CONSOLE</span>
                </div>

                <div className="cockpit-inner">
                  <div className="cockpit-row-top">
                    <span>ACTIVE LOT: AMIT VERMA (KEEPER)</span>
                    <span className="countdown-red">00:05</span>
                  </div>
                  <div className="cockpit-row-bid">
                    <span className="cockpit-bid-val">₹32,500</span>
                    <span className="cockpit-bidder">BIDDER: MUMBAI ACES</span>
                  </div>

                  <div className="cockpit-actions-grid">
                    <button type="button" className="btn-cockpit sold">
                      <span className="material-symbols-outlined icon-18">verified</span>
                      <span>SOLD (SPACE)</span>
                    </button>
                    <button type="button" className="btn-cockpit unsold">
                      <span className="material-symbols-outlined icon-18">close</span>
                      <span>UNSOLD (U)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Role 2: Team Owner Paddle */}
              <div className="role-cockpit-card">
                <div className="role-header">
                  <div className="role-title-group">
                    <span className="material-symbols-outlined icon-22 cyan-color">account_balance_wallet</span>
                    <span className="role-title">TEAM OWNER PADDLE</span>
                  </div>
                  <span className="role-badge cyan">FRANCHISE SEAT</span>
                </div>

                <div className="cockpit-inner">
                  <div className="cockpit-row-top">
                    <span>REMAINING PURSE</span>
                    <span className="purse-val">₹1,42,000 / ₹2,00,000</span>
                  </div>

                  <div className="purse-bar-track">
                    <div className="purse-bar-fill" style={{ width: '71%' }} />
                  </div>

                  <div className="cockpit-row-sub">
                    <span>SQUAD: 8/10 FILLED</span>
                    <span>MAX SAFE BID: ₹1,12,000</span>
                  </div>

                  <button type="button" className="btn-cockpit raise">
                    <span className="material-symbols-outlined icon-18">touch_app</span>
                    <span>RAISE PADDLE (+₹1,000)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. PUBLIC SPECTATOR EXPERIENCE */}
        <section className="arena-spectator-section">
          <div className="arena-container">
            <div className="section-title-bar text-center">
              <span className="telemetry-caption-emerald">PUBLIC ACCESS LINK</span>
              <h2 className="section-headline mt-1">Anyone Can Watch</h2>
              <p className="section-caption">
                Fans and players open your tournament public link and watch every hammer drop live on any phone.
              </p>
            </div>

            <div className="spectator-mockup-card">
              <div className="mockup-url-bar">
                <span className="material-symbols-outlined icon-14 emerald-color">lock</span>
                <span>auctionarena.app/live/monsoon-cup-2026</span>
              </div>

              <div className="mockup-live-hud">
                <div className="hud-top">
                  <div className="hud-live-tag">
                    <span className="pulse-dot-red" />
                    <span>7PD MONSOON CRICKET AUCTION</span>
                  </div>
                  <span className="hud-viewers">1.4K VIEWERS</span>
                </div>

                <div className="hud-player-row">
                  <div>
                    <span className="hud-player-name">Rahul Sharma</span>
                    <span className="hud-player-sub">All-Rounder · Grade A</span>
                  </div>
                  <div className="hud-bid-col">
                    <span className="hud-bid-lbl">CURRENT BID</span>
                    <span className="hud-bid-num">₹25,000</span>
                  </div>
                </div>
              </div>

              {/* Recently Hammered Stream */}
              <div className="mockup-sold-stream">
                <span className="stream-header-lbl">RECENTLY HAMMERED (SOLD)</span>
                <div className="stream-list">
                  <div className="stream-item">
                    <span className="stream-name">Amit Verma</span>
                    <span className="stream-price">₹18,000</span>
                    <span className="stream-tag">SOLD TITANS</span>
                  </div>
                  <div className="stream-item">
                    <span className="stream-name">Rohit Deshmukh</span>
                    <span className="stream-price">₹15,000</span>
                    <span className="stream-tag">SOLD WARRIORS</span>
                  </div>
                  <div className="stream-item">
                    <span className="stream-name">Suresh K</span>
                    <span className="stream-price">₹12,500</span>
                    <span className="stream-tag">SOLD CHALLENGERS</span>
                  </div>
                </div>
              </div>

              <a href="#live-auctions" className="btn-spectator-cta">
                <span className="material-symbols-outlined icon-18">visibility</span>
                <span>Watch Live Auctions Now</span>
              </a>
              <p className="spectator-guarantee-note">
                No registration. No login. Just open the link and follow.
              </p>
            </div>
          </div>
        </section>

        {/* 10. ORGANIZER FINAL CALL TO ACTION */}
        <section className="arena-final-cta-section">
          <div className="arena-container">
            <div className="final-cta-card">
              <div className="cta-trophy-badge">
                <span className="material-symbols-outlined icon-32">trophy</span>
              </div>
              <span className="telemetry-caption-cyan">READY TO COMMENCE?</span>
              <h2 className="cta-headline">Ready to Host Your Next Auction?</h2>
              <p className="cta-description">
                Create your tournament, invite teams, register players, and run your entire sports auction from one powerful platform.
              </p>

              <div className="cta-buttons-row">
                <Link href="/login?tab=register" className="btn-cta-primary">
                  <span className="material-symbols-outlined icon-20">add_circle</span>
                  <span>Host Auction Now</span>
                </Link>

                <a href="#features" className="btn-cta-secondary">
                  <span>Explore All Features</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="arena-footer">
        <div className="arena-container footer-layout">
          <div className="footer-brand-column">
            <AuctionArenaLogo size="normal" />
            <p className="footer-tagline">
              The premier high-voltage player auction console for sports leagues, college meets, corporate tournaments, and esport arenas.
            </p>
          </div>

          <div className="footer-links-grid">
            <div className="footer-col">
              <span className="footer-heading">PRODUCT</span>
              <a href="#live-auctions">Live Auctions</a>
              <a href="#tournaments">Tournaments</a>
              <Link href="/login">Host Portal</Link>
            </div>

            <div className="footer-col">
              <span className="footer-heading">FEATURES</span>
              <a href="#features">Projector 4K</a>
              <a href="#features">OBS Stream HUD</a>
              <a href="#features">Digital Lottery</a>
              <a href="#features">Turbo Keypad</a>
            </div>

            <div className="footer-col">
              <span className="footer-heading">COMPANY</span>
              <a href="#how-it-works">How It Works</a>
              <Link href="/login">Organizer Login</Link>
              <Link href="/login?tab=register">Register League</Link>
            </div>
          </div>
        </div>

        <div className="arena-container footer-bottom-bar">
          <span>© {new Date().getFullYear()} AUCTIONARENA. ALL RIGHTS RESERVED.</span>
          <div className="footer-status-pill">
            <span className="status-dot green" />
            <span>50MS STADIUM SYNC</span>
          </div>
        </div>
      </footer>

      {/* MOBILE BOTTOM APP NAVIGATION DOCK */}
      <nav className="arena-mobile-bottom-dock">
        <div className="bottom-dock-inner">
          <a href="#live-auctions" className="dock-item active">
            <span className="material-symbols-outlined icon-20">sensors</span>
            <span>AUCTIONS</span>
          </a>
          <a href="#features" className="dock-item">
            <span className="material-symbols-outlined icon-20">bolt</span>
            <span>FEATURES</span>
          </a>
          <a href="#live-auctions" className="dock-btn-watch">
            <span className="material-symbols-outlined icon-18">play_circle</span>
            <span>WATCH</span>
          </a>
          <Link href="/login" className="dock-item">
            <span className="material-symbols-outlined icon-20">add_business</span>
            <span>HOST</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
