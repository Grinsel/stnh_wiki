/**
 * Event chain visualisation (placeholder - D3 version for Phase 4).
 * For now, renders a simple list view.
 */
const ChainViewer = (() => {
    function show(eventId) {
        // For now, show a simple chain view using relationships
        const modal = document.getElementById('chain-modal');
        const viewer = document.getElementById('chain-viewer');
        modal.classList.remove('hidden');

        DataManager.loadRelationships().then(rels => {
            const chain = buildChain(eventId, rels);
            viewer.innerHTML = renderChain(chain, eventId);

            // Click handlers
            viewer.querySelectorAll('.event-link').forEach(link => {
                link.addEventListener('click', () => {
                    EventDetail.navigateToEvent(link.dataset.eventId);
                    modal.classList.add('hidden');
                });
            });
        });
    }

    function buildChain(startId, rels, visited, depth) {
        visited = visited || new Set();
        depth = depth || 0;
        if (visited.has(startId) || depth > 10) return null;
        visited.add(startId);

        const rel = rels[startId] || { triggers: [], triggered_by: [] };
        return {
            id: startId,
            triggers: rel.triggers.map(id => buildChain(id, rels, visited, depth + 1)).filter(Boolean),
        };
    }

    function renderChain(node, highlightId, indent) {
        if (!node) return '';
        indent = indent || 0;
        const pad = '&nbsp;&nbsp;'.repeat(indent);
        const cls = node.id === highlightId ? 'accent' : '';
        let html = `<div>${pad}${indent > 0 ? '→ ' : ''}<span class="event-link ${cls}" data-event-id="${node.id}">${node.id}</span></div>`;
        for (const child of node.triggers) {
            html += renderChain(child, highlightId, indent + 1);
        }
        return html;
    }

    function hide() {
        document.getElementById('chain-modal').classList.add('hidden');
    }

    function init() {
        document.getElementById('chain-close').addEventListener('click', hide);
        document.getElementById('chain-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) hide();
        });
    }

    return { show, hide, init };
})();
