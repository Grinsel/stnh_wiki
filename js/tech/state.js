// State module: centralizes URL/localStorage, history, and UI state.
// Exposes default state and helpers for reading/writing/applying state.

export const DEFAULT_STATE = {
  faction: "federation",  // NEW Phase 2 - UFP as default
  species: "all",
  area: "all",
  category: "all",
  layout: "force-directed",
  search: "",
  tierStart: "0",
  tierEnd: "11",
  focus: null,
  performanceMode: true,
};

export const appState = {
  layout: DEFAULT_STATE.layout,
};

export function loadState() {
  const urlParams = new URLSearchParams(window.location.search);
  const stateFromUrl = {
    layout: urlParams.get("layout"),
    faction: urlParams.get("faction"),  // NEW Phase 2
    species: urlParams.get("species"),
    area: urlParams.get("area"),
    category: urlParams.get("category"),
    search: urlParams.get("search"),
    tierStart: urlParams.get("tierStart"),
    tierEnd: urlParams.get("tierEnd"),
    focus: urlParams.get("focus"),
  };

  const hasUrlParams = Object.values(stateFromUrl).some(v => v !== null);
  if (hasUrlParams) {
    return {
      layout: stateFromUrl.layout || DEFAULT_STATE.layout,
      faction: stateFromUrl.faction || DEFAULT_STATE.faction,  // NEW Phase 2
      species: stateFromUrl.species || DEFAULT_STATE.species,
      area: stateFromUrl.area || DEFAULT_STATE.area,
      category: stateFromUrl.category || DEFAULT_STATE.category,
      search: stateFromUrl.search || DEFAULT_STATE.search,
      tierStart: stateFromUrl.tierStart || DEFAULT_STATE.tierStart,
      tierEnd: stateFromUrl.tierEnd || DEFAULT_STATE.tierEnd,
      focus: stateFromUrl.focus || null,
      performanceMode: DEFAULT_STATE.performanceMode,
    };
  }

  try {
    const raw = localStorage.getItem("techTreeState");
    const parsed = raw ? JSON.parse(raw) : DEFAULT_STATE;
    if (parsed.performanceMode === undefined) parsed.performanceMode = true;
    if (parsed.faction === undefined) parsed.faction = DEFAULT_STATE.faction;  // NEW Phase 2
    return parsed;
  } catch (e) {
    console.warn("Could not load saved state:", e);
    return DEFAULT_STATE;
  }
}

export function saveState() {
  const state = {
    faction: document.getElementById("faction-select")?.value || DEFAULT_STATE.faction,  // NEW Phase 2
    species: document.getElementById("species-select").value,
    area: document.getElementById("area-select").value,
    category: document.getElementById("category-select").value,
    layout: document.getElementById("layout-select").value,
    search: document.getElementById("search-input").value,
    tierStart: document.getElementById("start-tier-select").value,
    tierEnd: document.getElementById("end-tier-select").value,
    focus: window.currentFocusId || null,
    performanceMode: !!document.getElementById("performance-toggle")?.checked,
  };
  try {
    localStorage.setItem("techTreeState", JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save state:", e);
  }
}

export function applyState(state) {
  const factionSelect = document.getElementById("faction-select");
  if (factionSelect) factionSelect.value = state.faction || DEFAULT_STATE.faction;  // NEW Phase 2

  document.getElementById("species-select").value = state.species || 'all';
  document.getElementById("area-select").value = state.area;
  document.getElementById("category-select").value = state.category;
  document.getElementById("layout-select").value = state.layout;
  document.getElementById("search-input").value = state.search;
  document.getElementById("start-tier-select").value = state.tierStart;
  document.getElementById("end-tier-select").value = state.tierEnd;
  const perf = document.getElementById("performance-toggle");
  if (perf) perf.checked = state.performanceMode ?? true;
}

export function resetState() {
  localStorage.removeItem("techTreeState");
  window.location.search = '';
}

// Cookie helpers for simple persistence outside of state object when needed
export function setCookie(name, value, days) {
  const expires = days ? '; expires=' + new Date(Date.now() + days * 864e5).toUTCString() : '';
  document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/';
}

export function getCookie(name) {
  const prefix = name + '=';
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}
