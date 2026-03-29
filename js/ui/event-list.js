/**
 * Paginated event list component with chain grouping support.
 */
const EventList = (() => {
    const PAGE_SIZE = 100;
    let currentEvents = [];
    let currentPage = 1;
    const expandedChains = new Set();
    const CHAIN_INITIAL_SHOW = 5;

    function render(events, page, query) {
        currentEvents = events;
        currentPage = page;
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageEvents = events.slice(start, end);

        const listEl = document.getElementById('event-list');
        if (pageEvents.length === 0) {
            listEl.innerHTML = '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.no_events') + '</div>';
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        // Build HTML with chain grouping
        let html = '';
        let currentChainId = null;
        let chainMembers = [];

        for (const e of pageEvents) {
            if (e._searchDivider) {
                html += '<div class="search-section-divider">' + I18n.ui('ui.empty.other_namespaces') + '</div>';
            }

            if (e._chainHead) {
                // Flush any previous chain group
                if (currentChainId && chainMembers.length > 0) {
                    html += buildChainGroup(currentChainId, chainMembers, query);
                    chainMembers = [];
                }
                currentChainId = e._chainId;
                html += Render.eventCard(e, query);
            } else if (e._chainCollapsed && e._chainId === currentChainId) {
                chainMembers.push(e);
            } else {
                // Flush previous chain group
                if (currentChainId && chainMembers.length > 0) {
                    html += buildChainGroup(currentChainId, chainMembers, query);
                    chainMembers = [];
                }
                currentChainId = null;
                html += Render.eventCard(e, query);
            }
        }

        // Flush final chain group
        if (currentChainId && chainMembers.length > 0) {
            html += buildChainGroup(currentChainId, chainMembers, query);
        }

        listEl.innerHTML = html;

        // Attach click handlers for event cards (not chain-expand buttons)
        listEl.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking the expand button
                if (e.target.closest('.chain-expand')) return;
                const eventId = card.dataset.eventId;
                const ns = card.dataset.namespace;
                EventDetail.show(eventId, ns);
                // Mark active
                listEl.querySelectorAll('.event-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
        });

        // Attach chain expand/collapse handlers
        listEl.querySelectorAll('.chain-expand').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.chain-head');
                const chainId = card.dataset.chainId;
                const group = listEl.querySelector(`.chain-group[data-chain-id="${chainId}"]`);
                if (!group) return;

                const isExpanded = group.style.display !== 'none';
                group.style.display = isExpanded ? 'none' : '';
                btn.textContent = isExpanded ? '\u25BC' : '\u25B2';
                btn.title = isExpanded ? 'Expand chain' : 'Collapse chain';

                if (isExpanded) {
                    expandedChains.delete(chainId);
                } else {
                    expandedChains.add(chainId);
                }
            });
        });

        // Attach "show more" handlers
        listEl.querySelectorAll('.chain-show-more').forEach(btn => {
            btn.addEventListener('click', () => {
                const chainId = btn.dataset.chainId;
                const group = listEl.querySelector(`.chain-group[data-chain-id="${chainId}"]`);
                if (!group) return;
                group.querySelectorAll('.chain-member-wrap.chain-hidden-extra').forEach(m => {
                    m.classList.remove('chain-hidden-extra');
                });
                btn.style.display = 'none';
            });
        });

        renderPagination(events.length, page);
    }

    function buildChainGroup(chainId, members, query) {
        const isExpanded = expandedChains.has(chainId);
        const showAll = members.length <= CHAIN_INITIAL_SHOW;

        let html = `<div class="chain-group" data-chain-id="${chainId}" style="${isExpanded ? '' : 'display:none'}">`;
        for (let i = 0; i < members.length; i++) {
            const extraClass = (!showAll && i >= CHAIN_INITIAL_SHOW) ? ' chain-hidden-extra' : '';
            html += `<div class="chain-member-wrap${extraClass}">`;
            html += Render.eventCard(members[i], query);
            html += '</div>';
        }
        if (!showAll) {
            html += `<button class="chain-show-more" data-chain-id="${chainId}">Show all ${members.length} chain events</button>`;
        }
        html += '</div>';
        return html;
    }

    function renderPagination(total, currentPage) {
        const totalPages = Math.ceil(total / PAGE_SIZE);
        const pagEl = document.getElementById('pagination');
        if (totalPages <= 1) { pagEl.innerHTML = ''; return; }

        let html = '';
        // Prev
        html += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>&lt;</button>`;

        // Page buttons (show max 9 centered on current)
        const start = Math.max(1, currentPage - 4);
        const end = Math.min(totalPages, start + 8);

        if (start > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (start > 2) html += `<span style="color:var(--text-muted);padding:0 0.2rem">...</span>`;
        }
        for (let i = start; i <= end; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (end < totalPages) {
            if (end < totalPages - 1) html += `<span style="color:var(--text-muted);padding:0 0.2rem">...</span>`;
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Next
        html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>&gt;</button>`;

        pagEl.innerHTML = html;
        pagEl.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.page, 10);
                if (p >= 1 && p <= totalPages) {
                    AppState.set('page', p);
                }
            });
        });
    }

    function getPageSize() { return PAGE_SIZE; }

    return { render, getPageSize };
})();
