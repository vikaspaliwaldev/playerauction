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

  return (
    <div className="manage-panel">
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 className="manage-panel__title" style={{ margin: 0, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
          AUCTION MANAGEMENT & CONTROLS
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Configure live bidding, manage tournament rosters, and broadcast sponsor campaigns
        </p>
      </div>

      {/* Quick Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        <div style={{ background: 'var(--aa-surface-container, var(--bg-card))', padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>TOTAL TEAMS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{teams.length}</div>
        </div>
        <div style={{ background: 'var(--aa-surface-container, var(--bg-card))', padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>TOTAL PLAYERS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{players.length}</div>
        </div>
        <div style={{ background: 'var(--aa-surface-container, var(--bg-card))', padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>SOLD PLAYERS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--aa-primary, #8b5cf6)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{soldCount}</div>
        </div>
        <div style={{ background: 'var(--aa-surface-container, var(--bg-card))', padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>UNSOLD PLAYERS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{unsoldCount}</div>
        </div>
        <div style={{ background: 'var(--aa-surface-container, var(--bg-card))', padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>TOTAL SPENT</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>₹{totalSpent.toLocaleString()}</div>
        </div>
      </div>

      {/* Completed Auction Banner */}
      {tournament?.status === 'completed' && (
        <div style={{
          width: '100%',
          padding: '16px 20px',
          marginBottom: 18,
          borderRadius: 12,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: '1.8rem' }}>🔒</span>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--accent-red)', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                AUCTION COMPLETED & LOCKED
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                Live bidding, re-auctioning, and roster changes (teams, players, categories, bids) are locked.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="manage-panel__action-btn"
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
            onClick={async () => {
              if (!confirm('Reopen this auction? It will reactivate live bidding and unlock tournament/roster changes.')) return;
              try {
                const res = await fetch(`/api/tournaments/${tournamentId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'live' }),
                });
                if (res.ok) {
                  alert('Auction reopened successfully! Live bidding and edits are unlocked.');
                  onRefresh();
                } else {
                  const d = await res.json();
                  alert(d.error || 'Failed to reopen auction');
                }
              } catch (err) {
                alert(err.message);
              }
            }}
          >
            🔄 REOPEN AUCTION NOW
          </button>
        </div>
      )}

      {/* Setup / Add Roster Button */}
      {onOpenSetup && (
        <div style={{ marginBottom: 16 }}>
          <button
            className="manage-panel__action-btn"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6) 0%, #6d28d9 100%)',
              color: '#fff',
              fontSize: '1.05rem',
              fontWeight: 800,
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.35)',
            }}
            onClick={onOpenSetup}
          >
            ➕ ADD & MANAGE PLAYERS, TEAMS & CATEGORIES (SETUP ROSTER)
          </button>
        </div>
      )}


      {/* Action Buttons Grid */}
      <div className="manage-panel__actions-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        <button
          type="button"
          className="manage-panel__action-btn"
          onClick={handleExportCSV}
          title="Download complete team-wise and player-wise auction report in CSV"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--aa-primary, #8b5cf6)' }}>download</span>
          <span>DOWNLOAD CSV REPORT</span>
        </button>

        <button
          type="button"
          className="manage-panel__action-btn"
          onClick={() => onReset('bids')}
        >
          <span>↻</span>
          <span>RESET CURRENT PLAYER BID</span>
        </button>

        <button
          type="button"
          className="manage-panel__action-btn"
          onClick={onRefresh}
        >
          <span>🔄</span>
          <span>SYNC & REFRESH DATA</span>
        </button>

        <button
          type="button"
          className="manage-panel__action-btn"
          onClick={() => setShowBidRules(true)}
        >
          <span>📈</span>
          <span>BID RULES ({tournament?.incrementType === 'slabs' ? 'TIERED SLABS' : `FLAT +₹${tournament?.baseIncrement || 100}`})</span>
        </button>

        <button
          type="button"
          className={`manage-panel__action-btn ${tournament?.status === 'completed' ? '' : 'manage-panel__action-btn--primary'}`}
          style={tournament?.status === 'completed' ? { cursor: 'not-allowed', opacity: 0.6 } : undefined}
          disabled={tournament?.status === 'completed'}
          onClick={() => {
            if (tournament?.status === 'completed') {
              alert('Auction is completed and locked. Please reopen the auction first before re-auctioning unsold players.');
              return;
            }
            onReset('unsold');
          }}
          title={tournament?.status === 'completed' ? 'Auction is completed. Reopen auction to re-auction players.' : 'Re-auction all unsold players'}
        >
          <span>↻</span>
          <span>RE-AUCTION ALL UNSOLD PLAYERS</span>
        </button>

        <button
          type="button"
          className={`manage-panel__action-btn ${tournament?.status === 'completed' ? 'manage-panel__action-btn--primary' : 'manage-panel__action-btn--outline-theme'}`}
          onClick={async () => {
            const isCompleted = tournament?.status === 'completed';
            const action = isCompleted ? 'reopen' : 'finish';
            const confirmMsg = isCompleted
              ? 'Reopen this auction? It will reactivate live bidding and unlock tournament/roster changes.'
              : 'Finish this auction? It will be marked completed, removed from the public Live section, and locked in read-only mode to prevent accidental changes. You can reopen it anytime.';
            if (!confirm(confirmMsg)) return;
            try {
              const res = await fetch(`/api/tournaments/${tournamentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: isCompleted ? 'live' : 'completed' }),
              });
              if (res.ok) {
                alert(isCompleted ? 'Auction reopened successfully! Live bidding and editing are now active.' : 'Auction marked as completed and locked.');
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
          <span>{tournament?.status === 'completed' ? '🔄' : '🏁'}</span>
          <span>{tournament?.status === 'completed' ? 'REOPEN AUCTION' : 'FINISH AUCTION'}</span>
        </button>

        <button
          type="button"
          className="manage-panel__action-btn manage-panel__action-btn--danger"
          style={tournament?.status === 'completed' ? { cursor: 'not-allowed', opacity: 0.6 } : undefined}
          disabled={tournament?.status === 'completed'}
          onClick={() => {
            if (tournament?.status === 'completed') {
              alert('Auction is completed and locked. Please reopen the auction first before resetting.');
              return;
            }
            onReset('all');
          }}
          title={tournament?.status === 'completed' ? 'Auction is completed. Reopen auction to reset.' : 'Reset all sold/unsold status'}
        >
          <span>⚠</span>
          <span>RESET ENTIRE AUCTION</span>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Audio Effects & Gavel
            </span>
            {auctionState?.fireworkAudio ? (
              <span style={{
                padding: '2px 8px',
                borderRadius: 12,
                background: 'rgba(139, 92, 246, 0.18)',
                border: '1px solid var(--aa-primary, #8b5cf6)',
                color: 'var(--aa-primary, #8b5cf6)',
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}>
                ● ON
              </span>
            ) : (
              <span style={{
                padding: '2px 8px',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#ef4444',
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}>
                ○ MUTED
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`manage-panel__toggle-btn ${auctionState?.fireworkAudio ? 'active' : ''}`}
              onClick={() => onUpdateMode('fireworkAudio', true)}
              style={{
                flex: 1,
                border: auctionState?.fireworkAudio ? '1.5px solid var(--aa-primary, #8b5cf6)' : '1px solid var(--border-subtle)',
                background: auctionState?.fireworkAudio ? 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)' : 'var(--bg-card)',
                color: auctionState?.fireworkAudio ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: auctionState?.fireworkAudio ? 700 : 500,
              }}
            >
              🔊 Sound ON {auctionState?.fireworkAudio ? '✓' : ''}
            </button>
            <button
              type="button"
              className={`manage-panel__toggle-btn ${!auctionState?.fireworkAudio ? 'active' : ''}`}
              onClick={() => onUpdateMode('fireworkAudio', false)}
              style={{
                flex: 1,
                border: !auctionState?.fireworkAudio ? '1.5px solid rgba(239, 68, 68, 0.6)' : '1px solid var(--border-subtle)',
                background: !auctionState?.fireworkAudio ? 'rgba(239, 68, 68, 0.18)' : 'var(--bg-card)',
                color: !auctionState?.fireworkAudio ? '#ef4444' : 'var(--text-secondary)',
                fontWeight: !auctionState?.fireworkAudio ? 700 : 500,
              }}
            >
              🔇 Sound OFF {!auctionState?.fireworkAudio ? '✓' : ''}
            </button>
          </div>

          {/* Quick Sound Testing Controls */}
          {auctionState?.fireworkAudio && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="manage-panel__sound-test-btn"
                onClick={() => playBidSound(true)}
                title="Test Bid Gavel Sound"
              >
                🔨 Test Bid
              </button>
              <button
                type="button"
                className="manage-panel__sound-test-btn"
                onClick={() => playSoldSound(true)}
                title="Test Sold Fanfare Sound"
              >
                🏆 Test Sold
              </button>
              <button
                type="button"
                className="manage-panel__sound-test-btn"
                onClick={() => playUnsoldSound(true)}
                title="Test Unsold Sound"
              >
                ❌ Test Unsold
              </button>
              <button
                type="button"
                className="manage-panel__sound-test-btn"
                onClick={() => playDrawPlayerSound(true)}
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
        background: 'var(--aa-surface-container, var(--bg-card))',
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        padding: '24px 28px',
        marginBottom: 28,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.6rem' }}>🏷️</span>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: 0.5 }}>
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
                  border: '1px solid var(--aa-primary, #8b5cf6)',
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: 'var(--aa-primary, #8b5cf6)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                ⚖️ Auto-Distribute Equal %
              </button>
            )}
            <span style={{
              fontSize: '0.75rem',
              background: weightValidation.isValid ? 'rgba(139, 92, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: weightValidation.isValid ? 'var(--aa-primary, #8b5cf6)' : '#ef4444',
              border: `1px solid ${weightValidation.isValid ? 'var(--aa-primary, #8b5cf6)' : 'rgba(239, 68, 68, 0.4)'}`,
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
            background: sponsorMsg.type === 'success' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${sponsorMsg.type === 'success' ? 'var(--aa-primary, #8b5cf6)' : '#ef4444'}`,
            color: sponsorMsg.type === 'success' ? 'var(--aa-primary, #8b5cf6)' : '#ef4444',
            fontSize: '0.85rem',
            fontWeight: 700,
          }}>
            {sponsorMsg.text}
          </div>
        )}

        {/* Live Synchronized 10s Rotation Status Bar */}
        {sponsors.length > 0 && (
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
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
                background: 'var(--aa-primary, #8b5cf6)',
                boxShadow: '0 0 10px rgba(139, 92, 246, 0.6)',
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
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      {activeLiveSponsor.name}
                    </strong>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(139, 92, 246, 0.15)', color: 'var(--aa-primary, #8b5cf6)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                      {activeLiveSponsor.weight}% weight
                    </span>
                    {link && <span style={{ fontSize: '0.72rem', color: 'var(--aa-primary, #8b5cf6)' }}>↗</span>}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                <span>⏱️ Next 10s Rotation In:</span>
                <span style={{ background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 900 }}>
                  {secondsLeftInSlot}s
                </span>
              </div>
            )}
          </div>
        )}

        {/* Visual Theme Allocation Bar */}
        {sponsors.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>BANNER DISPLAY TIME ALLOCATION (100-SECOND CYCLE):</span>
              <span>Each 10% weight = 10 seconds of airtime</span>
            </div>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
              {sponsors.map((s, idx) => {
                const colors = ['#8b5cf6', '#6366f1', '#0ea5e9', '#3b82f6', '#a855f7', '#7c3aed'];
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
            {sponsors.map((s) => {
              const isCurrentlyLive = activeLiveSponsor?.id === s.id;
              return (
                <div
                  key={s.id}
                  style={{
                    background: isCurrentlyLive ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isCurrentlyLive ? 'var(--aa-primary, #8b5cf6)' : 'var(--border-subtle)'}`,
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
                          <span style={{ fontSize: '0.68rem', background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)', color: '#ffffff', padding: '2px 7px', borderRadius: 4, fontWeight: 800, letterSpacing: '0.5px' }}>
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
                              color: 'var(--aa-primary, #8b5cf6)',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
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
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 4,
                          color: 'var(--text-primary)',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--aa-primary, #8b5cf6)' }}>%</span>
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
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
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
            background: 'var(--bg-tertiary)',
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
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: editingSponsorId ? 'var(--aa-primary, #8b5cf6)' : 'var(--text-primary)' }}>
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
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
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
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
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
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
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
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                    }}
                  />
                  <span style={{ color: 'var(--aa-primary, #8b5cf6)', fontWeight: 800, fontSize: '0.9rem' }}>%</span>
                </div>
              </div>
            </div>

            {/* Logo Preview */}
            {sponsorLogo && (
              <div style={{
                padding: '8px 14px',
                borderRadius: 6,
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-subtle)',
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                    Ready to show on live displays (Weight: {sponsorWeight}%)
                  </span>
                  {sponsorUrl && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--aa-primary, #8b5cf6)' }}>
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
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    fontWeight: 600,
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
                  background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6) 0%, #6d28d9 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
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
        <h3 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: 1, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📺</span> REAL-TIME LIVE AUCTION SCREENS (ALL 3 MODES)
        </h3>
      </div>

      <div className="manage-panel__links" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Link 1: Broadcast & OBS Overlay Link */}
        <div className="manage-panel__link-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: 'var(--text-primary)' }}>
              <span>📺</span> 1) BROADCAST & OBS OVERLAY LINK
              <span style={{ fontSize: '0.7rem', background: 'rgba(139, 92, 246, 0.14)', color: 'var(--aa-primary, #8b5cf6)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
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
                padding: '6px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              OPEN ↗
            </a>
          </div>
        </div>

        {/* Link 2: Public Live Screen */}
        <div className="manage-panel__link-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: 'var(--text-primary)' }}>
              <span>🌐</span> 2) PUBLIC LIVE SCREEN
              <span style={{ fontSize: '0.7rem', background: 'rgba(2, 132, 199, 0.14)', color: 'var(--aa-secondary, #0284c7)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
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
                padding: '6px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              OPEN ↗
            </a>
          </div>
        </div>

        {/* Link 3: Projector / Overlay View */}
        <div className="manage-panel__link-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: 'var(--text-primary)' }}>
              <span>📽️</span> 3) PROJECTOR / OVERLAY VIEW
              <span style={{ fontSize: '0.7rem', background: 'rgba(139, 92, 246, 0.14)', color: 'var(--aa-primary, #8b5cf6)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
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
                padding: '6px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              OPEN ↗
            </a>
          </div>
        </div>

        {/* Dashboard Link */}
        <div className="manage-panel__link-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>RETURN TO USER DASHBOARD</span>
          <Link
            href="/dashboard"
            className="manage-panel__link-copy"
            style={{ textDecoration: 'none' }}
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
