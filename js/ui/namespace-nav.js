/**
 * Namespace sidebar navigation, grouped by faction.
 * Supports chain navigation mode when a chain event is selected.
 */
const NAMESPACE_NAV_BUILD = 'chain-curve-build-014';
if (typeof localStorage !== 'undefined' && localStorage.getItem('stnh-debug')) {
    console.log('[namespace-nav]', NAMESPACE_NAV_BUILD);
}

const NamespaceNav = (() => {
    let expanded = {};
    let chainMode = false;

    // --- Curved Logic Tree-Indentation state ---
    // The sidebar renders a chain around the currently active event with
    // *causal* fisheye, not spatial. Ancestors of the active event ramp
    // gradually up into full indent at the active row; descendants ramp
    // gradually back down below it. Items not on the ancestor/descendant
    // line (siblings, unrelated chain members) sit flat at indent 0 so
    // the user can clearly tell "this isn't a child, it just shares an
    // ancestor".
    const CURVE_BASE_INDENT  = 6;    // px per depth level at active row
    const CURVE_SMOOTH       = 0.08; // per-frame lerp factor (~1s ease-out feel)
    const CURVE_MIN_MEMBERS  = 5;    // chains below this stay on linear indent
    const CURVE_ANCESTOR_RAMP = 6;   // rows above active where ramp reaches 0
    const CURVE_DESCENDANT_RAMP = 6; // rows below active where ramp reaches 0

    let curveRaf = null;
    let curveItems = null;         // cached [{el, depth}] for current chain
    let curveRelations = null;     // { triggers: {id->Set}, triggeredBy: {id->Set} }
    let curveMembersInOrder = null;// ids in DOM order
    let curveIndexById = null;     // id -> position in curveMembersInOrder
    let curveTargets = null;       // targetIndent[] by item index
    let curveCurrent = null;       // currentIndent[] by item index (for lerp)
    let curveDirty = false;        // at least one item needs more lerp
    let currentChainId = null;     // tracks which chain the tree is built for

    /**
     * Compute full step-distance maps (no ramp limit — needed for reorder).
     * Returns { ancestorSteps, descendantSteps } keyed by id.
     */
    function buildStepMaps(activeId) {
        const ancestorSteps = {};
        {
            const queue = [[activeId, 0]];
            const seen = new Set([activeId]);
            while (queue.length) {
                const [id, step] = queue.shift();
                ancestorSteps[id] = step;
                const parents = curveRelations.triggeredBy[id];
                if (!parents) continue;
                for (const p of parents) {
                    if (!seen.has(p) && curveIndexById[p] != null) {
                        seen.add(p);
                        queue.push([p, step + 1]);
                    }
                }
            }
        }
        const descendantSteps = {};
        {
            const queue = [[activeId, 0]];
            const seen = new Set([activeId]);
            while (queue.length) {
                const [id, step] = queue.shift();
                if (id !== activeId) descendantSteps[id] = step;
                const kids = curveRelations.triggers[id];
                if (!kids) continue;
                for (const k of kids) {
                    if (!seen.has(k) && curveIndexById[k] != null) {
                        seen.add(k);
                        queue.push([k, step + 1]);
                    }
                }
            }
        }
        return { ancestorSteps, descendantSteps };
    }

    /**
     * Reorder the DOM so ancestors come above the active row and descendants
     * below. Siblings/unrelated keep their original chain order and sink to
     * the bottom. Called on every active-change. After reordering, the curve
     * bookkeeping is rebuilt so offsetTop lookups match the new layout.
     */
    function reorderForActive(activeId, maps) {
        if (!curveItems || !curveMembersInOrder) return;
        const ancestorSteps = maps.ancestorSteps;
        const descendantSteps = maps.descendantSteps;
        const treeEl = curveItems[0].el.parentElement;
        if (!treeEl) return;

        // Split members by role, preserving original chain order within each
        // bucket. Ancestors are then sorted by step DESC so the oldest parent
        // ends up at the top.
        const ancestors = [];
        const descendants = [];
        const others = [];
        for (const id of curveMembersInOrder) {
            if (id === activeId) continue;
            if (ancestorSteps[id] != null) ancestors.push(id);
            else if (descendantSteps[id] != null) descendants.push(id);
            else others.push(id);
        }
        ancestors.sort((a, b) => ancestorSteps[b] - ancestorSteps[a]);
        // descendants already in BFS-enough order via chain order; keep as-is.

        const newOrder = [...ancestors, activeId, ...descendants, ...others];

        // Fetch current element refs by id, then re-append in new order.
        const elById = {};
        for (let i = 0; i < curveItems.length; i++) {
            elById[curveMembersInOrder[i]] = curveItems[i].el;
        }
        // Capture depth per id so we can rebuild curveItems.
        const depthById = {};
        for (let i = 0; i < curveItems.length; i++) {
            depthById[curveMembersInOrder[i]] = curveItems[i].depth;
        }
        // Capture current lerp state per id so the reorder doesn't snap the
        // visual indent — items that were mid-fade keep their current value.
        const currentById = {};
        for (let i = 0; i < curveItems.length; i++) {
            currentById[curveMembersInOrder[i]] = curveCurrent[i];
        }

        // Detach-and-reappend in batch. Browsers are fine with this; it
        // doesn't trigger one reflow per append because we're inside a JS
        // task and only layout-read comes later (on next frame via offsetTop).
        for (const id of newOrder) {
            const el = elById[id];
            if (el) treeEl.appendChild(el);
        }

        // Rebuild curve bookkeeping in the new order.
        curveMembersInOrder = newOrder;
        curveIndexById = {};
        for (let i = 0; i < newOrder.length; i++) curveIndexById[newOrder[i]] = i;
        curveItems = newOrder.map(id => ({ el: elById[id], depth: depthById[id] || 0 }));
        curveTargets = new Array(curveItems.length).fill(0);
        curveCurrent = newOrder.map(id => currentById[id] || 0);
    }

    /**
     * For a given active id, classify every member and pick a target indent.
     * - ancestor N steps above: indent = activeDepth * base * (1 - N/rampA)
     *   (clamped ≥ 0). Goes linearly from full at active row up to 0 at
     *   CURVE_ANCESTOR_RAMP rows away.
     * - descendant N steps below (in the trigger DAG): indent =
     *   (activeDepth + N) * base * (1 - N/rampD) (clamped ≥ 0).
     * - everything else (sibling / unrelated within the chain component):
     *   indent = 0.
     */
    function computeTargetIndents(activeId, maps) {
        if (!curveItems || !curveRelations) return;
        const activeIdx = curveIndexById[activeId];
        if (activeIdx == null) return;
        const activeDepth = curveItems[activeIdx].depth;
        const ancestorSteps = maps.ancestorSteps;
        const descendantSteps = maps.descendantSteps;

        for (let i = 0; i < curveItems.length; i++) {
            const it = curveItems[i];
            const id = curveMembersInOrder[i];
            let indent = 0;
            if (id === activeId) {
                indent = activeDepth * CURVE_BASE_INDENT;
            } else if (ancestorSteps[id] != null) {
                const step = ancestorSteps[id];
                const ramp = Math.max(0, 1 - step / CURVE_ANCESTOR_RAMP);
                indent = activeDepth * CURVE_BASE_INDENT * ramp;
            } else if (descendantSteps[id] != null) {
                const step = descendantSteps[id];
                const ramp = Math.max(0, 1 - step / CURVE_DESCENDANT_RAMP);
                indent = (activeDepth + step) * CURVE_BASE_INDENT * ramp;
            }
            curveTargets[i] = indent;
        }
        curveDirty = true;
    }

    function updateCurveIndents() {
        if (!curveItems || !curveDirty) return;
        let stillDirty = false;
        for (let i = 0; i < curveItems.length; i++) {
            const tgt = curveTargets[i];
            const cur = curveCurrent[i];
            const next = cur + (tgt - cur) * CURVE_SMOOTH;
            curveCurrent[i] = next;
            if (Math.abs(tgt - next) > 0.2) stillDirty = true;
            const out = next < 0.1 ? 0 : next;
            const el = curveItems[i].el;
            // padding-left (not transform) so the item actually takes up that
            // width in layout — combined with the ensured min-width below the
            // tree is guaranteed to overflow horizontally when any row is
            // wider than the sidebar.
            el.style.paddingLeft = out > 0.1 ? `calc(0.3rem + ${out.toFixed(2)}px)` : '';
        }
        // Force the tree to be at least as wide as its widest row so the
        // scrollbar container actually registers the overflow. Pure CSS
        // shrink-to-fit fails here because the flex column chain above us
        // has its own min-width: 0 and the browser ends up clipping long
        // names instead of extending the scroll area.
        ensureCurveScrollWidth();
        curveDirty = stillDirty;
    }

    function ensureCurveScrollWidth() {
        if (!curveItems || curveItems.length === 0) return;
        const tree = curveItems[0].el.parentElement;
        if (!tree) return;
        const spacer = tree.querySelector('.chain-nav-spacer');
        let widest = 0;
        for (const it of curveItems) {
            const rect = it.el.getBoundingClientRect();
            const inner = it.el.scrollWidth;
            const w = Math.max(rect.width, inner);
            if (w > widest) widest = w;
        }
        if (spacer) {
            const currentMin = parseFloat(spacer.style.width) || 0;
            if (Math.abs(widest - currentMin) > 0.5) {
                spacer.style.width = widest + 'px';
            }
        }
        updateHScrollThumb();
    }

    let _hScrollWired = false;
    let _hScrollCleanup = null;   // () => void; removes all listeners wired below
    function wireHScrollOnce() {
        if (_hScrollWired) return;
        if (!curveItems || curveItems.length === 0) return;
        const tree = curveItems[0].el.parentElement;
        if (!tree) return;
        const wrapper = tree.parentElement; // .chain-nav
        if (!wrapper) return;
        const bar = wrapper.querySelector('.chain-hscroll');
        if (!bar) return;
        const thumb = bar.querySelector('.chain-hscroll-thumb');
        if (!thumb) return;
        _hScrollWired = true;

        // Resize handler flags the next rAF frame instead of measuring right
        // away — guarantees layout has settled before updateHScrollThumb reads
        // barRect.width.
        const onResize = () => { curveDirty = true; };

        // Tree scroll -> move thumb
        tree.addEventListener('scroll', updateHScrollThumb, { passive: true });
        window.addEventListener('resize', onResize, { passive: true });

        // Click on bar -> scroll tree so clicked point becomes thumb center
        const onBarDown = (e) => {
            if (e.target === thumb) return; // thumb handles its own drag
            const barRect = bar.getBoundingClientRect();
            const ratio = (e.clientX - barRect.left) / barRect.width;
            const scrollable = tree.scrollWidth - tree.clientWidth;
            tree.scrollLeft = ratio * scrollable;
        };
        bar.addEventListener('mousedown', onBarDown);

        // Thumb drag
        let dragStartX = 0;
        let dragStartScroll = 0;
        const onMove = (e) => {
            const barRect = bar.getBoundingClientRect();
            const scrollable = tree.scrollWidth - tree.clientWidth;
            const barScrollable = barRect.width - thumb.offsetWidth;
            if (barScrollable <= 0) return;
            const deltaX = e.clientX - dragStartX;
            tree.scrollLeft = dragStartScroll + (deltaX / barScrollable) * scrollable;
        };
        const onUp = () => {
            bar.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        const onThumbDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragStartX = e.clientX;
            dragStartScroll = tree.scrollLeft;
            bar.classList.add('dragging');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
        thumb.addEventListener('mousedown', onThumbDown);

        _hScrollCleanup = () => {
            tree.removeEventListener('scroll', updateHScrollThumb);
            window.removeEventListener('resize', onResize);
            bar.removeEventListener('mousedown', onBarDown);
            thumb.removeEventListener('mousedown', onThumbDown);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }

    function updateHScrollThumb() {
        if (!curveItems || curveItems.length === 0) return;
        const tree = curveItems[0].el.parentElement;
        if (!tree) return;
        const wrapper = tree.parentElement;
        if (!wrapper) return;
        const bar = wrapper.querySelector('.chain-hscroll');
        if (!bar) return;
        const thumb = bar.querySelector('.chain-hscroll-thumb');
        if (!thumb) return;

        const scrollable = tree.scrollWidth - tree.clientWidth;
        if (scrollable <= 0) {
            // no overflow — dim the bar or hide
            bar.style.opacity = '0.3';
            thumb.style.width = '100%';
            thumb.style.left = '0';
            return;
        }
        bar.style.opacity = '';
        const ratio = tree.clientWidth / tree.scrollWidth;
        const barRect = bar.getBoundingClientRect();
        const thumbWidth = Math.max(16, ratio * barRect.width);
        thumb.style.width = thumbWidth + 'px';
        const maxThumbLeft = barRect.width - thumbWidth;
        thumb.style.left = ((tree.scrollLeft / scrollable) * maxThumbLeft) + 'px';
    }

    function curveFrame() {
        updateCurveIndents();
        curveRaf = requestAnimationFrame(curveFrame);
    }

    function setCurveActive(id, animate = true) {
        if (!curveItems || curveIndexById[id] == null) return;
        const maps = buildStepMaps(id);
        reorderForActive(id, maps);
        computeTargetIndents(id, maps);
        if (!animate) {
            for (let i = 0; i < curveItems.length; i++) curveCurrent[i] = curveTargets[i];
        }
        curveDirty = true;
    }

    function startCurveAnim(itemEls, depths, memberIds, relations, activeId) {
        stopCurveAnim();
        curveItems = itemEls.map((el, i) => ({ el, depth: depths[i] || 0 }));
        curveMembersInOrder = memberIds.slice();
        curveIndexById = {};
        for (let i = 0; i < memberIds.length; i++) curveIndexById[memberIds[i]] = i;
        curveRelations = relations;
        curveTargets = new Array(curveItems.length).fill(0);
        curveCurrent = new Array(curveItems.length).fill(0);
        _hScrollWired = false;
        // Snap to initial state so the first paint isn't a 1-second animation
        // from flat to classified. Subsequent clicks animate.
        setCurveActive(activeId, false);
        curveDirty = true;
        curveRaf = requestAnimationFrame(curveFrame);
        // Wire our custom horizontal scrollbar once the DOM is in place.
        wireHScrollOnce();
    }

    function stopCurveAnim() {
        if (curveRaf != null) {
            cancelAnimationFrame(curveRaf);
            curveRaf = null;
        }
        if (_hScrollCleanup) {
            _hScrollCleanup();
            _hScrollCleanup = null;
        }
        _hScrollWired = false;
        curveItems = null;
        curveRelations = null;
        curveMembersInOrder = null;
        curveIndexById = null;
        curveTargets = null;
        curveCurrent = null;
        curveDirty = false;
    }

    /**
     * Build trigger/triggered_by lookup maps restricted to the chain members.
     */
    function buildChainRelations(chain) {
        const rels = ChainIndex.getRelationships();
        const memberSet = new Set(chain.members);
        const triggers = {};
        const triggeredBy = {};
        for (const id of chain.members) {
            const r = rels && rels[id];
            if (!r) continue;
            if (r.triggers) {
                for (const t of r.triggers) {
                    if (memberSet.has(t)) {
                        (triggers[id] = triggers[id] || new Set()).add(t);
                    }
                }
            }
            if (r.triggered_by) {
                for (const t of r.triggered_by) {
                    if (memberSet.has(t)) {
                        (triggeredBy[id] = triggeredBy[id] || new Set()).add(t);
                    }
                }
            }
        }
        return { triggers, triggeredBy };
    }

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

        // Fast path: same chain as before (user clicked a different event in
        // the same chain). Skip the rebuild, just move the active marker and
        // let the curve animate the classification over — this is what makes
        // sidebar clicks feel the same as event-list clicks.
        const treeEl = document.getElementById('namespace-tree');
        if (currentChainId === chain.id && curveItems) {
            treeEl.querySelectorAll('.chain-nav-item').forEach(n => n.classList.remove('active'));
            const newActive = treeEl.querySelector(`.chain-nav-item[data-event-id="${currentEventId}"]`);
            if (newActive) {
                newActive.classList.add('active');
                setCurveActive(currentEventId, true);
                newActive.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
            return;
        }

        stopCurveAnim();
        currentChainId = chain.id;
        const headerEl = document.querySelector('.sidebar-header h3');
        const index = DataManager.getEventsIndex();

        // Build lookup map for O(1) access
        const indexMap = {};
        for (const e of index) { indexMap[e.id] = e; }

        // Update header
        if (headerEl) {
            headerEl.innerHTML = '\u26d3 Event Chain';
        }

        // Whether to enable the curved fisheye indent. Short chains stay flat
        // (curve would be visually noisy for 2-3 items) and users with
        // prefers-reduced-motion get the classic linear indent.
        const reduceMotion = typeof window !== 'undefined'
            && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const useCurve = chain.members.length >= CURVE_MIN_MEMBERS && !reduceMotion;

        let html = '';
        html += '<div class="chain-nav">';
        html += `<button class="chain-nav-back" title="Back to Namespaces">\u2190 Namespaces</button>`;
        html += `<div class="chain-nav-tree${useCurve ? ' curve' : ''}">`;

        // Pre-compute depth map for all members at once
        const depthMap = buildDepthMap(chain);

        for (const memberId of chain.members) {
            const isRoot = memberId === chain.root;
            const isActive = memberId === currentEventId;
            const entry = indexMap[memberId];
            const name = entry ? (entry.name || memberId) : memberId;

            const depth = depthMap[memberId] || 0;
            // Linear mode: inline padding-left (classic fallback).
            // Curve mode: depth is read from data-depth by the rAF loop and
            // applied as transform, so padding stays 0 to reclaim horizontal
            // space for the name when items slide away from the focus row.
            const pad = (!useCurve && depth > 0) ? ` style="padding-left:${depth * 0.8}rem"` : '';

            html += `<div class="chain-nav-item${isRoot ? ' root' : ''}${isActive ? ' active' : ''}" data-event-id="${memberId}" data-depth="${depth}"${pad}>`;
            if (depth > 0) html += '<span class="chain-nav-arrow">\u2192</span>';
            html += `<span class="chain-nav-name">${escapeHtml(name)}</span>`;
            html += `<span class="chain-nav-id">${memberId}</span>`;
            html += '</div>';
        }

        // Invisible spacer row — JS pins its width to the widest row so the
        // tree's internal scrollLeft has real range to work with.
        if (useCurve) html += '<div class="chain-nav-spacer"></div>';

        html += '</div>';
        // Custom horizontal scrollbar (see ensureCurveScrollWidth + wireHScroll).
        // Firefox/webkit native bars render inconsistently inside this sticky
        // flex-column nesting, so we draw our own that we can rely on.
        if (useCurve) html += '<div class="chain-hscroll"><div class="chain-hscroll-thumb"></div></div>';
        html += '</div>';
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
                // Curve re-classifies members relative to the new active row.
                if (useCurve) setCurveActive(eventId, true);
            });
        });

        const backBtn = treeEl.querySelector('.chain-nav-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                showNamespaceNav();
            });
        }

        // Kick off the curve animation loop if applicable.
        if (useCurve) {
            const itemEls = Array.from(treeEl.querySelectorAll('.chain-nav-item'));
            const depths = itemEls.map(el => parseInt(el.dataset.depth, 10) || 0);
            const relations = buildChainRelations(chain);
            startCurveAnim(itemEls, depths, chain.members, relations, currentEventId);
            // Bring the active row into view; the curve classifies around it.
            const active = treeEl.querySelector('.chain-nav-item.active');
            if (active) active.scrollIntoView({ block: 'center' });
        }
    }

    /**
     * Build depth map for all members in a chain. Uses undirected BFS from
     * the root: follow both `triggers` (outgoing) and `triggered_by`
     * (incoming) edges so every member reachable within the chain's
     * connected component gets a finite depth. Trigger-only BFS left most
     * members undefined in chains that gather events loosely linked via
     * triggered_by rather than straight trigger cascades.
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
            if (!rel) continue;
            const neighbours = [];
            if (rel.triggers) neighbours.push(...rel.triggers);
            if (rel.triggered_by) neighbours.push(...rel.triggered_by);
            for (const n of neighbours) {
                if (memberSet.has(n) && depths[n] === undefined) {
                    depths[n] = depths[current] + 1;
                    queue.push(n);
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
        currentChainId = null;
        stopCurveAnim();
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
