/**
 * Economy hub page controller.
 * Combines: Buildings, Districts, Jobs, Resources (Deposits), Megastructures, Relics.
 */
(async function initEconomyHub() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.buildings') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    function getCategoryLabel(key) {
        const map = {
            amenity:       'ui.bld_cat.amenity',
            army:          'ui.bld_cat.army',
            government:    'ui.bld_cat.government',
            manufacturing: 'ui.bld_cat.manufacturing',
            pop_assembly:  'ui.bld_cat.pop_assembly',
            research:      'ui.bld_cat.research',
            resource:      'ui.bld_cat.resource',
            trade:         'ui.bld_cat.trade',
            unity:         'ui.bld_cat.unity',
        };
        return map[key] ? I18n.ui(map[key]) : key;
    }

    try {
        // ── Load all data in parallel ────────────────────────────────────────
        const [buildings, districts, jobs, deposits, megastructures, relics,
               resources, resourceIndex] = await Promise.all([
            DataManager.loadJSON('assets/buildings.json'),
            DataManager.loadJSON('assets/districts.json'),
            DataManager.loadJSON('assets/jobs.json'),
            DataManager.loadJSON('assets/deposits.json'),
            DataManager.loadJSON('assets/megastructures.json'),
            DataManager.loadJSON('assets/relics.json'),
            DataManager.loadJSON('assets/resources.json'),
            DataManager.loadJSON('assets/resource_producers.json'),
        ]);

        // Which deposit icons actually exist as .webp on disk? Items whose
        // referenced icon is missing get the d_asteroid_cavern fallback and
        // are sorted below items with a real icon (see renderAll).
        let depositIconSet = null;
        try {
            const stems = await DataManager.loadJSON('icons/deposits/_index.json');
            if (Array.isArray(stems)) depositIconSet = new Set(stems);
        } catch (e) { /* index missing -> treat all as having icons, no re-sort */ }
        await I18n.setLanguageForModule(AppState.get('lang'), 'buildings');
        await Promise.all([
            I18n.mergeModule(AppState.get('lang'), 'economy'),
            I18n.mergeModule(AppState.get('lang'), 'megastructures'),
            // Resources detail-pane links to producers from goverments-side
            // modules (traditions, perks, civics, edicts, …) — merge those
            // loc strings so the producer names render localized.
            I18n.mergeModule(AppState.get('lang'), 'governments'),
        ]);

        for (const item of buildings)     item.name = I18n.t(item.name_key) || item.id;
        for (const item of districts)     item.name = I18n.t(item.name_key) || item.id;
        for (const item of jobs)          item.name = I18n.t(item.name_key) || item.id;
        for (const item of deposits)      item.name = I18n.t(item.name_key) || item.id;
        for (const item of megastructures) item.name = I18n.t(item.name_key) || item.id;
        for (const item of relics)        item.name = I18n.t(item.name_key) || item.id;
        for (const item of resources)     item.name = I18n.t(item.name_key) || item.id;

        // ── Tab state (declared early so all closures can reference it) ──────
        let activeTab = 'buildings';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // ── Buildings: Category Chips ────────────────────────────────────────
        const catCounts = {};
        for (const b of buildings) {
            if (b.category) catCounts[b.category] = (catCounts[b.category] || 0) + 1;
        }
        const buildingCategories = Object.keys(catCounts).sort().map(v => ({
            value: v,
            label: getCategoryLabel(v),
            count: catCounts[v],
        }));
        const categoryChips = CategoryChips.create({
            container: document.getElementById('filter-category-chips'),
            categories: buildingCategories,
            allLabel: I18n.ui('ui.filter.all_categories'),
            onChange: () => { currentPage = 1; renderAll(); },
        });

        // ── Jobs / Deposits: Category Dropdown ──────────────────────────────
        const jobCats = [...new Set(jobs.map(j => j.category).filter(Boolean))].sort();
        const depCats = [...new Set(deposits.map(d => d.category).filter(Boolean))].sort();
        const catSel  = document.getElementById('filter-category');

        function populateCategories() {
            if (activeTab !== 'jobs' && activeTab !== 'deposits') return;
            const cats = activeTab === 'jobs' ? jobCats : depCats;
            catSel.innerHTML = '<option value="">' + I18n.ui('ui.filter.all_categories') + '</option>';
            for (const c of cats) catSel.add(new Option(c, c));
        }

        // ── Filter visibility ────────────────────────────────────────────────
        const chipsEl    = document.getElementById('filter-category-chips');
        const catGroupEl = document.getElementById('filter-category-group');
        const showUnusedGroupEl = document.getElementById('filter-show-unused-group');
        const showUnusedEl = document.getElementById('filter-show-unused');
        if (showUnusedEl) {
            showUnusedEl.addEventListener('change', (e) => {
                showUnusedResources = e.target.checked;
                currentPage = 1;
                renderAll();
            });
        }

        function updateFilterVis() {
            chipsEl.classList.toggle('hidden', activeTab !== 'buildings' && activeTab !== 'resources');
            catGroupEl.classList.toggle('hidden', activeTab !== 'jobs' && activeTab !== 'deposits');
            if (showUnusedGroupEl) showUnusedGroupEl.classList.toggle('hidden', activeTab !== 'resources' && activeTab !== 'megastructures');
        }

        // ── Resources: source/category filter chips (basic / advanced / strategic / stnh) ──
        // Two top-level groupings: economic (the resources every empire deals
        // with day-to-day) and strategic (rare specialised resources, mostly
        // sr_* ids). The old fine-grained Basic/Advanced/Strategic/STNH split
        // had too many overlapping categories.
        const resourceCategories = [
            { value: 'economic',  label: 'Economic',  count: 0 },
            { value: 'strategic', label: 'Strategic', count: 0 },
        ];
        const ECONOMIC_RES = new Set([
            'energy', 'minerals', 'food',
            'alloys', 'consumer_goods', 'unity', 'influence', 'trade',
            'physics_research', 'society_research', 'engineering_research',
        ]);
        function resCategoryOf(r) {
            if (ECONOMIC_RES.has(r.id)) return 'economic';
            return 'strategic';
        }
        for (const r of resources) {
            const cat = resCategoryOf(r);
            const entry = resourceCategories.find(c => c.value === cat);
            if (entry) entry.count++;
        }

        // Resources with empty producers/consumers/modifiers are hidden from
        // the Resources tab by default. The allowlist keeps a few genuine mod
        // resources visible whose only references are in cost blocks,
        // scripted_effects rewards, or AI hints — none of which the index
        // currently captures.
        const RESOURCE_FORCED_VISIBLE = new Set([
            'sr_living_metal',
            'sr_dark_matter',
            'sr_new_horizons',
        ]);
        // Resources that DO have index entries but only because vanilla-only
        // modifiers spill over — they're not actually used in the mod and
        // should stay hidden until the mod-side modifier hits are cleaned up.
        const RESOURCE_FORCED_HIDDEN = new Set([
            'astral_threads',
            'rare_crystals',
        ]);
        function resourceIsUsed(item) {
            if (RESOURCE_FORCED_HIDDEN.has(item.id)) return false;
            if (RESOURCE_FORCED_VISIBLE.has(item.id)) return true;
            const e = (resourceIndex && resourceIndex.by_resource) ? resourceIndex.by_resource[item.id] : null;
            if (!e) return false;
            return (e.producers && e.producers.length > 0)
                || (e.consumers && e.consumers.length > 0)
                || (e.modifiers && e.modifiers.length > 0);
        }

        // Megastructures: hide vanilla-defined ones (dyson sphere, gateways,
        // mega shipyard, behemoth egg, etc.). STNH source files are prefixed
        // STH_ — anything else came from vanilla and is filtered out by
        // default. Same Show-unused toggle as resources reveals them.
        function megaIsStnh(item) {
            const sf = item.source_file || '';
            return sf.startsWith('STH_');
        }

        let showUnusedResources = false;

        // ── Tab switching ────────────────────────────────────────────────────
        function syncCategoryChipsToTab() {
            if (activeTab === 'resources') {
                categoryChips.rebuildAll(resourceCategories, I18n.ui('ui.filter.all_categories'));
            } else {
                categoryChips.rebuildAll(buildingCategories, I18n.ui('ui.filter.all_categories'));
            }
        }

        document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
                removeOverlayImmediate();
                currentDetailItem = null;
                clearActiveSearch();
                SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
                updateFilterVis();
                populateCategories();
                syncCategoryChipsToTab();
                renderAll();
            });
        });

        function clearActiveSearch() {
            if (AppState.get('search')) {
                AppState.set('search', '');
                if (searchInput) searchInput.value = '';
            }
            if (AppState.get('from')) {
                AppState.set('from', '');
            }
            updateActiveSearchBanner();
        }

        const activeSearchBanner = document.getElementById('active-search-banner');
        const activeSearchQueryEl = document.getElementById('active-search-query');
        const activeSearchClearBtn = document.getElementById('active-search-clear');

        function updateActiveSearchBanner() {
            if (!activeSearchBanner) return;
            const query = AppState.get('search');
            const fromSearch = AppState.get('from') === 'search';
            if (query && fromSearch) {
                if (activeSearchQueryEl) activeSearchQueryEl.textContent = '"' + query + '"';
                activeSearchBanner.classList.remove('hidden');
            } else {
                activeSearchBanner.classList.add('hidden');
            }
        }

        if (activeSearchClearBtn) {
            activeSearchClearBtn.addEventListener('click', () => {
                clearActiveSearch();
                renderAll();
            });
        }

        // ── Detail panel ─────────────────────────────────────────────────────
        const detailPanel   = document.getElementById('detail-panel');
        const detailTitle   = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        document.getElementById('detail-close').addEventListener('click', () => {
            if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
            currentDetailItem = null;
            SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
        });

        // ── Relic overlay state ──────────────────────────────────────────────
        let activeOverlay      = null;
        let activeOverlayTileId = null;

        function removeOverlayImmediate() {
            if (activeOverlay) {
                activeOverlay.remove();
                activeOverlay = null;
                activeOverlayTileId = null;
            }
        }

        function buildRelicOverlayHtml(item) {
            let html = `<div class="relic-overlay-header">`;
            html += `<button class="relic-detail-back">&larr; ${I18n.ui('ui.search.back')}</button>`;
            html += `<div class="relic-overlay-title">`;
            html += `<img class="relic-overlay-icon" src="icons/relics/${esc(item.icon || item.id)}.webp" alt="" onerror="this.style.display='none'">`;
            html += `<h3>${esc(item.name || item.id)}</h3>`;
            html += `</div></div>`;

            let leftHtml = '';
            const stats = [];
            if (item.activation_duration) stats.push([I18n.ui('ui.meta.activation_duration'), item.activation_duration]);
            if (item.score) stats.push([I18n.ui('ui.meta.score'), item.score]);
            if (stats.length) {
                leftHtml += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                leftHtml += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
            }
            if (item.resources) leftHtml += `<div class="detail-section">${SharedRender.dualView(item.resources, I18n.ui('ui.detail.resources'))}</div>`;
            if (item.modifier)  leftHtml += `<div class="detail-section">${SharedRender.dualView(item.modifier,  I18n.ui('ui.detail.modifiers'))}</div>`;

            let rightHtml = '';
            if (item.active_effect)    rightHtml += `<div class="detail-section">${SharedRender.dualView(item.active_effect,    I18n.ui('ui.detail.active_effect'))}</div>`;
            if (item.possible)         rightHtml += `<div class="detail-section">${SharedRender.dualView(item.possible,         I18n.ui('ui.detail.possible'))}</div>`;
            if (item.on_build_complete) rightHtml += `<div class="detail-section">${SharedRender.dualView(item.on_build_complete, I18n.ui('ui.detail.on_build_complete'))}</div>`;

            html += `<div class="relic-overlay-columns">`;
            if (leftHtml)  html += `<div class="relic-overlay-col">${leftHtml}</div>`;
            if (rightHtml) html += `<div class="relic-overlay-col">${rightHtml}</div>`;
            html += `</div>`;

            html += `<div class="relic-overlay-footer">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            return html;
        }

        function expandRelicOverlay(tileEl, item) {
            removeOverlayImmediate();

            const grid     = tileEl.closest('.relic-grid');
            if (!grid) return;

            const gridRect = grid.getBoundingClientRect();
            const tileRect = tileEl.getBoundingClientRect();
            const startTop  = tileRect.top  - gridRect.top  + grid.scrollTop;
            const startLeft = tileRect.left - gridRect.left;
            const startW    = tileRect.width;
            const startH    = tileRect.height;

            const overlay = document.createElement('div');
            overlay.className = 'relic-detail-overlay';
            overlay.style.top    = startTop  + 'px';
            overlay.style.left   = startLeft + 'px';
            overlay.style.width  = startW    + 'px';
            overlay.style.height = startH    + 'px';

            overlay.innerHTML = `<div class="detail-inner">${buildRelicOverlayHtml(item)}</div>`;
            grid.appendChild(overlay);
            activeOverlay      = overlay;
            activeOverlayTileId = item.id;

            const gridW = grid.offsetWidth;
            const gridH = Math.max(grid.scrollHeight, 300);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    overlay.style.top    = '0px';
                    overlay.style.left   = '0px';
                    overlay.style.width  = gridW + 'px';
                    overlay.style.height = gridH + 'px';

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
                            SharedRender.initWikiLinks(inner);
                        }
                    };
                    const onExpand = () => doExpand();
                    overlay.addEventListener('transitionend', onExpand);
                    setTimeout(doExpand, 400);
                });
            });

            overlay.querySelector('.relic-detail-back').addEventListener('click', (e) => {
                e.stopPropagation();
                collapseRelicOverlay(tileEl);
            });
        }

        function collapseRelicOverlay(tileEl) {
            const overlay = activeOverlay;
            if (!overlay) return;

            const grid = tileEl ? tileEl.closest('.relic-grid') : overlay.parentElement;
            if (!grid) { removeOverlayImmediate(); return; }

            overlay.classList.remove('expanded');

            if (tileEl && document.contains(tileEl)) {
                const gridRect  = grid.getBoundingClientRect();
                const tileRect  = tileEl.getBoundingClientRect();
                const targetTop  = tileRect.top  - gridRect.top  + grid.scrollTop;
                const targetLeft = tileRect.left - gridRect.left;

                overlay.style.top    = targetTop  + 'px';
                overlay.style.left   = targetLeft + 'px';
                overlay.style.width  = tileRect.width  + 'px';
                overlay.style.height = tileRect.height + 'px';

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

        // ── Resource producer/modifier sections ──────────────────────────────
        const PRODUCER_LABELS = {
            buildings:       'Buildings',
            districts:       'Districts',
            jobs:            'Jobs',
            deposits:        'Deposits',
            megastructures:  'Megastructures',
            relics:          'Relics',
            edicts:          'Edicts',
            traditions:      'Traditions',
            ascension_perks: 'Ascension Perks',
            governments:     'Governments',
            civics:          'Civics',
            authorities:     'Authorities',
        };
        // Module name in by_resource entries -> link kind in WIKI_LINK_MAP
        const MODULE_TO_LINK_KIND = {
            buildings: 'building', districts: 'district', jobs: 'job',
            deposits: 'deposit', megastructures: 'megastructure', relics: 'relic',
            edicts: 'edict', traditions: 'tradition', ascension_perks: 'ascension_perk',
            governments: 'government', civics: 'civic', authorities: 'authority',
        };

        function fmtProduceVal(val) { return `+${val}`; }
        function fmtUpkeepVal(val)  { return `-${val}`; }
        function fmtModifierValue(mod) {
            const sign = mod.value >= 0 ? '+' : '';
            const suffix = mod.op === 'mult' ? '%' : '';
            const val = mod.op === 'mult' ? Math.round(mod.value * 100) : mod.value;
            return `${sign}${val}${suffix}`;
        }

        function buildResourceProducerSections(resourceId) {
            const entry = (resourceIndex && resourceIndex.by_resource) ? resourceIndex.by_resource[resourceId] : null;
            if (!entry) return '';

            let html = '';

            // Group producers by module (direct producers — produces blocks only)
            if (entry.producers && entry.producers.length) {
                const grouped = {};
                for (const p of entry.producers) {
                    if (!grouped[p.module]) grouped[p.module] = [];
                    grouped[p.module].push(p);
                }

                html += `<div class="detail-section"><div class="detail-section-title">${esc(I18n.ui('ui.resource.producers'))} (${entry.producers.length})</div>`;
                for (const moduleKey of Object.keys(PRODUCER_LABELS)) {
                    const list = grouped[moduleKey];
                    if (!list || !list.length) continue;
                    html += `<div class="resource-producer-group">`;
                    html += `<div class="resource-producer-group-label">${esc(PRODUCER_LABELS[moduleKey])} (${list.length})</div>`;
                    html += `<div class="detail-meta">`;
                    for (const p of list) {
                        const linkKind = MODULE_TO_LINK_KIND[p.module] || p.module;
                        const name = I18n.t(p.id) || p.id;
                        const valStr = fmtProduceVal(p.flat);
                        html += `<span class="detail-meta-item">${SharedRender.wikiLink(p.id, linkKind, name)} <span class="resource-producer-value">${esc(valStr)}</span></span>`;
                    }
                    html += `</div></div>`;
                }
                html += `</div>`;
            }

            // Consumers — items that have this resource in their `upkeep` block
            if (entry.consumers && entry.consumers.length) {
                const grouped = {};
                for (const c of entry.consumers) {
                    if (!grouped[c.module]) grouped[c.module] = [];
                    grouped[c.module].push(c);
                }

                html += `<div class="detail-section"><div class="detail-section-title">${esc(I18n.ui('ui.resource.consumers'))} (${entry.consumers.length})</div>`;
                for (const moduleKey of Object.keys(PRODUCER_LABELS)) {
                    const list = grouped[moduleKey];
                    if (!list || !list.length) continue;
                    html += `<div class="resource-producer-group">`;
                    html += `<div class="resource-producer-group-label">${esc(PRODUCER_LABELS[moduleKey])} (${list.length})</div>`;
                    html += `<div class="detail-meta">`;
                    for (const c of list) {
                        const linkKind = MODULE_TO_LINK_KIND[c.module] || c.module;
                        const name = I18n.t(c.id) || c.id;
                        const valStr = fmtUpkeepVal(c.flat);
                        html += `<span class="detail-meta-item">${SharedRender.wikiLink(c.id, linkKind, name)} <span class="resource-consumer-value">${esc(valStr)}</span></span>`;
                    }
                    html += `</div></div>`;
                }
                html += `</div>`;
            }

            // Modifiers (boosts/penalties)
            if (entry.modifiers && entry.modifiers.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${esc(I18n.ui('ui.resource.modifiers'))} (${entry.modifiers.length})</div>`;
                html += `<div class="detail-meta-list">`;
                // Sort: produces add > produces mult > upkeep, big values first
                const mods = entry.modifiers.slice().sort((a, b) => {
                    if (a.axis !== b.axis) return a.axis === 'produces' ? -1 : 1;
                    if (a.op !== b.op) return a.op === 'add' ? -1 : 1;
                    return Math.abs(b.value) - Math.abs(a.value);
                });
                for (const m of mods) {
                    const linkKind = MODULE_TO_LINK_KIND[m.owner_module] || m.owner_module;
                    const ownerName = I18n.t(m.owner_id) || m.owner_id;
                    const ownerLink = SharedRender.wikiLink(m.owner_id, linkKind, ownerName);
                    const valStr = fmtModifierValue(m);
                    const axisLabel = m.axis === 'produces'
                        ? I18n.ui('ui.resource.axis_output')
                        : (m.axis === 'upkeep'
                            ? I18n.ui('ui.resource.axis_upkeep')
                            : I18n.ui('ui.resource.axis_cost'));
                    html += `<div class="resource-modifier-row">`;
                    html += `<span class="resource-modifier-value">${esc(valStr)} ${esc(axisLabel)}</span> `;
                    html += `from ${ownerLink}`;
                    html += ` <span class="resource-modifier-name" title="${esc(m.name)}">(${esc(m.name)})</span>`;
                    html += `</div>`;
                }
                html += `</div></div>`;
            }

            return html;
        }

        // ── Detail HTML builder ──────────────────────────────────────────────
        function buildItemDetailHtml(item) {
            const isBuilding = activeTab === 'buildings';
            const isJob      = activeTab === 'jobs';
            const isDeposit  = activeTab === 'deposits';
            const isDistrict = activeTab === 'districts';
            const isMega     = activeTab === 'megastructures';
            const isRelic    = activeTab === 'relics';
            const isResource = activeTab === 'resources';

            let iconHtml = '';
            if (isBuilding && item.icon_key)    iconHtml = `<img class="detail-icon" src="icons/buildings/${esc(item.icon_key)}.webp"   alt="" onerror="this.style.display='none'">`;
            else if (isDistrict)                 iconHtml = `<img class="detail-icon" src="icons/districts/${esc(item.id)}.webp"          alt="" onerror="this.style.display='none'">`;
            else if (isJob     && item.icon)     iconHtml = `<img class="detail-icon" src="icons/jobs/${esc(item.icon)}.webp"            alt="" onerror="this.style.display='none'">`;
            else if (isDeposit) {
                const stem = item.icon || 'd_asteroid_cavern';
                iconHtml = `<img class="detail-icon" src="icons/deposits/${esc(stem)}.webp" alt="" onerror="this.onerror=null;this.src='icons/deposits/d_asteroid_cavern.webp'">`;
            }
            else if (isRelic)                    iconHtml = `<img class="detail-icon" src="icons/relics/${esc(item.icon || item.id)}.webp" alt="" onerror="this.style.display='none'">`;
            else if (isResource && item.icon)    iconHtml = `<img class="detail-icon" src="icons/resources/${esc(item.icon)}.webp"      alt="" onerror="this.style.display='none'">`;

            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.category)      html += `<span class="detail-meta-item">${I18n.ui('ui.meta.category')}: ${esc(isBuilding ? getCategoryLabel(item.category) : item.category)}</span>`;
            if (item.base_buildtime) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.build_time')}: ${item.base_buildtime}</span>`;
            if (item.capital)        html += `<span class="detail-meta-item">${I18n.ui('ui.badge.capital')}</span>`;
            if (item.source_file)    html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // ── Buildings ──
            if (isBuilding) {
                if (item.prerequisites && item.prerequisites.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                    html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
                }
                if (item.upgrades && item.upgrades.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.upgrades_to')}</div>`;
                    html += `<div class="detail-meta">${item.upgrades.map(u => SharedRender.wikiLink(u, 'building', I18n.t(u) || u)).join('')}</div></div>`;
                }
            }

            // ── Megastructures ──
            if (isMega) {
                const stats = [];
                if (item.build_time)    stats.push([I18n.ui('ui.meta.build_time'),    esc(item.build_time)]);
                if (item.entity)        stats.push([I18n.ui('ui.meta.entity'),         esc(item.entity)]);
                if (item.upgrade_from)  stats.push([I18n.ui('ui.meta.upgrade_from'),  SharedRender.wikiLink(item.upgrade_from, 'megastructure', I18n.t(item.upgrade_from) || item.upgrade_from)]);
                if (item.sensor_range)  stats.push([I18n.ui('ui.meta.sensor_range'),  esc(item.sensor_range)]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${v}</span>`).join('')}</div></div>`;
                }
                if (item.prerequisites && item.prerequisites.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                    html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
                }
            }

            // ── Relics ──
            if (isRelic) {
                const stats = [];
                if (item.activation_duration) stats.push([I18n.ui('ui.meta.activation_duration'), item.activation_duration]);
                if (item.score)               stats.push([I18n.ui('ui.meta.score'),               item.score]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
            }

            // ── Jobs ──
            if (isJob) {
                const stats = [];
                if (item.building_icon)         stats.push([I18n.ui('ui.meta.building_icon'),      item.building_icon]);
                if (item.condition)             stats.push([I18n.ui('ui.meta.condition'),           item.condition]);
                if (item.is_capped_by_modifier) stats.push([I18n.ui('ui.meta.capped_by_modifier'), I18n.ui('ui.misc.yes')]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
            }

            // ── Deposits ──
            if (isDeposit) {
                const stats = [];
                if (item.is_null)          stats.push([I18n.ui('ui.meta.null_deposit'),    I18n.ui('ui.misc.yes')]);
                if (item.is_for_colonizable) stats.push([I18n.ui('ui.meta.for_colonizable'), I18n.ui('ui.misc.yes')]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
            }

            // ── Resources ──
            if (isResource) {
                const stats = [];
                if (item.source)        stats.push([I18n.ui('ui.meta.category'), item.source === 'stnh' ? 'STNH' : 'Vanilla']);
                stats.push([I18n.ui('ui.resource.tradable'), item.tradable ? I18n.ui('ui.misc.yes') : I18n.ui('ui.misc.no')]);
                if (item.market_price)  stats.push([I18n.ui('ui.resource.market_price'),  item.market_price]);
                if (item.market_amount) stats.push([I18n.ui('ui.resource.market_supply'), item.market_amount]);
                if (item.max)           stats.push([I18n.ui('ui.resource.max_stockpile'), item.max]);
                if (item.ai_weight != null) stats.push([I18n.ui('ui.resource.ai_weight'), item.ai_weight]);
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
                html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${esc(k)}: ${esc(v)}</span>`).join('')}</div></div>`;

                // Description
                const desc = I18n.t(item.desc_key);
                if (desc && desc !== item.desc_key) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.description') || 'Description'}</div>`;
                    html += `<div class="detail-text">${esc(desc)}</div></div>`;
                }

                // Prerequisites
                if (item.prerequisites && item.prerequisites.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                    html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
                }

                // Producers + Modifiers from resource_producers.json
                html += buildResourceProducerSections(item.id);
            }

            // ── Shared sections ──
            if (item.resources)          html += `<div class="detail-section">${SharedRender.dualView(item.resources,     I18n.ui('ui.detail.resources'))}</div>`;
            if (item.modifier)           html += `<div class="detail-section">${SharedRender.dualView(item.modifier,      I18n.ui('ui.detail.modifiers'))}</div>`;
            if (item.potential)          html += `<div class="detail-section">${SharedRender.dualView(item.potential,     I18n.ui('ui.detail.potential'))}</div>`;
            if ((isJob || isMega || isRelic) && item.possible)
                                         html += `<div class="detail-section">${SharedRender.dualView(item.possible,      I18n.ui('ui.detail.possible'))}</div>`;
            if (isJob     && item.weight)    html += `<div class="detail-section">${SharedRender.dualView(item.weight,       I18n.ui('ui.detail.weight'))}</div>`;
            if (isDeposit && item.drop_weight) html += `<div class="detail-section">${SharedRender.dualView(item.drop_weight, I18n.ui('ui.detail.drop_weight'))}</div>`;
            if (isDeposit && item.weight)    html += `<div class="detail-section">${SharedRender.dualView(item.weight,       I18n.ui('ui.detail.weight'))}</div>`;
            if ((isMega || isRelic) && item.active_effect)
                                         html += `<div class="detail-section">${SharedRender.dualView(item.active_effect,  I18n.ui('ui.detail.active_effect'))}</div>`;
            if (item.on_build_complete)  html += `<div class="detail-section">${SharedRender.dualView(item.on_build_complete, I18n.ui('ui.detail.on_build_complete'))}</div>`;

            // ── 3D Model viewer (megastructures only) ──
            if (isMega && item.has_model && item.model_factions && item.model_factions.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.3d_model')}</div>`;
                if (item.model_factions.length > 1) {
                    html += `<select class="ship-faction-select" id="model-faction-select">`;
                    for (const f of item.model_factions) html += `<option value="${esc(f)}">${esc(f)}</option>`;
                    html += `</select>`;
                }
                html += `<div class="ship-viewer-container"><div class="ship-viewer-placeholder" id="ship-viewer-area">`;
                html += `<button class="ship-viewer-load-btn" id="load-3d-btn">${I18n.ui('ui.action.view_3d')}</button>`;
                html += `</div></div></div>`;
            }

            return html;
        }

        // ── showDetail ───────────────────────────────────────────────────────
        let currentDetailItem = null;
        function showDetail(item) {
            currentDetailItem = item;
            if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
            SharedRender.hidePlaceholder(detailPanel);
            detailTitle.textContent      = item.name || item.id;
            detailContent.innerHTML      = buildItemDetailHtml(item);
            SharedRender.initToggles(detailContent);
            SharedRender.initTechLinks(detailContent);
            SharedRender.initWikiLinks(detailContent);
            detailPanel.classList.remove('hidden');

            // Wire up 3D model button for megastructures
            if (activeTab === 'megastructures' && item.has_model && item.model_factions && item.model_factions.length) {
                const loadBtn       = detailContent.querySelector('#load-3d-btn');
                const viewerArea    = detailContent.querySelector('#ship-viewer-area');
                const factionSelect = detailContent.querySelector('#model-faction-select');
                function getModelPath() {
                    const faction = factionSelect ? factionSelect.value : item.model_factions[0];
                    return `models/megastructures/${item.id}/${faction}.glb?v=${window.WIKI_BUILD_VERSION || '1'}`;
                }
                if (loadBtn)       loadBtn.addEventListener('click',    () => ShipViewer.createViewer(viewerArea, getModelPath()));
                if (factionSelect) factionSelect.addEventListener('change', () => ShipViewer.createViewer(viewerArea, getModelPath()));
            }
        }

        // ── Search ───────────────────────────────────────────────────────────
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                AppState.set('search', e.target.value);
                if (AppState.get('from')) AppState.set('from', '');
                updateActiveSearchBanner();
                currentPage = 1;
                removeOverlayImmediate();
                renderAll();
            }, 200);
        });

        catSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // ── Language change ──────────────────────────────────────────────────
        // common.js' lang-select handler only re-loads the page's primary
        // module ('buildings'). The economy hub additionally pulls the
        // economy / megastructures / governments modules — those need to be
        // re-merged for the new language before any name lookup runs.
        // After the re-render, also rebuild the currently-open detail pane
        // so its content tracks the language switch (otherwise the user has
        // to re-click the item to see translated names).
        document.addEventListener('wiki-lang-changed', async () => {
            const lang = AppState.get('lang');
            await Promise.all([
                I18n.mergeModule(lang, 'economy'),
                I18n.mergeModule(lang, 'megastructures'),
                I18n.mergeModule(lang, 'governments'),
            ]);
            for (const item of buildings)      item.name = I18n.t(item.name_key) || item.id;
            for (const item of districts)      item.name = I18n.t(item.name_key) || item.id;
            for (const item of jobs)           item.name = I18n.t(item.name_key) || item.id;
            for (const item of deposits)       item.name = I18n.t(item.name_key) || item.id;
            for (const item of megastructures) item.name = I18n.t(item.name_key) || item.id;
            for (const item of relics)         item.name = I18n.t(item.name_key) || item.id;
            for (const item of resources)      item.name = I18n.t(item.name_key) || item.id;
            for (const cat of buildingCategories) cat.label = getCategoryLabel(cat.value);
            syncCategoryChipsToTab();
            populateCategories();
            removeOverlayImmediate();
            renderAll();
            if (currentDetailItem) showDetail(currentDetailItem);
        });

        // ── Restore tab from URL ─────────────────────────────────────────────
        const urlTab = AppState.get('tab');
        if (urlTab) {
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${urlTab}"]`);
            if (tabBtn) {
                document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                activeTab = urlTab;
                updateFilterVis();
                populateCategories();
                syncCategoryChipsToTab();
            }
        }

        renderAll();
        SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
        I18n.loadFullLocalisation();

        // ── Auto-select item from URL ────────────────────────────────────────
        const selectId = AppState.get('select');
        if (selectId) {
            // Direct-select navigation (e.g. dropdown click, cross-link): drop
            // any stale search filter so the list isn't accidentally narrowed.
            if (AppState.get('search')) {
                AppState.set('search', '');
                if (searchInput) searchInput.value = '';
                renderAll();
            }
            const allItems = [...buildings, ...districts, ...jobs, ...deposits, ...megastructures, ...relics, ...resources];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                showDetail(item);
                AppState.set('select', '');
            }
        }

        updateActiveSearchBanner();

        // ── renderAll ────────────────────────────────────────────────────────
        function renderAll() {
            removeOverlayImmediate();
            const query = (AppState.get('search') || '').toLowerCase();

            let items, total;
            switch (activeTab) {
                case 'buildings':      items = buildings;      total = buildings.length;      break;
                case 'districts':      items = districts;      total = districts.length;      break;
                case 'jobs':           items = jobs;           total = jobs.length;           break;
                case 'deposits':       items = deposits;       total = deposits.length;       break;
                case 'megastructures': items = megastructures; total = megastructures.length; break;
                case 'relics':         items = relics;         total = relics.length;         break;
                case 'resources':      items = resources;      total = resources.length;      break;
                default:               items = buildings;      total = buildings.length;
            }

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'buildings') {
                    const cat = categoryChips.getActive();
                    if (cat && item.category !== cat) return false;
                }
                if (activeTab === 'resources') {
                    if (!showUnusedResources && !resourceIsUsed(item)) return false;
                    const cat = categoryChips.getActive();
                    if (cat && resCategoryOf(item) !== cat) return false;
                }
                if (activeTab === 'megastructures') {
                    if (!showUnusedResources && !megaIsStnh(item)) return false;
                }
                if (activeTab === 'jobs' || activeTab === 'deposits') {
                    const cat = catSel.value;
                    if (cat && item.category !== cat) return false;
                }
                return true;
            });

            items.sort((a, b) => {
                // Deposits whose icon file is missing use a generic fallback
                // (d_asteroid_cavern) — group those after items with a real
                // icon, regardless of alphabetical order.
                if (activeTab === 'deposits' && depositIconSet) {
                    const ai = (a.icon && depositIconSet.has(a.icon)) ? 0 : 1;
                    const bi = (b.icon && depositIconSet.has(b.icon)) ? 0 : 1;
                    if (ai !== bi) return ai - bi;
                }
                return (a.name || a.id).localeCompare(b.name || b.id);
            });

            document.getElementById('filter-stats').textContent =
                `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems  = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            if (activeTab === 'relics') {
                // ── Relic grid ──
                if (pageItems.length === 0) {
                    listEl.innerHTML = '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';
                } else {
                    let html = '<div class="relic-grid">';
                    for (const item of pageItems) {
                        html += `<div class="relic-tile" data-id="${esc(item.id)}">
                            <img src="icons/relics/${esc(item.icon || item.id)}.webp" alt="" onerror="this.style.display='none'">
                            <span class="relic-tile-name">${esc(item.name || item.id)}</span>
                        </div>`;
                    }
                    html += '</div>';
                    listEl.innerHTML = html;
                }
                listEl.querySelectorAll('.relic-tile').forEach(tile => {
                    tile.addEventListener('click', () => {
                        const id   = tile.dataset.id;
                        const item = items.find(i => i.id === id);
                        if (item) expandRelicOverlay(tile, item);
                    });
                });
            } else {
                // ── Standard item card list ──
                let html = '';
                for (const item of pageItems) {
                    let iconCol = '';
                    if      (activeTab === 'buildings' && item.icon_key) iconCol = `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/buildings/${esc(item.icon_key)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`;
                    else if (activeTab === 'districts')                  iconCol = `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/districts/${esc(item.id)}.webp"             alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`;
                    else if (activeTab === 'jobs'      && item.icon)     iconCol = `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/jobs/${esc(item.icon)}.webp"            alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`;
                    else if (activeTab === 'deposits') {
                        const stem = item.icon || 'd_asteroid_cavern';
                        iconCol = `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/deposits/${esc(stem)}.webp" alt="" onerror="this.onerror=null;this.src='icons/deposits/d_asteroid_cavern.webp'"></div>`;
                    }
                    else if (activeTab === 'resources' && item.icon)     iconCol = `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/resources/${esc(item.icon)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`;

                    html += `<div class="item-card" data-id="${esc(item.id)}">
                        ${iconCol}
                        <div class="item-card-body">
                            <div class="item-card-header">
                                <span class="item-card-name">${esc(item.name || item.id)}</span>
                                <span class="item-card-id">${esc(item.id)}</span>
                            </div>
                            <div class="item-card-meta">`;

                    if (activeTab === 'buildings') {
                        if (item.category) html += `<span class="detail-meta-item">${esc(getCategoryLabel(item.category))}</span>`;
                        if (item.base_buildtime) html += `<span class="detail-meta-item">${I18n.ui('ui.card.build')}: ${item.base_buildtime}</span>`;
                        if (item.prerequisites && item.prerequisites.length) html += `<span class="detail-meta-item">${I18n.ui('ui.card.tech')}: ${item.prerequisites.length}</span>`;
                    } else if (activeTab === 'jobs' || activeTab === 'deposits') {
                        if (item.category)       html += `<span class="detail-meta-item">${esc(item.category)}</span>`;
                        if (item.building_icon)  html += `<span class="detail-meta-item">${esc(item.building_icon)}</span>`;
                        if (item.is_for_colonizable) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.colonizable')}</span>`;
                    } else if (activeTab === 'megastructures') {
                        if (item.has_model)   html += `<span class="detail-meta-item">&#9670; 3D</span>`;
                        if (item.build_time)  html += `<span class="detail-meta-item">${I18n.ui('ui.card.build')}: ${item.build_time}</span>`;
                        if (item.prerequisites && item.prerequisites.length) html += `<span class="detail-meta-item">${I18n.ui('ui.card.tech')}: ${item.prerequisites.length}</span>`;
                    } else if (activeTab === 'resources') {
                        const entry = (resourceIndex && resourceIndex.by_resource) ? resourceIndex.by_resource[item.id] : null;
                        const prodCount = entry && entry.producers ? entry.producers.length : 0;
                        const consCount = entry && entry.consumers ? entry.consumers.length : 0;
                        const modCount  = entry && entry.modifiers ? entry.modifiers.length : 0;
                        html += `<span class="detail-meta-item">${esc(resCategoryOf(item))}</span>`;
                        if (item.tradable)    html += `<span class="detail-meta-item">tradable</span>`;
                        if (prodCount)        html += `<span class="detail-meta-item">${prodCount} producers</span>`;
                        if (consCount)        html += `<span class="detail-meta-item">${consCount} consumers</span>`;
                        if (modCount)         html += `<span class="detail-meta-item">${modCount} modifiers</span>`;
                    }

                    html += `</div></div></div>`;
                }
                listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';
                listEl.querySelectorAll('.item-card').forEach(card => {
                    card.addEventListener('click', () => {
                        listEl.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
                        card.classList.add('active');
                        const item = items.find(i => i.id === card.dataset.id);
                        if (item) showDetail(item);
                    });
                });
            }

            scheduleGlobalFallback(query, items.length);
            renderPagination(totalPages);
        }

        // Schedule a 3s deferred global-search fallback: if the current tab
        // has zero matches for an active query, populate the empty list with
        // hits from other modules. Re-running renderAll cancels any pending
        // timer so the fallback only fires when the user has actually
        // stopped typing.
        // (uses `var` so the binding is hoisted — `renderAll` is called
        //  during init before this source line is reached.)
        var globalFallbackTimer = null;
        function scheduleGlobalFallback(query, localCount) {
            if (globalFallbackTimer) {
                clearTimeout(globalFallbackTimer);
                globalFallbackTimer = null;
            }
            const q = (query || '').trim();
            if (!q || q.length < 2 || localCount > 0) return;
            globalFallbackTimer = setTimeout(() => {
                globalFallbackTimer = null;
                // Re-check current state: if user typed more or results appeared, bail.
                const currentQ = (AppState.get('search') || '').trim().toLowerCase();
                if (currentQ !== q) return;
                if (typeof GlobalSearch === 'undefined' || !GlobalSearch.renderHitsHtml) return;
                const hitsHtml = GlobalSearch.renderHitsHtml(q, 5);
                if (!hitsHtml) return;
                const hint = I18n.ui('ui.search.no_local_global_hits');
                listEl.innerHTML =
                    '<div class="global-fallback-hint">' + hint + '</div>' +
                    '<div class="global-fallback-results">' + hitsHtml + '</div>';
            }, 3000);
        }

        function renderPagination(totalPages) {
            const pagEl = document.getElementById('pagination');
            if (totalPages <= 1) { pagEl.innerHTML = ''; pagEl.classList.remove('pagination-sticky', 'hide-at-top'); return; }
            const firstDis = currentPage <= 1;
            const lastDis = currentPage >= totalPages;
            let html = '';
            html += `<button class="page-btn${firstDis ? ' disabled' : ''}" data-page="1"${firstDis ? ' disabled' : ''}>&laquo;&laquo;</button>`;
            html += `<button class="page-btn${firstDis ? ' disabled' : ''}" data-page="${Math.max(1, currentPage - 1)}"${firstDis ? ' disabled' : ''}>&laquo;</button>`;
            for (let p = Math.max(1, currentPage - 3); p <= Math.min(totalPages, currentPage + 3); p++) {
                html += `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
            }
            html += `<button class="page-btn${lastDis ? ' disabled' : ''}" data-page="${Math.min(totalPages, currentPage + 1)}"${lastDis ? ' disabled' : ''}>&raquo;</button>`;
            html += `<button class="page-btn${lastDis ? ' disabled' : ''}" data-page="${totalPages}"${lastDis ? ' disabled' : ''}>&raquo;&raquo;</button>`;
            pagEl.innerHTML = html;
            pagEl.classList.add('pagination-sticky');
            pagEl.classList.toggle('hide-at-top', currentPage === 1);
            pagEl.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentPage = parseInt(btn.dataset.page);
                    renderAll();
                    listEl.scrollIntoView({ behavior: 'smooth' });
                });
            });
        }

    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">${I18n.ui('ui.error.load_failed')}: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
})();
