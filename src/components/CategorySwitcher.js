'use client';

import { useState, useMemo } from 'react';

export default function CategorySwitcher({ tournament, auctionState, onSwitch, onRefresh }) {
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(false);

  const categories = tournament?.categories || [];
  const players = tournament?.players || [];
  const rawActive = auctionState?.activeCategory;

  // Parse active category selection (null, 'ALL', or comma-separated category IDs)
  const activeCatIds = useMemo(() => {
    if (!rawActive || rawActive === 'ALL') return [];
    return rawActive.split(',').filter(Boolean);
  }, [rawActive]);

  const isAllSelected = activeCatIds.length === 0 || activeCatIds.length === categories.length;

  // Compute category stats
  const getCategoryStats = (catId) => {
    const catPlayers = catId
      ? players.filter(p => p.categoryId === catId)
      : players;

    const total = catPlayers.length;
    const sold = catPlayers.filter(p => p.status === 'sold').length;
    const unsold = catPlayers.filter(p => p.status === 'unsold').length;
    const available = catPlayers.filter(p => p.status === 'available').length;

    // Calculate average sold price
    const soldPlayers = catPlayers.filter(p => p.status === 'sold' && p.sale);
    const avgSold = soldPlayers.length > 0
      ? Math.round(soldPlayers.reduce((sum, p) => sum + (p.sale?.soldPrice || 0), 0) / soldPlayers.length)
      : 0;

    return { total, sold, unsold, available, avgSold };
  };

  const allStats = getCategoryStats(null);

  // Compute stats for current active pool
  const poolStats = useMemo(() => {
    if (isAllSelected) return allStats;
    const poolPlayers = players.filter(p => activeCatIds.includes(p.categoryId));
    const available = poolPlayers.filter(p => p.status === 'available').length;
    return { available, total: poolPlayers.length };
  }, [isAllSelected, activeCatIds, players, allStats]);

  // Handle toggling category in multi-selection
  const handleToggleCategory = (catId) => {
    if (isAllSelected) {
      // If previously ALL was selected, clicking one category isolates it
      onSwitch(catId, true);
      return;
    }

    if (activeCatIds.includes(catId)) {
      const remaining = activeCatIds.filter(id => id !== catId);
      if (remaining.length === 0 || remaining.length === categories.length) {
        onSwitch(null, true); // Revert to ALL
      } else {
        onSwitch(remaining.join(','), true);
      }
    } else {
      const updated = [...activeCatIds, catId];
      if (updated.length === categories.length) {
        onSwitch(null, true); // All selected
      } else {
        onSwitch(updated.join(','), true);
      }
    }
  };

  // Select ONLY this category and proceed
  const handleSelectOnly = (catId, andProceed = false) => {
    onSwitch(catId, !andProceed);
  };

  // Select all categories
  const handleSelectAll = (andProceed = false) => {
    onSwitch(null, !andProceed);
  };

  // Save category edits (Name, Base Price, minPerTeam, maxPerTeam)
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/categories`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: editingCategory.id,
          name: editingCategory.name,
          basePrice: editingCategory.basePrice,
          minPerTeam: (editingCategory.minPerTeam === '' || editingCategory.minPerTeam === null || parseInt(editingCategory.minPerTeam) < 0) ? 0 : parseInt(editingCategory.minPerTeam),
          maxPerTeam: (editingCategory.maxPerTeam === '' || editingCategory.maxPerTeam === null || parseInt(editingCategory.maxPerTeam) <= 0) ? null : parseInt(editingCategory.maxPerTeam),
        }),
      });
      if (res.ok) {
        setEditingCategory(null);
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update category');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="category-switcher" style={{ maxWidth: 1160, margin: '0 auto', padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 className="category-switcher__title" style={{ margin: '0 0 6px', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
          AUCTION CATEGORY ROSTER
        </h2>
        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Select <strong>1, multiple, or all categories</strong> to define the active player pool for the Spin Wheel • Click ⚙️ to configure reserve rules & base prices
        </div>
      </div>

      {/* Control / Pool Summary Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        padding: '12px 20px',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 20,
            background: isAllSelected
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.25))'
              : 'linear-gradient(135deg, rgba(245, 184, 0, 0.2), rgba(234, 88, 12, 0.2))',
            border: isAllSelected ? '1px solid var(--accent-purple, #8b5cf6)' : '1px solid var(--accent-gold)',
          }}>
            <span style={{ fontSize: '1rem' }}>{isAllSelected ? '🌐' : '🎯'}</span>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: isAllSelected ? '#c4b5fd' : 'var(--accent-gold)' }}>
              {isAllSelected
                ? 'ALL CATEGORIES IN POOL'
                : `${activeCatIds.length} OF ${categories.length} CATEGORIES ACTIVE`}
            </span>
          </div>

          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            <strong>{poolStats.available}</strong> Available / {poolStats.total} Total in Active Spin Pool
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="category-select-all-btn"
            onClick={() => handleSelectAll(false)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: isAllSelected ? 'var(--border-subtle)' : 'transparent',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>✨</span>
            <span>Select All</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitch(rawActive, false)}
            style={{
              padding: '7px 18px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(139, 92, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>➜</span>
            <span>Go to Arena (Spin)</span>
          </button>
        </div>
      </div>

      {/* Grid of Categories */}
      <div className="category-switcher__grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {/* ALL CATEGORIES Card */}
        <div
          onClick={() => handleSelectAll(false)}
          className={`category-switcher__btn ${isAllSelected ? 'active' : ''}`}
          style={{
            cursor: 'pointer',
            border: isAllSelected ? '2px solid var(--accent-purple, #8b5cf6)' : '1px solid var(--border-subtle)',
            background: isAllSelected ? 'rgba(139, 92, 246, 0.16)' : 'var(--bg-card)',
            boxShadow: isAllSelected ? '0 0 20px rgba(139, 92, 246, 0.25)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
          }}
          title="Click to select ALL categories in the pool"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
              ALL CATEGORIES
            </span>
            <span style={{
              fontSize: '0.72rem',
              padding: '3px 8px',
              borderRadius: 8,
              background: isAllSelected ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'var(--border-subtle)',
              color: isAllSelected ? '#fff' : 'var(--text-primary)',
              fontWeight: 800,
            }}>
              {isAllSelected ? '✔ ALL ACTIVE' : 'COMBINE ALL'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Includes every player across all tournament tiers in the spin wheel.
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--aa-secondary, #38bdf8)', fontWeight: 700 }}>
              {allStats.available} Available / {allStats.total} Total Players
            </span>
          </div>
        </div>

        {/* Individual Category Cards */}
        {categories.map((cat) => {
          const stats = getCategoryStats(cat.id);
          const isSelected = isAllSelected || activeCatIds.includes(cat.id);
          const isExplicitlySolo = !isAllSelected && activeCatIds.length === 1 && activeCatIds[0] === cat.id;
          const minReq = cat.minPerTeam || 0;
          const maxPer = cat.maxPerTeam || null;
          const reserveContrib = minReq * cat.basePrice;

          return (
            <div
              key={cat.id}
              onClick={() => handleToggleCategory(cat.id)}
              className={`category-switcher__btn ${isSelected ? 'active' : ''}`}
              style={{
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                paddingRight: 52, // Space for ⚙️ button
                border: isSelected ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                background: isSelected ? 'rgba(245, 184, 0, 0.1)' : 'var(--bg-card)',
                boxShadow: isSelected ? '0 0 16px rgba(245, 184, 0, 0.2)' : 'none',
                transition: 'all 0.2s ease',
              }}
              title="Click card to toggle inclusion in spin pool"
            >
              {/* Header with Title and Toggle Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  {/* Visual Checkbox */}
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: isSelected ? '2px solid var(--accent-gold)' : '2px solid rgba(255,255,255,0.3)',
                    background: isSelected ? 'var(--accent-gold)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    flexShrink: 0,
                  }}>
                    {isSelected ? '✓' : ''}
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    color: 'var(--text-primary)',
                    letterSpacing: '0.02em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {cat.name.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isExplicitlySolo && (
                    <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 6, background: 'var(--accent-gold)', color: '#000', fontWeight: 900 }}>
                      SOLO
                    </span>
                  )}
                  {isSelected && (
                    <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 8, background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)', color: '#fff', fontWeight: 800 }}>
                      IN POOL
                    </span>
                  )}
                </div>
              </div>

              {/* Category Rules & Reserve Requirement */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Base Price / Min Points:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: 'var(--accent-gold)', fontWeight: 800 }}>
                    ₹{cat.basePrice.toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Min Required / Team:</span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: minReq > 0 ? '#4ade80' : 'var(--text-muted)',
                    background: minReq > 0 ? 'rgba(74, 222, 128, 0.12)' : 'transparent',
                    padding: minReq > 0 ? '1px 6px' : '0',
                    borderRadius: 4,
                  }}>
                    {minReq > 0 ? `${minReq} players (Reserve: ₹${reserveContrib.toLocaleString()})` : 'None required'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max Limit / Team:</span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: maxPer ? 'var(--accent-gold)' : 'var(--text-muted)',
                  }}>
                    {maxPer ? `Max ${maxPer} players` : 'Unlimited'}
                  </span>
                </div>
              </div>

              {/* Pool counts & Quick Solo Button */}
              <div style={{
                marginTop: 'auto',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {stats.available} Available / {stats.total} Total
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectOnly(cat.id, false);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                  title={`Select only ${cat.name}`}
                >
                  Only This
                </button>
              </div>

              {/* Quick Edit Min Points / Quotas Button */}
              <button
                type="button"
                className="category-switcher__gear-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCategory({ ...cat });
                }}
                title={`Edit ${cat.name} Minimum Points, Reserve Quota & Limits`}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 10,
                  zIndex: 5,
                }}
              >
                ⚙️
              </button>
            </div>
          );
        })}
      </div>

      {categories.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>
          <p>No categories found in this tournament.</p>
        </div>
      )}

      {/* Edit Category Minimum Points & Quotas Modal */}
      {editingCategory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setEditingCategory(null)}
        >
          <div
            style={{
              background: 'var(--bg-card-solid, #181926)',
              border: '1px solid var(--accent-gold)',
              borderRadius: 'var(--radius-lg, 16px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
              width: '100%',
              maxWidth: 480,
              padding: 24,
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--accent-gold)', margin: 0 }}>
                ⚙️ CONFIGURE CATEGORY & MIN RESERVE
              </h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
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

            <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  CATEGORY NAME
                </label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: '#fff',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  BASE BID / MINIMUM POINTS (₹)
                </label>
                <input
                  type="number"
                  value={editingCategory.basePrice}
                  onChange={e => setEditingCategory({ ...editingCategory, basePrice: parseInt(e.target.value) || 0 })}
                  required
                  min="0"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(245, 184, 0, 0.12)',
                    border: '1px solid var(--accent-gold)',
                    borderRadius: 6,
                    color: 'var(--accent-gold)',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Starting price for players in this category when drawn to the block.
                </span>
              </div>

              {/* Min Players Required (Enforces Minimum Reserve Balance) */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  MIN PLAYERS REQUIRED PER TEAM (ENFORCES MIN RESERVE PURSE)
                </label>
                <input
                  type="number"
                  value={editingCategory.minPerTeam === null || editingCategory.minPerTeam === undefined ? 0 : editingCategory.minPerTeam}
                  onChange={e => setEditingCategory({ ...editingCategory, minPerTeam: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                  min="0"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(74, 222, 128, 0.1)',
                    border: '1px solid #4ade80',
                    borderRadius: 6,
                    color: '#4ade80',
                    fontWeight: 800,
                    fontSize: '1rem',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Every team must maintain at least ({editingCategory.minPerTeam || 0} × ₹{editingCategory.basePrice || 0} = ₹{((editingCategory.minPerTeam || 0) * (editingCategory.basePrice || 0)).toLocaleString()}) reserve in purse to buy their mandatory quota.
                </span>
              </div>

              {/* Max Players Limit */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  MAX PLAYERS LIMIT PER TEAM (OPTIONAL)
                </label>
                <input
                  type="number"
                  placeholder="Leave blank or 0 for unlimited"
                  value={editingCategory.maxPerTeam === null || editingCategory.maxPerTeam === undefined ? '' : editingCategory.maxPerTeam}
                  onChange={e => setEditingCategory({ ...editingCategory, maxPerTeam: e.target.value === '' ? null : parseInt(e.target.value) || 0 })}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    color: '#fff',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Prevents any team from purchasing more than this number of players from this category.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  style={{
                    padding: '8px 16px',
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
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--accent-gold)',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Save Changes ✔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
