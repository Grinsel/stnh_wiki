/**
 * Paginated event list component.
 */
const EventList = (() => {
    const PAGE_SIZE = 100;
    let currentEvents = [];
    let currentPage = 1;

    function render(events, page, query) {
        currentEvents = events;
        currentPage = page;
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageEvents = events.slice(start, end);

        const listEl = document.getElementById('event-list');
        if (pageEvents.length === 0) {
            listEl.innerHTML = '<div class="loading" style="animation:none">No events found</div>';
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        listEl.innerHTML = pageEvents.map(e => {
            let prefix = '';
            if (e._searchDivider) {
                prefix = '<div class="search-section-divider">Other namespaces</div>';
            }
            return prefix + Render.eventCard(e, query);
        }).join('');

        // Attach click handlers
        listEl.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const eventId = card.dataset.eventId;
                const ns = card.dataset.namespace;
                EventDetail.show(eventId, ns);
                // Mark active
                listEl.querySelectorAll('.event-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
        });

        renderPagination(events.length, page);
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
