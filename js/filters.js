/**
 * Composable filter system (AND logic).
 */
const Filters = (() => {
    function apply(events, state) {
        // Clean previous divider markers
        for (const e of events) { delete e._searchDivider; }

        let result = events;

        // Type filter
        if (state.type) {
            result = result.filter(e => e.type === state.type);
        }

        // Faction filter
        if (state.faction) {
            const ns = DataManager.getNamespaces();
            result = result.filter(e => {
                const nsMeta = ns[e.ns];
                return nsMeta && nsMeta.faction === state.faction;
            });
        }

        // Category filter
        if (state.category) {
            const ns = DataManager.getNamespaces();
            result = result.filter(e => {
                const nsMeta = ns[e.ns];
                return nsMeta && nsMeta.category === state.category;
            });
        }

        // Hidden events
        if (!state.showHidden) {
            result = result.filter(e => !e.hide);
        }

        // Search: always global, but show namespace matches first
        if (state.search) {
            const searched = SearchEngine.search(state.search, result);
            if (state.namespace) {
                const inNs = searched.filter(e => e.ns === state.namespace);
                const outNs = searched.filter(e => e.ns !== state.namespace);
                // Mark the split point so EventList can insert a divider
                if (inNs.length > 0 && outNs.length > 0) {
                    outNs[0]._searchDivider = true;
                }
                result = inNs.concat(outNs);
            } else {
                result = searched;
            }
        } else if (state.namespace) {
            // No search: normal namespace filter
            result = result.filter(e => e.ns === state.namespace);
        }

        return result;
    }

    function populateDropdowns(events) {
        const ns = DataManager.getNamespaces();
        const factions = new Set();
        const categories = new Set();
        const namespaces = new Set();

        for (const nsMeta of Object.values(ns || {})) {
            factions.add(nsMeta.faction);
            categories.add(nsMeta.category);
            namespaces.add(nsMeta.name);
        }

        fillSelect('filter-faction', sorted(factions), 'All Factions');
        fillSelect('filter-category', sorted(categories), 'All Categories');
        fillSelect('filter-namespace', sorted(namespaces), 'All Namespaces');
    }

    function fillSelect(id, values, defaultLabel) {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.innerHTML = `<option value="">${defaultLabel}</option>`;
        for (const val of values) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            el.appendChild(opt);
        }
        el.value = current;
    }

    function sorted(set) {
        return [...set].sort();
    }

    return { apply, populateDropdowns };
})();
