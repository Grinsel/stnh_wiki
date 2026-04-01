/**
 * Namespace sidebar navigation, grouped by faction.
 * Supports chain navigation mode when a chain event is selected.
 */
const NamespaceNav = (() => {
    let expanded = {};
    let chainMode = false;

    function render() {
        const ns = DataManager.getNamespaces();
        if (!ns) return;

        // Group by faction
        const byFaction = {};
        for (const [name, meta] of Object.entries(ns)) {
            const faction = meta.faction || 'generic';
            if (!byFaction[faction]) byFaction[faction] = [];
            byFaction[faction].push(meta);
        }

        // Sort factions alphabetically, 'generic' always last
        const factionOrder = Object.keys(byFaction).sort((a, b) => {
            if (a === 'qpedia') return -1;
            if (b === 'qpedia') return 1;
            if (a === 'generic') return 1;
            if (b === 'generic') return -1;
            return a.localeCompare(b);
        });

        let html = '';
        for (const faction of factionOrder) {
            const items = byFaction[faction].sort((a, b) => a.name.localeCompare(b.name));
            const totalCount = items.reduce((s, m) => s + m.event_count, 0);
            const isExpanded = expanded[faction] === true || faction === 'qpedia';

            html += `<div class="ns-faction-group">`;
            html += `<div class="ns-faction-label" data-faction="${faction}">
                        <span>${faction}</span>
                        <span class="count">${totalCount}</span>
                     </div>`;
            html += `<div class="ns-list" style="${isExpanded ? '' : 'display:none'}" data-faction-list="${faction}">`;
            for (const item of items) {
                const active = AppState.get('namespace') === item.name ? 'active' : '';
                html += `<div class="ns-item ${active}" data-ns="${item.name}">
                            <span>${item.name}</span>
                            <span class="badge">${item.event_count}</span>
                         </div>`;
            }
            html += `</div></div>`;
        }

        const treeEl = document.getElementById('namespace-tree');
        treeEl.innerHTML = html;

        // Attach handlers
        document.querySelectorAll('.ns-faction-label').forEach(el => {
            el.addEventListener('click', () => {
                const faction = el.dataset.faction;
                expanded[faction] = !expanded[faction];
                const list = document.querySelector(`[data-faction-list="${faction}"]`);
                if (list) list.style.display = expanded[faction] ? '' : 'none';
            });
        });

        document.querySelectorAll('.ns-item').forEach(el => {
            el.addEventListener('click', () => {
                const ns = el.dataset.ns;
                const current = AppState.get('namespace');
                AppState.setMultiple({
                    namespace: current === ns ? '' : ns,
                    page: 1
                });
            });
        });

        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.getElementById('namespace-sidebar').classList.toggle('collapsed');
        });

        chainMode = false;
    }

    function updateActive() {
        if (chainMode) return; // Don't update namespace nav when in chain mode
        const current = AppState.get('namespace');
        document.querySelectorAll('.ns-item').forEach(el => {
            el.classList.toggle('active', el.dataset.ns === current);
        });
    }

    /**
     * Switch sidebar to chain navigation mode.
     */
    function showChainNav(chain, currentEventId) {
        chainMode = true;
        const treeEl = document.getElementById('namespace-tree');
        const headerEl = document.querySelector('.sidebar-header h3');
        const index = DataManager.getEventsIndex();

        // Build lookup map for O(1) access
        const indexMap = {};
        for (const e of index) { indexMap[e.id] = e; }

        // Update header
        if (headerEl) {
            headerEl.innerHTML = '\u26d3 Event Chain';
        }

        let html = '';
        html += '<div class="chain-nav">';
        html += `<button class="chain-nav-back" title="Back to Namespaces">\u2190 Namespaces</button>`;
        html += '<div class="chain-nav-tree">';

        // Pre-compute depth map for all members at once
        const depthMap = buildDepthMap(chain);

        for (const memberId of chain.members) {
            const isRoot = memberId === chain.root;
            const isActive = memberId === currentEventId;
            const entry = indexMap[memberId];
            const name = entry ? (entry.name || memberId) : memberId;

            const depth = depthMap[memberId] || 0;
            const pad = depth > 0 ? `padding-left:${depth * 0.8}rem;` : '';

            html += `<div class="chain-nav-item${isRoot ? ' root' : ''}${isActive ? ' active' : ''}" data-event-id="${memberId}" style="${pad}">`;
            if (depth > 0) html += '<span class="chain-nav-arrow">\u2192</span>';
            html += `<span class="chain-nav-name">${escapeHtml(name)}</span>`;
            html += `<span class="chain-nav-id">${memberId}</span>`;
            html += '</div>';
        }

        html += '</div></div>';
        treeEl.innerHTML = html;

        // Attach handlers
        treeEl.querySelectorAll('.chain-nav-item').forEach(el => {
            el.addEventListener('click', () => {
                const eventId = el.dataset.eventId;
                const entry = indexMap[eventId];
                if (entry) {
                    EventDetail.show(eventId, entry.ns);
                }
                // Update active state
                treeEl.querySelectorAll('.chain-nav-item').forEach(n => n.classList.remove('active'));
                el.classList.add('active');
            });
        });

        const backBtn = treeEl.querySelector('.chain-nav-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                showNamespaceNav();
            });
        }
    }

    /**
     * Build depth map for all members in a chain (BFS from root via triggers).
     */
    function buildDepthMap(chain) {
        const rels = ChainIndex.getRelationships();
        if (!rels) return {};

        const memberSet = new Set(chain.members);
        const depths = {};
        depths[chain.root] = 0;
        const queue = [chain.root];
        while (queue.length > 0) {
            const current = queue.shift();
            const rel = rels[current];
            if (rel && rel.triggers) {
                for (const t of rel.triggers) {
                    if (memberSet.has(t) && depths[t] === undefined) {
                        depths[t] = depths[current] + 1;
                        queue.push(t);
                    }
                }
            }
        }
        return depths;
    }

    /**
     * Switch back to namespace navigation mode.
     */
    function showNamespaceNav() {
        chainMode = false;
        const headerEl = document.querySelector('.sidebar-header h3');
        if (headerEl) {
            headerEl.textContent = 'Namespaces';
        }
        render();
    }

    function isChainMode() {
        return chainMode;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { render, updateActive, showChainNav, showNamespaceNav, isChainMode };
})();
