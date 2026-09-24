'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuctionArenaLogo from '@/components/AuctionArenaLogo';

const SPORT_OPTIONS = [
  { value: 'cricket', label: 'Cricket', icon: '🏏' },
  { value: 'football', label: 'Football', icon: '⚽' },
  { value: 'volleyball', label: 'Volleyball', icon: '🏐' },
  { value: 'badminton', label: 'Badminton', icon: '🏸' },
  { value: 'table_tennis', label: 'Table Tennis', icon: '🏓' },
  { value: 'basketball', label: 'Basketball', icon: '🏀' },
  { value: 'other', label: 'Other Sport', icon: '🏆' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Theme state
  const [theme, setTheme] = useState('dark');

  // Filter state
  const [selectedSport, setSelectedSport] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [deletingTournament, setDeletingTournament] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    logo: '',
    totalPurse: 100000,
    minPlayers: 7,
    maxPlayers: 15,
    baseIncrement: 100,
    sportType: 'cricket',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    logo: '',
    totalPurse: 100000,
    minPlayers: 7,
    maxPlayers: 15,
    baseIncrement: 100,
    sportType: 'cricket',
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('player_auction_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    fetchTournaments();
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

  const fetchTournaments = async () => {
    try {
      const res = await fetch('/api/tournaments');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg, type = 'success') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleFileUpload = (e, setFormData) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setFormData(prev => ({ ...prev, logo: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({ name: '', logo: '', totalPurse: 100000, minPlayers: 7, maxPlayers: 15, baseIncrement: 100, sportType: 'cricket' });
        showNotification('Tournament created successfully!');
        fetchTournaments();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create tournament');
      }
    } catch (err) {
      console.error('Create error:', err);
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (t, e) => {
    e.stopPropagation();
    setEditingTournament(t);
    setEditForm({
      name: t.name || '',
      logo: t.logo || '',
      totalPurse: t.totalPurse || 100000,
      minPlayers: t.minPlayers || 7,
      maxPlayers: t.maxPlayers || 15,
      baseIncrement: t.baseIncrement || 100,
      sportType: t.sportType || 'cricket',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTournament) return;
    if (editingTournament.status === 'completed') {
      alert('This tournament is completed and locked. Please click "REOPEN TOURNAMENT" first to enable edits.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${editingTournament.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingTournament(null);
        showNotification(`Tournament "${editForm.name}" updated successfully!`);
        fetchTournaments();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update tournament');
      }
    } catch (err) {
      console.error('Edit error:', err);
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDelete = (t, e) => {
    e.stopPropagation();
    setDeletingTournament(t);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTournament) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${deletingTournament.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const deletedName = deletingTournament.name;
        setDeletingTournament(null);
        showNotification(`Tournament "${deletedName}" deleted successfully!`);
        fetchTournaments();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete tournament');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  // Telemetry Aggregates
  const totalTeamsCount = useMemo(() => {
    return tournaments.reduce((acc, t) => acc + (t._count?.teams || 0), 0);
  }, [tournaments]);

  const totalPlayersCount = useMemo(() => {
    return tournaments.reduce((acc, t) => acc + (t._count?.players || 0), 0);
  }, [tournaments]);

  const liveTournamentsCount = useMemo(() => {
    return tournaments.filter(t => t.status === 'live').length;
  }, [tournaments]);

  // Filtered Tournaments
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      const matchesSport = selectedSport === 'all' || (t.sportType || 'cricket').toLowerCase() === selectedSport;
      const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSport && matchesSearch;
    });
  }, [tournaments, selectedSport, searchQuery]);

  const getSportBadge = (sportType) => {
    const found = SPORT_OPTIONS.find(s => s.value === sportType);
    return found ? `${found.icon} ${found.label}` : '🏆 Sport';
  };

  return (
    <>
      <div className="auction-bg" />
      <div className="geometric-frame" />

      <div className="dashboard" style={{ maxWidth: 1400 }}>
        {/* Broadcast Top Navigation Bar */}
        <header className="dashboard__header" style={{
          background: 'var(--aa-surface-container, rgba(27, 31, 49, 0.8))',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          padding: '14px 22px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <AuctionArenaLogo size="small" />
            </Link>
            <div style={{ width: 1, height: 28, background: 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 className="dashboard__title" style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                  ORGANIZER COMMAND DECK
                </h1>
                <span className="telemetry-chip subtle" style={{ padding: '2px 8px', fontSize: '10px' }}>
                  <span className="material-symbols-outlined icon-14" style={{ color: 'var(--aa-tertiary)' }}>verified</span>
                  <span>V3.4 TERMINAL</span>
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Manage sports franchises, rosters & broadcast feeds
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/#tournaments" className="btn-watch-live-chip" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined icon-18">live_tv</span>
              <span>Watch Live</span>
            </Link>

            <button
              onClick={toggleTheme}
              className="portal-theme-btn"
              title="Toggle dark/light theme"
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined icon-18">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button
              className="dashboard__btn"
              style={{
                background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)',
                color: '#fff',
                fontWeight: 700,
                boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)',
                border: 'none',
              }}
              onClick={() => setShowCreate(true)}
            >
              + Create Tournament
            </button>

            <button
              className="dashboard__btn"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Telemetry Stats Ticker Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          <div style={{
            background: 'var(--aa-surface-container, var(--bg-card))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '14px 18px',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
              TOTAL TOURNAMENTS
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {tournaments.length}
            </div>
          </div>

          <div style={{
            background: 'var(--aa-surface-container, var(--bg-card))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '14px 18px',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--aa-tertiary)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--aa-tertiary)', display: 'inline-block' }} />
              ACTIVE LIVE STAGES
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--aa-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {liveTournamentsCount}
            </div>
          </div>

          <div style={{
            background: 'var(--aa-surface-container, var(--bg-card))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '14px 18px',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
              FRANCHISE TEAMS
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {totalTeamsCount}
            </div>
          </div>

          <div style={{
            background: 'var(--aa-surface-container, var(--bg-card))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '14px 18px',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--aa-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
              REGISTERED PLAYERS
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--aa-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {totalPlayersCount}
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}>
          {/* Sport Selector Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedSport('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: selectedSport === 'all' ? 'var(--aa-primary)' : 'var(--border-subtle)',
                background: selectedSport === 'all' ? 'var(--aa-primary-container, #8b5cf6)' : 'var(--bg-tertiary)',
                color: selectedSport === 'all' ? '#fff' : 'var(--text-secondary)',
                fontFamily: 'var(--font-display)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All Sports
            </button>
            {SPORT_OPTIONS.map(sport => (
              <button
                key={sport.value}
                onClick={() => setSelectedSport(sport.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid',
                  borderColor: selectedSport === sport.value ? 'var(--aa-primary)' : 'var(--border-subtle)',
                  background: selectedSport === sport.value ? 'var(--aa-primary-container, #8b5cf6)' : 'var(--bg-tertiary)',
                  color: selectedSport === sport.value ? '#fff' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{sport.icon}</span>
                <span>{sport.label}</span>
              </button>
            ))}
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', minWidth: 260 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tournament name..."
              style={{
                width: '100%',
                padding: '8px 14px 8px 36px',
                borderRadius: 8,
                background: 'var(--bg-card-solid)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 18,
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              search
            </span>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: 20,
            borderRadius: 8,
            background: message.type === 'success' ? 'rgba(78, 222, 163, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.type === 'success' ? 'var(--aa-tertiary)' : 'var(--aa-error)'}`,
            color: message.type === 'success' ? 'var(--aa-tertiary)' : 'var(--aa-error)',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="empty-state" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            padding: '48px 24px',
          }}>
            <div className="empty-state__icon" style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>No tournaments found</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
              {searchQuery || selectedSport !== 'all'
                ? 'Try adjusting your sport filter or search terms.'
                : 'Get started by creating your very first tournament!'}
            </p>
            <button
              className="dashboard__btn"
              style={{ background: 'linear-gradient(135deg, var(--aa-primary), #6d28d9)', color: '#fff' }}
              onClick={() => setShowCreate(true)}
            >
              + Create Tournament Now
            </button>
          </div>
        ) : (
          <div className="dashboard__tournaments" style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 22,
          }}>
            {filteredTournaments.map((t) => {
              const isLive = t.status === 'live';
              const isCompleted = t.status === 'completed';

              return (
                <div
                  key={t.id}
                  className="tournament-card"
                  onClick={() => router.push(`/manage/${t.id}`)}
                  title={`Open ${t.name} Auction & Roster`}
                  style={{
                    background: 'var(--aa-surface-container, var(--bg-card))',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 14,
                    padding: 22,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top hairline accent border */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: isLive
                      ? 'linear-gradient(90deg, #ef4444, #f97316)'
                      : isCompleted
                      ? 'linear-gradient(90deg, #4edea3, #0284c7)'
                      : 'linear-gradient(90deg, var(--aa-primary), var(--aa-secondary))',
                  }} />

                  {/* Header: Logo + Title + Status */}
                  <div className="tournament-card__header">
                    <div className="tournament-card__identity">
                      {t.logo ? (
                        <img
                          src={t.logo}
                          alt={t.name}
                          className="tournament-card__logo"
                          style={{ width: 52, height: 52, borderRadius: 10 }}
                        />
                      ) : (
                        <div className="tournament-card__logo" style={{ width: 52, height: 52, borderRadius: 10, fontSize: '1.6rem' }}>
                          {SPORT_OPTIONS.find(s => s.value === t.sportType)?.icon || '🏆'}
                        </div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'var(--bg-tertiary)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'var(--aa-secondary)',
                            textTransform: 'uppercase',
                          }}>
                            {getSportBadge(t.sportType)}
                          </span>
                          {isLive ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: 'var(--accent-red)',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-red)' }} />
                              LIVE
                            </span>
                          ) : (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: isCompleted ? 'rgba(78, 222, 163, 0.15)' : 'var(--bg-tertiary)',
                              color: isCompleted ? 'var(--aa-tertiary)' : 'var(--text-muted)',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}>
                              {t.status}
                            </span>
                          )}
                        </div>
                        <h2 className="tournament-card__name" style={{
                          margin: 0,
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }} title={t.name}>
                          {t.name}
                        </h2>
                      </div>
                    </div>

                    <div className="tournament-card__actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="tournament-card__action-btn"
                        onClick={(e) => handleOpenEdit(t, e)}
                        title="Edit Tournament Rules & Details"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="tournament-card__action-btn tournament-card__action-btn--delete"
                        onClick={(e) => handleOpenDelete(t, e)}
                        title="Delete Tournament"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Telemetry Stats Grid */}
                  <div className="tournament-card__stats" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    background: 'var(--aa-surface-lowest, rgba(9, 13, 31, 0.5))',
                    borderRadius: 8,
                    padding: '10px 12px',
                    margin: '14px 0',
                  }}>
                    <div className="tournament-card__stat" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Teams</div>
                      <div className="tournament-card__stat-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {t._count?.teams || 0}
                      </div>
                    </div>
                    <div className="tournament-card__stat" style={{ textAlign: 'center', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Players</div>
                      <div className="tournament-card__stat-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {t._count?.players || 0}
                      </div>
                    </div>
                    <div className="tournament-card__stat" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Team Purse</div>
                      <div className="tournament-card__stat-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                        ₹{(t.totalPurse || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Action Link Footer */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border-subtle)',
                  }}>
                    <Link
                      href={`/live/${t.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--aa-secondary)',
                        textDecoration: 'none',
                      }}
                      title="Open Public Live Spectator Screen"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>live_tv</span>
                      <span>Spectator View</span>
                    </Link>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--aa-primary-light, var(--accent-gold))',
                    }}>
                      <span>Organizer Console</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Tournament Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{
            background: 'var(--aa-surface-container, var(--bg-card-solid))',
            borderRadius: 16,
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            maxWidth: 540,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, var(--aa-primary), var(--aa-secondary), var(--aa-tertiary))',
            }} />

            <div style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 className="modal__title" style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                    Create Tournament
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Set up tournament details, sports type, rules, and team budgets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g., 7PD Volleyball Premier League, Super Cricket Cup"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--aa-surface-lowest, #090d1f)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                {/* Sport Type Selector */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Sport Type *
                  </label>
                  <select
                    value={createForm.sportType || 'cricket'}
                    onChange={(e) => setCreateForm({ ...createForm, sportType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--aa-surface-lowest, #090d1f)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    {SPORT_OPTIONS.map((sport) => (
                      <option key={sport.value} value={sport.value} style={{ background: 'var(--bg-card-solid)', color: 'var(--text-primary)' }}>
                        {sport.icon} {sport.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Tournament Logo (Image URL or Upload)
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="text"
                      value={createForm.logo}
                      onChange={(e) => setCreateForm({ ...createForm, logo: e.target.value })}
                      placeholder="Paste image URL (https://...)"
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--aa-surface-lowest, #090d1f)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                      }}
                    />
                    <label style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      📁 Browse
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setCreateForm)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  {createForm.logo && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={createForm.logo} alt="Preview" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border-subtle)' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--aa-tertiary)' }}>✓ Image ready</span>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Total Purse Per Team (₹)
                  </label>
                  <input
                    type="number"
                    value={createForm.totalPurse}
                    onChange={(e) => setCreateForm({ ...createForm, totalPurse: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--aa-surface-lowest, #090d1f)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Min Squad Size
                    </label>
                    <input
                      type="number"
                      value={createForm.minPlayers}
                      onChange={(e) => setCreateForm({ ...createForm, minPlayers: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--aa-surface-lowest, #090d1f)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Max Squad Size
                    </label>
                    <input
                      type="number"
                      value={createForm.maxPlayers}
                      onChange={(e) => setCreateForm({ ...createForm, maxPlayers: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--aa-surface-lowest, #090d1f)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Bid Increment (₹)
                  </label>
                  <input
                    type="number"
                    value={createForm.baseIncrement}
                    onChange={(e) => setCreateForm({ ...createForm, baseIncrement: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--aa-surface-lowest, #090d1f)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowCreate(false)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--aa-primary), #6d28d9)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)',
                    }}
                  >
                    {actionLoading ? 'Creating...' : 'Create Tournament'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tournament Modal */}
      {editingTournament && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setEditingTournament(null)}>
          <div className="modal" style={{
            background: 'var(--aa-surface-container, var(--bg-card-solid))',
            borderRadius: 16,
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            maxWidth: 540,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, var(--aa-primary), var(--aa-secondary))',
            }} />

            <div style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 className="modal__title" style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                    Edit Tournament
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Update settings for &quot;{editingTournament.name}&quot;
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTournament(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                  }}
                >
                  ✕
                </button>
              </div>

              {editingTournament.status === 'completed' && (
                <div style={{
                  marginBottom: 20,
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#ef4444', fontSize: '0.85rem' }}>
                    <span>🔒 AUCTION COMPLETED & LOCKED</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    This tournament is completed. Tournament details and roster are locked. You must reopen the tournament to make any changes.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Reopen tournament "${editingTournament.name}" for live auction and enable editing?`)) return;
                      setActionLoading(true);
                      try {
                        const res = await fetch(`/api/tournaments/${editingTournament.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'live' }),
                        });
                        if (res.ok) {
                          setEditingTournament(prev => ({ ...prev, status: 'live' }));
                          showNotification(`Tournament "${editingTournament.name}" reopened successfully! Status is now LIVE.`);
                          fetchTournaments();
                        } else {
                          const err = await res.json();
                          alert(err.error || 'Failed to reopen tournament');
                        }
                      } catch (err) {
                        alert(err.message);
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '8px 16px',
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(139, 92, 246, 0.35)',
                    }}
                  >
                    🔄 REOPEN TOURNAMENT
                  </button>
                </div>
              )}

              <form onSubmit={handleSaveEdit}>
                <fieldset disabled={editingTournament.status === 'completed' || actionLoading} style={{ border: 'none', padding: 0, margin: 0 }}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--aa-surface-lowest, #090d1f)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                {/* Sport Type Selector */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Sport Type *
                  </label>
                  <select
                    value={editForm.sportType || 'cricket'}
                    onChange={(e) => setEditForm({ ...editForm, sportType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--aa-surface-lowest, #090d1f)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    {SPORT_OPTIONS.map((sport) => (
                      <option key={sport.value} value={sport.value} style={{ background: 'var(--bg-card-solid)', color: 'var(--text-primary)' }}>
                        {sport.icon} {sport.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Tournament Logo (Image URL or Upload)
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="text"
                      value={editForm.logo}
                      onChange={(e) => setEditForm({ ...editForm, logo: e.target.value })}
                      placeholder="Paste image URL (https://...)"
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--aa-surface-lowest, #090d1f)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                      }}
                    />
                    <label style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      📁 Browse
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setEditForm)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  {editForm.logo && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={editForm.logo} alt="Preview" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border-subtle)' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--aa-tertiary)' }}>✓ Image loaded</span>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Total Purse Per Team (₹)
                  </label>
                  <input
                    type="number"
                    value={editForm.totalPurse}
                    onChange={(e) => setEditForm({ ...editForm, totalPurse: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--aa-surface-lowest, #090d1f)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Min Squad Size
                    </label>
                    <input
                      type="number"
                      value={editForm.minPlayers}
                      onChange={(e) => setEditForm({ ...editForm, minPlayers: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--aa-surface-lowest, #090d1f)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Max Squad Size
                    </label>
                    <input
                      type="number"
                      value={editForm.maxPlayers}
                      onChange={(e) => setEditForm({ ...editForm, maxPlayers: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--aa-surface-lowest, #090d1f)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Bid Increment (₹)
                  </label>
                  <input
                    type="number"
                    value={editForm.baseIncrement}
                    onChange={(e) => setEditForm({ ...editForm, baseIncrement: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--aa-surface-lowest, #090d1f)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                </fieldset>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setEditingTournament(null)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || editingTournament.status === 'completed'}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: editingTournament.status === 'completed' ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--aa-primary), #6d28d9)',
                      color: editingTournament.status === 'completed' ? 'var(--text-muted)' : '#fff',
                      fontWeight: 700,
                      cursor: editingTournament.status === 'completed' ? 'not-allowed' : 'pointer',
                      boxShadow: editingTournament.status === 'completed' ? 'none' : '0 0 16px rgba(139, 92, 246, 0.4)',
                    }}
                  >
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTournament && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDeletingTournament(null)}>
          <div className="modal" style={{
            background: 'var(--aa-surface-container, var(--bg-card-solid))',
            borderRadius: 16,
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            maxWidth: 480,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'var(--accent-red)',
            }} />

            <div style={{ padding: '24px 28px' }}>
              <h2 className="modal__title" style={{ margin: '0 0 12px', fontSize: '1.3rem', color: 'var(--accent-red)' }}>
                Delete Tournament?
              </h2>
              <div style={{ marginBottom: 20 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 12 }}>
                  Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>&quot;{deletingTournament.name}&quot;</strong>?
                </p>
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  color: 'var(--accent-red)',
                  lineHeight: 1.5,
                }}>
                  ⚠️ <strong>Warning:</strong> This will permanently delete all franchise teams, player rosters, auction history, and settings for this tournament. This action cannot be undone.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setDeletingTournament(null)}
                  disabled={actionLoading}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={actionLoading}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--accent-red)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 0 14px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  {actionLoading ? 'Deleting...' : '🗑️ Yes, Delete Tournament'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
