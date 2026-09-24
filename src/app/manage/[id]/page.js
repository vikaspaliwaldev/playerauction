'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import AuctionArena from '@/components/AuctionArena';
import TeamSummary from '@/components/TeamSummary';
import PlayerList from '@/components/PlayerList';
import CategorySwitcher from '@/components/CategorySwitcher';
import ManagePanel from '@/components/ManagePanel';
import NavigationDock from '@/components/NavigationDock';
import SetupPanel from '@/components/SetupPanel';
import { computeNextBid, getBidIncrement, resolveUniqueTeamHotkeys, isTeamCategoryQuotaReached } from '@/lib/auctionRules';
import { getActiveSponsor, formatSponsorUrl } from '@/lib/sponsorRotation';
import { playBidSound, playSoldSound, playUnsoldSound, playDrawPlayerSound } from '@/lib/soundEffects';

export default function ManagePage() {
  const { id } = useParams();
  const [activeScreen, setActiveScreen] = useState('A');
  const [tournament, setTournament] = useState(null);
  const [auctionState, setAuctionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [stampType, setStampType] = useState(null); // 'sold' | 'unsold' | null
  const [showSetup, setShowSetup] = useState(false);
  const stampTimeoutRef = useRef(null);

  // Multi-Sponsor 10-second rotation tick
  const [rotationTick, setRotationTick] = useState(0);
  useEffect(() => {
    const ticker = setInterval(() => {
      setRotationTick(t => t + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const sponsors = tournament?.sponsors || [];
  const currentSponsor = useMemo(() => {
    return getActiveSponsor(sponsors, 10);
  }, [sponsors, rotationTick]);

  const fetchTournament = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      const data = await res.json();
      if (data.tournament) {
        setTournament(data.tournament);
        setAuctionState(data.tournament.auctionState);

        // Check if setup is needed
        if (!data.tournament.teams?.length || !data.tournament.categories?.length) {
          setShowSetup(true);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  // Calculate team stats
  const getTeamStats = useCallback((team) => {
    if (!tournament) return {};
    const soldPlayers = team.sales || [];
    const totalSpent = soldPlayers.reduce((sum, s) => sum + s.soldPrice, 0);
    const balance = team.purse - totalSpent;
    const playerCount = soldPlayers.length;
    const remainingSlots = Math.max(0, tournament.minPlayers - playerCount);
    const minBasePrice = tournament.categories?.length > 0
      ? Math.min(...tournament.categories.map(c => c.basePrice))
      : 100;
    const reservePoints = remainingSlots > 0 ? (remainingSlots - 1) * minBasePrice : 0;
    const maxBid = Math.max(0, balance - reservePoints);

    return { balance, playerCount, totalSpent, remainingSlots, reservePoints, maxBid };
  }, [tournament]);

  // Draw new player (random or by number)
  const drawPlayer = useCallback(async (playerNumber = null) => {
    if (!tournament) return;

    let player = null;
    const activeCategory = auctionState?.activeCategory;

    if (playerNumber) {
      player = tournament.players.find(p => p.playerNumber === parseInt(playerNumber));
    } else {
      const availablePlayers = tournament.players.filter(p => {
        if (p.status !== 'available') return false;
        if (activeCategory && p.categoryId !== activeCategory) return false;
        return true;
      });

      if (availablePlayers.length === 0) return;

      const selectionMode = auctionState?.selectionMode || 'random';
      if (selectionMode === 'random') {
        // Exclude current player if other available candidates exist so re-spin picks a NEW player
        const candidates = (currentPlayer && availablePlayers.length > 1)
          ? availablePlayers.filter(p => p.id !== currentPlayer.id)
          : availablePlayers;
        const idx = Math.floor(Math.random() * candidates.length);
        player = candidates[idx];
      } else if (selectionMode === 'sequence') {
        const currentNum = currentPlayer?.playerNumber || 0;
        player = availablePlayers.find(p => p.playerNumber > currentNum) || availablePlayers[0];
      } else {
        player = availablePlayers[0];
      }
    }

    if (player) {
      setCurrentPlayer(player);
      setCurrentBid(player.category?.basePrice || 1000);
      setCurrentTeam(null);
      setStampType(null);
      playDrawPlayerSound(!!auctionState?.fireworkAudio);

      // Update auction state on server
      await fetch(`/api/tournaments/${id}/auction/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPlayerId: player.id,
          currentBid: player.category?.basePrice || 1000,
          currentTeamId: null,
        }),
      });
    }
  }, [tournament, auctionState, currentPlayer, id]);

  // Helper to sync live auction state to server so external screens see real-time updates
  const syncServerAuctionState = useCallback((bidAmount, teamId) => {
    if (!currentPlayer) return;
    fetch(`/api/tournaments/${id}/auction/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPlayerId: currentPlayer.id,
        currentBid: bidAmount,
        currentTeamId: teamId || null,
      }),
    }).catch(err => console.error('Failed to sync auction state:', err));
  }, [id, currentPlayer]);

  // Place bid for a team or assign fixed price
  const placeBid = useCallback((team, customBidAmount = null) => {
    if (!currentPlayer || stampType) return;

    // Check category player quota for team
    const category = tournament?.categories?.find(c => c.id === currentPlayer.categoryId);
    if (category && isTeamCategoryQuotaReached(team, currentPlayer.categoryId, tournament)) {
      alert(`Cannot bid: ${team.name} has already reached the maximum allowed ${category.maxPerTeam} player(s) for category "${category.name}".`);
      return;
    }

    const stats = getTeamStats(team);

    if (customBidAmount !== null && customBidAmount > 0) {
      if (customBidAmount > stats.maxBid) {
        alert(`Bid ₹${customBidAmount.toLocaleString()} exceeds ${team.name}'s max bid limit of ₹${stats.maxBid.toLocaleString()}`);
        return;
      }
      setCurrentBid(customBidAmount);
      setCurrentTeam(team);
      syncServerAuctionState(customBidAmount, team.id);
      playBidSound(!!auctionState?.fireworkAudio);
      return;
    }

    if (currentTeam?.id === team.id) {
      // Same team clicked again, increment
      const newBid = computeNextBid(currentBid, tournament);
      if (newBid > stats.maxBid) return;
      setCurrentBid(newBid);
      syncServerAuctionState(newBid, team.id);
      playBidSound(!!auctionState?.fireworkAudio);
    } else {
      // Team selected: if a bid already exists, assign to team
      let newBid;
      if (!currentTeam) {
        newBid = currentBid; // Keep user's typed amount or base price
      } else {
        newBid = computeNextBid(currentBid, tournament);
      }
      if (newBid > stats.maxBid) {
        alert(`Bid ₹${newBid.toLocaleString()} exceeds ${team.name}'s max bid limit of ₹${stats.maxBid.toLocaleString()}`);
        return;
      }
      setCurrentBid(newBid);
      setCurrentTeam(team);
      syncServerAuctionState(newBid, team.id);
      playBidSound(!!auctionState?.fireworkAudio);
    }
  }, [currentPlayer, currentTeam, currentBid, tournament, getTeamStats, stampType, syncServerAuctionState, auctionState]);

  // Increment bid without team (Up Arrow)
  const incrementBid = useCallback(() => {
    if (!currentPlayer || stampType) return;
    const next = computeNextBid(currentBid, tournament);
    setCurrentBid(next);
    syncServerAuctionState(next, currentTeam?.id || null);
    playBidSound(!!auctionState?.fireworkAudio);
  }, [currentPlayer, currentBid, currentTeam, tournament, stampType, syncServerAuctionState, auctionState]);

  // Manual bid amount update
  const updateBidAmount = useCallback((newBid) => {
    setCurrentBid(newBid);
    syncServerAuctionState(newBid, currentTeam?.id || null);
  }, [currentTeam, syncServerAuctionState]);

  // Manual team selection
  const selectTeam = useCallback((team) => {
    setCurrentTeam(team);
    syncServerAuctionState(currentBid, team?.id || null);
  }, [currentBid, syncServerAuctionState]);

  // Sell player
  const sellPlayer = useCallback(async () => {
    if (!currentPlayer || !currentTeam) return;

    // Verify category quota
    const category = tournament?.categories?.find(c => c.id === currentPlayer.categoryId);
    if (category && isTeamCategoryQuotaReached(currentTeam, currentPlayer.categoryId, tournament)) {
      alert(`Cannot sell: ${currentTeam.name} has already reached the maximum allowed ${category.maxPerTeam} player(s) for category "${category.name}".`);
      return;
    }

    try {
      if (currentPlayer.isJodi && currentPlayer.jodiPlayers) {
        const splitPrice = Math.round(currentBid / 2);
        for (const p of currentPlayer.jodiPlayers) {
          await fetch(`/api/tournaments/${id}/auction/sold`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: p.id,
              teamId: currentTeam.id,
              soldPrice: splitPrice,
            }),
          });
        }
      } else {
        await fetch(`/api/tournaments/${id}/auction/sold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: currentPlayer.id,
            teamId: currentTeam.id,
            soldPrice: currentBid,
          }),
        });
      }

      setStampType('sold');
      playSoldSound(!!auctionState?.fireworkAudio);
      const soldTeamObj = currentTeam;
      const soldBidAmt = currentBid;
      setCurrentPlayer(prev => prev ? {
        ...prev,
        status: 'sold',
        teamId: soldTeamObj?.id,
        sale: { soldPrice: soldBidAmt, teamId: soldTeamObj?.id, team: soldTeamObj },
      } : null);
      setCurrentTeam(null);
      setCurrentBid(0);
      if (stampTimeoutRef.current) clearTimeout(stampTimeoutRef.current);
      stampTimeoutRef.current = setTimeout(() => {
        setStampType(null);
      }, 1500);

      // Refresh data
      await fetchTournament();
    } catch (err) {
      console.error('Sell error:', err);
    }
  }, [currentPlayer, currentTeam, currentBid, id, fetchTournament, auctionState]);

  // Mark unsold
  const markUnsold = useCallback(async () => {
    if (!currentPlayer) return;

    try {
      if (currentPlayer.isJodi && currentPlayer.jodiPlayers) {
        for (const p of currentPlayer.jodiPlayers) {
          await fetch(`/api/tournaments/${id}/auction/unsold`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: p.id }),
          });
        }
      } else {
        await fetch(`/api/tournaments/${id}/auction/unsold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: currentPlayer.id }),
        });
      }

      setStampType('unsold');
      playUnsoldSound(!!auctionState?.fireworkAudio);
      setCurrentPlayer(prev => prev ? { ...prev, status: 'unsold' } : null);
      setCurrentTeam(null);
      setCurrentBid(0);
      if (stampTimeoutRef.current) clearTimeout(stampTimeoutRef.current);
      stampTimeoutRef.current = setTimeout(() => {
        setStampType(null);
      }, 1500);

      // Refresh data
      await fetchTournament();
    } catch (err) {
      console.error('Unsold error:', err);
    }
  }, [currentPlayer, id, fetchTournament, auctionState]);


  // Re-auction player
  const reAuction = useCallback(async () => {
    if (!currentPlayer) return;

    try {
      const res = await fetch(`/api/tournaments/${id}/auction/re-auction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentPlayer.id }),
      });

      const data = await res.json();
      if (data.player) {
        setCurrentPlayer(data.player);
        setCurrentBid(data.player.category?.basePrice || 1000);
        setCurrentTeam(null);
        setStampType(null);
      }

      await fetchTournament();
    } catch (err) {
      console.error('Re-auction error:', err);
    }
  }, [currentPlayer, id, fetchTournament]);

  // Compute guaranteed 100% unique shortcut keys for all teams (no duplicate keys ever)
  const teamHotkeys = useMemo(() => {
    return resolveUniqueTeamHotkeys(tournament?.teams);
  }, [tournament?.teams]);

  // Keyboard shortcuts
  useEffect(() => {
    if (activeScreen !== 'A') return;

    const handleKeyDown = (e) => {
      // Don't handle if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        incrementBid();
        return;
      }

      if (e.key === 'Enter' && currentPlayer && currentTeam) {
        e.preventDefault();
        sellPlayer();
        return;
      }

      if (e.key === 'Escape' && currentPlayer) {
        e.preventDefault();
        markUnsold();
        return;
      }

      // Team hotkeys (guaranteed unique key per franchise)
      if (tournament?.teams && currentPlayer && !stampType) {
        const keyUpper = e.key.toUpperCase();
        const team = tournament.teams.find(t => teamHotkeys[t.id] === keyUpper);
        if (team) {
          e.preventDefault();
          placeBid(team);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeScreen, tournament, incrementBid, sellPlayer, markUnsold, placeBid, currentPlayer, currentTeam, stampType, teamHotkeys]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Admin actions
  const handleReset = useCallback(async (type) => {
    const confirmMsg = type === 'full'
      ? 'Reset ALL auction data? This will clear all sales and bids.'
      : 'Move all unsold players back to available pool?';

    if (!window.confirm(confirmMsg)) return;

    try {
      await fetch(`/api/tournaments/${id}/auction/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      setCurrentPlayer(null);
      setCurrentBid(0);
      setCurrentTeam(null);
      setStampType(null);
      await fetchTournament();
    } catch (err) {
      console.error('Reset error:', err);
    }
  }, [id, fetchTournament]);

  const handleSwitchCategory = useCallback(async (categoryId) => {
    try {
      await fetch(`/api/tournaments/${id}/auction/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeCategory: categoryId }),
      });
      setAuctionState(prev => ({ ...prev, activeCategory: categoryId }));
      setActiveScreen('A');
    } catch (err) {
      console.error('Category switch error:', err);
    }
  }, [id]);

  const handleUpdateMode = useCallback(async (key, value) => {
    try {
      await fetch(`/api/tournaments/${id}/auction/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      setAuctionState(prev => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error('Mode update error:', err);
    }
  }, [id]);

  if (loading) {
    return (
      <>
        <div className="auction-bg" />
        <div className="empty-state" style={{ height: '100vh' }}>
          <div className="loading-spinner" />
        </div>
      </>
    );
  }

  if (!tournament) {
    return (
      <>
        <div className="auction-bg" />
        <div className="empty-state" style={{ height: '100vh' }}>
          <p>Tournament not found</p>
        </div>
      </>
    );
  }

  if (showSetup) {
    return (
      <SetupPanel
        tournament={tournament}
        onComplete={() => { setShowSetup(false); fetchTournament(); }}
        onRefresh={fetchTournament}
      />
    );
  }

  return (
    <>
      <div className="auction-bg" />
      <div className="geometric-frame" />
      <div className="corner-accent top-left" />
      <div className="corner-accent top-right" />
      <div className="corner-accent bottom-left" />
      <div className="corner-accent bottom-right" />

      <div className="screen-container">
        {/* Header */}
        <header className="auction-header">
          <div className="auction-header__left">
            {tournament.logo ? (
              <img src={tournament.logo} alt="Logo" className="auction-header__logo" />
            ) : (
              <div className="auction-header__logo" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, textAlign: 'center',
                color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
              }}>
                {tournament.name.substring(0, 3)}
              </div>
            )}
          </div>

          <div className="auction-header__center auction-header__title">
            <h1>
              {tournament.name}
              <br />
              <span className="highlight-badge">PLAYERS</span>
              AUCTION
            </h1>
          </div>

          <div className="auction-header__right">
            {currentSponsor ? (() => {
              const sponsorLink = formatSponsorUrl(currentSponsor.url);
              const content = (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.5s ease' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="sponsor-label-text">
                      {sponsors.length > 1 ? `SPONSOR (${currentSponsor.weight || 33}%)` : 'SPONSOR'}
                    </div>
                    <div className="sponsor-name-text">
                      <span>{currentSponsor.name}</span>
                      {sponsorLink && <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>↗</span>}
                    </div>
                  </div>
                  <div className="sponsor-logo-box">
                    <img
                      src={currentSponsor.logo}
                      alt={currentSponsor.name}
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
                  title={`Visit ${currentSponsor.name} website (${sponsorLink})`}
                  className="sponsor-banner-capsule"
                >
                  {content}
                </a>
              ) : (
                <div
                  key={currentSponsor.id}
                  className="sponsor-banner-capsule"
                  style={{ cursor: 'default' }}
                >
                  {content}
                </div>
              );
            })() : (
              <div style={{ width: 80 }} />
            )}
          </div>
        </header>

        {/* Screens */}
        <div className="screen-content">
          {activeScreen === 'A' && (
            <AuctionArena
              tournament={tournament}
              currentPlayer={currentPlayer}
              currentBid={currentBid}
              currentTeam={currentTeam}
              stampType={stampType}
              teamHotkeys={teamHotkeys}
              onDrawPlayer={drawPlayer}
              onPlaceBid={placeBid}
              onUpdateBid={updateBidAmount}
              onSelectTeam={selectTeam}
              onSell={sellPlayer}
              onUnsold={markUnsold}
              onReAuction={reAuction}
              onIncrementBid={incrementBid}
              getTeamStats={getTeamStats}
              onRefresh={fetchTournament}
            />
          )}
          {activeScreen === 'S' && (
            <TeamSummary
              tournament={tournament}
              getTeamStats={getTeamStats}
              teamHotkeys={teamHotkeys}
              onRefresh={fetchTournament}
              tournamentId={id}
            />
          )}
          {activeScreen === 'P' && (
            <PlayerList
              tournament={tournament}
              onRefresh={fetchTournament}
            />
          )}
          {activeScreen === 'C' && (
            <CategorySwitcher
              tournament={tournament}
              auctionState={auctionState}
              onSwitch={handleSwitchCategory}
              onRefresh={fetchTournament}
            />
          )}
          {activeScreen === 'M' && (
            <ManagePanel
              tournament={tournament}
              auctionState={auctionState}
              onReset={handleReset}
              onUpdateMode={handleUpdateMode}
              onRefresh={fetchTournament}
              onOpenSetup={() => setShowSetup(true)}
              tournamentId={id}
            />
          )}
        </div>

        {/* Stamp Overlay */}
        {stampType && (
          <div className="stamp-overlay" onClick={() => setStampType(null)}>
            {stampType === 'sold' ? (
              <div className="stamp-overlay__sold">
                ✔ SOLD
              </div>
            ) : (
              <div className="stamp-overlay__unsold">
                REMAIN UNSOLD
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Dock */}
      <NavigationDock
        activeScreen={activeScreen}
        onScreenChange={setActiveScreen}
        onFullscreen={toggleFullscreen}
        tournament={tournament}
        onRefresh={fetchTournament}
        onDrawPlayer={drawPlayer}
        onDrawJodi={(jodiObj) => {
          setCurrentPlayer(jodiObj);
          setCurrentBid(jodiObj.category.basePrice);
          setCurrentTeam(null);
          setActiveScreen('A');
        }}
        onSelectTeamBid={placeBid}
      />
    </>
  );
}
