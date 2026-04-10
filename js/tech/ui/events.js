import { zoomByFactor } from './zoom.js';

// Attaches all DOM event handlers. Caller provides concrete elements, state accessors, and actions.
// This module is intentionally decoupled from globals; showcase.js wires dependencies.
// Usage:
//   attachEventHandlers({ elements, state, actions })
export function attachEventHandlers({ elements, state, actions }) {
  const {
    speciesSelect,
    speciesExclusiveToggle,
    factionExclusiveToggle,
    searchInput,
    searchButton,
    searchBackButton,
    searchScopeToggle,
    techTreeContainer,
    tooltip,
    areaSelect,
    resetButton,
    techCounter,
    layoutSelect,
    copyBtn,
    landingCard,
    showTreeButton,
    treeToolbar,
    viewLegend,
    backButton,
    forwardButton,
    generalTab,
    detailsTab,
    generalPanel,
    detailsPanel,
    helpButton,
    helpViewport,
    helpCloseButton,
    zoomInButton,
    zoomOutButton,
  } = elements;

  const {
    getActiveTechId,
    getPreSearchState,
    setPreSearchState,
  } = state;

  const {
    updateVisualization,
    saveState,
    switchTab,
    getSelectedTierRange,
    renderGraph,
    runSearch,
    setCookie,
    calculateAndRenderPath,
    resetState,
  } = actions;

  // History navigation
  backButton?.addEventListener('click', actions.navigateBack);
  forwardButton?.addEventListener('click', actions.navigateForward);

  // Tabs
  generalTab?.addEventListener('click', () => switchTab('general'));
  detailsTab?.addEventListener('click', () => switchTab('details'));

  // Share URL
  copyBtn?.addEventListener('click', () => {
    const focus = window.currentFocusId;
    const params = new URLSearchParams({
      layout: layoutSelect?.value || '',
      species: speciesSelect?.value || '',
      area: areaSelect?.value || '',
      tierStart: document.getElementById('start-tier-select')?.value || '',
      tierEnd: document.getElementById('end-tier-select')?.value || '',
    });
    if (focus) {
      params.set('focus', focus);
    } else {
      const search = searchInput?.value;
      if (search && search.trim() !== '') params.set('search', search);
    }
    const shareURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(shareURL).then(() => {
      alert(`Link ${focus ? 'to this Branch' : ''} copied to clipboard!\n\n${shareURL}`);
    }, (err) => alert('Copy URL failed: ' + err));
  });

  // Filters/layouts
  speciesSelect?.addEventListener('change', (e) => updateVisualization(e.target.value, getActiveTechId()));
  speciesExclusiveToggle?.addEventListener('change', () => updateVisualization(speciesSelect?.value, getActiveTechId()));
  factionExclusiveToggle?.addEventListener('change', () => updateVisualization(speciesSelect?.value, getActiveTechId()));
  areaSelect?.addEventListener('change', () => updateVisualization(speciesSelect?.value, getActiveTechId()));
  layoutSelect?.addEventListener('change', () => updateVisualization(speciesSelect?.value, getActiveTechId()));

  // Reload/Reset
  resetButton?.addEventListener('click', () => {
    if (typeof resetState === 'function') {
      resetState();
    } else {
      window.location.reload();
    }
  });

  // Search
  searchInput?.addEventListener('keydown', (event) => { if (event.key === 'Enter') actions.handleSearch?.(); });
  searchButton?.addEventListener('click', actions.handleSearch);
  searchBackButton?.addEventListener('click', () => actions.onSearchBack?.());

  // Tier range sliders — apply live on drag
  const startTierEl = document.getElementById('start-tier-select');
  const endTierEl = document.getElementById('end-tier-select');

  function syncTierSliders(triggerUpdate = true) {
    let s = parseInt(startTierEl?.value ?? 0, 10);
    let e = parseInt(endTierEl?.value ?? 11, 10);
    // Enforce min <= max
    if (s > e) {
      if (document.activeElement === startTierEl) {
        startTierEl.value = e;
        s = e;
      } else {
        endTierEl.value = s;
        e = s;
      }
    }
    // Update label
    const display = document.getElementById('tier-range-display');
    if (display) display.textContent = `${s} – ${e}`;
    // Update fill track
    const fill = document.getElementById('tier-range-fill');
    if (fill) {
      const pct = (v) => (v / 11) * 100;
      fill.style.marginLeft = pct(s) + '%';
      fill.style.width = (pct(e) - pct(s)) + '%';
    }
    if (triggerUpdate) updateVisualization(speciesSelect?.value, getActiveTechId());
  }

  startTierEl?.addEventListener('input', () => syncTierSliders(true));
  endTierEl?.addEventListener('input', () => syncTierSliders(true));
  // Init fill only (no re-render)
  syncTierSliders(false);

  // Save state on change
  ;['species-select','area-select','layout-select','tech-filter-input','start-tier-select','end-tier-select','performance-toggle']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', saveState);
      el.addEventListener('input', saveState);
    });

  // Performance toggle -> recompute LOD
  const performanceToggle = document.getElementById('performance-toggle');
  performanceToggle?.addEventListener('change', actions.updateLOD);

  // Path rendering buttons
  document.getElementById('render-path-button')?.addEventListener('click', () => {
    const sel = actions.getSelection?.();
    if (sel?.selectionStartNode && sel?.selectionEndNode) {
      calculateAndRenderPath(sel.selectionStartNode, sel.selectionEndNode);
    } else if (sel?.selectionStartNode) {
      calculateAndRenderPath(sel.selectionStartNode);
    }
  });

  document.getElementById('popup-close-button')?.addEventListener('click', () => {
    document.getElementById('popup-viewport')?.classList.add('hidden');
  });

  document.getElementById('popup-copy-button')?.addEventListener('click', () => {
    const sel = actions.getSelection?.();
    let params;
    if (sel?.selectionStartNode && sel?.selectionEndNode) {
      params = new URLSearchParams({ pathStart: sel.selectionStartNode, pathEnd: sel.selectionEndNode });
    } else if (sel?.selectionStartNode) {
      params = new URLSearchParams({ dependenciesFor: sel.selectionStartNode });
    }
    if (!params) return;
    const shareURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(shareURL).then(() => { alert(`URL copied to clipboard!\n\n${shareURL}`); }, (err) => alert('Failed to copy URL: ' + err));
  });

  // Help overlay
  helpButton?.addEventListener('click', () => helpViewport?.classList.remove('hidden'));
  helpCloseButton?.addEventListener('click', () => helpViewport?.classList.add('hidden'));
  helpViewport?.addEventListener('click', (e) => { if (e.target === helpViewport) helpViewport.classList.add('hidden'); });
  
  // Zoom controls
  zoomInButton?.addEventListener('click', () => zoomByFactor(window.svg, window.zoom, 1.2));
  zoomOutButton?.addEventListener('click', () => zoomByFactor(window.svg, window.zoom, 0.8));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpViewport && !helpViewport.classList.contains('hidden')) {
      helpViewport.classList.add('hidden');
    }
    // Guard against zooming while typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomByFactor(window.svg, window.zoom, 1.2);
    }
    if (e.key === '-') {
      e.preventDefault();
      zoomByFactor(window.svg, window.zoom, 0.8);
    }
  });

  // Initial load buttons
  const loadTreeButton = document.getElementById('load-tree-button'); // toolbar (hidden initially)
  const loadTreeCenterButton = document.getElementById('load-tree-center-button'); // centered inside #tech-tree

  const handleInitialLoad = () => {
    try { setCookie('landing_seen', '1', 365); } catch(e) {}
    // If the Tech Details tab is currently active, switch back to General
    if (detailsTab?.classList.contains('active')) {
      switchTab('general');
    }
    // Toggle buttons visibility: hide center button, show toolbar button
    const tb = document.getElementById('load-tree-button');
    const cb = document.getElementById('load-tree-center-button');
    if (cb) cb.style.display = 'none';
    if (tb) tb.style.display = '';
    actions.loadAndRenderTree?.();
  };

  loadTreeButton?.addEventListener('click', actions.resetViewToFullTree);
  loadTreeCenterButton?.addEventListener('click', handleInitialLoad);
  showTreeButton?.addEventListener('click', handleInitialLoad);
}
