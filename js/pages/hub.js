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

    // Load ships.json for model_variants count (not in search index)
    let shipsStats = null;
    try {
        const shipsData = await DataManager.loadJSON('assets/ships.json');
        if (shipsData && shipsData.stats) shipsStats = shipsData.stats;
    } catch (e) { /* ignore */ }

    // ========================================
    // Inject counts into Section Cards + Hub Meta
    // ========================================
    if (searchReady) {
        const counts = GlobalSearch.getStats();
        const total = GlobalSearch.getTotalCount();

        // Module → sub-type breakdown mapping (url: destination when clicking the tag)
        const moduleBreakdown = {
            events:      [{ key: 'event',        label: 'ui.nav.events',          url: 'events.html' }],
            tech:        [{ key: 'technology',   label: 'ui.nav.tech',            url: 'tech-list.html' }],
            exploration: [
                { key: 'anomaly',       label: 'ui.tab.anomalies',   url: 'exploration.html' },
                { key: 'archaeology',   label: 'ui.tab.archaeology',  url: 'exploration.html?tab=archaeology' },
            ],
            empire:      [
                { key: 'empire',        label: 'ui.tab.empires',     url: 'empires.html' },
            ],
            governance:  [
                { key: 'government',     label: 'ui.tab.governments',  url: 'governments.html' },
                { key: 'civic',          label: 'ui.tab.civics',        url: 'governments.html?tab=civics' },
                { key: 'authority',      label: 'ui.tab.authorities',   url: 'governments.html?tab=authorities' },
                { key: 'policy',         label: 'ui.tab.policies',      url: 'governments.html?tab=policies' },
                { key: 'edict',          label: 'ui.tab.edicts',        url: 'governments.html?tab=edicts' },
                { key: 'councilor',      label: 'ui.tab.councilors',    url: 'governments.html?tab=councilors' },
                { key: 'trait',          label: 'ui.tab.traits',        url: 'empires.html?tab=traits' },
                { key: 'tradition',      label: 'ui.tab.traditions',    url: 'governments.html?tab=traditions' },
                { key: 'ascension_perk', label: 'ui.tab.perks',         url: 'governments.html?tab=perks' },
            ],
            economy:     [
                { key: 'building',      label: 'ui.tab.buildings',     url: 'economy.html' },
                { key: 'district',      label: 'ui.tab.districts',     url: 'economy.html?tab=districts' },
                { key: 'megastructure', label: 'ui.tab.megastructures', url: 'economy.html?tab=megastructures' },
                { key: 'relic',         label: 'ui.tab.relics',        url: 'economy.html?tab=relics' },
                { key: 'job',           label: 'ui.tab.jobs',          url: 'economy.html?tab=jobs' },
                { key: 'resource',      label: 'ui.tab.resources',     url: 'economy.html?tab=resources' },
                { key: 'deposit',       label: 'ui.tab.deposits',      url: 'economy.html?tab=deposits' },
            ],
            military:    [
                { key: 'model',         label: 'ui.tab.models',        url: 'ships.html' },
                { key: 'component',     label: 'ui.tab.components',    url: 'ships.html?tab=components' },
            ],
        };

        // Merge ships.json model_variants into counts
        if (shipsStats) {
            counts.model = shipsStats.model_variants;
        }

        // Inject badges into each section card.
        // If the per-card fadeInUp animation has already finished by the time
        // counts arrive (first load, uncached search index), mark the appended
        // nodes as deferred so they run their own staggered second-wave fade.
        const cards = document.querySelectorAll('.section-card[data-module]');
        const firstCardAnimEndMs = 300 + (cards.length * 60) + 400; // last delay + anim duration
        const animationAlreadyDone = (performance.now() >= firstCardAnimEndMs);
        cards.forEach((card, idx) => {
            const mod = card.dataset.module;
            const parts = moduleBreakdown[mod];
            if (!parts) return;

            const totalCount = parts.reduce((s, p) => s + (counts[p.key] || 0), 0);
            if (totalCount === 0) return;

            // Counter badge (top-right)
            const badge = document.createElement('span');
            badge.className = 'card-count';
            if (animationAlreadyDone) {
                badge.classList.add('card-deferred');
                badge.style.setProperty('--stagger', idx);
            }
            badge.textContent = totalCount.toLocaleString();
            card.appendChild(badge);

            // Sub-type breakdown (only if multiple sub-types)
            if (parts.length > 1) {
                const breakdown = document.createElement('div');
                breakdown.className = 'card-breakdown';
                if (animationAlreadyDone) {
                    breakdown.classList.add('card-deferred');
                    breakdown.style.setProperty('--stagger', idx);
                }
                breakdown.innerHTML = parts
                    .filter(p => (counts[p.key] || 0) > 0)
                    .map(p => `<a class="card-breakdown-tag" href="${p.url}">${I18n.ui(p.label)} <b>${(counts[p.key] || 0).toLocaleString()}</b></a>`)
                    .join('');
                // Prevent tag clicks from also triggering the parent card navigation
                breakdown.addEventListener('click', e => e.stopPropagation());
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
    // Update Notes Section
    // ========================================
    const CHANGE_MODULE_MAP = {
        events_index:    { label: 'Events',          page: 'events.html',         tab: null },
        ships:           { label: 'Ships',           page: 'ships.html',          tab: 'ships' },
        buildings:       { label: 'Buildings',       page: 'economy.html',         tab: 'buildings' },
        districts:       { label: 'Districts',       page: 'economy.html',         tab: 'districts' },
        traits:          { label: 'Traits',          page: 'empires.html',         tab: 'traits' },
        traditions:      { label: 'Traditions',      page: 'governments.html',     tab: 'traditions' },
        ascension_perks: { label: 'Ascension Perks', page: 'governments.html',     tab: 'perks' },
        governments:     { label: 'Governments',     page: 'governments.html',     tab: 'governments' },
        civics:          { label: 'Civics',          page: 'governments.html',     tab: 'civics' },
        authorities:     { label: 'Authorities',     page: 'governments.html',     tab: 'authorities' },
        policies:        { label: 'Policies',        page: 'governments.html',     tab: 'policies' },
        edicts:          { label: 'Edicts',          page: 'governments.html',     tab: 'edicts' },
        councilors:      { label: 'Councilors',      page: 'governments.html',     tab: 'councilors' },
        megastructures:  { label: 'Megastructures',  page: 'economy.html',         tab: 'megastructures' },
        relics:          { label: 'Relics',          page: 'economy.html',         tab: 'relics' },
        anomalies:       { label: 'Anomalies',       page: 'exploration.html',     tab: 'anomalies' },
        archaeology:     { label: 'Archaeology',     page: 'exploration.html',     tab: 'archaeology' },
        empires:         { label: 'Empires',         page: 'empires.html',         tab: 'empires' },
        // species:      { label: 'Species',         page: 'empires.html',         tab: 'species' },  // Hidden while species tab is disabled.
        jobs:            { label: 'Jobs',            page: 'economy.html',         tab: 'jobs' },
        deposits:        { label: 'Deposits',        page: 'economy.html',         tab: 'deposits' },
        resources:       { label: 'Resources',       page: 'economy.html',         tab: 'resources' },
        components:      { label: 'Components',      page: 'ships.html',           tab: 'components' },
    };

    function buildItemUrl(moduleKey, itemId) {
        const mapping = CHANGE_MODULE_MAP[moduleKey];
        if (!mapping) return '#';
        if (moduleKey === 'events_index') {
            return mapping.page + '?selectedEvent=' + encodeURIComponent(itemId);
        }
        let url = mapping.page + '?select=' + encodeURIComponent(itemId);
        if (mapping.tab) url += '&tab=' + mapping.tab;
        return url;
    }

    function formatChangeDate(isoStr) {
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) {
            return isoStr;
        }
    }

    function changeName(item) {
        if (!item.name_key) return item.id;
        return I18n.t(item.name_key) || item.name_key;
    }

    function renderUpdateNotes(changes, container, isHistory) {
        const summary = changes.summary || {};
        const modules = changes.modules || {};
        const totalChanges = (summary.total_added || 0) + (summary.total_modified || 0) + (summary.total_removed || 0);

        if (totalChanges === 0 && !isHistory) {
            container.innerHTML = '<p class="update-no-changes">No changes in the latest update.</p>';
            container.classList.remove('hidden');
            return;
        }

        // Header
        const dateStr = formatChangeDate(changes.timestamp);
        const prefix = isHistory ? '' : 'Latest Update';
        let html = `<div class="update-header">
            <h3>${isHistory ? 'Update' : prefix} &mdash; ${esc(dateStr)}</h3>
            <div class="update-summary-badges">`;
        if (summary.total_added) html += `<span class="update-badge added">+${summary.total_added} new</span>`;
        if (summary.total_modified) html += `<span class="update-badge modified">~${summary.total_modified} modified</span>`;
        if (summary.total_removed) html += `<span class="update-badge removed">-${summary.total_removed} removed</span>`;
        html += `</div></div>`;

        // Determine if modules should be initially expanded
        const expandAll = totalChanges <= 20;

        // Modules hidden from the update notes (tab disabled in UI).
        const HIDDEN_CHANGE_MODULES = new Set(['species']);

        // Modules with changes
        for (const [moduleKey, mod] of Object.entries(modules)) {
            if (HIDDEN_CHANGE_MODULES.has(moduleKey)) continue;
            const nAdd = (mod.added || []).length;
            const nMod = (mod.modified || []).length;
            const nRem = (mod.removed || []).length;
            if (nAdd === 0 && nMod === 0 && nRem === 0) continue;

            const mapping = CHANGE_MODULE_MAP[moduleKey] || { label: moduleKey };
            const expanded = expandAll;

            html += `<div class="update-module">`;
            html += `<div class="update-module-header" data-toggle-module>`;
            html += `<span class="update-module-toggle ${expanded ? 'expanded' : ''}">&#9654;</span>`;
            html += `<span class="update-module-name">${esc(mapping.label)}</span>`;
            if (mod.old_count !== undefined) {
                html += `<span class="update-module-delta">${mod.old_count.toLocaleString()} &rarr; ${mod.new_count.toLocaleString()}</span>`;
            }
            html += `</div>`;
            html += `<div class="update-module-body ${expanded ? '' : 'collapsed'}">`;

            // Added items
            for (const item of (mod.added || [])) {
                const url = buildItemUrl(moduleKey, item.id);
                html += `<div class="change-item change-added">
                    <span class="change-icon">+</span>
                    <a href="${esc(url)}">${esc(changeName(item))}</a>
                    <span class="change-item-id">${esc(item.id)}</span>
                </div>`;
            }

            // Modified items
            for (const item of (mod.modified || [])) {
                const url = buildItemUrl(moduleKey, item.id);
                html += `<div class="change-item change-modified">
                    <span class="change-icon">~</span>
                    <a href="${esc(url)}">${esc(changeName(item))}</a>
                    <span class="change-item-id">${esc(item.id)}</span>`;
                if (item.changed_fields && item.changed_fields.length) {
                    html += `<span class="change-fields">${item.changed_fields.map(f => `<span class="change-field-tag">${esc(f)}</span>`).join('')}</span>`;
                }
                html += `</div>`;
            }

            // Removed items
            for (const item of (mod.removed || [])) {
                html += `<div class="change-item change-removed">
                    <span class="change-icon">-</span>
                    <span class="change-id">${esc(changeName(item))}</span>
                    <span class="change-item-id">${esc(item.id)}</span>
                </div>`;
            }

            html += `</div></div>`;
        }

        container.innerHTML = (container.innerHTML || '') + html;
        container.classList.remove('hidden');

        // Wire up collapsible toggles
        container.querySelectorAll('[data-toggle-module]').forEach(header => {
            if (header._toggled) return;
            header._toggled = true;
            header.addEventListener('click', () => {
                const toggle = header.querySelector('.update-module-toggle');
                const body = header.nextElementSibling;
                if (body) {
                    body.classList.toggle('collapsed');
                    toggle.classList.toggle('expanded');
                }
            });
        });
    }

    // Load and render update notes
    try {
        const changes = await DataManager.loadJSON('assets/changes.json');
        if (changes) {
            const updateContainer = document.getElementById('update-notes');
            if (updateContainer) {
                renderUpdateNotes(changes, updateContainer, false);

                // History toggle button
                const historyBtn = document.createElement('button');
                historyBtn.className = 'update-history-toggle';
                historyBtn.textContent = 'Show previous updates';
                let historyLoaded = false;
                historyBtn.addEventListener('click', async () => {
                    if (historyLoaded) return;
                    historyLoaded = true;
                    historyBtn.textContent = 'Loading...';
                    try {
                        const history = await DataManager.loadJSON('assets/changes_history.json');
                        if (history && history.length) {
                            const maxShow = Math.min(history.length, 5);
                            for (let i = 0; i < maxShow; i++) {
                                const entryDiv = document.createElement('div');
                                entryDiv.className = 'update-history-entry';
                                updateContainer.appendChild(entryDiv);
                                renderUpdateNotes(history[i], entryDiv, true);
                            }
                        }
                        historyBtn.remove();
                    } catch (e) {
                        historyBtn.textContent = 'No history available';
                        historyBtn.style.opacity = '0.5';
                        historyBtn.style.cursor = 'default';
                    }
                });
                updateContainer.appendChild(historyBtn);
            }
        }
    } catch (e) {
        // No changes.json available, skip update notes
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
                    const iconHtml = GlobalSearch.getIconHtml(item, 'search-result-icon');
                    const flagBadge = (item.matchedFlags && item.matchedFlags.length)
                        ? `<span class="search-result-flag" title="sets flag">&#9873; ${esc(item.matchedFlags.slice(0, 3).join(', '))}${item.matchedFlags.length > 3 ? '…' : ''}</span>`
                        : '';
                    html += `<a href="${esc(url)}" class="search-result-item">
                        ${iconHtml}<span class="search-result-name">${esc(name)}</span>
                        <span class="search-result-id">${esc(item.id)}</span>
                        ${flagBadge}
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
                        if (item.matchedFlags && item.matchedFlags.length) {
                            for (const f of item.matchedFlags) {
                                metaParts.push(`<span class="meta-tag meta-tag-flag">&#9873; ${esc(f)}</span>`);
                            }
                        }
                        const iconHtml = GlobalSearch.getIconHtml(item, 'full-result-icon');
                        html += `<a href="${esc(url)}" class="full-result-item">
                            ${iconHtml}<span class="full-result-name">${esc(name)}</span>
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
        Common.applyUiStrings();
        if (searchReady) GlobalSearch.setLocReady(true);
    });

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
})();
