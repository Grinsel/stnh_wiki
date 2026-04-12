/**
 * Anomalies & Archaeology page controller.
 */
(async function initAnomalies() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.anomalies') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [anomalies, archaeology] = await Promise.all([
            DataManager.loadJSON('assets/anomalies.json'),
            DataManager.loadJSON('assets/archaeology.json'),
        ]);
        await DataManager.loadPicturesMap();
        await I18n.setLanguageForModule(AppState.get('lang'), 'anomalies');

        for (const item of anomalies) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
        for (const item of archaeology) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;

        const levelStart = document.getElementById('filter-level-start');
        const levelEnd = document.getElementById('filter-level-end');
        const LEVEL_MIN = parseInt(levelStart.min, 10);
        const LEVEL_MAX = parseInt(levelStart.max, 10);

        let activeTab = 'anomalies';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        function syncLevelFilter(trigger = true) {
            let s = parseInt(levelStart.value, 10);
            let e = parseInt(levelEnd.value, 10);
            if (s > e) { levelStart.value = e; s = e; }
            if (e < s) { levelEnd.value = s; e = s; }
            const range = LEVEL_MAX - LEVEL_MIN;
            const display = document.getElementById('level-filter-display');
            if (display) display.textContent = `${s}–${e}`;
            const fill = document.getElementById('level-filter-fill');
            if (fill && range > 0) {
                fill.style.marginLeft = ((s - LEVEL_MIN) / range * 100) + '%';
                fill.style.width = ((e - s) / range * 100) + '%';
            }
            if (trigger) { currentPage = 1; renderAll(); }
        }

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                document.getElementById('filter-level-group').classList.toggle('hidden', activeTab !== 'anomalies');
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
            let html = '';
            if (item.picture) {
                const picUrl = DataManager.getPictureUrl(item.picture);
                if (picUrl) {
                    html += `<div class="detail-picture"><img src="${picUrl}" alt="" onerror="this.parentElement.style.display='none'"></div>`;
                }
            }
            if (item.desc) {
                const descText = I18n.t(item.desc) || item.desc;
                if (descText) html += `<div class="detail-description">${esc(descText)}</div>`;
            }
            html += `<div class="detail-meta">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Anomaly-specific
            if (activeTab === 'anomalies') {
                const stats = [];
                if (item.level != null) stats.push([I18n.ui('ui.meta.level'), item.level]);
                if (item.max_once) stats.push([I18n.ui('ui.meta.max_once'), I18n.ui('ui.misc.yes')]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.on_success && item.on_success.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.success_outcomes')}</div>`;
                    html += `<div class="detail-meta">${item.on_success.map(o => `<span class="detail-meta-item">${esc(o.event)} (weight: ${esc(o.weight)})</span>`).join('')}</div></div>`;
                }
                if (item.spawn_chance) {
                    html += `<div class="detail-section">${SharedRender.dualView(item.spawn_chance, I18n.ui('ui.detail.spawn_chance'))}</div>`;
                }
            }

            // Archaeology-specific
            if (activeTab === 'archaeology') {
                const stats = [];
                if (item.stages_count != null) stats.push([I18n.ui('ui.meta.stages'), item.stages_count]);
                if (item.max_instances != null) stats.push([I18n.ui('ui.meta.max_instances'), item.max_instances]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.stages && item.stages.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stages')}</div>`;
                    for (let i = 0; i < item.stages.length; i++) {
                        const s = item.stages[i];
                        html += `<div class="detail-meta"><span class="detail-meta-item">${I18n.ui('ui.misc.stage')} ${i+1}: ${I18n.ui('ui.misc.difficulty')} ${esc(s.difficulty)}</span>`;
                        if (s.event) html += `<span class="detail-meta-item">${I18n.ui('ui.misc.event')}: ${esc(s.event)}</span>`;
                        if (s.icon) html += `<span class="detail-meta-item">${I18n.ui('ui.misc.icon')}: ${esc(s.icon)}</span>`;
                        html += `</div>`;
                    }
                    html += `</div>`;
                }
                if (item.weight) {
                    html += `<div class="detail-section">${SharedRender.dualView(item.weight, I18n.ui('ui.detail.weight'))}</div>`;
                }
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
        levelStart.addEventListener('input', () => syncLevelFilter(true));
        levelEnd.addEventListener('input', () => syncLevelFilter(true));

        // Language change
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of anomalies) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
            for (const item of archaeology) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
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
                document.getElementById('filter-level-group').classList.toggle('hidden', activeTab !== 'anomalies');
            }
        }

        syncLevelFilter(false);
        renderAll();
        I18n.loadFullLocalisation();

        // Auto-select item from URL (after renderAll)
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...anomalies, ...archaeology];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                showDetail(item);
                AppState.set('select', '');
            }
        }

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'anomalies' ? anomalies : archaeology;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'anomalies') {
                    const lStart = parseInt(levelStart.value, 10);
                    const lEnd = parseInt(levelEnd.value, 10);
                    if (item.level != null && (item.level < lStart || item.level > lEnd)) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            const total = activeTab === 'anomalies' ? anomalies.length : archaeology.length;
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            let html = '';
            for (const item of pageItems) {
                const descText = item.desc ? (I18n.t(item.desc) || '') : '';
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>`;
                if (descText) html += `<div class="item-card-description">${esc(descText)}</div>`;
                html += `<div class="item-card-meta">`;
                if (item.level != null) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.level')} ${esc(item.level)}</span>`;
                if (item.stages_count != null) html += `<span class="detail-meta-item">${esc(item.stages_count)} ${I18n.ui('ui.card.stages')}</span>`;
                if (item.max_once) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.unique')}</span>`;
                if (item.on_success) html += `<span class="detail-meta-item">${item.on_success.length} ${I18n.ui('ui.card.outcomes')}</span>`;
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
