/**
 * Economy (Jobs & Deposits) page controller.
 */
(async function initEconomy() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.economy') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [jobs, deposits] = await Promise.all([
            DataManager.loadJSON('assets/jobs.json'),
            DataManager.loadJSON('assets/deposits.json'),
        ]);
        await I18n.setLanguageForModule(AppState.get('lang'), 'economy');

        for (const item of jobs) item.name = I18n.t(item.name_key) || item.id;
        for (const item of deposits) item.name = I18n.t(item.name_key) || item.id;

        // Populate category dropdown (jobs + deposits categories combined)
        const jobCats = [...new Set(jobs.map(j => j.category).filter(Boolean))].sort();
        const depCats = [...new Set(deposits.map(d => d.category).filter(Boolean))].sort();
        const catSel = document.getElementById('filter-category');

        const ICON_DIRS = { jobs: 'jobs', deposits: 'deposits' };

        let activeTab = 'jobs';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        function populateCategories() {
            const cats = activeTab === 'jobs' ? jobCats : depCats;
            catSel.innerHTML = '<option value="">' + I18n.ui('ui.filter.all_categories') + '</option>';
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
            const iconDir = ICON_DIRS[activeTab];
            const iconStem = item.icon || '';
            const iconHtml = iconDir && iconStem
                ? `<img class="detail-icon" src="icons/${iconDir}/${esc(iconStem)}.webp" alt="" onerror="this.style.display='none'">`
                : '';
            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.category) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.category')}: ${esc(item.category)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Job-specific
            if (activeTab === 'jobs') {
                const stats = [];
                if (item.building_icon) stats.push([I18n.ui('ui.meta.building_icon'), item.building_icon]);
                if (item.condition) stats.push([I18n.ui('ui.meta.condition'), item.condition]);
                if (item.is_capped_by_modifier) stats.push([I18n.ui('ui.meta.capped_by_modifier'), I18n.ui('ui.misc.yes')]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
            }

            // Deposit-specific
            if (activeTab === 'deposits') {
                const stats = [];
                if (item.is_null) stats.push([I18n.ui('ui.meta.null_deposit'), I18n.ui('ui.misc.yes')]);
                if (item.is_for_colonizable) stats.push([I18n.ui('ui.meta.for_colonizable'), I18n.ui('ui.misc.yes')]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.info')}</div>`;
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

            // Possible
            if (item.possible) {
                html += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.possible'))}</div>`;
            }

            // Potential
            if (item.potential) {
                html += `<div class="detail-section">${SharedRender.dualView(item.potential, I18n.ui('ui.detail.potential'))}</div>`;
            }

            // Drop weight (deposits)
            if (item.drop_weight) {
                html += `<div class="detail-section">${SharedRender.dualView(item.drop_weight, I18n.ui('ui.detail.drop_weight'))}</div>`;
            }

            // Weight (jobs)
            if (item.weight) {
                html += `<div class="detail-section">${SharedRender.dualView(item.weight, I18n.ui('ui.detail.weight'))}</div>`;
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
        catSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // Language change
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of jobs) item.name = I18n.t(item.name_key) || item.id;
            for (const item of deposits) item.name = I18n.t(item.name_key) || item.id;
            populateCategories();
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
                populateCategories();
            }
        }

        renderAll();
        I18n.loadFullLocalisation();

        // Auto-select item from URL (after renderAll)
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...jobs, ...deposits];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                showDetail(item);
                AppState.set('select', '');
            }
        }

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
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            let html = '';
            for (const item of pageItems) {
                const iconDir = ICON_DIRS[activeTab];
                const iconStem = item.icon || '';
                const iconCol = iconDir && iconStem
                    ? `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/${iconDir}/${esc(iconStem)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`
                    : '';
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    ${iconCol}
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">`;
                if (item.category) html += `<span class="detail-meta-item">${esc(item.category)}</span>`;
                if (item.building_icon) html += `<span class="detail-meta-item">${esc(item.building_icon)}</span>`;
                if (item.is_for_colonizable) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.colonizable')}</span>`;
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
