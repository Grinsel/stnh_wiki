/**
 * Buildings & Districts page controller.
 */
(async function initBuildings() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">Loading building data</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [buildings, districts] = await Promise.all([
            DataManager.loadJSON('assets/buildings.json'),
            DataManager.loadJSON('assets/districts.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        for (const item of buildings) item.name = I18n.t(item.name_key) || item.id;
        for (const item of districts) item.name = I18n.t(item.name_key) || item.id;

        // Populate category dropdown
        const categories = [...new Set(buildings.map(b => b.category).filter(Boolean))].sort();
        const catSel = document.getElementById('filter-category');
        for (const c of categories) catSel.add(new Option(c, c));

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
                document.getElementById('filter-category-group').classList.toggle('hidden', activeTab !== 'buildings');
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
            let html = `<div class="detail-meta">`;
            html += `<span class="detail-meta-item">ID: ${esc(item.id)}</span>`;
            if (item.category) html += `<span class="detail-meta-item">Category: ${esc(item.category)}</span>`;
            if (item.base_buildtime) html += `<span class="detail-meta-item">Build Time: ${item.base_buildtime}</span>`;
            if (item.capital) html += `<span class="detail-meta-item">Capital</span>`;
            html += `<span class="detail-meta-item">File: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            if (item.prerequisites && item.prerequisites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">Prerequisites</div>`;
                html += `<div class="detail-meta">${item.prerequisites.map(t => `<span class="detail-meta-item">${esc(I18n.t(t) || t)}</span>`).join('')}</div></div>`;
            }

            if (item.upgrades && item.upgrades.length) {
                html += `<div class="detail-section"><div class="detail-section-title">Upgrades To</div>`;
                html += `<div class="detail-meta">${item.upgrades.map(u => `<span class="detail-meta-item">${esc(I18n.t(u) || u)}</span>`).join('')}</div></div>`;
            }

            if (item.resources) {
                html += `<div class="detail-section"><div class="detail-section-title">Resources</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.resources, null, 2))}</div></div>`;
            }

            if (item.modifier) {
                html += `<div class="detail-section"><div class="detail-section-title">Modifiers</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.modifier, null, 2))}</div></div>`;
            }

            if (item.potential) {
                html += `<div class="detail-section"><div class="detail-section-title">Potential</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.potential, null, 2))}</div></div>`;
            }

            detailContent.innerHTML = html;
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

        catSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        document.getElementById('lang-select').addEventListener('change', async (e) => {
            AppState.set('lang', e.target.value);
            await I18n.setLanguage(e.target.value);
            for (const item of buildings) item.name = I18n.t(item.name_key) || item.id;
            for (const item of districts) item.name = I18n.t(item.name_key) || item.id;
            renderAll();
        });

        renderAll();

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'buildings' ? buildings : districts;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'buildings') {
                    const cat = catSel.value;
                    if (cat && item.category !== cat) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            const total = activeTab === 'buildings' ? buildings.length : districts.length;
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${activeTab}`;

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
                if (item.category) html += `<span class="detail-meta-item">${esc(item.category)}</span>`;
                if (item.base_buildtime) html += `<span class="detail-meta-item">Build: ${item.base_buildtime}</span>`;
                if (item.prerequisites && item.prerequisites.length) html += `<span class="detail-meta-item">Tech: ${item.prerequisites.length}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">No items found</div>';

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
        listEl.innerHTML = `<div class="loading" style="animation:none">Failed to load data: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
