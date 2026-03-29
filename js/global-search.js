/**
 * Global cross-module search for STNH Wiki hub.
 * Loads search_index.json and provides prefix-based search across all modules.
 *
 * Two modes:
 *   searchPreview() - Live dropdown: max N results per type (fast, balanced)
 *   searchFull()    - Full results page: all matches across all modules
 */
const GlobalSearch = (() => {
    let searchIndex = null;
    let modulePages = null;
    let locReady = false;

    const TYPE_PREFIXES = {
        'event': 'event', 'events': 'event',
        'ship': 'ship', 'ships': 'ship',
        'component': 'component', 'comp': 'component',
        'building': 'building', 'buildings': 'building',
        'district': 'district',
        'trait': 'trait', 'traits': 'trait',
        'tradition': 'tradition',
        'perk': 'ascension_perk', 'ap': 'ascension_perk',
        'gov': 'government', 'government': 'government',
        'civic': 'civic', 'civics': 'civic',
        'authority': 'authority',
        'policy': 'policy',
        'edict': 'edict',
        'mega': 'megastructure', 'megastructure': 'megastructure',
        'relic': 'relic', 'relics': 'relic',
        'anomaly': 'anomaly',
        'archaeology': 'archaeology', 'dig': 'archaeology',
        'empire': 'empire', 'empires': 'empire',
        'species': 'species',
        'job': 'job', 'jobs': 'job',
        'deposit': 'deposit',
    };

    const TYPE_LABELS = {
        'event': 'Event',
        'ship': 'Ship',
        'component': 'Component',
        'building': 'Building',
        'district': 'District',
        'trait': 'Trait',
        'tradition': 'Tradition',
        'ascension_perk': 'Ascension Perk',
        'government': 'Government',
        'civic': 'Civic',
        'authority': 'Authority',
        'policy': 'Policy',
        'edict': 'Edict',
        'megastructure': 'Megastructure',
        'relic': 'Relic',
        'anomaly': 'Anomaly',
        'archaeology': 'Archaeology',
        'empire': 'Empire',
        'species': 'Species',
        'job': 'Job',
        'deposit': 'Deposit',
    };

    // Display order for grouped results
    const TYPE_ORDER = [
        'ship', 'component', 'building', 'district',
        'trait', 'tradition', 'ascension_perk',
        'government', 'civic', 'authority', 'policy', 'edict',
        'megastructure', 'relic',
        'anomaly', 'archaeology',
        'empire', 'species',
        'job', 'deposit',
        'event',
    ];

    const TYPE_TABS = {
        'ship': 'ships',
        'component': 'components',
        'building': 'buildings',
        'district': 'districts',
        'trait': 'traits',
        'tradition': 'traditions',
        'ascension_perk': 'perks',
        'government': 'governments',
        'civic': 'civics',
        'authority': 'authorities',
        'policy': 'policies',
        'edict': 'edicts',
        'megastructure': 'megastructures',
        'relic': 'relics',
        'anomaly': 'anomalies',
        'archaeology': 'archaeology',
        'empire': 'empires',
        'species': 'species',
        'job': 'jobs',
        'deposit': 'deposits',
    };

    async function init() {
        try {
            const [idx, pages] = await Promise.all([
                DataManager.loadJSON('assets/search_index.json'),
                DataManager.loadJSON('assets/module_pages.json'),
            ]);
            searchIndex = idx;
            modulePages = pages;
            return true;
        } catch (err) {
            console.warn('GlobalSearch: failed to load index', err);
            return false;
        }
    }

    function _parseQuery(query) {
        let typeFilter = null;
        let searchTerm = query.trim().toLowerCase();
        const colonIdx = query.indexOf(':');
        if (colonIdx > 0 && colonIdx < 20) {
            const prefix = query.slice(0, colonIdx).toLowerCase();
            if (TYPE_PREFIXES[prefix]) {
                typeFilter = TYPE_PREFIXES[prefix];
                searchTerm = query.slice(colonIdx + 1).trim().toLowerCase();
            }
        }
        const terms = searchTerm.split(/\s+/).filter(Boolean);
        return { typeFilter, terms };
    }

    function _matchItem(item, terms) {
        const name = (typeof I18n !== 'undefined' && locReady)
            ? (I18n.t(item.nk) || item.nk || item.id)
            : (item.nk || item.id);
        const searchable = `${item.id} ${name}`.toLowerCase();
        if (!terms.every(t => searchable.includes(t))) return null;
        return {
            id: item.id,
            name: name,
            type: item.t,
            module: item.m,
            meta: item.x || {},
            label: TYPE_LABELS[item.t] || item.t,
            page: modulePages ? modulePages[item.m] : null,
            tab: TYPE_TABS[item.t] || null,
        };
    }

    /**
     * Preview search: max perType results per item type, balanced across all modules.
     * Used for the live dropdown while typing.
     */
    function searchPreview(query, perType = 5) {
        if (!searchIndex || !query || !query.trim()) return [];
        const { typeFilter, terms } = _parseQuery(query);
        if (!terms.length) return [];

        const buckets = {};  // type -> results[]
        const counts = {};   // type -> total match count

        for (const item of searchIndex) {
            if (typeFilter && item.t !== typeFilter) continue;
            const result = _matchItem(item, terms);
            if (!result) continue;

            const t = item.t;
            counts[t] = (counts[t] || 0) + 1;

            if (!buckets[t]) buckets[t] = [];
            if (buckets[t].length < perType) {
                buckets[t].push(result);
            }
        }

        // Flatten in display order, attach total counts
        const results = [];
        for (const t of TYPE_ORDER) {
            if (buckets[t]) {
                for (const r of buckets[t]) {
                    r._totalForType = counts[t];
                    results.push(r);
                }
            }
        }
        // Also include any types not in TYPE_ORDER
        for (const t in buckets) {
            if (!TYPE_ORDER.includes(t)) {
                for (const r of buckets[t]) {
                    r._totalForType = counts[t];
                    results.push(r);
                }
            }
        }

        return results;
    }

    /**
     * Full search: all matches, no limit. Used for the full results page on Enter.
     */
    function searchFull(query) {
        if (!searchIndex || !query || !query.trim()) return [];
        const { typeFilter, terms } = _parseQuery(query);
        if (!terms.length) return [];

        const results = [];
        for (const item of searchIndex) {
            if (typeFilter && item.t !== typeFilter) continue;
            const result = _matchItem(item, terms);
            if (result) results.push(result);
        }
        return results;
    }

    function getItemUrl(result) {
        if (!result.page) return '#';
        let url = result.page + '?search=' + encodeURIComponent(result.id);
        if (result.tab) {
            url += '&tab=' + encodeURIComponent(result.tab);
        }
        return url;
    }

    function setLocReady(ready) {
        locReady = ready;
    }

    function getStats() {
        if (!searchIndex) return {};
        const counts = {};
        for (const item of searchIndex) {
            counts[item.t] = (counts[item.t] || 0) + 1;
        }
        return counts;
    }

    function getTotalCount() {
        return searchIndex ? searchIndex.length : 0;
    }

    return {
        init, searchPreview, searchFull, getItemUrl,
        setLocReady, getStats, getTotalCount,
        TYPE_LABELS, TYPE_ORDER,
    };
})();
