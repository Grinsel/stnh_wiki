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
        const [buildings, districts, jobs, deposits, megastructures, relics] = await Promise.all([
            DataManager.loadJSON('assets/buildings.json'),
            DataManager.loadJSON('assets/districts.json'),
            DataManager.loadJSON('assets/jobs.json'),
            DataManager.loadJSON('assets/deposits.json'),
            DataManager.loadJSON('assets/megastructures.json'),
            DataManager.loadJSON('assets/relics.json'),
        ]);
        await I18n.setLanguageForModule(AppState.get('lang'), 'buildings');
        await Promise.all([
            I18n.mergeModule(AppState.get('lang'), 'economy'),
            I18n.mergeModule(AppState.get('lang'), 'megastructures'),
        ]);

        for (const item of buildings)     item.name = I18n.t(item.name_key) || item.id;
        for (const item of districts)     item.name = I18n.t(item.name_key) || item.id;
        for (const item of jobs)          item.name = I18n.t(item.name_key) || item.id;
        for (const item of deposits)      item.name = I18n.t(item.name_key) || item.id;
        for (const item of megastructures) item.name = I18n.t(item.name_key) || item.id;
        for (const item of relics)        item.name = I18n.t(item.name_key) || item.id;

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

        function updateFilterVis() {
            chipsEl.classList.toggle('hidden', activeTab !== 'buildings');
            catGroupEl.classList.toggle('hidden', activeTab !== 'jobs' && activeTab !== 'deposits');
        }

        // ── Tab switching ────────────────────────────────────────────────────
        document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
                removeOverlayImmediate();
                detailPanel.classList.add('hidden');
                updateFilterVis();
                populateCategories();
                renderAll();
            });
        });

        // ── Detail panel ─────────────────────────────────────────────────────
        const detailPanel   = document.getElementById('detail-panel');
        const detailTitle   = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        document.getElementById('detail-close').addEventListener('click', () => {
            if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
            detailPanel.classList.add('hidden');
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

        // ── Detail HTML builder ──────────────────────────────────────────────
        function buildItemDetailHtml(item) {
            const isBuilding = activeTab === 'buildings';
            const isJob      = activeTab === 'jobs';
            const isDeposit  = activeTab === 'deposits';
            const isMega     = activeTab === 'megastructures';
            const isRelic    = activeTab === 'relics';

            let iconHtml = '';
            if (isBuilding && item.icon_key)    iconHtml = `<img class="detail-icon" src="icons/buildings/${esc(item.icon_key)}.webp"   alt="" onerror="this.style.display='none'">`;
            else if (isJob     && item.icon)     iconHtml = `<img class="detail-icon" src="icons/jobs/${esc(item.icon)}.webp"            alt="" onerror="this.style.display='none'">`;
            else if (isDeposit && item.icon)     iconHtml = `<img class="detail-icon" src="icons/deposits/${esc(item.icon)}.webp"        alt="" onerror="this.style.display='none'">`;
            else if (isRelic)                    iconHtml = `<img class="detail-icon" src="icons/relics/${esc(item.icon || item.id)}.webp" alt="" onerror="this.style.display='none'">`;

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
                    html += `<div class="detail-meta">${item.upgrades.map(u => `<span class="detail-meta-item">${esc(I18n.t(u) || u)}</span>`).join('')}</div></div>`;
                }
            }

            // ── Megastructures ──
            if (isMega) {
                const stats = [];
                if (item.build_time)    stats.push([I18n.ui('ui.meta.build_time'),    item.build_time]);
                if (item.entity)        stats.push([I18n.ui('ui.meta.entity'),         item.entity]);
                if (item.upgrade_from)  stats.push([I18n.ui('ui.meta.upgrade_from'),  item.upgrade_from]);
                if (item.sensor_range)  stats.push([I18n.ui('ui.meta.sensor_range'),  item.sensor_range]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
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
        function showDetail(item) {
            if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
            detailTitle.textContent      = item.name || item.id;
            detailContent.innerHTML      = buildItemDetailHtml(item);
            SharedRender.initToggles(detailContent);
            SharedRender.initTechLinks(detailContent);
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
                currentPage = 1;
                removeOverlayImmediate();
                renderAll();
            }, 200);
        });

        catSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // ── Language change ──────────────────────────────────────────────────
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of buildings)      item.name = I18n.t(item.name_key) || item.id;
            for (const item of districts)      item.name = I18n.t(item.name_key) || item.id;
            for (const item of jobs)           item.name = I18n.t(item.name_key) || item.id;
            for (const item of deposits)       item.name = I18n.t(item.name_key) || item.id;
            for (const item of megastructures) item.name = I18n.t(item.name_key) || item.id;
            for (const item of relics)         item.name = I18n.t(item.name_key) || item.id;
            for (const cat of buildingCategories) cat.label = getCategoryLabel(cat.value);
            categoryChips.rebuildAll(buildingCategories, I18n.ui('ui.filter.all_categories'));
            populateCategories();
            removeOverlayImmediate();
            renderAll();
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
            }
        }

        renderAll();
        I18n.loadFullLocalisation();

        // ── Auto-select item from URL ────────────────────────────────────────
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...buildings, ...districts, ...jobs, ...deposits, ...megastructures, ...relics];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                showDetail(item);
                AppState.set('select', '');
            }
        }

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
                default:               items = buildings;      total = buildings.length;
            }

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'buildings') {
                    const cat = categoryChips.getActive();
                    if (cat && item.category !== cat) return false;
                }
                if (activeTab === 'jobs' || activeTab === 'deposits') {
                    const cat = catSel.value;
                    if (cat && item.category !== cat) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

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
                    else if (activeTab === 'jobs'      && item.icon)     iconCol = `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/jobs/${esc(item.icon)}.webp"            alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`;
                    else if (activeTab === 'deposits'  && item.icon)     iconCol = `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/deposits/${esc(item.icon)}.webp"        alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`;

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
                    }

                    html += `</div></div></div>`;
                }
                listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';
                listEl.querySelectorAll('.item-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const item = items.find(i => i.id === card.dataset.id);
                        if (item) showDetail(item);
                    });
                });
            }

            renderPagination(totalPages);
        }

        function renderPagination(totalPages) {
            const pagEl = document.getElementById('pagination');
            if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
            let html = '';
            if (currentPage > 1) html += `<button class="page-btn" data-page="${currentPage - 1}">&laquo;</button>`;
            for (let p = Math.max(1, currentPage - 3); p <= Math.min(totalPages, currentPage + 3); p++) {
                html += `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
            }
            if (currentPage < totalPages) html += `<button class="page-btn" data-page="${currentPage + 1}">&raquo;</button>`;
            pagEl.innerHTML = html;
            pagEl.querySelectorAll('.page-btn').forEach(btn => {
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
