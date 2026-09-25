'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuctionArena from '@/components/AuctionArena';
import TeamSummary from '@/components/TeamSummary';
import PlayerList from '@/components/PlayerList';
import CategorySwitcher from '@/components/CategorySwitcher';
import ManagePanel from '@/components/ManagePanel';
import NavigationDock from '@/components/NavigationDock';
import SetupPanel from '@/components/SetupPanel';
import { computeNextBid, getBidIncrement, resolveUniqueTeamHotkeys, isTeamCategoryQuotaReached, calculateTeamStats } from '@/lib/auctionRules';
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

  // Support ?screen= URL query parameter (e.g. ?screen=M for Manage Panel)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const scr = params.get('screen');
      if (scr && ['A', 'S', 'P', 'C', 'M'].includes(scr.toUpperCase())) {
        setActiveScreen(scr.toUpperCase());
      }
    }
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

  // Calculate team stats (using category-based minimum reserve logic)
  const getTeamStats = useCallback((team) => {
    if (!tournament || !team) return {};
    return calculateTeamStats(team, tournament.teams, tournament, currentPlayer?.categoryId);
  }, [tournament, currentPlayer]);

  // Draw new player (random or by number) supporting single, multiple, or all categories
  const drawPlayer = useCallback(async (playerNumber = null) => {
    if (!tournament) return;
    if (tournament.status === 'completed') {
      alert('Auction is completed and locked. Please reopen auction in Manage Panel first.');
      return;
    }

    let player = null;
    const activeCategory = auctionState?.activeCategory;
    const activeCatIds = (activeCategory && activeCategory !== 'ALL')
      ? activeCategory.split(',').filter(Boolean)
      : [];

    if (playerNumber) {
      player = tournament.players.find(p => p.playerNumber === parseInt(playerNumber));
    } else {
      const availablePlayers = tournament.players.filter(p => {
        if (p.status !== 'available') return false;
        if (activeCatIds.length > 0 && !activeCatIds.includes(p.categoryId)) return false;
        return true;
      });

      if (availablePlayers.length === 0) {
        alert(activeCatIds.length > 0
          ? 'No available players found in the selected category/categories.'
          : 'No available players remaining in the auction pool.');
        return;
      }

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
    if (tournament?.status === 'completed') {
      alert('Auction is completed and locked. Please reopen auction in Manage Panel first.');
      return;
    }

    // Check category player quota for team
    const category = tournament?.categories?.find(c => c.id === currentPlayer.categoryId);
    if (category && isTeamCategoryQuotaReached(team, currentPlayer.categoryId, tournament)) {
      alert(`Cannot bid: ${team.name} has already reached the maximum allowed ${category.maxPerTeam} player(s) for category "${category.name}".`);
      return;
    }

    const stats = getTeamStats(team);

    if (customBidAmount !== null && customBidAmount > 0) {
      if (customBidAmount > stats.maxBid) {
        alert(`Bid ₹${customBidAmount.toLocaleString()} exceeds ${team.name}'s max bid limit of ₹${stats.maxBid.toLocaleString()} (Min Reserve Required: ₹${stats.reservePoints.toLocaleString()})`);
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
      if (newBid > stats.maxBid) {
        alert(`Cannot increase bid: ₹${newBid.toLocaleString()} exceeds ${team.name}'s max bid limit of ₹${stats.maxBid.toLocaleString()} (Min Reserve Required: ₹${stats.reservePoints.toLocaleString()})`);
        return;
      }
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
        alert(`Bid ₹${newBid.toLocaleString()} exceeds ${team.name}'s max bid limit of ₹${stats.maxBid.toLocaleString()} (Min Reserve Required: ₹${stats.reservePoints.toLocaleString()})`);
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
    if (!currentPlayer || stampType || tournament?.status === 'completed') return;
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
    if (tournament?.status === 'completed') {
      alert('Auction is completed and locked. Please reopen auction in Manage Panel first.');
      return;
    }

    // Verify category quota
    const category = tournament?.categories?.find(c => c.id === currentPlayer.categoryId);
    if (category && isTeamCategoryQuotaReached(currentTeam, currentPlayer.categoryId, tournament)) {
      alert(`Cannot sell: ${currentTeam.name} has already reached the maximum allowed ${category.maxPerTeam} player(s) for category "${category.name}".`);
      return;
    }

    // Verify minimum reserve balance
    const stats = getTeamStats(currentTeam);
    if (currentBid > stats.maxBid) {
      alert(`Cannot sell: Winning bid of ₹${currentBid.toLocaleString()} exceeds ${currentTeam.name}'s max bid limit of ₹${stats.maxBid.toLocaleString()} (Must maintain ₹${stats.reservePoints.toLocaleString()} reserve for required category slots).`);
      return;
    }

    // INSTANT OPTIMISTIC UI: Trigger stamp, sound, and local updates immediately with zero lag!
    const soldPlayerObj = currentPlayer;
    const soldTeamObj = currentTeam;
    const soldBidAmt = currentBid;

    setStampType('sold');
    playSoldSound(!!auctionState?.fireworkAudio);

    setCurrentPlayer(prev => prev ? {
      ...prev,
      status: 'sold',
      teamId: soldTeamObj?.id,
      sale: { soldPrice: soldBidAmt, teamId: soldTeamObj?.id, team: soldTeamObj },
    } : null);
    setCurrentTeam(null);
    setCurrentBid(0);

    // Optimistically update tournament state in memory
    setTournament(prev => {
      if (!prev) return prev;
      const targetPlayerIds = (soldPlayerObj.isJodi && soldPlayerObj.jodiPlayers)
        ? soldPlayerObj.jodiPlayers.map(p => p.id)
        : [soldPlayerObj.id];

      const splitPrice = targetPlayerIds.length > 1 ? Math.round(soldBidAmt / targetPlayerIds.length) : soldBidAmt;

      const updatedPlayers = prev.players.map(p => {
        if (targetPlayerIds.includes(p.id)) {
          return {
            ...p,
            status: 'sold',
            sale: { soldPrice: splitPrice, teamId: soldTeamObj.id, team: soldTeamObj },
          };
        }
        return p;
      });

      const updatedTeams = prev.teams.map(t => {
        if (t.id === soldTeamObj.id) {
          const newSales = [...(t.sales || [])];
          targetPlayerIds.forEach(pid => {
            const matchedP = updatedPlayers.find(pl => pl.id === pid);
            newSales.push({
              id: `temp-${Date.now()}-${pid}`,
              playerId: pid,
              teamId: t.id,
              soldPrice: splitPrice,
              player: matchedP,
            });
          });
          return { ...t, sales: newSales };
        }
        return t;
      });

      return { ...prev, players: updatedPlayers, teams: updatedTeams };
    });

    if (stampTimeoutRef.current) clearTimeout(stampTimeoutRef.current);
    stampTimeoutRef.current = setTimeout(() => {
      setStampType(null);
    }, 1500);

    try {
      if (soldPlayerObj.isJodi && soldPlayerObj.jodiPlayers) {
        const splitPrice = Math.round(soldBidAmt / 2);
        await Promise.all(soldPlayerObj.jodiPlayers.map(p =>
          fetch(`/api/tournaments/${id}/auction/sold`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: p.id,
              teamId: soldTeamObj.id,
              soldPrice: splitPrice,
            }),
          })
        ));
      } else {
        const res = await fetch(`/api/tournaments/${id}/auction/sold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: soldPlayerObj.id,
            teamId: soldTeamObj.id,
            soldPrice: soldBidAmt,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          alert(d.error || 'Failed to complete sale');
          await fetchTournament();
          return;
        }
      }

      // Revalidate in background to sync database state
      fetchTournament();
    } catch (err) {
      console.error('Sell error:', err);
      fetchTournament();
    }
  }, [currentPlayer, currentTeam, currentBid, id, fetchTournament, auctionState, tournament, getTeamStats]);

  // Mark unsold
  const markUnsold = useCallback(async () => {
    if (!currentPlayer) return;
    if (tournament?.status === 'completed') {
      alert('Auction is completed and locked. Please reopen auction in Manage Panel first.');
      return;
    }

    const unsoldPlayerObj = currentPlayer;

    // INSTANT OPTIMISTIC UI: Trigger stamp, sound, and local updates immediately with zero lag!
    setStampType('unsold');
    playUnsoldSound(!!auctionState?.fireworkAudio);

    setCurrentPlayer(prev => prev ? { ...prev, status: 'unsold' } : null);
    setCurrentTeam(null);
    setCurrentBid(0);

    // Optimistically update tournament state in memory
    setTournament(prev => {
      if (!prev) return prev;
      const targetPlayerIds = (unsoldPlayerObj.isJodi && unsoldPlayerObj.jodiPlayers)
        ? unsoldPlayerObj.jodiPlayers.map(p => p.id)
        : [unsoldPlayerObj.id];

      const updatedPlayers = prev.players.map(p => {
        if (targetPlayerIds.includes(p.id)) {
          return { ...p, status: 'unsold' };
        }
        return p;
      });

      return { ...prev, players: updatedPlayers };
    });

    if (stampTimeoutRef.current) clearTimeout(stampTimeoutRef.current);
    stampTimeoutRef.current = setTimeout(() => {
      setStampType(null);
    }, 1500);

    try {
      if (unsoldPlayerObj.isJodi && unsoldPlayerObj.jodiPlayers) {
        await Promise.all(unsoldPlayerObj.jodiPlayers.map(p =>
          fetch(`/api/tournaments/${id}/auction/unsold`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: p.id }),
          })
        ));
      } else {
        await fetch(`/api/tournaments/${id}/auction/unsold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: unsoldPlayerObj.id }),
        });
      }

      // Revalidate in background to sync database state
      fetchTournament();
    } catch (err) {
      console.error('Unsold error:', err);
      fetchTournament();
    }
  }, [currentPlayer, id, fetchTournament, auctionState, tournament]);


  // Re-auction player
  const reAuction = useCallback(async () => {
    if (!currentPlayer) return;
    if (tournament?.status === 'completed') {
      alert('Auction is completed and locked. Please reopen auction in Manage Panel first.');
      return;
    }

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
  }, [currentPlayer, id, fetchTournament, tournament]);

  // Compute guaranteed 100% unique shortcut keys for all teams (no duplicate keys ever)
  const teamHotkeys = useMemo(() => {
    return resolveUniqueTeamHotkeys(tournament?.teams);
  }, [tournament?.teams]);

  // Keyboard shortcuts
  useEffect(() => {
    if (activeScreen !== 'A' || tournament?.status === 'completed') return;

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

  const handleSwitchCategory = useCallback(async (categoryId, stayOnScreen = false) => {
    try {
      await fetch(`/api/tournaments/${id}/auction/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeCategory: categoryId }),
      });
      setAuctionState(prev => ({ ...prev, activeCategory: categoryId }));
      if (!stayOnScreen) {
        setActiveScreen('A');
      }
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
        <header className="auction-header" style={{
          background: 'var(--aa-surface-container, rgba(27, 31, 49, 0.9))',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <div className="auction-header__left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              href="/dashboard"
              title="Return to Organizer Dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              ← Dashboard
            </Link>
            {tournament.logo ? (
              <img src={tournament.logo} alt="Logo" className="auction-header__logo" style={{ borderRadius: 8 }} />
            ) : (
              <div className="auction-header__logo" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800, textAlign: 'center',
                color: 'var(--text-primary)', border: '1px solid var(--border-subtle)',
                borderRadius: 8,
              }}>
                {tournament.name.substring(0, 3)}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--aa-secondary)', fontWeight: 800, letterSpacing: '0.08em' }}>
                {tournament.sportType ? `● ${tournament.sportType.toUpperCase()}` : '● CRICKET'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {tournament.status === 'completed' ? '🏁 FINISHED' : '🔴 LIVE ARENA'}
              </span>
            </div>
          </div>

          <div className="auction-header__center auction-header__title">
            <h1 style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              {tournament.name}
              <br />
              <span className="highlight-badge" style={{
                background: 'linear-gradient(135deg, var(--aa-primary), var(--aa-secondary))',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 4,
                marginRight: 6,
              }}>
                PLAYERS
              </span>
              AUCTION
            </h1>
          </div>

          <div className="auction-header__right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              href={`/live/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
                background: 'rgba(76, 215, 246, 0.12)',
                border: '1px solid var(--aa-secondary)',
                color: 'var(--aa-secondary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
              title="Open Public Live Spectator Screen in New Tab"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>live_tv</span>
              <span>Spectator Screen</span>
            </Link>
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
