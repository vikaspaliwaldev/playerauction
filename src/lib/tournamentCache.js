// ── Shared in-memory tournament cache ─────────────────────────────────
// Used by the public API to avoid hitting the DB on every poll request.
// Admin write APIs call invalidate() so live viewers see changes instantly.

const CACHE_TTL_MS = 2000; // 2 seconds

/** @type {Map<string, { data: any, timestamp: number }>} */
const cache = new Map();

/**
 * Get cached data for a tournament if it's still fresh.
 * @param {string} tournamentId
 * @returns {{ data: any } | null}
 */
export function getCached(tournamentId) {
  const entry = cache.get(tournamentId);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return { data: entry.data };
  }
  return null;
}

/**
 * Store tournament data in the cache.
 * @param {string} tournamentId
 * @param {any} data
 */
export function setCache(tournamentId, data) {
  cache.set(tournamentId, { data, timestamp: Date.now() });

  // Prevent unbounded growth (max 50 tournaments)
  if (cache.size > 50) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * Invalidate the cache for a tournament (called after admin writes).
 * @param {string} tournamentId
 */
export function invalidateCache(tournamentId) {
  cache.delete(tournamentId);
}
