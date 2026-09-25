/**
 * Utility functions for calculating dynamic bid increments
 * Supports:
 *  - Flat increments (e.g. +100 every bid)
 *  - Slab-based tiered increments (e.g. 0-1000: +10, 1000-2000: +20, 2000+: +30)
 */

export function getDefaultSlabs() {
  return [
    { upTo: 1000, increment: 10 },
    { upTo: 2000, increment: 20 },
    { upTo: null, increment: 30 },
  ];
}

export function parseSlabs(slabsData) {
  if (!slabsData) return [];
  if (Array.isArray(slabsData)) return slabsData;
  if (typeof slabsData === 'string') {
    try {
      const parsed = JSON.parse(slabsData);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getBidIncrement(currentBid = 0, tournament = null) {
  if (!tournament) return 100;

  const current = Math.max(0, Number(currentBid) || 0);

  if (tournament.incrementType === 'slabs') {
    const rawSlabs = parseSlabs(tournament.incrementSlabs);
    if (rawSlabs.length > 0) {
      // Sort slabs ascending by upTo limit
      const sorted = [...rawSlabs].sort((a, b) => {
        const limA = (a.upTo !== null && a.upTo !== undefined && a.upTo !== '') ? Number(a.upTo) : Infinity;
        const limB = (b.upTo !== null && b.upTo !== undefined && b.upTo !== '') ? Number(b.upTo) : Infinity;
        return limA - limB;
      });

      for (const slab of sorted) {
        const lim = (slab.upTo !== null && slab.upTo !== undefined && slab.upTo !== '') ? Number(slab.upTo) : Infinity;
        if (current < lim) {
          const inc = Number(slab.increment);
          return inc > 0 ? inc : 100;
        }
      }

      // If current bid is beyond all slabs, take the last slab's increment
      const last = sorted[sorted.length - 1];
      if (last && Number(last.increment) > 0) {
        return Number(last.increment);
      }
    }
  }

  // Flat base increment fallback
  return Math.max(1, Number(tournament.baseIncrement) || 100);
}

export function computeNextBid(currentBid = 0, tournament = null) {
  const current = Math.max(0, Number(currentBid) || 0);
  const inc = getBidIncrement(current, tournament);
  return current + inc;
}

/**
 * Resolves 100% unique shortcut keys for tournament teams.
 * Guarantees zero duplicate keys:
 * - Priority given to valid, unique custom hotkeys
 * - Any duplicate or unset hotkeys get the next unused key from [1..9, 0, Q, W, E, R, T, Y, U, I, O, P, A, S, D, F, G, H, J, K, L, Z, X, C, V, B, N, M]
 * Returns a map of: { [teamId]: "1", [teamId]: "2", ... }
 */
export function resolveUniqueTeamHotkeys(teams = []) {
  if (!teams || teams.length === 0) return {};

  const keyPool = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
    'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P',
    'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L',
    'Z', 'X', 'C', 'V', 'B', 'N', 'M'
  ];

  const assigned = {};
  const usedKeys = new Set();

  // Phase 1: Give first priority to valid, unique custom keys that don't conflict
  teams.forEach((t) => {
    if (t.hotkey && typeof t.hotkey === 'string') {
      const candidate = t.hotkey.trim().toUpperCase();
      if (candidate.length === 1 && !usedKeys.has(candidate)) {
        assigned[t.id] = candidate;
        usedKeys.add(candidate);
      }
    }
  });

  // Phase 2: For all remaining teams (or teams with duplicate/null hotkeys), assign next available unused key
  let poolIdx = 0;
  teams.forEach((t) => {
    if (!assigned[t.id]) {
      while (poolIdx < keyPool.length && usedKeys.has(keyPool[poolIdx])) {
        poolIdx++;
      }
      if (poolIdx < keyPool.length) {
        const nextKey = keyPool[poolIdx];
        assigned[t.id] = nextKey;
        usedKeys.add(nextKey);
        poolIdx++;
      }
    }
  });

  return assigned;
}

/**
 * Helper to count how many players a team currently owns from a specific category
 */
export function getTeamCategoryCount(team, categoryId, tournament) {
  if (!team || !categoryId) return 0;
  const sales = team.sales || [];
  return sales.filter((s) => {
    const p = tournament?.players?.find((pl) => pl.id === s.playerId) || s.player;
    return p?.categoryId === categoryId;
  }).length;
}

/**
 * Check if a team has reached or exceeded the maximum player quota for a category
 */
export function isTeamCategoryQuotaReached(team, categoryId, tournament) {
  if (!team || !categoryId || !tournament) return false;
  const category = tournament.categories?.find((c) => c.id === categoryId);
  if (!category || !category.maxPerTeam || category.maxPerTeam <= 0) return false;
  const count = getTeamCategoryCount(team, categoryId, tournament);
  return count >= category.maxPerTeam;
}

/**
 * Calculate team's category-based minimum reserve balance.
 * 
 * If hypotheticalCategoryId is provided, calculates the reserve balance
 * AFTER acquiring 1 player of that category (used for calculating maxBid on a specific player).
 */
export function calculateTeamReserve(team, tournament, hypotheticalCategoryId = null) {
  if (!tournament || !team) {
    return { categoryReserve: 0, extraReserve: 0, totalReserve: 0, categoryNeeds: [], totalCategoryNeeded: 0 };
  }

  const sales = team.sales || [];
  const currentTotalPlayers = sales.length + (hypotheticalCategoryId ? 1 : 0);

  const categories = tournament.categories || [];
  const minBasePrice = categories.length > 0 
    ? Math.min(...categories.map(c => Number(c.basePrice) || 0))
    : 100;

  let categoryReserve = 0;
  let totalCategoryNeeded = 0;
  const categoryNeeds = [];

  for (const cat of categories) {
    const minRequired = Number(cat.minPerTeam) || 0;
    let owned = sales.filter(s => {
      const p = tournament.players?.find(pl => pl.id === s.playerId) || s.player;
      return p?.categoryId === cat.id;
    }).length;

    if (hypotheticalCategoryId && hypotheticalCategoryId === cat.id) {
      owned += 1;
    }

    const needed = Math.max(0, minRequired - owned);
    const cost = needed * (Number(cat.basePrice) || 0);
    categoryReserve += cost;
    totalCategoryNeeded += needed;

    categoryNeeds.push({
      categoryId: cat.id,
      categoryName: cat.name,
      basePrice: Number(cat.basePrice) || 0,
      minRequired,
      owned,
      needed,
      cost,
    });
  }

  // Check overall tournament minPlayers requirement
  const minTournamentPlayers = Number(tournament.minPlayers) || 0;
  const remainingTotalSlots = Math.max(0, minTournamentPlayers - currentTotalPlayers);
  const extraSlots = Math.max(0, remainingTotalSlots - totalCategoryNeeded);
  const extraReserve = extraSlots * minBasePrice;

  const totalReserve = categoryReserve + extraReserve;

  return {
    categoryReserve,
    extraReserve,
    totalReserve,
    categoryNeeds,
    totalCategoryNeeded,
  };
}

/**
 * Calculate team financial stats including category minimum reserve and max allowed bid
 */
export function calculateTeamStats(team, allTeams, tournament, currentPlayerCategoryId = null) {
  if (!team) {
    return { balance: 0, playerCount: 0, totalSpent: 0, remainingSlots: 0, reservePoints: 0, maxBid: 0, categoryNeeds: [] };
  }
  const soldPlayers = team.sales || [];
  const totalSpent = soldPlayers.reduce((sum, s) => sum + (s.soldPrice || 0), 0);
  const balance = (Number(team.purse) || 0) - totalSpent;
  const playerCount = soldPlayers.length;
  const minPlayers = Number(tournament?.minPlayers) || 0;
  const remainingSlots = Math.max(0, minPlayers - playerCount);
  
  // Calculate current minimum reserve balance required for remaining category quotas and slots
  const currentReserve = calculateTeamReserve(team, tournament, null);
  const reservePoints = currentReserve.totalReserve;

  // Calculate reserve required AFTER acquiring current player on the block
  let reserveAfterWin = reservePoints;
  if (currentPlayerCategoryId) {
    reserveAfterWin = calculateTeamReserve(team, tournament, currentPlayerCategoryId).totalReserve;
  }

  const maxBid = Math.max(0, balance - reserveAfterWin);

  return {
    balance,
    playerCount,
    totalSpent,
    remainingSlots,
    reservePoints, // Minimum reserve balance of the team
    maxBid,
    categoryNeeds: currentReserve.categoryNeeds,
  };
}

/**
 * Generates an array of player slots for a team up to tournament.maxPlayers.
 * Organizes slots by category quotas and maps sold players to their respective category rows.
 * Shows winning bid price and category indicators for each slot.
 */
export function getTeamSlots(team, tournament) {
  const maxPlayers = Math.max(1, Number(tournament?.maxPlayers) || 15);
  const categories = tournament?.categories || [];
  const sales = team?.sales || [];

  // Build the expected category slots blueprint
  const slotsBlueprint = [];
  categories.forEach(cat => {
    const minReq = Number(cat.minPerTeam) || 0;
    for (let i = 0; i < minReq; i++) {
      if (slotsBlueprint.length < maxPlayers) {
        slotsBlueprint.push({
          categoryId: cat.id,
          categoryName: cat.name,
          basePrice: cat.basePrice,
          isMandatory: true,
        });
      }
    }
  });

  // Fill any remaining slots up to maxPlayers as Open / Flex slots
  while (slotsBlueprint.length < maxPlayers) {
    slotsBlueprint.push({
      categoryId: null,
      categoryName: 'Open Slot',
      basePrice: null,
      isMandatory: false,
    });
  }

  // Resolve sold players
  const soldPlayers = sales.map(s => {
    const pl = tournament?.players?.find(p => p.id === s.playerId) || s.player || {};
    const cat = categories.find(c => c.id === pl.categoryId) || pl.category;
    return {
      saleId: s.id,
      soldPrice: s.soldPrice,
      soldAt: s.createdAt,
      player: {
        ...pl,
        category: cat,
      },
    };
  });

  // Initialize slots
  const finalSlots = slotsBlueprint.map((bp, idx) => ({
    slotNumber: idx + 1,
    categoryId: bp.categoryId,
    categoryName: bp.categoryName,
    basePrice: bp.basePrice,
    isMandatory: bp.isMandatory,
    filled: false,
    player: null,
    soldPrice: null,
  }));

  const unassigned = [...soldPlayers];

  // Pass 1: Assign sold players to their designated category slots
  for (const slot of finalSlots) {
    if (slot.categoryId) {
      const matchIdx = unassigned.findIndex(item => item.player?.categoryId === slot.categoryId);
      if (matchIdx !== -1) {
        const item = unassigned.splice(matchIdx, 1)[0];
        slot.filled = true;
        slot.player = item.player;
        slot.soldPrice = item.soldPrice;
      }
    }
  }

  // Pass 2: Assign any remaining sold players to available unfilled slots
  for (const slot of finalSlots) {
    if (!slot.filled && unassigned.length > 0) {
      const item = unassigned.shift();
      slot.filled = true;
      slot.player = item.player;
      slot.soldPrice = item.soldPrice;
      if (!slot.categoryId && item.player?.category) {
        slot.categoryName = item.player.category.name;
      }
    }
  }

  return finalSlots;
}


