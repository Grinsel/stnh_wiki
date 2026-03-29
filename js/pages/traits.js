/**
 * Traits, Traditions & Ascension Perks page controller.
 */
(async function initTraits() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">Loading trait data</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [traits, traditions, perks] = await Promise.all([
            DataManager.loadJSON('assets/traits.json'),
            DataManager.loadJSON('assets/traditions.json'),
            DataManager.loadJSON('assets/ascension_perks.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        for (const item of traits) item.name = I18n.t(item.name_key) || item.id;
        for (const item of traditions) item.name = I18n.t(item.name_key) || item.id;
        for (const item of perks) item.name = I18n.t(item.name_key) || item.id;

        // Populate class dropdown (traits)
        const classes = [...new Set(traits.map(t => t.leader_class).filter(Boolean))].sort();
        const classSel = document.getElementById('filter-class');
        for (const c of classes) classSel.add(new Option(c, c));

        // Populate tree dropdown (traditions)
        const trees = [...new Set(traditions.map(t => t.tree).filter(Boolean))].sort();
        const treeSel = document.getElementById('filter-tree');
        for (const t of trees) treeSel.add(new Option(t, t));

        let activeTab = 'traits';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                document.getElementById('filter-class-group').classList.toggle('hidden', activeTab !== 'traits');
                document.getElementById('filter-tree-group').classList.toggle('hidden', activeTab !== 'traditions');
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
            if (item.leader_class) html += `<span class="detail-meta-item">Class: ${esc(item.leader_class)}</span>`;
            if (item.rarity) html += `<span class="detail-meta-item">Rarity: ${esc(item.rarity)}</span>`;
            if (item.tier) html += `<span class="detail-meta-item">Tier: ${esc(item.tier)}</span>`;
            if (item.tree) html += `<span class="detail-meta-item">Tree: ${esc(item.tree)}</span>`;
            if (item.role) html += `<span class="detail-meta-item">Role: ${esc(item.role)}</span>`;
            if (item.cost != null) html += `<span class="detail-meta-item">Cost: ${item.cost}</span>`;
            html += `<span class="detail-meta-item">File: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Desc (from loc)
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

            if (item.opposites && item.opposites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">Opposites</div>`;
                html += `<div class="detail-meta">${item.opposites.map(o => `<span class="detail-meta-item">${esc(I18n.t(o) || o)}</span>`).join('')}</div></div>`;
            }

            if (item.modifier) {
                html += `<div class="detail-section"><div class="detail-section-title">Modifiers</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.modifier, null, 2))}</div></div>`;
            }

            if (item.possible) {
                html += `<div class="detail-section"><div class="detail-section-title">Requirements</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.possible, null, 2))}</div></div>`;
            }

            if (item.on_enabled) {
                html += `<div class="detail-section"><div class="detail-section-title">On Enabled</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.on_enabled, null, 2))}</div></div>`;
            }

            if (item.tradition_swap) {
                html += `<div class="detail-section"><div class="detail-section-title">Tradition Swaps</div>`;
                html += `<div class="code-block">${esc(JSON.stringify(item.tradition_swap, null, 2))}</div></div>`;
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

        classSel.addEventListener('change', () => { currentPage = 1; renderAll(); });
        treeSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        document.getElementById('lang-select').addEventListener('change', async (e) => {
            AppState.set('lang', e.target.value);
            await I18n.setLanguage(e.target.value);
            for (const item of traits) item.name = I18n.t(item.name_key) || item.id;
            for (const item of traditions) item.name = I18n.t(item.name_key) || item.id;
            for (const item of perks) item.name = I18n.t(item.name_key) || item.id;
            renderAll();
        });

        renderAll();

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items;
            let total;
            if (activeTab === 'traits') {
                items = traits; total = traits.length;
            } else if (activeTab === 'traditions') {
                items = traditions; total = traditions.length;
            } else {
                items = perks; total = perks.length;
            }

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'traits') {
                    const cls = classSel.value;
                    if (cls && item.leader_class !== cls) return false;
                } else if (activeTab === 'traditions') {
                    const tree = treeSel.value;
                    if (tree && item.tree !== tree) return false;
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
                if (item.leader_class) html += `<span class="detail-meta-item">${esc(item.leader_class)}</span>`;
                if (item.rarity) html += `<span class="detail-meta-item">${esc(item.rarity)}</span>`;
                if (item.tree) html += `<span class="detail-meta-item">${esc(item.tree)}</span>`;
                if (item.role && item.role !== 'node') html += `<span class="detail-meta-item">${esc(item.role)}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">No items found</div>';

            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    const allItems = activeTab === 'traits' ? traits : activeTab === 'traditions' ? traditions : perks;
                    const item = allItems.find(i => i.id === card.dataset.id);
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
