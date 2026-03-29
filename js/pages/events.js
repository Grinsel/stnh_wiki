/**
 * Events page - initializes the event browser within the wiki.
 * Adapted from the standalone Event Browser main.js.
 */
(async function initEvents() {
    const listEl = document.getElementById('event-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.events') + '</div>';

    // Initialize shared UI
    AppState.init();
    Common.init();

    // Set UI from state
    document.getElementById('search-input').value = AppState.get('search');
    document.getElementById('filter-type').value = AppState.get('type');
    document.getElementById('filter-hidden').checked = AppState.get('showHidden');
    document.getElementById('filter-triggered').checked = AppState.get('triggeredOnly');

    try {
        // Load initial data
        const { eventsIndex } = await DataManager.loadInitial();

        // Load localisation
        await I18n.setLanguage(AppState.get('lang'));

        // Resolve event names from localisation
        for (const ev of eventsIndex) {
            if (!ev.name && ev.id) {
                const keys = [
                    ev.id + '.name',
                    ev.id.replace(/\.\d+$/, '') + '.name',
                ];
                for (const key of keys) {
                    const resolved = I18n.t(key);
                    if (resolved !== key) {
                        ev.name = resolved;
                        break;
                    }
                }
            }
        }

        // Build search index
        SearchEngine.build(eventsIndex);

        // Populate filter dropdowns
        Filters.populateDropdowns(eventsIndex);

        // Restore filter state from URL
        document.getElementById('filter-faction').value = AppState.get('faction');
        document.getElementById('filter-category').value = AppState.get('category');
        document.getElementById('filter-namespace').value = AppState.get('namespace');

        // Render namespace sidebar
        NamespaceNav.render();

        // Init event detail
        EventDetail.init();
        ChainViewer.init();

        // Build chain index from relationships
        try {
            const rels = await DataManager.loadRelationships();
            ChainIndex.build(rels);
        } catch (e) {
            console.warn('Chain index not available:', e.message);
        }

        // Initial render
        renderAll();

        // If there's a selected event in URL, show it
        const selectedEvent = AppState.get('selectedEvent');
        if (selectedEvent) {
            const entry = eventsIndex.find(e => e.id === selectedEvent);
            if (entry) {
                EventDetail.show(selectedEvent, entry.ns);
            }
        }
    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">${I18n.ui('ui.error.load_failed')}: ${err.message}</div>`;
        console.error(err);
        return;
    }

    // Wire up UI events
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            AppState.setMultiple({ search: e.target.value, page: 1 });
        }, 200);
    });

    document.getElementById('filter-type').addEventListener('change', (e) => {
        AppState.setMultiple({ type: e.target.value, page: 1 });
    });
    document.getElementById('filter-faction').addEventListener('change', (e) => {
        AppState.setMultiple({ faction: e.target.value, page: 1 });
    });
    document.getElementById('filter-category').addEventListener('change', (e) => {
        AppState.setMultiple({ category: e.target.value, page: 1 });
    });
    document.getElementById('filter-namespace').addEventListener('change', (e) => {
        AppState.setMultiple({ namespace: e.target.value, page: 1 });
    });
    document.getElementById('filter-hidden').addEventListener('change', (e) => {
        AppState.setMultiple({ showHidden: e.target.checked, page: 1 });
    });

    // Language change: re-resolve event names and re-render
    document.addEventListener('wiki-lang-changed', () => {
        const eventsIndex = DataManager.getEventsIndex();
        for (const ev of eventsIndex) {
            ev.name = I18n.t(ev.id + '.name') || ev.name || ev.id;
        }
        renderAll();
    });

    // Listen for state changes
    AppState.onChange((state) => {
        renderAll();
        NamespaceNav.updateActive();
    });

    function renderAll() {
        const state = AppState.getState();
        const index = DataManager.getEventsIndex();
        const filtered = Filters.apply(index, state);

        // Sort (skip if searching - Filters.apply handles the order)
        if (!state.search) {
            filtered.sort((a, b) => {
                const nsA = a.ns || '';
                const nsB = b.ns || '';
                if (nsA !== nsB) return nsA.localeCompare(nsB);
                return a.id.localeCompare(b.id);
            });
        }

        // Group by chain
        const grouped = Filters.groupByChain(filtered);

        // Update stats
        document.getElementById('filter-stats').textContent =
            `${filtered.length} / ${index.length} events`;

        EventList.render(grouped, state.page || 1, state.search);
    }
})();
