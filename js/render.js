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
        if (event.is_triggered_only) html += `<span class="detail-meta-item">triggered only</span>`;
        if (event.hide_window) html += `<span class="detail-meta-item">hidden</span>`;
        if (event.fire_only_once) html += `<span class="detail-meta-item">fire once</span>`;
        if (event.diplomatic) html += `<span class="detail-meta-item">diplomatic</span>`;
        html += `<span class="detail-meta-item">${event.source_file}</span>`;
        html += '</div>';

        // Description(s)
        if (event.desc_keys && event.desc_keys.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">Description</div>';
            for (const desc of event.desc_keys) {
                const text = I18n.t(desc.text);
                html += `<div class="detail-desc">${escapeHtml(text)}</div>`;
                if (desc.trigger) {
                    html += `<div class="detail-desc conditional">Condition: ${formatBlock(desc.trigger)}</div>`;
                }
            }
            html += '</div>';
        }

        // Trigger
        if (event.trigger) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">Trigger Conditions</div>';
            html += `<div class="code-block">${formatBlock(event.trigger)}</div>`;
            html += '</div>';
        }

        // Immediate
        if (event.immediate) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">Immediate Effects</div>';
            html += `<div class="code-block">${formatBlock(event.immediate)}</div>`;
            html += '</div>';
        }

        // Options
        if (event.options && event.options.length > 0) {
            html += '<div class="detail-section">';
            html += `<div class="detail-section-title">Options (${event.options.length})</div>`;
            for (const opt of event.options) {
                html += renderOption(opt);
            }
            html += '</div>';
        }

        // After
        if (event.after) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">After Effects</div>';
            html += `<div class="code-block">${formatBlock(event.after)}</div>`;
            html += '</div>';
        }

        // MTTH
        if (event.mean_time_to_happen) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">Mean Time to Happen</div>';
            html += `<div class="code-block">${formatBlock(event.mean_time_to_happen)}</div>`;
            html += '</div>';
        }

        // On-Actions
        if (event.on_actions && event.on_actions.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">Triggered by On-Actions</div>';
            html += '<div class="related-events">';
            for (const oa of event.on_actions) {
                html += `<span class="detail-meta-item">${oa}</span>`;
            }
            html += '</div></div>';
        }

        // Triggered by
        if (event.triggered_by && event.triggered_by.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">Triggered By</div>';
            html += '<div class="related-events">';
            for (const eid of event.triggered_by) {
                html += `<span class="related-event-tag event-link" data-event-id="${eid}">${eid}</span>`;
            }
            html += '</div></div>';
        }

        // Triggers
        if (event.triggers_events && event.triggers_events.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">Triggers</div>';
            html += '<div class="related-events">';
            for (const eid of event.triggers_events) {
                html += `<span class="related-event-tag event-link" data-event-id="${eid}">${eid}</span>`;
            }
            html += '</div></div>';
        }

        return html;
    }

    function renderOption(opt) {
        const name = opt.name_key ? I18n.t(opt.name_key) : '(unnamed)';
        let html = `<div class="option-card">`;
        html += `<div class="option-name">${escapeHtml(name)}</div>`;

        if (opt.custom_tooltip) {
            html += `<div class="option-effects"><em>${escapeHtml(I18n.t(opt.custom_tooltip))}</em></div>`;
        }

        if (opt.allow) {
            html += `<div class="option-allow">Requires: <span class="code-block">${formatBlock(opt.allow)}</span></div>`;
        }
        if (opt.trigger) {
            html += `<div class="option-trigger">Shows if: <span class="code-block">${formatBlock(opt.trigger)}</span></div>`;
        }

        if (opt.effects && opt.effects.length > 0) {
            html += `<div class="option-effects"><div class="code-block">${formatBlock(opt.effects)}</div></div>`;
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
