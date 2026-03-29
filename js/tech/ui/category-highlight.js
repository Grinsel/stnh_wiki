// DEPRECATED: Use filter-highlight.js instead!
// This file is kept for backwards compatibility only.
// The new filter-highlight.js supports both Category AND Unlock highlighting.

// Category Highlighting Module (DEPRECATED)
// Dims techs not matching the selected category

let _categoryHighlightActive = false;
let _highlightedCategory = null;
let _allTechs = [];

/**
 * Initialize category highlighting with tech data
 * @param {Array} techs - All loaded technologies
 */
export function initCategoryHighlight(techs) {
  _allTechs = techs || [];
}

/**
 * Check if category highlighting is actively applied (toggle on AND category selected)
 */
export function isCategoryHighlightActive() {
  return _categoryHighlightActive && _highlightedCategory !== null;
}

/**
 * Get the currently highlighted category
 */
export function getHighlightedCategory() {
  return _highlightedCategory;
}

/**
 * Set category highlight state (called from showcase.js)
 */
export function setCategoryHighlightState(active, category) {
  _categoryHighlightActive = active;
  _highlightedCategory = category;
}

/**
 * Apply category highlighting to currently rendered techs
 * @param {string|null} category - Category to highlight, or null to clear
 */
export function applyCategoryHighlight(category) {
  const g = d3.select('#tech-tree svg g');
  if (g.empty()) {
    console.warn('[CategoryHighlight] No SVG group found');
    return;
  }

  // Clear highlighting if no category or "all"
  if (!category || category === 'all') {
    g.selectAll('.tech-node').classed('category-dimmed', false);
    g.selectAll('.link').classed('category-dimmed', false);
    _categoryHighlightActive = false;
    _highlightedCategory = null;
    return;
  }

  // Get IDs of techs in this category
  const categoryTechIds = new Set(
    _allTechs
      .filter(t => Array.isArray(t.category) && t.category.includes(category))
      .map(t => t.id)
  );

  console.log(`[CategoryHighlight] Highlighting ${categoryTechIds.size} techs in category "${category}"`);

  // Dim techs NOT in category
  g.selectAll('.tech-node')
    .classed('category-dimmed', d => !categoryTechIds.has(d.id));

  // Dim links where neither source nor target is in category
  g.selectAll('.link')
    .classed('category-dimmed', d => {
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      return !categoryTechIds.has(sourceId) && !categoryTechIds.has(targetId);
    });

  _categoryHighlightActive = true;
  _highlightedCategory = category;
}

/**
 * Clear all category highlighting
 */
export function clearCategoryHighlight() {
  applyCategoryHighlight(null);
}

/**
 * Update tech data (call after filtering/re-rendering)
 * @param {Array} techs - Updated tech list
 */
export function updateTechs(techs) {
  _allTechs = techs || [];

  // Re-apply highlight if active
  if (_categoryHighlightActive && _highlightedCategory) {
    // Small delay to ensure DOM is updated
    requestAnimationFrame(() => {
      applyCategoryHighlight(_highlightedCategory);
    });
  }
}
