'use client';

import React from 'react';

export default function OfficialSquadRosters({
  tournament,
  teams = [],
  onTeamClick,
  onDownloadPDF,
  onDownloadImage,
  isExportingImage = false,
  showExportButtons = true,
  extraHeaderActions = null,
}) {
  const maxAllowed = tournament?.maxPlayers || 15;

  return (
    <div id="official-squad-rosters-section" style={{ marginBottom: 40, width: '100%' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 1,
            margin: '0 0 4px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>🛡️</span>
            <span>OFFICIAL TEAM SQUAD ROSTERS</span>
          </h3>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Each team displays <strong>{maxAllowed} player slots</strong> organized by category requirements • Sold players, winning prices, and remaining purse balances update live
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Tournament Category Quota Summary */}
          {tournament?.categories?.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tournament.categories.map(c => (
                <div
                  key={c.id}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: 'var(--accent-gold)' }}>{c.name}:</span>{' '}
                  <span>Base ₹{c.basePrice?.toLocaleString()}</span>
                  {c.minPerTeam > 0 && (
                    <span style={{ color: '#4ade80', marginLeft: 4 }}>
                      (Min {c.minPerTeam})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Export Action Buttons */}
          {showExportButtons && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="print-hide">
              <button
                onClick={onDownloadPDF}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 15px',
                  borderRadius: 8,
                  background: 'var(--accent-red, #dc2626)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                title="Save official team squad rosters as PDF"
              >
                <span>📄</span>
                <span>Download PDF</span>
              </button>

              <button
                onClick={onDownloadImage}
                disabled={isExportingImage}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 15px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: isExportingImage ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                title="Download high-resolution PNG image of all team squad rosters"
              >
                <span>📸</span>
                <span>{isExportingImage ? 'Saving...' : 'Download Image'}</span>
              </button>

              {extraHeaderActions}
            </div>
          )}
        </div>
      </div>

      {/* Team Boxes Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 20,
      }}>
        {teams.map((team) => {
          return (
            <div
              key={team.id}
              onClick={() => onTeamClick && onTeamClick(team)}
              style={{
                background: 'var(--bg-card)',
                border: `2px solid ${team.color || 'var(--border-subtle)'}`,
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                cursor: onTeamClick ? 'pointer' : 'default',
                transition: onTeamClick ? 'transform 0.15s ease, box-shadow 0.15s ease' : undefined,
              }}
              onMouseEnter={onTeamClick ? (e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.25)';
              } : undefined}
              onMouseLeave={onTeamClick ? (e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
              } : undefined}
            >
              {/* Team Box Header with Team Color Background */}
              <div style={{
                padding: '16px 18px',
                background: team.color || 'var(--accent-purple, #6366f1)',
                borderBottom: '1px solid rgba(0,0,0,0.15)',
                color: '#ffffff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {team.logo ? (
                      <img
                        src={team.logo}
                        alt={team.name}
                        crossOrigin="anonymous"
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 10,
                          objectFit: 'contain',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 58,
                        height: 58,
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.22)',
                        border: '1px solid rgba(255, 255, 255, 0.35)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '1.35rem',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        flexShrink: 0,
                      }}>
                        {team.shortName}
                      </div>
                    )}
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: '1.1rem',
                        color: '#ffffff',
                        textTransform: 'uppercase',
                        textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                        letterSpacing: '0.02em',
                        lineHeight: 1.2,
                      }}>
                        {team.name}
                      </div>
                      <div style={{
                        fontSize: '0.72rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontWeight: 800,
                        letterSpacing: '0.05em',
                        textShadow: '0 1px 1px rgba(0,0,0,0.2)',
                        marginTop: 2,
                      }}>
                        {team.shortName} SQUAD
                      </div>
                    </div>
                  </div>

                  {/* Player Capacity Badge */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: (team.playerCount || 0) >= maxAllowed ? '#dc2626' : 'rgba(0, 0, 0, 0.28)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}>
                      {team.playerCount || 0} / {maxAllowed} PLAYERS
                    </span>
                  </div>
                </div>

                {/* Financial Balance & Min Reserve Display */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  background: 'rgba(0, 0, 0, 0.28)',
                  backdropFilter: 'blur(8px)',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
                }}>
                  <div>
                    <div style={{
                      fontSize: '0.68rem',
                      color: 'rgba(255, 255, 255, 0.85)',
                      textTransform: 'uppercase',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                    }}>
                      REMAINING PURSE
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.3rem',
                      fontWeight: 900,
                      color: '#ffffff',
                      marginTop: 2,
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }}>
                      ₹{(team.balance || 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600 }}>
                      Initial: ₹{(team.purse ?? tournament?.totalPurse ?? 0).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '0.68rem',
                      color: 'rgba(255, 255, 255, 0.85)',
                      textTransform: 'uppercase',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                    }}>
                      MIN RESERVE PURSE
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.2rem',
                      fontWeight: 900,
                      color: '#fef08a',
                      marginTop: 2,
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }}>
                      ₹{team.reservePoints?.toLocaleString('en-IN') || '0'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600 }}>
                      Max Bid: ₹{team.maxBid?.toLocaleString('en-IN') || '0'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Box Rows (Equal to tournament.maxPlayers) */}
              <div style={{
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                flex: 1,
              }}>
                {team.slots?.map((slot) => {
                  if (slot.filled && slot.player) {
                    return (
                      <div
                        key={`slot-${slot.slotNumber}`}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(0, 0, 0, 0.08)',
                          borderRadius: 8,
                          padding: '7px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: 'var(--text-muted, #64748b)',
                            width: 20,
                          }}>
                            #{slot.slotNumber}
                          </span>

                          <span style={{
                            fontSize: '0.62rem',
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(217, 119, 6, 0.14)',
                            color: '#b45309',
                            border: '1px solid rgba(217, 119, 6, 0.28)',
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                          }}>
                            {slot.categoryName?.toUpperCase() || 'PLAYER'}
                          </span>

                          <span
                            className="official-roster-player-name"
                            style={{
                              fontFamily: 'var(--font-primary, sans-serif)',
                              fontWeight: 800,
                              fontSize: '0.94rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              letterSpacing: '0.01em',
                            }}
                          >
                            {slot.player.name}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.92rem',
                            fontWeight: 900,
                            color: '#b45309',
                          }}>
                            ₹{slot.soldPrice?.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={`slot-${slot.slotNumber}`}
                        style={{
                          background: 'rgba(255, 255, 255, 0.015)',
                          border: '1px dashed rgba(0, 0, 0, 0.12)',
                          borderRadius: 8,
                          padding: '7px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          opacity: 0.75,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: 'var(--text-muted, #64748b)',
                            width: 20,
                          }}>
                            #{slot.slotNumber}
                          </span>

                          <span style={{
                            fontSize: '0.62rem',
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: slot.isMandatory ? 'rgba(5, 150, 105, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                            color: slot.isMandatory ? '#059669' : 'var(--text-muted, #64748b)',
                            fontWeight: 700,
                          }}>
                            {slot.isMandatory ? `${slot.categoryName} REQUIRED` : 'OPEN SLOT'}
                          </span>

                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                            {slot.isMandatory ? `Base ₹${slot.basePrice?.toLocaleString()}` : 'Available'}
                          </span>
                        </div>

                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', fontWeight: 700, letterSpacing: 0.5 }}>
                          EMPTY
                        </span>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
