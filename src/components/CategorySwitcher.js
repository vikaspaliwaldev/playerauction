'use client';

import { useState } from 'react';

export default function CategorySwitcher({ tournament, auctionState, onSwitch, onRefresh }) {
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(false);

  const categories = tournament?.categories || [];
  const players = tournament?.players || [];
  const activeCategoryId = auctionState?.activeCategory;

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
        }),
      });
      if (res.ok) {
        setEditingCategory(null);
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update category minimum points');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="category-switcher" style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 className="category-switcher__title" style={{ margin: '0 0 6px', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
          AUCTION CATEGORY ROSTER
        </h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Select active category to filter bidding stage pool • Click ⚙️ to adjust base price
        </div>
      </div>

      <div className="category-switcher__grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {/* All Categories Button */}
        <button
          className={`category-switcher__btn ${!activeCategoryId ? 'active' : ''}`}
          onClick={() => onSwitch(null)}
          title="All categories combined"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
              ALL CATEGORIES
            </span>
            {!activeCategoryId && (
              <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 10, background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)', color: '#fff', fontWeight: 800, letterSpacing: '0.5px' }}>
                ACTIVE POOL
              </span>
            )}
          </div>
          <div style={{ marginTop: 'auto' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: 'var(--aa-secondary)', fontWeight: 600 }}>
              {allStats.available} Available / {allStats.total} Total Players
            </span>
          </div>
        </button>

        {/* Individual Category Buttons */}
        {categories.map((cat) => {
          const stats = getCategoryStats(cat.id);
          const isActive = activeCategoryId === cat.id;

          return (
            <div
              key={cat.id}
              style={{ position: 'relative', display: 'flex', width: '100%' }}
            >
              <button
                className={`category-switcher__btn ${isActive ? 'active' : ''}`}
                onClick={() => onSwitch(cat.id)}
                style={{ paddingRight: 56 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.name.toUpperCase()}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 10, background: 'linear-gradient(135deg, var(--aa-primary, #8b5cf6), #6d28d9)', color: '#fff', fontWeight: 800, letterSpacing: '0.5px', flexShrink: 0 }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 'auto' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-gold)', fontWeight: 800 }}>
                    Base: ₹{cat.basePrice.toLocaleString()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {stats.available} Available / {stats.total} Total
                  </span>
                </div>
              </button>

              {/* Quick Edit Min Points Button */}
              <button
                type="button"
                className="category-switcher__gear-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCategory({ ...cat });
                }}
                title={`Edit ${cat.name} Minimum Points / Base Price`}
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

      {/* Edit Category Minimum Points Modal */}
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
              background: 'var(--bg-card-solid)',
              border: '1px solid var(--accent-gold)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
              width: '100%',
              maxWidth: 440,
              padding: 24,
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--accent-gold)', margin: 0 }}>
                ⚙️ CATEGORY MINIMUM POINTS
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
                  MINIMUM POINTS / BASE BID (₹)
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Newly drawn players in this category will start bidding from this minimum price.
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
                  Save Minimum Points ✔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
