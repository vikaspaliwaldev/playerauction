'use client';

import { useState } from 'react';

export default function TeamSummary({ tournament, getTeamStats, onRefresh, tournamentId, teamHotkeys }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const teams = tournament?.teams || [];

  const handleRemovePlayer = async (playerId) => {
    if (!window.confirm('Remove this player from the team?')) return;

    try {
      await fetch(`/api/tournaments/${tournamentId}/auction/re-auction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      onRefresh();
      // Refresh selected team data
      if (selectedTeam) {
        const updated = tournament.teams.find(t => t.id === selectedTeam.id);
        setSelectedTeam(updated || null);
      }
    } catch (err) {
      console.error('Remove player error:', err);
    }
  };

  // Team Detail View
  if (selectedTeam) {
    const team = teams.find(t => t.id === selectedTeam.id) || selectedTeam;
    const sales = team.sales || [];

    // Category breakdown
    const categoryBreakdown = {};
    tournament.categories?.forEach(c => { categoryBreakdown[c.name] = 0; });
    sales.forEach(s => {
      const catName = s.player?.category?.name;
      if (catName && categoryBreakdown[catName] !== undefined) {
        categoryBreakdown[catName]++;
      }
    });

    return (
      <div className="team-detail">
        <div className="team-detail__header">
          {team.logo ? (
            <img src={team.logo} alt={team.name} className="team-detail__logo" />
          ) : (
            <div className="team-detail__logo" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-muted)',
              border: '2px solid var(--border-subtle)', borderRadius: '12px',
            }}>
              {team.shortName}
            </div>
          )}
          <div>
            <h2 className="team-detail__name">{team.name}</h2>
            <div className="team-detail__category-breakdown">
              {Object.entries(categoryBreakdown).map(([name, count]) => {
                const cat = tournament.categories?.find(c => c.name === name);
                const hasLimit = cat?.maxPerTeam && cat.maxPerTeam > 0;
                const isFull = hasLimit && count >= cat.maxPerTeam;
                return (
                  <span
                    key={name}
                    style={{
                      marginRight: 8,
                      color: isFull ? 'var(--accent-gold)' : undefined,
                      fontWeight: isFull ? 700 : undefined,
                    }}
                  >
                    {name}: {count}{hasLimit ? `/${cat.maxPerTeam}` : ''}{isFull ? ' (FULL)' : ''},
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="team-detail__roster">
          {sales.map((sale) => (
            <div key={sale.id} className="team-detail__player-card">
              <div className="team-detail__player-number">{sale.player?.playerNumber}</div>
              {sale.player?.photo ? (
                <img src={sale.player.photo} alt={sale.player.name} className="team-detail__player-photo" />
              ) : (
                <div className="team-detail__player-photo" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', opacity: 0.3,
                }}>
                  👤
                </div>
              )}
              <div className="team-detail__player-info">
                <div className="team-detail__player-name">{sale.player?.name}</div>
                <div className="team-detail__player-points">
                  POINT : {sale.soldPrice.toLocaleString('en-IN')}
                </div>
                <div className="team-detail__player-role">{sale.player?.role || sale.player?.battingStyle}</div>
              </div>
              <div className="team-detail__category-badge">{sale.player?.category?.name}</div>
              <button
                className="team-detail__remove-btn"
                onClick={() => handleRemovePlayer(sale.playerId)}
                title="Remove from team"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {sales.length === 0 && (
          <div className="empty-state">
            <p>No players acquired yet</p>
          </div>
        )}

        {/* Team navigation bar */}
        <div className="team-nav-bar">
          {teams.map((t) => (
            <button
              key={t.id}
              className={`team-nav-bar__btn ${t.id === selectedTeam.id ? 'active' : ''}`}
              onClick={() => setSelectedTeam(t)}
            >
              {t.shortName}
            </button>
          ))}
          <button
            className="team-nav-bar__btn"
            style={{ background: 'var(--accent-red)' }}
            onClick={() => setSelectedTeam(null)}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // Team Summary Grid
  return (
    <div className="team-summary-grid">
      {teams.map((team) => {
        const stats = getTeamStats(team);
        const effectiveHotkey = teamHotkeys?.[team.id] || (team.hotkey && team.hotkey.trim()) || null;
        return (
          <div
            key={team.id}
            className="team-summary-card"
            onClick={() => setSelectedTeam(team)}
          >
            {team.logo ? (
              <img src={team.logo} alt={team.name} className="team-summary-card__logo" />
            ) : (
              <div className="team-summary-card__logo" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}>
                {team.shortName}
              </div>
            )}

            <div className="team-summary-card__info">
              <div className="team-summary-card__name" style={{ display: 'flex', alignItems: 'center' }}>
                <span>{team.name}</span>
                {effectiveHotkey && (
                  <span
                    className="team-shortcut-badge"
                    title={`Bidding shortcut key: [${effectiveHotkey.toUpperCase()}]`}
                  >
                    ⚡ [{effectiveHotkey.toUpperCase()}]
                  </span>
                )}
              </div>
              <div className="team-summary-card__stats">
                <span>
                  <span className="team-summary-card__stat-label">P. </span>
                  <span className="team-summary-card__stat-value">{stats.playerCount}</span>
                </span>
                <span>
                  <span className="team-summary-card__stat-label">R. </span>
                  <span className="team-summary-card__stat-value">{stats.remainingSlots}</span>
                </span>
              </div>
              <div className="team-summary-card__sub-stats">
                <span>MAX: {stats.maxBid?.toLocaleString('en-IN')}</span>
                <span>RES: {stats.reservePoints?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="team-summary-card__balance">
              {stats.balance?.toLocaleString('en-IN')}
            </div>
          </div>
        );
      })}
    </div>
  );
}
