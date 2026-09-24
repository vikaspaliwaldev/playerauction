'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getActiveSponsor, formatSponsorUrl } from '@/lib/sponsorRotation';

function LiveSpectatorContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  
  // Detect display modes
  const isProjector = searchParams.get('mode') === 'projector' || searchParams.get('projector') === 'true' || searchParams.get('tab') === 'projector' || searchParams.get('view') === 'projector';
  const isOverlay = !isProjector && (searchParams.get('overlay') === 'true' || searchParams.get('mode') === 'obs' || searchParams.get('mode') === 'broadcast' || searchParams.get('tab') === 'obs' || searchParams.get('view') === 'obs');

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLiveState = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${id}/public`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTournament(data.tournament);
      }
    } catch (err) {
      console.error('Failed to poll live state:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLiveState();
    // Fast 1.2s polling for real-time live bidding sync
    const interval = setInterval(fetchLiveState, 1200);
    return () => clearInterval(interval);
  }, [fetchLiveState]);

  const auctionState = tournament?.auctionState;
  const teams = tournament?.teams || [];
  const players = tournament?.players || [];
  const sponsors = tournament?.sponsors || [];

  // Multi-sponsor 10-second synchronized rotation tick
  const [rotationTick, setRotationTick] = useState(0);
  useEffect(() => {
    const ticker = setInterval(() => {
      setRotationTick(t => t + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const currentSponsor = useMemo(() => {
    return getActiveSponsor(sponsors, 10);
  }, [sponsors, rotationTick]);

  // Currently active player
  const currentPlayer = useMemo(() => {
    if (!auctionState?.currentPlayerId) return null;
    return players.find(p => p.id === auctionState.currentPlayerId);
  }, [auctionState, players]);

  // Leading team for current bid
  const leadingTeam = useMemo(() => {
    if (!auctionState?.currentTeamId) return null;
    return teams.find(t => t.id === auctionState.currentTeamId);
  }, [auctionState, teams]);

  // Current live bid
  const liveBid = auctionState?.currentBid || currentPlayer?.category?.basePrice || 0;

  // Recent sales (last 8)
  const recentSales = useMemo(() => {
    const sold = players.filter(p => p.status === 'sold' && p.sale);
    return sold
      .sort((a, b) => new Date(b.sale?.createdAt || 0) - new Date(a.sale?.createdAt || 0))
      .slice(0, 8);
  }, [players]);

  // Team summary calculations
  const teamStats = useMemo(() => {
    return teams.map(team => {
      const sales = team.sales || [];
      const spent = sales.reduce((sum, s) => sum + s.soldPrice, 0);
      const balance = team.purse - spent;
      return {
        ...team,
        spent,
        balance,
        playerCount: sales.length,
      };
    });
  }, [teams]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isOverlay ? 'transparent' : 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-primary)',
      }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isOverlay ? 'transparent' : 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-primary)',
      }}>
        <h2>Tournament not found</h2>
      </div>
    );
  }

  // ==========================================
  // MODE 1: BROADCAST & OBS OVERLAY VIEW
  // (Transparent background for OBS Studio / vMix / live stream graphics)
  // ==========================================
  if (isOverlay) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'var(--font-primary, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '30px 40px',
        boxSizing: 'border-box',
      }}>
        {/* Top Sponsor & Tournament Bug in Corner */}
        <div style={{
          position: 'absolute',
          top: 24,
          right: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'rgba(11, 10, 26, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '8px 16px',
          borderRadius: 10,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
        }}>
          {currentSponsor && (() => {
            const sponsorLink = formatSponsorUrl(currentSponsor.url);
            const content = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="sponsor-label-text">
                    {sponsors.length > 1 ? `SPONSOR (${currentSponsor.weight || 33}%)` : 'POWERED BY'}
                  </div>
                  <div className="sponsor-name-text">
                    <span>{currentSponsor.name}</span>
                    {sponsorLink && <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>↗</span>}
                  </div>
                </div>
                <div className="sponsor-logo-box">
                  <img
                    src={currentSponsor.logo}
                    alt={currentSponsor.name}
                    style={{ maxHeight: 36, maxWidth: 110, objectFit: 'contain' }}
                  />
                </div>
              </div>
            );

            return sponsorLink ? (
              <a
                key={currentSponsor.id}
                href={sponsorLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(sponsorLink, '_blank', 'noopener,noreferrer');
                }}
                title={`Visit ${currentSponsor.name} (${sponsorLink})`}
                className="sponsor-banner-capsule"
                style={{ animation: 'fadeIn 0.5s ease' }}
              >
                {content}
              </a>
            ) : (
              <div
                key={currentSponsor.id}
                className="sponsor-banner-capsule"
                style={{ cursor: 'default', animation: 'fadeIn 0.5s ease' }}
              >
                {content}
              </div>
            );
          })()}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
              boxShadow: '0 0 10px #4ade80', display: 'inline-block'
            }} />
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff', letterSpacing: 0.5 }}>
              {tournament.name}
            </span>
          </div>
        </div>

        {/* Lower-Third Broadcast Card */}
        {currentPlayer ? (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 14, 38, 0.95), rgba(26, 23, 62, 0.95))',
            border: '2px solid var(--accent-gold)',
            borderRadius: 18,
            padding: '20px 28px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            maxWidth: 1200,
            margin: '0 auto',
            width: '100%',
            backdropFilter: 'blur(16px)',
          }}>
            {/* Player Avatar */}
            <div style={{
              width: 140,
              height: 168,
              borderRadius: 12,
              overflow: 'hidden',
              border: '3px solid var(--accent-gold)',
              background: '#12112a',
              flexShrink: 0,
              position: 'relative',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}>
              {currentPlayer.photo ? (
                <img
                  src={currentPlayer.photo}
                  alt={currentPlayer.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '3.5rem', opacity: 0.3,
                }}>
                  👤
                </div>
              )}
              <div style={{
                position: 'absolute',
                top: 6,
                left: 6,
                background: 'var(--accent-green)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 10,
              }}>
                #{currentPlayer.playerNumber}
              </div>
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'var(--accent-gold)',
                color: '#000',
                fontSize: '0.65rem',
                fontWeight: 900,
                textAlign: 'center',
                padding: '2px 0',
                letterSpacing: 1,
              }}>
                PLAYER
              </div>
            </div>

            {/* Center Info */}
            <div style={{ flex: 1, color: '#fff' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  background: 'rgba(245, 184, 0, 0.2)',
                  color: 'var(--accent-gold)',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  letterSpacing: 0.5,
                }}>
                  {currentPlayer.category?.name || 'General Tier'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Base: ₹{(currentPlayer.category?.basePrice || 1000).toLocaleString()}
                </span>
              </div>

              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.4rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                margin: '0 0 6px',
                letterSpacing: 1,
                lineHeight: 1.1,
              }}>
                {currentPlayer.name}
              </h2>

              <div style={{ display: 'flex', gap: 14, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {currentPlayer.role && <span>Role: <strong style={{ color: '#fff' }}>{currentPlayer.role}</strong></span>}
                {currentPlayer.battingStyle && <span>Style: <strong style={{ color: '#fff' }}>{currentPlayer.battingStyle}</strong></span>}
                {currentPlayer.age && <span>Age: <strong style={{ color: '#fff' }}>{currentPlayer.age}</strong></span>}
              </div>
            </div>

            {/* Center Live Bid Amount */}
            <div style={{
              background: 'rgba(0,0,0,0.5)',
              border: '2px solid var(--accent-gold)',
              borderRadius: 14,
              padding: '14px 24px',
              textAlign: 'center',
              minWidth: 200,
              boxShadow: 'var(--shadow-glow-gold)',
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                {leadingTeam ? 'CURRENT BID' : 'STARTING BASE'}
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.6rem',
                fontWeight: 900,
                color: 'var(--accent-gold)',
                lineHeight: 1,
                marginTop: 4,
              }}>
                ₹{liveBid.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Right Team Logo Frame (Matches Player Frame Size Proportion) */}
            <div style={{
              width: 140,
              height: 168,
              borderRadius: 12,
              overflow: 'hidden',
              border: `3px solid ${leadingTeam?.color || 'var(--border-subtle)'}`,
              background: '#12112a',
              flexShrink: 0,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 8px 24px',
              textAlign: 'center',
              boxShadow: leadingTeam ? `0 0 20px ${leadingTeam.color || 'var(--accent-gold)'}55` : 'none',
            }}>
              {leadingTeam ? (
                <>
                  <div style={{
                    width: 60, height: 60, borderRadius: 8, overflow: 'hidden',
                    background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6,
                  }}>
                    {leadingTeam.logo ? (
                      <img src={leadingTeam.logo} alt={leadingTeam.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: leadingTeam.color || 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.2rem' }}>
                        {leadingTeam.shortName}
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leadingTeam.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                    ₹{leadingTeam.purse?.toLocaleString('en-IN')} Left
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: leadingTeam.color || 'var(--accent-gold)', color: '#000',
                    fontSize: '0.65rem', fontWeight: 900, textAlign: 'center', padding: '2px 0', letterSpacing: 0.5,
                  }}>
                    LEADING BIDDER
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', padding: '0 6px' }}>
                  <div style={{ fontSize: '1.8rem', opacity: 0.4, marginBottom: 4 }}>🛡️</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>WAITING</div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.7 }}>FOR BID</div>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)',
                    fontSize: '0.65rem', fontWeight: 800, textAlign: 'center', padding: '2px 0',
                  }}>
                    BIDDING TEAM
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(11, 10, 26, 0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 14,
            padding: '14px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            maxWidth: 600,
            margin: '0 auto',
            backdropFilter: 'blur(10px)',
            color: '#fff',
          }}>
            <span style={{ fontSize: '1.4rem' }}>🏏</span>
            <span style={{ fontWeight: 800, letterSpacing: 1, fontSize: '1rem', color: 'var(--accent-gold)' }}>
              LIVE AUCTION • WAITING FOR NEXT PLAYER
            </span>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // MODE 2: PROJECTOR / OVERLAY STAGE VIEW
  // (Full-screen cinematic stage view for projectors & auditorium LED walls)
  // ==========================================
  if (isProjector) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#070614',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-primary, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 36px',
        boxSizing: 'border-box',
      }}>
        <div className="auction-bg" />
        <div className="geometric-frame" />

        {/* Projector Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 10,
          borderBottom: '2px solid rgba(255,255,255,0.1)',
          paddingBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {tournament.logo ? (
              <img src={tournament.logo} alt="Logo" style={{ height: 60, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.4rem' }}>
                {tournament.name.substring(0, 3)}
              </div>
            )}
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, margin: 0, letterSpacing: 1 }}>
                {tournament.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: 1.5, color: '#4ade80' }}>
                  STAGE PROJECTOR LIVE DISPLAY
                </span>
              </div>
            </div>
          </div>

          {/* Sponsor Banner Prominently on Projector (Rotating every 10s by weight) */}
          {currentSponsor && (() => {
            const sponsorLink = formatSponsorUrl(currentSponsor.url);
            const content = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="sponsor-label-text" style={{ fontSize: '0.72rem' }}>
                    {sponsors.length > 1 ? `TITLE SPONSOR (${currentSponsor.weight || 33}% SHARE)` : 'TITLE SPONSOR'}
                  </div>
                  <div className="sponsor-name-text" style={{ fontSize: '1rem' }}>
                    <span>{currentSponsor.name}</span>
                    {sponsorLink && <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>↗</span>}
                  </div>
                </div>
                <div className="sponsor-logo-box" style={{ padding: '5px 12px' }}>
                  <img
                    src={currentSponsor.logo}
                    alt={currentSponsor.name}
                    style={{ maxHeight: 46, maxWidth: 150, objectFit: 'contain' }}
                  />
                </div>
              </div>
            );

            return sponsorLink ? (
              <a
                key={currentSponsor.id}
                href={sponsorLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(sponsorLink, '_blank', 'noopener,noreferrer');
                }}
                title={`Visit ${currentSponsor.name} (${sponsorLink})`}
                className="sponsor-banner-capsule"
                style={{ padding: '8px 20px', borderRadius: 12, animation: 'fadeIn 0.5s ease' }}
              >
                {content}
              </a>
            ) : (
              <div
                key={currentSponsor.id}
                className="sponsor-banner-capsule"
                style={{ padding: '8px 20px', borderRadius: 12, cursor: 'default', animation: 'fadeIn 0.5s ease' }}
              >
                {content}
              </div>
            );
          })()}

          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⛶ FULLSCREEN
          </button>
        </header>

        {/* Center Arena Head-to-Head */}
        <div style={{ position: 'relative', zIndex: 10, margin: '20px auto', width: '100%', maxWidth: 1300 }}>
          {currentPlayer ? (
            <div style={{
              background: 'rgba(18, 17, 42, 0.75)',
              border: '2px solid var(--border-gold)',
              borderRadius: 24,
              padding: '36px 44px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 36,
            }}>
              {/* Left: Player Avatar (240px x 290px) */}
              <div style={{
                width: 240,
                height: 290,
                borderRadius: 16,
                overflow: 'hidden',
                border: '4px solid var(--accent-gold)',
                background: '#12112a',
                flexShrink: 0,
                position: 'relative',
                boxShadow: 'var(--shadow-glow-gold)',
              }}>
                {currentPlayer.photo ? (
                  <img
                    src={currentPlayer.photo}
                    alt={currentPlayer.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', opacity: 0.3 }}>
                    👤
                  </div>
                )}
                <div style={{
                  position: 'absolute', top: 10, left: 10,
                  background: 'var(--accent-green)', color: '#fff',
                  width: 44, height: 44, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                }}>
                  #{currentPlayer.playerNumber}
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'var(--accent-gold)', color: '#000',
                  fontWeight: 900, fontSize: '0.8rem', textAlign: 'center', padding: '4px 0', letterSpacing: 1.5,
                }}>
                  PLAYER
                </div>
              </div>

              {/* Center: Details & Large Glowing Bid */}
              <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '6px 16px',
                  borderRadius: 20,
                  background: 'rgba(245, 184, 0, 0.15)',
                  color: 'var(--accent-gold)',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  marginBottom: 10,
                }}>
                  {currentPlayer.category?.name || 'General Tier'} • BASE ₹{(currentPlayer.category?.basePrice || 1000).toLocaleString()}
                </div>

                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '3.4rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  margin: '0 0 10px',
                  letterSpacing: 1.5,
                  lineHeight: 1.1,
                  textShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
                }}>
                  {currentPlayer.name}
                </h2>

                <div style={{ display: 'flex', gap: 20, color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: 20 }}>
                  {currentPlayer.role && <span>Role: <strong style={{ color: '#fff' }}>{currentPlayer.role}</strong></span>}
                  {currentPlayer.battingStyle && <span>Style: <strong style={{ color: '#fff' }}>{currentPlayer.battingStyle}</strong></span>}
                  {currentPlayer.age && <span>Age: <strong style={{ color: '#fff' }}>{currentPlayer.age}</strong></span>}
                </div>

                {/* Big Live Bid Box */}
                <div style={{
                  background: 'rgba(0,0,0,0.6)',
                  border: '2px solid var(--accent-gold)',
                  borderRadius: 18,
                  padding: '16px 36px',
                  minWidth: 320,
                  boxShadow: 'var(--shadow-glow-gold)',
                }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 800 }}>
                    {leadingTeam ? 'CURRENT HIGHEST BID' : 'STARTING BASE PRICE'}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '3.6rem',
                    fontWeight: 900,
                    color: 'var(--accent-gold)',
                    lineHeight: 1.1,
                    textShadow: 'var(--shadow-glow-gold)',
                  }}>
                    ₹{liveBid.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Right: Leading Team Frame (EXACT SAME 240px x 290px SIZE) */}
              <div style={{
                width: 240,
                height: 290,
                borderRadius: 16,
                overflow: 'hidden',
                border: `4px solid ${leadingTeam?.color || 'var(--border-subtle)'}`,
                background: '#12112a',
                flexShrink: 0,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 14px 34px',
                textAlign: 'center',
                boxShadow: leadingTeam ? `0 0 35px ${leadingTeam.color || 'var(--accent-gold)'}66` : 'none',
              }}>
                {leadingTeam ? (
                  <>
                    <div style={{
                      width: 100, height: 100, borderRadius: 12, overflow: 'hidden',
                      background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 10, border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      {leadingTeam.logo ? (
                        <img src={leadingTeam.logo} alt={leadingTeam.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: leadingTeam.color || 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '2rem' }}>
                          {leadingTeam.shortName}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', color: '#fff', textTransform: 'uppercase', marginBottom: 4 }}>
                      {leadingTeam.name}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                      Purse Left: ₹{leadingTeam.purse?.toLocaleString('en-IN')}
                    </div>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: leadingTeam.color || 'var(--accent-gold)', color: '#000',
                      fontWeight: 900, fontSize: '0.8rem', textAlign: 'center', padding: '4px 0', letterSpacing: 1.5,
                    }}>
                      LEADING BIDDER
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.35, marginBottom: 8 }}>🛡️</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                      WAITING FOR BID
                    </div>
                    <div style={{ fontSize: '0.78rem', marginTop: 4, opacity: 0.7 }}>
                      No team has placed a bid yet
                    </div>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)',
                      fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', padding: '4px 0',
                    }}>
                      BIDDING TEAM
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(18, 17, 42, 0.75)',
              border: '2px solid var(--border-subtle)',
              borderRadius: 24,
              padding: '80px 40px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '4.5rem', marginBottom: 16 }}>🏏</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 900, marginBottom: 12 }}>
                AUCTION IN PROGRESS
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: 600, margin: '0 auto' }}>
                Waiting for the auctioneer to draw the next player to the block.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Ticker: Recent Sales */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          background: 'rgba(11, 10, 26, 0.8)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 20px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          overflowX: 'auto',
        }}>
          <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent-gold)', letterSpacing: 1, whiteSpace: 'nowrap' }}>
            RECENT SALES:
          </span>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
            {recentSales.map(p => {
              const team = teams.find(t => t.id === p.sale?.teamId);
              return (
                <div key={p.id} style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  padding: '4px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.85rem' }}>{p.name}</span>
                  <span style={{ color: team?.color || 'var(--accent-cyan)', fontSize: '0.8rem', fontWeight: 700 }}>
                    → {team?.shortName} (₹{(p.sale?.soldPrice || 0).toLocaleString()})
                  </span>
                </div>
              );
            })}
            {recentSales.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No players sold yet</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // MODE 3: PUBLIC LIVE SCREEN (Default Spectator Portal)
  // ==========================================
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', position: 'relative', overflowX: 'hidden', fontFamily: 'var(--font-primary)' }}>
      <div className="auction-bg" />
      <div className="geometric-frame" />

      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        position: 'relative',
        zIndex: 10,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(14, 18, 36, 0.85)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {tournament.logo ? (
            <img src={tournament.logo} alt="Logo" style={{ height: 48, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
              {tournament.name.substring(0, 3)}
            </div>
          )}
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              {tournament.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 8px #4ade80',
              }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 1, color: '#4ade80' }}>
                LIVE AUCTION BROADCAST
              </span>
            </div>
          </div>
        </div>

        {/* Sponsor Banner on Public Screen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {currentSponsor && (() => {
            const sponsorLink = formatSponsorUrl(currentSponsor.url);
            const content = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="sponsor-label-text">
                    {sponsors.length > 1 ? `TITLE SPONSOR (${currentSponsor.weight || 33}%)` : 'TITLE SPONSOR'}
                  </div>
                  <div className="sponsor-name-text">
                    <span>{currentSponsor.name}</span>
                    {sponsorLink && <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>↗</span>}
                  </div>
                </div>
                <div className="sponsor-logo-box">
                  <img
                    src={currentSponsor.logo}
                    alt={currentSponsor.name}
                    style={{ maxHeight: 32, maxWidth: 100, objectFit: 'contain' }}
                  />
                </div>
              </div>
            );

            return sponsorLink ? (
              <a
                key={currentSponsor.id}
                href={sponsorLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(sponsorLink, '_blank', 'noopener,noreferrer');
                }}
                title={`Visit ${currentSponsor.name} (${sponsorLink})`}
                className="sponsor-banner-capsule"
                style={{ animation: 'fadeIn 0.5s ease' }}
              >
                {content}
              </a>
            ) : (
              <div
                key={currentSponsor.id}
                className="sponsor-banner-capsule"
                style={{ cursor: 'default', animation: 'fadeIn 0.5s ease' }}
              >
                {content}
              </div>
            );
          })()}

          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            ⛶ FULLSCREEN
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 24,
        padding: '24px 32px',
        maxWidth: 1600,
        margin: '0 auto',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Left Column: Live Arena */}
        <div>
          {currentPlayer ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-gold)',
              borderRadius: 18,
              padding: 28,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {/* Head-to-Head 3-column layout */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
              }}>
                {/* Left: Player Avatar (200px x 240px) */}
                <div style={{
                  position: 'relative',
                  width: 200,
                  height: 240,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)',
                  border: '3px solid var(--accent-gold)',
                  boxShadow: 'var(--shadow-glow-gold)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {currentPlayer.photo ? (
                    <img
                      src={currentPlayer.photo}
                      alt={currentPlayer.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ fontSize: '4rem', opacity: 0.3 }}>
                      👤
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'var(--accent-green)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                  }}>
                    #{currentPlayer.playerNumber}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    background: 'var(--accent-gold)', color: '#000',
                    fontSize: '0.68rem', fontWeight: 900, textAlign: 'center', padding: '3px 0', letterSpacing: 1,
                  }}>
                    PLAYER
                  </div>
                </div>

                {/* Center: Details & Live Bid Amount */}
                <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: 20,
                    background: 'rgba(245, 184, 0, 0.15)',
                    color: 'var(--accent-gold)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    marginBottom: 8,
                  }}>
                    {currentPlayer.category?.name || 'Category'} • BASE ₹{(currentPlayer.category?.basePrice || 1000).toLocaleString()}
                  </div>

                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '2.5rem',
                    fontWeight: 800,
                    margin: '0 0 8px',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>
                    {currentPlayer.name}
                  </h2>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {currentPlayer.role && <span>Role: <strong style={{ color: '#fff' }}>{currentPlayer.role}</strong></span>}
                    {currentPlayer.battingStyle && <span>Batting: <strong style={{ color: '#fff' }}>{currentPlayer.battingStyle}</strong></span>}
                    {currentPlayer.age && <span>Age: <strong style={{ color: '#fff' }}>{currentPlayer.age}</strong></span>}
                  </div>

                  {/* Current Bid Display */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: 14,
                    padding: '14px 28px',
                    minWidth: 240,
                    boxShadow: 'var(--shadow-glow-gold)',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                      {leadingTeam ? 'CURRENT HIGHEST BID' : 'STARTING BASE PRICE'}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '2.8rem',
                      fontWeight: 900,
                      color: 'var(--accent-gold)',
                      lineHeight: 1,
                      marginTop: 4,
                      textShadow: 'var(--shadow-glow-gold)',
                    }}>
                      ₹{liveBid.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Right: Leading Team Logo / Avatar (EXACT SAME 200px x 240px SIZE) */}
                <div style={{
                  position: 'relative',
                  width: 200,
                  height: 240,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--bg-card)',
                  border: `3px solid ${leadingTeam?.color || 'var(--border-subtle)'}`,
                  boxShadow: leadingTeam ? `0 0 25px ${leadingTeam.color || 'var(--accent-gold)'}55` : 'none',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px 12px 28px',
                  textAlign: 'center',
                }}>
                  {leadingTeam ? (
                    <>
                      <div style={{
                        width: 80, height: 80, borderRadius: 8, overflow: 'hidden',
                        background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 8, border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        {leadingTeam.logo ? (
                          <img src={leadingTeam.logo} alt={leadingTeam.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: leadingTeam.color || 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.6rem' }}>
                            {leadingTeam.shortName}
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#fff', textTransform: 'uppercase', marginBottom: 4, maxWidth: 175, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {leadingTeam.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                        Purse: ₹{leadingTeam.purse?.toLocaleString('en-IN')}
                      </div>
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: leadingTeam.color || 'var(--accent-gold)', color: '#000',
                        fontSize: '0.68rem', fontWeight: 900, textAlign: 'center', padding: '3px 0', letterSpacing: 1,
                      }}>
                        LEADING BIDDER
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2.5rem', opacity: 0.35, marginBottom: 6 }}>🛡️</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 800 }}>
                        WAITING FOR BID
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 2 }}>
                        No team bid placed yet
                      </div>
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)',
                        fontSize: '0.68rem', fontWeight: 800, textAlign: 'center', padding: '3px 0',
                      }}>
                        BIDDING TEAM
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 16,
              padding: 60,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏏</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 8 }}>
                AUCTION IN PROGRESS
              </h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Waiting for the auctioneer to draw the next player to the block.
              </p>
            </div>
          )}

          {/* Recent Sales Ticker */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              RECENT SALES
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {recentSales.map(p => {
                const team = teams.find(t => t.id === p.sale?.teamId);
                return (
                  <div key={p.id} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--accent-gold)',
                      color: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                    }}>
                      #{p.playerNumber}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: team?.color || 'var(--text-muted)' }}>
                        {team?.shortName} • ₹{(p.sale?.soldPrice || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
              {recentSales.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No players sold yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Teams Purse & Squad Standings */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: 20,
          height: 'fit-content',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 16,
            paddingBottom: 8,
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            TEAM PURSES & SQUADS
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {teamStats.map(team => (
              <div key={team.id} style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
                padding: 12,
                borderLeft: `4px solid ${team.color || '#fff'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{team.name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{team.playerCount} Players</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Purse Left:</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-green)' }}>
                    ₹{team.balance.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveSpectatorPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="loading-spinner" />
      </div>
    }>
      <LiveSpectatorContent />
    </Suspense>
  );
}
