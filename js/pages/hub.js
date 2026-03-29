/**
 * Hub page - landing page for the STNH Wiki.
 * Shows stats dashboard and section cards.
 */
(async function initHub() {
    // Init shared UI
    AppState.init();
    Common.init();

    const hubContent = document.getElementById('hub-content');
    if (!hubContent) return;

    try {
        const lastUpdate = await DataManager.loadJSON('assets/last_update.json');

        // Stats Dashboard
        const statsEl = document.getElementById('stats-dashboard');
        if (statsEl && lastUpdate) {
            const ts = lastUpdate.timestamp
                ? new Date(lastUpdate.timestamp).toLocaleString()
                : 'Unknown';
            const elapsed = lastUpdate.elapsed_seconds
                ? `${lastUpdate.elapsed_seconds}s`
                : '-';

            let locStats = '';
            const locResults = lastUpdate.results && lastUpdate.results.localisation;
            if (locResults && typeof locResults === 'object') {
                locStats = Object.entries(locResults)
                    .map(([lang, count]) => `<span class="stat-item">${lang}: ${Number(count).toLocaleString()}</span>`)
                    .join('');
            }

            statsEl.innerHTML = `
                <div class="stat-card">
                    <div class="stat-label">Last Update</div>
                    <div class="stat-value">${ts}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Pipeline Time</div>
                    <div class="stat-value">${elapsed}</div>
                </div>
                <div class="stat-card wide">
                    <div class="stat-label">Localisation Keys</div>
                    <div class="stat-values">${locStats || '<span class="stat-item">No data</span>'}</div>
                </div>
            `;
        }
    } catch (err) {
        console.warn('Could not load last_update.json:', err.message);
    }
})();
