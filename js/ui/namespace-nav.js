/**
 * Namespace sidebar navigation, grouped by faction.
 */
const NamespaceNav = (() => {
    let expanded = {};

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
            if (a === 'generic') return 1;
            if (b === 'generic') return -1;
            return a.localeCompare(b);
        });

        let html = '';
        for (const faction of factionOrder) {
            const items = byFaction[faction].sort((a, b) => a.name.localeCompare(b.name));
            const totalCount = items.reduce((s, m) => s + m.event_count, 0);
            const isExpanded = expanded[faction] === true; // default collapsed

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

        document.getElementById('namespace-tree').innerHTML = html;

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
    }

    function updateActive() {
        const current = AppState.get('namespace');
        document.querySelectorAll('.ns-item').forEach(el => {
            el.classList.toggle('active', el.dataset.ns === current);
        });
    }

    return { render, updateActive };
})();
