// Filters module: pure data utilities for filtering tech arrays
import { getConnectedTechIds } from './data.js';

export function filterTechsByArea(techs, area) {
  if (!area || area === 'all') return techs;
  return (techs || []).filter(t => t.area === area);
}

export function filterTechsBySpecies(techs, species, isExclusive = false) {
  if (!species || species === 'all') return techs;
  return (techs || []).filter(t => {
    const rs = t.required_species || [];
    return isExclusive ? (rs.length > 0 && rs.includes(species)) : (rs.length === 0 || rs.includes(species));
  });
}

export function filterTechsByTier(techs, { startTier = 0, endTier = 99 } = {}) {
  return (techs || []).filter(t => {
    const tier = parseInt(t.tier, 10) || 0;
    return tier >= startTier && tier <= endTier;
  });
}

export function filterConnected(techs, activeTechId) {
  if (!activeTechId) return techs;
  const connected = getConnectedTechIds(activeTechId, techs);
  const set = new Set(connected);
  return (techs || []).filter(t => set.has(t.id));
}

export function filterTechsByCategory(techs, category) {
  if (!category || category === 'all') return techs;
  return (techs || []).filter(t => Array.isArray(t.category) && t.category.includes(category));
}

export function filterTechsByUnlock(techs, unlockType) {
  if (!unlockType || unlockType === 'all') return techs;
  return (techs || []).filter(t => {
    const unlocks = t.unlock_details?.unlocks_by_type;
    return unlocks && Object.keys(unlocks).includes(unlockType);
  });
}

export function filterTechs({ techs, species = 'all', isExclusive = false, area = 'all', category = 'all', unlock = 'all', tierRange = { startTier: 0, endTier: 99 }, activeTechId = null }) {
  let result = techs || [];
  result = filterTechsByArea(result, area);
  result = filterTechsByCategory(result, category);
  result = filterTechsByUnlock(result, unlock);
  result = filterTechsBySpecies(result, species, isExclusive);
  result = filterConnected(result, activeTechId);
  result = filterTechsByTier(result, tierRange);
  return result;
}

// UI helper: populate species <select> from assets/species.json and notify when done
export function loadSpeciesFilter(speciesSelectEl, { onLoaded } = {}) {
  if (!speciesSelectEl) return Promise.resolve([]);
  return fetch('assets/tech/species.json')
    .then(response => response.json())
    .then(speciesList => {
      speciesList.forEach(species => {
        const option = document.createElement('option');
        option.value = species;
        option.textContent = species;
        speciesSelectEl.appendChild(option);
      });
      if (typeof onLoaded === 'function') {
        try { onLoaded(speciesList); } catch (_) {}
      }
      return speciesList;
    })
    .catch(error => {
      console.error('Error loading species list:', error);
      return [];
    });
}

// Helper: format category key to display name (e.g., "field_manipulation" -> "Field Manipulation")
function formatCategoryName(category) {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// UI helper: populate category <select> from assets/categories.json and notify when done
export function loadCategoryFilter(categorySelectEl, { onLoaded } = {}) {
  if (!categorySelectEl) return Promise.resolve([]);
  return fetch('assets/tech/categories.json')
    .then(response => response.json())
    .then(categoryList => {
      categoryList.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = formatCategoryName(category);
        categorySelectEl.appendChild(option);
      });
      if (typeof onLoaded === 'function') {
        try { onLoaded(categoryList); } catch (_) {}
      }
      return categoryList;
    })
    .catch(error => {
      console.error('Error loading category list:', error);
      return [];
    });
}

// UI helper: populate unlock <select> from assets/unlock_types.json and notify when done
export function loadUnlockFilter(unlockSelectEl, { onLoaded } = {}) {
  if (!unlockSelectEl) return Promise.resolve([]);
  return fetch('assets/tech/unlock_types.json')
    .then(response => response.json())
    .then(unlockList => {
      unlockList.forEach(unlock => {
        const option = document.createElement('option');
        option.value = unlock;
        option.textContent = unlock;  // Already formatted (e.g., "Ship Type")
        unlockSelectEl.appendChild(option);
      });
      if (typeof onLoaded === 'function') {
        try { onLoaded(unlockList); } catch (_) {}
      }
      return unlockList;
    })
    .catch(error => {
      console.error('Error loading unlock types list:', error);
      return [];
    });
}

// --- Adaptive Filter Functions ---

/**
 * Get available unlock types for techs matching a category
 * @param {Array} techs - All technologies
 * @param {string} category - Selected category (or 'all')
 * @returns {Set} Set of available unlock type names
 */
function getAvailableUnlocks(techs, category) {
  const unlocks = new Set();
  const filtered = category && category !== 'all'
    ? techs.filter(t => Array.isArray(t.category) && t.category.includes(category))
    : techs;

  filtered.forEach(t => {
    const types = t.unlock_details?.unlocks_by_type;
    if (types) Object.keys(types).forEach(u => unlocks.add(u));
  });
  return unlocks;
}

/**
 * Get available categories for techs matching an unlock type
 * @param {Array} techs - All technologies
 * @param {string} unlock - Selected unlock type (or 'all')
 * @returns {Set} Set of available category names
 */
function getAvailableCategories(techs, unlock) {
  const categories = new Set();
  const filtered = unlock && unlock !== 'all'
    ? techs.filter(t => {
        const types = t.unlock_details?.unlocks_by_type;
        return types && Object.keys(types).includes(unlock);
      })
    : techs;

  filtered.forEach(t => {
    if (Array.isArray(t.category)) {
      t.category.forEach(c => categories.add(c));
    }
  });
  return categories;
}

/**
 * Update dropdown options based on current filter selection.
 * Disables options that would produce no results when combined with the other filter.
 * @param {Object} params
 * @param {Array} params.techs - All technologies to consider
 * @param {HTMLSelectElement} params.categorySelect - Category dropdown element
 * @param {HTMLSelectElement} params.unlockSelect - Unlock dropdown element
 * @param {string} params.currentCategory - Currently selected category
 * @param {string} params.currentUnlock - Currently selected unlock type
 */
export function updateAdaptiveFilters({
  techs,
  categorySelect,
  unlockSelect,
  currentCategory,
  currentUnlock
}) {
  if (!categorySelect || !unlockSelect || !Array.isArray(techs)) return;

  // Update unlock options based on selected category
  const availableUnlocks = getAvailableUnlocks(techs, currentCategory);
  Array.from(unlockSelect.options).forEach(opt => {
    if (opt.value === 'all') return; // "All" always enabled
    opt.disabled = !availableUnlocks.has(opt.value);
    opt.style.color = opt.disabled ? '#666' : '';
  });

  // Update category options based on selected unlock
  const availableCategories = getAvailableCategories(techs, currentUnlock);
  Array.from(categorySelect.options).forEach(opt => {
    if (opt.value === 'all') return; // "All" always enabled
    opt.disabled = !availableCategories.has(opt.value);
    opt.style.color = opt.disabled ? '#666' : '';
  });
}
