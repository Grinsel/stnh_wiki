/**
 * Traits, Traditions & Ascension Perks page controller.
 */
(async function initTraits() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.traits') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [traits, traditions, perks] = await Promise.all([
            DataManager.loadJSON('assets/traits.json'),
            DataManager.loadJSON('assets/traditions.json'),
            DataManager.loadJSON('assets/ascension_perks.json'),
        ]);
        await I18n.setLanguageForModule(AppState.get('lang'), 'traits');

        for (const item of traits) item.name = I18n.t(item.name_key) || item.id;
        for (const item of traditions) item.name = I18n.t(item.name_key) || item.id;
        for (const item of perks) item.name = I18n.t(item.name_key) || item.id;

        // Populate class dropdown (traits)
        const classes = [...new Set(traits.map(t => t.leader_class).filter(Boolean))].sort();
        const classSel = document.getElementById('filter-class');
        for (const c of classes) classSel.add(new Option(c, c));

        // Populate tree dropdown (traditions)
        const trees = [...new Set(traditions.map(t => t.tree).filter(Boolean))].sort();
        const treeSel = document.getElementById('filter-tree');
        for (const t of trees) treeSel.add(new Option(t, t));

        const ICON_DIRS = { traits: 'traits', traditions: 'traditions', ascension_perks: 'ascension_perks' };

        let activeTab = 'traits';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // ── Tradition tree data structure ──
        // Build Map<treeName, {adopt, finish, nodes[]}>
        const traditionTreeMap = new Map();
        for (const t of traditions) {
            if (!traditionTreeMap.has(t.tree)) {
                traditionTreeMap.set(t.tree, { adopt: null, finish: null, nodes: [] });
            }
            const entry = traditionTreeMap.get(t.tree);
            if (t.role === 'adopt') entry.adopt = t;
            else if (t.role === 'finish') entry.finish = t;
            else entry.nodes.push(t);
        }

        // Pre-compute dependency info for each node
        for (const [, tree] of traditionTreeMap) {
            const nodeIds = new Set(tree.nodes.map(n => n.id));
            for (const node of tree.nodes) {
                node._deps = [];
                if (node.possible) {
                    for (const cond of node.possible) {
                        if (cond.has_tradition && nodeIds.has(cond.has_tradition)) {
                            node._deps.push(cond.has_tradition);
                        }
                    }
                }
            }
        }

        // ── Overlay state ──
        let activeOverlay = null;
        let activeOverlayItemId = null;

        function removeOverlayImmediate() {
            if (activeOverlay) {
                activeOverlay.remove();
                activeOverlay = null;
                activeOverlayItemId = null;
            }
        }

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                removeOverlayImmediate();
                document.getElementById('filter-class-group').classList.toggle('hidden', activeTab !== 'traits');
                document.getElementById('filter-tree-group').classList.toggle('hidden', activeTab !== 'traditions');
                renderAll();
            });
        });

        // Detail panel (for traits/perks)
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        document.getElementById('detail-close').addEventListener('click', () => detailPanel.classList.add('hidden'));

        function showDetail(item) {
            detailTitle.textContent = item.name || item.id;
            const iconDir = ICON_DIRS[activeTab];
            const iconStem = item.icon || item.id;
            const iconHtml = iconDir
                ? `<img class="detail-icon" src="icons/${iconDir}/${esc(iconStem)}.webp" alt="" onerror="this.style.display='none'">`
                : '';
            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.leader_class) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.class')}: ${esc(item.leader_class)}</span>`;
            if (item.rarity) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.rarity')}: ${esc(item.rarity)}</span>`;
            if (item.tier) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.tier')}: ${esc(item.tier)}</span>`;
            if (item.tree) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.tree')}: ${esc(item.tree)}</span>`;
            if (item.role) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.role')}: ${esc(item.role)}</span>`;
            if (item.cost != null) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.cost')}: ${item.cost}</span>`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Desc (from loc)
            const descKey = item.id + '_desc';
            const desc = I18n.t(descKey);
            if (desc && desc !== descKey) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.description')}</div>`;
                html += `<div class="detail-desc">${esc(desc)}</div></div>`;
            }

            if (item.prerequisites && item.prerequisites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
            }

            if (item.opposites && item.opposites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.opposites')}</div>`;
                html += `<div class="detail-meta">${item.opposites.map(o => `<span class="detail-meta-item">${esc(I18n.t(o) || o)}</span>`).join('')}</div></div>`;
            }

            if (item.modifier) {
                html += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            }

            if (item.possible) {
                html += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.requirements'))}</div>`;
            }

            if (item.on_enabled) {
                html += `<div class="detail-section">${SharedRender.dualView(item.on_enabled, I18n.ui('ui.detail.on_enabled'))}</div>`;
            }

            if (item.tradition_swap) {
                html += `<div class="detail-section">${SharedRender.dualView(item.tradition_swap, I18n.ui('ui.detail.tradition_swaps'))}</div>`;
            }

            detailContent.innerHTML = html;
            SharedRender.initToggles(detailContent);
            SharedRender.initTechLinks(detailContent);
            detailPanel.classList.remove('hidden');
        }

        // ── Tradition overlay (relic-style expand/collapse) ──

        function buildTraditionOverlayHtml(item) {
            let html = `<div class="relic-overlay-header">`;
            html += `<button class="relic-detail-back">&larr; ${I18n.ui('ui.search.back')}</button>`;
            html += `<div class="relic-overlay-title">`;
            html += `<img class="relic-overlay-icon" src="icons/traditions/${esc(item.icon || item.id)}.webp" alt="" onerror="this.style.display='none'">`;
            html += `<h3>${esc(item.name || item.id)}</h3>`;
            html += `</div></div>`;

            let leftHtml = '';
            // Description
            const descKey = item.id + '_desc';
            const desc = I18n.t(descKey);
            if (desc && desc !== descKey) {
                leftHtml += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.description')}</div>`;
                leftHtml += `<div class="detail-desc">${esc(desc)}</div></div>`;
            }
            // Modifier
            if (item.modifier) {
                leftHtml += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            }

            let rightHtml = '';
            // Requirements
            if (item.possible) {
                rightHtml += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.requirements'))}</div>`;
            }
            // On enabled
            if (item.on_enabled) {
                rightHtml += `<div class="detail-section">${SharedRender.dualView(item.on_enabled, I18n.ui('ui.detail.on_enabled'))}</div>`;
            }
            // Tradition swaps
            if (item.tradition_swap) {
                rightHtml += `<div class="detail-section">${SharedRender.dualView(item.tradition_swap, I18n.ui('ui.detail.tradition_swaps'))}</div>`;
            }

            html += `<div class="relic-overlay-columns">`;
            if (leftHtml) html += `<div class="relic-overlay-col">${leftHtml}</div>`;
            if (rightHtml) html += `<div class="relic-overlay-col">${rightHtml}</div>`;
            html += `</div>`;

            // Footer
            html += `<div class="relic-overlay-footer">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.tree) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.tree')}: ${esc(item.tree)}</span>`;
            if (item.role) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.role')}: ${esc(item.role)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            return html;
        }

        function expandTraditionOverlay(triggerEl, item) {
            removeOverlayImmediate();

            const block = triggerEl.closest('.tradition-tree-block');
            if (!block) return;

            const blockRect = block.getBoundingClientRect();
            const triggerRect = triggerEl.getBoundingClientRect();

            const startTop = triggerRect.top - blockRect.top;
            const startLeft = triggerRect.left - blockRect.left;
            const startW = triggerRect.width;
            const startH = triggerRect.height;

            const overlay = document.createElement('div');
            overlay.className = 'tradition-detail-overlay';
            overlay.style.top = startTop + 'px';
            overlay.style.left = startLeft + 'px';
            overlay.style.width = startW + 'px';
            overlay.style.height = startH + 'px';

            overlay.innerHTML = `<div class="detail-inner">${buildTraditionOverlayHtml(item)}</div>`;

            block.appendChild(overlay);
            activeOverlay = overlay;
            activeOverlayItemId = item.id;

            // Expand to cover the block
            const targetW = block.offsetWidth;
            const targetH = Math.max(block.scrollHeight, 280);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    overlay.style.top = '0px';
                    overlay.style.left = '0px';
                    overlay.style.width = targetW + 'px';
                    overlay.style.height = targetH + 'px';

                    let expanded = false;
                    const doExpand = () => {
                        if (expanded) return;
                        expanded = true;
                        overlay.removeEventListener('transitionend', onExpand);
                        overlay.classList.add('expanded');
                        const inner = overlay.querySelector('.detail-inner');
                        if (inner) {
                            SharedRender.initToggles(inner);
                            SharedRender.initTechLinks(inner);
                        }
                    };
                    const onExpand = () => doExpand();
                    overlay.addEventListener('transitionend', onExpand);
                    setTimeout(doExpand, 400);
                });
            });

            overlay.querySelector('.relic-detail-back').addEventListener('click', (e) => {
                e.stopPropagation();
                collapseTraditionOverlay(triggerEl);
            });
        }

        function collapseTraditionOverlay(triggerEl) {
            const overlay = activeOverlay;
            if (!overlay) return;

            const block = triggerEl ? triggerEl.closest('.tradition-tree-block') : overlay.parentElement;
            if (!block) { removeOverlayImmediate(); return; }

            overlay.classList.remove('expanded');

            if (triggerEl && document.contains(triggerEl)) {
                const blockRect = block.getBoundingClientRect();
                const triggerRect = triggerEl.getBoundingClientRect();

                overlay.style.top = (triggerRect.top - blockRect.top) + 'px';
                overlay.style.left = (triggerRect.left - blockRect.left) + 'px';
                overlay.style.width = triggerRect.width + 'px';
                overlay.style.height = triggerRect.height + 'px';

                let collapsed = false;
                const doCollapse = () => {
                    if (collapsed) return;
                    collapsed = true;
                    overlay.removeEventListener('transitionend', onCollapse);
                    removeOverlayImmediate();
                };
                const onCollapse = () => doCollapse();
                overlay.addEventListener('transitionend', onCollapse);
                setTimeout(doCollapse, 400);
            } else {
                overlay.style.opacity = '0';
                setTimeout(() => removeOverlayImmediate(), 300);
            }
        }

        // ── Compute tree levels (topological sort) ──
        function computeLevels(nodes) {
            const levels = [];
            const placed = new Set();

            // Iteratively place nodes whose deps are all placed
            let remaining = [...nodes];
            while (remaining.length > 0) {
                const level = [];
                const nextRemaining = [];
                for (const node of remaining) {
                    const allDepsPlaced = node._deps.every(d => placed.has(d));
                    if (allDepsPlaced) {
                        level.push(node);
                    } else {
                        nextRemaining.push(node);
                    }
                }
                if (level.length === 0) {
                    // Cycle or unresolvable deps — dump remaining into current level
                    levels.push(remaining);
                    break;
                }
                levels.push(level);
                for (const n of level) placed.add(n.id);
                remaining = nextRemaining;
            }
            return levels;
        }

        // ── Render tradition trees ──
        function renderTraditionTrees() {
            const query = (AppState.get('search') || '').toLowerCase();
            const filterTree = treeSel.value;

            // Filter trees
            let visibleTrees = [];
            for (const [treeName, tree] of traditionTreeMap) {
                if (filterTree && treeName !== filterTree) continue;
                if (query) {
                    const allItems = [tree.adopt, ...tree.nodes, tree.finish].filter(Boolean);
                    const match = allItems.some(item =>
                        (item.name || '').toLowerCase().includes(query) ||
                        item.id.toLowerCase().includes(query)
                    );
                    if (!match) continue;
                }
                visibleTrees.push([treeName, tree]);
            }

            visibleTrees.sort((a, b) => a[0].localeCompare(b[0]));

            // Stats
            const matchingItems = visibleTrees.reduce((sum, [, t]) => sum + 1 + t.nodes.length + 1, 0);
            document.getElementById('filter-stats').textContent = `${visibleTrees.length} / ${traditionTreeMap.size} Trees (${matchingItems} ${I18n.ui('ui.tab.traditions')})`;

            if (visibleTrees.length === 0) {
                listEl.innerHTML = '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            // SVG arrowhead marker definition (shared, inserted once)
            let html = `<svg style="position:absolute;width:0;height:0;overflow:hidden">
                <defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="var(--accent-dim)"/>
                </marker></defs></svg>`;

            html += '<div class="tradition-trees-grid">';

            for (const [treeName, tree] of visibleTrees) {
                const levels = computeLevels(tree.nodes);

                // Tree name from adopt name: remove trailing " Adoption" or similar
                const treeLabelKey = tree.adopt ? tree.adopt.name_key : treeName;
                let treeLabel = I18n.t(treeLabelKey) || treeName;
                // Strip "_adopt" suffix from loc result if it still looks like a key
                if (treeLabel === treeLabelKey) treeLabel = treeName.replace(/_/g, ' ');

                html += `<div class="tradition-tree-block" data-tree="${esc(treeName)}">`;

                // Header: tree name + adopt button
                html += `<div class="tradition-tree-header">`;
                html += `<span class="tradition-tree-name">${esc(treeLabel)}</span>`;
                if (tree.adopt) {
                    html += `<button class="tradition-bonus-btn" data-id="${esc(tree.adopt.id)}" title="${esc(tree.adopt.name || tree.adopt.id)}">`;
                    html += `<img src="icons/traditions/${esc(tree.adopt.icon || tree.adopt.id)}.webp" alt="" onerror="this.style.display='none'">`;
                    html += `<span>Adopt</span></button>`;
                }
                html += `</div>`;

                // Body: levels with nodes
                html += `<div class="tradition-tree-body">`;

                // Render each level
                for (const level of levels) {
                    html += `<div class="tradition-level">`;
                    for (const node of level) {
                        html += `<div class="tradition-node" data-id="${esc(node.id)}" data-deps="${esc((node._deps || []).join(','))}">`;
                        html += `<img src="icons/traditions/${esc(node.icon || node.id)}.webp" alt="" onerror="this.style.display='none'">`;
                        html += `<span class="tradition-node-name">${esc(node.name || node.id)}</span>`;
                        html += `</div>`;
                    }
                    html += `</div>`;
                }

                // SVG arrows placeholder (drawn after DOM render)
                html += `<svg class="tradition-arrows"></svg>`;
                html += `</div>`;

                // Footer: finish button
                html += `<div class="tradition-tree-footer">`;
                if (tree.finish) {
                    html += `<button class="tradition-bonus-btn tradition-finish-btn" data-id="${esc(tree.finish.id)}" title="${esc(tree.finish.name || tree.finish.id)}">`;
                    html += `<img src="icons/traditions/${esc(tree.finish.icon || tree.finish.id)}.webp" alt="" onerror="this.style.display='none'">`;
                    html += `<span>Finish</span></button>`;
                }
                html += `</div>`;

                html += `</div>`; // .tradition-tree-block
            }

            html += '</div>'; // .tradition-trees-grid
            listEl.innerHTML = html;
            document.getElementById('pagination').innerHTML = '';

            // Draw SVG arrows after DOM is ready
            requestAnimationFrame(() => drawAllArrows());

            // Bind click events for nodes and bonus buttons
            listEl.querySelectorAll('.tradition-node').forEach(nodeEl => {
                nodeEl.addEventListener('click', () => {
                    const item = traditions.find(t => t.id === nodeEl.dataset.id);
                    if (item) expandTraditionOverlay(nodeEl, item);
                });
            });

            listEl.querySelectorAll('.tradition-bonus-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const item = traditions.find(t => t.id === btn.dataset.id);
                    if (item) expandTraditionOverlay(btn, item);
                });
            });
        }

        // ── Draw SVG arrows between dependent nodes ──
        function drawAllArrows() {
            listEl.querySelectorAll('.tradition-tree-block').forEach(block => {
                const svg = block.querySelector('.tradition-arrows');
                if (!svg) return;

                const body = block.querySelector('.tradition-tree-body');
                const bodyRect = body.getBoundingClientRect();

                const nodeEls = block.querySelectorAll('.tradition-node');
                const nodeMap = new Map();
                nodeEls.forEach(el => nodeMap.set(el.dataset.id, el));

                let lines = '';
                nodeEls.forEach(el => {
                    const deps = el.dataset.deps;
                    if (!deps) return;
                    const depIds = deps.split(',').filter(Boolean);
                    const childRect = el.getBoundingClientRect();
                    const cx = childRect.left - bodyRect.left + childRect.width / 2;
                    const cy = childRect.top - bodyRect.top;

                    for (const depId of depIds) {
                        const parentEl = nodeMap.get(depId);
                        if (!parentEl) continue;
                        const parentRect = parentEl.getBoundingClientRect();
                        const px = parentRect.left - bodyRect.left + parentRect.width / 2;
                        const py = parentRect.top - bodyRect.top + parentRect.height;

                        lines += `<line x1="${px}" y1="${py}" x2="${cx}" y2="${cy}"/>`;
                    }
                });

                svg.innerHTML = lines;
                // Size SVG to body
                svg.setAttribute('width', body.offsetWidth);
                svg.setAttribute('height', body.offsetHeight);
            });
        }

        // Search
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                AppState.set('search', e.target.value);
                currentPage = 1;
                removeOverlayImmediate();
                renderAll();
            }, 200);
        });

        classSel.addEventListener('change', () => { currentPage = 1; renderAll(); });
        treeSel.addEventListener('change', () => { currentPage = 1; removeOverlayImmediate(); renderAll(); });

        document.addEventListener('wiki-lang-changed', () => {
            for (const item of traits) item.name = I18n.t(item.name_key) || item.id;
            for (const item of traditions) item.name = I18n.t(item.name_key) || item.id;
            for (const item of perks) item.name = I18n.t(item.name_key) || item.id;
            removeOverlayImmediate();
            renderAll();
        });

        // Tab from URL (before renderAll)
        const urlTab = AppState.get('tab');
        if (urlTab) {
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${urlTab}"]`);
            if (tabBtn) {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                activeTab = urlTab;
                document.getElementById('filter-class-group').classList.toggle('hidden', activeTab !== 'traits');
                document.getElementById('filter-tree-group').classList.toggle('hidden', activeTab !== 'traditions');
            }
        }

        renderAll();
        I18n.loadFullLocalisation();

        // Auto-select item from URL (after renderAll)
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...traits, ...traditions, ...perks];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                if (activeTab === 'traditions') {
                    // Find the node/button element and expand overlay
                    const el = listEl.querySelector(`[data-id="${selectId}"]`);
                    if (el) expandTraditionOverlay(el, item);
                } else {
                    showDetail(item);
                }
                AppState.set('select', '');
            }
        }

        function renderAll() {
            if (activeTab === 'traditions') {
                detailPanel.classList.add('hidden');
                renderTraditionTrees();
                return;
            }

            const query = (AppState.get('search') || '').toLowerCase();
            let items;
            let total;
            if (activeTab === 'traits') {
                items = traits; total = traits.length;
            } else {
                items = perks; total = perks.length;
            }

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'traits') {
                    const cls = classSel.value;
                    if (cls && item.leader_class !== cls) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            let html = '';
            for (const item of pageItems) {
                const iconDir = ICON_DIRS[activeTab];
                const iconStem = item.icon || item.id;
                const iconCol = iconDir
                    ? `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/${iconDir}/${esc(iconStem)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`
                    : '';
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    ${iconCol}
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">`;
                if (item.leader_class) html += `<span class="detail-meta-item">${esc(item.leader_class)}</span>`;
                if (item.rarity) html += `<span class="detail-meta-item">${esc(item.rarity)}</span>`;
                if (item.tree) html += `<span class="detail-meta-item">${esc(item.tree)}</span>`;
                if (item.role && item.role !== 'node') html += `<span class="detail-meta-item">${esc(item.role)}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';

            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    const allItems = activeTab === 'traits' ? traits : perks;
                    const item = allItems.find(i => i.id === card.dataset.id);
                    if (item) showDetail(item);
                });
            });

            renderPagination(totalPages);
        }

        function renderPagination(totalPages) {
            const pagEl = document.getElementById('pagination');
            if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
            let html = '';
            if (currentPage > 1) html += `<button class="page-btn" data-page="${currentPage-1}">&laquo;</button>`;
            for (let p = Math.max(1, currentPage - 3); p <= Math.min(totalPages, currentPage + 3); p++) {
                html += `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
            }
            if (currentPage < totalPages) html += `<button class="page-btn" data-page="${currentPage+1}">&raquo;</button>`;
            pagEl.innerHTML = html;
            pagEl.querySelectorAll('.page-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentPage = parseInt(btn.dataset.page);
                    renderAll();
                    listEl.scrollIntoView({ behavior: 'smooth' });
                });
            });
        }

        // Redraw arrows on resize (debounced)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (activeTab === 'traditions') drawAllArrows();
            }, 150);
        });

    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">${I18n.ui('ui.error.load_failed')}: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
