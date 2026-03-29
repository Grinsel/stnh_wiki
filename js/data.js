/**
 * Data loading and caching module.
 * Generic JSON loader, localisation, picture map, and event data support.
 */
const DataManager = (() => {
    let eventsIndex = null;
    let namespacesData = null;
    let relationshipsData = null;
    let onActionsData = null;
    let eventChainsData = null;
    let picturesMap = null;
    const detailCache = {};
    const locCache = {};
    const jsonCache = {};

    const BASE = '';

    async function fetchJSON(path) {
        const resp = await fetch(`${BASE}${path}`);
        if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
        return resp.json();
    }

    async function loadJSON(path) {
        if (jsonCache[path]) return jsonCache[path];
        const data = await fetchJSON(path);
        jsonCache[path] = data;
        return data;
    }

    async function loadLocalisation(lang) {
        if (locCache[lang]) return locCache[lang];
        const data = await fetchJSON(`assets/localisation/${lang}.json`);
        locCache[lang] = data;
        return data;
    }

    async function loadPicturesMap() {
        if (!picturesMap) {
            picturesMap = await fetchJSON('assets/pictures_map.json');
        }
        return picturesMap;
    }

    function getPictureUrl(gfxName) {
        if (!gfxName || !picturesMap) return null;
        let entry = picturesMap[gfxName];
        // Fuzzy fallback: try common variants for mismatched sprite names
        if (!entry) entry = picturesMap[gfxName + '+Era'] || picturesMap[gfxName + 'Era'];
        if (!entry && gfxName.startsWith('GFX_')) entry = picturesMap['sth_' + gfxName];
        if (!entry) return null;
        return `pictures/${entry.texture_name}.webp`;
    }

    // --- Event-specific loaders (lazy, no overhead for non-event pages) ---

    async function loadInitial() {
        const [index, ns, pics] = await Promise.all([
            fetchJSON('assets/events_index.json'),
            fetchJSON('assets/namespaces.json'),
            fetchJSON('assets/pictures_map.json'),
        ]);
        eventsIndex = index;
        namespacesData = ns;
        picturesMap = pics;
        return { eventsIndex, namespacesData, picturesMap };
    }

    async function loadRelationships() {
        if (!relationshipsData) {
            relationshipsData = await fetchJSON('assets/relationships.json');
        }
        return relationshipsData;
    }

    async function loadOnActions() {
        if (!onActionsData) {
            onActionsData = await fetchJSON('assets/on_actions.json');
        }
        return onActionsData;
    }

    async function loadEventChains() {
        if (!eventChainsData) {
            eventChainsData = await fetchJSON('assets/event_chains.json');
        }
        return eventChainsData;
    }

    async function loadNamespaceDetail(namespace) {
        const safeName = namespace.replace(/[^\w.-]/g, '_');
        if (detailCache[safeName]) return detailCache[safeName];
        const data = await fetchJSON(`assets/events_detail/${safeName}.json`);
        detailCache[safeName] = data;
        return data;
    }

    function getEventsIndex() { return eventsIndex; }
    function getNamespaces() { return namespacesData; }
    function getPicturesMap() { return picturesMap; }

    return {
        fetchJSON,
        loadJSON,
        loadLocalisation,
        loadPicturesMap,
        getPictureUrl,
        loadInitial,
        loadRelationships,
        loadOnActions,
        loadEventChains,
        loadNamespaceDetail,
        getEventsIndex,
        getNamespaces,
        getPicturesMap,
    };
})();
