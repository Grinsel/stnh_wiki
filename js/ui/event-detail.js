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
        contentEl().innerHTML = '<div class="loading">Loading event details</div>';
        titleEl().textContent = eventId;
        AppState.set('selectedEvent', eventId);

        DataManager.loadNamespaceDetail(namespace).then(events => {
            const event = events.find(e => e.id === eventId);
            if (!event) {
                contentEl().innerHTML = '<div class="loading" style="animation:none">Event not found in detail data</div>';
                return;
            }
            titleEl().textContent = I18n.t(event.title_key) || eventId;
            contentEl().innerHTML = Render.eventDetail(event);

            // Attach click handlers for event links
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
    }

    return { show, hide, init, navigateToEvent };
})();
