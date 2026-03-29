/**
 * Hub page - landing page for the STNH Wiki.
 * Injects item counts into section cards as badges.
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
    // Inject counts into Section Cards + Hub Meta
    // ========================================
    if (searchReady) {
        const counts = GlobalSearch.getStats();
        const total = GlobalSearch.getTotalCount();

        // Module → sub-type breakdown mapping
        const moduleBreakdown = {
            events:         [{ key: 'event', label: 'ui.nav.events' }],
            tech:           [{ key: 'tech', label: 'ui.nav.tech' }],
            ships:          [
                { key: 'ship', label: 'ui.tab.ships' },
                { key: 'component', label: 'ui.tab.components' },
            ],
            buildings:      [
                { key: 'building', label: 'ui.tab.buildings' },
                { key: 'district', label: 'ui.tab.districts' },
            ],
            traits:         [
                { key: 'trait', label: 'ui.tab.traits' },
                { key: 'tradition', label: 'ui.tab.traditions' },
                { key: 'ascension_perk', label: 'ui.tab.perks' },
            ],
            governments:    [
                { key: 'government', label: 'ui.tab.governments' },
                { key: 'civic', label: 'ui.tab.civics' },
                { key: 'authority', label: 'ui.tab.authorities' },
                { key: 'policy', label: 'ui.tab.policies' },
                { key: 'edict', label: 'ui.tab.edicts' },
            ],
            megastructures: [
                { key: 'megastructure', label: 'ui.tab.megastructures' },
                { key: 'relic', label: 'ui.tab.relics' },
            ],
            anomalies:      [
                { key: 'anomaly', label: 'ui.tab.anomalies' },
                { key: 'archaeology', label: 'ui.tab.archaeology' },
            ],
            empires:        [
                { key: 'empire', label: 'ui.tab.empires' },
                { key: 'species', label: 'ui.tab.species' },
            ],
            economy:        [
                { key: 'job', label: 'ui.tab.jobs' },
                { key: 'deposit', label: 'ui.tab.deposits' },
            ],
        };

        // Inject badges into each section card
        document.querySelectorAll('.section-card[data-module]').forEach(card => {
            const mod = card.dataset.module;
            const parts = moduleBreakdown[mod];
            if (!parts) return;

            const totalCount = parts.reduce((s, p) => s + (counts[p.key] || 0), 0);
            if (totalCount === 0) return;

            // Counter badge (top-right)
            const badge = document.createElement('span');
            badge.className = 'card-count';
            badge.textContent = totalCount.toLocaleString();
            card.appendChild(badge);

            // Sub-type breakdown (only if multiple sub-types)
            if (parts.length > 1) {
                const breakdown = document.createElement('div');
                breakdown.className = 'card-breakdown';
                breakdown.innerHTML = parts
                    .filter(p => (counts[p.key] || 0) > 0)
                    .map(p => `<span class="card-breakdown-tag">${I18n.ui(p.label)} <b>${(counts[p.key] || 0).toLocaleString()}</b></span>`)
                    .join('');
                card.appendChild(breakdown);
            }
        });

        // Hub meta line (total + last update)
        const metaEl = document.getElementById('hub-meta');
        if (metaEl) {
            let lastUpdateStr = '';
            try {
                const lastUpdate = await DataManager.loadJSON('assets/last_update.json');
                if (lastUpdate && lastUpdate.timestamp) {
                    const d = new Date(lastUpdate.timestamp);
                    lastUpdateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                }
            } catch (e) { /* ignore */ }

            let metaHtml = `<span class="hub-meta-item">${I18n.ui('ui.hub.total_items')}: <b>${total.toLocaleString()}</b></span>`;
            if (lastUpdateStr) {
                metaHtml += `<span class="hub-meta-sep">&middot;</span>`;
                metaHtml += `<span class="hub-meta-item">${I18n.ui('ui.hub.last_update')}: <b>${lastUpdateStr}</b></span>`;
            }
            metaEl.innerHTML = metaHtml;
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
