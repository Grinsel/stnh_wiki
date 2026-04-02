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
        await I18n.setLanguage(AppState.get('lang'));

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
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Megastructure-specific
            if (activeTab === 'megastructures') {
                const stats = [];
                if (item.build_time) stats.push([I18n.ui('ui.meta.build_time'), item.build_time]);
                if (item.entity) stats.push([I18n.ui('ui.meta.entity'), item.entity]);
                if (item.upgrade_from) stats.push([I18n.ui('ui.meta.upgrade_from'), item.upgrade_from]);
                if (item.sensor_range) stats.push([I18n.ui('ui.meta.sensor_range'), item.sensor_range]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.prerequisites && item.prerequisites.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                    html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
                }
            }

            // Relic-specific
            if (activeTab === 'relics') {
                const stats = [];
                if (item.activation_duration) stats.push([I18n.ui('ui.meta.activation_duration'), item.activation_duration]);
                if (item.score) stats.push([I18n.ui('ui.meta.score'), item.score]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
            }

            // Resources
            if (item.resources) {
                html += `<div class="detail-section">${SharedRender.dualView(item.resources, I18n.ui('ui.detail.resources'))}</div>`;
            }

            // Modifier
            if (item.modifier) {
                html += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            }

            // Active effect (relics)
            if (item.active_effect) {
                html += `<div class="detail-section">${SharedRender.dualView(item.active_effect, I18n.ui('ui.detail.active_effect'))}</div>`;
            }

            // Possible
            if (item.possible) {
                html += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.possible'))}</div>`;
            }

            // On build complete (megastructures)
            if (item.on_build_complete) {
                html += `<div class="detail-section">${SharedRender.dualView(item.on_build_complete, I18n.ui('ui.detail.on_build_complete'))}</div>`;
            }

            detailContent.innerHTML = html;
            SharedRender.initToggles(detailContent);
            SharedRender.initTechLinks(detailContent);
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
            for (const item of megastructures) item.name = I18n.t(item.name_key) || item.id;
            for (const item of relics) item.name = I18n.t(item.name_key) || item.id;
            renderAll();
        });

        renderAll();

        function renderAll() {
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

            let html = '';
            for (const item of pageItems) {
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">`;
                if (item.build_time) html += `<span class="detail-meta-item">${I18n.ui('ui.card.build')}: ${esc(item.build_time)}</span>`;
                if (item.upgrade_from) html += `<span class="detail-meta-item">${I18n.ui('ui.card.from')}: ${esc(item.upgrade_from)}</span>`;
                if (item.activation_duration) html += `<span class="detail-meta-item">${I18n.ui('ui.card.duration')}: ${esc(item.activation_duration)}</span>`;
                if (item.score) html += `<span class="detail-meta-item">${I18n.ui('ui.card.score')}: ${esc(item.score)}</span>`;
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
