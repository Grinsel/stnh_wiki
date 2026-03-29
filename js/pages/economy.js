/**
 * Economy (Jobs & Deposits) page controller.
 */
(async function initEconomy() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">Loading economy data</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [jobs, deposits] = await Promise.all([
            DataManager.loadJSON('assets/jobs.json'),
            DataManager.loadJSON('assets/deposits.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        for (const item of jobs) item.name = I18n.t(item.name_key) || item.id;
        for (const item of deposits) item.name = I18n.t(item.name_key) || item.id;

        // Populate category dropdown (jobs + deposits categories combined)
        const jobCats = [...new Set(jobs.map(j => j.category).filter(Boolean))].sort();
        const depCats = [...new Set(deposits.map(d => d.category).filter(Boolean))].sort();
        const catSel = document.getElementById('filter-category');

        let activeTab = 'jobs';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        function populateCategories() {
            const cats = activeTab === 'jobs' ? jobCats : depCats;
            catSel.innerHTML = '<option value="">All Categories</option>';
            for (const c of cats) {
                catSel.add(new Option(c, c));
            }
        }
        populateCategories();

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                populateCategories();
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
            html += `<span class="detail-meta-item">ID: ${esc(item.id)}</span>`;
            if (item.category) html += `<span class="detail-meta-item">Category: ${esc(item.category)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">File: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Job-specific
            if (activeTab === 'jobs') {
                const stats = [];
                if (item.building_icon) stats.push(['Building Icon', item.building_icon]);
                if (item.condition) stats.push(['Condition', item.condition]);
                if (item.is_capped_by_modifier) stats.push(['Capped by Modifier', 'Yes']);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Info</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
            }

            // Deposit-specific
            if (activeTab === 'deposits') {
                const stats = [];
                if (item.is_null) stats.push(['Null Deposit', 'Yes']);
                if (item.is_for_colonizable) stats.push(['For Colonizable', 'Yes']);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Info</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
            }

            // Resources
            if (item.resources) {
                html += `<div class="detail-section"><div class="detail-section-title">Resources</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.resources, null, 2))}</div></div>`;
            }

            // Modifier
            if (item.modifier) {
                html += `<div class="detail-section"><div class="detail-section-title">Modifiers</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.modifier, null, 2))}</div></div>`;
            }

            // Possible
            if (item.possible) {
                html += `<div class="detail-section"><div class="detail-section-title">Possible</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.possible, null, 2))}</div></div>`;
            }

            // Potential
            if (item.potential) {
                html += `<div class="detail-section"><div class="detail-section-title">Potential</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.potential, null, 2))}</div></div>`;
            }

            // Drop weight (deposits)
            if (item.drop_weight) {
                html += `<div class="detail-section"><div class="detail-section-title">Drop Weight</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.drop_weight, null, 2))}</div></div>`;
            }

            // Weight (jobs)
            if (item.weight) {
                html += `<div class="detail-section"><div class="detail-section-title">Weight</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.weight, null, 2))}</div></div>`;
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

        // Filter changes
        catSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // Language change
        document.getElementById('lang-select').addEventListener('change', async (e) => {
            AppState.set('lang', e.target.value);
            await I18n.setLanguage(e.target.value);
            for (const item of jobs) item.name = I18n.t(item.name_key) || item.id;
            for (const item of deposits) item.name = I18n.t(item.name_key) || item.id;
            renderAll();
        });

        renderAll();

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'jobs' ? jobs : deposits;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                const cat = catSel.value;
                if (cat && item.category !== cat) return false;
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            const total = activeTab === 'jobs' ? jobs.length : deposits.length;
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
                if (item.building_icon) html += `<span class="detail-meta-item">${esc(item.building_icon)}</span>`;
                if (item.is_for_colonizable) html += `<span class="detail-meta-item">Colonizable</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">No items found</div>';

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
        listEl.innerHTML = `<div class="loading" style="animation:none">Failed to load data: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
