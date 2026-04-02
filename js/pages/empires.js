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
    let galaxyMapData = null;   // loaded lazily
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

        // Hide quadrant note / show appropriate filter controls
        document.getElementById('filter-authority-group').classList.toggle('hidden', isMap || activeTab !== 'empires');
        document.getElementById('filter-archetype-group').classList.toggle('hidden', isMap || activeTab !== 'species');

        if (isMap) {
            // Only available for empires tab
            if (activeTab !== 'empires') {
                setView('list');
                return;
            }
            loadGalaxyMap();
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

    async function loadGalaxyMap() {
        if (galaxyMapReady) return;
        mapContainer.innerHTML = '<div class="loading">Loading galaxy map\u2026</div>';
        try {
            if (!galaxyMapData) {
                galaxyMapData = await DataManager.loadJSON('assets/galaxy_map.json');
            }
            mapContainer.innerHTML = '';
            // Enrich galaxy map empire entries with localised names from the full empire list
            if (_empires.length) {
                const nameMap = {};
                for (const e of _empires) nameMap[e.id] = e.name;
                for (const e of galaxyMapData.empires || []) e.name = nameMap[e.id] || e.id;
            }
            GalaxyMap.init(mapContainer, galaxyMapData, (empireId) => {
                // When empire clicked on map, show detail panel using full empire data
                const emp = _empires.find(e => e.id === empireId);
                if (emp && _showDetail) _showDetail(emp);
            });
            galaxyMapReady = true;
        } catch (err) {
            mapContainer.innerHTML = `<div class="loading" style="animation:none">Failed to load galaxy map: ${esc(err.message)}</div>`;
        }
    }

    try {
        const [empires, species] = await Promise.all([
            DataManager.loadJSON('assets/empires.json'),
            DataManager.loadJSON('assets/species.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        for (const item of empires) item.name = I18n.t(item.name_key) || item.id;
        for (const item of species) item.name = I18n.t(item.name_key) || item.id;

        _empires = empires;   // expose to loadGalaxyMap closure

        // Populate authority dropdown
        const authorities = [...new Set(empires.map(e => e.authority).filter(Boolean))].sort();
        const authSel = document.getElementById('filter-authority');
        for (const a of authorities) {
            authSel.add(new Option(a, a));
        }

        // Populate archetype dropdown
        const archetypes = [...new Set(species.map(s => s.archetype).filter(Boolean))].sort();
        const archSel = document.getElementById('filter-archetype');
        for (const a of archetypes) {
            archSel.add(new Option(a, a));
        }

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
                // Map view only makes sense for empires tab
                if (viewToggleGroup) {
                    viewToggleGroup.style.visibility = activeTab === 'empires' ? '' : 'hidden';
                }
                if (activeTab !== 'empires' && activeView === 'map') {
                    setView('list');
                }
                document.getElementById('filter-authority-group').classList.toggle('hidden', activeView === 'map' || activeTab !== 'empires');
                document.getElementById('filter-archetype-group').classList.toggle('hidden', activeView === 'map' || activeTab !== 'species');
                renderAll();
            });
        });

        // Detail panel
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        document.getElementById('detail-close').addEventListener('click', () => {
            detailPanel.classList.add('hidden');
            if (activeView === 'map' && galaxyMapReady) {
                GalaxyMap.deselect();
                GalaxyMap.setLegendVisible(true);
            }
        });

        function showDetail(item) {
            detailTitle.textContent = item.name || item.id;
            let html = `<div class="detail-meta">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Empire-specific (also shown when called from map view)
            const isEmpire = activeTab === 'empires' || activeView === 'map';
            if (isEmpire && item.authority !== undefined) {
                const stats = [];
                if (item.authority) stats.push([I18n.ui('ui.meta.authority'), item.authority]);
                if (item.government) stats.push([I18n.ui('ui.meta.government'), item.government]);
                if (item.origin) stats.push([I18n.ui('ui.meta.origin'), item.origin]);
                if (item.ship_prefix) stats.push([I18n.ui('ui.meta.ship_prefix'), item.ship_prefix]);
                if (item.graphical_culture) stats.push([I18n.ui('ui.meta.culture'), item.graphical_culture]);
                if (item.planet_name) stats.push([I18n.ui('ui.meta.homeworld'), item.planet_name]);
                if (item.planet_class) stats.push([I18n.ui('ui.meta.planet_class'), item.planet_class]);
                if (item.system_name) stats.push([I18n.ui('ui.meta.system'), item.system_name]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.ethics && item.ethics.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.ethics')}</div>`;
                    html += `<div class="detail-meta">${item.ethics.map(e => `<span class="detail-meta-item">${esc(I18n.t(e) || e)}</span>`).join('')}</div></div>`;
                }
                if (item.civics && item.civics.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.civics')}</div>`;
                    html += `<div class="detail-meta">${item.civics.map(c => `<span class="detail-meta-item">${esc(I18n.t(c) || c)}</span>`).join('')}</div></div>`;
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

            detailContent.innerHTML = html;
            SharedRender.initToggles(detailContent);
            detailPanel.classList.remove('hidden');
            if (activeView === 'map' && galaxyMapReady) GalaxyMap.setLegendVisible(false);
        }
        _showDetail = showDetail; // expose to loadGalaxyMap closure

        // Search
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                AppState.set('search', e.target.value);
                currentPage = 1;
                renderAll();
            }, 200);
        });

        // Filter changes
        authSel.addEventListener('change', () => { currentPage = 1; renderAll(); });
        archSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // Language change
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of empires) item.name = I18n.t(item.name_key) || item.id;
            for (const item of species) item.name = I18n.t(item.name_key) || item.id;
            renderAll();
        });

        renderAll();

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'empires' ? empires : species;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'empires') {
                    const auth = authSel.value;
                    if (auth && item.authority !== auth) return false;
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

            let html = '';
            for (const item of pageItems) {
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">`;
                if (item.authority) html += `<span class="detail-meta-item">${esc(item.authority)}</span>`;
                if (item.government) html += `<span class="detail-meta-item">${esc(item.government)}</span>`;
                if (item.archetype) html += `<span class="detail-meta-item">${esc(item.archetype)}</span>`;
                if (item.graphical_culture) html += `<span class="detail-meta-item">${esc(item.graphical_culture)}</span>`;
                if (item.ethics && item.ethics.length) html += `<span class="detail-meta-item">${item.ethics.length} ${I18n.ui('ui.card.ethics')}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';

            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    const item = items.find(i => i.id === id);
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

    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">${I18n.ui('ui.error.load_failed')}: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
