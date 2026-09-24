/**
 * Sponsor rotation and weightage utility
 * Synchronizes multi-sponsor banner rotation across all live displays
 */

export function rebalanceWeights(sponsors) {
  if (!sponsors || sponsors.length === 0) return [];
  const count = sponsors.length;
  const base = Math.floor(100 / count);
  const remainder = 100 - (base * count);

  return sponsors.map((s, idx) => ({
    ...s,
    weight: base + (idx === 0 ? remainder : 0),
  }));
}

export function validateWeights(sponsors) {
  if (!sponsors || sponsors.length === 0) return { totalWeight: 0, isValid: true };
  const totalWeight = sponsors.reduce((sum, s) => sum + (parseInt(s.weight) || 0), 0);
  return {
    totalWeight,
    isValid: totalWeight === 100,
    difference: 100 - totalWeight,
  };
}

export function computeSponsorSlots(sponsors, totalSlots = 10) {
  if (!sponsors || sponsors.length === 0) return [];
  if (sponsors.length === 1) return [sponsors[0]];

  const totalWeight = sponsors.reduce((sum, s) => sum + (parseInt(s.weight) || 10), 0);
  if (totalWeight <= 0) return sponsors;

  // Check if all weights are essentially equal
  const allEqual = sponsors.every(s => (s.weight || 0) === (sponsors[0].weight || 0));
  if (allEqual) {
    return sponsors;
  }

  // Calculate target slot counts based on percentage
  const counts = sponsors.map(s => Math.max(1, Math.round(((parseInt(s.weight) || 10) / totalWeight) * totalSlots)));

  // Normalize slot counts so the sum matches totalSlots
  let sum = counts.reduce((a, b) => a + b, 0);
  while (sum > totalSlots) {
    const maxIdx = counts.indexOf(Math.max(...counts));
    counts[maxIdx]--;
    sum--;
  }
  while (sum < totalSlots) {
    const minIdx = counts.indexOf(Math.min(...counts));
    counts[minIdx]++;
    sum++;
  }

  // Deficit Round Robin (Weighted Fair Interleaving)
  // Ensures sponsors alternate smoothly every 10 seconds instead of clustering
  const acc = new Array(sponsors.length).fill(0);
  const slots = [];
  for (let i = 0; i < totalSlots; i++) {
    for (let j = 0; j < sponsors.length; j++) {
      acc[j] += counts[j];
    }
    let bestIdx = 0;
    for (let j = 1; j < sponsors.length; j++) {
      if (acc[j] > acc[bestIdx]) {
        bestIdx = j;
      }
    }
    slots.push(sponsors[bestIdx]);
    acc[bestIdx] -= totalSlots;
  }

  return slots.length > 0 ? slots : sponsors;
}

export function getActiveSponsor(sponsors, intervalSeconds = 10) {
  if (!sponsors || sponsors.length === 0) return null;
  if (sponsors.length === 1) return sponsors[0];

  const slots = computeSponsorSlots(sponsors, 10);
  if (slots.length === 0) return sponsors[0];

  const msInterval = intervalSeconds * 1000;
  const currentSlotIndex = Math.floor(Date.now() / msInterval) % slots.length;
  return slots[currentSlotIndex] || sponsors[0];
}

export function formatSponsorUrl(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

