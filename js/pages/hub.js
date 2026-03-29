/**
 * Hub page - landing page for the STNH Wiki.
 * Shows stats dashboard, global search, and section cards.
 * Search: live preview dropdown while typing, full results page on Enter.
 */
(async function initHub() {
    AppState.init();
    Common.init();

    const hubContent = document.getElementById('hub-content');
    if (!hubContent) return;

    // Init localisation
    try {
        await I18n.setLanguage(AppState.get('lang'));
    } catch (e) {
        console.warn('Hub: localisation init failed:', e.message);
    }

    // Init global search
    let searchReady = false;
    if (typeof GlobalSearch !== 'undefined') {
        try {
            searchReady = await GlobalSearch.init();
            if (searchReady) GlobalSearch.setLocReady(true);
        } catch (e) {
            console.warn('Hub: GlobalSearch init failed:', e.message);
        }
    }

    // ========================================
    // Stats Dashboard
    // ========================================
    const statsEl = document.getElementById('stats-dashboard');
    if (statsEl) {
        if (searchReady) {
            const counts = GlobalSearch.getStats();
            const total = GlobalSearch.getTotalCount();

            // Each module card: label, href, and breakdown of sub-types
            const moduleStats = [
                { label: I18n.ui('ui.nav.events'), href: 'events.html', parts: [
                    { name: I18n.ui('ui.nav.events'), count: counts.event || 0 },
                ]},
                { label: I18n.ui('ui.nav.ships'), href: 'ships.html', parts: [
                    { name: I18n.ui('ui.tab.ships'), count: counts.ship || 0 },
                    { name: I18n.ui('ui.tab.components'), count: counts.component || 0 },
                ]},
                { label: I18n.ui('ui.nav.buildings'), href: 'buildings.html', parts: [
                    { name: I18n.ui('ui.tab.buildings'), count: counts.building || 0 },
                    { name: I18n.ui('ui.tab.districts'), count: counts.district || 0 },
                ]},
                { label: I18n.ui('ui.nav.traits'), href: 'traits.html', parts: [
                    { name: I18n.ui('ui.tab.traits'), count: counts.trait || 0 },
                    { name: I18n.ui('ui.tab.traditions'), count: counts.tradition || 0 },
                    { name: I18n.ui('ui.tab.perks'), count: counts.ascension_perk || 0 },
                ]},
                { label: I18n.ui('ui.nav.governments'), href: 'governments.html', parts: [
                    { name: I18n.ui('ui.tab.governments'), count: counts.government || 0 },
                    { name: I18n.ui('ui.tab.civics'), count: counts.civic || 0 },
                    { name: I18n.ui('ui.tab.authorities'), count: counts.authority || 0 },
                    { name: I18n.ui('ui.tab.policies'), count: counts.policy || 0 },
                    { name: I18n.ui('ui.tab.edicts'), count: counts.edict || 0 },
                ]},
                { label: I18n.ui('ui.nav.megastructures'), href: 'megastructures.html', parts: [
                    { name: I18n.ui('ui.tab.megastructures'), count: counts.megastructure || 0 },
                    { name: I18n.ui('ui.tab.relics'), count: counts.relic || 0 },
                ]},
                { label: I18n.ui('ui.nav.anomalies'), href: 'anomalies.html', parts: [
                    { name: I18n.ui('ui.tab.anomalies'), count: counts.anomaly || 0 },
                    { name: I18n.ui('ui.tab.archaeology'), count: counts.archaeology || 0 },
                ]},
                { label: I18n.ui('ui.nav.empires'), href: 'empires.html', parts: [
                    { name: I18n.ui('ui.tab.empires'), count: counts.empire || 0 },
                    { name: I18n.ui('ui.tab.species'), count: counts.species || 0 },
                ]},
                { label: I18n.ui('ui.nav.economy'), href: 'economy.html', parts: [
                    { name: I18n.ui('ui.tab.jobs'), count: counts.job || 0 },
                    { name: I18n.ui('ui.tab.deposits'), count: counts.deposit || 0 },
                ]},
            ];

            let lastUpdateInfo = '';
            try {
                const lastUpdate = await DataManager.loadJSON('assets/last_update.json');
                if (lastUpdate && lastUpdate.timestamp) {
                    const d = new Date(lastUpdate.timestamp);
                    lastUpdateInfo = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                }
            } catch (e) { /* ignore */ }

            let html = `
                <div class="stat-card highlight">
                    <div class="stat-label">${I18n.ui('ui.hub.total_items')}</div>
                    <div class="stat-value">${total.toLocaleString()}</div>
                </div>
            `;

            for (const mod of moduleStats) {
                const totalCount = mod.parts.reduce((s, p) => s + p.count, 0);
                const hasParts = mod.parts.length > 1;
                let breakdownHtml = '';
                if (hasParts) {
                    breakdownHtml = '<div class="stat-breakdown">'
                        + mod.parts.map(p =>
                            `<span class="stat-part">${p.name} <b>${p.count.toLocaleString()}</b></span>`
                        ).join('')
                        + '</div>';
                }
                html += `
                    <a href="${mod.href}" class="stat-card clickable">
                        <div class="stat-label">${mod.label}</div>
                        <div class="stat-value">${totalCount.toLocaleString()}</div>
                        ${breakdownHtml}
                    </a>
                `;
            }

            if (lastUpdateInfo) {
                html += `
                    <div class="stat-card">
                        <div class="stat-label">${I18n.ui('ui.hub.last_update')}</div>
                        <div class="stat-value">${lastUpdateInfo}</div>
                    </div>
                `;
            }

            statsEl.innerHTML = html;
        } else {
            try {
                const lastUpdate = await DataManager.loadJSON('assets/last_update.json');
                if (lastUpdate) {
                    const ts = lastUpdate.timestamp
                        ? new Date(lastUpdate.timestamp).toLocaleString()
                        : 'Unknown';
                    statsEl.innerHTML = `
                        <div class="stat-card">
                            <div class="stat-label">${I18n.ui('ui.hub.last_update')}</div>
                            <div class="stat-value">${ts}</div>
                        </div>
                    `;
                }
            } catch (e) {
                statsEl.innerHTML = '';
            }
        }
    }

    // ========================================
    // Global Search - Preview Dropdown + Full Results
    // ========================================
    const searchInput = document.getElementById('global-search-input');
    const resultsContainer = document.getElementById('global-search-results');

    if (searchInput && resultsContainer && searchReady) {
        let searchTimeout;
        let isFullResultsMode = false;

        // Live preview while typing
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = searchInput.value.trim();
                if (!query) {
                    hidePreview();
                    return;
                }
                if (!isFullResultsMode) {
                    renderPreview(query);
                }
            }, 150);
        });

        // Enter → full results; Escape → close
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    hidePreview();
                    renderFullResults(query);
                }
            } else if (e.key === 'Escape') {
                if (isFullResultsMode) {
                    exitFullResults();
                } else {
                    searchInput.value = '';
                    hidePreview();
                }
            }
        });

        // Click outside → close preview
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                hidePreview();
            }
        });

        function buildSynonymHint(query) {
            const expanded = GlobalSearch.getExpandedInfo(query);
            if (!expanded.length) return '';
            const parts = expanded.map(e =>
                `<b>${esc(e.term)}</b> &rarr; ${e.synonyms.map(s => esc(s)).join(', ')}`
            );
            return `<div class="search-synonym-hint">${I18n.ui('ui.search.also_searching')}: ${parts.join('; ')}</div>`;
        }

        function hidePreview() {
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
        }

        // ---- Preview dropdown (max 5 per type) ----
        function renderPreview(query) {
            const results = GlobalSearch.searchPreview(query, 5);

            if (!results.length) {
                resultsContainer.innerHTML = '<div class="search-no-results">' + I18n.ui('ui.empty.no_results') + '</div>';
                resultsContainer.classList.remove('hidden');
                return;
            }

            // Group by type label
            const grouped = {};
            for (const r of results) {
                const key = r.label;
                if (!grouped[key]) grouped[key] = { items: [], total: 0 };
                grouped[key].items.push(r);
                grouped[key].total = r._totalForType || grouped[key].items.length;
            }

            const totalMatches = Object.values(grouped).reduce((sum, g) => sum + g.total, 0);
            const synonymHtml = buildSynonymHint(query);

            let html = '<div class="search-results-inner">';
            html += `<div class="search-results-header">${totalMatches} ${totalMatches !== 1 ? I18n.ui('ui.search.matches_plural') : I18n.ui('ui.search.matches')} &mdash; ${I18n.ui('ui.search.press_enter')}${synonymHtml}</div>`;

            for (const [typeName, group] of Object.entries(grouped)) {
                html += `<div class="search-group">`;
                const moreCount = group.total - group.items.length;
                html += `<div class="search-group-title">${esc(typeName)} (${group.total})${moreCount > 0 ? ` &mdash; +${moreCount} ${I18n.ui('ui.search.more')}` : ''}</div>`;
                for (const item of group.items) {
                    const url = GlobalSearch.getItemUrl(item);
                    const name = item.name || item.id;
                    const metaStr = Object.entries(item.meta)
                        .map(([k, v]) => `${v}`)
                        .filter(Boolean)
                        .join(' | ');
                    html += `<a href="${esc(url)}" class="search-result-item">
                        <span class="search-result-name">${esc(name)}</span>
                        <span class="search-result-id">${esc(item.id)}</span>
                        ${metaStr ? `<span class="search-result-meta">${esc(metaStr)}</span>` : ''}
                    </a>`;
                }
                html += `</div>`;
            }

            html += '</div>';
            resultsContainer.innerHTML = html;
            resultsContainer.classList.remove('hidden');
        }

        // ---- Full results page (all matches) ----
        function renderFullResults(query) {
            isFullResultsMode = true;
            const results = GlobalSearch.searchFull(query);

            // Group by type
            const grouped = {};
            const typeOrder = [];
            for (const r of results) {
                const key = r.type;
                if (!grouped[key]) {
                    grouped[key] = { label: r.label, items: [] };
                    typeOrder.push(key);
                }
                grouped[key].items.push(r);
            }

            // Sort groups by TYPE_ORDER
            typeOrder.sort((a, b) => {
                const ia = GlobalSearch.TYPE_ORDER.indexOf(a);
                const ib = GlobalSearch.TYPE_ORDER.indexOf(b);
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            });

            const synonymHtml = buildSynonymHint(query);

            // Replace hub content with full results
            let html = '<div class="full-results">';
            html += `<div class="full-results-bar">`;
            html += `<button id="full-results-back" class="btn-back" title="${I18n.ui('ui.search.back')}">&larr; ${I18n.ui('ui.search.back')}</button>`;
            html += `<span class="full-results-summary">${results.length} ${results.length !== 1 ? I18n.ui('ui.search.results') : I18n.ui('ui.search.result')} ${I18n.ui('ui.search.results_for')} &ldquo;${esc(query)}&rdquo;${synonymHtml}</span>`;
            html += `</div>`;

            if (!results.length) {
                html += '<div class="search-no-results">' + I18n.ui('ui.empty.no_results_any') + '</div>';
            } else {
                // Type filter buttons
                html += '<div class="full-results-filters">';
                html += `<button class="type-filter-btn active" data-type="all">${I18n.ui('ui.search.all')} (${results.length})</button>`;
                for (const t of typeOrder) {
                    const g = grouped[t];
                    html += `<button class="type-filter-btn" data-type="${esc(t)}">${esc(g.label)} (${g.items.length})</button>`;
                }
                html += '</div>';

                // Results grouped by type
                for (const t of typeOrder) {
                    const g = grouped[t];
                    html += `<div class="full-results-group" data-group-type="${esc(t)}">`;
                    html += `<h3 class="full-results-group-title">${esc(g.label)} <span class="count">(${g.items.length})</span></h3>`;
                    html += '<div class="full-results-list">';
                    for (const item of g.items) {
                        const url = GlobalSearch.getItemUrl(item);
                        const name = item.name || item.id;
                        const metaParts = Object.entries(item.meta)
                            .filter(([k, v]) => v)
                            .map(([k, v]) => `<span class="meta-tag">${esc(k)}: ${esc(v)}</span>`);
                        html += `<a href="${esc(url)}" class="full-result-item">
                            <span class="full-result-name">${esc(name)}</span>
                            <span class="full-result-id">${esc(item.id)}</span>
                            ${metaParts.length ? `<span class="full-result-meta">${metaParts.join('')}</span>` : ''}
                        </a>`;
                    }
                    html += '</div></div>';
                }
            }

            html += '</div>';
            hubContent.innerHTML = html;

            // Back button
            document.getElementById('full-results-back').addEventListener('click', () => {
                exitFullResults();
            });

            // Type filter buttons
            const filterBtns = hubContent.querySelectorAll('.type-filter-btn');
            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const filterType = btn.dataset.type;
                    hubContent.querySelectorAll('.full-results-group').forEach(group => {
                        if (filterType === 'all' || group.dataset.groupType === filterType) {
                            group.style.display = '';
                        } else {
                            group.style.display = 'none';
                        }
                    });
                });
            });
        }

        function exitFullResults() {
            isFullResultsMode = false;
            searchInput.value = '';
            // Reload page to restore hub content
            location.reload();
        }
    }

    // ========================================
    // Language change
    // ========================================
    document.addEventListener('wiki-lang-changed', () => {
        if (searchReady) GlobalSearch.setLocReady(true);
    });

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
})();
