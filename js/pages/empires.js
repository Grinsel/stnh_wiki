/**
 * Empires & Species page controller.
 */
(async function initEmpires() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">Loading empire data</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [empires, species] = await Promise.all([
            DataManager.loadJSON('assets/empires.json'),
            DataManager.loadJSON('assets/species.json'),
        ]);
        await I18n.setLanguage(AppState.get('lang'));

        for (const item of empires) item.name = I18n.t(item.name_key) || item.id;
        for (const item of species) item.name = I18n.t(item.name_key) || item.id;

        // Populate authority dropdown
        const authorities = [...new Set(empires.map(e => e.authority).filter(Boolean))].sort();
        const authSel = document.getElementById('filter-authority');
        for (const a of authorities) {
            authSel.add(new Option(a, a));
        }

        // Populate archetype dropdown
        const archetypes = [...new Set(species.map(s => s.archetype).filter(Boolean))].sort();
        const archSel = document.getElementById('filter-archetype');
        for (const a of archetypes) {
            archSel.add(new Option(a, a));
        }

        let activeTab = 'empires';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                document.getElementById('filter-authority-group').classList.toggle('hidden', activeTab !== 'empires');
                document.getElementById('filter-archetype-group').classList.toggle('hidden', activeTab !== 'species');
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
            if (item.source_file) html += `<span class="detail-meta-item">File: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Empire-specific
            if (activeTab === 'empires') {
                const stats = [];
                if (item.authority) stats.push(['Authority', item.authority]);
                if (item.government) stats.push(['Government', item.government]);
                if (item.origin) stats.push(['Origin', item.origin]);
                if (item.ship_prefix) stats.push(['Ship Prefix', item.ship_prefix]);
                if (item.graphical_culture) stats.push(['Culture', item.graphical_culture]);
                if (item.planet_name) stats.push(['Homeworld', item.planet_name]);
                if (item.planet_class) stats.push(['Planet Class', item.planet_class]);
                if (item.system_name) stats.push(['System', item.system_name]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Info</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.ethics && item.ethics.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Ethics</div>`;
                    html += `<div class="detail-meta">${item.ethics.map(e => `<span class="detail-meta-item">${esc(I18n.t(e) || e)}</span>`).join('')}</div></div>`;
                }
                if (item.civics && item.civics.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Civics</div>`;
                    html += `<div class="detail-meta">${item.civics.map(c => `<span class="detail-meta-item">${esc(I18n.t(c) || c)}</span>`).join('')}</div></div>`;
                }
                if (item.species) {
                    html += `<div class="detail-section"><div class="detail-section-title">Species</div>`;
                    html += `<div class="code-block">${esc(JSON.stringify(item.species, null, 2))}</div></div>`;
                }
                if (item.ruler) {
                    html += `<div class="detail-section"><div class="detail-section-title">Ruler</div>`;
                    html += `<div class="code-block">${esc(JSON.stringify(item.ruler, null, 2))}</div></div>`;
                }
            }

            // Species-specific
            if (activeTab === 'species') {
                const stats = [];
                if (item.archetype) stats.push(['Archetype', item.archetype]);
                if (item.graphical_culture) stats.push(['Culture', item.graphical_culture]);
                if (item.uplifted_into) stats.push(['Uplifted Into', item.uplifted_into]);
                if (item.gender != null) stats.push(['Gender', item.gender]);
                if (stats.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Info</div>`;
                    html += `<div class="detail-meta">${stats.map(([k,v]) => `<span class="detail-meta-item">${k}: ${esc(v)}</span>`).join('')}</div></div>`;
                }
                if (item.portraits && item.portraits.length) {
                    html += `<div class="detail-section"><div class="detail-section-title">Portraits</div>`;
                    html += `<div class="detail-meta">${item.portraits.map(p => `<span class="detail-meta-item">${esc(p)}</span>`).join('')}</div></div>`;
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
        authSel.addEventListener('change', () => { currentPage = 1; renderAll(); });
        archSel.addEventListener('change', () => { currentPage = 1; renderAll(); });

        // Language change
        document.getElementById('lang-select').addEventListener('change', async (e) => {
            AppState.set('lang', e.target.value);
            await I18n.setLanguage(e.target.value);
            for (const item of empires) item.name = I18n.t(item.name_key) || item.id;
            for (const item of species) item.name = I18n.t(item.name_key) || item.id;
            renderAll();
        });

        renderAll();

        function renderAll() {
            const query = (AppState.get('search') || '').toLowerCase();
            let items = activeTab === 'empires' ? empires : species;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'empires') {
                    const auth = authSel.value;
                    if (auth && item.authority !== auth) return false;
                } else {
                    const arch = archSel.value;
                    if (arch && item.archetype !== arch) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

            const total = activeTab === 'empires' ? empires.length : species.length;
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
                if (item.authority) html += `<span class="detail-meta-item">${esc(item.authority)}</span>`;
                if (item.government) html += `<span class="detail-meta-item">${esc(item.government)}</span>`;
                if (item.archetype) html += `<span class="detail-meta-item">${esc(item.archetype)}</span>`;
                if (item.graphical_culture) html += `<span class="detail-meta-item">${esc(item.graphical_culture)}</span>`;
                if (item.ethics && item.ethics.length) html += `<span class="detail-meta-item">${item.ethics.length} ethics</span>`;
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
