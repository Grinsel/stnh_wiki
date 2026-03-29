// Filter Highlighting Module
// Dims techs not matching the selected category and/or unlock type
// Supports AND-combination when both filters are active

let _filterHighlightActive = false;
let _highlightedCategory = null;
let _highlightedUnlock = null;
let _allTechs = [];

/**
 * Initialize filter highlighting with tech data
 * @param {Array} techs - All loaded technologies
 */
export function initFilterHighlight(techs) {
  _allTechs = techs || [];
}

/**
 * Check if filter highlighting is actively applied
 * Returns true only if toggle is on AND at least one filter is selected
 */
export function isFilterHighlightActive() {
  return _filterHighlightActive && (_highlightedCategory !== null || _highlightedUnlock !== null);
}

/**
 * Get the currently highlighted category
 */
export function getHighlightedCategory() {
  return _highlightedCategory;
}

/**
 * Get the currently highlighted unlock type
 */
export function getHighlightedUnlock() {
  return _highlightedUnlock;
}

/**
 * Set filter highlight state (called from showcase.js)
 * @param {boolean} active - Whether highlight mode is enabled
 * @param {string|null} category - Category to highlight, or null
 * @param {string|null} unlock - Unlock type to highlight, or null
 */
export function setFilterHighlightState(active, category, unlock) {
  _filterHighlightActive = active;
  _highlightedCategory = (category && category !== 'all') ? category : null;
  _highlightedUnlock = (unlock && unlock !== 'all') ? unlock : null;
}

/**
 * Check if a tech matches the current highlight filters
 * @param {Object} tech - Tech object
 * @returns {boolean} True if tech matches ALL active filters (AND logic)
 */
function techMatchesFilters(tech) {
  // Category check (if active)
  if (_highlightedCategory) {
    if (!Array.isArray(tech.category) || !tech.category.includes(_highlightedCategory)) {
      return false;
    }
  }

  // Unlock check (if active)
  if (_highlightedUnlock) {
    const unlocks = tech.unlock_details?.unlocks_by_type;
    if (!unlocks || !Object.keys(unlocks).includes(_highlightedUnlock)) {
      return false;
    }
  }

  return true;
}

/**
 * Apply filter highlighting to currently rendered techs
 * Uses AND logic: tech must match ALL active filters
 */
export function applyFilterHighlight() {
  const g = d3.select('#tech-tree svg g');
  if (g.empty()) {
    console.warn('[FilterHighlight] No SVG group found');
    return;
  }

  // Clear highlighting if no filters active
  if (!_highlightedCategory && !_highlightedUnlock) {
    g.selectAll('.tech-node').classed('category-dimmed', false);
    g.selectAll('.link').classed('category-dimmed', false);
    return;
  }

  // Get IDs of techs matching ALL active filters
  const matchingTechIds = new Set(
    _allTechs
      .filter(techMatchesFilters)
      .map(t => t.id)
  );

  const filterDesc = [
    _highlightedCategory ? `category="${_highlightedCategory}"` : null,
    _highlightedUnlock ? `unlock="${_highlightedUnlock}"` : null
  ].filter(Boolean).join(' AND ');

  console.log(`[FilterHighlight] Highlighting ${matchingTechIds.size} techs matching: ${filterDesc}`);

  // Dim techs NOT matching filters
  g.selectAll('.tech-node')
    .classed('category-dimmed', d => !matchingTechIds.has(d.id));

  // Dim links where neither source nor target matches
  g.selectAll('.link')
    .classed('category-dimmed', d => {
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      return !matchingTechIds.has(sourceId) && !matchingTechIds.has(targetId);
    });
}

/**
 * Clear all filter highlighting
 */
export function clearFilterHighlight() {
  const g = d3.select('#tech-tree svg g');
  if (!g.empty()) {
    g.selectAll('.tech-node').classed('category-dimmed', false);
    g.selectAll('.link').classed('category-dimmed', false);
  }
  _filterHighlightActive = false;
  _highlightedCategory = null;
  _highlightedUnlock = null;
}

/**
 * Update tech data (call after filtering/re-rendering)
 * @param {Array} techs - Updated tech list
 */
export function updateTechs(techs) {
  _allTechs = techs || [];

  // Re-apply highlight if active
  if (_filterHighlightActive && (_highlightedCategory || _highlightedUnlock)) {
    // Small delay to ensure DOM is updated
    requestAnimationFrame(() => {
      applyFilterHighlight();
    });
  }
}
