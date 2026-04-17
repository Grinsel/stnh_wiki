/**
 * Exploration page controller.
 * Handles: Anomalies, Archaeology.
 */
(async function initExploration() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.anomalies') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search') || '';

    // ── Tab & state ─────────────────────────────────────────────────────────
    let activeTab  = 'anomalies';
    let currentPage = 1;
    const PAGE_SIZE = 100;

    try {
        // ── Load data ───────────────────────────────────────────────────────
        const [anomalies, archaeology] = await Promise.all([
            DataManager.loadJSON('assets/anomalies.json'),
            DataManager.loadJSON('assets/archaeology.json'),
        ]);
        await DataManager.loadPicturesMap();
        await I18n.setLanguageForModule(AppState.get('lang'), 'anomalies');

        // ── Localize names ──────────────────────────────────────────────────
        for (const item of anomalies)   item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
        for (const item of archaeology) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;

        // ── Anomalies: level range filter ────────────────────────────────────
        const levelStart = document.getElementById('filter-level-start');
        const levelEnd   = document.getElementById('filter-level-end');
        const LEVEL_MIN  = parseInt(levelStart.min, 10);
        const LEVEL_MAX  = parseInt(levelStart.max, 10);

        function syncLevelFilter(trigger = true) {
            let s = parseInt(levelStart.value, 10);
            let e = parseInt(levelEnd.value, 10);
            if (s > e) { levelStart.value = e; s = e; }
            if (e < s) { levelEnd.value = s; e = s; }
            const range = LEVEL_MAX - LEVEL_MIN;
            const display = document.getElementById('level-filter-display');
            if (display) display.textContent = `${s}\u2013${e}`;
            const fill = document.getElementById('level-filter-fill');
            if (fill && range > 0) {
                fill.style.marginLeft = ((s - LEVEL_MIN) / range * 100) + '%';
                fill.style.width      = ((e - s) / range * 100) + '%';
            }
            if (trigger) { currentPage = 1; renderAll(); }
        }
        levelStart.addEventListener('input', () => syncLevelFilter());
        levelEnd.addEventListener('input',   () => syncLevelFilter());
        syncLevelFilter(false);

        // ── Filter visibility helper ─────────────────────────────────────────
        function updateFilterVis() {
            document.getElementById('filter-level-group').classList.toggle('hidden', activeTab !== 'anomalies');
        }

        // ── Tab switching ────────────────────────────────────────────────────
        document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                updateFilterVis();
                SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
                renderAll();
            });
        });

        // ── Detail panel ─────────────────────────────────────────────────────
        const detailPanel    = document.getElementById('detail-panel');
        const detailTitle    = document.getElementById('detail-title');
        const detailContent  = document.getElementById('detail-content');

        let _panelLeaveTimer = null;

        function openDetailPanel() {
            clearTimeout(_panelLeaveTimer);
            const wasHidden = detailPanel.classList.contains('hidden');
            detailPanel.classList.remove('hidden', 'detail-leaving');
            if (wasHidden) {
                detailPanel.classList.add('detail-entering');
                void detailPanel.offsetWidth;
                detailPanel.classList.remove('detail-entering');
            }
        }

        function closeDetailPanel() {
            clearTimeout(_panelLeaveTimer);
            detailPanel.classList.add('detail-leaving');
            _panelLeaveTimer = setTimeout(() => {
                detailPanel.classList.remove('detail-leaving');
                SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
            }, 340);
        }

        document.getElementById('detail-close').addEventListener('click', closeDetailPanel);

        // ── showDetail ───────────────────────────────────────────────────────
        function showDetail(item) {
            SharedRender.hidePlaceholder(detailPanel);
            detailTitle.textContent = item.name || item.id;
            detailContent.innerHTML = activeTab === 'archaeology' ? buildArchaeologyDetailHtml(item) : buildAnomalyDetailHtml(item);
            SharedRender.initToggles(detailContent);
            SharedRender.initTechLinks(detailContent);
            SharedRender.initWikiLinks(detailContent);
            openDetailPanel();
        }

        // ── Anomaly detail ──────────────────────────────────────────────────
        function buildAnomalyDetailHtml(item) {
            let html = '';
            if (item.picture) {
                const picUrl = DataManager.getPictureUrl(item.picture);
                if (picUrl) html += `<div class="detail-picture"><img src="${picUrl}" alt="" onerror="this.parentElement.style.display='none'"></div>`;
            }
            if (item.desc) {
                const descText = I18n.t(item.desc) || item.desc;
                if (descText) html += `<div class="detail-description">${esc(descText)}</div>`;
            }
            html += `<div class="detail-meta">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            const stats = [];
            if (item.level != null) stats.push([I18n.ui('ui.meta.level'), item.level]);
            if (item.max_once)      stats.push([I18n.ui('ui.meta.max_once'), I18n.ui('ui.misc.yes')]);
            if (stats.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
            }
            if (item.on_success && item.on_success.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.success_outcomes')}</div>`;
                html += `<div class="detail-meta">${item.on_success.map(o => `<span class="detail-meta-item">${SharedRender.wikiLink(o.event, 'event')} (weight: ${esc(o.weight)})</span>`).join('')}</div></div>`;
            }
            if (item.spawn_chance)      html += `<div class="detail-section">${SharedRender.dualView(item.spawn_chance, I18n.ui('ui.detail.spawn_chance'))}</div>`;
            if (item.on_spawn)          html += `<div class="detail-section">${SharedRender.dualView(item.on_spawn, I18n.ui('ui.detail.on_spawn'))}</div>`;
            if (item.modifier)          html += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifier'))}</div>`;
            return html;
        }

        // ── Archaeology detail ──────────────────────────────────────────────
        function buildArchaeologyDetailHtml(item) {
            let html = '';
            if (item.picture) {
                const picUrl = DataManager.getPictureUrl(item.picture);
                if (picUrl) html += `<div class="detail-picture"><img src="${picUrl}" alt="" onerror="this.parentElement.style.display='none'"></div>`;
            }
            if (item.desc) {
                const descText = I18n.t(item.desc) || item.desc;
                if (descText) html += `<div class="detail-description">${esc(descText)}</div>`;
            }
            html += `<div class="detail-meta">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;
            const stats = [];
            if (item.stages_count != null) stats.push([I18n.ui('ui.card.stages'), item.stages_count]);
            if (stats.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stats')}</div>`;
                html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
            }
            if (item.stages && item.stages.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.stages')}</div>`;
                html += `<div class="detail-meta">${item.stages.map((s,i) => `<span class="detail-meta-item">${I18n.ui('ui.card.stage')} ${i+1}: ${esc(s.lead_time || '')}</span>`).join('')}</div></div>`;
            }
            return html;
        }

        // ── Search ───────────────────────────────────────────────────────────
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                AppState.set('search', e.target.value);
                currentPage = 1; renderAll();
            }, 200);
        });

        // ── Language change ──────────────────────────────────────────────────
        document.addEventListener('wiki-lang-changed', () => {
            for (const item of anomalies)   item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
            for (const item of archaeology) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
            renderAll();
        });

        // ── Restore tab from URL ─────────────────────────────────────────────
        const urlTab = AppState.get('tab');
        if (urlTab) {
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${urlTab}"]`);
            if (tabBtn) {
                document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                activeTab = urlTab;
                updateFilterVis();
            }
        }
        const urlSearch = new URLSearchParams(window.location.search).get('search');
        if (urlSearch && !AppState.get('search')) {
            searchInput.value = urlSearch;
            AppState.set('search', urlSearch);
        }
        updateFilterVis();
        renderAll();
        SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
        I18n.loadFullLocalisation();
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...anomalies, ...archaeology];
            const item = allItems.find(i => i.id === selectId);
            if (item) { showDetail(item); AppState.set('select', ''); }
        }

        // ── renderAll ────────────────────────────────────────────────────────
        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            const source = activeTab === 'archaeology' ? archaeology : anomalies;
            renderAnomaliesList(source, query);
        }

        function renderAnomaliesList(source, query) {
            const s = parseInt(levelStart.value, 10);
            const e = parseInt(levelEnd.value,   10);
            let items = source.filter(item => {
                if (query && !(item.name||'').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'anomalies' && item.level != null) {
                    if (item.level < s || item.level > e) return false;
                }
                return true;
            });
            items.sort((a, b) => (a.name||a.id).localeCompare(b.name||b.id));
            document.getElementById('filter-stats').textContent = `${items.length} / ${source.length} ${I18n.ui('ui.tab.' + activeTab)}`;
            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems  = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
            let html = '';
            for (const item of pageItems) {
                const descText = item.desc ? (I18n.t(item.desc) || '') : '';
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name||item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>`;
                if (descText) html += `<div class="item-card-description">${esc(descText)}</div>`;
                html += `<div class="item-card-meta">`;
                if (item.level != null)     html += `<span class="detail-meta-item">${I18n.ui('ui.meta.level')} ${esc(item.level)}</span>`;
                if (item.stages_count != null) html += `<span class="detail-meta-item">${esc(item.stages_count)} ${I18n.ui('ui.card.stages')}</span>`;
                if (item.max_once)          html += `<span class="detail-meta-item">${I18n.ui('ui.badge.unique')}</span>`;
                if (item.on_success)        html += `<span class="detail-meta-item">${item.on_success.length} ${I18n.ui('ui.card.outcomes')}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || `<div class="loading" style="animation:none">${I18n.ui('ui.empty.no_items')}</div>`;
            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => { listEl.querySelectorAll('.item-card').forEach(c => c.classList.remove('active')); card.classList.add('active'); const item = items.find(i => i.id === card.dataset.id); if (item) showDetail(item); });
            });
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
                btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.page); renderAll(); listEl.scrollIntoView({ behavior: 'smooth' }); });
            });
        }

    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">${I18n.ui('ui.error.load_failed')}: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
})();
