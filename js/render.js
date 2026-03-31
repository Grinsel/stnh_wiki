/**
 * Rendering utilities for event cards and detail views.
 */
const Render = (() => {

    function eventCard(event, query) {
        const name = SearchEngine.highlightText(event.name || event.id, query);
        const snippet = SearchEngine.highlightText(event.snip || '', query);
        const typeClass = `type-${event.type}`;
        const typeLabel = event.type.replace('_event', '');
        const picUrl = DataManager.getPictureUrl(event.pic);

        const thumbHtml = picUrl
            ? `<div class="event-card-thumb"><img src="${picUrl}" alt="" loading="lazy" onerror="this.parentElement.innerHTML=''"></div>`
            : `<div class="event-card-thumb"></div>`;

        // Chain-head card
        if (event._chainHead) {
            return `
                <div class="event-card chain-head" data-event-id="${event.id}" data-namespace="${event.ns}" data-chain-id="${event._chainId}">
                    ${thumbHtml}
                    <div class="event-card-body">
                        <div class="event-card-header">
                            <span class="chain-badge">\u26d3 ${event._chainSize} Events</span>
                            <span class="event-type-badge ${typeClass}">${typeLabel}</span>
                            <span class="event-card-name">${name}</span>
                            <span class="event-card-id">${event.id}</span>
                        </div>
                        <div class="event-card-snippet">${snippet}</div>
                    </div>
                    <button class="chain-expand" title="Expand chain">\u25BC</button>
                </div>
            `;
        }

        // Chain-member card (collapsed by default)
        if (event._chainCollapsed) {
            return `
                <div class="event-card chain-member" data-event-id="${event.id}" data-namespace="${event.ns}" data-chain-id="${event._chainId}">
                    ${thumbHtml}
                    <div class="event-card-body">
                        <div class="event-card-header">
                            <span class="event-type-badge ${typeClass}">${typeLabel}</span>
                            <span class="event-card-name">${name}</span>
                            <span class="event-card-id">${event.id}</span>
                        </div>
                        <div class="event-card-snippet">${snippet}</div>
                    </div>
                </div>
            `;
        }

        // Normal card
        return `
            <div class="event-card" data-event-id="${event.id}" data-namespace="${event.ns}">
                ${thumbHtml}
                <div class="event-card-body">
                    <div class="event-card-header">
                        <span class="event-type-badge ${typeClass}">${typeLabel}</span>
                        <span class="event-card-name">${name}</span>
                        <span class="event-card-id">${event.id}</span>
                    </div>
                    <div class="event-card-snippet">${snippet}</div>
                </div>
            </div>
        `;
    }

    function dualView(block, label) {
        if (!block || (Array.isArray(block) && !block.length)) return '';
        const code = formatBlock(block);
        const human = Humanize.humanizeBlock(block, label);
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

    function eventDetail(event) {
        const loc = I18n.getData();
        let html = '';

        // Picture
        const picUrl = DataManager.getPictureUrl(event.picture);
        if (picUrl) {
            html += `<div class="detail-picture"><img src="${picUrl}" alt="${event.id}" onerror="this.parentElement.style.display='none'"></div>`;
        }

        // Meta badges
        html += '<div class="detail-meta">';
        html += `<span class="detail-meta-item event-type-badge type-${event.type}">${event.type.replace('_event', '')}</span>`;
        html += `<span class="detail-meta-item">${event.id}</span>`;
        if (event.namespace) html += `<span class="detail-meta-item">ns: ${event.namespace}</span>`;
        if (event.is_triggered_only) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.triggered_only')}</span>`;
        if (event.hide_window) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.hidden')}</span>`;
        if (event.fire_only_once) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.fire_once')}</span>`;
        if (event.diplomatic) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.diplomatic')}</span>`;
        html += `<span class="detail-meta-item">${event.source_file}</span>`;
        html += '</div>';

        // Description(s)
        if (event.desc_keys && event.desc_keys.length > 0) {
            html += '<div class="detail-section">';
            html += `<div class="detail-section-title">${I18n.ui('ui.event.description')}</div>`;
            for (const desc of event.desc_keys) {
                const text = I18n.t(desc.text);
                html += `<div class="detail-desc">${escapeHtml(text)}</div>`;
                if (desc.trigger) {
                    html += dualView(desc.trigger, I18n.ui('ui.event.condition'));
                }
            }
            html += '</div>';
        }

        // Trigger
        if (event.trigger) {
            html += '<div class="detail-section">';
            html += dualView(event.trigger, I18n.ui('ui.event.trigger_conditions'));
            html += '</div>';
        }

        // Immediate
        if (event.immediate) {
            html += '<div class="detail-section">';
            html += dualView(event.immediate, I18n.ui('ui.event.immediate_effects'));
            html += '</div>';
        }

        // Options
        if (event.options && event.options.length > 0) {
            html += '<div class="detail-section">';
            html += `<div class="detail-section-title">${I18n.ui('ui.event.options')} (${event.options.length})</div>`;
            for (const opt of event.options) {
                html += renderOption(opt);
            }
            html += '</div>';
        }

        // After
        if (event.after) {
            html += '<div class="detail-section">';
            html += dualView(event.after, I18n.ui('ui.event.after_effects'));
            html += '</div>';
        }

        // MTTH
        if (event.mean_time_to_happen) {
            html += '<div class="detail-section">';
            html += dualView(event.mean_time_to_happen, I18n.ui('ui.event.mtth'));
            html += '</div>';
        }

        // On-Actions
        if (event.on_actions && event.on_actions.length > 0) {
            html += '<div class="detail-section">';
            html += `<div class="detail-section-title">${I18n.ui('ui.event.on_actions')}</div>`;
            html += '<div class="related-events">';
            for (const oa of event.on_actions) {
                html += `<span class="detail-meta-item">${oa}</span>`;
            }
            html += '</div></div>';
        }

        // Triggered by
        if (event.triggered_by && event.triggered_by.length > 0) {
            html += '<div class="detail-section">';
            html += `<div class="detail-section-title">${I18n.ui('ui.event.triggered_by')}</div>`;
            html += '<div class="related-events">';
            for (const eid of event.triggered_by) {
                html += `<span class="related-event-tag event-link" data-event-id="${eid}">${eid}</span>`;
            }
            html += '</div></div>';
        }

        // Triggers
        if (event.triggers_events && event.triggers_events.length > 0) {
            html += '<div class="detail-section">';
            html += `<div class="detail-section-title">${I18n.ui('ui.event.triggers')}</div>`;
            html += '<div class="related-events">';
            for (const eid of event.triggers_events) {
                html += `<span class="related-event-tag event-link" data-event-id="${eid}">${eid}</span>`;
            }
            html += '</div></div>';
        }

        return html;
    }

    function renderOption(opt) {
        // name_key can be a string or an array of conditional text objects
        let name;
        if (Array.isArray(opt.name_key)) {
            name = opt.name_key.map(n => I18n.t(n.text || n)).filter(Boolean).join(' / ');
        } else {
            name = opt.name_key ? I18n.t(opt.name_key) : I18n.ui('ui.misc.unnamed');
        }
        let html = `<div class="option-card">`;
        html += `<div class="option-name">${escapeHtml(name)}</div>`;

        if (opt.custom_tooltip) {
            html += `<div class="option-effects"><em>${escapeHtml(I18n.t(opt.custom_tooltip))}</em></div>`;
        }

        if (opt.allow) {
            html += `<div class="option-allow">${dualView(opt.allow, I18n.ui('ui.event.requires'))}</div>`;
        }
        if (opt.trigger) {
            html += `<div class="option-trigger">${dualView(opt.trigger, I18n.ui('ui.event.shows_if'))}</div>`;
        }

        if (opt.effects && opt.effects.length > 0) {
            html += `<div class="option-effects">${dualView(opt.effects, I18n.ui('ui.event.effects') || 'Effects')}</div>`;
        }

        if (opt.triggered_events && opt.triggered_events.length > 0) {
            html += '<div class="option-triggered-events">';
            for (const eid of opt.triggered_events) {
                html += `<span class="event-link" data-event-id="${eid}">→ ${eid}</span> `;
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

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
                    // Operator block: { ">": 10 }
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

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { eventCard, eventDetail };
})();
