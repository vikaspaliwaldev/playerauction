'use client';

export default function TeamOwnersView({ tournament, onBack }) {
  const teams = tournament?.teams || [];

  return (
    <div style={{
      position: 'relative',
      zIndex: 10,
      padding: '24px 32px 80px',
      maxWidth: 1400,
      margin: '0 auto',
      minHeight: 'calc(100vh - var(--header-height))',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--accent-gold)', margin: 0 }}>
            FRANCHISE TEAM OWNERS
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Official franchise owners, co-owners, and mentors representation
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ← BACK TO AUCTION
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 24,
      }}>
        {teams.map((team) => {
          const owners = team.owners || [];
          return (
            <div
              key={team.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${team.color || 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {/* Team Crest & Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {team.logo ? (
                  <img src={team.logo} alt={team.name} style={{ width: 56, height: 56, objectFit: 'contain' }} />
                ) : (
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: team.color || 'var(--accent-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    color: '#fff',
                  }}>
                    {team.shortName}
                  </div>
                )}
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', margin: 0, color: '#fff' }}>
                    {team.name}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Purse: ₹{team.purse.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Owners */}
              <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent-gold)' }}>
                  TEAM LEADERSHIP
                </div>
                {owners.length > 0 ? (
                  owners.map((owner) => (
                    <div key={owner.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {owner.photo ? (
                        <img src={owner.photo} alt={owner.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
                          {owner.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{owner.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{owner.role || 'Owner'}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
                      👤
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{team.name} Management</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Franchise Owner</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
