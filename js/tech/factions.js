/**
 * Faction/Empire Management Module (Phase 2 + Autocomplete)
 *
 * Handles empire autocomplete and faction state management.
 * Maps prescripted countries (empires) to factions for tech filtering.
 */

import { loadFactionData, loadEmpiresData, getFactionById, getEmpireById } from './data.js';
import { initFactionAutocomplete, setSelectedEmpire } from './ui/faction-autocomplete.js';
import { saveState } from './state.js';

let currentFaction = 'all';      // Faction ID for filtering (from graphical_culture)
let currentEmpire = null;        // Selected empire object

// Mapping from graphical_culture to faction ID
const graphicalCultureToFaction = {
  'federation': 'federation',
  'fed_01': 'federation',
  'fed_02': 'federation',
  'klingon': 'klingon',
  'kdf_01': 'klingon',
  'romulan': 'romulan',
  'rom_01': 'romulan',
  'cardassian': 'cardassian',
  'cardassian_01': 'cardassian',
  'dominion': 'dominion',
  'dom_01': 'dominion',
  'borg': 'borg',
  'borg_01': 'borg',
  'ferengi': 'ferengi',
  'ferengi_01': 'ferengi',
  'breen': 'breen',
  'breen_01': 'breen',
  'undine': 'undine',
  'undine_01': 'undine',
  'xindi': 'xindi',
  'xindi_01': 'xindi',
  'voth': 'voth',
  'voth_01': 'voth',
  'hirogen': 'hirogen',
  'hirogen_01': 'hirogen',
  'kazon': 'kazon',
  'kazon_01': 'kazon',
  'krenim': 'krenim',
  'krenim_01': 'krenim',
  'vidiian': 'vidiian',
  'vidiian_01': 'vidiian',
  'suliban': 'suliban',
  'suliban_01': 'suliban',
  'sona': 'sona',
  'sona_01': 'sona',
  'talshiar': 'romulan',
  'tholian': 'tholian',
  'tholian_01': 'tholian',
  'terran': 'terran',
  'terran_01': 'terran',
};

/**
 * Initialize faction selection with empire autocomplete
 */
export async function initFactionDropdown() {
  try {
    // Load both factions and empires
    const [factions, empires] = await Promise.all([
      loadFactionData(),
      loadEmpiresData()
    ]);

    console.log(`[Factions] Loaded ${factions.length} factions, ${empires.length} empires`);

    // Initialize autocomplete with empire list
    initFactionAutocomplete(empires, handleEmpireSelect);

    // Set default: no empire selected (all factions)
    currentFaction = 'all';
    currentEmpire = null;
    updateFactionInfo('all');

  } catch (error) {
    console.error('[Factions] Failed to load faction/empire data:', error);
  }
}

/**
 * Handle empire selection from autocomplete
 */
function handleEmpireSelect(empire) {
  console.log('[Factions] Selected empire:', empire);

  currentEmpire = empire;

  // Map graphical_culture to faction
  const gc = empire.graphical_culture || '';
  const factionId = graphicalCultureToFaction[gc] || gc || 'all';
  currentFaction = factionId;

  console.log(`[Factions] Mapped ${gc} -> faction: ${factionId}`);

  // Update info display
  updateFactionInfo(factionId, empire);

  // Save state
  saveState();

  // Trigger re-render with faction filter
  if (typeof window.updateVisualization === 'function') {
    const speciesSelect = document.getElementById('species-select');
    const selectedSpecies = speciesSelect ? speciesSelect.value : 'all';
    window.updateVisualization(selectedSpecies, null, false);
  }
}

/**
 * Register faction change event handlers (for programmatic changes)
 */
export function registerFactionEvents() {
  // No dropdown events needed - autocomplete handles its own events
  // This function kept for API compatibility
}

/**
 * Update faction info display
 */
function updateFactionInfo(factionId, empire = null) {
  const factionTechCount = document.getElementById('faction-tech-count');
  if (!factionTechCount) return;

  if (factionId === 'all' || !factionId) {
    factionTechCount.textContent = 'Showing all factions';
    return;
  }

  // Show empire info if available
  if (empire) {
    const shipsInfo = empire.has_unique_ships ? ' (unique ships)' : '';
    factionTechCount.textContent = `${empire.name}${shipsInfo}`;
    return;
  }

  // Fallback to faction info
  const faction = getFactionById(factionId);
  if (faction) {
    factionTechCount.textContent = `${faction.name} - ${faction.tech_count} technologies`;
  } else {
    factionTechCount.textContent = `Faction: ${factionId}`;
  }
}

/**
 * Get current selected faction (for filtering)
 */
export function getCurrentFaction() {
  return currentFaction;
}

/**
 * Get current selected empire
 */
export function getCurrentEmpire() {
  return currentEmpire;
}

/**
 * Set current faction (programmatically)
 */
export function setCurrentFaction(factionId) {
  currentFaction = factionId;
  updateFactionInfo(factionId);
}

/**
 * Set current empire by ID (programmatically, e.g., from URL params)
 */
export function setCurrentEmpireById(empireId) {
  const empire = getEmpireById(empireId);
  if (empire) {
    handleEmpireSelect(empire);
    setSelectedEmpire(empireId);
  }
}

/**
 * Clear selection (show all factions)
 */
export function clearFactionSelection() {
  currentFaction = 'all';
  currentEmpire = null;
  updateFactionInfo('all');

  // Clear autocomplete input
  const input = document.getElementById('faction-search');
  if (input) {
    input.value = '';
  }
}
