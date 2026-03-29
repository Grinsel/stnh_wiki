/**
 * Client-side search engine over events index.
 * Supports prefix searches: id:, ns:, faction:
 */
const SearchEngine = (() => {
    let index = null;

    function build(eventsIndex) {
        index = eventsIndex;
    }

    function search(query, events) {
        if (!query || !query.trim()) return events;
        query = query.trim().toLowerCase();

        // Prefix search
        if (query.startsWith('id:')) {
            const term = query.slice(3).trim();
            return events.filter(e => e.id.toLowerCase().includes(term));
        }
        if (query.startsWith('ns:')) {
            const term = query.slice(3).trim();
            return events.filter(e => (e.ns || '').toLowerCase().includes(term));
        }
        if (query.startsWith('faction:')) {
            const term = query.slice(8).trim();
            // Need to look up faction from namespaces
            const ns = DataManager.getNamespaces();
            return events.filter(e => {
                const nsMeta = ns[e.ns];
                return nsMeta && nsMeta.faction.toLowerCase().includes(term);
            });
        }

        // General search: match across id, name, namespace, snippet
        const terms = query.split(/\s+/);
        return events.filter(e => {
            const searchable = `${e.id} ${e.name} ${e.ns} ${e.snip}`.toLowerCase();
            return terms.every(term => searchable.includes(term));
        });
    }

    function highlightText(text, query) {
        if (!query || !text) return escapeHtml(text || '');
        const terms = query.toLowerCase().split(/\s+/).filter(t => !t.includes(':'));
        let result = escapeHtml(text);
        for (const term of terms) {
            if (!term) continue;
            const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
            result = result.replace(regex, '<mark>$1</mark>');
        }
        return result;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    return { build, search, highlightText };
})();
