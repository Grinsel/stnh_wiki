/**
 * Governments, Civics, Authorities, Policies & Edicts page controller.
 */
(async function initGovernments() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">Loading government data</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [governments, civics, authorities, policies, edicts] = await Promise.all([
            DataManager.loadJSON('assets/governments.json'),
            DataManager.loadJSON('assets/civics.json'),
            DataManager.loadJSON('assets/authorities.json'),
            DataManager.loadJSON('assets/policies.json'),
            DataManager.loadJSON('assets/edicts.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        const allData = { governments, civics, authorities, policies, edicts };
        for (const key of Object.keys(allData)) {
            for (const item of allData[key]) {
                item.name = I18n.t(item.name_key) || item.id;
            }
        }

        let activeTab = 'governments';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                document.getElementById('filter-origins-group').classList.toggle('hidden', activeTab !== 'civics');
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
            if (item.ruler_title) html += `<span class="detail-meta-item">Ruler: ${esc(I18n.t(item.ruler_title) || item.ruler_title)}</span>`;
            if (item.election_type) html += `<span class="detail-meta-item">Election: ${esc(item.election_type)}</span>`;
            if (item.has_heir) html += `<span class="detail-meta-item">Has Heir</span>`;
            if (item.is_origin) html += `<span class="detail-meta-item">Origin</span>`;
            if (item.length) html += `<span class="detail-meta-item">Duration: ${item.length}</span>`;
            if (item.is_ambition) html += `<span class="detail-meta-item">Ambition</span>`;
            html += `<span class="detail-meta-item">File: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Desc
            const descKey = item.id + '_desc';
            const desc = I18n.t(descKey);
            if (desc && desc !== descKey) {
                html += `<div class="detail-section"><div class="detail-section-title">Description</div>`;
                html += `<div class="detail-desc">${esc(desc)}</div></div>`;
            }

            if (item.prerequisites && item.prerequisites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">Prerequisites</div>`;
                html += `<div class="detail-meta">${item.prerequisites.map(t => `<span class="detail-meta-item">${esc(I18n.t(t) || t)}</span>`).join('')}</div></div>`;
            }

            if (item.resources) {
                html += `<div class="detail-section"><div class="detail-section-title">Resources</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.resources, null, 2))}</div></div>`;
            }

            if (item.modifier) {
                html += `<div class="detail-section"><div class="detail-section-title">Modifiers</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.modifier, null, 2))}</div></div>`;
            }

            if (item.possible) {
                html += `<div class="detail-section"><div class="detail-section-title">Requirements</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.possible, null, 2))}</div></div>`;
            }

            if (item.potential) {
                html += `<div class="detail-section"><div class="detail-section-title">Potential</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.potential, null, 2))}</div></div>`;
            }

            // Policy options
            if (item.options && item.options.length) {
                html += `<div class="detail-section"><div class="detail-section-title">Options</div>`;
                for (const opt of item.options) {
                    const optName = I18n.t(opt.name) || opt.name;
                    html += `<div class="option-card">`;
                    html += `<div class="option-name">${esc(optName)}</div>`;
                    if (opt.policy_flags && opt.policy_flags.length) {
                        html += `<div class="detail-meta">${opt.policy_flags.map(f => `<span class="detail-meta-item">${esc(f)}</span>`).join('')}</div>`;
                    }
                    if (opt.modifier) {
                        html += `<div class="code-block">${esc(JSON.stringify(opt.modifier, null, 2))}</div>`;
                    }
                    html += `</div>`;
                }
                html += `</div>`;
            }

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

        // Origins checkbox
        const originsCheckbox = document.getElementById('filter-origins');
        if (originsCheckbox) {
            originsCheckbox.addEventListener('change', () => { currentPage = 1; renderAll(); });
        }

        document.getElementById('lang-select').addEventListener('change', async (e) => {
            AppState.set('lang', e.target.value);
            await I18n.setLanguage(e.target.value);
            for (const key of Object.keys(allData)) {
                for (const item of allData[key]) item.name = I18n.t(item.name_key) || item.id;
            }
            renderAll();
        });

        renderAll();

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = allData[activeTab] || [];
            const total = items.length;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'civics' && originsCheckbox && originsCheckbox.checked) {
                    if (!item.is_origin) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
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
                if (item.ruler_title) html += `<span class="detail-meta-item">${esc(I18n.t(item.ruler_title) || item.ruler_title)}</span>`;
                if (item.election_type) html += `<span class="detail-meta-item">${esc(item.election_type)}</span>`;
                if (item.is_origin) html += `<span class="detail-meta-item">Origin</span>`;
                if (item.is_ambition) html += `<span class="detail-meta-item">Ambition</span>`;
                if (item.options) html += `<span class="detail-meta-item">${item.options.length} options</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">No items found</div>';

            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    const item = (allData[activeTab] || []).find(i => i.id === card.dataset.id);
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
