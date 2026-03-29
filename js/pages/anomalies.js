/**
 * Anomalies & Archaeology page controller.
 */
(async function initAnomalies() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">Loading anomaly data</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [anomalies, archaeology] = await Promise.all([
            DataManager.loadJSON('assets/anomalies.json'),
            DataManager.loadJSON('assets/archaeology.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        for (const item of anomalies) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
        for (const item of archaeology) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;

        // Populate level dropdown
        const levels = [...new Set(anomalies.map(a => a.level).filter(v => v != null))].sort((a,b) => a - b);
        const levelSel = document.getElementById('filter-level');
        for (const l of levels) {
            levelSel.add(new Option(`Level ${l}`, l));
        }

        let activeTab = 'anomalies';
        let currentPage = 1;
        const PAGE_SIZE = 100;

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
            let html = `<div class="detail-meta">`;
            html += `<span class="detail-meta-item">ID: ${esc(item.id)}</span>`;
            if (item.desc) html += `<span class="detail-meta-item">Desc: ${esc(I18n.t(item.desc) || item.desc)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">File: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Anomaly-specific
            if (activeTab === 'anomalies') {
                const stats = [];
                if (item.level != null) stats.push(['Level', item.level]);
                if (item.picture) stats.push(['Picture', item.picture]);
                if (item.max_once) stats.push(['Max Once', 'Yes']);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Stats</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.on_success && item.on_success.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Success Outcomes</div>`;
                    html += `<div class="detail-meta">${item.on_success.map(o => `<span class="detail-meta-item">${esc(o.event)} (weight: ${esc(o.weight)})</span>`).join('')}</div></div>`;
                }
                if (item.spawn_chance) {
                    html += `<div class="detail-section"><div class="detail-section-title">Spawn Chance</div>`;
                    html += `<div class="code-block">${esc(JSON.stringify(item.spawn_chance, null, 2))}</div></div>`;
                }
            }

            // Archaeology-specific
            if (activeTab === 'archaeology') {
                const stats = [];
                if (item.stages_count != null) stats.push(['Stages', item.stages_count]);
                if (item.max_instances != null) stats.push(['Max Instances', item.max_instances]);
                if (item.picture) stats.push(['Picture', item.picture]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Stats</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.stages && item.stages.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Stages</div>`;
                    for (let i = 0; i < item.stages.length; i++) {
                        const s = item.stages[i];
                        html += `<div class="detail-meta"><span class="detail-meta-item">Stage ${i+1}: difficulty ${esc(s.difficulty)}</span>`;
                        if (s.event) html += `<span class="detail-meta-item">Event: ${esc(s.event)}</span>`;
                        if (s.icon) html += `<span class="detail-meta-item">Icon: ${esc(s.icon)}</span>`;
                        html += `</div>`;
                    }
                    html += `</div>`;
                }
                if (item.weight) {
                    html += `<div class="detail-section"><div class="detail-section-title">Weight</div>`;
                    html += `<div class="code-block">${esc(JSON.stringify(item.weight, null, 2))}</div></div>`;
                }
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
        levelSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // Language change
        document.getElementById('lang-select').addEventListener('change', async (e) => {
            AppState.set('lang', e.target.value);
            await I18n.setLanguage(e.target.value);
            for (const item of anomalies) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
            for (const item of archaeology) item.name = I18n.t(item.name_key) || I18n.t(item.desc) || item.id;
            renderAll();
        });

        renderAll();

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'anomalies' ? anomalies : archaeology;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'anomalies') {
                    const level = levelSel.value;
                    if (level && String(item.level) !== level) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            const total = activeTab === 'anomalies' ? anomalies.length : archaeology.length;
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
                if (item.level != null) html += `<span class="detail-meta-item">Level ${esc(item.level)}</span>`;
                if (item.stages_count != null) html += `<span class="detail-meta-item">${esc(item.stages_count)} stages</span>`;
                if (item.max_once) html += `<span class="detail-meta-item">Unique</span>`;
                if (item.on_success) html += `<span class="detail-meta-item">${item.on_success.length} outcomes</span>`;
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
