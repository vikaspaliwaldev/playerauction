'use client';

import { useState, useMemo } from 'react';
import { getTeamSlots, calculateTeamStats } from '@/lib/auctionRules';
import OfficialSquadRosters from '@/components/OfficialSquadRosters';

export default function TeamSummary({ tournament, getTeamStats, onRefresh, tournamentId, teamHotkeys }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [summaryView, setSummaryView] = useState('rosters'); // 'rosters' (default, matches public page) | 'compact'
  const teams = tournament?.teams || [];

  const teamsWithStatsAndSlots = useMemo(() => {
    return (tournament?.teams || []).map(team => {
      const stats = getTeamStats ? getTeamStats(team) : calculateTeamStats(team, tournament?.teams, tournament);
      const slots = getTeamSlots(team, tournament);
      return {
        ...team,
        ...stats,
        slots,
      };
    });
  }, [tournament, getTeamStats]);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleDownloadImage = async (elementId, defaultFilename) => {
    try {
      setIsExportingImage(true);
      const element = document.getElementById(elementId);
      if (!element) return;

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        ignoreElements: (el) => el.classList?.contains('print-hide'),
      });

      const link = document.createElement('a');
      link.download = defaultFilename;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
      window.print();
    } finally {
      setIsExportingImage(false);
    }
  };

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
      <div className="team-detail" id="team-detail-export-section">
        <div className="team-detail__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {team.logo ? (
              <img src={team.logo} alt={team.name} crossOrigin="anonymous" className="team-detail__logo" style={{ borderRadius: 10, objectFit: 'contain' }} />
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

          {/* Export Action Buttons in Team Detail */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} className="print-hide">
            <button
              onClick={handleDownloadPDF}
              style={{
                background: 'var(--accent-red, #dc2626)',
                color: '#fff',
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.82rem',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
              }}
              title="Save squad roster as PDF"
            >
              <span>📄</span>
              <span>DOWNLOAD PDF</span>
            </button>

            <button
              onClick={() => handleDownloadImage('team-detail-export-section', `${team.name.replace(/\s+/g, '_')}_Squad_Roster.png`)}
              disabled={isExportingImage}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-primary)',
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.82rem',
                border: '1px solid var(--border-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: isExportingImage ? 'wait' : 'pointer',
              }}
              title="Download squad roster as PNG image"
            >
              <span>📸</span>
              <span>{isExportingImage ? 'SAVING...' : 'DOWNLOAD IMAGE'}</span>
            </button>

            <button
              className="team-nav-bar__btn"
              style={{ background: 'var(--accent-purple, #6366f1)', height: 36, padding: '0 14px', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => setSelectedTeam(null)}
            >
              ← ALL TEAMS
            </button>
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

  const handleExportCSV = () => {
    const playersList = tournament?.players || [];
    const headers = [
      'Player Number',
      'Name',
      'Category',
      'Role',
      'Base Price',
      'Status',
      'Team',
      'Sold Price',
      'Points/Rating'
    ];
    const rows = playersList.map(p => {
      const escape = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
      return [
        p.playerNumber || '',
        escape(p.name),
        escape(p.category?.name),
        escape(p.role),
        p.category?.basePrice || 0,
        p.status,
        escape(p.sale?.team?.name || 'Unsold/Available'),
        p.sale?.soldPrice || 0,
        p.points || 0
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${tournament?.name?.replace(/\s+/g, '_') || 'Auction'}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Team Summary Grid
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px' }}>
      {/* View Switcher Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        background: 'var(--aa-surface-container, rgba(27, 31, 49, 0.8))',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        padding: '12px 18px',
      }} className="print-hide">
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {summaryView === 'rosters' ? '🛡️ Public Squad Rosters View' : '🗂️ Compact Franchise Cards View'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {summaryView === 'rosters' 
              ? 'Showing the live official squad layout with player slots, sold prices & team badges (Matches Public Screen)'
              : 'Showing compact franchise cards overview'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setSummaryView('rosters')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: summaryView === 'rosters' ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
              background: summaryView === 'rosters' ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
              color: summaryView === 'rosters' ? 'var(--accent-gold)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🛡️ Public Squad Rosters
          </button>
          <button
            onClick={() => setSummaryView('compact')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: summaryView === 'compact' ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
              background: summaryView === 'compact' ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
              color: summaryView === 'compact' ? 'var(--accent-gold)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🗂️ Compact Cards
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {summaryView === 'rosters' ? (
        <OfficialSquadRosters
          tournament={tournament}
          teams={teamsWithStatsAndSlots}
          onTeamClick={(team) => setSelectedTeam(team)}
          onDownloadPDF={handleDownloadPDF}
          onDownloadImage={() => handleDownloadImage('official-squad-rosters-section', `${(tournament?.name || 'Tournament').replace(/\s+/g, '_')}_Team_Rosters.png`)}
          isExportingImage={isExportingImage}
          extraHeaderActions={
            <button
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 15px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(2, 132, 199, 0.3)',
              }}
              title="Download complete team-wise and player-wise auction report in CSV"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
              <span>CSV REPORT</span>
            </button>
          }
        />
      ) : (
        <div id="team-summary-compact-section">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
            background: 'var(--aa-surface-container, rgba(27, 31, 49, 0.8))',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            padding: '14px 20px',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                FRANCHISE TEAMS & PURSE BREAKDOWN
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Click any team to inspect acquired squad members, quota limits, or remove players
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} className="print-hide">
              <button
                onClick={handleDownloadPDF}
                style={{
                  background: 'var(--accent-red, #dc2626)',
                  color: '#fff',
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                  transition: 'opacity 0.15s ease',
                }}
                title="Save official team rosters as PDF"
              >
                <span>📄</span>
                <span>DOWNLOAD PDF</span>
              </button>

              <button
                onClick={() => {
                  // Switch to rosters view and trigger export
                  setSummaryView('rosters');
                  setTimeout(() => {
                    handleDownloadImage('official-squad-rosters-section', `${(tournament?.name || 'Tournament').replace(/\s+/g, '_')}_Team_Rosters.png`);
                  }, 100);
                }}
                disabled={isExportingImage}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  border: '1px solid var(--border-subtle)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: isExportingImage ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Download public team rosters as high-resolution PNG image"
              >
                <span>📸</span>
                <span>{isExportingImage ? 'SAVING...' : 'DOWNLOAD IMAGE'}</span>
              </button>

              <button
                onClick={handleExportCSV}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(2, 132, 199, 0.3)',
                }}
                title="Download complete team-wise and player-wise auction report in CSV"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                <span>CSV REPORT</span>
              </button>
            </div>
          </div>

          <div className="team-summary-grid">
            {teams.map((team) => {
              const stats = getTeamStats(team);
              const effectiveHotkey = teamHotkeys?.[team.id] || (team.hotkey && team.hotkey.trim()) || null;
              return (
                <div
                  key={team.id}
                  className="team-summary-card"
                  onClick={() => setSelectedTeam(team)}
                  style={{
                    borderRadius: 14,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                  }}
                >
                  {team.logo ? (
                    <img src={team.logo} alt={team.name} className="team-summary-card__logo" style={{ borderRadius: 10 }} />
                  ) : (
                    <div className="team-summary-card__logo" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
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
                        <span className="team-summary-card__stat-label">Players: </span>
                        <span className="team-summary-card__stat-value">{stats.playerCount}</span>
                      </span>
                      <span>
                        <span className="team-summary-card__stat-label">Remaining: </span>
                        <span className="team-summary-card__stat-value">{stats.remainingSlots}</span>
                      </span>
                    </div>
                    <div className="team-summary-card__sub-stats">
                      <span>MAX BID: ₹{stats.maxBid?.toLocaleString('en-IN')}</span>
                      <span>RESERVE: ₹{stats.reservePoints?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="team-summary-card__balance" style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{stats.balance?.toLocaleString('en-IN')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hidden container to ensure print captures OfficialSquadRosters even if user clicked print from compact tab */}
          <div style={{ display: 'none' }}>
            <OfficialSquadRosters
              tournament={tournament}
              teams={teamsWithStatsAndSlots}
              showExportButtons={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
