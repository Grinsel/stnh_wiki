/**
 * Empires & Species page controller.
 */
(async function initEmpires() {
    const listEl    = document.getElementById('item-list');
    const mapContainer = document.getElementById('galaxy-map-container');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.empires') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    // ── View toggle (List / Galaxy Map) ──────────────────────────────────────
    let activeView = 'list';
    let activeTab  = 'empires';  // hoisted so setView() can read it before try-block
    let galaxyMapsData = null;   // all maps, loaded lazily: { maps: [...] }
    let activeMapId  = 'default'; // currently displayed map id
    let galaxyMapReady = false;

    const viewListBtn = document.getElementById('view-list-btn');
    const viewMapBtn  = document.getElementById('view-map-btn');
    const viewToggleGroup = document.getElementById('view-toggle-group');

    function setView(view) {
        activeView = view;
        const isMap = view === 'map';

        viewListBtn.classList.toggle('active', !isMap);
        viewMapBtn.classList.toggle('active', isMap);

        listEl.classList.toggle('hidden', isMap);
        document.getElementById('pagination').classList.toggle('hidden', isMap);
        mapContainer.classList.toggle('hidden', !isMap);
        document.getElementById('item-list-panel').classList.toggle('map-view', isMap);
        document.getElementById('main-content').classList.toggle('map-active', isMap);

        // Hide quadrant note / show appropriate filter controls
        document.getElementById('filter-quadrant-group').classList.toggle('hidden', isMap || activeTab !== 'empires');
        document.getElementById('filter-archetype-group').classList.toggle('hidden', isMap || activeTab !== 'species');

        if (isMap) {
            if (activeTab !== 'empires') {
                setView('list');
                return;
            }
            loadGalaxyMap(activeMapId);
        } else if (galaxyMapReady) {
            GalaxyMap.destroy();
            galaxyMapReady = false;
        }
    }

    if (viewListBtn && viewMapBtn) {
        viewListBtn.addEventListener('click', () => setView('list'));
        viewMapBtn.addEventListener('click',  () => setView('map'));
    }

    // Hoisted empire/species arrays so loadGalaxyMap callback can access them
    let _empires = [], _showDetail = null;

    async function loadGalaxyMap(mapId) {
        galaxyMapReady = false;
        mapContainer.innerHTML = '<div class="loading">Loading galaxy map\u2026</div>';
        try {
            if (!galaxyMapsData) {
                galaxyMapsData = await DataManager.loadJSON('assets/galaxy_maps.json');
            }

            const mapDef = galaxyMapsData.maps.find(m => m.id === (mapId || 'default'))
                        || galaxyMapsData.maps[0];
            if (!mapDef) throw new Error('No map data found');

            // Enrich empire names from the full empire list
            const nameMap = {};
            for (const e of _empires) nameMap[e.id] = e.name;
            const richEmpires = (mapDef.empires || []).map(e => ({ ...e, name: nameMap[e.id] || e.id }));
            const mapData = { empires: richEmpires, bounds: mapDef.bounds };

            mapContainer.innerHTML = '';
            GalaxyMap.init(mapContainer, mapData, (empireId) => {
                const emp = _empires.find(e => e.id === empireId);
                if (emp && _showDetail) _showDetail(emp);
            }, {
                type: mapDef.type,
                era: mapDef.era,
                maps: galaxyMapsData.maps,
                mapId: activeMapId,
                onMapChange: (newId) => {
                    if (newId === activeMapId) return;
                    activeMapId = newId;
                    galaxyMapReady = false;
                    loadGalaxyMap(newId);
                },
            });
            galaxyMapReady = true;
        } catch (err) {
            mapContainer.innerHTML = `<div class="loading" style="animation:none">Failed to load galaxy map: ${esc(err.message)}</div>`;
        }
    }

    try {
        // NOTE: the species tab + all archetype-filter / species-render code
        // below is cold storage. The tab button was removed from empires.html
        // pending a redesign (see commit 2163fab); the data, filters and
        // render paths stay wired up so re-enabling is a one-line HTML add.
        // activeTab === 'species' branches are reachable only via that path.
        const [empires, species, traits] = await Promise.all([
            DataManager.loadJSON('assets/empires.json'),
            DataManager.loadJSON('assets/species.json'),
            DataManager.loadJSON('assets/traits.json'),
        ]);
        await I18n.setLanguageForModule(AppState.get('lang'), 'empires');

        for (const item of empires) item.name = I18n.t(item.name_key) || item.id;
        for (const item of species) item.name = I18n.t(item.name_key) || item.id;
        for (const item of traits) item.name = I18n.t(item.name_key) || item.id;

        _empires = empires;   // expose to loadGalaxyMap closure

        // Quadrant filter state
        let activeQuadrant = '';

        // Helper: extract quadrant key from source_file
        function getQuadrant(empire) {
            const f = empire.source_file || '';
            if (f.includes('alpha'))  return 'alpha';
            if (f.includes('beta'))   return 'beta';
            if (f.includes('gamma'))  return 'gamma';
            if (f.includes('delta'))  return 'delta';
            if (f.includes('major'))  return 'major';
            if (f.includes('alt'))    return 'alt';
            return '';
        }

        // Populate archetype dropdown
        const archetypes = [...new Set(species.map(s => s.archetype).filter(Boolean))].sort();
        const archSel = document.getElementById('filter-archetype');
        for (const a of archetypes) {
            archSel.add(new Option(a, a));
        }

        // Populate leader class dropdown (traits tab)
        const classes = [...new Set(traits.map(t => t.leader_class).filter(Boolean))].sort();
        const classSel = document.getElementById('filter-class');
        if (classSel) { for (const c of classes) classSel.add(new Option(c, c)); }
        if (classSel) classSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // activeTab already declared in outer scope; just reset for safety
        activeTab = 'empires';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Tab switching
        document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                // Map view only makes sense for empires tab — hide toggle on other tabs
                if (viewToggleGroup) viewToggleGroup.classList.toggle('hidden', activeTab !== 'empires');
                if (activeTab !== 'empires' && activeView === 'map') {
                    setView('list');
                }
                document.getElementById('filter-quadrant-group').classList.toggle('hidden', activeView === 'map' || activeTab !== 'empires');
                document.getElementById('filter-archetype-group').classList.toggle('hidden', activeView === 'map' || activeTab !== 'species');
                const classGroup = document.getElementById('filter-class-group');
                if (classGroup) classGroup.classList.toggle('hidden', activeTab !== 'traits');
                SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
                renderAll();
            });
        });

        // Detail panel
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        const viewOnMapBtn = document.getElementById('detail-view-on-map');
        let _currentDetailItem = null;

        viewOnMapBtn.addEventListener('click', () => {
            if (!_currentDetailItem) return;
            setView('map');
            // _B variants share position with their base empire — highlight the base
            const mapId = _currentDetailItem.id.replace(/_B$/, '');
            const doHighlight = () => {
                if (galaxyMapReady) {
                    GalaxyMap.highlight(mapId);
                    GalaxyMap.setLegendVisible(false);
                    showDetail(_currentDetailItem);
                } else {
                    setTimeout(doHighlight, 50);
                }
            };
            doHighlight();
        });

        let _panelLeaveTimer = null;
        function openDetailPanel() {
            clearTimeout(_panelLeaveTimer);
            const wasHidden = detailPanel.classList.contains('hidden');
            detailPanel.classList.remove('hidden', 'detail-leaving');
            if (wasHidden) {
                detailPanel.classList.add('detail-entering');
                void detailPanel.offsetWidth; // force reflow
                detailPanel.classList.remove('detail-entering');
            }
        }
        function closeDetailPanel() {
            clearTimeout(_panelLeaveTimer);
            detailPanel.classList.add('detail-leaving');
            _panelLeaveTimer = setTimeout(() => {
                detailPanel.classList.remove('detail-leaving');
                SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
            }, 340);
        }

        document.getElementById('detail-close').addEventListener('click', () => {
            closeDetailPanel();
            if (activeView === 'map' && galaxyMapReady) {
                GalaxyMap.deselect();
                GalaxyMap.setLegendVisible(true);
                // Start reset zoom simultaneously with the panel-closing CSS flex transition —
                // one combined fluid motion instead of sequential animations.
                GalaxyMap.resetView(true);
            }
        });

        function showDetail(item) {
            SharedRender.hidePlaceholder(detailPanel);
            detailTitle.textContent = item.name || item.id;
            const iconDir = activeTab === 'traits' ? 'traits' : (item.authority !== undefined ? 'flags' : '');
            const iconStem = item.icon || item.id;
            const iconHtml = iconDir
                ? `<img class="detail-icon" src="icons/${iconDir}/${esc(iconStem)}.webp" alt="" onerror="this.style.display='none'">`
                : '';
            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Empire bio / description
            const isEmpire = activeTab === 'empires' || activeView === 'map';
            if (isEmpire && item.name_key) {
                const bio = I18n.tMultiline(item.name_key + '_desc');
                if (bio) {
                    const bioHtml = esc(bio).replace(/\n/g, '<br>');
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.description')}</div>`;
                    html += `<div class="detail-bio">${bioHtml}</div></div>`;
                }
            }

            // Empire-specific (also shown when called from map view)
            if (isEmpire && item.authority !== undefined) {
                const stats = [];
                if (item.authority) stats.push([I18n.ui('ui.meta.authority'), SharedRender.wikiLink(item.authority, 'authority', I18n.t(item.authority) || item.authority)]);
                if (item.government) stats.push([I18n.ui('ui.meta.government'), SharedRender.wikiLink(item.government, 'government', I18n.t(item.government) || item.government)]);
                if (item.origin) stats.push([I18n.ui('ui.meta.origin'), SharedRender.wikiLink(item.origin, 'civic', I18n.t(item.origin) || item.origin)]);
                if (item.ship_prefix) stats.push([I18n.ui('ui.meta.ship_prefix'), esc(item.ship_prefix)]);
                if (item.graphical_culture) stats.push([I18n.ui('ui.meta.culture'), esc(item.graphical_culture)]);
                if (item.planet_name) stats.push([I18n.ui('ui.meta.homeworld'), esc(item.planet_name)]);
                if (item.planet_class) stats.push([I18n.ui('ui.meta.planet_class'), esc(item.planet_class)]);
                if (item.system_name) stats.push([I18n.ui('ui.meta.system'), esc(item.system_name)]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${v}</span>`).join('')}</div></div>`;
                }
                if (item.ethics && item.ethics.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.ethics')}</div>`;
                    html += `<div class="detail-meta">${item.ethics.map(e => `<span class="detail-meta-item">${esc(I18n.t(e) || e)}</span>`).join('')}</div></div>`;
                }
                if (item.civics && item.civics.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.civics')}</div>`;
                    html += `<div class="detail-meta">${item.civics.map(c => SharedRender.wikiLink(c, 'civic', I18n.t(c) || c)).join('')}</div></div>`;
                }
                if (item.species) {
                    html += `<div class="detail-section">${SharedRender.dualView(item.species, I18n.ui('ui.detail.species'))}</div>`;
                }
                if (item.ruler) {
                    html += `<div class="detail-section">${SharedRender.dualView(item.ruler, I18n.ui('ui.detail.ruler'))}</div>`;
                }
            }

            // Species-specific
            if (activeTab === 'species') {
                const stats = [];
                if (item.archetype) stats.push([I18n.ui('ui.meta.archetype'), item.archetype]);
                if (item.graphical_culture) stats.push([I18n.ui('ui.meta.culture'), item.graphical_culture]);
                if (item.uplifted_into) stats.push([I18n.ui('ui.meta.uplifted_into'), item.uplifted_into]);
                if (item.gender != null) stats.push([I18n.ui('ui.meta.gender'), item.gender]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.portraits && item.portraits.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.portraits')}</div>`;
                    html += `<div class="detail-meta">${item.portraits.map(p => `<span class="detail-meta-item">${esc(p)}</span>`).join('')}</div></div>`;
                }
            }

            // Leader Traits-specific
            if (activeTab === 'traits') {
                if (item.name_key) {
                    const desc = I18n.tMultiline(item.name_key + '_desc');
                    if (desc) {
                        html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.description')}</div>`;
                        html += `<div class="detail-bio">${esc(desc).replace(/\n/g, '<br>')}</div></div>`;
                    }
                }
                const tStats = [];
                if (item.leader_class) tStats.push(['Class', item.leader_class]);
                if (item.rarity) tStats.push(['Rarity', item.rarity]);
                if (item.tier != null) tStats.push(['Tier', item.tier]);
                if (item.cost != null) tStats.push(['Cost', item.cost]);
                if (tStats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
                    html += `<div class="detail-meta">${tStats.map(([k,v]) => `<span class="detail-meta-item">${esc(k)}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.modifier) html += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifier'))}</div>`;
                if (item.possible) html += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.conditions'))}</div>`;
            }

            detailContent.innerHTML = html;
            SharedRender.initToggles(detailContent);
            SharedRender.initWikiLinks(detailContent);
            _currentDetailItem = item;
            // Show "View on map" only for empires in list view
            viewOnMapBtn.classList.toggle('hidden', activeView === 'map' || activeTab !== 'empires' || item.authority === undefined);
            openDetailPanel();
            if (activeView === 'map' && galaxyMapReady) GalaxyMap.setLegendVisible(false);
        }
        _showDetail = showDetail; // expose to loadGalaxyMap closure

        // Search
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            // Typing in search always switches to list view — map has no search
            if (activeView === 'map') setView('list');
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                AppState.set('search', e.target.value);
                currentPage = 1;
                renderAll();
            }, 200);
        });

        // Quadrant ribbon buttons
        document.querySelectorAll('.quadrant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quadrant-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeQuadrant = btn.dataset.quadrant;
                currentPage = 1;
                renderAll();
            });
        });

        // Filter changes
        archSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // Language change
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of empires) item.name = I18n.t(item.name_key) || item.id;
            for (const item of species) item.name = I18n.t(item.name_key) || item.id;
            for (const item of traits) item.name = I18n.t(item.name_key) || item.id;
            renderAll();
            if (galaxyMapReady) GalaxyMap.refreshOverlay();
        });

        // Tab from URL (before renderAll)
        const urlTab = AppState.get('tab');
        if (urlTab) {
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${urlTab}"]`);
            if (tabBtn) {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                activeTab = urlTab;
                document.getElementById('filter-quadrant-group').classList.toggle('hidden', activeTab !== 'empires');
                document.getElementById('filter-archetype-group').classList.toggle('hidden', activeTab !== 'species');
                const classGroup2 = document.getElementById('filter-class-group');
                if (classGroup2) classGroup2.classList.toggle('hidden', activeTab !== 'traits');
                if (viewToggleGroup) viewToggleGroup.classList.toggle('hidden', activeTab !== 'empires');
            }
        }

        renderAll();
        SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
        I18n.loadFullLocalisation();

        // Auto-select item from URL (after renderAll)
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...empires, ...species, ...traits];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                showDetail(item);
                AppState.set('select', '');
            }
        }

        function renderAll() {
            if (activeTab === 'traits') { renderTraitsList(); return; }
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'empires' ? empires : species;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'empires') {
                    if (activeQuadrant && getQuadrant(item) !== activeQuadrant) return false;
                } else {
                    const arch = archSel.value;
                    if (arch && item.archetype !== arch) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            const total = activeTab === 'empires' ? empires.length : species.length;
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            const QUADRANT_LABELS = { alpha: 'α Alpha', beta: 'β Beta', gamma: 'γ Gamma', delta: 'δ Delta', major: '★ Major', alt: '◈ Alt' };
            let html = '';
            for (const item of pageItems) {
                const iconCol = (activeTab === 'empires' && item.icon)
                    ? `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/flags/${esc(item.icon)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`
                    : '';
                const q = (activeTab === 'empires') ? getQuadrant(item) : '';
                const qBadge = q ? `<span class="quadrant-badge q-${q}">${QUADRANT_LABELS[q] || q}</span>` : '';
                html += `<div class="item-card q-border-${q || 'none'}" data-id="${esc(item.id)}">
                    ${iconCol}
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">
                            ${qBadge}`;
                if (item.authority) html += `<span class="detail-meta-item">${esc(item.authority)}</span>`;
                if (item.government) html += `<span class="detail-meta-item">${esc(item.government)}</span>`;
                if (item.archetype) html += `<span class="detail-meta-item">${esc(item.archetype)}</span>`;
                if (item.ethics && item.ethics.length) html += `<span class="detail-meta-item">${item.ethics.length} ${I18n.ui('ui.card.ethics')}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';

            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    listEl.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const id = card.dataset.id;
                    const item = items.find(i => i.id === id);
                    if (item) showDetail(item);
                });
            });

            renderPagination(totalPages);
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

        function renderTraitsList() {
            const query = (AppState.get('search') || '').toLowerCase();
            const cls = (document.getElementById('filter-class') || {}).value || '';
            let items = traits.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (cls && item.leader_class !== cls) return false;
                return true;
            });
            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
            document.getElementById('filter-stats').textContent = `${items.length} / ${traits.length}`;
            const totalPages = Math.ceil(items.length / PAGE_SIZE) || 1;
            if (currentPage > totalPages) currentPage = 1;
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
            let html = '';
            for (const item of pageItems) {
                html += `<div class="item-card" data-id="${esc(item.id)}">` +
                    `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/traits/${esc(item.icon || item.id)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>` +
                    `<div class="item-card-body"><div class="item-card-header">` +
                    `<span class="item-card-name">${esc(item.name || item.id)}</span>` +
                    `<span class="item-card-id">${esc(item.id)}</span>` +
                    `</div><div class="item-card-meta">` +
                    (item.leader_class ? `<span class="detail-meta-item">${esc(item.leader_class)}</span>` : '') +
                    (item.rarity ? `<span class="detail-meta-item">${esc(item.rarity)}</span>` : '') +
                    `</div></div></div>`;
            }
            listEl.innerHTML = html || `<div class="loading" style="animation:none">${I18n.ui('ui.empty.no_items')}</div>`;
            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    listEl.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const found = traits.find(t => t.id === card.dataset.id);
                    if (found) showDetail(found);
                });
            });
            renderPagination(totalPages);
        }

    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">${I18n.ui('ui.error.load_failed')}: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
