/**
 * Governments, Civics, Authorities, Policies, Edicts & Councilors page controller.
 */
(async function initGovernments() {
    const listEl = document.getElementById('item-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">' + I18n.ui('ui.loading.governments') + '</div>';

    AppState.init();
    Common.init();

    const searchInput = document.getElementById('search-input');
    searchInput.value = AppState.get('search');

    try {
        const [governments, civics, authorities, policies, edicts, councilors, traditions, perks] = await Promise.all([
            DataManager.loadJSON('assets/governments.json'),
            DataManager.loadJSON('assets/civics.json'),
            DataManager.loadJSON('assets/authorities.json'),
            DataManager.loadJSON('assets/policies.json'),
            DataManager.loadJSON('assets/edicts.json'),
            DataManager.loadJSON('assets/councilors.json'),
            DataManager.loadJSON('assets/traditions.json'),
            DataManager.loadJSON('assets/ascension_perks.json'),
        ]);
        await I18n.setLanguageForModule(AppState.get('lang'), 'governments');

        const allData = { governments, civics, authorities, policies, edicts, councilors, traditions, perks };
        for (const key of Object.keys(allData)) {
            for (const item of allData[key]) {
                item.name = I18n.t(item.name_key) || item.id;
            }
        }

        const ICON_DIRS = { civics: 'civics', authorities: 'authorities', edicts: 'edicts', policies: 'policies', councilors: 'councilors', perks: 'ascension_perks' };

        // ── Tradition tree data structure ──
        const traditionTreeMap = new Map();
        for (const t of traditions) {
            if (!traditionTreeMap.has(t.tree)) {
                traditionTreeMap.set(t.tree, { adopt: null, finish: null, nodes: [] });
            }
            const entry = traditionTreeMap.get(t.tree);
            if (t.role === 'adopt') entry.adopt = t;
            else if (t.role === 'finish') entry.finish = t;
            else entry.nodes.push(t);
        }
        for (const [, tree] of traditionTreeMap) {
            const nodeIds = new Set(tree.nodes.map(n => n.id));
            for (const node of tree.nodes) {
                node._deps = [];
                if (node.possible) {
                    for (const cond of node.possible) {
                        const depId = cond.has_tradition || cond.has_active_tradition;
                        if (depId && nodeIds.has(depId)) node._deps.push(depId);
                    }
                }
            }
        }

        // ── Overlay state ──
        let activeOverlay = null;
        let activeOverlayItemId = null;
        function removeOverlayImmediate() {
            if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; activeOverlayItemId = null; }
        }

        // Populate tree dropdown
        const treeSel = document.getElementById('filter-tree');
        if (treeSel) {
            const trees = [...new Set(traditions.map(t => t.tree).filter(Boolean))].sort();
            for (const t of trees) treeSel.add(new Option(t, t));
            treeSel.addEventListener('change', () => { currentPage = 1; removeOverlayImmediate(); renderAll(); });
        }

        let activeTab = 'governments';
        let currentPage = 1;
        const PAGE_SIZE = 100;

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                document.getElementById('filter-origins-group').classList.toggle('hidden', activeTab !== 'civics');
                const treeGroup = document.getElementById('filter-tree-group');
                if (treeGroup) treeGroup.classList.toggle('hidden', activeTab !== 'traditions');
                if (activeTab !== 'traditions') removeOverlayImmediate();
                SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
                renderAll();
            });
        });

        // Detail panel
        const detailPanel = document.getElementById('detail-panel');
        const detailTitle = document.getElementById('detail-title');
        const detailContent = document.getElementById('detail-content');
        let currentDetailItem = null;
        document.getElementById('detail-close').addEventListener('click', () => {
            currentDetailItem = null;
            SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
        });

        function getIconInfo(item) {
            if (activeTab === 'policies') return { dir: 'edicts', stem: 'edict_type_policy' };
            if (item.icon_dir && item.icon) return { dir: item.icon_dir, stem: item.icon };
            const dir = ICON_DIRS[activeTab];
            const stem = item.icon || '';
            if (dir && stem) return { dir, stem };
            return null;
        }

        function showDetail(item) {
            currentDetailItem = item;
            SharedRender.hidePlaceholder(detailPanel);
            detailTitle.textContent = item.name || item.id;
            const ic = getIconInfo(item);
            const iconHtml = ic
                ? `<img class="detail-icon" src="icons/${ic.dir}/${esc(ic.stem)}.webp" alt="" onerror="this.style.display='none'">`
                : '';
            let html = `<div class="detail-meta" style="align-items:center">${iconHtml}`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.ruler_title) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.ruler')}: ${esc(I18n.t(item.ruler_title) || item.ruler_title)}</span>`;
            if (item.election_type) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.election')}: ${esc(item.election_type)}</span>`;
            if (item.has_heir) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.has_heir')}</span>`;
            if (item.is_origin) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.origin')}</span>`;
            if (item.length) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.duration')}: ${item.length}</span>`;
            if (item.is_ambition) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.ambition')}</span>`;
            if (item.leader_class && item.leader_class.length) html += item.leader_class.map(c => `<span class="detail-meta-item">${esc(c)}</span>`).join('');
            if (item.civic) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.civic')}: ${SharedRender.wikiLink(item.civic, 'civic', I18n.t(item.civic) || item.civic)}</span>`;
            if (item.required) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.required')}</span>`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;

            // Desc
            const descKey = item.id + '_desc';
            const desc = I18n.t(descKey);
            if (desc && desc !== descKey) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.description')}</div>`;
                html += `<div class="detail-desc">${esc(desc)}</div></div>`;
            }

            if (item.prerequisites && item.prerequisites.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                html += `<div class="detail-meta">${SharedRender.techLinks(item.prerequisites)}</div></div>`;
            }

            if (item.resources) {
                html += `<div class="detail-section">${SharedRender.dualView(item.resources, I18n.ui('ui.detail.resources'))}</div>`;
            }

            if (item.modifier) {
                html += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            }

            if (item.possible) {
                html += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.requirements'))}</div>`;
            }

            if (item.potential) {
                html += `<div class="detail-section">${SharedRender.dualView(item.potential, I18n.ui('ui.detail.potential'))}</div>`;
            }

            if (item.is_leader_possible) {
                html += `<div class="detail-section">${SharedRender.dualView(item.is_leader_possible, I18n.ui('ui.detail.leader_possible'))}</div>`;
            }

            // Policy options
            if (item.options && item.options.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.options')}</div>`;
                for (const opt of item.options) {
                    const optName = I18n.t(opt.name) || opt.name;
                    const optIconHtml = opt.icon
                        ? `<img class="item-card-icon" src="icons/policies/${esc(opt.icon)}.webp" alt="" style="width:28px;height:28px;vertical-align:middle;margin-right:6px" onerror="this.style.display='none'">`
                        : '';
                    html += `<div class="option-card">`;
                    html += `<div class="option-name">${optIconHtml}${esc(optName)}</div>`;
                    if (opt.policy_flags && opt.policy_flags.length) {
                        html += `<div class="detail-meta">${opt.policy_flags.map(f => `<span class="detail-meta-item">${esc(f)}</span>`).join('')}</div>`;
                    }
                    if (opt.modifier) {
                        html += SharedRender.dualView(opt.modifier, I18n.ui('ui.detail.modifiers'));
                    }
                    html += `</div>`;
                }
                html += `</div>`;
            }

            if (item.weight) {
                html += `<div class="detail-section">${SharedRender.dualView(item.weight, I18n.ui('ui.detail.weight'))}</div>`;
            }

            // Ascension Perk specific fields
            if (item.required_technologies && item.required_technologies.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                html += `<div class="detail-meta">${SharedRender.techLinks(item.required_technologies)}</div></div>`;
            }
            if (item.required_traditions && item.required_traditions.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.required_traditions')}</div>`;
                html += `<div class="detail-meta">${item.required_traditions.map(t => SharedRender.wikiLink(t, 'tradition', I18n.t(t) || t)).join('')}</div></div>`;
            }
            if (item.min_perks) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.min_perks')}</div>`;
                html += `<div class="detail-meta"><span class="detail-meta-item">${item.min_perks}+ already activated</span></div></div>`;
            }
            if (item.required_flags && item.required_flags.length) {
                html += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.required_flags')}</div>`;
                html += `<div class="detail-meta">${item.required_flags.map(f => `<span class="detail-meta-item">${esc(f)}</span>`).join('')}</div></div>`;
            }
            if (item.on_enabled) {
                html += `<div class="detail-section">${SharedRender.dualView(item.on_enabled, I18n.ui('ui.detail.on_enabled'))}</div>`;
            }
            if (item.tradition_swap) {
                html += `<div class="detail-section">${SharedRender.dualView(item.tradition_swap, I18n.ui('ui.detail.tradition_swaps'))}</div>`;
            }

            detailContent.innerHTML = html;
            SharedRender.initToggles(detailContent);
            SharedRender.initTechLinks(detailContent);
            SharedRender.initWikiLinks(detailContent);
            detailPanel.classList.remove('hidden');
        }

        // Search
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                AppState.set('search', e.target.value);
                currentPage = 1;
                renderAll();
            }, 200);
        });

        // Origins checkbox
        const originsCheckbox = document.getElementById('filter-origins');
        if (originsCheckbox) {
            originsCheckbox.addEventListener('change', () => { currentPage = 1; renderAll(); });
        }

        document.addEventListener('wiki-lang-changed', () => {
            for (const key of Object.keys(allData)) {
                for (const item of allData[key]) item.name = I18n.t(item.name_key) || item.id;
            }
            removeOverlayImmediate();
            renderAll();
            if (currentDetailItem) showDetail(currentDetailItem);
        });

        // Tab from URL (before renderAll)
        const urlTab = AppState.get('tab');
        if (urlTab) {
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${urlTab}"]`);
            if (tabBtn) {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                activeTab = urlTab;
                document.getElementById('filter-origins-group').classList.toggle('hidden', activeTab !== 'civics');
                const treeGroup2 = document.getElementById('filter-tree-group');
                if (treeGroup2) treeGroup2.classList.toggle('hidden', activeTab !== 'traditions');
            }
        }

        renderAll();
        SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab);
        I18n.loadFullLocalisation();

        // Auto-select item from URL (after renderAll)
        const selectId = AppState.get('select');
        if (selectId) {
            const allItems = [...governments, ...civics, ...authorities, ...policies, ...edicts, ...councilors, ...traditions, ...perks];
            const item = allItems.find(i => i.id === selectId);
            if (item) {
                if (traditions.includes(item)) {
                    // Switch to traditions tab and open overlay on the matching node
                    const tabBtn = document.querySelector('.tab-btn[data-tab="traditions"]');
                    if (tabBtn && activeTab !== 'traditions') {
                        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                        tabBtn.classList.add('active');
                        activeTab = 'traditions';
                        const treeGroup = document.getElementById('filter-tree-group');
                        if (treeGroup) treeGroup.classList.toggle('hidden', false);
                        renderAll();
                    }
                    const nodeEl = listEl.querySelector(`[data-id="${CSS.escape(selectId)}"]`);
                    if (nodeEl) {
                        nodeEl.scrollIntoView({ block: 'center' });
                        nodeEl.click();
                    }
                } else {
                    showDetail(item);
                }
                AppState.set('select', '');
            }
        }

        function renderAll() {
            if (activeTab === 'traditions') { SharedRender.renderPlaceholder(detailPanel, detailContent, activeTab); renderTraditionTrees(); return; }
            const query = (AppState.get('search') || '').toLowerCase();
            let items = allData[activeTab] || [];
            const total = items.length;

            items = items.filter(item => {
                if (query && !(item.name || '').toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
                if (activeTab === 'civics' && originsCheckbox && originsCheckbox.checked) {
                    if (!item.is_origin) return false;
                }
                return true;
            });

            items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
            document.getElementById('filter-stats').textContent = `${items.length} / ${total} ${I18n.ui('ui.tab.' + activeTab)}`;

            const totalPages = Math.ceil(items.length / PAGE_SIZE);
            const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

            let html = '';
            for (const item of pageItems) {
                const ic = getIconInfo(item);
                const iconCol = ic
                    ? `<div class="item-card-icon-col"><img class="item-card-icon" src="icons/${ic.dir}/${esc(ic.stem)}.webp" alt="" onerror="this.closest('.item-card-icon-col').style.display='none'"></div>`
                    : '';
                html += `<div class="item-card" data-id="${esc(item.id)}">
                    ${iconCol}
                    <div class="item-card-body">
                        <div class="item-card-header">
                            <span class="item-card-name">${esc(item.name || item.id)}</span>
                            <span class="item-card-id">${esc(item.id)}</span>
                        </div>
                        <div class="item-card-meta">`;
                if (item.ruler_title) html += `<span class="detail-meta-item">${esc(I18n.t(item.ruler_title) || item.ruler_title)}</span>`;
                if (item.election_type) html += `<span class="detail-meta-item">${esc(item.election_type)}</span>`;
                if (item.is_origin) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.origin')}</span>`;
                if (item.is_ambition) html += `<span class="detail-meta-item">${I18n.ui('ui.badge.ambition')}</span>`;
                if (item.options) html += `<span class="detail-meta-item">${item.options.length} ${I18n.ui('ui.card.options')}</span>`;
                if (item.leader_class && item.leader_class.length) html += item.leader_class.map(c => `<span class="detail-meta-item">${esc(c)}</span>`).join('');
                if (item.civic) html += `<span class="detail-meta-item">${esc(I18n.t(item.civic) || item.civic)}</span>`;
                html += `</div></div></div>`;
            }
            listEl.innerHTML = html || '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';

            listEl.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', () => {
                    listEl.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    const item = (allData[activeTab] || []).find(i => i.id === card.dataset.id);
                    if (item) showDetail(item);
                });
            });

            renderPagination(totalPages);
        }

        function renderPagination(totalPages) {
            const pagEl = document.getElementById('pagination');
            if (totalPages <= 1) { pagEl.innerHTML = ''; pagEl.classList.remove('pagination-sticky', 'hide-at-top'); return; }
            const firstDis = currentPage <= 1;
            const lastDis = currentPage >= totalPages;
            let html = '';
            html += `<button class="page-btn${firstDis ? ' disabled' : ''}" data-page="1"${firstDis ? ' disabled' : ''}>&laquo;&laquo;</button>`;
            html += `<button class="page-btn${firstDis ? ' disabled' : ''}" data-page="${Math.max(1, currentPage - 1)}"${firstDis ? ' disabled' : ''}>&laquo;</button>`;
            for (let p = Math.max(1, currentPage - 3); p <= Math.min(totalPages, currentPage + 3); p++) {
                html += `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
            }
            html += `<button class="page-btn${lastDis ? ' disabled' : ''}" data-page="${Math.min(totalPages, currentPage + 1)}"${lastDis ? ' disabled' : ''}>&raquo;</button>`;
            html += `<button class="page-btn${lastDis ? ' disabled' : ''}" data-page="${totalPages}"${lastDis ? ' disabled' : ''}>&raquo;&raquo;</button>`;
            pagEl.innerHTML = html;
            pagEl.classList.add('pagination-sticky');
            pagEl.classList.toggle('hide-at-top', currentPage === 1);
            pagEl.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentPage = parseInt(btn.dataset.page);
                    renderAll();
                    listEl.scrollIntoView({ behavior: 'smooth' });
                });
            });
        }

        // ── Tradition overlay functions ──
        function buildTraditionOverlayHtml(item) {
            let html = `<div class="relic-overlay-header">`;
            html += `<button class="relic-detail-back">&larr; ${I18n.ui('ui.search.back')}</button>`;
            html += `<div class="relic-overlay-title">`;
            html += `<img class="relic-overlay-icon" src="icons/traditions/${esc(item.icon || item.id)}.webp" alt="" onerror="this.style.display='none'">`;
            html += `<h3>${esc(item.name || item.id)}</h3>`;
            html += `</div></div>`;
            let leftHtml = '';
            const descKey = item.id + '_desc';
            const desc = I18n.t(descKey);
            if (desc && desc !== descKey) {
                leftHtml += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.description')}</div>`;
                leftHtml += `<div class="detail-desc">${esc(desc)}</div></div>`;
            }
            if (item.modifier) leftHtml += `<div class="detail-section">${SharedRender.dualView(item.modifier, I18n.ui('ui.detail.modifiers'))}</div>`;
            let rightHtml = '';
            if (item.required_technologies && item.required_technologies.length) {
                rightHtml += `<div class="detail-section"><div class="detail-section-title">${I18n.ui('ui.detail.prerequisites')}</div>`;
                rightHtml += `<div class="detail-meta">${SharedRender.techLinks(item.required_technologies)}</div></div>`;
            }
            if (item.possible) rightHtml += `<div class="detail-section">${SharedRender.dualView(item.possible, I18n.ui('ui.detail.requirements'))}</div>`;
            if (item.on_enabled) rightHtml += `<div class="detail-section">${SharedRender.dualView(item.on_enabled, I18n.ui('ui.detail.on_enabled'))}</div>`;
            if (item.tradition_swap) rightHtml += `<div class="detail-section">${SharedRender.dualView(item.tradition_swap, I18n.ui('ui.detail.tradition_swaps'))}</div>`;
            html += `<div class="relic-overlay-columns">`;
            if (leftHtml) html += `<div class="relic-overlay-col">${leftHtml}</div>`;
            if (rightHtml) html += `<div class="relic-overlay-col">${rightHtml}</div>`;
            html += `</div>`;
            html += `<div class="relic-overlay-footer">`;
            html += `<span class="detail-meta-item">${I18n.ui('ui.meta.id')}: ${esc(item.id)}</span>`;
            if (item.tree) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.tree')}: ${esc(item.tree)}</span>`;
            if (item.role) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.role')}: ${esc(item.role)}</span>`;
            if (item.source_file) html += `<span class="detail-meta-item">${I18n.ui('ui.meta.file')}: ${esc(item.source_file)}</span>`;
            html += `</div>`;
            return html;
        }

        function expandTraditionOverlay(triggerEl, item) {
            removeOverlayImmediate();
            const grid = triggerEl.closest('.tradition-trees-grid');
            if (!grid) return;
            const gridRect = grid.getBoundingClientRect();
            const triggerRect = triggerEl.getBoundingClientRect();
            const startTop = triggerRect.top - gridRect.top + grid.scrollTop;
            const startLeft = triggerRect.left - gridRect.left;
            const startW = triggerRect.width;
            const startH = triggerRect.height;
            const overlay = document.createElement('div');
            overlay.className = 'tradition-detail-overlay';
            overlay.style.top = startTop + 'px';
            overlay.style.left = startLeft + 'px';
            overlay.style.width = startW + 'px';
            overlay.style.height = startH + 'px';
            overlay.innerHTML = `<div class="detail-inner">${buildTraditionOverlayHtml(item)}</div>`;
            grid.appendChild(overlay);
            activeOverlay = overlay;
            activeOverlayItemId = item.id;
            const gridW = grid.offsetWidth;
            const targetW = Math.min(560, gridW);
            const targetLeft = (gridW - targetW) / 2;
            const targetTop = Math.max(0, startTop - 20);
            overlay.style.transition = 'none';
            overlay.style.left = targetLeft + 'px';
            overlay.style.width = targetW + 'px';
            overlay.style.height = 'auto';
            overlay.style.visibility = 'hidden';
            const contentH = Math.max(overlay.scrollHeight, 300);
            overlay.style.left = startLeft + 'px';
            overlay.style.width = startW + 'px';
            overlay.style.height = startH + 'px';
            overlay.style.visibility = '';
            overlay.offsetHeight; // eslint-disable-line no-unused-expressions
            overlay.style.transition = '';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    overlay.style.left = targetLeft + 'px';
                    overlay.style.top = targetTop + 'px';
                    overlay.style.width = targetW + 'px';
                    overlay.style.height = contentH + 'px';
                    let expanded = false;
                    const doExpand = () => {
                        if (expanded) return;
                        expanded = true;
                        overlay.removeEventListener('transitionend', onExpand);
                        overlay.classList.add('expanded');
                        overlay.style.height = 'auto';
                        const inner = overlay.querySelector('.detail-inner');
                        if (inner) { SharedRender.initToggles(inner); SharedRender.initTechLinks(inner); SharedRender.initWikiLinks(inner); }
                    };
                    const onExpand = () => doExpand();
                    overlay.addEventListener('transitionend', onExpand);
                    setTimeout(doExpand, 400);
                });
            });
            overlay.querySelector('.relic-detail-back').addEventListener('click', (e) => {
                e.stopPropagation();
                collapseTraditionOverlay(triggerEl);
            });
        }

        function collapseTraditionOverlay(triggerEl) {
            const overlay = activeOverlay;
            if (!overlay) return;
            const grid = overlay.parentElement;
            if (!grid) { removeOverlayImmediate(); return; }
            overlay.classList.remove('expanded');
            const currentH = overlay.offsetHeight;
            overlay.style.height = currentH + 'px';
            overlay.offsetHeight; // force reflow // eslint-disable-line no-unused-expressions
            if (triggerEl && document.contains(triggerEl)) {
                const gridRect = grid.getBoundingClientRect();
                const triggerRect = triggerEl.getBoundingClientRect();
                const targetTop = triggerRect.top - gridRect.top + grid.scrollTop;
                const targetLeft = triggerRect.left - gridRect.left;
                overlay.style.top = targetTop + 'px';
                overlay.style.left = targetLeft + 'px';
                overlay.style.width = triggerRect.width + 'px';
                overlay.style.height = triggerRect.height + 'px';
                let collapsed = false;
                const doCollapse = () => {
                    if (collapsed) return;
                    collapsed = true;
                    overlay.removeEventListener('transitionend', onCollapse);
                    removeOverlayImmediate();
                };
                const onCollapse = () => doCollapse();
                overlay.addEventListener('transitionend', onCollapse);
                setTimeout(doCollapse, 400);
            } else {
                overlay.style.opacity = '0';
                setTimeout(() => removeOverlayImmediate(), 300);
            }
        }

        function computeLevels(nodes) {
            const hasEdges = nodes.some(n => n._deps.length > 0);
            if (!hasEdges && nodes.length === 5) {
                return [nodes.slice(0, 2), [nodes[2]], nodes.slice(3, 5)];
            }
            const levels = [];
            const placed = new Set();
            let remaining = [...nodes];
            while (remaining.length > 0) {
                const level = [];
                const nextRemaining = [];
                for (const node of remaining) {
                    if (node._deps.every(d => placed.has(d))) level.push(node);
                    else nextRemaining.push(node);
                }
                if (level.length === 0) { levels.push(remaining); break; }
                levels.push(level);
                for (const n of level) placed.add(n.id);
                remaining = nextRemaining;
            }
            return levels;
        }

        function renderTraditionTrees() {
            const query = (AppState.get('search') || '').toLowerCase();
            const filterTree = treeSel ? treeSel.value : '';
            const visibleTrees = [];
            for (const [treeName, tree] of traditionTreeMap) {
                if (filterTree && treeName !== filterTree) continue;
                if (query) {
                    const allItems = [tree.adopt, ...tree.nodes, tree.finish].filter(Boolean);
                    if (!allItems.some(item => (item.name || '').toLowerCase().includes(query) || item.id.toLowerCase().includes(query))) continue;
                }
                visibleTrees.push([treeName, tree]);
            }
            visibleTrees.sort((a, b) => a[0].localeCompare(b[0]));
            const matchingItems = visibleTrees.reduce((sum, [, t]) => sum + 1 + t.nodes.length + 1, 0);
            document.getElementById('filter-stats').textContent = `${visibleTrees.length} / ${traditionTreeMap.size} Trees (${matchingItems} ${I18n.ui('ui.tab.traditions')})`;
            if (visibleTrees.length === 0) {
                listEl.innerHTML = '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_items') + '</div>';
                document.getElementById('pagination').innerHTML = '';
                return;
            }
            let html = `<svg style="position:absolute;width:0;height:0;overflow:hidden">
                <defs><marker id="arrowhead" markerWidth="7" markerHeight="5" refX="0" refY="2.5" orient="auto">
                    <polygon points="0 0, 7 2.5, 0 5" fill="var(--accent-dim)"/>
                </marker></defs></svg>`;
            html += '<div class="tradition-trees-grid">';
            let treeIdx = 0;
            for (const [treeName, tree] of visibleTrees) {
                const levels = computeLevels(tree.nodes);
                const treeLabelKey = tree.adopt ? tree.adopt.name_key : treeName;
                let treeLabel = I18n.t(treeLabelKey) || treeName;
                if (treeLabel === treeLabelKey) treeLabel = treeName.replace(/_/g, ' ');
                html += `<div class="tradition-tree-block" style="--stagger:${treeIdx}" data-tree="${esc(treeName)}"><div class="tradition-tree-header">`;
                treeIdx++;
                html += `<span class="tradition-tree-name">${esc(treeLabel)}</span>`;
                if (tree.adopt) {
                    html += `<button class="tradition-bonus-btn" data-id="${esc(tree.adopt.id)}" title="${esc(tree.adopt.name || tree.adopt.id)}"><img src="icons/traditions/${esc(tree.adopt.icon || tree.adopt.id)}.webp" alt="" onerror="this.style.display='none'"><span>Adopt</span></button>`;
                }
                html += `</div><div class="tradition-tree-body">`;
                for (const level of levels) {
                    html += `<div class="tradition-level">`;
                    for (const node of level) {
                        html += `<div class="tradition-node" data-id="${esc(node.id)}" data-deps="${esc((node._deps || []).join(','))}"><img src="icons/traditions/${esc(node.icon || node.id)}.webp" alt="" onerror="this.style.display='none'"><span class="tradition-node-name">${esc(node.name || node.id)}</span></div>`;
                    }
                    html += `</div>`;
                }
                html += `<svg class="tradition-arrows"></svg></div>`;
                html += `<div class="tradition-tree-footer">`;
                if (tree.finish) {
                    html += `<button class="tradition-bonus-btn tradition-finish-btn" data-id="${esc(tree.finish.id)}" title="${esc(tree.finish.name || tree.finish.id)}"><img src="icons/traditions/${esc(tree.finish.icon || tree.finish.id)}.webp" alt="" onerror="this.style.display='none'"><span>Finish</span></button>`;
                }
                html += `</div></div>`;
            }
            html += '</div>';
            listEl.innerHTML = html;
            document.getElementById('pagination').innerHTML = '';
            requestAnimationFrame(() => drawAllArrows());
            listEl.querySelectorAll('.tradition-node').forEach(nodeEl => {
                nodeEl.addEventListener('click', () => {
                    const item = traditions.find(t => t.id === nodeEl.dataset.id);
                    if (item) expandTraditionOverlay(nodeEl, item);
                });
            });
            listEl.querySelectorAll('.tradition-bonus-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const item = traditions.find(t => t.id === btn.dataset.id);
                    if (item) expandTraditionOverlay(btn, item);
                });
            });
        }

        function drawAllArrows() {
            listEl.querySelectorAll('.tradition-tree-block').forEach(block => {
                const svg = block.querySelector('.tradition-arrows');
                if (!svg) return;
                const body = block.querySelector('.tradition-tree-body');
                const bodyRect = body.getBoundingClientRect();
                const nodeEls = block.querySelectorAll('.tradition-node');
                const nodeMap = new Map();
                nodeEls.forEach(el => nodeMap.set(el.dataset.id, el));
                const edges = [];
                nodeEls.forEach(el => {
                    const deps = el.dataset.deps;
                    if (!deps) return;
                    for (const depId of deps.split(',').filter(Boolean)) {
                        if (nodeMap.has(depId)) edges.push({ from: depId, to: el.dataset.id });
                    }
                });
                const fromCount = new Map();
                const toCount = new Map();
                for (const e of edges) {
                    fromCount.set(e.from, (fromCount.get(e.from) || 0) + 1);
                    toCount.set(e.to, (toCount.get(e.to) || 0) + 1);
                }
                const fromIdx = new Map();
                const toIdx = new Map();
                const pad = 6;
                const spread = 8;
                let paths = '';
                for (const e of edges) {
                    const parentEl = nodeMap.get(e.from);
                    const childEl = nodeMap.get(e.to);
                    if (!parentEl || !childEl) continue;
                    const parentRect = parentEl.getBoundingClientRect();
                    const childRect = childEl.getBoundingClientRect();
                    const fi = fromIdx.get(e.from) || 0; fromIdx.set(e.from, fi + 1);
                    const fc = fromCount.get(e.from);
                    const fOff = fc > 1 ? (fi - (fc - 1) / 2) * spread : 0;
                    const ti = toIdx.get(e.to) || 0; toIdx.set(e.to, ti + 1);
                    const tc = toCount.get(e.to);
                    const tOff = tc > 1 ? (ti - (tc - 1) / 2) * spread : 0;
                    const px = parentRect.left - bodyRect.left + parentRect.width / 2 + fOff;
                    const py = parentRect.top - bodyRect.top + parentRect.height + pad;
                    const cx = childRect.left - bodyRect.left + childRect.width / 2 + tOff;
                    const cy = childRect.top - bodyRect.top - pad;
                    const dy = Math.abs(cy - py);
                    const tension = Math.min(dy * 0.45, 30);
                    paths += `<path d="M${px.toFixed(1)},${py.toFixed(1)} C${px.toFixed(1)},${(py+tension).toFixed(1)} ${cx.toFixed(1)},${(cy-tension).toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}"/>`;
                }
                svg.innerHTML = paths;
                svg.setAttribute('width', body.offsetWidth);
                svg.setAttribute('height', body.offsetHeight);
            });
        }

        // Redraw arrows on resize (debounced)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (activeTab === 'traditions') drawAllArrows();
            }, 150);
        });

    } catch (err) {
        listEl.innerHTML = `<div class="loading" style="animation:none">${I18n.ui('ui.error.load_failed')}: ${err.message}</div>`;
        console.error(err);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
