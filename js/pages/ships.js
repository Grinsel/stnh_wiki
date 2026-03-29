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

    try {
        const [ships, components] = await Promise.all([
            DataManager.loadJSON('assets/ships.json'),
            DataManager.loadJSON('assets/components.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        // Resolve names
        for (const item of ships) {
            item.name = I18n.t(item.name_key) || item.id;
        }
        for (const item of components) {
            item.name = I18n.t(item.name_key) || item.id;
        }

        // Populate class dropdown
        const classes = [...new Set(ships.map(s => s.class).filter(Boolean))].sort();
        const classSel = document.getElementById('filter-class');
        for (const c of classes) {
            classSel.add(new Option(c, c));
        }

        // Populate size dropdown (components)
        const sizes = [...new Set(components.map(c => c.size).filter(Boolean))].sort();
        const sizeSel = document.getElementById('filter-size');
        for (const s of sizes) {
            sizeSel.add(new Option(s, s));
        }

        // State
        let activeTab = 'ships';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;

                // Show/hide filters per tab
                document.getElementById('filter-class-group').classList.toggle('hidden', activeTab !== 'ships');
                document.getElementById('filter-size-group').classList.toggle('hidden', activeTab !== 'components');
                document.getElementById('filter-comptype-group').classList.toggle('hidden', activeTab !== 'components');
                renderAll();
            });
        });

        // Detail panel
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        document.getElementById('detail-close').addEventListener('click', () => {
            detailPanel.classList.add('hidden');
        });

        function showDetail(item) {
            detailTitle.textContent = item.name || item.id;
            let html = `<div class="detail-meta">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.class) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.class')}: ${esc(item.class)}</span>`;
            if (item.type) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.type')}: ${esc(item.type)}</span>`;
            if (item.size) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.size')}: ${esc(item.size)}</span>`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

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
                html += `<div class="detail-meta">${item.prerequisites.map(t => `<span class="detail-meta-item">${esc(I18n.t(t) || t)}</span>`).join('')}</div></div>`;
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

            detailContent.innerHTML = html;
            SharedRender.initToggles(detailContent);
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

        // Filter changes
        classSel.addEventListener('change', () => { currentPage = 1; renderAll(); });
        sizeSel.addEventListener('change', () => { currentPage = 1; renderAll(); });
        document.getElementById('filter-comptype').addEventListener('change', () => { currentPage = 1; renderAll(); });

        // Language change
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of ships) item.name = I18n.t(item.name_key) || item.id;
            for (const item of components) item.name = I18n.t(item.name_key) || item.id;
            renderAll();
        });

        renderAll();

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'ships' ? ships : components;

            // Filter
            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'ships') {
                    const cls = classSel.value;
                    if (cls && item.class !== cls) return false;
                } else {
                    const size = sizeSel.value;
                    if (size && item.size !== size) return false;
                    const compType = document.getElementById('filter-comptype').value;
                    if (compType && item.type !== compType) return false;
                }
                return true;
            });

            // Sort
            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            // Stats
            const total = activeTab === 'ships' ? ships.length : components.length;
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            // Paginate
            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            // Render list
            let html = '';
            for (const item of pageItems) {
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">`;
                if (item.class) html += `<span class="detail-meta-item">${esc(item.class)}</span>`;
                if (item.type) html += `<span class="detail-meta-item">${esc(item.type)}</span>`;
                if (item.size) html += `<span class="detail-meta-item">${esc(item.size)}</span>`;
                if (item.prerequisites && item.prerequisites.length) html += `<span class="detail-meta-item">${I18n.ui('ui.card.tech')}: ${item.prerequisites.length}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';

            // Click handler
            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
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
