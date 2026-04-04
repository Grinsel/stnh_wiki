/**
 * Buildings & Districts page controller.
 */
(async function initBuildings() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.buildings') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    const CATEGORY_LABELS = {
        amenity:       'Amenity',
        army:          'Army',
        government:    'Government',
        manufacturing: 'Manufacturing',
        pop_assembly:  'Pop Assembly',
        research:      'Research',
        resource:      'Resource',
        trade:         'Trade',
        unity:         'Unity',
    };

    try {
        const [buildings, districts] = await Promise.all([
            DataManager.loadJSON('assets/buildings.json'),
            DataManager.loadJSON('assets/districts.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        for (const item of buildings) item.name = I18n.t(item.name_key) || item.id;
        for (const item of districts) item.name = I18n.t(item.name_key) || item.id;

        // Build category counts
        const catCounts = {};
        for (const b of buildings) { if (b.category) catCounts[b.category] = (catCounts[b.category] || 0) + 1; }

        const categoryCategories = Object.keys(catCounts).sort().map(v => ({
            value: v,
            label: CATEGORY_LABELS[v] || v,
            count: catCounts[v],
        }));

        const categoryChips = CategoryChips.create({
            container: document.getElementById('filter-category-chips'),
            categories: categoryCategories,
            allLabel: 'All Categories',
            onChange: () => { currentPage = 1; renderAll(); },
        });

        let activeTab = 'buildings';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                document.getElementById('filter-category-chips').classList.toggle('hidden', activeTab !== 'buildings');
                renderAll();
            });
        });

        // Detail panel
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        document.getElementById('detail-close').addEventListener('click', () => detailPanel.classList.add('hidden'));

        function showDetail(item) {
            detailTitle.textContent = item.name || item.id;
            const iconHtml = item.icon_key
                ? `<img class="detail-icon" src="icons/buildings/${esc(item.icon_key)}.webp" alt="" onerror="this.style.display='none'">`
                : '';
            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id') + ': '}${esc(item.id)}</span>`;
            if (item.category) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.category') + ': '}${esc(CATEGORY_LABELS[item.category] || item.category)}</span>`;
            if (item.base_buildtime) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.build_time') + ': '}${item.base_buildtime}</span>`;
            if (item.capital) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.capital')}</span>`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file') + ': '}${esc(item.source_file)}</span>`;
            html += `</div>`;

            if (item.prerequisites && item.prerequisites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
            }

            if (item.upgrades && item.upgrades.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.upgrades_to')}</div>`;
                html += `<div class="detail-meta">${item.upgrades.map(u => `<span class="detail-meta-item">${esc(I18n.t(u) || u)}</span>`).join('')}</div></div>`;
            }

            if (item.resources) {
                html += `<div class="detail-section">${SharedRender.dualView(item.resources, I18n.ui('ui.detail.resources'))}</div>`;
            }

            if (item.modifier) {
                html += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            }

            if (item.potential) {
                html += `<div class="detail-section">${SharedRender.dualView(item.potential, I18n.ui('ui.detail.potential'))}</div>`;
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

        document.addEventListener('wiki-lang-changed', () => {
            for (const item of buildings) item.name = I18n.t(item.name_key) || item.id;
            for (const item of districts) item.name = I18n.t(item.name_key) || item.id;
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
                document.getElementById('filter-category-chips').classList.toggle('hidden', activeTab !== 'buildings');
            }
        }

        renderAll();

        // Auto-select item from URL (after renderAll)
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...buildings, ...districts];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                showDetail(item);
                AppState.set('select', '');
            }
        }

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'buildings' ? buildings : districts;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'buildings') {
                    const cat = categoryChips.getActive();
                    if (cat && item.category !== cat) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            const total = activeTab === 'buildings' ? buildings.length : districts.length;
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            let html = '';
            for (const item of pageItems) {
                const iconCol = item.icon_key
                    ? `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/buildings/${esc(item.icon_key)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`
                    : '';
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    ${iconCol}
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">`;
                if (item.category) html += `<span class="detail-meta-item">${esc(CATEGORY_LABELS[item.category] || item.category)}</span>`;
                if (item.base_buildtime) html += `<span class="detail-meta-item">${I18n.ui('ui.card.build') + ':'} ${item.base_buildtime}</span>`;
                if (item.prerequisites && item.prerequisites.length) html += `<span class="detail-meta-item">${I18n.ui('ui.card.tech') + ':'} ${item.prerequisites.length}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';

            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    const item = items.find(i => i.id === card.dataset.id);
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
