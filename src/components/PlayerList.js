'use client';

import { useState, useMemo } from 'react';

export default function PlayerList({ tournament, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState('all'); // all | available | sold | unsold
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [loading, setLoading] = useState(false);

  const players = tournament?.players || [];
  const categories = tournament?.categories || [];
  const teams = tournament?.teams || [];

  // Lookup map for team details by team id
  const teamMap = useMemo(() => {
    const map = {};
    teams.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [teams]);

  // Filtered players
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }
      // Category filter
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesNum = p.playerNumber?.toString() === q;
        const matchesRole = p.role?.toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesRole) {
          return false;
        }
      }
      return true;
    });
  }, [players, statusFilter, categoryFilter, searchQuery]);

  const handleOpenEdit = (player) => {
    setEditingPlayer({
      ...player,
      photo: player.photo || '',
      status: player.status || 'available',
      teamId: player.sale?.teamId || teams[0]?.id || '',
      soldPrice: player.sale?.soldPrice ?? player.category?.basePrice ?? 1000,
    });
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setEditingPlayer(prev => ({ ...prev, photo: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSavePlayerEdit = async (e) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: editingPlayer.id,
          name: editingPlayer.name,
          playerNumber: editingPlayer.playerNumber,
          categoryId: editingPlayer.categoryId,
          role: editingPlayer.role,
          battingStyle: editingPlayer.battingStyle,
          age: editingPlayer.age,
          photo: editingPlayer.photo || null,
          status: editingPlayer.status,
          teamId: editingPlayer.status === 'sold' ? editingPlayer.teamId : null,
          soldPrice: editingPlayer.status === 'sold' ? editingPlayer.soldPrice : null,
        }),
      });
      if (res.ok) {
        setEditingPlayer(null);
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update player');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAuction = async (playerId, name) => {
    if (!confirm(`Cancel auction for "${name}"? This will remove the sale, refund the team purse, and make the player available for auction again.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          cancelAuction: true,
        }),
      });
      if (res.ok) {
        setEditingPlayer(null);
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to cancel auction');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlayer = async (playerId, name) => {
    if (!confirm(`Are you sure you want to delete player "${name}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      if (res.ok) {
        setEditingPlayer(null);
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete player');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Player Number', 'Name', 'Category', 'Role', 'Status', 'Team', 'Sold Price'];
    const rows = filteredPlayers.map(p => {
      const isSold = p.status === 'sold';
      const soldTeam = p.sale?.teamId ? teamMap[p.sale.teamId] : (p.teamId ? teamMap[p.teamId] : null);
      
      const teamName = isSold && soldTeam ? soldTeam.name : (p.status === 'unsold' ? 'Unsold' : 'Available');
      const soldPrice = isSold && p.sale?.soldPrice ? p.sale.soldPrice : '';
      const categoryName = p.category?.name || 'General';

      // Escape quotes for CSV
      const escapeStr = (str) => str ? `"${str.toString().replace(/"/g, '""')}"` : '';

      return [
        p.playerNumber,
        escapeStr(p.name),
        escapeStr(categoryName),
        escapeStr(p.role || ''),
        p.status.toUpperCase(),
        escapeStr(teamName),
        soldPrice
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${tournament?.name?.replace(/\s+/g, '_') || 'Auction'}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="player-list">
      {/* Filter controls */}
      <div className="player-list__filters">
        <button
          className={`player-list__filter-btn player-list__filter-btn--all ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          ALL ({players.length})
        </button>
        <button
          className={`player-list__filter-btn player-list__filter-btn--available ${statusFilter === 'available' ? 'active' : ''}`}
          onClick={() => setStatusFilter('available')}
        >
          AVAILABLE ({players.filter(p => p.status === 'available').length})
        </button>
        <button
          className={`player-list__filter-btn player-list__filter-btn--sold ${statusFilter === 'sold' ? 'active' : ''}`}
          onClick={() => setStatusFilter('sold')}
        >
          SOLD ({players.filter(p => p.status === 'sold').length})
        </button>
        <button
          className={`player-list__filter-btn player-list__filter-btn--unsold ${statusFilter === 'unsold' ? 'active' : ''}`}
          onClick={() => setStatusFilter('unsold')}
        >
          UNSOLD ({players.filter(p => p.status === 'unsold').length})
        </button>

        <button
          className="player-list__filter-btn"
          onClick={handleExportCSV}
          style={{ marginLeft: 'auto', background: 'var(--accent-purple)', color: '#fff' }}
        >
          <span className="material-symbols-outlined icon-18" style={{ marginRight: 4, verticalAlign: 'middle' }}>download</span>
          CSV REPORT
        </button>

        {/* Category dropdown */}
        <select
          className="player-list__filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">ALL CATEGORIES</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name.toUpperCase()} (₹{cat.basePrice.toLocaleString()})
            </option>
          ))}
        </select>

        {/* Search input */}
        <input
          type="text"
          placeholder="Search name, role, or #..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            height: 30,
            padding: '0 12px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            outline: 'none',
            minWidth: 180,
          }}
        />

        <div className="player-list__count">
          Showing {filteredPlayers.length} of {players.length}
        </div>
      </div>

      {/* Grid of player cards */}
      <div className="player-list__grid">
        {filteredPlayers.map((player) => {
          const isSold = player.status === 'sold';
          const isUnsold = player.status === 'unsold';
          const soldTeam = player.sale?.teamId
            ? teamMap[player.sale.teamId]
            : (player.teamId ? teamMap[player.teamId] : null);

          return (
            <div
              key={player.id}
              className={`player-card ${isSold ? 'player-card--sold' : ''} ${isUnsold ? 'player-card--unsold' : ''}`}
            >
              <div className="player-card__number">
                {player.playerNumber}
              </div>

              {/* Edit button */}
              <button
                type="button"
                onClick={() => handleOpenEdit(player)}
                title="Edit Player Details & Auction Status"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: isSold && soldTeam ? 96 : 8,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              >
                ✏️ Edit
              </button>

              {player.photo ? (
                <img
                  src={player.photo}
                  alt={player.name}
                  className="player-card__photo"
                />
              ) : (
                <div
                  className="player-card__photo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {player.name.substring(0, 2).toUpperCase()}
                </div>
              )}

              <div className="player-card__info">
                <div className="player-card__name">{player.name}</div>
                <div className="player-card__category">
                  {player.category?.name || 'General'}
                </div>

                {player.role && (
                  <div className="player-card__role" style={{ color: 'var(--accent-cyan)' }}>
                    {player.role}
                  </div>
                )}
                {player.battingStyle && (
                  <div className="player-card__style">{player.battingStyle}</div>
                )}
                {player.age && (
                  <div className="player-card__age">Age: {player.age}</div>
                )}

                <div className="player-card__footer">
                  {isSold && (
                    <>
                      <div className="player-card__team-name" style={{ color: soldTeam?.color || 'var(--accent-gold)' }}>
                        {soldTeam?.name || 'SOLD'}
                      </div>
                      <div className="player-card__points">
                        ₹{(player.sale?.soldPrice || 0).toLocaleString()}
                      </div>
                    </>
                  )}
                  {isUnsold && (
                    <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', fontWeight: 700 }}>
                      UNSOLD
                    </div>
                  )}
                  {!isSold && !isUnsold && (
                    <>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Base Price
                      </div>
                      <div className="player-card__points" style={{ color: 'var(--text-green)' }}>
                        ₹{(player.category?.basePrice || 1000).toLocaleString()}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Side: Sold Team Avatar / Crest */}
              {isSold && soldTeam && (
                <div
                  className="player-card__team-badge-right"
                  title={`Acquired by ${soldTeam.name} for ₹${(player.sale?.soldPrice || 0).toLocaleString()}`}
                  style={{
                    borderColor: soldTeam.color ? `${soldTeam.color}80` : 'rgba(245, 184, 0, 0.4)',
                  }}
                >
                  <div className="player-card__team-logo-wrap">
                    {soldTeam.logo ? (
                      <img src={soldTeam.logo} alt={soldTeam.name} className="player-card__team-img" />
                    ) : (
                      <div
                        className="player-card__team-crest"
                        style={{ background: soldTeam.color || 'var(--accent-gold)' }}
                      >
                        {soldTeam.shortName || soldTeam.name.substring(0, 3)}
                      </div>
                    )}
                  </div>
                  <div className="player-card__team-acquired-label">ACQUIRED BY</div>
                  <div
                    className="player-card__team-name-tag"
                    style={{ color: soldTeam.color || 'var(--accent-gold)' }}
                  >
                    {soldTeam.shortName || soldTeam.name}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPlayers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem' }}>No players found matching your criteria</p>
        </div>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setEditingPlayer(null)}
        >
          <div
            style={{
              background: 'var(--bg-card-solid)',
              border: '1px solid var(--accent-gold)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
              width: '100%',
              maxWidth: 500,
              padding: 24,
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--accent-gold)', margin: 0 }}>
                ✏️ EDIT PLAYER DETAILS
              </h3>
              <button
                type="button"
                onClick={() => setEditingPlayer(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlayerEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Player Avatar / Photo Section */}
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Avatar Preview */}
                <div
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '2px solid var(--accent-gold)',
                    background: '#12112a',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}
                >
                  {editingPlayer.photo ? (
                    <img
                      src={editingPlayer.photo}
                      alt={editingPlayer.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ fontSize: '1.8rem', opacity: 0.5 }}>👤</div>
                  )}
                </div>

                {/* Upload or URL Controls */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                    PLAYER AVATAR / PHOTO
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Paste Image URL or click Upload..."
                      value={editingPlayer.photo || ''}
                      onChange={e => setEditingPlayer({ ...editingPlayer, photo: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: '0.8rem',
                      }}
                    />
                    <label
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(245, 184, 0, 0.15)',
                        border: '1px solid var(--accent-gold)',
                        color: 'var(--accent-gold)',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      📁 Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {editingPlayer.photo && (
                      <button
                        type="button"
                        onClick={() => setEditingPlayer({ ...editingPlayer, photo: '' })}
                        title="Remove Avatar"
                        style={{
                          background: 'rgba(220,53,69,0.15)',
                          border: '1px solid var(--accent-red)',
                          color: 'var(--text-red)',
                          borderRadius: 6,
                          padding: '6px 8px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {/* Preset Avatar Suggestions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Presets:</span>
                    {[
                      { l: 'Cricketer 1', url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&q=80' },
                      { l: 'Athlete 2', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80' },
                      { l: 'Pro 3', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80' },
                      { l: 'Star 4', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80' },
                    ].map((p, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setEditingPlayer({ ...editingPlayer, photo: p.url })}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 12,
                          padding: '2px 8px',
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PLAYER NAME</label>
                  <input
                    type="text"
                    value={editingPlayer.name}
                    onChange={e => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>JERSEY #</label>
                  <input
                    type="number"
                    value={editingPlayer.playerNumber}
                    onChange={e => setEditingPlayer({ ...editingPlayer, playerNumber: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>CATEGORY</label>
                <select
                  value={editingPlayer.categoryId}
                  onChange={e => setEditingPlayer({ ...editingPlayer, categoryId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: '#fff',
                  }}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#12112a' }}>
                      {c.name} (Base ₹{c.basePrice.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ROLE</label>
                  <input
                    type="text"
                    placeholder="e.g. Batsman, Striker, Raider..."
                    value={editingPlayer.role || ''}
                    onChange={e => setEditingPlayer({ ...editingPlayer, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>STYLE / POSITION</label>
                  <input
                    type="text"
                    placeholder="e.g. Right Hand, Left Foot"
                    value={editingPlayer.battingStyle || ''}
                    onChange={e => setEditingPlayer({ ...editingPlayer, battingStyle: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>AGE</label>
                <input
                  type="number"
                  value={editingPlayer.age || ''}
                  onChange={e => setEditingPlayer({ ...editingPlayer, age: parseInt(e.target.value) || '' })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: '#fff',
                  }}
                />
              </div>

              {/* Auction Status & Bidding Controls */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(245, 184, 0, 0.3)',
                  borderRadius: 8,
                  padding: 14,
                  marginTop: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-gold)', letterSpacing: 0.5 }}>
                    AUCTION & BIDDING STATUS
                  </label>
                  {(editingPlayer.status === 'sold' || editingPlayer.status === 'unsold') && (
                    <button
                      type="button"
                      onClick={() => handleCancelAuction(editingPlayer.id, editingPlayer.name)}
                      disabled={loading}
                      title="Cancel this player's auction and make them available again"
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(23, 162, 184, 0.2)',
                        border: '1px solid var(--accent-cyan)',
                        borderRadius: 4,
                        color: 'var(--accent-cyan)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🔄 Cancel Auction / Make Available
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      AUCTION STATUS
                    </label>
                    <select
                      value={editingPlayer.status}
                      onChange={e => setEditingPlayer({ ...editingPlayer, status: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: editingPlayer.status === 'sold' ? 'var(--text-green)' : editingPlayer.status === 'unsold' ? 'var(--text-red)' : 'var(--accent-cyan)',
                        fontWeight: 700,
                      }}
                    >
                      <option value="available" style={{ background: '#12112a', color: '#fff' }}>Available for Auction</option>
                      <option value="sold" style={{ background: '#12112a', color: '#28a745' }}>Sold to Team</option>
                      <option value="unsold" style={{ background: '#12112a', color: '#dc3545' }}>Unsold</option>
                    </select>
                  </div>

                  {editingPlayer.status === 'sold' && (
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        BIDDING POINTS (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="Final Sold Price"
                        value={editingPlayer.soldPrice ?? ''}
                        onChange={e => setEditingPlayer({ ...editingPlayer, soldPrice: parseInt(e.target.value) || 0 })}
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'rgba(245, 184, 0, 0.12)',
                          border: '1px solid var(--accent-gold)',
                          borderRadius: 6,
                          color: 'var(--accent-gold)',
                          fontWeight: 800,
                        }}
                      />
                    </div>
                  )}
                </div>

                {editingPlayer.status === 'sold' && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      ASSIGNED TEAM
                    </label>
                    <select
                      value={editingPlayer.teamId || ''}
                      onChange={e => setEditingPlayer({ ...editingPlayer, teamId: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                      }}
                    >
                      {teams.map(t => (
                        <option key={t.id} value={t.id} style={{ background: '#12112a' }}>
                          {t.name} ({t.shortName})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => handleDeletePlayer(editingPlayer.id, editingPlayer.name)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid rgba(220,53,69,0.4)',
                    background: 'rgba(220,53,69,0.15)',
                    color: 'var(--text-red)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  🗑️ Delete Player
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--accent-gold)',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Save Changes ✔
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
