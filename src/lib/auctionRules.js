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
