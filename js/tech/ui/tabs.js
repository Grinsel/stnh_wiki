// Tab switching logic for General/Details panels
// Usage: import { switchTab } from './ui/tabs.js'; switchTab('general'|'details')
export function switchTab(tab, { generalTab, detailsTab, generalPanel, detailsPanel } = {}) {
  // If DOM refs are not provided, fallback to querying by IDs (backward compatible)
  const _generalTab = generalTab || document.getElementById('general-tab');
  const _detailsTab = detailsTab || document.getElementById('details-tab');
  const _generalPanel = generalPanel || document.getElementById('general-panel');
  const _detailsPanel = detailsPanel || document.getElementById('details-panel');

  if (tab === 'details') {
    _generalTab?.classList.remove('active');
    _detailsTab?.classList.add('active');
    _generalPanel?.classList.add('hidden');
    _detailsPanel?.classList.add('active');
  } else {
    _detailsTab?.classList.remove('active');
    _generalTab?.classList.add('active');
    _detailsPanel?.classList.remove('active');
    _generalPanel?.classList.remove('hidden');
  }
}
