'use client';

import { useState, useMemo } from 'react';
import { getDefaultSlabs, parseSlabs, getBidIncrement } from '@/lib/auctionRules';

export default function BidRulesModal({ isOpen, onClose, tournament, onRefresh }) {
  const [incrementType, setIncrementType] = useState(tournament?.incrementType || 'flat');
  const [flatIncrement, setFlatIncrement] = useState(tournament?.baseIncrement || 100);
  const [slabs, setSlabs] = useState(() => {
    const existing = parseSlabs(tournament?.incrementSlabs);
    return existing.length > 0 ? existing : getDefaultSlabs();
  });
  const [testBid, setTestBid] = useState(1500);
  const [loading, setLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  // Compute test increment
  const simulatedTournament = useMemo(() => ({
    baseIncrement: flatIncrement,
    incrementType,
    incrementSlabs: slabs,
  }), [flatIncrement, incrementType, slabs]);

  const previewIncrement = useMemo(() => {
    return getBidIncrement(testBid, simulatedTournament);
  }, [testBid, simulatedTournament]);

  if (!isOpen) return null;

  const handleAddSlab = () => {
    const last = slabs[slabs.length - 1];
    const prevUpTo = last && last.upTo ? Number(last.upTo) : 2000;
    const prevInc = last ? Number(last.increment) : 20;

    // Insert new slab before the open-ended slab (or append)
    const newSlabs = [...slabs];
    if (newSlabs.length > 0 && newSlabs[newSlabs.length - 1].upTo === null) {
      newSlabs.splice(newSlabs.length - 1, 0, {
        upTo: prevUpTo + 1000,
        increment: prevInc + 10,
      });
    } else {
      newSlabs.push({ upTo: prevUpTo + 1000, increment: prevInc + 10 });
    }
    setSlabs(newSlabs);
  };

  const handleUpdateSlab = (index, field, value) => {
    const updated = [...slabs];
    updated[index] = {
      ...updated[index],
      [field]: value === '' ? null : (field === 'upTo' && value === null ? null : parseInt(value) || 0),
    };
    setSlabs(updated);
  };

  const handleRemoveSlab = (index) => {
    if (slabs.length <= 1) return;
    setSlabs(slabs.filter((_, i) => i !== index));
  };

  const handleApplyPreset = (presetType) => {
    if (presetType === 'user-example') {
      setIncrementType('slabs');
      setSlabs([
        { upTo: 1000, increment: 10 },
        { upTo: 2000, increment: 20 },
        { upTo: null, increment: 30 },
      ]);
    } else if (presetType === 'ipl') {
      setIncrementType('slabs');
      setSlabs([
        { upTo: 100000, increment: 5000 },
        { upTo: 200000, increment: 10000 },
        { upTo: 500000, increment: 20000 },
        { upTo: null, increment: 25000 },
      ]);
    } else if (presetType === 'pkl') {
      setIncrementType('slabs');
      setSlabs([
        { upTo: 10000, increment: 500 },
        { upTo: 25000, increment: 1000 },
        { upTo: 50000, increment: 2000 },
        { upTo: null, increment: 5000 },
      ]);
    } else if (presetType === 'flat-100') {
      setIncrementType('flat');
      setFlatIncrement(100);
    } else if (presetType === 'flat-500') {
      setIncrementType('flat');
      setFlatIncrement(500);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSavedMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incrementType,
          baseIncrement: parseInt(flatIncrement) || 100,
          incrementSlabs: JSON.stringify(slabs),
        }),
      });

      if (res.ok) {
        setSavedMsg('Bid increment rules saved successfully!');
        if (onRefresh) onRefresh();
        setTimeout(() => {
          setSavedMsg(null);
          onClose();
        }, 1200);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to save bid rules');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 3500,
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
          border: '1px solid var(--accent-gold)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.9)',
          width: '100%',
          maxWidth: 640,
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--accent-gold)', margin: 0 }}>
              📈 BID INCREMENT RULES
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Configure how bid amounts automatically step up when auctioning players.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.4rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {savedMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: 'rgba(40,167,69,0.2)',
              border: '1px solid var(--accent-green)',
              color: 'var(--text-green)',
              fontWeight: 700,
              fontSize: '0.85rem',
              marginBottom: 14,
            }}
          >
            ✔ {savedMsg}
          </div>
        )}

        {/* Rule Type Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setIncrementType('flat')}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: incrementType === 'flat' ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
              background: incrementType === 'flat' ? 'rgba(245, 184, 0, 0.15)' : 'rgba(255,255,255,0.04)',
              color: incrementType === 'flat' ? 'var(--accent-gold)' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '1.05rem', marginBottom: 2 }}>Option 1: Flat Increment</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.85 }}>
              Every bid increases by a fixed point amount (e.g. +100).
            </div>
          </button>

          <button
            type="button"
            onClick={() => setIncrementType('slabs')}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: incrementType === 'slabs' ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
              background: incrementType === 'slabs' ? 'rgba(245, 184, 0, 0.15)' : 'rgba(255,255,255,0.04)',
              color: incrementType === 'slabs' ? 'var(--accent-gold)' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '1.05rem', marginBottom: 2 }}>Option 2: Tiered Slabs</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.85 }}>
              Increment changes as bid price grows (e.g. +10 till 1k, +20 till 2k).
            </div>
          </button>
        </div>

        {/* Option 1: Flat Config */}
        {incrementType === 'flat' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              FLAT INCREMENT AMOUNT (₹)
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="number"
                min="1"
                value={flatIncrement}
                onChange={e => setFlatIncrement(parseInt(e.target.value) || 0)}
                style={{
                  width: 140,
                  padding: '10px 14px',
                  background: 'rgba(245,184,0,0.12)',
                  border: '1px solid var(--accent-gold)',
                  borderRadius: 6,
                  color: 'var(--accent-gold)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Each click or hotkey will raise the bid by exactly ₹{flatIncrement.toLocaleString()}.
              </span>
            </div>
          </div>
        )}

        {/* Option 2: Slabs Config */}
        {incrementType === 'slabs' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            {/* Presets */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRESETS:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('user-example')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: '1px solid var(--accent-cyan)',
                  background: 'rgba(23,162,184,0.15)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⚡ 10 till 1k, 20 till 2k, 30+
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('ipl')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                IPL Big Slabs (5k - 25k)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('pkl')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                PKL / League (500 - 5k)
              </button>
            </div>

            {/* Slabs Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slabs.map((slab, idx) => {
                const isLast = idx === slabs.length - 1;
                const prevLimit = idx > 0 ? (slabs[idx - 1].upTo || 0) : 0;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1.2fr 40px',
                      gap: 10,
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '8px 12px',
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                        {isLast && slab.upTo === null
                          ? `ABOVE ₹${prevLimit.toLocaleString()} (TILL END)`
                          : `UP TO BID AMOUNT (₹)`}
                      </span>
                      {isLast && slab.upTo === null ? (
                        <div style={{ color: 'var(--accent-gold)', fontWeight: 800, fontSize: '0.9rem', padding: '6px 0' }}>
                          ₹{prevLimit.toLocaleString()} &amp; Beyond
                        </div>
                      ) : (
                        <input
                          type="number"
                          placeholder="e.g. 1000"
                          value={slab.upTo ?? ''}
                          onChange={e => handleUpdateSlab(idx, 'upTo', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 4,
                            color: '#fff',
                            fontWeight: 700,
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                        INCREMENT BY (+₹)
                      </span>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 10"
                        value={slab.increment}
                        onChange={e => handleUpdateSlab(idx, 'increment', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          background: 'rgba(40,167,69,0.15)',
                          border: '1px solid var(--accent-green)',
                          borderRadius: 4,
                          color: 'var(--text-green)',
                          fontWeight: 800,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSlab(idx)}
                      disabled={slabs.length <= 1}
                      title="Remove slab"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: slabs.length <= 1 ? 'rgba(255,255,255,0.2)' : 'var(--text-red)',
                        fontSize: '1.1rem',
                        cursor: slabs.length <= 1 ? 'not-allowed' : 'pointer',
                        padding: 4,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleAddSlab}
                style={{
                  marginTop: 6,
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px dashed var(--accent-gold)',
                  background: 'rgba(245,184,0,0.08)',
                  color: 'var(--accent-gold)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                + Add Another Slab Level
              </button>
            </div>
          </div>
        )}

        {/* Live Interactive Tester */}
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(245,184,0,0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              TEST BID (₹):
            </span>
            <input
              type="number"
              value={testBid}
              onChange={e => setTestBid(parseInt(e.target.value) || 0)}
              style={{
                width: 90,
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                color: '#fff',
                fontWeight: 700,
                textAlign: 'center',
              }}
            />
          </div>

          <div style={{ fontSize: '0.85rem' }}>
            Next Step: <strong style={{ color: 'var(--text-green)', fontSize: '1rem' }}>+₹{previewIncrement.toLocaleString()}</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
              (Next Bid: ₹{(testBid + previewIncrement).toLocaleString()})
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: 6,
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '10px 24px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent-gold)',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-glow-gold)',
            }}
          >
            {loading ? 'Saving...' : 'Save Increment Rules ✔'}
          </button>
        </div>
      </div>
    </div>
  );
}
