'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuctionArenaLogo from '@/components/AuctionArenaLogo';

export default function DashboardPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [deletingTournament, setDeletingTournament] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    logo: '',
    totalPurse: 100000,
    minPlayers: 7,
    maxPlayers: 15,
    baseIncrement: 100,
    sportType: 'cricket',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    logo: '',
    totalPurse: 100000,
    minPlayers: 7,
    maxPlayers: 15,
    baseIncrement: 100,
    sportType: 'cricket',
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const res = await fetch('/api/tournaments');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg, type = 'success') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleFileUpload = (e, setFormData) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setFormData(prev => ({ ...prev, logo: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({ name: '', logo: '', totalPurse: 100000, minPlayers: 7, maxPlayers: 15, baseIncrement: 100, sportType: 'cricket' });
        showNotification('Tournament created successfully!');
        fetchTournaments();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create tournament');
      }
    } catch (err) {
      console.error('Create error:', err);
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (t, e) => {
    e.stopPropagation();
    setEditingTournament(t);
    setEditForm({
      name: t.name || '',
      logo: t.logo || '',
      totalPurse: t.totalPurse || 100000,
      minPlayers: t.minPlayers || 7,
      maxPlayers: t.maxPlayers || 15,
      baseIncrement: t.baseIncrement || 100,
      sportType: t.sportType || 'cricket',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTournament) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${editingTournament.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingTournament(null);
        showNotification(`Tournament "${editForm.name}" updated successfully!`);
        fetchTournaments();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update tournament');
      }
    } catch (err) {
      console.error('Edit error:', err);
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDelete = (t, e) => {
    e.stopPropagation();
    setDeletingTournament(t);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTournament) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${deletingTournament.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const deletedName = deletingTournament.name;
        setDeletingTournament(null);
        showNotification(`Tournament "${deletedName}" deleted successfully!`);
        fetchTournaments();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete tournament');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  return (
    <>
      <div className="auction-bg" />
      <div className="geometric-frame" />

      <div className="dashboard">
        <div className="dashboard__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <AuctionArenaLogo size="small" />
            </Link>
            <div style={{ width: 1, height: 26, background: 'var(--border-subtle)' }} />
            <h1 className="dashboard__title" style={{ margin: 0, fontSize: '1.4rem' }}>
              Organizer Dashboard
            </h1>
          </div>
          <div className="d-flex gap-sm">
            <button className="dashboard__btn" onClick={() => setShowCreate(true)}>
              + New Tournament
            </button>
            <button
              className="dashboard__btn"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: 20,
            borderRadius: 8,
            background: message.type === 'success' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)',
            border: `1px solid ${message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
            color: message.type === 'success' ? 'var(--text-green)' : 'var(--text-red)',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏏</div>
            <p>No tournaments yet. Create your first one!</p>
          </div>
        ) : (
          <div className="dashboard__tournaments">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="tournament-card"
                onClick={() => router.push(`/manage/${t.id}`)}
                title={`Open ${t.name} Auction & Roster`}
              >
                {/* Header: Logo + Title + Action buttons */}
                <div className="tournament-card__header">
                  <div className="tournament-card__identity">
                    {t.logo ? (
                      <img
                        src={t.logo}
                        alt={t.name}
                        className="tournament-card__logo"
                      />
                    ) : (
                      <div className="tournament-card__logo">
                        🏆
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h2 className="tournament-card__name" title={t.name}>{t.name}</h2>
                      <span className={`tournament-card__status tournament-card__status--${t.status}`} style={{ marginTop: 0 }}>
                        {t.status}
                      </span>
                    </div>
                  </div>

                  <div className="tournament-card__actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="tournament-card__action-btn"
                      onClick={(e) => handleOpenEdit(t, e)}
                      title="Edit Tournament Name, Logo, and Rules"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="tournament-card__action-btn tournament-card__action-btn--delete"
                      onClick={(e) => handleOpenDelete(t, e)}
                      title="Delete Tournament"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="tournament-card__stats">
                  <div className="tournament-card__stat">
                    Teams: <span className="tournament-card__stat-value">{t._count?.teams || 0}</span>
                  </div>
                  <div className="tournament-card__stat">
                    Players: <span className="tournament-card__stat-value">{t._count?.players || 0}</span>
                  </div>
                  <div className="tournament-card__stat">
                    Purse: <span className="tournament-card__stat-value">{(t.totalPurse || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  marginTop: 14,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--accent-gold)',
                }}>
                  Enter Auction & Setup →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Tournament Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <h2 className="modal__title">Create Tournament</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Tournament Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g., 7PD Volleyball Premier League, Super Cricket Cup"
                  required
                />
              </div>

              <div className="form-group">
                <label>Tournament Logo (Image URL or Upload)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="text"
                    value={createForm.logo}
                    onChange={(e) => setCreateForm({ ...createForm, logo: e.target.value })}
                    placeholder="Paste image URL (https://...)"
                    style={{ flex: 1 }}
                  />
                  <label style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}>
                    📁 Upload
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, setCreateForm)}
                    />
                  </label>
                  {createForm.logo && (
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, logo: '' })}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(220,53,69,0.15)',
                        border: '1px solid var(--accent-red)',
                        color: 'var(--text-red)',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {createForm.logo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    <img src={createForm.logo} alt="Preview" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 4, background: '#fff' }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-green)', fontWeight: 600 }}>✓ Logo attached</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Sport Type</label>
                <select
                  value={createForm.sportType}
                  onChange={(e) => setCreateForm({ ...createForm, sportType: e.target.value })}
                >
                  <option value="cricket">Cricket</option>
                  <option value="football">Football</option>
                  <option value="volleyball">Volleyball</option>
                  <option value="badminton">Badminton</option>
                  <option value="kabaddi">Kabaddi</option>
                  <option value="basketball">Basketball</option>
                  <option value="tennis">Tennis</option>
                  <option value="chess">Chess</option>
                  <option value="carrom">Carrom</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Total Purse Per Team</label>
                <input
                  type="number"
                  value={createForm.totalPurse}
                  onChange={(e) => setCreateForm({ ...createForm, totalPurse: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Min Players</label>
                  <input
                    type="number"
                    value={createForm.minPlayers}
                    onChange={(e) => setCreateForm({ ...createForm, minPlayers: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>Max Players</label>
                  <input
                    type="number"
                    value={createForm.maxPlayers}
                    onChange={(e) => setCreateForm({ ...createForm, maxPlayers: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Bid Increment</label>
                <input
                  type="number"
                  value={createForm.baseIncrement}
                  onChange={(e) => setCreateForm({ ...createForm, baseIncrement: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="modal__actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn-primary" style={{ width: 'auto', padding: '0 24px' }}>
                  {actionLoading ? 'Creating...' : 'Create Tournament'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tournament Modal */}
      {editingTournament && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setEditingTournament(null)}>
          <div className="modal">
            <h2 className="modal__title">Edit Tournament</h2>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>Tournament Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Tournament Name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Tournament Logo (Image URL or Upload)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="text"
                    value={editForm.logo}
                    onChange={(e) => setEditForm({ ...editForm, logo: e.target.value })}
                    placeholder="Paste image URL (https://...)"
                    style={{ flex: 1 }}
                  />
                  <label style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}>
                    📁 Upload
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, setEditForm)}
                    />
                  </label>
                  {editForm.logo && (
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, logo: '' })}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(220,53,69,0.15)',
                        border: '1px solid var(--accent-red)',
                        color: 'var(--text-red)',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {editForm.logo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    <img src={editForm.logo} alt="Preview" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 4, background: '#fff' }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-green)', fontWeight: 600 }}>✓ Logo preview</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Sport Type</label>
                <select
                  value={editForm.sportType}
                  onChange={(e) => setEditForm({ ...editForm, sportType: e.target.value })}
                >
                  <option value="cricket">Cricket</option>
                  <option value="football">Football</option>
                  <option value="volleyball">Volleyball</option>
                  <option value="badminton">Badminton</option>
                  <option value="kabaddi">Kabaddi</option>
                  <option value="basketball">Basketball</option>
                  <option value="tennis">Tennis</option>
                  <option value="chess">Chess</option>
                  <option value="carrom">Carrom</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Total Purse Per Team</label>
                <input
                  type="number"
                  value={editForm.totalPurse}
                  onChange={(e) => setEditForm({ ...editForm, totalPurse: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Min Players</label>
                  <input
                    type="number"
                    value={editForm.minPlayers}
                    onChange={(e) => setEditForm({ ...editForm, minPlayers: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>Max Players</label>
                  <input
                    type="number"
                    value={editForm.maxPlayers}
                    onChange={(e) => setEditForm({ ...editForm, maxPlayers: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Bid Increment</label>
                <input
                  type="number"
                  value={editForm.baseIncrement}
                  onChange={(e) => setEditForm({ ...editForm, baseIncrement: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="modal__actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingTournament(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn-primary" style={{ width: 'auto', padding: '0 24px' }}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTournament && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDeletingTournament(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <h2 className="modal__title" style={{ color: 'var(--accent-red)' }}>Delete Tournament?</h2>
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 12 }}>
                Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>&quot;{deletingTournament.name}&quot;</strong>?
              </p>
              <div style={{
                padding: '12px',
                background: 'rgba(220, 53, 69, 0.12)',
                border: '1px solid rgba(220, 53, 69, 0.3)',
                borderRadius: 8,
                fontSize: '0.85rem',
                color: 'var(--text-red)',
                lineHeight: 1.4,
              }}>
                ⚠️ <strong>Warning:</strong> This will permanently delete all franchise teams, player rosters, auction history, and settings for this tournament. This action cannot be undone.
              </div>
            </div>

            <div className="modal__actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeletingTournament(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                style={{
                  background: 'var(--accent-red)',
                  borderColor: 'var(--accent-red)',
                  width: 'auto',
                  padding: '0 20px',
                }}
              >
                {actionLoading ? 'Deleting...' : '🗑️ Yes, Delete Tournament'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
