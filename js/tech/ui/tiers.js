// Tier range helper used when applying a tier filter
// Usage: import { getSelectedTierRange } from './ui/tiers.js'
export function getSelectedTierRange() {
  const rawStart = document.getElementById('start-tier-select')?.value;
  const rawEnd = document.getElementById('end-tier-select')?.value;
  let startTier = parseInt(rawStart, 10);
  let endTier = parseInt(rawEnd, 10);
  if (isNaN(startTier)) startTier = 0;
  if (isNaN(endTier)) endTier = 99;
  return { startTier, endTier };
}
