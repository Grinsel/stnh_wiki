/**
 * Chain Index - builds connected components from relationships.json.
 * Provides lookup: eventId → chain object.
 */
const ChainIndex = (() => {
    let chainMap = {};    // eventId → chainId
    let chains = {};      // chainId → { id, root, members[], size }
    let relsData = null;  // stored relationships for depth lookup
    let built = false;

    /**
     * Build chain index from relationships data.
     * Finds connected components via BFS, only keeps chains with ≥2 events.
     */
    function build(relationships) {
        chainMap = {};
        chains = {};
        relsData = relationships;
        const visited = new Set();
        let chainId = 0;

        // Build adjacency list (undirected: triggers + triggered_by)
        const adj = {};
        for (const [eventId, rel] of Object.entries(relationships)) {
            if (!adj[eventId]) adj[eventId] = new Set();
            for (const t of (rel.triggers || [])) {
                adj[eventId].add(t);
                if (!adj[t]) adj[t] = new Set();
                adj[t].add(eventId);
            }
            for (const t of (rel.triggered_by || [])) {
                adj[eventId].add(t);
                if (!adj[t]) adj[t] = new Set();
                adj[t].add(eventId);
            }
        }

        // BFS to find connected components
        for (const startId of Object.keys(adj)) {
            if (visited.has(startId)) continue;

            const component = [];
            const queue = [startId];
            visited.add(startId);

            while (queue.length > 0) {
                const current = queue.shift();
                component.push(current);
                for (const neighbor of (adj[current] || [])) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }

            // Only index chains with ≥2 events
            if (component.length < 2) continue;

            // Find root(s): events with no triggered_by (or fewest)
            let root = component[0];
            for (const eid of component) {
                const rel = relationships[eid];
                const triggeredBy = rel ? (rel.triggered_by || []) : [];
                const rootRel = relationships[root];
                const rootTriggeredBy = rootRel ? (rootRel.triggered_by || []) : [];
                if (triggeredBy.length < rootTriggeredBy.length) {
                    root = eid;
                }
            }

            // Sort members topologically (BFS from root following triggers)
            const sorted = topologicalSort(root, relationships, new Set(component));

            const cid = 'chain_' + chainId++;
            chains[cid] = {
                id: cid,
                root: root,
                members: sorted,
                size: sorted.length
            };
            for (const eid of sorted) {
                chainMap[eid] = cid;
            }
        }

        built = true;
    }

    /**
     * Topological sort via BFS from root, following trigger edges.
     * Falls back to original order for events not reachable from root.
     */
    function topologicalSort(root, relationships, componentSet) {
        const ordered = [];
        const visited = new Set();
        const queue = [root];
        visited.add(root);

        while (queue.length > 0) {
            const current = queue.shift();
            ordered.push(current);
            const rel = relationships[current];
            if (rel && rel.triggers) {
                for (const t of rel.triggers) {
                    if (componentSet.has(t) && !visited.has(t)) {
                        visited.add(t);
                        queue.push(t);
                    }
                }
            }
        }

        // Add any remaining component members not reached from root
        for (const eid of componentSet) {
            if (!visited.has(eid)) {
                ordered.push(eid);
            }
        }

        return ordered;
    }

    /**
     * Get chain for an event, or null if not in a chain.
     */
    function getChain(eventId) {
        const cid = chainMap[eventId];
        return cid ? chains[cid] : null;
    }

    /**
     * Get all chains.
     */
    function getAllChains() {
        return chains;
    }

    /**
     * Check if the index has been built.
     */
    function isBuilt() {
        return built;
    }

    /**
     * Get stored relationships data (for depth calculation in sidebar).
     */
    function getRelationships() {
        return relsData;
    }

    return { build, getChain, getAllChains, isBuilt, getRelationships };
})();
