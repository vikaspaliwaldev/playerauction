'use client';

import { useState, useEffect, useMemo } from 'react';
import { getActiveSponsor, validateWeights, rebalanceWeights, formatSponsorUrl } from '@/lib/sponsorRotation';
import SpinnerWheel from '@/components/SpinnerWheel';

export default function AuctionMenuModals({
  activeModal,
  onClose,
  tournament,
  onRefresh,
  onDrawPlayer,
  onDrawJodi,
  onSelectTeamBid,
}) {
  const teams = tournament?.teams || [];
  const players = tournament?.players || [];
  const availablePlayers = players.filter(p => p.status === 'available');

  // Multi-Sponsor Banner state
  const sponsors = tournament?.sponsors || [];
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogo, setSponsorLogo] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [sponsorWeight, setSponsorWeight] = useState(33);
  const [editingSponsorId, setEditingSponsorId] = useState(null);
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const [sponsorMsg, setSponsorMsg] = useState(null);
  const [secondsLeftInSlot, setSecondsLeftInSlot] = useState(10);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ticker = setInterval(() => {
      const now = Date.now();
      const secInCurrentSlot = 10 - (Math.floor(now / 1000) % 10);
      setSecondsLeftInSlot(secInCurrentSlot);
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const activeLiveSponsor = useMemo(() => {
    return getActiveSponsor(sponsors, 10);
  }, [sponsors, tick]);

  const weightValidation = useMemo(() => {
    return validateWeights(sponsors);
  }, [sponsors]);

  const handleSponsorUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Sponsor image should be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSponsorLogo(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSponsor = async (e) => {
    if (e) e.preventDefault();
    if (!sponsorLogo || !sponsorLogo.trim()) {
      setSponsorMsg({ type: 'error', text: 'Please enter a banner image URL or upload an image' });
      return;
    }
    setSponsorLoading(true);
    setSponsorMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorId: editingSponsorId,
          name: sponsorName.trim() || 'Official Sponsor',
          logo: sponsorLogo.trim(),
          url: sponsorUrl.trim() || null,
          weight: parseInt(sponsorWeight) || 33,
        }),
      });
      if (res.ok) {
        setSponsorMsg({
          type: 'success',
          text: editingSponsorId ? 'Sponsor banner updated successfully!' : 'Sponsor banner added successfully!',
        });
        setSponsorName('');
        setSponsorLogo('');
        setSponsorUrl('');
        setSponsorWeight(33);
        setEditingSponsorId(null);
        if (onRefresh) onRefresh();
        setTimeout(() => setSponsorMsg(null), 3000);
      } else {
        const d = await res.json();
        setSponsorMsg({ type: 'error', text: d.error || 'Failed to save sponsor' });
      }
    } catch (err) {
      setSponsorMsg({ type: 'error', text: err.message });
    } finally {
      setSponsorLoading(false);
    }
  };

  const handleEditSponsor = (sponsor) => {
    setEditingSponsorId(sponsor.id);
    setSponsorName(sponsor.name);
    setSponsorLogo(sponsor.logo);
    setSponsorUrl(sponsor.url || '');
    setSponsorWeight(sponsor.weight || 33);
  };

  const handleDeleteSponsor = async (sponsorId) => {
    if (!confirm('Remove this sponsor banner from this tournament?')) return;
    setSponsorLoading(true);
    setSponsorMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId, autoRebalance: true }),
      });
      if (res.ok) {
        if (editingSponsorId === sponsorId) {
          setEditingSponsorId(null);
          setSponsorName('');
          setSponsorLogo('');
          setSponsorUrl('');
        }
        setSponsorMsg({ type: 'success', text: 'Sponsor banner removed.' });
        if (onRefresh) onRefresh();
        setTimeout(() => setSponsorMsg(null), 3000);
      } else {
        const d = await res.json();
        setSponsorMsg({ type: 'error', text: d.error || 'Failed to remove sponsor' });
      }
    } catch (err) {
      setSponsorMsg({ type: 'error', text: err.message });
    } finally {
      setSponsorLoading(false);
    }
  };

  const handleQuickWeightChange = async (sponsorId, newWeight) => {
    const validWeight = Math.max(1, Math.min(100, parseInt(newWeight) || 1));
    try {
      await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId, weight: validWeight }),
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoRebalance = async () => {
    if (sponsors.length === 0) return;
    setSponsorLoading(true);
    try {
      const balanced = rebalanceWeights(sponsors);
      const res = await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkUpdates: balanced.map(s => ({ id: s.id, weight: s.weight })),
        }),
      });
      if (res.ok) {
        setSponsorMsg({ type: 'success', text: 'Weights distributed equally to 100%!' });
        if (onRefresh) onRefresh();
        setTimeout(() => setSponsorMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSponsorLoading(false);
    }
  };

  // Booster & Penalty state
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id || '');
  const [pointsAmount, setPointsAmount] = useState(5000);
  const [reason, setReason] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Jodi state
  const [jodiPlayer1, setJodiPlayer1] = useState(availablePlayers[0]?.id || '');
  const [jodiPlayer2, setJodiPlayer2] = useState(availablePlayers[1]?.id || '');
  const [jodiCustomPrice, setJodiCustomPrice] = useState(0);

  // Match Tie state
  const [tieTeam1, setTieTeam1] = useState(teams[0]?.id || '');
  const [tieTeam2, setTieTeam2] = useState(teams[1]?.id || '');
  const [tieMethod, setTieMethod] = useState('toss'); // toss | dice
  const [coinResult, setCoinResult] = useState(null);
  const [diceScores, setDiceScores] = useState(null);
  const [isRolling, setIsRolling] = useState(false);

  // Fortune Wheel state
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonNumber, setWonNumber] = useState(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Handle Booster submission
  const handleApplyBooster = async () => {
    if (!selectedTeamId || !pointsAmount) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/teams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          purseDelta: Math.abs(parseInt(pointsAmount)),
        }),
      });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: `Successfully added +₹${parseInt(pointsAmount).toLocaleString()} booster!` });
        if (onRefresh) onRefresh();
        setTimeout(() => { onClose(); setStatusMsg(null); }, 1500);
      } else {
        const d = await res.json();
        setStatusMsg({ type: 'error', text: d.error || 'Failed to apply booster' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Penalty submission
  const handleApplyPenalty = async () => {
    if (!selectedTeamId || !pointsAmount) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/teams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          purseDelta: -Math.abs(parseInt(pointsAmount)),
        }),
      });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: `Successfully deducted -₹${parseInt(pointsAmount).toLocaleString()} penalty!` });
        if (onRefresh) onRefresh();
        setTimeout(() => { onClose(); setStatusMsg(null); }, 1500);
      } else {
        const d = await res.json();
        setStatusMsg({ type: 'error', text: d.error || 'Failed to apply penalty' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Jodi Launch
  const handleLaunchJodi = () => {
    const p1 = players.find(p => p.id === jodiPlayer1);
    const p2 = players.find(p => p.id === jodiPlayer2);
    if (!p1 || !p2 || p1.id === p2.id) {
      alert('Please select two distinct players for the Jodi pair.');
      return;
    }

    const defaultPrice = (p1.category?.basePrice || 1000) + (p2.category?.basePrice || 1000);
    const finalPrice = jodiCustomPrice > 0 ? parseInt(jodiCustomPrice) : defaultPrice;

    if (onDrawJodi) {
      onDrawJodi({
        id: `jodi-${p1.id}-${p2.id}`,
        name: `${p1.name} & ${p2.name} (JODI)`,
        playerNumber: `${p1.playerNumber}&${p2.playerNumber}`,
        role: `${p1.role || 'Combo'} + ${p2.role || 'Combo'}`,
        category: {
          name: 'JODI / PAIR',
          basePrice: finalPrice,
        },
        photo: p1.photo || p2.photo,
        isJodi: true,
        jodiPlayers: [p1, p2],
      });
    }
    onClose();
  };

  // Handle Match Tie coin toss
  const handleCoinToss = () => {
    setIsRolling(true);
    setCoinResult(null);
    setTimeout(() => {
      const outcome = Math.random() > 0.5 ? 'heads' : 'tails';
      const winningTeam = outcome === 'heads'
        ? teams.find(t => t.id === tieTeam1)
        : teams.find(t => t.id === tieTeam2);
      setCoinResult({ outcome, winningTeam });
      setIsRolling(false);
    }, 1000);
  };

  // Handle Match Tie dice roll
  const handleDiceRoll = () => {
    setIsRolling(true);
    setDiceScores(null);
    setTimeout(() => {
      let d1 = Math.floor(Math.random() * 6) + 1;
      let d2 = Math.floor(Math.random() * 6) + 1;
      while (d1 === d2) {
        d2 = Math.floor(Math.random() * 6) + 1;
      }
      const t1 = teams.find(t => t.id === tieTeam1);
      const t2 = teams.find(t => t.id === tieTeam2);
      setDiceScores({
        d1,
        d2,
        t1,
        t2,
        winningTeam: d1 > d2 ? t1 : t2,
      });
      setIsRolling(false);
    }, 1000);
  };

  // Handle Fortune Wheel Spin
  const handleSpinWheel = () => {
    if (availablePlayers.length === 0 || isSpinning) return;
    setIsSpinning(true);
    setWonNumber(null);

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const chosenPlayer = availablePlayers[randomIndex];

    setTimeout(() => {
      setIsSpinning(false);
      setWonNumber(chosenPlayer);
    }, 3800);
  };

  const handleSelectWheelWinner = () => {
    if (wonNumber && onDrawPlayer) {
      onDrawPlayer(wonNumber.playerNumber);
      onClose();
    }
  };

  const handleCopy = (text) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!activeModal) return null;

  const publicLiveUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/live/${tournament?.id}`
    : '';
  const overlayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/live/${tournament?.id}?overlay=true`
    : '';
  const projectorUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/live/${tournament?.id}?mode=projector`
    : '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card-solid)',
          border: '1px solid rgba(220, 53, 69, 0.5)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.85), 0 0 30px rgba(220, 53, 69, 0.2)',
          width: '100%',
          maxWidth: activeModal === 'fortune' ? 620 : 540,
          padding: 28,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            color: '#fff',
            fontSize: '1.2rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* 1. MULTI-SPONSOR BANNER MODAL */}
        {activeModal === 'banner' && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent-gold)', margin: 0 }}>
                TOURNAMENT SPONSORS & 10s ROTATING BANNERS
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {sponsors.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoRebalance}
                    disabled={sponsorLoading}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--accent-cyan)',
                      background: 'rgba(6, 182, 212, 0.15)',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ⚖️ Auto Equal %
                  </button>
                )}
                <span style={{
                  fontSize: '0.72rem',
                  background: weightValidation.isValid ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: weightValidation.isValid ? '#4ade80' : '#ef4444',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 800,
                }}>
                  {weightValidation.totalWeight}% {weightValidation.isValid ? '✓' : `(${weightValidation.difference > 0 ? `+${weightValidation.difference}% needed` : `${weightValidation.difference}% over`})`}
                </span>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>
              Broadcast banners across live screens & stage projectors. Rotates every 10 seconds according to weightage %.
            </p>

            {sponsorMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 6,
                marginBottom: 14,
                background: sponsorMsg.type === 'success' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                border: `1px solid ${sponsorMsg.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                color: sponsorMsg.type === 'success' ? 'var(--text-green)' : 'var(--text-red)',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}>
                {sponsorMsg.text}
              </div>
            )}

            {/* Live 10s Active Ticker */}
            {sponsors.length > 0 && (
              <div style={{
                background: 'rgba(245, 184, 0, 0.08)',
                border: '1px solid rgba(245, 184, 0, 0.3)',
                borderRadius: 8,
                padding: '8px 14px',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ON AIR NOW:</span>
                  {activeLiveSponsor ? (() => {
                    const link = formatSponsorUrl(activeLiveSponsor.url);
                    const inner = (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="sponsor-logo-box" style={{ padding: '2px 6px', height: 26 }}>
                          <img src={activeLiveSponsor.logo} alt="Live" style={{ maxHeight: 20, maxWidth: 60, objectFit: 'contain' }} />
                        </div>
                        <strong style={{ color: 'var(--accent-gold)', fontSize: '0.85rem' }}>{activeLiveSponsor.name}</strong>
                        {link && <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)' }}>↗</span>}
                      </div>
                    );
                    return link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(link, '_blank', 'noopener,noreferrer');
                        }}
                        title={`Open ${activeLiveSponsor.name} website (${link})`}
                        style={{ textDecoration: 'none', cursor: 'pointer' }}
                      >
                        {inner}
                      </a>
                    ) : inner;
                  })() : null}
                </div>
                {sponsors.length > 1 && (
                  <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 700 }}>
                    Rotating in {secondsLeftInSlot}s
                  </span>
                )}
              </div>
            )}

            {/* Active Sponsors List */}
            {sponsors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 180, overflowY: 'auto' }}>
                {sponsors.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      background: activeLiveSponsor?.id === s.id ? 'rgba(245, 184, 0, 0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${activeLiveSponsor?.id === s.id ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                      borderRadius: 6,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="sponsor-logo-box" style={{ padding: '2px 6px', height: 32 }}>
                        <img src={s.logo} alt={s.name} style={{ maxHeight: 26, maxWidth: 50, objectFit: 'contain' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{s.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>~{s.weight}% airtime ({s.weight}s / 100s)</div>
                        {s.url && (
                          <div style={{ marginTop: 2 }}>
                            <a
                              href={formatSponsorUrl(s.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}
                              title={s.url}
                            >
                              🔗 {s.url.length > 25 ? s.url.slice(0, 25) + '...' : s.url} ↗
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={s.weight || 33}
                          onChange={(e) => handleQuickWeightChange(s.id, e.target.value)}
                          style={{
                            width: 40,
                            padding: '2px 4px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 4,
                            color: 'var(--accent-gold)',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            textAlign: 'center',
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 800 }}>%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEditSponsor(s)}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: '#fff', fontSize: '0.72rem', cursor: 'pointer' }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSponsor(s.id)}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(220, 53, 69, 0.4)', background: 'rgba(220, 53, 69, 0.15)', color: 'var(--text-red)', fontSize: '0.72rem', cursor: 'pointer' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add / Edit Form */}
            <form onSubmit={handleSaveSponsor} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: editingSponsorId ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                  {editingSponsorId ? '✏️ EDITING SPONSOR' : '+ ADD SPONSOR BANNER'}
                </span>
                {editingSponsorId && (
                  <button
                    type="button"
                    onClick={() => { setEditingSponsorId(null); setSponsorName(''); setSponsorLogo(''); setSponsorUrl(''); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer' }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    NAME
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tata IPL"
                    value={sponsorName}
                    onChange={e => setSponsorName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    BANNER IMAGE (URL or Upload)
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="https://... or upload"
                      value={sponsorLogo}
                      onChange={e => setSponsorLogo(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: '0.82rem',
                      }}
                    />
                    <label style={{
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      📁
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleSponsorUpload}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    🔗 REDIRECT HYPERLINK / URL (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="https://sponsorwebsite.com"
                    value={sponsorUrl}
                    onChange={e => setSponsorUrl(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: 'var(--accent-cyan)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    WEIGHT %
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={sponsorWeight}
                      onChange={e => setSponsorWeight(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: 'var(--accent-gold)',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                      }}
                    />
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 800, fontSize: '0.8rem' }}>%</span>
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PRESETS:</span>
                {[
                  { name: 'Tata IPL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Indian_Premier_League_Official_Logo.svg/300px-Indian_Premier_League_Official_Logo.svg.png', url: 'https://www.iplt20.com' },
                  { name: 'Dream11', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Dream11_Logo.svg/300px-Dream11_Logo.svg.png', url: 'https://www.dream11.com' },
                  { name: 'Red Bull', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/RedBullEnergyDrink.svg/300px-RedBullEnergyDrink.svg.png', url: 'https://www.redbull.com' },
                  { name: 'Nike', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/300px-Logo_NIKE.svg.png', url: 'https://www.nike.com' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSponsorName(preset.name);
                      setSponsorLogo(preset.logo);
                      setSponsorUrl(preset.url);
                    }}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                    }}
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  CLOSE
                </button>
                <button
                  type="submit"
                  disabled={sponsorLoading}
                  style={{
                    padding: '8px 22px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--accent-gold)',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-glow-gold)',
                  }}
                >
                  {sponsorLoading ? 'SAVING...' : (editingSponsorId ? '✓ UPDATE SPONSOR' : '+ ADD SPONSOR')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. BOOSTER MODAL */}
        {activeModal === 'booster' && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent-gold)', marginBottom: 8 }}>
              ⚡ FRANCHISE PURSE BOOSTER
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
              Grant purse bonuses or golden card points to a participating team.
            </p>

            {statusMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 6,
                marginBottom: 16,
                background: statusMsg.type === 'success' ? 'rgba(40,167,69,0.2)' : 'rgba(220,53,69,0.2)',
                color: statusMsg.type === 'success' ? 'var(--text-green)' : 'var(--text-red)',
                fontWeight: 600,
              }}>
                {statusMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  SELECT TEAM
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '1rem',
                  }}
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id} style={{ background: '#12112a' }}>
                      {t.name} ({t.shortName}) — Current Purse: ₹{t.purse.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  BOOSTER POINTS AMOUNT (₹)
                </label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-gold)',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {[2000, 5000, 10000, 25000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPointsAmount(amt)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  BOOSTER REASON / CARD TYPE
                </label>
                <input
                  type="text"
                  placeholder="e.g. Golden Card, Sponsor Booster, Bonus Quota"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 20,
                    border: 'none',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleApplyBooster}
                  disabled={loading}
                  style={{
                    padding: '10px 28px',
                    borderRadius: 20,
                    border: 'none',
                    background: 'var(--accent-green)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-glow-green)',
                  }}
                >
                  {loading ? 'APPLYING...' : 'APPLY BOOSTER ⚡'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. PENALTY MODAL */}
        {activeModal === 'penalty' && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent-red)', marginBottom: 8 }}>
              ⚠️ FRANCHISE PENALTY DEDUCTION
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
              Deduct penalty purse points for rules violations or late bid submissions.
            </p>

            {statusMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 6,
                marginBottom: 16,
                background: statusMsg.type === 'success' ? 'rgba(40,167,69,0.2)' : 'rgba(220,53,69,0.2)',
                color: statusMsg.type === 'success' ? 'var(--text-green)' : 'var(--text-red)',
                fontWeight: 600,
              }}>
                {statusMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  SELECT TEAM
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '1rem',
                  }}
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id} style={{ background: '#12112a' }}>
                      {t.name} ({t.shortName}) — Current Purse: ₹{t.purse.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  PENALTY DEDUCTION (₹)
                </label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-red)',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {[1000, 2000, 5000, 10000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPointsAmount(amt)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      -{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  INFRACTION REASON
                </label>
                <input
                  type="text"
                  placeholder="e.g. Slow Bid, Exceeded Squad Limit, Late Check-in"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 20,
                    border: 'none',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleApplyPenalty}
                  disabled={loading}
                  style={{
                    padding: '10px 28px',
                    borderRadius: 20,
                    border: 'none',
                    background: 'var(--accent-red)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-glow-red)',
                  }}
                >
                  {loading ? 'DEDUCTING...' : 'APPLY PENALTY ⚠️'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. JODI (PAIR) MODAL */}
        {activeModal === 'jodi' && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent-gold)', marginBottom: 8 }}>
              👥 JODI (PLAYER COMBO) AUCTION
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
              Auction two players together as a single combined unit at a joint base price.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  FIRST PLAYER
                </label>
                <select
                  value={jodiPlayer1}
                  onChange={(e) => setJodiPlayer1(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                  }}
                >
                  {availablePlayers.map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#12112a' }}>
                      #{p.playerNumber} {p.name} ({p.role || 'Player'}) — ₹{p.category?.basePrice}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  SECOND PLAYER
                </label>
                <select
                  value={jodiPlayer2}
                  onChange={(e) => setJodiPlayer2(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                  }}
                >
                  {availablePlayers.map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#12112a' }}>
                      #{p.playerNumber} {p.name} ({p.role || 'Player'}) — ₹{p.category?.basePrice}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  CUSTOM JOINT BASE PRICE (Optional — leave 0 for combined sum)
                </label>
                <input
                  type="number"
                  placeholder="Combined sum by default"
                  value={jodiCustomPrice}
                  onChange={(e) => setJodiCustomPrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-gold)',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 20,
                    border: 'none',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleLaunchJodi}
                  style={{
                    padding: '10px 28px',
                    borderRadius: 20,
                    border: 'none',
                    background: 'var(--accent-gold)',
                    color: '#000',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  DRAW JODI TO ARENA ➔
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. FORTUNE WHEEL MODAL */}
        {activeModal === 'fortune' && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--accent-gold)', marginBottom: 4 }}>
              🎡 FORTUNE SPINNER WHEEL
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
              Spin to randomly pick the next player to bring to the auction block.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <SpinnerWheel
                numbers={availablePlayers.map(p => p.playerNumber)}
                isSpinning={isSpinning}
                selectedNumber={wonNumber?.playerNumber}
              />
            </div>

            {wonNumber && (
              <div style={{
                background: 'rgba(245, 184, 0, 0.15)',
                border: '1px solid var(--accent-gold)',
                borderRadius: 12,
                padding: '12px 20px',
                marginBottom: 16,
                display: 'inline-block',
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                  WINNING SELECTION:
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                  #{wonNumber.playerNumber} {wonNumber.name} ({wonNumber.category?.name})
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={handleSpinWheel}
                disabled={isSpinning || availablePlayers.length === 0}
                style={{
                  padding: '12px 32px',
                  borderRadius: 30,
                  border: 'none',
                  background: isSpinning ? 'rgba(255,255,255,0.2)' : 'var(--accent-gold)',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  cursor: isSpinning ? 'wait' : 'pointer',
                  boxShadow: 'var(--shadow-glow-gold)',
                }}
              >
                {isSpinning ? 'SPINNING WHEEL...' : 'SPIN WHEEL 🎡'}
              </button>

              {wonNumber && (
                <button
                  type="button"
                  onClick={handleSelectWheelWinner}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 30,
                    border: 'none',
                    background: 'var(--accent-green)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-glow-green)',
                  }}
                >
                  DRAW TO ARENA ➔
                </button>
              )}
            </div>
          </div>
        )}

        {/* 6. MATCH TIE MODAL */}
        {activeModal === 'tie' && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent-gold)', marginBottom: 8 }}>
              🎲 MATCH TIE-BREAKER
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
              Resolve tied bids between two teams via Coin Toss or Dice Roll.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  TIED TEAM 1 (Heads / Dice 1)
                </label>
                <select
                  value={tieTeam1}
                  onChange={(e) => setTieTeam1(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                  }}
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id} style={{ background: '#12112a' }}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  TIED TEAM 2 (Tails / Dice 2)
                </label>
                <select
                  value={tieTeam2}
                  onChange={(e) => setTieTeam2(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                  }}
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id} style={{ background: '#12112a' }}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tie-Breaker Buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                type="button"
                onClick={handleCoinToss}
                disabled={isRolling}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent-purple)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: isRolling ? 'wait' : 'pointer',
                }}
              >
                🪙 FLIP COIN
              </button>
              <button
                type="button"
                onClick={handleDiceRoll}
                disabled={isRolling}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: isRolling ? 'wait' : 'pointer',
                }}
              >
                🎲 ROLL DICE
              </button>
            </div>

            {/* Outcome Display */}
            {coinResult && (
              <div style={{
                background: 'rgba(40,167,69,0.15)',
                border: '1px solid var(--accent-green)',
                borderRadius: 8,
                padding: 16,
                textAlign: 'center',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: '1rem', color: 'var(--accent-gold)', textTransform: 'uppercase', fontWeight: 700 }}>
                  COIN LANDED: {coinResult.outcome.toUpperCase()}!
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginTop: 4 }}>
                  🏆 WINNER: {coinResult.winningTeam?.name}
                </div>
              </div>
            )}

            {diceScores && (
              <div style={{
                background: 'rgba(40,167,69,0.15)',
                border: '1px solid var(--accent-green)',
                borderRadius: 8,
                padding: 16,
                textAlign: 'center',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                  {diceScores.t1?.shortName}: <strong>{diceScores.d1}</strong> vs {diceScores.t2?.shortName}: <strong>{diceScores.d2}</strong>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-green)', marginTop: 4 }}>
                  🏆 WINNER: {diceScores.winningTeam?.name}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 24px',
                  borderRadius: 20,
                  border: 'none',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        )}

        {/* 7. LIVE DISPLAY & BROADCAST OVERLAY LINKS MODAL */}
        {activeModal === 'overlay' && (
          <div style={{ maxWidth: 700 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent-gold)', marginBottom: 8 }}>
              📺 REAL-TIME LIVE AUCTION SCREENS & OVERLAYS
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
              All 3 links automatically synchronize real-time bids, player photos, leading teams, and sponsor banners.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              {/* Screen 1: Broadcast & OBS Overlay */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(245, 184, 0, 0.4)',
                borderRadius: 10,
                padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>📺</span>
                    <strong style={{ color: 'var(--accent-gold)', fontSize: '0.95rem' }}>
                      1. BROADCAST & OBS OVERLAY LINK
                    </strong>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(245, 184, 0, 0.2)', color: 'var(--accent-gold)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                    TRANSPARENT BACKGROUND
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Ultra-clean broadcast graphics with lower-third player card and corner sponsor bug. Add as a Browser Source in OBS Studio / vMix.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--accent-cyan)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {overlayUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(overlayUrl)}
                    style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: copied === overlayUrl ? 'var(--accent-green)' : 'var(--accent-blue)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copied === overlayUrl ? '✓ COPIED' : '📋 COPY'}
                  </button>
                  <a
                    href={overlayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '8px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    OPEN ↗
                  </a>
                </div>
              </div>

              {/* Screen 2: Public Live Screen */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(74, 222, 128, 0.4)',
                borderRadius: 10,
                padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>🌐</span>
                    <strong style={{ color: '#4ade80', fontSize: '0.95rem' }}>
                      2. PUBLIC LIVE SCREEN
                    </strong>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                    FANS & MOBILE SPECTATORS
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Live spectator portal for web visitors, fans & team owners with live head-to-head bids, team purse table, and recent sales feed.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'monospace', color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {publicLiveUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(publicLiveUrl)}
                    style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: copied === publicLiveUrl ? 'var(--accent-green)' : 'var(--accent-blue)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copied === publicLiveUrl ? '✓ COPIED' : '📋 COPY'}
                  </button>
                  <a
                    href={publicLiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '8px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    OPEN ↗
                  </a>
                </div>
              </div>

              {/* Screen 3: Projector / Overlay View */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: 10,
                padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>📽️</span>
                    <strong style={{ color: '#c084fc', fontSize: '0.95rem' }}>
                      3. PROJECTOR / OVERLAY VIEW
                    </strong>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                    FULLSCREEN VENUE STAGE
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  High-impact cinematic stage view optimized for auditorium projectors, big TV displays, and venue LED walls with giant player & team crests.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'monospace', color: '#c084fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {projectorUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(projectorUrl)}
                    style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: copied === projectorUrl ? 'var(--accent-green)' : 'var(--accent-blue)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copied === projectorUrl ? '✓ COPIED' : '📋 COPY'}
                  </button>
                  <a
                    href={projectorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '8px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    OPEN ↗
                  </a>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              padding: 14,
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}>
              💡 <strong>Streaming tip:</strong> In OBS Studio, add a <strong>Browser Source</strong> with URL #1, resolution <strong>1920×1080</strong>, and check "Shutdown source when not visible". For stage projectors, open URL #3 in Chrome and press <strong>F11</strong> or click Fullscreen.
            </div>
          </div>
        )}

        {/* 8. HELP MODAL */}
        {activeModal === 'help' && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent-gold)', marginBottom: 8 }}>
              📖 AUCTION OPERATOR GUIDE & SHORTCUTS
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4, marginTop: 16 }}>
              {[
                { k: '↑ (Up Arrow)', d: 'Fast Increment: Rapidly jumps the running bid' },
                { k: '1 - 9', d: 'Team Hotkeys: Instantly places the bid for that franchise' },
                { k: 'PNo + Enter', d: 'Direct Call: Pulls player directly to block by jersey number' },
                { k: 'Space', d: 'Sold: Confirms player sale to leading bidder' },
                { k: 'U', d: 'Unsold: Marks player as Remain Unsold' },
                { k: 'R', d: 'Re-Auction: Re-opens previous player for price/team correction' },
                { k: 'A', d: 'Auction Arena Screen' },
                { k: 'S', d: 'Team Summary & Remaining Purses' },
                { k: 'P', d: 'Player Directory & Status Filters' },
                { k: 'C', d: 'Category Switcher & Average Points' },
                { k: 'M', d: 'Admin Management & Reset Center' },
                { k: 'F', d: 'Fullscreen display toggle' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 6,
                  }}
                >
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'var(--accent-gold)',
                    background: 'rgba(245,184,0,0.12)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.8rem',
                  }}>
                    {item.k}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {item.d}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 24px',
                  borderRadius: 20,
                  border: 'none',
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                GOT IT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
