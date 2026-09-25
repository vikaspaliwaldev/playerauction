import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'player-auction-secret';

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

import { calculateTeamStats, calculateTeamReserve } from './auctionRules';
export { calculateTeamStats, calculateTeamReserve };

/**
 * Format number with commas
 */
export function formatNumber(num) {
  return num?.toLocaleString('en-IN') || '0';
}

/**
 * Get random available player from pool
 */
export function getRandomPlayer(players) {
  const available = players.filter(p => p.status === 'available');
  if (available.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

/**
 * Get next sequential player from pool
 */
export function getSequentialPlayer(players, currentNumber) {
  const available = players
    .filter(p => p.status === 'available')
    .sort((a, b) => a.playerNumber - b.playerNumber);
  if (available.length === 0) return null;
  
  if (!currentNumber) return available[0];
  const next = available.find(p => p.playerNumber > currentNumber);
  return next || available[0];
}
