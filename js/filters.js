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

        fillSelect('filter-faction', sorted(factions), I18n.ui('ui.filter.all_factions'));
        fillSelect('filter-category', sorted(categories), I18n.ui('ui.filter.all_categories'));
        fillSelect('filter-namespace', sorted(namespaces), I18n.ui('ui.filter.all_namespaces'));
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

    /**
     * Group filtered events by chain. Chain-head events get markers,
     * remaining chain members are marked as collapsed.
     */
    function groupByChain(filteredEvents) {
        if (!ChainIndex.isBuilt()) return filteredEvents;

        // Clean previous chain markers
        for (const e of filteredEvents) {
            delete e._chainId;
            delete e._chainHead;
            delete e._chainSize;
            delete e._chainCollapsed;
        }

        // Track which chains have visible members (as a set for O(1) lookup)
        const chainVisibleSet = {};  // chainId → Set of event ids
        const eventById = {};        // eventId → event object
        for (const e of filteredEvents) {
            const chain = ChainIndex.getChain(e.id);
            if (chain) {
                if (!chainVisibleSet[chain.id]) chainVisibleSet[chain.id] = new Set();
                chainVisibleSet[chain.id].add(e.id);
                eventById[e.id] = e;
            }
        }

        // Determine head for each chain (root if visible, else first in topological order)
        const chainHead = {};
        for (const [chainId, visibleSet] of Object.entries(chainVisibleSet)) {
            if (visibleSet.size < 2) continue;
            const chain = ChainIndex.getChain([...visibleSet][0]);
            if (!chain) continue;
            // Use root if visible, otherwise first visible in topological order
            if (visibleSet.has(chain.root)) {
                chainHead[chainId] = chain.root;
            } else {
                chainHead[chainId] = chain.members.find(m => visibleSet.has(m));
            }
        }

        // Build result: when we encounter the first event of a chain, emit head + members
        const seenChains = new Set();
        const result = [];
        for (const e of filteredEvents) {
            const chain = ChainIndex.getChain(e.id);
            if (!chain) {
                result.push(e);
                continue;
            }

            const visibleSet = chainVisibleSet[chain.id];

            // Not enough visible members to group
            if (!visibleSet || visibleSet.size < 2) {
                e._chainId = chain.id;
                result.push(e);
                continue;
            }

            if (seenChains.has(chain.id)) continue; // Already emitted
            seenChains.add(chain.id);

            const headId = chainHead[chain.id];
            // Emit head event
            const headEvent = eventById[headId];
            headEvent._chainId = chain.id;
            headEvent._chainHead = true;
            headEvent._chainSize = visibleSet.size;
            result.push(headEvent);

            // Emit members in topological order
            for (const memberId of chain.members) {
                if (memberId !== headId && visibleSet.has(memberId)) {
                    const m = eventById[memberId];
                    m._chainId = chain.id;
                    m._chainCollapsed = true;
                    result.push(m);
                }
            }
        }

        return result;
    }

    return { apply, populateDropdowns, groupByChain };
})();
