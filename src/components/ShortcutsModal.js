'use client';

export default function ShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '↑ (Up Arrow)', desc: 'Jump / Rapid increment bid value' },
    { key: '1 - 9 / Hotkeys', desc: 'Place bid for assigned Team directly' },
    { key: 'PNo + Enter', desc: 'Recall / Draw specific player by jersey number' },
    { key: 'Space', desc: 'Confirm and mark player as SOLD' },
    { key: 'U', desc: 'Mark player as REMAIN UNSOLD' },
    { key: 'R', desc: 'Re-auction current / last processed player' },
    { key: 'A', desc: 'Switch to Auction Arena' },
    { key: 'S', desc: 'Switch to Team Summary' },
    { key: 'P', desc: 'Switch to Player Directory' },
    { key: 'C', desc: 'Switch to Category Switcher' },
    { key: 'M', desc: 'Switch to Admin / Manage Panel' },
    { key: 'F', desc: 'Toggle Fullscreen display' },
    { key: 'Esc', desc: 'Close dialogs and menus' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
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
          border: '1px solid var(--accent-gold)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          width: '100%',
          maxWidth: 540,
          padding: 24,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--accent-gold)', margin: 0 }}>
            ⌨ KEYBOARD SHORTCUTS
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '65vh', overflowY: 'auto' }}>
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 6,
              }}
            >
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                background: 'rgba(245, 184, 0, 0.15)',
                color: 'var(--accent-gold)',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: '0.85rem',
                border: '1px solid rgba(245, 184, 0, 0.3)',
              }}>
                {sc.key}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {sc.desc}
              </span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
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
    </div>
  );
}
