/**
 * Event detail panel. Lazy-loads namespace detail JSON.
 */
const EventDetail = (() => {
    const panel = () => document.getElementById('event-detail-panel');
    const titleEl = () => document.getElementById('detail-title');
    const contentEl = () => document.getElementById('event-detail');

    function show(eventId, namespace) {
        if (!namespace) namespace = '_no_namespace';
        panel().classList.remove('hidden');
        contentEl().innerHTML = '<div class="loading">' + I18n.ui('ui.loading.event_details') + '</div>';
        titleEl().textContent = eventId;
        AppState.set('selectedEvent', eventId);

        DataManager.loadNamespaceDetail(namespace).then(events => {
            const event = events.find(e => e.id === eventId);
            if (!event) {
                contentEl().innerHTML = '<div class="loading" style="animation:none">' + I18n.ui('ui.empty.event_not_found') + '</div>';
                return;
            }
            titleEl().textContent = I18n.t(event.title_key) || eventId;
            contentEl().innerHTML = Render.eventDetail(event);

            // Attach per-block view toggle handlers
            contentEl().querySelectorAll('.view-toggle').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const container = btn.closest('.dual-view');
                    container.classList.toggle('show-code');
                });
            });

            // Attach click handlers for event links (including those inside human-view)
            contentEl().querySelectorAll('.event-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigateToEvent(link.dataset.eventId);
                });
            });
        }).catch(err => {
            contentEl().innerHTML = `<div class="loading" style="animation:none">Error: ${err.message}</div>`;
        });
    }

    function hide() {
        panel().classList.add('hidden');
        AppState.set('selectedEvent', '');
    }

    function navigateToEvent(eventId) {
        // Find the event in the index to get its namespace
        const index = DataManager.getEventsIndex();
        const entry = index.find(e => e.id === eventId);
        if (entry) {
            show(eventId, entry.ns);
        }
    }

    function init() {
        document.getElementById('detail-close').addEventListener('click', hide);

        // Add global view toggle button to detail header
        const header = document.querySelector('#event-detail-panel .detail-header');
        if (header) {
            const globalBtn = document.createElement('button');
            globalBtn.className = 'global-view-toggle';
            globalBtn.title = 'Toggle all blocks to Code view';
            globalBtn.textContent = '{ }';
            globalBtn.addEventListener('click', () => {
                const isCode = globalBtn.classList.toggle('active');
                contentEl().querySelectorAll('.dual-view').forEach(dv => {
                    dv.classList.toggle('show-code', isCode);
                });
            });
            header.insertBefore(globalBtn, header.querySelector('#detail-close'));
        }
    }

    return { show, hide, init, navigateToEvent };
})();
