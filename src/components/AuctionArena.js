'use client';

import { useState, useRef, useEffect } from 'react';
import SpinnerWheel from './SpinnerWheel';
import { getBidIncrement, isTeamCategoryQuotaReached, getTeamCategoryCount } from '@/lib/auctionRules';
import BidRulesModal from '@/components/BidRulesModal';
import { playTimerWarningSound } from '@/lib/soundEffects';

export default function AuctionArena({
  tournament,
  currentPlayer,
  currentBid,
  currentTeam,
  stampType,
  onDrawPlayer,
  onPlaceBid,
  onUpdateBid,
  onSelectTeam,
  onSell,
  onUnsold,
  onReAuction,
  onIncrementBid,
  getTeamStats,
  onRefresh,
  teamHotkeys,
}) {
  const [playerNumberInput, setPlayerNumberInput] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [showBidRules, setShowBidRules] = useState(false);
  const inputRef = useRef(null);

  // Stopwatch & Bid Timer state
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [maxBidTime, setMaxBidTime] = useState(30); // 30s default
  const [timerVisible, setTimerVisible] = useState(false);

  const currentIncrement = getBidIncrement(currentBid, tournament);

  const teams = tournament?.teams || [];
  const players = tournament?.players || [];
  const availableNumbers = players
    .filter(p => p.status === 'available')
    .map(p => p.playerNumber);

  const isSold = currentPlayer?.status === 'sold';
  const isUnsold = currentPlayer?.status === 'unsold';
  const isCompleted = tournament?.status === 'completed';
  const canReAuction = !isCompleted && (isSold || isUnsold || stampType);
  const soldTeam = isSold
    ? (currentPlayer.sale?.team || currentPlayer.soldToTeam || teams.find(t => t.id === currentPlayer.teamId || t.id === currentPlayer.sale?.teamId))
    : null;

  // Auto-reset stopwatch on every new bid amount or bidder change
  const prevBidRef = useRef(currentBid);
  const prevTeamRef = useRef(currentTeam?.id);

  useEffect(() => {
    if (currentBid !== prevBidRef.current || currentTeam?.id !== prevTeamRef.current) {
      prevBidRef.current = currentBid;
      prevTeamRef.current = currentTeam?.id;
      setTimerSeconds(0);
    }
  }, [currentBid, currentTeam]);

  // Reset timer on new player
  const prevPlayerIdRef = useRef(currentPlayer?.id);
  useEffect(() => {
    if (currentPlayer?.id !== prevPlayerIdRef.current) {
      prevPlayerIdRef.current = currentPlayer?.id;
      setTimerSeconds(0);
      setTimerActive(false);
    }
  }, [currentPlayer?.id]);

  // Pause timer when player is sold or unsold
  useEffect(() => {
    if (isSold || isUnsold || stampType) {
      setTimerActive(false);
    }
  }, [isSold, isUnsold, stampType]);

  const onSellRef = useRef(onSell);
  onSellRef.current = onSell;
  const onUnsoldRef = useRef(onUnsold);
  onUnsoldRef.current = onUnsold;
  const currentTeamRef = useRef(currentTeam);
  currentTeamRef.current = currentTeam;
  const soundEnabled = !!tournament?.auctionState?.fireworkAudio;

  // Stopwatch ticking & max bid time auto-sell/auto-unsold
  useEffect(() => {
    if (!timerActive || !currentPlayer || isSold || isUnsold || !!stampType) {
      return;
    }

    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        const next = prev + 1;
        if (maxBidTime > 0 && maxBidTime - next <= 3 && maxBidTime - next >= 0) {
          playTimerWarningSound(soundEnabled);
        }
        if (maxBidTime > 0 && next >= maxBidTime) {
          setTimerActive(false);
          // On expiry: sell to current bidder or mark unsold if no bid
          if (currentTeamRef.current) {
            onSellRef.current();
          } else {
            onUnsoldRef.current();
          }
          return next;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, currentPlayer?.id, isSold, isUnsold, stampType, maxBidTime, soundEnabled]);

  const handleNewPlayer = () => {
    if (isCompleted) {
      alert('Auction is completed and locked. Please reopen auction from Manage Panel first.');
      return;
    }
    if (isSpinning) return;
    if (currentPlayer?.status === 'available' && currentTeam && !confirm('A bid is currently in progress for this player. Are you sure you want to cancel the bidding and spin for a new player?')) {
      return;
    }
    setIsSpinning(true);
    // Spin animation, then draw after delay
    setTimeout(() => {
      onDrawPlayer();
      setIsSpinning(false);
    }, 1800);
  };

  const handlePlayerNumberSubmit = (e) => {
    e.preventDefault();
    if (isCompleted) {
      alert('Auction is completed and locked. Please reopen auction from Manage Panel first.');
      return;
    }
    if (playerNumberInput) {
      onDrawPlayer(parseInt(playerNumberInput));
      setPlayerNumberInput('');
    }
  };

  return (
    <>
      {/* High-Visibility Digital Stopwatch HUD */}
      {(timerVisible || timerActive) && (
        <div
          className="auction-stopwatch-hud"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(11, 10, 26, 0.96))',
            border: `2px solid ${
              maxBidTime > 0 && maxBidTime - timerSeconds <= 5 && timerActive
                ? '#ef4444'
                : timerActive
                ? '#22c55e'
                : 'var(--border-gold)'
            }`,
            borderRadius: 12,
            padding: '10px 20px',
            marginBottom: 16,
            boxShadow: timerActive
              ? (maxBidTime > 0 && maxBidTime - timerSeconds <= 5
                  ? '0 0 25px rgba(239, 68, 68, 0.55)'
                  : '0 0 20px rgba(34, 197, 94, 0.35)')
              : '0 4px 20px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Left: Stopwatch Title & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.6rem' }}>⏱️</span>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                AUCTION STOPWATCH
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: timerActive ? '#22c55e' : 'var(--text-muted)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: timerActive ? '#22c55e' : '#64748b',
                  boxShadow: timerActive ? '0 0 8px #22c55e' : 'none'
                }} />
                {timerActive ? 'LIVE (Resets to 00:00 on each bid)' : 'PAUSED'}
              </div>
            </div>
          </div>

          {/* Center: Large Digital Timer Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '2.5rem',
              fontWeight: 900,
              color: maxBidTime > 0 && maxBidTime - timerSeconds <= 5 && timerActive ? '#ef4444' : '#fff',
              letterSpacing: 3,
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
              background: 'rgba(0,0,0,0.5)',
              padding: '2px 18px',
              borderRadius: 8,
              border: `1px solid ${maxBidTime > 0 && maxBidTime - timerSeconds <= 5 && timerActive ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
            }}>
              {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
              {String(timerSeconds % 60).padStart(2, '0')}
            </div>

            {maxBidTime > 0 && (
              <div style={{ textAlign: 'left', minWidth: 80 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  MAX BID TIME
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--accent-gold)' }}>
                  {maxBidTime}s Limit
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: maxBidTime - timerSeconds <= 5 ? '#ef4444' : '#4ade80',
                  fontWeight: 800,
                }}>
                  {Math.max(0, maxBidTime - timerSeconds)}s remaining
                </div>
              </div>
            )}
          </div>

          {/* Right: Quick Controls & Max Time Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setTimerVisible(true);
                setTimerActive(!timerActive);
              }}
              style={{
                background: timerActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)',
                border: `1px solid ${timerActive ? '#ef4444' : '#22c55e'}`,
                color: timerActive ? '#ef4444' : '#22c55e',
                padding: '8px 16px',
                borderRadius: 6,
                fontWeight: 900,
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{timerActive ? '⏸ PAUSE' : '▶ START'}</span>
            </button>

            <button
              type="button"
              onClick={() => setTimerSeconds(0)}
              title="Reset to 00:00"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: 6,
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              ↻ RESET
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>LIMIT:</span>
              <select
                value={maxBidTime}
                onChange={(e) => setMaxBidTime(Number(e.target.value))}
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid var(--border-gold)',
                  color: 'var(--accent-gold)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                title="When time expires, player is sold to highest bidder or marked unsold"
              >
                <option value={15}>15 sec</option>
                <option value={20}>20 sec</option>
                <option value={30}>30 sec (Default)</option>
                <option value={45}>45 sec</option>
                <option value={60}>60 sec</option>
                <option value={0}>Manual (No Auto-Sell)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setTimerActive(false);
                setTimerVisible(false);
              }}
              title="Close Stopwatch"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.1rem',
                padding: '4px 8px',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main player display area */}
      <div className="player-display">
        {/* Spinner Wheel (Clickable to spin / re-spin) */}
        <div
          className="spinner-wheel-container"
          onClick={handleNewPlayer}
          style={{ cursor: isSpinning ? 'wait' : 'pointer' }}
          title={currentPlayer ? "Click wheel to re-spin for another player" : "Click wheel to spin for a player"}
        >
          <SpinnerWheel
            numbers={availableNumbers}
            isSpinning={isSpinning}
            selectedNumber={currentPlayer?.playerNumber}
          />
          <div className="spinner-re-spin-hint">
            {isSpinning ? 'SPINNING...' : currentPlayer ? '↻ CLICK WHEEL TO RE-SPIN' : '▶ CLICK WHEEL TO SPIN'}
          </div>
        </div>

        {/* Player Card or Active Spinning Display */}
        {isSpinning ? (
          <div
            className="player-card-auction"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 380,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🎡</div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', fontSize: '2rem', letterSpacing: 2 }}>
              SPINNING WHEEL...
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: 8 }}>
              Selecting new player from available pool...
            </p>
          </div>
        ) : currentPlayer ? (
          <div className="player-card-auction">
            <div className="player-card-auction__number">
              #{currentPlayer.playerNumber}
            </div>

            {/* Persistent Post-Auction Notification Banner */}
            {isSold && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 184, 0, 0.25), rgba(245, 184, 0, 0.08))',
                border: '1px solid var(--accent-gold)',
                borderRadius: 8,
                padding: '8px 16px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.2rem' }}>🏆</span>
                  <span style={{ fontWeight: 900, color: 'var(--accent-gold)', fontSize: '1rem', letterSpacing: 1 }}>
                    SOLD TO {soldTeam?.name || 'FRANCHISE'} FOR ₹{(currentPlayer.sale?.soldPrice || currentPlayer.soldPrice || currentBid).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Player is locked. Click <strong>RE-AUCTION</strong> to undo, or spin for next player.
                </div>
              </div>
            )}

            {isUnsold && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid var(--accent-red)',
                borderRadius: 8,
                padding: '8px 16px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.2rem' }}>❌</span>
                  <span style={{ fontWeight: 900, color: 'var(--accent-red)', fontSize: '1rem', letterSpacing: 1 }}>
                    PLAYER UNSOLD
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click <strong>RE-AUCTION</strong> to place bids again, or spin for next player.
                </div>
              </div>
            )}

            <div className="player-card-auction__arena-grid">
              {/* LEFT: Player Avatar Frame (200px x 240px) */}
              <div className="player-card-auction__side-col">
                <div className="player-card-auction__photo-frame">
                  {currentPlayer.photo ? (
                    <img src={currentPlayer.photo} alt={currentPlayer.name} />
                  ) : (
                    <div className="player-card-auction__placeholder-avatar">
                      👤
                    </div>
                  )}
                  <div className="player-card-auction__frame-label player-label">
                    PLAYER
                  </div>
                </div>
              </div>

              {/* CENTER: Player Details & Current Bid Display */}
              <div className="player-card-auction__info">
                <h2 className="player-card-auction__name">{currentPlayer.name}</h2>
                <div className="player-card-auction__details">
                  {currentPlayer.category?.name && (
                    <span className="player-card-auction__detail-line">
                      {currentPlayer.category.name}
                    </span>
                  )}
                  {currentPlayer.role && (
                    <span className="player-card-auction__detail-line">
                      {currentPlayer.role}
                    </span>
                  )}
                  {currentPlayer.battingStyle && (
                    <span className="player-card-auction__detail-line">
                      {currentPlayer.battingStyle}
                    </span>
                  )}
                  {currentPlayer.bowlingStyle && (
                    <span className="player-card-auction__detail-line">
                      {currentPlayer.bowlingStyle}
                    </span>
                  )}
                  {currentPlayer.age && (
                    <span className="player-card-auction__detail-line">
                      AGE : {currentPlayer.age}
                    </span>
                  )}
                </div>

                <div className="player-card-auction__bid-box">
                  <div className="player-card-auction__bid-label">
                    {isSold ? 'FINAL WINNING BID' : currentTeam ? 'CURRENT HIGHEST BID' : 'STARTING BASE PRICE'}
                  </div>
                  <div className="player-card-auction__base-price">
                    ₹{(isSold ? (currentPlayer.sale?.soldPrice || currentPlayer.soldPrice || currentBid) : currentBid).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* RIGHT: Team Logo / Avatar Frame (EXACT SAME SIZE: 200px x 240px) */}
              <div className="player-card-auction__side-col">
                {(() => {
                  const displayTeam = currentTeam || soldTeam;
                  return (
                    <div
                      className={`player-card-auction__team-frame ${displayTeam ? 'has-bidder' : 'no-bidder'}`}
                      style={displayTeam ? {
                        borderColor: displayTeam.color || 'var(--accent-gold)',
                        boxShadow: `0 0 25px ${displayTeam.color || 'var(--accent-gold)'}40`,
                      } : {}}
                    >
                      {displayTeam ? (
                        <div className="team-frame-content">
                          <div className="team-frame-logo-wrap">
                            {displayTeam.logo ? (
                              <img src={displayTeam.logo} alt={displayTeam.name} className="team-frame-img" />
                            ) : (
                              <div
                                className="team-frame-crest"
                                style={{ background: displayTeam.color || 'var(--accent-purple)' }}
                              >
                                {displayTeam.shortName}
                              </div>
                            )}
                          </div>
                          <div className="team-frame-name">{displayTeam.name}</div>
                          {(teamHotkeys?.[displayTeam.id] || displayTeam.hotkey) && (
                            <div className="team-frame-hotkey">
                              ⚡ KEY: [{(teamHotkeys?.[displayTeam.id] || displayTeam.hotkey).toUpperCase()}]
                            </div>
                          )}
                          <div className="team-frame-purse">
                            Purse: ₹{displayTeam.purse?.toLocaleString('en-IN')}
                          </div>
                          <div
                            className="player-card-auction__frame-label team-label"
                            style={{ background: displayTeam.color || 'var(--accent-gold)', color: '#000' }}
                          >
                            {isSold ? 'ACQUIRED BY' : 'LEADING BIDDER'}
                          </div>
                        </div>
                      ) : (
                        <div className="team-frame-placeholder">
                          <div className="team-placeholder-icon">🛡️</div>
                          <div className="team-placeholder-title">
                            {isUnsold ? 'UNSOLD' : 'WAITING FOR BID'}
                          </div>
                          <div className="team-placeholder-sub">
                            {isUnsold ? 'Click Re-Auction or Next Player' : 'Click team below or press shortcut key to place bid'}
                          </div>
                          <div className="player-card-auction__frame-label team-label waiting">
                            {isUnsold ? 'NO BIDDER' : 'BIDDING TEAM'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">🏏</div>
            <p>Click <strong>NEW PLAYER</strong> to start the auction</p>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="control-bar">
        {/* Player Number Input */}
        <form onSubmit={handlePlayerNumberSubmit} style={{ display: 'flex', gap: '4px' }}>
          <input
            ref={inputRef}
            type="number"
            className="control-bar__input"
            placeholder="PNo"
            value={playerNumberInput}
            onChange={(e) => setPlayerNumberInput(e.target.value)}
            min="1"
          />
        </form>

        {/* New Player / Re-Spin Button */}
        <button
          className="control-bar__btn control-bar__btn--new-player"
          onClick={handleNewPlayer}
          disabled={isSpinning}
          title={currentPlayer ? "Spin again to choose a different player" : "Spin wheel to draw a player"}
        >
          {currentPlayer ? '↻ RE-SPIN' : 'NEW PLAYER'}
        </button>

        {/* Editable Points / Final Price Input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 8, color: 'var(--accent-gold)', fontWeight: 800, fontSize: '0.85rem', pointerEvents: 'none' }}>
            ₹
          </span>
          <input
            type="number"
            className="control-bar__input"
            style={{
              width: 110,
              height: 34,
              paddingLeft: 22,
              fontWeight: 800,
              fontSize: '0.95rem',
              color: 'var(--accent-gold)',
              background: 'rgba(245, 184, 0, 0.15)',
              border: '1px solid var(--accent-gold)',
              borderRadius: 4,
              textAlign: 'center',
            }}
            title="Type any final / fixed price here"
            value={currentBid || ''}
            onChange={(e) => onUpdateBid && onUpdateBid(parseInt(e.target.value) || 0)}
            disabled={isCompleted || isSold || isUnsold}
          />
        </div>

        {/* Quick Increment Button */}
        <button
          type="button"
          className="control-bar__btn"
          onClick={onIncrementBid}
          disabled={isCompleted || !currentPlayer || !!stampType || isSold || isUnsold}
          title={`Click or press ↑ (Up Arrow) to increment bid by +₹${currentIncrement.toLocaleString()} (${tournament?.incrementType === 'slabs' ? 'Tiered Slab' : 'Flat'})`}
          style={{
            background: 'rgba(139, 92, 246, 0.18)',
            border: '1px solid var(--aa-primary, #8b5cf6)',
            color: 'var(--aa-primary, #8b5cf6)',
            fontWeight: 800,
            fontSize: '0.85rem',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>+₹{currentIncrement.toLocaleString()}</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>↑</span>
        </button>

        {/* Bid Rules Quick Button */}
        <button
          type="button"
          onClick={() => setShowBidRules(true)}
          title="Configure Bid Increment Rules (Flat vs Tiered Slabs)"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            color: 'var(--accent-gold)',
            height: 34,
            padding: '0 8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <span>📈</span>
          <span style={{ fontSize: '0.75rem' }}>Rules</span>
        </button>

        {/* Team Bid Buttons with guaranteed unique hotkey shortcuts & category quota checks */}
        {teams.map((team) => {
          const effectiveHotkey = teamHotkeys?.[team.id] || (team.hotkey && team.hotkey.trim()) || null;
          const currentCat = tournament?.categories?.find(c => c.id === currentPlayer?.categoryId);
          const isQuotaReached = isTeamCategoryQuotaReached(team, currentPlayer?.categoryId, tournament);
          const catCount = currentCat?.maxPerTeam ? getTeamCategoryCount(team, currentPlayer?.categoryId, tournament) : 0;

          const buttonTitle = isCompleted
            ? 'Auction is completed and locked'
            : isQuotaReached
            ? `Max quota reached: ${team.name} already has ${catCount}/${currentCat.maxPerTeam} from ${currentCat.name}`
            : effectiveHotkey
            ? `Shortcut: Press [${effectiveHotkey.toUpperCase()}] or click to bid for ${team.name}`
            : `Bid for ${team.name}`;

          return (
            <button
              key={team.id}
              className={`control-bar__btn control-bar__btn--team ${currentTeam?.id === team.id ? 'bidding' : ''}`}
              onClick={() => onPlaceBid(team)}
              disabled={isCompleted || !currentPlayer || !!stampType || isSold || isUnsold || isQuotaReached}
              title={buttonTitle}
              style={{
                borderBottom: team.color ? `3px solid ${team.color}` : undefined,
                position: 'relative',
                opacity: (isQuotaReached || isCompleted) ? 0.38 : 1,
                cursor: (isQuotaReached || isCompleted) ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ fontWeight: 800 }}>{team.shortName}</span>
              {effectiveHotkey && !isQuotaReached && !isCompleted && (
                <span className="control-bar__team-hotkey-badge">
                  {effectiveHotkey.toUpperCase()}
                </span>
              )}
              {isQuotaReached && (
                <span
                  style={{
                    position: 'absolute',
                    top: -7,
                    right: -5,
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.58rem',
                    fontWeight: 900,
                    padding: '1px 4px',
                    borderRadius: 3,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    border: '1px solid #7f1d1d',
                    zIndex: 6,
                  }}
                  title={`Category limit (${currentCat?.maxPerTeam}) reached`}
                >
                  MAX
                </span>
              )}
              {effectiveHotkey && !isQuotaReached && (
                <span className="hotkey-hint">
                  {team.name} (Key: {effectiveHotkey.toUpperCase()})
                </span>
              )}
            </button>
          );
        })}

        {/* Sold / Unsold / Persistent Re-Auction Controls / Completed Lock */}
        {isCompleted ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: 800,
          }}>
            <span>🔒 AUCTION COMPLETED</span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Reopen in Manage Panel to unlock bidding & re-auction
            </span>
          </div>
        ) : canReAuction ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="control-bar__btn control-bar__btn--reauction"
              onClick={onReAuction}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
                fontWeight: 900,
                boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)',
              }}
              title="Return this player to bidding"
            >
              ↺ RE-AUCTION
            </button>
            <button
              className="control-bar__btn control-bar__btn--new-player"
              onClick={handleNewPlayer}
              disabled={isSpinning}
              style={{
                background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)',
                color: '#fff',
                fontWeight: 900,
              }}
              title="Proceed to draw / spin for next player"
            >
              NEXT PLAYER ❯
            </button>
          </div>
        ) : (
          <>
            <button
              className="control-bar__btn control-bar__btn--sold"
              onClick={onSell}
              disabled={!currentPlayer || !currentTeam}
              title={currentTeam ? `Sell to ${currentTeam.name} for ₹${currentBid.toLocaleString()}` : 'Select a team first'}
            >
              SOLD {currentTeam ? `(₹${currentBid.toLocaleString()})` : ''}
            </button>
            <button
              className="control-bar__btn control-bar__btn--unsold"
              onClick={onUnsold}
              disabled={!currentPlayer}
            >
              UNSOLD
            </button>
          </>
        )}

        {/* Timer controls in control bar: clear Play/Pause button and Reset button, digits omitted as top HUD displays stopwatch */}
        <div className="control-bar__timer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <button
            type="button"
            className="control-bar__timer-btn"
            title={timerActive ? "Pause Stopwatch" : "Start Stopwatch (resets to 00:00 on every bid)"}
            onClick={() => {
              setTimerVisible(true);
              setTimerActive(!timerActive);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: timerActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)',
              border: `1.5px solid ${timerActive ? '#ef4444' : '#22c55e'}`,
              color: timerActive ? '#ef4444' : '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.05rem',
              fontWeight: 900,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: timerActive ? '0 0 8px rgba(239, 68, 68, 0.4)' : '0 0 8px rgba(34, 197, 94, 0.3)',
            }}
          >
            <span>{timerActive ? '⏸' : '▶'}</span>
          </button>
          <button
            type="button"
            className="control-bar__timer-btn"
            title="Reset Stopwatch to 00:00"
            onClick={() => setTimerSeconds(0)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'var(--text-muted, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Bid Increment Rules Modal */}
      <BidRulesModal
        isOpen={showBidRules}
        onClose={() => setShowBidRules(false)}
        tournament={tournament}
        onRefresh={onRefresh}
      />
    </>
  );
}
