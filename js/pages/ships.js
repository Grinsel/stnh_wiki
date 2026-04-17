/**
 * Ships & Components page controller.
 */
(async function initShips() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.ships') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');
    const showNoModelCheckbox = document.getElementById('show-no-model');

    // Human-readable labels for ship class keys
    function getClassLabel(key) {
        const map = {
            shipclass_military:           'ui.ship_class.military',
            shipclass_starbase:           'ui.ship_class.starbase',
            shipclass_science_ship:       'ui.ship_class.science',
            shipclass_colonizer:          'ui.ship_class.colonizer',
            shipclass_constructor:        'ui.ship_class.constructor',
            shipclass_transport:          'ui.ship_class.transport',
            shipclass_mining_station:     'ui.ship_class.mining_station',
            shipclass_research_station:   'ui.ship_class.research_station',
            shipclass_observation_station:'ui.ship_class.observation_station',
            shipclass_military_station:   'ui.ship_class.military_station',
        };
        return map[key] ? I18n.ui(map[key]) : key;
    }

    function getComptypeLabel(key) {
        const map = {
            weapon:       'ui.comp_type.weapon',
            utility:      'ui.comp_type.utility',
            strike_craft: 'ui.comp_type.strike_craft',
        };
        return map[key] ? I18n.ui(map[key]) : key;
    }

    function getSizeLabel(key) {
        const map = {
            small:         'ui.comp_size.small',
            medium:        'ui.comp_size.medium',
            large:         'ui.comp_size.large',
            extra_large:   'ui.comp_size.extra_large',
            titanic:       'ui.comp_size.titanic',
            torpedo:       'ui.comp_size.torpedo',
            point_defence: 'ui.comp_size.point_defence',
            aux:           'ui.comp_size.aux',
            planet_killer: 'ui.comp_size.planet_killer',
        };
        return map[key] ? I18n.ui(map[key]) : key;
    }

    try {
        const [shipsData, components] = await Promise.all([
            DataManager.loadJSON('assets/ships.json'),
            DataManager.loadJSON('assets/components.json'),
        ]);
        const ships = shipsData.items;
        const globalStats = shipsData.stats;
        await I18n.setLanguageForModule(AppState.get('lang'), 'ships');

        // Resolve names
        for (const item of ships) {
            let resolved = I18n.t(item.name_key);
            if (resolved === item.name_key) resolved = I18n.t(item.id);
            item.name = (resolved !== item.id && resolved !== item.name_key) ? resolved : item.id;
        }
        for (const item of components) {
            let resolved = I18n.t(item.name_key);
            if (!resolved || resolved === item.name_key) resolved = I18n.t(item.id);
            item.name = resolved || item.id;
        }

        // State
        let activeTab = 'ships';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // --- Build class chip counts ---
        function classCountMap() {
            const m = {};
            for (const s of ships) { if (s.class) m[s.class] = (m[s.class] || 0) + 1; }
            return m;
        }
        function comptypeCountMap() {
            const m = {};
            for (const c of components) { if (c.type) m[c.type] = (m[c.type] || 0) + 1; }
            return m;
        }

        // Build size count map optionally filtered by a component type
        function sizeCountMap(filterType) {
            const m = {};
            for (const c of components) {
                if (filterType && c.type !== filterType) continue;
                const s = c.size ? c.size.toLowerCase() : null;
                if (s) m[s] = (m[s] || 0) + 1;
            }
            return m;
        }

        // Build size category list from a count map
        function sizeCategoriesFromCounts(counts) {
            return Object.keys(counts).sort().map(v => ({
                value: v,
                label: getSizeLabel(v),
                count: counts[v],
            }));
        }

        const classCounts = classCountMap();
        const comptypeCounts = comptypeCountMap();

        const classCategories = Object.keys(classCounts).sort().map(v => ({
            value: v,
            label: getClassLabel(v),
            count: classCounts[v],
        }));
        const comptypeCategories = ['weapon', 'utility', 'strike_craft']
            .filter(v => comptypeCounts[v])
            .map(v => ({ value: v, label: getComptypeLabel(v), count: comptypeCounts[v] }));

        // --- Init chip bars ---
        const classChips = CategoryChips.create({
            container: document.getElementById('filter-class-chips'),
            categories: classCategories,
            allLabel: I18n.ui('ui.filter.all_classes'),
            onChange: () => { currentPage = 1; renderAll(); },
        });

        showNoModelCheckbox.addEventListener('change', () => { currentPage = 1; renderAll(); });

        const sizeChips = CategoryChips.create({
            container: document.getElementById('filter-size-chips'),
            categories: sizeCategoriesFromCounts(sizeCountMap(null)),
            allLabel: I18n.ui('ui.filter.all_sizes'),
            onChange: () => { currentPage = 1; renderAll(); },
        });

        const comptypeChips = CategoryChips.create({
            container: document.getElementById('filter-comptype-chips'),
            categories: comptypeCategories,
            allLabel: I18n.ui('ui.filter.all_types'),
            onChange: (typeValue) => {
                // Rebuild size chips filtered to the selected type
                const newSizeCounts = sizeCountMap(typeValue || null);
                sizeChips.rebuild(sizeCategoriesFromCounts(newSizeCounts));
                currentPage = 1;
                renderAll();
            },
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;

                document.getElementById('filter-class-chips').classList.toggle('hidden', activeTab !== 'ships');
                document.getElementById('filter-model-toggle').classList.toggle('hidden', activeTab !== 'ships');
                document.getElementById('filter-comptype-chips').classList.toggle('hidden', activeTab !== 'components');
                document.getElementById('filter-size-chips').classList.toggle('hidden', activeTab !== 'components');
                if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
                SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
                renderAll();
            });
        });

        // Detail panel
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        document.getElementById('detail-close').addEventListener('click', () => {
            if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
            SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
        });

        function showDetail(item) {
            if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
            SharedRender.hidePlaceholder(detailPanel);
            detailTitle.textContent = item.name || item.id;
            const iconStem = item.icon ? item.icon.replace(/^GFX_/, '') : '';
            const iconHtml = iconStem
                ? `<img class="detail-icon" src="icons/components/${esc(iconStem)}.webp" alt="" onerror="this.style.display='none'">`
                : '';
            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.class) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.class')}: ${esc(item.class)}</span>`;
            if (item.type) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.type')}: ${esc(item.type)}</span>`;
            if (item.size) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.size')}: ${esc(item.size)}</span>`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Description (components: try component_set + _DESC first, then id + _DESC)
            const descBase = item.component_set || item.id;
            const descKey = descBase + '_DESC';
            const desc = I18n.t(descKey);
            if (desc && desc !== descKey) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.description')}</div>`;
                html += `<div class="detail-desc">${esc(desc)}</div></div>`;
            }

            // Stats
            const stats = [];
            if (item.max_hitpoints) stats.push([I18n.ui('ui.meta.hp'), item.max_hitpoints]);
            if (item.max_speed) stats.push([I18n.ui('ui.meta.speed'), item.max_speed]);
            if (item.base_buildtime) stats.push([I18n.ui('ui.meta.build_time'), item.base_buildtime]);
            if (item.power) stats.push([I18n.ui('ui.meta.power'), item.power]);
            if (item.damage) stats.push([I18n.ui('ui.meta.damage'), `${item.damage.min}-${item.damage.max}`]);
            if (item.range) stats.push([I18n.ui('ui.meta.range'), item.range]);
            if (item.accuracy) stats.push([I18n.ui('ui.meta.accuracy'), item.accuracy]);
            if (item.tracking) stats.push([I18n.ui('ui.meta.tracking'), item.tracking]);
            if (stats.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${v}</span>`).join('')}</div></div>`;
            }

            // Prerequisites
            if (item.prerequisites && item.prerequisites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
            }

            // Resources
            if (item.resources) {
                html += `<div class="detail-section">${SharedRender.dualView(item.resources, I18n.ui('ui.detail.resources'))}</div>`;
            }

            // Modifier
            if (item.modifier) {
                html += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            }

            // Section slots (ships)
            if (item.section_slots && item.section_slots.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.section_slots')}</div>`;
                html += `<div class="detail-meta">${item.section_slots.map(s => `<span class="detail-meta-item">${esc(s.name)}</span>`).join('')}</div></div>`;
            }

            // Tags (components)
            if (item.tags && item.tags.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.tags')}</div>`;
                html += `<div class="detail-meta">${item.tags.map(t => `<span class="detail-meta-item">${esc(t)}</span>`).join('')}</div></div>`;
            }

            // 3D Model Viewer
            if (item.has_model && item.model_factions && item.model_factions.length) {
                html += `<div class="detail-section">`;
                html += `<div class="detail-section-title">${I18n.ui('ui.detail.3d_model')}`;
                if (item.model_source === 'vanilla') {
                    html += ` <span class="badge badge-vanilla" title="This model comes from vanilla Stellaris, not the STNH mod">Vanilla</span>`;
                }
                html += `</div>`;

                // Faction selector
                if (item.model_factions.length > 1) {
                    html += `<select class="ship-faction-select" id="model-faction-select">`;
                    for (const f of item.model_factions) {
                        html += `<option value="${esc(f)}">${esc(f)}</option>`;
                    }
                    html += `</select>`;
                }

                html += `<div class="ship-viewer-container">`;
                html += `<div class="ship-viewer-placeholder" id="ship-viewer-area">`;
                html += `<button class="ship-viewer-load-btn" id="load-3d-btn">${I18n.ui('ui.action.view_3d')}</button>`;
                html += `</div></div></div>`;
            }

            detailContent.innerHTML = html;
            SharedRender.initToggles(detailContent);
            SharedRender.initTechLinks(detailContent);

            // Wire up 3D model button
            if (item.has_model && item.model_factions && item.model_factions.length) {
                const loadBtn = detailContent.querySelector('#load-3d-btn');
                const viewerArea = detailContent.querySelector('#ship-viewer-area');
                const factionSelect = detailContent.querySelector('#model-faction-select');

                function getModelPath() {
                    const faction = factionSelect ? factionSelect.value : item.model_factions[0];
                    return `models/${faction}/${item.id}.glb?v=${window.WIKI_BUILD_VERSION || '1'}`;
                }

                if (loadBtn) {
                    loadBtn.addEventListener('click', () => {
                        ShipViewer.createViewer(viewerArea, getModelPath());
                    });
                }

                if (factionSelect) {
                    factionSelect.addEventListener('change', () => {
                        ShipViewer.createViewer(viewerArea, getModelPath());
                    });
                }
            }

            detailPanel.classList.remove('hidden');
        }

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

        // Language change
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of ships) { const r = I18n.t(item.name_key); item.name = (r !== item.name_key) ? r : item.id; }
            for (const item of components) item.name = I18n.t(item.name_key) || item.id;
            // Refresh labels in category arrays before rebuilding chips
            for (const cat of classCategories) cat.label = getClassLabel(cat.value);
            for (const cat of comptypeCategories) cat.label = getComptypeLabel(cat.value);
            classChips.rebuildAll(classCategories, I18n.ui('ui.filter.all_classes'));
            sizeChips.rebuildAll(sizeCategoriesFromCounts(sizeCountMap(null)), I18n.ui('ui.filter.all_sizes'));
            comptypeChips.rebuildAll(comptypeCategories, I18n.ui('ui.filter.all_types'));
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
                document.getElementById('filter-class-chips').classList.toggle('hidden', activeTab !== 'ships');
                document.getElementById('filter-model-toggle').classList.toggle('hidden', activeTab !== 'ships');
                document.getElementById('filter-comptype-chips').classList.toggle('hidden', activeTab !== 'components');
                document.getElementById('filter-size-chips').classList.toggle('hidden', activeTab !== 'components');
            }
        }

        renderAll();
        SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
        I18n.loadFullLocalisation();

        // Auto-select item from URL (after renderAll)
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...ships, ...components];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                showDetail(item);
                AppState.set('select', '');
            }
        }

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'ships' ? ships : components;

            // Filter
            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'ships') {
                    const cls = classChips.getActive();
                    if (cls && item.class !== cls) return false;
                    if (!showNoModelCheckbox.checked && !item.has_model) return false;
                } else {
                    const compType = comptypeChips.getActive();
                    if (compType && item.type !== compType) return false;
                    const size = sizeChips.getActive();
                    if (size && (item.size || '').toLowerCase() !== size) return false;
                }
                return true;
            });

            // Sort
            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            // Stats
            const total = activeTab === 'ships'
                ? (showNoModelCheckbox.checked ? ships.length : ships.filter(s => s.has_model).length)
                : components.length;
            const statsEl = document.getElementById('filter-stats');
            if (activeTab === 'ships') {
                statsEl.innerHTML =
                    `<span>${items.length} / ${total} Ship Types</span>` +
                    `<span>${globalStats.model_variants} Models</span>` +
                    `<span>${globalStats.total_meshes} Meshes</span>`;
            } else {
                statsEl.textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;
            }

            // Paginate
            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            // Render list
            let html = '';
            for (const item of pageItems) {
                const factionCount = item.model_factions ? item.model_factions.length : 0;
                const compIconStem = (activeTab === 'components' && item.icon)
                    ? item.icon.replace(/^GFX_/, '')
                    : '';
                const compIconHtml = compIconStem
                    ? `<img class="item-card-icon-inline" src="icons/components/${esc(compIconStem)}.webp" alt="" onerror="this.style.display='none'">`
                    : '';
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    <div class="item-card-body">
                        <div class="item-card-header">`;
                if (item.has_model) {
                    html += `<span class="model-badge">&#9670; 3D · ${factionCount} Factions</span>`;
                }
                html += `    ${compIconHtml}<span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">`;
                if (item.class) html += `<span class="detail-meta-item">${esc(getClassLabel(item.class))}</span>`;
                if (item.type) html += `<span class="detail-meta-item">${esc(getComptypeLabel(item.type))}</span>`;
                if (item.size) html += `<span class="detail-meta-item">${esc(getSizeLabel((item.size || '').toLowerCase()))}</span>`;
                if (item.prerequisites && item.prerequisites.length) html += `<span class="detail-meta-item">${I18n.ui('ui.card.tech')}: ${item.prerequisites.length}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';

            // Click handler
            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    listEl.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const id = card.dataset.id;
                    const item = items.find(i => i.id === id);
                    if (item) showDetail(item);
                });
            });

            // Pagination
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
