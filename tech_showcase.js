import { updateLOD, calculateAndRenderPath as calculateAndRenderPathController, formatTooltip, createSvgFor, getAreaColor, renderNodeLabels } from './js/tech/render.js';
import { CanvasTechRenderer } from './js/tech/canvas-renderer.js';
import { buildLinksFromPrereqs, getConnectedTechIds, getPrerequisites as getPrerequisitesData, calculateAllPaths, loadTechnologyData, getAllTechsCached, isTechDataLoaded, filterTechsByFaction, isFactionExclusive, loadTechItemMap } from './js/tech/data.js';  // NEW Phase 2: added filterTechsByFaction, isFactionExclusive
import { filterTechsByTier as filterTechsByTierData, filterTechs, loadSpeciesFilter, loadCategoryFilter, loadUnlockFilter, updateAdaptiveFilters } from './js/tech/filters.js';
import { handleSearch as executeSearch } from './js/tech/search.js';
import { renderForceDirectedArrowsGraph as arrowsLayout } from './js/tech/ui/layouts/arrows.js';
import { renderForceDirectedGraph as forceLayout } from './js/tech/ui/layouts/force.js';
import { renderDisjointForceDirectedGraph as disjointLayout } from './js/tech/ui/layouts/disjoint.js';
import { zoomToFit } from './js/tech/ui/zoom.js';
import { layoutByTier } from './js/tech/ui/layouts/tier.js';
import { loadState, saveState, applyState, resetState, setCookie, getCookie } from './js/tech/state.js';
import { drag } from './js/tech/ui/drag.js';
import { switchTab } from './js/tech/ui/tabs.js';
import { getSelectedTierRange } from './js/tech/ui/tiers.js';
import { layoutAsGrid } from './js/tech/ui/layouts/grid.js';
import { renderGraph as dispatchRenderGraph } from './js/tech/render.js';
import { createHandleNodeSelection } from './js/tech/ui/selection.js';
import { renderPopupGraph } from './js/tech/ui/popup.js';
import { attachEventHandlers } from './js/tech/ui/events.js';
import { updateHistoryButtons } from './js/tech/ui/history.js';
import { initFactionDropdown, registerFactionEvents, getCurrentFaction } from './js/tech/factions.js';  // NEW Phase 2
import { initFilterHighlight, isFilterHighlightActive, getHighlightedCategory, getHighlightedUnlock, setFilterHighlightState, applyFilterHighlight, clearFilterHighlight, updateTechs as updateFilterHighlightTechs } from './js/tech/ui/filter-highlight.js';
import { initPathHighlight, setRenderedNodes, setActiveTechId as setPathHighlightActiveTech, handleTechHover, handleTechHoverDecoupled, handleTechMouseOut, clearPathHighlight, setHighlightDirection, getHighlightDirection } from './js/tech/ui/path-highlight.js';

// Global SVG and group so LOD can access current transform and selections
let svg = null;
let g = null;
let zoom = null;


document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const speciesSelect = document.getElementById('species-select');
    const factionExclusiveToggle = document.getElementById('faction-exclusive-toggle');  // Phase 2: Renamed
    const searchInput = document.getElementById('tech-filter-input');
    const searchButton = document.getElementById('search-button');
    const searchBackButton = document.getElementById('search-back-button');
    const searchScopeToggle = document.getElementById('search-scope-toggle');
    const searchNameOnlyToggle = document.getElementById('search-name-only-toggle');
    const techTreeContainer = document.getElementById('tech-tree');
    const tooltip = document.getElementById('tooltip');
    const areaSelect = document.getElementById('area-select');
    const categorySelect = document.getElementById('category-select');
    const unlockSelect = document.getElementById('unlock-select');
    const resetButton = document.getElementById('reset-button');
    const techCounter = document.getElementById('tech-counter');
    const layoutSelect = document.getElementById('layout-select');
    const copyBtn = document.getElementById("share-button");
    const landingCard = document.getElementById('landing-card');
    const showTreeButton = document.getElementById('show-tree-button');
    const treeToolbar = document.getElementById('tree-toolbar');
    const viewLegend = document.getElementById('view-legend');
    const backButton = document.getElementById('back-button');
    const forwardButton = document.getElementById('forward-button');
    const generalTab = document.getElementById('general-tab');
    const detailsTab = document.getElementById('details-tab');
    const generalPanel = document.getElementById('general-panel');
    const detailsPanel = document.getElementById('details-panel');
    const techDetailsContent = document.getElementById('tech-details-content');
    const sidebar = document.getElementById('sidebar');
    const helpButton = document.getElementById('help-button');
    const helpViewport = document.getElementById('help-viewport');
    const helpCloseButton = document.getElementById('help-close-button');
    const toggleLayoutButton = document.getElementById('toggle-layout-button');
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');

    // --- Create persistent UI elements ---
    const jumpButton = document.createElement('button');
    jumpButton.id = 'jump-to-tech-btn';
    jumpButton.textContent = 'Jump to Tech';
    jumpButton.style.width = '100%';
    jumpButton.style.padding = '8px 10px';
    jumpButton.style.background = '#232b3d';
    jumpButton.style.color = '#eaf2ff';
    jumpButton.style.border = '1px solid #3c80ff88';
    jumpButton.style.borderRadius = '8px';
    jumpButton.style.marginTop = '12px';
    jumpButton.style.fontSize = '1rem';
    jumpButton.style.fontFamily = 'var(--font)';
    jumpButton.style.cursor = 'pointer';
    jumpButton.style.display = 'none'; // Initially hidden
    jumpButton.addEventListener('mouseover', () => {
        jumpButton.style.background = '#3c4b7a';
        jumpButton.style.borderColor = '#3c80ff';
    });
    jumpButton.addEventListener('mouseout', () => {
        jumpButton.style.background = '#232b3d';
        jumpButton.style.borderColor = '#3c80ff88';
    });
    jumpButton.addEventListener('click', () => zoomToTech(activeTechId));
    
    const hr = document.createElement('hr');
    hr.id = 'jump-to-tech-hr';
    hr.style.display = 'none'; // Initially hidden
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid #34405a';
    hr.style.marginTop = '12px';

    techDetailsContent.appendChild(hr);
    techDetailsContent.appendChild(jumpButton);

    // --- Reusable Actions ---
    function zoomToTech(techId) {
        if (!svg || !zoom || !techId) return;

        const targetNode = nodes.find(n => n.id === techId);
        if (!targetNode || typeof targetNode.x === 'undefined') {
            // This case is handled by the search logic, but we can keep the alert for the button
            if (document.activeElement === jumpButton) {
                alert('Technology is not visible in the current view.');
            }
            return;
        }

        const width = svg.node().clientWidth;
        const height = svg.node().clientHeight;
        const scale = 1.2;
        
        const transform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-targetNode.x, -targetNode.y);

        svg.transition()
            .duration(750)
            .call(zoom.transform, transform);
    }
    window.zoomToTech = zoomToTech; // Make it globally accessible for the search module

    function setActiveTech(techId) {
        // Clear previous search highlight
        if (lastSearchedTechId && g) {
            g.selectAll('.tech-node')
                .filter(d => d.id === lastSearchedTechId)
                .select('rect')
                .attr('stroke', null)
                .attr('stroke-width', null);
        }

        if (techId && g) {
            // Apply new search highlight
            g.selectAll('.tech-node')
                .filter(d => d.id === techId)
                .select('rect')
                .attr('stroke', 'magenta')
                .attr('stroke-width', 3);
        }

        // Update state for the new search
        lastSearchedTechId = techId;
        activeTechId = techId;
        
        // Update details panel
        const techSource = getAllTechsCached() || allTechs;
        const tech = techId ? techSource.find(t => t.id === techId) : null;
        renderTechDetails(tech);

        // We no longer call handleNodeSelection as it's for the yellow border, 
        // and we want a distinct magenta border for search.
    }
    window.setActiveTech = setActiveTech;


    // --- State Variables ---
    let lastSearchedTechId = null;
    let selectionStartNode = null;
    let selectionEndNode = null;
    let navigationHistory = [null]; // null = Hauptbaum-Ansicht
    let historyIndex = 0;
    let isTreeInitialized = false;
    let allTechs = [];
    let nodes = [];
    let links = [];
    let preSearchState = null;
    let simulation;
    let activeTechId = null;
    let lastLayout = 'force-directed';
    let isTierBasedLayout = true;
    // Selection handler bound to current state (created after state vars exist)
    const handleNodeSelection = createHandleNodeSelection({
        getG: () => g,
        getActiveTechId: () => activeTechId,
        getSelection: () => ({ selectionStartNode, selectionEndNode }),
        setSelection: (start, end) => { selectionStartNode = start; selectionEndNode = end; },
    });

    // --- Path Highlighting ---
    // Now handled by js/ui/path-highlight.js module
    // Functions: handleTechHover, handleTechMouseOut, clearPathHighlight


    // --- History Navigation ---
    function navigateBack() {
        if (historyIndex > 0) {
            historyIndex--;
            const species = speciesSelect.value;
            const techId = navigationHistory[historyIndex];
            // Call updateVisualization without adding to history
            window.updateVisualization(species, techId, false);
        }
    }

    function navigateForward() {
        if (historyIndex < navigationHistory.length - 1) {
            historyIndex++;
            const species = speciesSelect.value;
            const techId = navigationHistory[historyIndex];
            // Call updateVisualization without adding to history
            window.updateVisualization(species, techId, false);
        }
    }


    // --- Core Initialization Functions ---
    function prepareUI() {
        if (isTreeInitialized) return;
        isTreeInitialized = true;
        // Mark landing as seen once the UI is prepared
        try { setCookie('landing_seen', '1', 365); } catch (e) {}

        // Hide landing card and show the tree view
        landingCard.classList.add('hidden');
        treeToolbar.style.display = 'flex';
        techTreeContainer.classList.remove('hidden');
        viewLegend.classList.remove('hidden');

        // Pre-load data as soon as the UI is ready
        loadTechnologyData().then(data => { if (Array.isArray(data)) { allTechs = data; } });

        // Set up permanent event listeners via centralized module
        attachEventHandlers({
            elements: {
                speciesSelect,
                factionExclusiveToggle,
                searchInput,
                searchButton,
                searchBackButton,
                searchScopeToggle,
                techTreeContainer,
                tooltip,
                areaSelect,
                categorySelect,
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
            },
            state: {
                getActiveTechId: () => activeTechId,
            },
            actions: {
                navigateBack,
                navigateForward,
                updateVisualization: (...args) => window.updateVisualization(...args),
                saveState,
                switchTab: (tab) => switchTab(tab),
                getSelectedTierRange,
                handleSearch: () => {
                    const searchTerm = searchInput.value.trim();
                    if (!searchTerm) return;

                    loadTechnologyData().then(allTechs => {
                        preSearchState = { nodes: [...nodes], links: [...links] };

                        const result = executeSearch({
                            searchTerm,
                            searchAll: !!searchScopeToggle.checked,
                            nameOnly: !!searchNameOnlyToggle.checked,
                            allTechs,
                            currentNodes: nodes,
                            currentLinks: links,
                            techTreeContainer,
                            tooltipEl: tooltip,
                            searchBackButtonEl: searchBackButton,
                            speciesSelectEl: speciesSelect,
                            updateVisualization,
                            simulation,
                            layoutAsGrid,
                            zoomToTech: window.zoomToTech,
                        });

                        if (!result) { preSearchState = null; return; }
                        // Update globals for LOD/zoom consistency
                        svg = result.svg;
                        g = result.g;
                        nodes = result.nodes;
                        links = result.links;
                    });
                },
                setCookie,
                calculateAndRenderPath: (startId, endId) => {
                    const popupContainer = document.getElementById('popup-tech-tree');
                    const popupViewport = document.getElementById('popup-viewport');
                    calculateAndRenderPathController(startId, endId, allTechs, {
                        popupViewportEl: popupViewport,
                        popupContainerEl: popupContainer,
                        tooltipEl: tooltip,
                        techTreeContainerEl: techTreeContainer,
                        renderPopupGraph,
                        getPrerequisitesData,
                        calculateAllPaths,
                        drag,
                    });
                },
                updateLOD: () => updateLOD(svg, g),
                resetState,
                getSelection: () => ({ selectionStartNode, selectionEndNode }),
                loadAndRenderTree,
                onSearchBack: () => {
                    if (preSearchState) {
                        const selectedLayout = document.getElementById('layout-select').value;
                        // Re-render from preSearchState nodes; rebuild links for consistency
                        renderTree({
                            filteredTechs: preSearchState.nodes,
                            selectedLayout,
                            selectedSpecies: speciesSelect.value,
                        });
                        nodes = preSearchState.nodes;
                        links = buildLinksFromPrereqs(nodes);
                        preSearchState = null;
                        searchBackButton.style.display = 'none';
                    }
                },
                resetViewToFullTree: () => {
                    isTierBasedLayout = false;
                    layoutSelect.value = 'force-directed';
                    window._syncLayoutBtnGroup?.();
                    saveState();
                    updateVisualization(speciesSelect.value, null, false);
                },
            },
        });
    }

    

    function loadAndRenderTree() {
        // Ensure the UI is prepared so the container has a size
        prepareUI();

        Promise.all([loadTechnologyData(), loadTechItemMap()]).then(([data]) => {
            if (Array.isArray(data)) {
                allTechs = data;
                // Initialize highlighting modules with tech data
                initFilterHighlight(data);
                initPathHighlight(data);
            }
            // If data is already loaded, just re-render with current filters
            const currentState = loadState();
            if (!currentState.species) {
                currentState.species = 'Federation';
            }
            applyState(currentState);
            window._syncLayoutBtnGroup?.();
            
            // Validate initial focus exists in dataset
            const initialFocusValid = currentState.focus && data.some(t => t.id === currentState.focus);
            window.currentFocusId = initialFocusValid ? currentState.focus : null;
            activeTechId = window.currentFocusId;

            // History immer mit Hauptbaum (null) starten
            navigationHistory = [null];
            historyIndex = 0;

            // Falls URL einen Focus hat, diesen zur History hinzufügen
            if (activeTechId) {
                navigationHistory.push(activeTechId);
                historyIndex = 1;
            }

            updateVisualization(currentState.species, activeTechId, false, activeTechId);
        });
    }

    // --- Visualization and Helper Functions ---


    // History buttons UI is handled in './js/ui/history.js'

    // --- Streamlined Helpers ---
    function renderTechDetails(tech) {
        const jumpBtn = document.getElementById('jump-to-tech-btn');
        const hrSep = document.getElementById('jump-to-tech-hr');

        // NEW Phase 2: Pass current faction to tooltip
        let html;
        try {
            html = tech ? formatTooltip(tech, getCurrentFaction()) : '<p>Click on a technology to see its details here.</p>';
        } catch (e) {
            console.error('[renderTechDetails] formatTooltip error:', e);
            html = `<p>Error rendering details: ${e.message}</p>`;
        }
        techDetailsContent.innerHTML = html;
        if (hrSep) techDetailsContent.appendChild(hrSep);
        if (jumpBtn) techDetailsContent.appendChild(jumpBtn);

        if (tech) {
            if (jumpBtn) jumpBtn.style.display = 'block';
            if (hrSep) hrSep.style.display = 'block';
            switchTab('details');
        } else {
            if (jumpBtn) jumpBtn.style.display = 'none';
            if (hrSep) hrSep.style.display = 'none';
        }
    }

    function applyFilters({ selectedSpecies, activeTechId }) {
        const selectedArea = areaSelect.value;
        // When filter highlighting is active, ignore category and unlock filters (show all techs, dim non-matching)
        const selectedCategory = isFilterHighlightActive() ? 'all' : categorySelect.value;
        const selectedUnlock = isFilterHighlightActive() ? 'all' : unlockSelect.value;
        const isExclusive = factionExclusiveToggle.checked;

        // Base species/area filtering via data module (no active focus here yet)
        const sourceTechs = getAllTechsCached() || allTechs;
        let baseTechs = filterTechs({
            techs: sourceTechs,
            species: selectedSpecies,
            isExclusive,
            area: selectedArea,
            category: selectedCategory,
            unlock: selectedUnlock,
            tierRange: { startTier: 0, endTier: 99 },
            activeTechId: null,
        });

        // NEW Phase 2: Apply faction filter
        const currentFaction = getCurrentFaction();
        if (currentFaction && currentFaction !== 'all') {
            baseTechs = filterTechsByFaction(baseTechs, currentFaction);

            // NEW Phase 2: Apply faction-exclusive filter if toggle is active
            if (isExclusive) {
                const exclusiveTechs = baseTechs.filter(tech => isFactionExclusive(tech, currentFaction));
                if (exclusiveTechs.length === 0) {
                    // No exclusive techs for this faction - auto-disable toggle
                    factionExclusiveToggle.checked = false;
                } else {
                    baseTechs = exclusiveTechs;
                }
            }
        }

        // Apply connected filter using full graph for traversal, then intersect with base set
        let filteredTechs;
        let clearedFocus = false;
        if (activeTechId) {
            const connectedIds = getConnectedTechIds(activeTechId, sourceTechs);
            filteredTechs = baseTechs.filter(t => connectedIds.has(t.id));
            // If no nodes found (e.g., stale focus), clear focus and fall back
            if (filteredTechs.length === 0) {
                clearedFocus = true;
                filteredTechs = baseTechs;
            }
        } else {
            filteredTechs = baseTechs;
        }

        {
            const { startTier, endTier } = getSelectedTierRange();
            if (startTier > 0 || endTier < 11) {
                const tierFiltered = filterTechsByTierData(filteredTechs, { startTier, endTier });
                if (tierFiltered.length > 0) filteredTechs = tierFiltered;
            }
        }
        return { filteredTechs, clearedFocus };
    }

    function renderTierBasedGraph(nodes, links, selectedSpecies, container, deps) {
        const {
            tooltipEl,
            techTreeContainerEl,
            handleNodeSelection,
            updateVisualization,
            activeTechId,
            selectionStartNode,
            selectionEndNode,
            onEnd,
        } = deps || {};

        const { svg: _svg, g: _g, zoom, width, height } = createSvgFor(container);

        const defs = _svg.append('defs');
        const gradients = {
            society: ['#3a3a3a', getAreaColor('society')],
            engineering: ['#3a3a3a', getAreaColor('engineering')],
            physics: ['#3a3a3a', getAreaColor('physics')],
        };
        for (const [area, colors] of Object.entries(gradients)) {
            const gradient = defs
                .append('linearGradient')
                .attr('id', `gradient-${area}`)
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '100%')
                .attr('y2', '0%');
            gradient.append('stop').attr('offset', '0%').attr('stop-color', colors[0]);
            gradient.append('stop').attr('offset', '100%').attr('stop-color', colors[1]);
        }

        const filter = defs.append('filter')
            .attr('id', 'drop-shadow')
            .attr('height', '130%');
        filter.append('feGaussianBlur')
            .attr('in', 'SourceAlpha')
            .attr('stdDeviation', 3)
            .attr('result', 'blur');
        filter.append('feOffset')
            .attr('in', 'blur')
            .attr('dx', 3)
            .attr('dy', 3)
            .attr('result', 'offsetBlur');
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'offsetBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        const nodeWidth = 140, nodeHeight = 80;
        const tierPositions = layoutByTier(nodes, width, height, { nodeWidth, nodeHeight });

        // Hydrate links with node object references now that positions are calculated
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        links.forEach(link => {
            link.source = nodeMap.get(link.source) || link.source;
            link.target = nodeMap.get(link.target) || link.target;
        });

        // Canvas renderer draws all links — eliminates thousands of SVG <line> elements.
        // (renderTree already removed the old canvas before calling this function.)
        const canvasRenderer = new CanvasTechRenderer(container, nodes, links, width, height);

        // Pre-set LOD flags: buildEnter creates full nodes on entry, no lazy init needed.
        _g.property('labelsInitialized', true);
        _g.property('tiersInitialized', true);
        _g.property('linksInitialized', true);
        _g.property('layout', 'tier');
        _g.datum({ nodes, links });

        const tierLayer = _g.insert('g', '.nodes-layer').attr('class', 'tier-layer');

        function drawTierLines() {
            tierLayer.selectAll('*').remove();
            const transform = d3.zoomTransform(_svg.node());
            const topY = -transform.y / transform.k;
            const liveHeight = _svg.node().clientHeight || height;

            for (const tier in tierPositions) {
                const tierX = tierPositions[tier];
                tierLayer.append('line')
                    .attr('x1', tierX)
                    .attr('y1', topY)
                    .attr('x2', tierX)
                    .attr('y2', topY + liveHeight / transform.k)
                    .attr('stroke', '#444')
                    .attr('stroke-width', 1 / transform.k)
                    .attr('stroke-dasharray', '5,5');

                tierLayer.append('text')
                    .attr('x', tierX)
                    .attr('y', topY + 20 / transform.k)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#888')
                    .style('font-size', `${12 / transform.k}px`)
                    .text(`Tier ${tier}`);
            }
        }

        drawTierLines();
        let tierRafId = null;
        zoom.on('zoom', (event) => {
            _g.attr('transform', event.transform);
            canvasRenderer.scheduleRender(event.transform);
            if (tierRafId == null) {
                tierRafId = requestAnimationFrame(() => {
                    drawTierLines();
                    updateViewport(event.transform);
                    tierRafId = null;
                });
            }
        });

        const nodesLayer = _g.select('.nodes-layer');
        const MIN_SVG_ZOOM = 0.20;   // below this scale: canvas-only overview, no SVG nodes
        const VP_MARGIN   = 250;     // world-space margin beyond viewport edges
        const MAX_VISIBLE = 400;     // maximum SVG tech-node elements at any one time

        // Build a complete tech node <g> for all entering nodes.
        // Creates rect + labels + tier indicator immediately — no deferred LOD init needed
        // because the virtualizer caps the DOM to MAX_VISIBLE nodes at all times.
        function buildEnter(enter) {
            const nodeGSel = enter.append('g')
                .attr('class', 'tech-node')
                .attr('transform', d => `translate(${d.x},${d.y})`);

            nodeGSel
                .on('mouseover', (event, nd) => {
                    const tooltipToggle = document.getElementById('tooltip-toggle');
                    if (!tooltipToggle || tooltipToggle.checked) {
                        tooltipEl.style.display = 'block';
                        tooltipEl.innerHTML = formatTooltip(nd, getCurrentFaction());
                    }
                    setRenderedNodes(nodes);
                    handleTechHoverDecoupled(nd.id, _g, { nodeWidth, nodeHeight, getAreaColor });
                })
                .on('mousemove', (event) => {
                    const treeRect = techTreeContainerEl.getBoundingClientRect();
                    const tooltipRect = tooltipEl.getBoundingClientRect();
                    let x = event.clientX + 15;
                    let y = event.clientY + 15;
                    if (x + tooltipRect.width > treeRect.right) x = event.clientX - tooltipRect.width - 15;
                    if (y + tooltipRect.height > treeRect.bottom) y = event.clientY - tooltipRect.height - 15;
                    tooltipEl.style.left = `${Math.max(treeRect.left, x)}px`;
                    tooltipEl.style.top = `${Math.max(treeRect.top, y)}px`;
                })
                .on('mouseout', () => {
                    tooltipEl.style.display = 'none';
                    handleTechMouseOut();
                })
                .on('click', (event, nd) => {
                    window.currentFocusId = nd.id;
                    updateVisualization(selectedSpecies, nd.id, true);
                })
                .on('contextmenu', (event, nd) => {
                    event.preventDefault();
                    handleNodeSelection(nd);
                });

            const currentFaction = getCurrentFaction();
            nodeGSel.append('rect')
                .attr('class', 'node-rect')
                .attr('width', nodeWidth)
                .attr('height', nodeHeight)
                .attr('x', -nodeWidth / 2)
                .attr('y', -nodeHeight / 2)
                .attr('rx', 10)
                .attr('ry', 10)
                .attr('fill', d => (d.area ? `url(#gradient-${d.area})` : getAreaColor(d.area)))
                .style('filter', 'url(#drop-shadow)')
                .attr('stroke', d => {
                    if (d.id === activeTechId) return 'yellow';
                    if (d.id === selectionStartNode) return 'lime';
                    if (d.id === selectionEndNode) return 'red';
                    if (d.id === lastSearchedTechId) return 'magenta';
                    if (isFactionExclusive(d, currentFaction)) return '#ffd700';
                    return 'none';
                })
                .attr('stroke-width', d => {
                    if (d.id === activeTechId || d.id === selectionStartNode || d.id === selectionEndNode || d.id === lastSearchedTechId) return 4;
                    if (isFactionExclusive(d, currentFaction)) return 3;
                    return 1;
                });

            // Name text, category text, tech icon, unlock-type icons
            renderNodeLabels(nodeGSel, { nodeWidth, nodeHeight });

            // Tier indicator: left-side wedge with horizontal stripes (one per tier level)
            const tiW = 8, tiR = 10;
            const tix0 = -nodeWidth / 2, tiy0 = -nodeHeight / 2;
            const tix1 = tix0 + tiW, tiy1 = nodeHeight / 2;
            const tierPath = `M ${tix0},${tiy0 + tiR} A ${tiR},${tiR} 0 0 1 ${tix0 + tiR},${tiy0} L ${tix1},${tiy0} L ${tix1},${tiy1} L ${tix0 + tiR},${tiy1} A ${tiR},${tiR} 0 0 1 ${tix0},${tiy1 - tiR} Z`;
            const tierGSel = nodeGSel.append('g').attr('class', 'tier-indicator');
            tierGSel.append('path').attr('d', tierPath).attr('fill', 'white');
            tierGSel.each(function(d) {
                const tier = parseInt(d.tier) || 0;
                if (tier > 0) {
                    const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
                    const tg = d3.select(this);
                    tg.append('defs').append('clipPath').attr('id', clipId).append('path').attr('d', tierPath);
                    const stripes = tg.append('g').attr('clip-path', `url(#${clipId})`);
                    for (let i = 0; i < Math.min(tier, 11); i++) {
                        const yy = tiy0 + 3 + i * 6;
                        stripes.append('line')
                            .attr('stroke', 'black').attr('stroke-width', 2)
                            .attr('x1', tix0 - 5).attr('y1', yy)
                            .attr('x2', tix1 + 5).attr('y2', yy + (tix1 - tix0) + 6);
                    }
                }
            });

            return nodeGSel;
        }

        // LOD for tier-canvas mode: show/hide labels and tier indicators by zoom level.
        // Skips the circle-glyph path from updateLOD — canvas handles the overview.
        function applyTierLOD() {
            if (!_svg) return;
            const k = d3.zoomTransform(_svg.node()).k;
            _g.selectAll('.node-rect').style('display', null);
            _g.selectAll('.node-label').style('display', k >= 0.45 ? null : 'none');
            _g.selectAll('.tier-indicator').style('display', k >= 0.60 ? null : 'none');
        }

        // Viewport virtualization: use a keyed D3 data-join to maintain only the
        // currently visible nodes in the SVG DOM. Entering nodes get full content;
        // exiting nodes are removed. Runs in a RAF to avoid jank during fast panning.
        let vpRafId = null;
        function updateViewport(transform) {
            if (vpRafId != null) cancelAnimationFrame(vpRafId);
            vpRafId = requestAnimationFrame(() => {
                vpRafId = null;
                const svgW = _svg.node().clientWidth;
                const svgH = _svg.node().clientHeight;
                const { k, x, y } = transform;
                let visibleNodes;
                if (k < MIN_SVG_ZOOM) {
                    visibleNodes = [];   // canvas handles this zoom range entirely
                } else {
                    const bx0 = (-x / k) - VP_MARGIN, by0 = (-y / k) - VP_MARGIN;
                    const bx1 = ((svgW - x) / k) + VP_MARGIN, by1 = ((svgH - y) / k) + VP_MARGIN;
                    visibleNodes = nodes.filter(n => n.x >= bx0 && n.x <= bx1 && n.y >= by0 && n.y <= by1);
                    if (visibleNodes.length > MAX_VISIBLE) visibleNodes = visibleNodes.slice(0, MAX_VISIBLE);
                }
                nodesLayer.selectAll('.tech-node')
                    .data(visibleNodes, d => d.id)
                    .join(
                        enter  => buildEnter(enter),
                        update => update.attr('transform', d => `translate(${d.x},${d.y})`),
                        exit   => exit.remove()
                    );
                applyTierLOD();
                // Re-apply category dimming to freshly entered nodes
                if (isFilterHighlightActive()) applyFilterHighlight();
            });
        }

        // Initial canvas draw and viewport population
        canvasRenderer.scheduleRender(d3.zoomIdentity);
        updateViewport(d3.zoomIdentity);
        if (typeof onEnd === 'function') onEnd();

        return { svg: _svg, g: _g, zoom: zoom };
    }

    function renderTree({ filteredTechs, selectedLayout, selectedSpecies, onEnd }) {
        updateHistoryButtons({ backButton, forwardButton, navigationHistory, historyIndex });
        techCounter.textContent = `Displayed Technologies: ${filteredTechs.length}`;
        // Update category highlighting with current visible techs
        updateFilterHighlightTechs(filteredTechs);
        if (!isTierBasedLayout) {
            lastLayout = selectedLayout;
        }
        // Hide centered button only if nodes are visible
        const centerBtn = document.getElementById('load-tree-center-button');
        if (centerBtn && filteredTechs.length > 0) centerBtn.style.display = 'none';
        // Show "Full Tree" button only when a branch is focused (not on the full tree)
        const toolbarBtn = document.getElementById('load-tree-button');
        if (toolbarBtn) toolbarBtn.style.display = (activeTechId || isTierBasedLayout) ? '' : 'none';
        // Preserve glossary inside #tech-tree; only remove previous SVGs and canvas layers
        techTreeContainer.querySelectorAll(':scope > svg').forEach(el => el.remove());
        techTreeContainer.querySelectorAll('canvas.tech-canvas-layer').forEach(el => el.remove());
        nodes = filteredTechs.map(tech => ({ ...tech }));
        // Build links via data helper
        links = buildLinksFromPrereqs(nodes);

        let res;
        if (isTierBasedLayout) {
            res = renderTierBasedGraph(nodes, links, selectedSpecies, techTreeContainer, {
                tooltipEl: tooltip,
                techTreeContainerEl: techTreeContainer,
                handleNodeSelection,
                updateVisualization,
                activeTechId,
                selectionStartNode,
                selectionEndNode,
                onEnd,
            });
        } else {
            res = dispatchRenderGraph(
                selectedLayout,
                nodes,
                links,
                selectedSpecies,
                techTreeContainer,
                {
                    updateLOD: () => updateLOD(svg, g),
                    drag,
                    tooltipEl: tooltip,
                    techTreeContainerEl: techTreeContainer,
                    handleNodeSelection,
                    updateVisualization,
                    activeTechId,
                    selectionStartNode,
                    selectionEndNode,
                    // layout implementations
                    arrowsLayout,
                    forceLayout,
                    disjointLayout,
                    onEnd,
                }
            );
        }
        if (res && res.svg && res.g) {
            svg = res.svg;
            g = res.g;
            zoom = res.zoom;
            // Expose to window for zoom controls
            window.svg = svg;
            window.zoom = zoom;
            window.triggerZoomToFit = function() {
                if (!svg || !g || !zoom || !nodes || !nodes.length) return;
                var container = document.getElementById('tech-tree');
                var w = container ? container.clientWidth : (svg.node().clientWidth || 800);
                var h = container ? container.clientHeight : (svg.node().clientHeight || 600);
                // Tier layout positions nodes by center; pass node dimensions so the
                // bounding box is expanded to include their full extents at the edges.
                var nw = isTierBasedLayout ? 140 : 0;
                var nh = isTierBasedLayout ? 80 : 0;
                zoomToFit(svg, g, zoom, nodes, w, h, 60, 0.02, 2, nw, nh);
            };
        }
    }


    window.updateVisualization = function(selectedSpecies, highlightId = null, addToHistory = true, zoomOnEndId = null) {
        const toggleLayoutButton = document.getElementById('toggle-layout-button');
        if (highlightId) {
            toggleLayoutButton.style.display = 'inline-block';
            // Only default to tier-based layout if entering a branch from the main view
            if (activeTechId === null) {
                isTierBasedLayout = true;
            }
        } else {
            toggleLayoutButton.style.display = 'none';
            isTierBasedLayout = false; // Always reset when returning to the main tree
        }

        // Ensure UI is visible and data is available before attempting to render
        if (techTreeContainer.classList.contains('hidden')) {
            prepareUI();
        }
        if (!isTechDataLoaded()) {
            loadAndRenderTree();
            return;
        }
        // History-Update: auch null (Hauptbaum) tracken für Zurück/Vor Navigation
        if (addToHistory && highlightId !== activeTechId) {
            if (historyIndex < navigationHistory.length - 1) {
                navigationHistory = navigationHistory.slice(0, historyIndex + 1);
            }
            navigationHistory.push(highlightId); // highlightId kann null (Hauptbaum) oder tech-ID sein
            historyIndex = navigationHistory.length - 1;
        }

        activeTechId = highlightId;
        // Ensure local cache is up-to-date
        allTechs = getAllTechsCached() || allTechs;
        const selectedArea = areaSelect.value;
        const selectedLayout = layoutSelect.value;

        // Update details panel BEFORE clearing focus so the original highlightId is used
        const techSource = getAllTechsCached() || allTechs;
        const tech = highlightId ? techSource.find(t => t.id === highlightId) : null;
        renderTechDetails(tech);

        // Filter and potentially clear focus if disconnected
        const { filteredTechs, clearedFocus } = applyFilters({ selectedSpecies, activeTechId });
        if (clearedFocus) {
            activeTechId = null;
            window.currentFocusId = null;
        }

        // Render tree
        renderTree({ filteredTechs, selectedLayout, selectedSpecies, onEnd: zoomOnEndId ? () => zoomToTech(zoomOnEndId) : null });
    }

    

    

    // --- Main Execution Logic ---
    // NEW Phase 2: Initialize faction dropdown
    initFactionDropdown().then(() => {
        registerFactionEvents();
    }).catch(err => console.error('[Phase 2] Faction initialization failed:', err));

    // Initialize filter highlighting event handlers (for Category AND Unlock)
    const filterHighlightToggle = document.getElementById('filter-highlight-toggle');
    let _filterChangeHandledByHighlight = false; // Flag to prevent double-render

    if (filterHighlightToggle && categorySelect && unlockSelect) {
        // Toggle handler - can be activated at any time
        filterHighlightToggle.addEventListener('change', (e) => {
            const selectedCategory = categorySelect.value;
            const selectedUnlock = unlockSelect.value;

            if (e.target.checked) {
                // Activate highlight mode
                // If any filter is selected, apply highlighting immediately
                const hasCategory = selectedCategory !== 'all';
                const hasUnlock = selectedUnlock !== 'all';

                if (hasCategory || hasUnlock) {
                    setFilterHighlightState(true, selectedCategory, selectedUnlock);
                    window.updateVisualization(speciesSelect.value, null, false);
                } else {
                    // Just mark highlight mode as "ready" - will activate when filter is chosen
                    setFilterHighlightState(true, null, null);
                }
            } else {
                // Clear highlighting and re-render with current filters
                clearFilterHighlight();
                window.updateVisualization(speciesSelect.value, null, false);
            }
        });

        // When category changes while highlight toggle is checked
        categorySelect.addEventListener('change', (e) => {
            if (filterHighlightToggle.checked) {
                const newCategory = e.target.value;
                const currentUnlock = unlockSelect.value;

                // Update highlight state with new category
                setFilterHighlightState(true, newCategory, currentUnlock);

                if (isFilterHighlightActive()) {
                    // Already in highlight mode with techs rendered - just switch CSS classes
                    applyFilterHighlight();
                    _filterChangeHandledByHighlight = true;
                    // No re-render needed!
                } else if (newCategory !== 'all' || currentUnlock !== 'all') {
                    // First filter selection after toggle was enabled - need to render all techs
                    _filterChangeHandledByHighlight = true;
                    window.updateVisualization(speciesSelect.value, null, false);
                } else {
                    // Both filters are "all" - just clear highlighting
                    clearFilterHighlight();
                    _filterChangeHandledByHighlight = true;
                }
            }
        });

        // When unlock changes while highlight toggle is checked
        unlockSelect.addEventListener('change', (e) => {
            if (filterHighlightToggle.checked) {
                const currentCategory = categorySelect.value;
                const newUnlock = e.target.value;

                // Update highlight state with new unlock
                setFilterHighlightState(true, currentCategory, newUnlock);

                if (isFilterHighlightActive()) {
                    // Already in highlight mode with techs rendered - just switch CSS classes
                    applyFilterHighlight();
                    _filterChangeHandledByHighlight = true;
                    // No re-render needed!
                } else if (currentCategory !== 'all' || newUnlock !== 'all') {
                    // First filter selection after toggle was enabled - need to render all techs
                    _filterChangeHandledByHighlight = true;
                    window.updateVisualization(speciesSelect.value, null, false);
                } else {
                    // Both filters are "all" - just clear highlighting
                    clearFilterHighlight();
                    _filterChangeHandledByHighlight = true;
                }
            }
        });
    }

    // Load species filter options at startup
    let filtersLoaded = false;
    loadSpeciesFilter(speciesSelect, {
        onLoaded: () => {
            if (!filtersLoaded) {
                filtersLoaded = true;
                // Load category filter
                loadCategoryFilter(categorySelect, {
                    onLoaded: () => {
                        // Load unlock filter after category
                        loadUnlockFilter(unlockSelect, {
                            onLoaded: () => {
                                const initialState = loadState();
                                applyState(initialState);
                                window._syncLayoutBtnGroup?.();

                                // Helper: update adaptive filter options
                                function refreshAdaptiveFilters() {
                                    const sourceTechs = getAllTechsCached() || allTechs;
                                    updateAdaptiveFilters({
                                        techs: sourceTechs,
                                        categorySelect,
                                        unlockSelect,
                                        currentCategory: categorySelect.value,
                                        currentUnlock: unlockSelect.value
                                    });
                                }

                                // Add event listener for category select after it's populated
                                categorySelect.addEventListener('change', () => {
                                    // Skip if filter highlighting handler already handled this change
                                    if (_filterChangeHandledByHighlight) {
                                        _filterChangeHandledByHighlight = false;
                                        saveState();
                                        refreshAdaptiveFilters();
                                        return;
                                    }
                                    window.updateVisualization(speciesSelect.value, null, false);
                                    saveState();
                                    refreshAdaptiveFilters();
                                });

                                // Add event listener for unlock select after it's populated
                                unlockSelect.addEventListener('change', () => {
                                    // Skip if filter highlighting handler already handled this change
                                    if (_filterChangeHandledByHighlight) {
                                        _filterChangeHandledByHighlight = false;
                                        saveState();
                                        refreshAdaptiveFilters();
                                        return;
                                    }
                                    window.updateVisualization(speciesSelect.value, null, false);
                                    saveState();
                                    refreshAdaptiveFilters();
                                });

                                // Initial adaptive filter setup
                                refreshAdaptiveFilters();
                            }
                        });
                    }
                });
            }
        }
    });
    const urlParams = new URLSearchParams(window.location.search);
    const pathStart = urlParams.get('pathStart');
    const pathEnd = urlParams.get('pathEnd');
    const dependenciesFor = urlParams.get('dependenciesFor');

    if (pathStart && pathEnd) {
        // If path params are present, initialize the tree and then render the path.
        prepareUI();
        loadAndRenderTree();
        // Wait for data to be loaded before calculating the path.
        loadTechnologyData().then(() => {
            allTechs = getAllTechsCached() || allTechs;
            selectionStartNode = pathStart;
            selectionEndNode = pathEnd;
            const popupContainer = document.getElementById('popup-tech-tree');
            const popupViewport = document.getElementById('popup-viewport');
            calculateAndRenderPathController(pathStart, pathEnd, getAllTechsCached() || allTechs, {
                popupViewportEl: popupViewport,
                popupContainerEl: popupContainer,
                tooltipEl: tooltip,
                techTreeContainerEl: techTreeContainer,
                renderPopupGraph,
                getPrerequisitesData,
                calculateAllPaths,
                drag,
            });
        });
    } else if (dependenciesFor) {
        // If dependenciesFor param is present, initialize the tree and then render the dependencies.
        prepareUI();
        loadAndRenderTree();
        loadTechnologyData().then(() => {
            allTechs = getAllTechsCached() || allTechs;
            selectionStartNode = dependenciesFor;
            const popupContainer = document.getElementById('popup-tech-tree');
            const popupViewport = document.getElementById('popup-viewport');
            calculateAndRenderPathController(dependenciesFor, undefined, allTechs, {
                popupViewportEl: popupViewport,
                popupContainerEl: popupContainer,
                tooltipEl: tooltip,
                techTreeContainerEl: techTreeContainer,
                renderPopupGraph,
                getPrerequisitesData,
                calculateAllPaths,
                drag,
            });
        });
    } else if (urlParams.toString().length > 0) {
        // If there are other URL params, load the tree immediately.
        prepareUI();
        loadAndRenderTree();
    } else if (getCookie('landing_seen') === '1') {
        // If the user has previously seen the landing card, skip it.
        prepareUI();
    } else {
        // Otherwise, show the landing card and wait for user interaction.
        treeToolbar.style.display = 'none';
        techTreeContainer.classList.add('hidden');
        landingCard.classList.remove('hidden');
        try { setCookie('landing_seen', '1', 365); } catch (e) {}

        // These listeners will trigger the UI preparation ONCE.
        const initOnce = { once: true };
        showTreeButton.addEventListener('click', prepareUI, initOnce);
        speciesSelect.addEventListener('mousedown', prepareUI, initOnce);
        areaSelect.addEventListener('mousedown', prepareUI, initOnce);
        searchInput.addEventListener('focus', prepareUI, initOnce);
        layoutSelect.addEventListener('mousedown', prepareUI, initOnce);
        document.getElementById('layout-btn-group')?.addEventListener('mousedown', prepareUI, initOnce);
        document.getElementById('start-tier-select')?.addEventListener('input', prepareUI, initOnce);
        document.getElementById('end-tier-select')?.addEventListener('input', prepareUI, initOnce);
        
        // Special handler for the first search click
        const initialSearchHandler = () => {
            prepareUI();
            // The 'real' search handler is now attached, so we can trigger it.
            searchButton.click();
        };
        searchButton.addEventListener('click', initialSearchHandler, initOnce);
    }

    toggleLayoutButton.addEventListener('click', () => {
        isTierBasedLayout = !isTierBasedLayout;
        const layoutToRender = isTierBasedLayout ? 'tier-based' : lastLayout;
        document.getElementById('layout-select').value = lastLayout;
        window._syncLayoutBtnGroup?.();
        updateVisualization(speciesSelect.value, activeTechId, false);
        saveState();
    });

    // Initially hide the toggle button
    document.getElementById('toggle-layout-button').style.display = 'none';

    // Layout segmented button group
    const layoutBtnGroup = document.getElementById('layout-btn-group');
    if (layoutBtnGroup) {
        layoutBtnGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.layout-btn');
            if (!btn) return;
            const newLayout = btn.dataset.layout;
            layoutSelect.value = newLayout;
            // Sync active state
            layoutBtnGroup.querySelectorAll('.layout-btn').forEach(b => b.classList.toggle('active', b === btn));
            // Trigger the same change listener as before
            layoutSelect.dispatchEvent(new Event('change'));
        });
        // Helper to sync active state from layoutSelect value
        window._syncLayoutBtnGroup = () => {
            const val = layoutSelect.value;
            layoutBtnGroup.querySelectorAll('.layout-btn').forEach(b => b.classList.toggle('active', b.dataset.layout === val));
        };
    }

    // Path direction toggle button
    const pathDirectionBtn = document.getElementById('path-direction-btn');
    if (pathDirectionBtn) {
        pathDirectionBtn.addEventListener('click', () => {
            const current = getHighlightDirection();
            const newDir = current === 'prerequisites' ? 'dependents' : 'prerequisites';
            setHighlightDirection(newDir);

            // Update button text and styling
            const svgLeft  = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M8 2L4 6L8 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            const svgRight = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            if (newDir === 'prerequisites') {
                pathDirectionBtn.innerHTML = `${svgLeft} Prereqs`;
                pathDirectionBtn.classList.remove('active-dependents');
            } else {
                pathDirectionBtn.innerHTML = `Dependents ${svgRight}`;
                pathDirectionBtn.classList.add('active-dependents');
            }
        });
    }
});
