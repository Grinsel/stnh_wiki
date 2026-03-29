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

    // Faction synonym map: canonical name -> aliases
    const FACTION_ALIASES = {
        'federation': ['ufp', 'fed', 'starfleet', 'united federation', 'uss'],
        'klingon':    ['kdf', 'klingon empire', 'iks', 'qonos'],
        'romulan':    ['rse', 'rom', 'romulan star empire', 'tal shiar'],
        'cardassian': ['car', 'cardassian union', 'obsidian order'],
        'dominion':   ['dom', 'the dominion', 'founders', 'jem hadar', 'vorta'],
        'borg':       ['brg', 'borg collective', 'unimatrix'],
        'ferengi':    ['fer', 'ferengi alliance', 'fms'],
        'bajoran':    ['baj', 'bajor'],
        'vulcan':     ['vul', 'vulcanoid'],
        'andorian':   ['and', 'andoria'],
        'tholian':    ['tho'],
        'breen':      ['bre'],
        'undine':     ['und', 'species 8472'],
        'xindi':      ['xin'],
        'terran':     ['ter', 'terran empire', 'mirror universe', 'iss'],
        'hirogen':    ['hir'],
        'krenim':     ['kre'],
        'son_a':      ['son', 'sona'],
        'nausicaan':  ['nau'],
        'pakled':     ['pak'],
        'vidiian':    ['vid'],
    };

    // Build reverse lookup: alias -> set of all synonyms (including canonical)
    const _aliasLookup = {};
    for (const [canonical, aliases] of Object.entries(FACTION_ALIASES)) {
        const all = [canonical, ...aliases];
        for (const term of all) {
            _aliasLookup[term] = all;
        }
    }

    /**
     * Expand search terms with faction synonyms.
     * Each input term becomes an array of alternatives to match against.
     * e.g. ['fed'] -> [['fed', 'federation', 'ufp', 'starfleet', ...]]
     *      ['phaser'] -> [['phaser']]
     */
    function _expandTerms(terms) {
        return terms.map(term => {
            const synonyms = _aliasLookup[term];
            return synonyms ? synonyms : [term];
        });
    }

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

    function _matchItem(item, expandedTerms) {
        const name = (typeof I18n !== 'undefined' && locReady)
            ? (I18n.t(item.nk) || item.nk || item.id)
            : (item.nk || item.id);
        const metaStr = item.x ? Object.values(item.x).join(' ') : '';
        const searchable = `${item.id} ${name} ${metaStr}`.toLowerCase();
        // Each term group must have at least one alternative matching
        if (!expandedTerms.every(alts => alts.some(a => searchable.includes(a)))) return null;
        return {
            id: item.id,
            name: name,
            type: item.t,
            module: item.m,
            meta: item.x || {},
            label: (typeof I18n !== 'undefined' && I18n.ui) ? (I18n.ui('ui.type.' + item.t) || TYPE_LABELS[item.t] || item.t) : (TYPE_LABELS[item.t] || item.t),
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
        const expandedTerms = _expandTerms(terms);

        const buckets = {};  // type -> results[]
        const counts = {};   // type -> total match count

        for (const item of searchIndex) {
            if (typeFilter && item.t !== typeFilter) continue;
            const result = _matchItem(item, expandedTerms);
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
        const expandedTerms = _expandTerms(terms);

        const results = [];
        for (const item of searchIndex) {
            if (typeFilter && item.t !== typeFilter) continue;
            const result = _matchItem(item, expandedTerms);
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

    /**
     * Returns expanded synonym info for a query, so the UI can show what was searched.
     * e.g. "fed phaser" -> [{ term: 'fed', synonyms: ['federation','ufp','starfleet',...] }, { term: 'phaser', synonyms: null }]
     */
    function getExpandedInfo(query) {
        const { terms } = _parseQuery(query);
        const info = [];
        for (const term of terms) {
            const synonyms = _aliasLookup[term];
            if (synonyms) {
                // Return all synonyms except the term itself
                info.push({ term, synonyms: synonyms.filter(s => s !== term) });
            }
        }
        return info;
    }

    return {
        init, searchPreview, searchFull, getItemUrl,
        setLocReady, getStats, getTotalCount, getExpandedInfo,
        TYPE_LABELS, TYPE_ORDER,
    };
})();
