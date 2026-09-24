'use client';

import { useState, useMemo } from 'react';
import { getDefaultSlabs, parseSlabs, getBidIncrement } from '@/lib/auctionRules';
import { rebalanceWeights, validateWeights, formatSponsorUrl } from '@/lib/sponsorRotation';

const SPORT_ROLE_PRESETS = {
  Cricket: ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper'],
  Football: ['Forward / Striker', 'Midfielder', 'Defender', 'Goalkeeper'],
  Kabaddi: ['Raider', 'Defender (Left Corner)', 'Defender (Right Corner)', 'All-Rounder'],
  Volleyball: ['Attacker / Spiker', 'Setter', 'Blocker', 'Libero'],
  Basketball: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
  General: ['Player', 'Captain', 'Vice Captain', 'Marquee Player'],
};

export default function SetupPanel({ tournament, onComplete, onRefresh }) {
  const [activeTab, setActiveTab] = useState('quick'); // quick | teams | players | categories | bidRules
  const [playerMode, setPlayerMode] = useState('single'); // single | bulk
  const [selectedSport, setSelectedSport] = useState('Cricket');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Forms state for Add
  const [teamForm, setTeamForm] = useState({
    name: '',
    shortName: '',
    purse: tournament?.totalPurse || 100000,
    color: '#dc3545',
    hotkey: '',
    logo: '',
  });
  const [catForm, setCatForm] = useState({ name: '', basePrice: 1000, maxPerTeam: '' });
  const [playerForm, setPlayerForm] = useState({
    name: '',
    playerNumber: '',
    categoryId: '',
    role: 'Batsman',
    battingStyle: 'Right Hand',
    age: 25,
    photo: '',
  });

  // Edit states
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Bid rules state
  const [rulesIncType, setRulesIncType] = useState(tournament?.incrementType || 'flat');
  const [rulesFlatInc, setRulesFlatInc] = useState(tournament?.baseIncrement || 100);
  const [rulesSlabs, setRulesSlabs] = useState(() => {
    const existing = parseSlabs(tournament?.incrementSlabs);
    return existing.length > 0 ? existing : getDefaultSlabs();
  });
  const [rulesTestBid, setRulesTestBid] = useState(1500);

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');

  const categories = tournament?.categories || [];
  const teams = tournament?.teams || [];
  const players = tournament?.players || [];
  const sponsors = tournament?.sponsors || [];

  const [sponsorForm, setSponsorForm] = useState({ name: '', logo: '', url: '', weight: 33 });

  const sponsorValidation = useMemo(() => {
    return validateWeights(sponsors);
  }, [sponsors]);

  const handleSponsorUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Sponsor image size should be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSponsorForm(prev => ({ ...prev, logo: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddSponsor = async (e) => {
    e.preventDefault();
    if (!sponsorForm.logo || !sponsorForm.logo.trim()) {
      setMessage({ type: 'error', text: 'Please provide a sponsor logo/banner URL or upload an image' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sponsorForm.name.trim() || 'Official Sponsor',
          logo: sponsorForm.logo.trim(),
          url: sponsorForm.url?.trim() || null,
          weight: parseInt(sponsorForm.weight) || 33,
        }),
      });
      if (res.ok) {
        notifySuccess('Sponsor banner saved successfully!');
        setSponsorForm({ name: '', logo: '', url: '', weight: 33 });
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to save sponsor' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
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
      console.error('Failed to update sponsor weight:', err);
    }
  };

  const handleAutoRebalanceSponsors = async () => {
    if (sponsors.length === 0) return;
    setLoading(true);
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
        notifySuccess('Sponsor weights distributed equally to 100%!');
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSponsor = async (sponsorId) => {
    if (!confirm('Remove this sponsor banner from tournament?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId }),
      });
      if (res.ok) {
        notifySuccess('Sponsor banner removed.');
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to remove sponsor' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTeamLogoUpload = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo image size should be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (isEdit) {
        setEditingTeam(prev => ({ ...prev, logo: ev.target.result }));
      } else {
        setTeamForm(prev => ({ ...prev, logo: ev.target.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePlayerPhotoUpload = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Avatar image size should be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (isEdit) {
        setEditingPlayer(prev => ({ ...prev, photo: ev.target.result }));
      } else {
        setPlayerForm(prev => ({ ...prev, photo: ev.target.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const notifySuccess = (text) => {
    setMessage({ type: 'success', text });
    if (onRefresh) onRefresh();
    setTimeout(() => setMessage(null), 3000);
  };

  // Quick Seed Demo Data
  const handleSeedDemoData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/seed`, { method: 'POST' });
      if (res.ok) {
        notifySuccess('Demo teams, categories, and players loaded successfully!');
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to load demo data' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Add Category
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catForm),
      });
      if (res.ok) {
        setCatForm({ name: '', basePrice: 1000, maxPerTeam: '' });
        notifySuccess(`Category "${catForm.name}" added successfully!`);
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to add category' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Update Category
  const handleUpdateCategory = async (e) => {
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
          maxPerTeam: (editingCategory.maxPerTeam === '' || editingCategory.maxPerTeam === null || parseInt(editingCategory.maxPerTeam) <= 0) ? null : parseInt(editingCategory.maxPerTeam),
        }),
      });
      if (res.ok) {
        setEditingCategory(null);
        notifySuccess(`Category "${editingCategory.name}" updated successfully!`);
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to update category' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (categoryId, name) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/categories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });
      if (res.ok) {
        if (editingCategory?.id === categoryId) setEditingCategory(null);
        notifySuccess(`Category "${name}" deleted successfully!`);
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to delete category' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Save Bid Rules
  const handleSaveBidRules = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incrementType: rulesIncType,
          baseIncrement: parseInt(rulesFlatInc) || 100,
          incrementSlabs: JSON.stringify(rulesSlabs),
        }),
      });
      if (res.ok) {
        notifySuccess('Bid increment rules updated successfully!');
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to update bid rules' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Add Team
  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.name || !teamForm.shortName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamForm.name,
          shortName: teamForm.shortName,
          purse: parseInt(teamForm.purse) || tournament?.totalPurse || 100000,
          color: teamForm.color,
          hotkey: teamForm.hotkey ? teamForm.hotkey.trim().toUpperCase() : null,
          logo: teamForm.logo || null,
        }),
      });
      if (res.ok) {
        notifySuccess(`Team "${teamForm.name}" added successfully!`);
        setTeamForm({
          name: '',
          shortName: '',
          purse: tournament?.totalPurse || 100000,
          color: '#dc3545',
          hotkey: '',
          logo: '',
        });
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to add team' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Update Team
  const handleSaveTeamEdit = async (e) => {
    e.preventDefault();
    if (!editingTeam) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/teams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: editingTeam.id,
          name: editingTeam.name,
          shortName: editingTeam.shortName,
          purse: parseInt(editingTeam.purse) || 0,
          color: editingTeam.color,
          hotkey: editingTeam.hotkey ? editingTeam.hotkey.trim().toUpperCase() : null,
          logo: editingTeam.logo || null,
        }),
      });
      if (res.ok) {
        notifySuccess(`Team "${editingTeam.name}" updated successfully!`);
        setEditingTeam(null);
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to update team' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`Are you sure you want to delete "${teamName}"? All sales assigned to this team will be affected.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/teams`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      if (res.ok) {
        notifySuccess(`Team "${teamName}" deleted.`);
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to delete team' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Add Single Player
  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!playerForm.name) return;
    setLoading(true);
    try {
      const targetCat = playerForm.categoryId || categories[0]?.id;
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...playerForm,
          photo: playerForm.photo || null,
          categoryId: targetCat,
        }),
      });
      if (res.ok) {
        notifySuccess(`Player "${playerForm.name}" added successfully!`);
        setPlayerForm({
          name: '',
          playerNumber: '',
          categoryId: targetCat || '',
          role: playerForm.role || 'Player',
          battingStyle: playerForm.battingStyle || 'Right Hand',
          age: 25,
          photo: '',
        });
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to add player' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Update Player
  const handleSavePlayerEdit = async (e) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: editingPlayer.id,
          name: editingPlayer.name,
          playerNumber: editingPlayer.playerNumber,
          categoryId: editingPlayer.categoryId,
          role: editingPlayer.role,
          battingStyle: editingPlayer.battingStyle,
          age: editingPlayer.age,
          photo: editingPlayer.photo || null,
        }),
      });
      if (res.ok) {
        notifySuccess(`Player "${editingPlayer.name}" updated successfully!`);
        setEditingPlayer(null);
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to update player' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Delete Player
  const handleDeletePlayer = async (playerId, playerName) => {
    if (!confirm(`Are you sure you want to delete player "${playerName}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      if (res.ok) {
        notifySuccess(`Player "${playerName}" deleted.`);
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to delete player' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Bulk Import
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setLoading(true);

    const targetCat = bulkCategory || categories[0]?.id;
    if (!targetCat) {
      setMessage({ type: 'error', text: 'Please create or select a category first.' });
      setLoading(false);
      return;
    }

    try {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      const startingNumber = (players.length > 0 ? Math.max(...players.map(p => p.playerNumber)) : 0) + 1;

      const playerObjects = lines.map((line, idx) => {
        const parts = line.split(',').map(p => p.trim());
        const name = parts[0];
        const num = parts[1] && !isNaN(parts[1]) ? parseInt(parts[1]) : startingNumber + idx;
        const role = parts[2] || 'Player';
        const style = parts[3] || 'Right Hand';
        const age = parts[4] && !isNaN(parts[4]) ? parseInt(parts[4]) : 25;

        return {
          name,
          playerNumber: num,
          categoryId: targetCat,
          role,
          battingStyle: style,
          age,
        };
      });

      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerObjects),
      });

      if (res.ok) {
        const d = await res.json();
        notifySuccess(`Successfully imported ${d.count || playerObjects.length} players!`);
        setBulkText('');
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Failed to import players' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Filtered players for review/edit list
  const filteredPlayersList = useMemo(() => {
    if (!playerSearchQuery.trim()) return players;
    const q = playerSearchQuery.toLowerCase().trim();
    return players.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.playerNumber?.toString() === q ||
      p.role?.toLowerCase().includes(q)
    );
  }, [players, playerSearchQuery]);

  const canLaunch = categories.length > 0 && teams.length > 0;

  return (
    <div className="setup-panel-container" style={{
      position: 'relative',
      zIndex: 10,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px',
      maxWidth: 1000,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--accent-gold)', margin: 0 }}>
            {tournament.name} — SETUP & ROSTER
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: 4 }}>
            Add, update, and manage your franchise teams, custom roles, and player roster for any sport.
          </p>
        </div>

        {canLaunch && (
          <button
            onClick={onComplete}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent-red)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-glow-red)',
            }}
          >
            ← BACK TO AUCTION
          </button>
        )}
      </div>

      {/* Progress Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        width: '100%',
        marginBottom: 24,
      }}>
        <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CATEGORIES</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: categories.length ? 'var(--text-green)' : 'var(--text-red)' }}>
            {categories.length}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TEAMS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: teams.length ? 'var(--text-green)' : 'var(--text-red)' }}>
            {teams.length}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PLAYERS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: players.length ? 'var(--text-green)' : 'var(--text-red)' }}>
            {players.length}
          </div>
        </div>
      </div>

      {message && (
        <div style={{
          width: '100%',
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, width: '100%' }}>
        <button
          type="button"
          onClick={() => setActiveTab('quick')}
          className={`setup-tab-btn ${activeTab === 'quick' ? 'active-gold' : ''}`}
        >
          🚀 1-CLICK DEMO DATA
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          className={`setup-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
        >
          TEAMS ({teams.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('players')}
          className={`setup-tab-btn ${activeTab === 'players' ? 'active' : ''}`}
        >
          PLAYERS & ROLES ({players.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`setup-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
        >
          CATEGORIES ({categories.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bidRules')}
          className={`setup-tab-btn ${activeTab === 'bidRules' ? 'active' : ''}`}
        >
          BID RULES ({rulesIncType === 'slabs' ? 'SLABS' : `+₹${rulesFlatInc}`})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sponsors')}
          className={`setup-tab-btn ${activeTab === 'sponsors' ? 'active' : ''}`}
        >
          🏷️ SPONSORS ({sponsors.length})
        </button>
      </div>

      {/* Tab Content Box */}
      <div style={{
        width: '100%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        marginBottom: 24,
      }}>
        {/* 1. Quick Demo */}
        {activeTab === 'quick' && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: 12 }}>
              Load Ready-to-Auction Demo Data
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, maxWidth: 600, margin: '0 auto 24px' }}>
              Populate this tournament with 4 franchise teams (Mumbai, Bangalore, Chennai, Kolkata), 3 bidding tiers, and 16 star players with authentic statistics and roles.
            </p>
            <button
              onClick={handleSeedDemoData}
              disabled={loading}
              className="btn-populate-demo"
            >
              {loading ? 'Populating Tournament...' : '⚡ POPULATE DEMO DATA NOW'}
            </button>
          </div>
        )}

        {/* 2. Teams Tab (Add & Edit & Delete) */}
        {activeTab === 'teams' && (
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', marginBottom: 16 }}>
              {editingTeam ? 'Edit Franchise Team' : 'Add Franchise Team'}
            </h3>

            {/* Team Add / Edit Form */}
            <form onSubmit={editingTeam ? handleSaveTeamEdit : handleAddTeam} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 60px', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>TEAM NAME</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai Blasters, Real Madrid, Warriors"
                    value={editingTeam ? editingTeam.name : teamForm.name}
                    onChange={e => editingTeam ? setEditingTeam({ ...editingTeam, name: e.target.value }) : setTeamForm({ ...teamForm, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>CODE</label>
                  <input
                    type="text"
                    placeholder="e.g. MB, RM"
                    value={editingTeam ? editingTeam.shortName : teamForm.shortName}
                    onChange={e => editingTeam ? setEditingTeam({ ...editingTeam, shortName: e.target.value }) : setTeamForm({ ...teamForm, shortName: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PURSE (₹)</label>
                  <input
                    type="number"
                    placeholder="Purse"
                    value={editingTeam ? editingTeam.purse : teamForm.purse}
                    onChange={e => editingTeam ? setEditingTeam({ ...editingTeam, purse: parseInt(e.target.value) || 0 }) : setTeamForm({ ...teamForm, purse: parseInt(e.target.value) || 0 })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
                    ⚡ HOTKEY (BID KEY)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="e.g. 1, 2, M"
                    value={editingTeam ? (editingTeam.hotkey || '') : teamForm.hotkey}
                    onChange={e => editingTeam ? setEditingTeam({ ...editingTeam, hotkey: e.target.value.toUpperCase() }) : setTeamForm({ ...teamForm, hotkey: e.target.value.toUpperCase() })}
                    title="Press this single key during auction to instantly place a bid for this team"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(245, 184, 0, 0.08)',
                      border: '1px solid var(--border-gold)',
                      borderRadius: 6,
                      color: 'var(--accent-gold)',
                      fontWeight: 800,
                      textAlign: 'center',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>COLOR</label>
                  <input
                    type="color"
                    value={editingTeam ? editingTeam.color : teamForm.color}
                    onChange={e => editingTeam ? setEditingTeam({ ...editingTeam, color: e.target.value }) : setTeamForm({ ...teamForm, color: e.target.value })}
                    style={{
                      height: 42,
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              {/* Team Logo / Avatar URL and Upload */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.06)',
                  border: '2px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {(editingTeam ? editingTeam.logo : teamForm.logo) ? (
                    <img
                      src={editingTeam ? editingTeam.logo : teamForm.logo}
                      alt="Team Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    TEAM LOGO / AVATAR (URL or Upload Image):
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      placeholder="Paste Image URL (https://...) or upload below"
                      value={editingTeam ? (editingTeam.logo || '') : teamForm.logo}
                      onChange={e => editingTeam ? setEditingTeam({ ...editingTeam, logo: e.target.value }) : setTeamForm({ ...teamForm, logo: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: '0.85rem',
                      }}
                    />
                    <label style={{
                      padding: '8px 16px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap',
                    }}>
                      📁 Upload
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => handleTeamLogoUpload(e, !!editingTeam)}
                      />
                    </label>
                    {(editingTeam ? editingTeam.logo : teamForm.logo) && (
                      <button
                        type="button"
                        onClick={() => editingTeam ? setEditingTeam({ ...editingTeam, logo: '' }) : setTeamForm({ ...teamForm, logo: '' })}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(220,53,69,0.2)',
                          border: '1px solid rgba(220,53,69,0.4)',
                          borderRadius: 6,
                          color: 'var(--text-red)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 24px',
                    background: editingTeam ? 'var(--accent-gold)' : 'var(--accent-green)',
                    color: editingTeam ? '#000' : '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {editingTeam ? 'SAVE TEAM CHANGES ✔' : '+ ADD TEAM'}
                </button>

                {editingTeam && (
                  <button
                    type="button"
                    onClick={() => setEditingTeam(null)}
                    style={{
                      padding: '10px 20px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    CANCEL
                  </button>
                )}
              </div>
            </form>

            {/* Existing Teams List */}
            {teams.length > 0 && (
              <div style={{ marginTop: 28, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Current Franchise Teams ({teams.length}):
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {teams.map(t => (
                    <div
                      key={t.id}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '10px 16px',
                        borderRadius: 8,
                        borderLeft: `5px solid ${t.color || '#fff'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {t.logo ? (
                          <img
                            src={t.logo}
                            alt={t.name}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 6,
                              objectFit: 'contain',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 6,
                            background: t.color || 'var(--accent-purple)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                          }}>
                            {t.shortName}
                          </div>
                        )}
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '1rem', marginRight: 10 }}>{t.name}</span>
                          <span style={{
                            background: 'rgba(255,255,255,0.1)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'var(--accent-cyan)',
                            marginRight: 10,
                          }}>
                            {t.shortName}
                          </span>
                          {t.hotkey && (
                            <span style={{
                              background: 'rgba(245, 184, 0, 0.15)',
                              border: '1px solid var(--accent-gold)',
                              color: 'var(--accent-gold)',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              marginRight: 12,
                              letterSpacing: '0.5px',
                            }}>
                              ⚡ BID KEY: [{t.hotkey.toUpperCase()}]
                            </span>
                          )}
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Purse: <strong style={{ color: 'var(--accent-gold)' }}>₹{t.purse.toLocaleString()}</strong>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setEditingTeam(t)}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 4,
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeam(t.id, t.name)}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(220,53,69,0.15)',
                            border: '1px solid rgba(220,53,69,0.4)',
                            borderRadius: 4,
                            color: 'var(--text-red)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Players Tab (Custom Roles, Add, Edit & Delete) */}
        {activeTab === 'players' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', margin: 0 }}>
                {editingPlayer ? 'Edit Player' : 'Add Players & Roles'}
              </h3>
              {!editingPlayer && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPlayerMode('single')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: '1px solid var(--border-subtle)',
                      background: playerMode === 'single' ? 'var(--accent-gold)' : 'var(--bg-card)',
                      color: playerMode === 'single' ? '#000' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Single Player
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerMode('bulk')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: '1px solid var(--border-subtle)',
                      background: playerMode === 'bulk' ? 'var(--accent-gold)' : 'var(--bg-card)',
                      color: playerMode === 'bulk' ? '#000' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Bulk / Excel Import
                  </button>
                </div>
              )}
            </div>

            {/* Sport Role Preset Quick-Selector */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              padding: '12px',
              borderRadius: 8,
              marginBottom: 18,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                SPORT / ROLE PRESETS:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {Object.keys(SPORT_ROLE_PRESETS).map(sport => (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => setSelectedSport(sport)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 14,
                      border: '1px solid var(--border-subtle)',
                      background: selectedSport === sport ? 'var(--accent-blue)' : 'var(--bg-card)',
                      color: selectedSport === sport ? '#fff' : 'var(--text-primary)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      fontWeight: selectedSport === sport ? 700 : 500,
                    }}
                  >
                    {sport}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Click to apply role:</span>
                {SPORT_ROLE_PRESETS[selectedSport]?.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      if (editingPlayer) {
                        setEditingPlayer({ ...editingPlayer, role: r });
                      } else {
                        setPlayerForm({ ...playerForm, role: r });
                      }
                    }}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'rgba(245, 184, 0, 0.15)',
                      color: 'var(--accent-gold)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Single Add / Edit Form */}
            {(playerMode === 'single' || editingPlayer) ? (
              <form onSubmit={editingPlayer ? handleSavePlayerEdit : handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PLAYER NAME *</label>
                    <input
                      type="text"
                      placeholder="Player Name"
                      value={editingPlayer ? editingPlayer.name : playerForm.name}
                      onChange={e => editingPlayer ? setEditingPlayer({ ...editingPlayer, name: e.target.value }) : setPlayerForm({ ...playerForm, name: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>JERSEY #</label>
                    <input
                      type="number"
                      placeholder="Number"
                      value={editingPlayer ? editingPlayer.playerNumber : playerForm.playerNumber}
                      onChange={e => editingPlayer ? setEditingPlayer({ ...editingPlayer, playerNumber: e.target.value }) : setPlayerForm({ ...playerForm, playerNumber: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>CATEGORY</label>
                    <select
                      value={editingPlayer ? editingPlayer.categoryId : (playerForm.categoryId || categories[0]?.id || '')}
                      onChange={e => editingPlayer ? setEditingPlayer({ ...editingPlayer, categoryId: e.target.value }) : setPlayerForm({ ...playerForm, categoryId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                      }}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id} style={{ background: '#12112a' }}>
                          {c.name} (Base ₹{c.basePrice.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      PLAYER ROLE (Type ANY role or click presets above)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Batsman, Striker, Raider, Defender..."
                      value={editingPlayer ? (editingPlayer.role || '') : playerForm.role}
                      onChange={e => editingPlayer ? setEditingPlayer({ ...editingPlayer, role: e.target.value }) : setPlayerForm({ ...playerForm, role: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>STYLE / HAND / POSITION</label>
                    <input
                      type="text"
                      placeholder="e.g. Right Hand, Left Foot, Center"
                      value={editingPlayer ? (editingPlayer.battingStyle || '') : playerForm.battingStyle}
                      onChange={e => editingPlayer ? setEditingPlayer({ ...editingPlayer, battingStyle: e.target.value }) : setPlayerForm({ ...playerForm, battingStyle: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>AGE</label>
                    <input
                      type="number"
                      placeholder="Age"
                      value={editingPlayer ? (editingPlayer.age || '') : playerForm.age}
                      onChange={e => editingPlayer ? setEditingPlayer({ ...editingPlayer, age: parseInt(e.target.value) || '' }) : setPlayerForm({ ...playerForm, age: parseInt(e.target.value) || '' })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                      }}
                    />
                  </div>
                </div>

                {/* Player Avatar / Photo Upload */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}>
                  <div style={{
                    width: 50,
                    height: 60,
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.06)',
                    border: '2px solid var(--border-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {(editingPlayer ? editingPlayer.photo : playerForm.photo) ? (
                      <img
                        src={editingPlayer ? editingPlayer.photo : playerForm.photo}
                        alt="Player Avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '1.5rem', opacity: 0.4 }}>👤</span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      PLAYER AVATAR / PHOTO (URL or Upload Image):
                    </label>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                      <input
                        type="text"
                        placeholder="Paste image URL (https://...) or upload below"
                        value={editingPlayer ? (editingPlayer.photo || '') : (playerForm.photo || '')}
                        onChange={e => editingPlayer ? setEditingPlayer({ ...editingPlayer, photo: e.target.value }) : setPlayerForm({ ...playerForm, photo: e.target.value })}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 6,
                          color: '#fff',
                          fontSize: '0.85rem',
                        }}
                      />
                      <label style={{
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                      }}>
                        📁 Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => handlePlayerPhotoUpload(e, !!editingPlayer)}
                        />
                      </label>
                      {(editingPlayer ? editingPlayer.photo : playerForm.photo) && (
                        <button
                          type="button"
                          onClick={() => editingPlayer ? setEditingPlayer({ ...editingPlayer, photo: '' }) : setPlayerForm({ ...playerForm, photo: '' })}
                          style={{
                            padding: '8px 12px',
                            background: 'rgba(220,53,69,0.2)',
                            border: '1px solid rgba(220,53,69,0.4)',
                            borderRadius: 6,
                            color: 'var(--text-red)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          ✕ Clear
                        </button>
                      )}
                    </div>
                    {/* Quick Avatar Presets */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Quick preset:</span>
                      {[
                        { l: 'Cricket 1', url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&q=80' },
                        { l: 'Athlete 2', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80' },
                        { l: 'Pro 3', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80' },
                        { l: 'Star 4', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80' },
                      ].map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => editingPlayer ? setEditingPlayer({ ...editingPlayer, photo: p.url }) : setPlayerForm({ ...playerForm, photo: p.url })}
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.68rem',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'transparent',
                            color: 'var(--accent-cyan)',
                            cursor: 'pointer',
                          }}
                        >
                          {p.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    disabled={loading || categories.length === 0}
                    style={{
                      padding: '10px 24px',
                      background: editingPlayer ? 'var(--accent-gold)' : 'var(--accent-green)',
                      color: editingPlayer ? '#000' : '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {editingPlayer ? 'SAVE PLAYER CHANGES ✔' : '+ ADD PLAYER'}
                  </button>

                  {editingPlayer && (
                    <button
                      type="button"
                      onClick={() => setEditingPlayer(null)}
                      style={{
                        padding: '10px 20px',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      CANCEL
                    </button>
                  )}
                </div>
              </form>
            ) : (
              /* Bulk / CSV Import Form */
              <form onSubmit={handleBulkImport} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    SELECT CATEGORY FOR IMPORTED PLAYERS:
                  </label>
                  <select
                    value={bulkCategory || categories[0]?.id || ''}
                    onChange={e => setBulkCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id} style={{ background: '#12112a' }}>
                        {c.name} (Base ₹{c.basePrice.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    PASTE PLAYERS (CSV or one name per line: Name, Number, Role, Style, Age):
                  </label>
                  <textarea
                    rows={7}
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={`Cristiano Ronaldo, 7, Forward, Right Foot, 39
Lionel Messi, 10, Forward, Left Foot, 37
Luka Modric, 10, Midfielder, Right Foot, 38
Kylian Mbappe, 9, Forward, Right Foot, 25`}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || categories.length === 0}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '10px 28px',
                    background: 'var(--accent-gold)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {loading ? 'IMPORTING PLAYERS...' : '⚡ IMPORT PLAYERS LIST'}
                </button>
              </form>
            )}

            {/* List & Search Existing Players for Edit / Delete */}
            {players.length > 0 && (
              <div style={{ marginTop: 28, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Manage Registered Players ({players.length}):
                  </h4>
                  <input
                    type="text"
                    placeholder="Search player name or #..."
                    value={playerSearchQuery}
                    onChange={e => setPlayerSearchQuery(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 20,
                      color: '#fff',
                      fontSize: '0.8rem',
                      width: 220,
                    }}
                  />
                </div>

                <div style={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  paddingRight: 4,
                }}>
                  {filteredPlayersList.map(p => (
                    <div
                      key={p.id}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '8px 14px',
                        borderRadius: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.photo ? (
                          <img
                            src={p.photo}
                            alt={p.name}
                            style={{
                              width: 28,
                              height: 32,
                              borderRadius: 4,
                              objectFit: 'cover',
                              border: '1px solid var(--border-gold)',
                            }}
                          />
                        ) : (
                          <span style={{
                            background: 'var(--accent-green)',
                            color: '#fff',
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}>
                            #{p.playerNumber}
                          </span>
                        )}
                        <span style={{ fontWeight: 700, color: '#fff' }}>{p.name}</span>
                        <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>{p.role || 'Player'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          ({p.category?.name || 'General'})
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlayer(p);
                            window.scrollTo({ top: 300, behavior: 'smooth' });
                          }}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 4,
                            color: '#fff',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlayer(p.id, p.name)}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(220,53,69,0.15)',
                            border: '1px solid rgba(220,53,69,0.4)',
                            borderRadius: 4,
                            color: 'var(--text-red)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Categories Tab */}
        {activeTab === 'categories' && (
          <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)' }}>Create Bidding Category / Tier</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Category Name (e.g. List A, List B, Gold)"
                value={catForm.name}
                onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                required
                style={{
                  flex: 2,
                  minWidth: 180,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: '#fff',
                }}
              />
              <input
                type="number"
                placeholder="Base Price (₹)"
                value={catForm.basePrice}
                onChange={e => setCatForm({ ...catForm, basePrice: parseInt(e.target.value) || 0 })}
                required
                min="0"
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: '#fff',
                }}
              />
              <input
                type="number"
                placeholder="Max/team (optional, e.g. 2)"
                value={catForm.maxPerTeam}
                onChange={e => setCatForm({ ...catForm, maxPerTeam: e.target.value })}
                min="1"
                title="Maximum number of players any team can buy from this category (leave blank for unlimited)"
                style={{
                  flex: 1,
                  minWidth: 160,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: '#fff',
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent-green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + ADD
              </button>
            </div>
            {categories.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: 12 }}>
                  Existing Categories & Minimum Points ({categories.length}):
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {categories.map(c => {
                    const catPlayerCount = players.filter(p => p.categoryId === c.id).length;
                    return (
                      <div
                        key={c.id}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{c.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', marginTop: 2 }}>
                            Min Points: ₹{c.basePrice.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.78rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              background: c.maxPerTeam ? 'rgba(245, 184, 0, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              border: `1px solid ${c.maxPerTeam ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                              color: c.maxPerTeam ? 'var(--accent-gold)' : 'var(--text-muted)',
                              borderRadius: 4,
                              padding: '1px 6px',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                            }}>
                              {c.maxPerTeam ? `Max per Team: ${c.maxPerTeam}` : 'Quota: Unlimited'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            {catPlayerCount} player{catPlayerCount === 1 ? '' : 's'} assigned
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setEditingCategory({ ...c })}
                            title="Edit Category Name & Minimum Points"
                            style={{
                              background: 'rgba(245, 184, 0, 0.15)',
                              border: '1px solid var(--accent-gold)',
                              color: 'var(--accent-gold)',
                              borderRadius: 4,
                              padding: '6px 10px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            disabled={catPlayerCount > 0}
                            title={catPlayerCount > 0 ? "Cannot delete: players are assigned to this category" : "Delete category"}
                            style={{
                              background: catPlayerCount > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(220,53,69,0.15)',
                              border: catPlayerCount > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--accent-red)',
                              color: catPlayerCount > 0 ? 'var(--text-muted)' : 'var(--text-red)',
                              borderRadius: 4,
                              padding: '6px 10px',
                              fontSize: '0.8rem',
                              cursor: catPlayerCount > 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Edit Category Modal */}
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
                      ✏️ EDIT CATEGORY MINIMUM POINTS
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        MAX PLAYERS PER TEAM (OPTIONAL)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 2 (leave blank for unlimited)"
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
                      <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                        Controls how many players any team can buy from this category (e.g. max 2 from List A). Leave blank or 0 for unlimited.
                      </small>
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
                        type="button"
                        onClick={handleUpdateCategory}
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
                  </div>
                </div>
              </div>
            )}
          </form>
        )}

        {/* 5. Bid Rules Tab */}
        {activeTab === 'bidRules' && (
          <form onSubmit={handleSaveBidRules} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', margin: 0 }}>
                📈 Bid Increment Rules (Flat vs Tiered Slabs)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Set whether bids increase by a fixed amount or vary dynamically based on bid price tiers.
              </p>
            </div>

            {/* Rule Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div
                onClick={() => setRulesIncType('flat')}
                style={{
                  padding: '14px',
                  borderRadius: 8,
                  border: rulesIncType === 'flat' ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                  background: rulesIncType === 'flat' ? 'rgba(245, 184, 0, 0.15)' : 'var(--bg-card)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 800, color: rulesIncType === 'flat' ? 'var(--accent-gold)' : 'var(--text-primary)', marginBottom: 4 }}>
                  Option 1: Fixed Flat Increment
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Every bid increases by a fixed amount (e.g. +100).
                </div>
              </div>

              <div
                onClick={() => setRulesIncType('slabs')}
                style={{
                  padding: '14px',
                  borderRadius: 8,
                  border: rulesIncType === 'slabs' ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                  background: rulesIncType === 'slabs' ? 'rgba(245, 184, 0, 0.15)' : 'var(--bg-card)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 800, color: rulesIncType === 'slabs' ? 'var(--accent-gold)' : 'var(--text-primary)', marginBottom: 4 }}>
                  Option 2: Tiered / Slab-Based Increments
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Dynamic increment: e.g. +10 till 1,000, +20 till 2,000, +30 above.
                </div>
              </div>
            </div>

            {/* Flat Option */}
            {rulesIncType === 'flat' && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 8 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  FLAT INCREMENT AMOUNT (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={rulesFlatInc}
                  onChange={e => setRulesFlatInc(parseInt(e.target.value) || 0)}
                  style={{
                    width: 160,
                    padding: '10px 14px',
                    background: 'rgba(245,184,0,0.12)',
                    border: '1px solid var(--accent-gold)',
                    borderRadius: 6,
                    color: 'var(--accent-gold)',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                />
              </div>
            )}

            {/* Slabs Option */}
            {rulesIncType === 'slabs' && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Presets */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRESETS:</span>
                  <button
                    type="button"
                    onClick={() => setRulesSlabs([
                      { upTo: 1000, increment: 10 },
                      { upTo: 2000, increment: 20 },
                      { upTo: null, increment: 30 },
                    ])}
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
                    onClick={() => setRulesSlabs([
                      { upTo: 100000, increment: 5000 },
                      { upTo: 200000, increment: 10000 },
                      { upTo: 500000, increment: 20000 },
                      { upTo: null, increment: 25000 },
                    ])}
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
                </div>

                {/* Slabs Rows */}
                {rulesSlabs.map((slab, idx) => {
                  const isLast = idx === rulesSlabs.length - 1;
                  const prevLimit = idx > 0 ? (rulesSlabs[idx - 1].upTo || 0) : 0;
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
                          {isLast && slab.upTo === null ? `ABOVE ₹${prevLimit.toLocaleString()} (TILL END)` : `UP TO BID AMOUNT (₹)`}
                        </span>
                        {isLast && slab.upTo === null ? (
                          <div style={{ color: 'var(--accent-gold)', fontWeight: 800, fontSize: '0.9rem', padding: '6px 0' }}>
                            ₹{prevLimit.toLocaleString()} &amp; Beyond
                          </div>
                        ) : (
                          <input
                            type="number"
                            value={slab.upTo ?? ''}
                            onChange={e => {
                              const updated = [...rulesSlabs];
                              updated[idx] = { ...updated[idx], upTo: e.target.value === '' ? null : parseInt(e.target.value) || 0 };
                              setRulesSlabs(updated);
                            }}
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
                          value={slab.increment}
                          onChange={e => {
                            const updated = [...rulesSlabs];
                            updated[idx] = { ...updated[idx], increment: parseInt(e.target.value) || 0 };
                            setRulesSlabs(updated);
                          }}
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
                        onClick={() => setRulesSlabs(rulesSlabs.filter((_, i) => i !== idx))}
                        disabled={rulesSlabs.length <= 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: rulesSlabs.length <= 1 ? 'rgba(255,255,255,0.2)' : 'var(--text-red)',
                          fontSize: '1.1rem',
                          cursor: rulesSlabs.length <= 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    const last = rulesSlabs[rulesSlabs.length - 1];
                    const prevUpTo = last && last.upTo ? Number(last.upTo) : 2000;
                    const prevInc = last ? Number(last.increment) : 20;
                    const newSlabs = [...rulesSlabs];
                    if (newSlabs.length > 0 && newSlabs[newSlabs.length - 1].upTo === null) {
                      newSlabs.splice(newSlabs.length - 1, 0, { upTo: prevUpTo + 1000, increment: prevInc + 10 });
                    } else {
                      newSlabs.push({ upTo: prevUpTo + 1000, increment: prevInc + 10 });
                    }
                    setRulesSlabs(newSlabs);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px dashed var(--accent-gold)',
                    background: 'rgba(245,184,0,0.08)',
                    color: 'var(--accent-gold)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  + Add Another Slab Level
                </button>
              </div>
            )}

            {/* Live Interactive Preview */}
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(245,184,0,0.3)',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>TEST BID (₹):</span>
                <input
                  type="number"
                  value={rulesTestBid}
                  onChange={e => setRulesTestBid(parseInt(e.target.value) || 0)}
                  style={{
                    width: 90,
                    padding: '4px 8px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    color: '#fff',
                    textAlign: 'center',
                  }}
                />
              </div>
              <div>
                Next Step:{' '}
                <strong style={{ color: 'var(--text-green)', fontSize: '1.05rem' }}>
                  +₹{getBidIncrement(rulesTestBid, { incrementType: rulesIncType, baseIncrement: rulesFlatInc, incrementSlabs: rulesSlabs }).toLocaleString()}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                alignSelf: 'flex-start',
                padding: '12px 28px',
                background: 'var(--accent-gold)',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-glow-gold)',
              }}
            >
              Save Bid Increment Rules ✔
            </button>
          </form>
        )}

        {/* 6. Sponsors Tab */}
        {activeTab === 'sponsors' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-gold)', margin: 0 }}>
                Tournament Sponsor Banners & 10s Rotation
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {sponsors.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoRebalanceSponsors}
                    disabled={loading}
                    style={{
                      padding: '4px 12px',
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
                  background: sponsorValidation.isValid ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: sponsorValidation.isValid ? '#4ade80' : '#ef4444',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontWeight: 800,
                }}>
                  TOTAL WEIGHT: {sponsorValidation.totalWeight}% {sponsorValidation.isValid ? '✓' : `(${sponsorValidation.difference > 0 ? `+${sponsorValidation.difference}% needed` : `${sponsorValidation.difference}% over`})`}
                </span>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              Sponsor banners will be displayed across the header, live public screen, stage projectors, and OBS broadcast overlays. Rotates every 10 seconds according to weightage %.
            </p>

            {/* Current Active Sponsors */}
            {sponsors.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  ACTIVE SPONSOR BANNERS ({sponsors.length}):
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                  {sponsors.map(s => (
                    <div
                      key={s.id}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-gold)',
                        borderRadius: 8,
                        padding: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="sponsor-logo-box" style={{ width: 80, height: 46, padding: '3px 6px' }}>
                          <img
                            src={s.logo}
                            alt={s.name}
                            style={{ maxHeight: 40, maxWidth: 74, objectFit: 'contain' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)' }}>
                            Airtime: ~{s.weight}% ({s.weight}s / 100s)
                          </div>
                          {s.url && (
                            <div style={{ marginTop: 2 }}>
                              <a
                                href={formatSponsorUrl(s.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}
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
                              width: 42,
                              padding: '2px 4px',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 4,
                              color: 'var(--accent-gold)',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 800 }}>%</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSponsor(s.id)}
                          disabled={loading}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 4,
                            border: '1px solid rgba(220, 53, 69, 0.4)',
                            background: 'rgba(220, 53, 69, 0.15)',
                            color: 'var(--text-red)',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Sponsor Form */}
            <form onSubmit={handleAddSponsor} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 700 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    SPONSOR NAME / TITLE *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tata IPL, Dream11, Red Bull"
                    value={sponsorForm.name}
                    onChange={e => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    BANNER IMAGE (URL or Upload Image File) *
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="https://... or upload"
                      value={sponsorForm.logo}
                      onChange={e => setSponsorForm({ ...sponsorForm, logo: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: '#fff',
                      }}
                    />
                    <label style={{
                      padding: '10px 16px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '0.85rem',
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
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    🔗 REDIRECT HYPERLINK / WEBSITE URL (OPTIONAL - OPENS IN NEW TAB ON CLICK)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://www.sponsorwebsite.com or www.brand.com"
                    value={sponsorForm.url || ''}
                    onChange={e => setSponsorForm({ ...sponsorForm, url: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: 'var(--accent-cyan)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    WEIGHT % (OUT OF 100)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={sponsorForm.weight}
                      onChange={e => setSponsorForm({ ...sponsorForm, weight: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        color: 'var(--accent-gold)',
                        fontWeight: 800,
                      }}
                    />
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 800 }}>%</span>
                  </div>
                </div>
              </div>

              {sponsorForm.logo && (
                <div style={{
                  padding: 12,
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px dashed var(--border-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}>
                  <img
                    src={sponsorForm.logo}
                    alt="Preview"
                    style={{ maxHeight: 50, maxWidth: 140, objectFit: 'contain' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                      Image Ready for Live Banner (Weight: {sponsorForm.weight}%)
                    </span>
                    {sponsorForm.url && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)' }}>
                        Redirects to: {formatSponsorUrl(sponsorForm.url)} ↗
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Sample Presets */}
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  QUICK PRESETS (Click to fill):
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { name: 'Tata IPL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Indian_Premier_League_Official_Logo.svg/300px-Indian_Premier_League_Official_Logo.svg.png', url: 'https://www.iplt20.com' },
                    { name: 'Dream11', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Dream11_Logo.svg/300px-Dream11_Logo.svg.png', url: 'https://www.dream11.com' },
                    { name: 'Red Bull', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/RedBullEnergyDrink.svg/300px-RedBullEnergyDrink.svg.png', url: 'https://www.redbull.com' },
                    { name: 'Nike', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/300px-Logo_NIKE.svg.png', url: 'https://www.nike.com' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSponsorForm({ name: preset.name, logo: preset.logo, url: preset.url, weight: 33 })}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'transparent',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  alignSelf: 'flex-start',
                  padding: '12px 30px',
                  background: 'var(--accent-gold)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-glow-gold)',
                  marginTop: 6,
                }}
              >
                + ADD SPONSOR BANNER
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Launch Arena Button */}
      {canLaunch && (
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={onComplete}
            style={{
              padding: '14px 44px',
              fontSize: '1.15rem',
              fontWeight: 800,
              background: 'var(--accent-red)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-glow-red)',
              transition: 'all 0.3s',
            }}
          >
            ENTER AUCTION ARENA ➔
          </button>
        </div>
      )}
    </div>
  );
}
