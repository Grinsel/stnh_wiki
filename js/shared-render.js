/**
 * Shared rendering utilities used across all wiki content pages.
 * Provides formatBlock() for code display and dualView() for Code/Human toggle.
 */
const SharedRender = (() => {

    function escapeHtml(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    /**
     * Format a parsed PDX data block as code text (same as the events render.js version).
     */
    function formatBlock(block, indent) {
        indent = indent || 0;
        if (block === null || block === undefined) return '';
        if (typeof block === 'string' || typeof block === 'number' || typeof block === 'boolean') {
            return escapeHtml(String(block));
        }
        if (Array.isArray(block)) {
            return block.map(item => formatBlock(item, indent)).join('\n');
        }
        if (typeof block === 'object') {
            const pad = '  '.repeat(indent);
            const lines = [];
            for (const [key, val] of Object.entries(block)) {
                if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                    for (const [op, opVal] of Object.entries(val)) {
                        if (['>', '<', '>=', '<='].includes(op)) {
                            lines.push(`${pad}${key} ${op} ${opVal}`);
                        } else if (Array.isArray(opVal)) {
                            lines.push(`${pad}${key} = {`);
                            lines.push(formatBlock(opVal, indent + 1));
                            lines.push(`${pad}}`);
                        } else {
                            lines.push(`${pad}${key} = { ${op} = ${opVal} }`);
                        }
                    }
                } else if (Array.isArray(val)) {
                    lines.push(`${pad}${key} = {`);
                    lines.push(formatBlock(val, indent + 1));
                    lines.push(`${pad}}`);
                } else {
                    lines.push(`${pad}${key} = ${val}`);
                }
            }
            return lines.join('\n');
        }
        return String(block);
    }

    /**
     * Render a dual-view block: code view + human-readable view with toggle.
     * Works with both PDX array blocks and plain objects/JSON.
     */
    function dualView(data, label) {
        if (data == null) return '';
        if (Array.isArray(data) && !data.length) return '';

        // Code view: use formatBlock for arrays (PDX structures), JSON.stringify for plain objects
        let code;
        if (Array.isArray(data)) {
            code = formatBlock(data);
        } else if (typeof data === 'object') {
            code = escapeHtml(JSON.stringify(data, null, 2));
        } else {
            code = escapeHtml(String(data));
        }

        // Human view: use Humanize if available
        let human;
        if (typeof Humanize !== 'undefined' && Humanize.humanizeBlock) {
            human = Humanize.humanizeBlock(data, label);
        } else {
            human = code; // Fallback to code if humanize not loaded
        }

        return `
            <div class="dual-view" data-label="${escapeHtml(label)}">
                <div class="block-header">
                    <h4>${escapeHtml(label)}</h4>
                    <button class="view-toggle" title="Toggle Code/Readable">
                        <span class="toggle-code">{ }</span>
                        <span class="toggle-human">Aa</span>
                    </button>
                </div>
                <pre class="code-view block code-block">${code}</pre>
                <div class="human-view block">${human}</div>
            </div>`;
    }

    /**
     * Attach toggle click handlers to all .view-toggle buttons within a container.
     * Call after setting innerHTML with dualView content.
     */
    function initToggles(container) {
        if (!container) return;
        container.querySelectorAll('.view-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dv = btn.closest('.dual-view');
                dv.classList.toggle('show-code');
            });
        });
    }

    /**
     * Render a single tech prerequisite as a clickable gold tag.
     * Uses I18n to resolve the tech_id to a localized name.
     */
    function techLink(techId) {
        const displayName = (typeof I18n !== 'undefined') ? (I18n.t(techId) || techId) : techId;
        return `<span class="tech-link" data-tech-id="${escapeHtml(techId)}">${escapeHtml(displayName)}</span>`;
    }

    /**
     * Map an array of prerequisite tech IDs to clickable tech-link spans.
     */
    function techLinks(prerequisites) {
        if (!prerequisites || !prerequisites.length) return '';
        return prerequisites.map(t => techLink(t)).join('');
    }

    /**
     * Attach click handlers to all .tech-link elements within a container.
     * Navigates to tech.html?focus=tech_id on click.
     */
    function initTechLinks(container) {
        if (!container) return;
        container.querySelectorAll('.tech-link').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const techId = el.dataset.techId;
                if (techId) window.location.href = 'exploration.html?tab=technology&focus=' + encodeURIComponent(techId);
            });
        });
    }

    /**
     * URL mapping: item type → page + query param + optional tab.
     */
    const WIKI_LINK_MAP = {
        event:         { page: 'events.html',      param: 'search' },
        building:      { page: 'economy.html',     param: 'search', tab: 'buildings' },
        district:      { page: 'economy.html',     param: 'search', tab: 'districts' },
        megastructure: { page: 'economy.html',     param: 'search', tab: 'megastructures' },
        civic:         { page: 'governments.html', param: 'search', tab: 'civics' },
        authority:     { page: 'governments.html', param: 'search', tab: 'authorities' },
        government:    { page: 'governments.html', param: 'search', tab: 'governments' },
        tradition:     { page: 'governments.html', param: 'search', tab: 'traditions' },
        policy:        { page: 'governments.html', param: 'search', tab: 'policies' },
        edict:         { page: 'governments.html', param: 'search', tab: 'edicts' },
        trait:         { page: 'traits.html',      param: 'search', tab: 'traits' },
        perk:          { page: 'traits.html',      param: 'search', tab: 'perks' },
        anomaly:       { page: 'exploration.html', param: 'search', tab: 'anomalies' },
        archaeology:   { page: 'exploration.html', param: 'search', tab: 'archaeology' },
        technology:    { page: 'tech.html',        param: 'focus' },
        ship:          { page: 'ships.html',       param: 'search', tab: 'ships' },
        component:     { page: 'ships.html',       param: 'search', tab: 'components' },
        empire:        { page: 'empires.html',     param: 'search', tab: 'empires' },
    };

    /**
     * Create a clickable cross-link span to any wiki item.
     */
    function wikiLink(itemId, type, displayName) {
        const label = displayName || itemId;
        return `<span class="wiki-link" data-item-id="${escapeHtml(itemId)}" data-item-type="${escapeHtml(type)}">${escapeHtml(label)}</span>`;
    }

    /**
     * Attach click handlers to all .wiki-link elements within a container.
     */
    function initWikiLinks(container) {
        if (!container) return;
        container.querySelectorAll('.wiki-link').forEach(el => {
            if (el._wikiLinkBound) return;
            el._wikiLinkBound = true;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = el.dataset.itemId;
                const type = el.dataset.itemType;
                const target = WIKI_LINK_MAP[type];
                if (!id || !target) return;
                let url = target.page + '?' + target.param + '=' + encodeURIComponent(id);
                if (target.tab) url += '&tab=' + encodeURIComponent(target.tab);
                window.location.href = url;
            });
        });
    }

    /**
     * Placeholder screenshots shown in the detail panel before the user
     * picks an item, keyed by page basename -> active tab -> image path.
     * Tabs missing here fall back to the panel being hidden (the list keeps
     * the full width, same as before this feature).
     */
    const PLACEHOLDER_MAP = {
        'economy.html': {
            buildings:      'screenshots/planetview.png',
            districts:      'screenshots/planetview.png',
            jobs:           'screenshots/jobs.png',
            megastructures: 'screenshots/megastruct.png',
            deposits:       'screenshots/ressources.png',
        },
        'governments.html': {
            governments: 'screenshots/civics.png',
            civics:      'screenshots/civics.png',
            authorities: 'screenshots/civics.png',
            councilors:  'screenshots/council.png',
            policies:    'screenshots/policies_edicts.png',
            edicts:      'screenshots/policies_edicts.png',
            perks:       'screenshots/ascension.png',
        },
        'ships.html': {
            ships:      'screenshots/ships.png',
            components: 'screenshots/components.png',
        },
        'traits.html': {
            traits: 'screenshots/traits.png',
            perks:  'screenshots/ascension.png',
        },
    };

    function _pageBasename() {
        const path = (typeof window !== 'undefined' && window.location)
            ? window.location.pathname : '';
        const last = path.split('/').filter(Boolean).pop() || 'index.html';
        return last.toLowerCase();
    }

    function getPlaceholder(tab) {
        const page = PLACEHOLDER_MAP[_pageBasename()];
        if (!page || !tab) return null;
        return page[tab] || null;
    }

    function renderPlaceholder(detailPanel, detailContent, tab) {
        if (!detailPanel || !detailContent) return;
        const img = getPlaceholder(tab);
        if (!img) {
            detailPanel.classList.remove('detail-placeholder');
            detailPanel.classList.add('hidden');
            return;
        }
        detailPanel.classList.remove('hidden');
        detailPanel.classList.add('detail-placeholder');
        detailContent.innerHTML =
            `<div class="detail-placeholder-img" style="background-image:url('${img}')"></div>`;
    }

    function hidePlaceholder(detailPanel) {
        if (!detailPanel) return;
        detailPanel.classList.remove('detail-placeholder');
    }

    return {
        formatBlock, dualView, initToggles, escapeHtml,
        techLink, techLinks, initTechLinks,
        wikiLink, initWikiLinks,
        getPlaceholder, renderPlaceholder, hidePlaceholder,
    };
})();
