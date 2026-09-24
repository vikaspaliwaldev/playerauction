'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import BidRulesModal from '@/components/BidRulesModal';
import { getActiveSponsor, validateWeights, rebalanceWeights, formatSponsorUrl } from '@/lib/sponsorRotation';
import { playBidSound, playSoldSound, playUnsoldSound, playDrawPlayerSound } from '@/lib/soundEffects';

export default function ManagePanel({
  tournament,
  auctionState,
  onReset,
  onUpdateMode,
  onRefresh,
  onOpenSetup,
  tournamentId,
  onShowMenu,
}) {
  const [showBidRules, setShowBidRules] = useState(false);

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
  const [copiedLink, setCopiedLink] = useState(null);

  // 1-second interval for 10-second rotation countdown
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

  useEffect(() => {
    if (tournament?.sponsors?.[0]) {
      setSponsorName(tournament.sponsors[0].name || '');
      setSponsorLogo(tournament.sponsors[0].logo || '');
      setSponsorUrl(tournament.sponsors[0].url || '');
    } else {
      setSponsorName('');
      setSponsorLogo('');
      setSponsorUrl('');
    }
  }, [tournament]);

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
      setSponsorMsg({ type: 'error', text: 'Please enter a sponsor image URL or upload an image file' });
      return;
    }
    setSponsorLoading(true);
    setSponsorMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/sponsors`, {
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
          text: editingSponsorId ? 'Sponsor banner updated successfully!' : 'New sponsor banner added successfully!',
        });
        setSponsorName('');
        setSponsorLogo('');
        setSponsorUrl('');
        setSponsorWeight(33);
        setEditingSponsorId(null);
        if (onRefresh) onRefresh();
        setTimeout(() => setSponsorMsg(null), 3500);
      } else {
        const d = await res.json();
        setSponsorMsg({ type: 'error', text: d.error || 'Failed to save sponsor banner' });
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
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingSponsorId(null);
    setSponsorName('');
    setSponsorLogo('');
    setSponsorUrl('');
    setSponsorWeight(33);
  };

  const handleDeleteSponsor = async (sponsorId) => {
    if (!confirm('Remove this sponsor banner from the tournament?')) return;
    setSponsorLoading(true);
    setSponsorMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/sponsors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId, autoRebalance: true }),
      });
      if (res.ok) {
        setSponsorMsg({ type: 'success', text: 'Sponsor banner removed.' });
        if (editingSponsorId === sponsorId) handleCancelEdit();
        if (onRefresh) onRefresh();
        setTimeout(() => setSponsorMsg(null), 3500);
      } else {
        const d = await res.json();
        setSponsorMsg({ type: 'error', text: d.error || 'Failed to remove sponsor banner' });
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
      await fetch(`/api/tournaments/${tournamentId}/sponsors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId, weight: validWeight }),
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to update weight:', err);
    }
  };

  const handleAutoRebalance = async () => {
    if (sponsors.length === 0) return;
    setSponsorLoading(true);
    try {
      const balanced = rebalanceWeights(sponsors);
      const res = await fetch(`/api/tournaments/${tournamentId}/sponsors`, {
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

  const players = tournament?.players || [];
  const teams = tournament?.teams || [];
  const soldCount = players.filter(p => p.status === 'sold').length;
  const unsoldCount = players.filter(p => p.status === 'unsold').length;
  const availableCount = players.filter(p => p.status === 'available').length;
  const totalSpent = teams.reduce((sum, t) => {
    return sum + (t.sales || []).reduce((s, sale) => s + (sale.soldPrice || 0), 0);
  }, 0);

  const copyToClipboard = (text, label) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      const fullUrl = `${window.location.origin}${text}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(null), 2500);
    }
  };

  return (
    <div className="manage-panel">
      <h2 className="manage-panel__title">AUCTION MANAGEMENT & CONTROLS</h2>

      {/* Quick Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL TEAMS</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{teams.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL PLAYERS</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{players.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-green)' }}>SOLD PLAYERS</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-green)' }}>{soldCount}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-red)' }}>UNSOLD PLAYERS</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-red)' }}>{unsoldCount}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>TOTAL SPENT</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-gold)' }}>₹{totalSpent.toLocaleString()}</div>
        </div>
      </div>

      {/* Setup / Add Roster Button */}
      {onOpenSetup && (
        <div style={{ marginBottom: 16 }}>
          <button
            className="manage-panel__action-btn"
            style={{
              width: '100%',
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontSize: '1.05rem',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
            }}
            onClick={onOpenSetup}
          >
            ➕ ADD & MANAGE PLAYERS, TEAMS & CATEGORIES (SETUP ROSTER)
          </button>
        </div>
      )}


      {/* Action Buttons Grid */}
      <div className="manage-panel__actions-grid">
        <button
          className="manage-panel__action-btn"
          style={{ background: '#b91c1c' }}
          onClick={() => onReset('all')}
        >
          ⚠ RESET ENTIRE AUCTION (ALL SALES & BIDS)
        </button>

        <button
          className="manage-panel__action-btn"
          style={{ background: '#c2410c' }}
          onClick={() => onReset('unsold')}
        >
          ↻ RE-AUCTION ALL UNSOLD PLAYERS
        </button>

        <button
          className="manage-panel__action-btn"
          style={{ background: 'var(--accent-purple)' }}
          onClick={() => onReset('bids')}
        >
          RESET CURRENT PLAYER BID
        </button>

        <button
          className="manage-panel__action-btn"
          style={{ background: 'var(--accent-blue)' }}
          onClick={onRefresh}
        >
          SYNC & REFRESH DATA
        </button>

        <button
          className="manage-panel__action-btn"
          style={{ background: 'rgba(245, 184, 0, 0.2)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold)' }}
          onClick={() => setShowBidRules(true)}
        >
          📈 BID INCREMENT RULES ({tournament?.incrementType === 'slabs' ? 'TIERED SLABS' : `FLAT +₹${tournament?.baseIncrement || 100}`})
        </button>

        <button
          className="manage-panel__action-btn"
          style={{
            background: tournament?.status === 'completed'
              ? 'rgba(78, 222, 163, 0.15)'
              : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${tournament?.status === 'completed' ? 'var(--accent-green)' : 'var(--accent-orange)'}`,
            color: tournament?.status === 'completed' ? 'var(--accent-green)' : 'var(--accent-orange)',
          }}
          onClick={async () => {
            const isCompleted = tournament?.status === 'completed';
            const action = isCompleted ? 'reopen' : 'finish';
            const confirmMsg = isCompleted
              ? 'Reopen this auction? It will become visible in the Live section again.'
              : 'Finish this auction? It will be removed from the public Live section. You can reopen it later if needed.';
            if (!confirm(confirmMsg)) return;
            try {
              const res = await fetch(`/api/tournaments/${tournamentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: isCompleted ? 'live' : 'completed' }),
              });
              if (res.ok) {
                alert(isCompleted ? 'Auction reopened successfully!' : 'Auction finished! It is now removed from the live section.');
                onRefresh();
              } else {
                const d = await res.json();
                alert(d.error || `Failed to ${action} auction`);
              }
            } catch (err) {
              alert(err.message);
            }
          }}
        >
          {tournament?.status === 'completed' ? '🔄 REOPEN AUCTION' : '🏁 FINISH AUCTION'}
        </button>
      </div>

      {/* Toggles */}
      <div className="manage-panel__toggles">
        {/* Toggle Group 1: Auction Mode */}
        <div className="manage-panel__toggle-group">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Auction Mode
          </div>
          <button
            className={`manage-panel__toggle-btn ${auctionState?.mode === 'trial' ? 'active' : ''}`}
            onClick={() => onUpdateMode('mode', 'trial')}
          >
            Trial / Practice
          </button>
          <button
            className={`manage-panel__toggle-btn ${auctionState?.mode === 'live' ? 'active' : ''}`}
            onClick={() => onUpdateMode('mode', 'live')}
          >
            Official Live Mode
          </button>
        </div>

        {/* Toggle Group 2: Selection Mode */}
        <div className="manage-panel__toggle-group">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Player Selection
          </div>
          <button
            className={`manage-panel__toggle-btn ${auctionState?.selectionMode === 'random' ? 'active' : ''}`}
            onClick={() => onUpdateMode('selectionMode', 'random')}
          >
            Random Draw
          </button>
          <button
            className={`manage-panel__toggle-btn ${auctionState?.selectionMode === 'sequence' ? 'active' : ''}`}
            onClick={() => onUpdateMode('selectionMode', 'sequence')}
          >
            Sequence by Number
          </button>
          <button
            className={`manage-panel__toggle-btn ${auctionState?.selectionMode === 'manual' ? 'active' : ''}`}
            onClick={() => onUpdateMode('selectionMode', 'manual')}
          >
            Manual Entry
          </button>
        </div>

        {/* Toggle Group 3: Audio Effects */}
        <div className="manage-panel__toggle-group">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Audio Effects & Gavel
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`manage-panel__toggle-btn ${auctionState?.fireworkAudio ? 'active' : ''}`}
              onClick={() => onUpdateMode('fireworkAudio', true)}
            >
              Sound ON 🔊
            </button>
            <button
              className={`manage-panel__toggle-btn ${!auctionState?.fireworkAudio ? 'active' : ''}`}
              onClick={() => onUpdateMode('fireworkAudio', false)}
            >
              Sound OFF 🔇
            </button>
          </div>

          {/* Quick Sound Testing Controls */}
          {auctionState?.fireworkAudio && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => playBidSound(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  color: 'var(--accent-gold)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Test Bid Gavel Sound"
              >
                🔨 Test Bid
              </button>
              <button
                type="button"
                onClick={() => playSoldSound(true)}
                style={{
                  background: 'rgba(40, 167, 69, 0.15)',
                  border: '1px solid var(--accent-green)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  color: 'var(--text-green)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Test Sold Fanfare Sound"
              >
                🏆 Test Sold
              </button>
              <button
                type="button"
                onClick={() => playUnsoldSound(true)}
                style={{
                  background: 'rgba(220, 53, 69, 0.15)',
                  border: '1px solid var(--accent-red)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  color: 'var(--text-red)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Test Unsold Sound"
              >
                ❌ Test Unsold
              </button>
              <button
                type="button"
                onClick={() => playDrawPlayerSound(true)}
                style={{
                  background: 'rgba(74, 111, 165, 0.15)',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Test Draw Player Action Sound"
              >
                🎡 Test Action
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MULTI-SPONSOR BANNER MANAGEMENT WITH 10S ROTATION & WEIGHTAGES */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-gold)',
        borderRadius: 14,
        padding: '24px 28px',
        marginBottom: 28,
        boxShadow: '0 4px 25px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.6rem' }}>🏷️</span>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-gold)', margin: 0, letterSpacing: 0.5 }}>
                TOURNAMENT SPONSORS & 10s ROTATING BANNERS
              </h3>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Display multiple sponsors across OBS Overlay, Stage Projector & Public Screen. Changes automatically every 10 seconds according to weightage %.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {sponsors.length > 0 && (
              <button
                type="button"
                onClick={handleAutoRebalance}
                disabled={sponsorLoading}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--accent-cyan)',
                  background: 'rgba(6, 182, 212, 0.15)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⚖️ Auto-Distribute Equal %
              </button>
            )}
            <span style={{
              fontSize: '0.75rem',
              background: weightValidation.isValid ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: weightValidation.isValid ? '#4ade80' : '#ef4444',
              border: `1px solid ${weightValidation.isValid ? '#4ade80' : '#ef4444'}`,
              padding: '4px 10px',
              borderRadius: 12,
              fontWeight: 800,
            }}>
              TOTAL WEIGHT: {weightValidation.totalWeight}% {weightValidation.isValid ? '✓' : `(${weightValidation.difference > 0 ? `+${weightValidation.difference}% needed` : `${weightValidation.difference}% over`})`}
            </span>
          </div>
        </div>

        {sponsorMsg && (
          <div style={{
            padding: '10px 16px',
            borderRadius: 6,
            marginBottom: 16,
            background: sponsorMsg.type === 'success' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)',
            border: `1px solid ${sponsorMsg.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
            color: sponsorMsg.type === 'success' ? 'var(--text-green)' : 'var(--text-red)',
            fontSize: '0.85rem',
            fontWeight: 700,
          }}>
            {sponsorMsg.text}
          </div>
        )}

        {/* Live Synchronized 10s Rotation Status Bar */}
        {sponsors.length > 0 && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(245, 184, 0, 0.1), rgba(168, 85, 247, 0.1))',
            border: '1px solid rgba(245, 184, 0, 0.3)',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 10px #4ade80',
              }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                LIVE ON STREAM & PROJECTOR RIGHT NOW:
              </span>
              {activeLiveSponsor ? (() => {
                const link = formatSponsorUrl(activeLiveSponsor.url);
                const inner = (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="sponsor-logo-box" style={{ padding: '2px 6px', height: 28 }}>
                      <img src={activeLiveSponsor.logo} alt="Live" style={{ maxHeight: 22, maxWidth: 70, objectFit: 'contain' }} />
                    </div>
                    <strong style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>
                      {activeLiveSponsor.name}
                    </strong>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(245, 184, 0, 0.2)', color: 'var(--accent-gold)', padding: '1px 6px', borderRadius: 4 }}>
                      {activeLiveSponsor.weight}% weight
                    </span>
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
              })() : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None</span>
              )}
            </div>
            {sponsors.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#c084fc', fontWeight: 700 }}>
                <span>⏱️ Next 10s Rotation In:</span>
                <span style={{ background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 900 }}>
                  {secondsLeftInSlot}s
                </span>
              </div>
            )}
          </div>
        )}

        {/* Visual Multi-Color Allocation Bar */}
        {sponsors.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>BANNER DISPLAY TIME ALLOCATION (100-SECOND CYCLE):</span>
              <span>Each 10% weight = 10 seconds of airtime</span>
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
              {sponsors.map((s, idx) => {
                const colors = ['#f5b800', '#06b6d4', '#a855f7', '#ec4899', '#10b981', '#f97316'];
                const color = colors[idx % colors.length];
                const width = Math.max(2, s.weight || 10);
                return (
                  <div
                    key={s.id}
                    title={`${s.name}: ${s.weight}% (${s.weight}s per 100s)`}
                    style={{
                      width: `${width}%`,
                      background: color,
                      transition: 'width 0.3s ease',
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* List of Active Tournament Sponsors */}
        {sponsors.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ACTIVE TOURNAMENT SPONSORS ({sponsors.length}):
            </div>
            {sponsors.map((s, idx) => {
              const isCurrentlyLive = activeLiveSponsor?.id === s.id;
              const colors = ['#f5b800', '#06b6d4', '#a855f7', '#ec4899', '#10b981', '#f97316'];
              const accentColor = colors[idx % colors.length];
              return (
                <div
                  key={s.id}
                  style={{
                    background: isCurrentlyLive ? 'rgba(245, 184, 0, 0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isCurrentlyLive ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                    borderRadius: 8,
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 220 }}>
                    <div className="sponsor-logo-box" style={{
                      width: 54,
                      height: 40,
                      padding: 3,
                    }}>
                      <img src={s.logo} alt={s.name} style={{ maxHeight: 34, maxWidth: 48, objectFit: 'contain' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{s.name}</span>
                        {isCurrentlyLive && (
                          <span style={{ fontSize: '0.68rem', background: '#4ade80', color: '#000', padding: '1px 6px', borderRadius: 4, fontWeight: 900 }}>
                            ON AIR NOW
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Airtime: ~{s.weight}s per 100s ({Math.round(s.weight / 10)} slots of 10s)
                      </div>
                      {s.url && (
                        <div style={{ marginTop: 2 }}>
                          <a
                            href={formatSponsorUrl(s.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--accent-cyan)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title={s.url}
                          >
                            🔗 {s.url.length > 30 ? s.url.slice(0, 30) + '...' : s.url} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Weight % Editor */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>WEIGHT:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={s.weight || 33}
                        onChange={(e) => handleQuickWeightChange(s.id, e.target.value)}
                        style={{
                          width: 44,
                          padding: '2px 4px',
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 4,
                          color: 'var(--accent-gold)',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-gold)' }}>%</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleEditSponsor(s)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSponsor(s.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(220, 53, 69, 0.4)',
                        background: 'rgba(220, 53, 69, 0.15)',
                        color: 'var(--text-red)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 8,
            padding: 20,
            textAlign: 'center',
            marginBottom: 20,
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
          }}>
            No sponsor banners added yet. Fill out the form below to add your first sponsor banner!
          </div>
        )}

        {/* Add / Edit Sponsor Form */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: editingSponsorId ? 'var(--accent-gold)' : '#fff' }}>
              {editingSponsorId ? '✏️ EDIT SPONSOR BANNER' : '➕ ADD NEW SPONSOR BANNER'}
            </h4>
            {editingSponsorId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSaveSponsor} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  SPONSOR / BRAND NAME *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tata IPL, Dream11, Red Bull"
                  value={sponsorName}
                  onChange={e => setSponsorName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  BANNER / LOGO (URL or Upload Image File) *
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Paste image URL (https://...) or upload"
                    value={sponsorLogo}
                    onChange={e => setSponsorLogo(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '0.85rem',
                    }}
                  />
                  <label style={{
                    padding: '9px 14px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>
                    📁 Upload
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

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  🔗 REDIRECT HYPERLINK / WEBSITE URL (OPTIONAL - OPENS IN NEW TAB ON CLICK)
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://www.sponsorwebsite.com or www.brand.com"
                  value={sponsorUrl}
                  onChange={e => setSponsorUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--accent-cyan)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  WEIGHTAGE % (OUT OF 100)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="33"
                    value={sponsorWeight}
                    onChange={e => setSponsorWeight(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: 'var(--accent-gold)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                    }}
                  />
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 800, fontSize: '0.9rem' }}>%</span>
                </div>
              </div>
            </div>

            {/* Logo Preview */}
            {sponsorLogo && (
              <div style={{
                padding: '8px 14px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed var(--border-gold)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}>
                <img
                  src={sponsorLogo}
                  alt="Preview"
                  style={{ maxHeight: 42, maxWidth: 120, objectFit: 'contain' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                    Ready to show on live displays (Weight: {sponsorWeight}%)
                  </span>
                  {sponsorUrl && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                      Redirects to: {formatSponsorUrl(sponsorUrl)} ↗
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Quick Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>QUICK PRESETS:</span>
              {[
                { name: 'Tata IPL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Indian_Premier_League_Official_Logo.svg/300px-Indian_Premier_League_Official_Logo.svg.png', url: 'https://www.iplt20.com' },
                { name: 'Dream11', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Dream11_Logo.svg/300px-Dream11_Logo.svg.png', url: 'https://www.dream11.com' },
                { name: 'Red Bull', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/RedBullEnergyDrink.svg/300px-RedBullEnergyDrink.svg.png', url: 'https://www.redbull.com' },
                { name: 'Nike', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/300px-Logo_NIKE.svg.png', url: 'https://www.nike.com' },
                { name: 'Pepsi', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pepsi_2023.svg/300px-Pepsi_2023.svg.png', url: 'https://www.pepsi.com' },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { setSponsorName(p.name); setSponsorLogo(p.logo); setSponsorUrl(p.url); }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                  }}
                >
                  + {p.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                disabled={sponsorLoading}
                style={{
                  padding: '10px 28px',
                  background: 'var(--accent-gold)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-glow-gold)',
                }}
              >
                {sponsorLoading ? 'SAVING...' : (editingSponsorId ? '✓ UPDATE SPONSOR BANNER' : '+ ADD SPONSOR BANNER')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* External Live Links - ALL 3 SCREENS */}
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: 1, color: 'var(--accent-gold)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📺</span> REAL-TIME LIVE AUCTION SCREENS (ALL 3 MODES)
        </h3>
      </div>

      <div className="manage-panel__links" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Link 1: Broadcast & OBS Overlay Link */}
        <div className="manage-panel__link-row" style={{ background: 'rgba(245, 184, 0, 0.12)', border: '1px solid rgba(245, 184, 0, 0.35)', padding: '14px 18px', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: 'var(--accent-gold)' }}>
              <span>📺</span> 1) BROADCAST & OBS OVERLAY LINK
              <span style={{ fontSize: '0.7rem', background: 'rgba(245, 184, 0, 0.25)', color: 'var(--accent-gold)', padding: '2px 8px', borderRadius: 4 }}>
                TRANSPARENT BACKGROUND
              </span>
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Lower-third graphic card with player avatar, live bid, and leading team crest for OBS Studio / vMix.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="manage-panel__link-copy"
              onClick={() => copyToClipboard(`/live/${tournamentId}?overlay=true`, 'overlay')}
            >
              {copiedLink === 'overlay' ? '✓ COPIED!' : '📋 COPY LINK'}
            </button>
            <a
              href={`/live/${tournamentId}?overlay=true`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-primary)',
                textDecoration: 'none',
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 4,
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              OPEN ↗
            </a>
          </div>
        </div>

        {/* Link 2: Public Live Screen */}
        <div className="manage-panel__link-row" style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.35)', padding: '14px 18px', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: '#4ade80' }}>
              <span>🌐</span> 2) PUBLIC LIVE SCREEN
              <span style={{ fontSize: '0.7rem', background: 'rgba(74, 222, 128, 0.25)', color: '#4ade80', padding: '2px 8px', borderRadius: 4 }}>
                FANS & SPECTATOR PORTAL
              </span>
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Spectator portal with live head-to-head bidding card, team purse standings table, and recent sales ticker.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="manage-panel__link-copy"
              onClick={() => copyToClipboard(`/live/${tournamentId}`, 'live')}
            >
              {copiedLink === 'live' ? '✓ COPIED!' : '📋 COPY LINK'}
            </button>
            <a
              href={`/live/${tournamentId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-primary)',
                textDecoration: 'none',
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 4,
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              OPEN ↗
            </a>
          </div>
        </div>

        {/* Link 3: Projector / Overlay View */}
        <div className="manage-panel__link-row" style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.35)', padding: '14px 18px', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: '#c084fc' }}>
              <span>📽️</span> 3) PROJECTOR / OVERLAY VIEW
              <span style={{ fontSize: '0.7rem', background: 'rgba(168, 85, 247, 0.25)', color: '#c084fc', padding: '2px 8px', borderRadius: 4 }}>
                AUDITORIUM & STAGE LED WALLS
              </span>
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Cinematic full-screen stage presentation view with giant 240px × 290px player and team logo frames.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="manage-panel__link-copy"
              onClick={() => copyToClipboard(`/live/${tournamentId}?mode=projector`, 'projector')}
            >
              {copiedLink === 'projector' ? '✓ COPIED!' : '📋 COPY LINK'}
            </button>
            <a
              href={`/live/${tournamentId}?mode=projector`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-primary)',
                textDecoration: 'none',
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 4,
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              OPEN ↗
            </a>
          </div>
        </div>

        {/* Dashboard Link */}
        <div className="manage-panel__link-row" style={{ background: 'var(--bg-tertiary)' }}>
          <span>RETURN TO USER DASHBOARD</span>
          <Link
            href="/dashboard"
            style={{
              color: 'var(--text-primary)',
              textDecoration: 'none',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4,
              fontSize: '0.8rem',
            }}
          >
            DASHBOARD ↗
          </Link>
        </div>
      </div>

      {/* Bid Increment Rules Modal */}
      <BidRulesModal
        isOpen={showBidRules}
        onClose={() => setShowBidRules(false)}
        tournament={tournament}
        onRefresh={onRefresh}
      />
    </div>
  );
}
