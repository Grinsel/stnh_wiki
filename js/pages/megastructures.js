/**
 * Megastructures & Relics page controller.
 */
(async function initMegastructures() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.megastructures') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [megastructures, relics] = await Promise.all([
            DataManager.loadJSON('assets/megastructures.json'),
            DataManager.loadJSON('assets/relics.json'),
        ]);
        await I18n.setLanguageForModule(AppState.get('lang'), 'megastructures');

        for (const item of megastructures) item.name = I18n.t(item.name_key) || item.id;
        for (const item of relics) item.name = I18n.t(item.name_key) || item.id;

        let activeTab = 'megastructures';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                detailPanel.classList.add('hidden');
                renderAll();
            });
        });

        // Detail panel (for megastructures only)
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        document.getElementById('detail-close').addEventListener('click', () => {
            if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
            detailPanel.classList.add('hidden');
        });

        // --- Relic overlay state ---
        let activeOverlay = null; // current overlay element
        let activeOverlayTileId = null; // id of the tile that spawned it

        function buildDetailHtml(item, isRelic) {
            const iconHtml = isRelic
                ? `<img class="detail-icon" src="icons/relics/${esc(item.icon || item.id)}.webp" alt="" onerror="this.style.display='none'">`
                : '';
            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Megastructure-specific
            if (!isRelic) {
                const stats = [];
                if (item.build_time) stats.push([I18n.ui('ui.meta.build_time'), esc(item.build_time)]);
                if (item.entity) stats.push([I18n.ui('ui.meta.entity'), esc(item.entity)]);
                if (item.upgrade_from) stats.push([I18n.ui('ui.meta.upgrade_from'), SharedRender.wikiLink(item.upgrade_from, 'megastructure', I18n.t(item.upgrade_from) || item.upgrade_from)]);
                if (item.sensor_range) stats.push([I18n.ui('ui.meta.sensor_range'), esc(item.sensor_range)]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${v}</span>`).join('')}</div></div>`;
                }
                if (item.prerequisites && item.prerequisites.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                    html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
                }
            }

            // Relic-specific
            if (isRelic) {
                const stats = [];
                if (item.activation_duration) stats.push([I18n.ui('ui.meta.activation_duration'), item.activation_duration]);
                if (item.score) stats.push([I18n.ui('ui.meta.score'), item.score]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
            }

            if (item.resources) {
                html += `<div class="detail-section">${SharedRender.dualView(item.resources, I18n.ui('ui.detail.resources'))}</div>`;
            }
            if (item.modifier) {
                html += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            }
            if (item.active_effect) {
                html += `<div class="detail-section">${SharedRender.dualView(item.active_effect, I18n.ui('ui.detail.active_effect'))}</div>`;
            }
            if (item.possible) {
                html += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.possible'))}</div>`;
            }
            if (item.on_build_complete) {
                html += `<div class="detail-section">${SharedRender.dualView(item.on_build_complete, I18n.ui('ui.detail.on_build_complete'))}</div>`;
            }

            // 3D Model Viewer
            if (!isRelic && item.has_model && item.model_factions && item.model_factions.length) {
                html += `<div class="detail-section">`;
                html += `<div class="detail-section-title">${I18n.ui('ui.detail.3d_model')}</div>`;

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

            return html;
        }

        function buildRelicOverlayHtml(item) {
            // Header: back button + icon + name
            let html = `<div class="relic-overlay-header">`;
            html += `<button class="relic-detail-back">&larr; ${I18n.ui('ui.search.back')}</button>`;
            html += `<div class="relic-overlay-title">`;
            html += `<img class="relic-overlay-icon" src="icons/relics/${esc(item.icon || item.id)}.webp" alt="" onerror="this.style.display='none'">`;
            html += `<h3>${esc(item.name || item.id)}</h3>`;
            html += `</div></div>`;

            // Left column: Stats, Resources, Modifiers
            let leftHtml = '';
            const stats = [];
            if (item.activation_duration) stats.push([I18n.ui('ui.meta.activation_duration'), item.activation_duration]);
            if (item.score) stats.push([I18n.ui('ui.meta.score'), item.score]);
            if (stats.length) {
                leftHtml += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                leftHtml += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
            }
            if (item.resources) {
                leftHtml += `<div class="detail-section">${SharedRender.dualView(item.resources, I18n.ui('ui.detail.resources'))}</div>`;
            }
            if (item.modifier) {
                leftHtml += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            }

            // Right column: Active Effect, Possible, On Build Complete, etc.
            let rightHtml = '';
            if (item.active_effect) {
                rightHtml += `<div class="detail-section">${SharedRender.dualView(item.active_effect, I18n.ui('ui.detail.active_effect'))}</div>`;
            }
            if (item.possible) {
                rightHtml += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.possible'))}</div>`;
            }
            if (item.on_build_complete) {
                rightHtml += `<div class="detail-section">${SharedRender.dualView(item.on_build_complete, I18n.ui('ui.detail.on_build_complete'))}</div>`;
            }

            // Two-column body
            html += `<div class="relic-overlay-columns">`;
            if (leftHtml) html += `<div class="relic-overlay-col">${leftHtml}</div>`;
            if (rightHtml) html += `<div class="relic-overlay-col">${rightHtml}</div>`;
            html += `</div>`;

            // Footer: ID + source file
            html += `<div class="relic-overlay-footer">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            return html;
        }

        function showDetail(item) {
            if (typeof ShipViewer !== 'undefined') ShipViewer.dispose();
            detailTitle.textContent = item.name || item.id;
            detailContent.innerHTML = buildDetailHtml(item, false);
            SharedRender.initToggles(detailContent);
            SharedRender.initTechLinks(detailContent);
            SharedRender.initWikiLinks(detailContent);
            detailPanel.classList.remove('hidden');

            // Wire up 3D model button
            if (item.has_model && item.model_factions && item.model_factions.length) {
                const loadBtn = detailContent.querySelector('#load-3d-btn');
                const viewerArea = detailContent.querySelector('#ship-viewer-area');
                const factionSelect = detailContent.querySelector('#model-faction-select');

                function getModelPath() {
                    const faction = factionSelect ? factionSelect.value : item.model_factions[0];
                    return `models/megastructures/${item.id}/${faction}.glb?v=${window.WIKI_BUILD_VERSION || '1'}`;
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
        }

        // --- Relic overlay expand/collapse ---
        function removeOverlayImmediate() {
            if (activeOverlay) {
                activeOverlay.remove();
                activeOverlay = null;
                activeOverlayTileId = null;
            }
        }

        function expandRelicOverlay(tileEl, item, items) {
            // Remove any existing overlay
            removeOverlayImmediate();

            const grid = tileEl.closest('.relic-grid');
            if (!grid) return;

            const gridRect = grid.getBoundingClientRect();
            const tileRect = tileEl.getBoundingClientRect();

            // Tile position relative to grid
            const startTop = tileRect.top - gridRect.top + grid.scrollTop;
            const startLeft = tileRect.left - gridRect.left;
            const startW = tileRect.width;
            const startH = tileRect.height;

            // Create overlay at tile position (no transition yet)
            const overlay = document.createElement('div');
            overlay.className = 'relic-detail-overlay';
            overlay.style.top = startTop + 'px';
            overlay.style.left = startLeft + 'px';
            overlay.style.width = startW + 'px';
            overlay.style.height = startH + 'px';

            // Detail content inside — two-column layout
            overlay.innerHTML = `<div class="detail-inner">${buildRelicOverlayHtml(item)}</div>`;

            grid.appendChild(overlay);
            activeOverlay = overlay;
            activeOverlayTileId = item.id;

            // Measure grid size for expand target
            const gridW = grid.offsetWidth;
            const gridH = Math.max(grid.scrollHeight, 300);

            // Next frame: expand to full grid size
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    overlay.style.top = '0px';
                    overlay.style.left = '0px';
                    overlay.style.width = gridW + 'px';
                    overlay.style.height = gridH + 'px';

                    // After transition: show content
                    let expanded = false;
                    const doExpand = () => {
                        if (expanded) return;
                        expanded = true;
                        overlay.removeEventListener('transitionend', onExpand);
                        overlay.classList.add('expanded');
                        // Init toggles/tech links in overlay
                        const inner = overlay.querySelector('.detail-inner');
                        if (inner) {
                            SharedRender.initToggles(inner);
                            SharedRender.initTechLinks(inner);
                            SharedRender.initWikiLinks(inner);
                        }
                    };
                    const onExpand = () => doExpand();
                    overlay.addEventListener('transitionend', onExpand);
                    // Fallback in case transitionend doesn't fire
                    setTimeout(doExpand, 400);
                });
            });

            // Back button handler
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

            // Hide content immediately
            overlay.classList.remove('expanded');

            // If tile is still in DOM, animate back to its position
            if (tileEl && document.contains(tileEl)) {
                const gridRect = grid.getBoundingClientRect();
                const tileRect = tileEl.getBoundingClientRect();

                const targetTop = tileRect.top - gridRect.top + grid.scrollTop;
                const targetLeft = tileRect.left - gridRect.left;

                overlay.style.top = targetTop + 'px';
                overlay.style.left = targetLeft + 'px';
                overlay.style.width = tileRect.width + 'px';
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
                // Tile gone (e.g. search changed), just fade out
                overlay.style.opacity = '0';
                setTimeout(() => removeOverlayImmediate(), 300);
            }
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

        // Language change
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of megastructures) item.name = I18n.t(item.name_key) || item.id;
            for (const item of relics) item.name = I18n.t(item.name_key) || item.id;
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
            }
        }

        renderAll();
        I18n.loadFullLocalisation();

        // Auto-select item from URL (after renderAll)
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...megastructures, ...relics];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                if (activeTab === 'relics') {
                    // Find the tile and expand it
                    const tile = listEl.querySelector(`.relic-tile[data-id="${CSS.escape(selectId)}"]`);
                    if (tile) expandRelicOverlay(tile, item);
                } else {
                    showDetail(item);
                }
                AppState.set('select', '');
            }
        }

        function renderAll() {
            // Remove overlay on re-render
            removeOverlayImmediate();

            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'megastructures' ? megastructures : relics;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            const total = activeTab === 'megastructures' ? megastructures.length : relics.length;
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            if (activeTab === 'relics') {
                // --- Relic grid ---
                if (pageItems.length === 0) {
                    listEl.innerHTML = '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';
                } else {
                    let html = '<div class="relic-grid">';
                    for (const item of pageItems) {
                        html += `<div class="relic-tile" data-id="${esc(item.id)}">
                            <img src="icons/relics/${esc(item.icon || item.id)}.webp" alt=""
                                 onerror="this.style.display='none'">
                            <span class="relic-tile-name">${esc(item.name || item.id)}</span>
                        </div>`;
                    }
                    html += '</div>';
                    listEl.innerHTML = html;
                }

                // Tile click → expand overlay
                listEl.querySelectorAll('.relic-tile').forEach(tile => {
                    tile.addEventListener('click', () => {
                        const id = tile.dataset.id;
                        const item = items.find(i => i.id === id);
                        if (item) expandRelicOverlay(tile, item, items);
                    });
                });
            } else {
                // --- Megastructure list (unchanged) ---
                let html = '';
                for (const item of pageItems) {
                    html += `<div class="item-card" data-id="${esc(item.id)}">
                        <div class="item-card-body">
                            <div class="item-card-header">`;
                    if (item.has_model) {
                        const factionCount = item.model_factions ? item.model_factions.length : 0;
                        html += `<span class="model-badge">&#9670; 3D${factionCount > 1 ? ' · ' + factionCount + ' Factions' : ''}</span>`;
                    }
                    html += `                <span class="item-card-name">${esc(item.name || item.id)}</span>
                                <span class="item-card-id">${esc(item.id)}</span>
                            </div>
                            <div class="item-card-meta">`;
                    if (item.build_time) html += `<span class="detail-meta-item">${I18n.ui('ui.card.build')}: ${esc(item.build_time)}</span>`;
                    if (item.upgrade_from) html += `<span class="detail-meta-item">${I18n.ui('ui.card.from')}: ${esc(item.upgrade_from)}</span>`;
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
            }

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

    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">${I18n.ui('ui.error.load_failed')}: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
