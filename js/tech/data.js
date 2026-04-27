// Data module: prepares and caches data for rendering.
// UI-agnostic: no DOM or d3 usage here. 

// --- In-memory caches ---
let _techs = null;            // Array<Tech>
let _techsPromise = null;     // In-flight promise guard (prevents double-fetch)
let _species = null;          // Array<string>
let _factions = null;         // Array<Faction> - NEW Phase 2
let _empires = null;          // Array<Empire> - Prescripted countries
let _techItemMap = null;      // { by_tech: {}, by_item: {} }
let _indexById = null;        // Map<string, Tech>

// --- Types (informal) ---
// Tech: {
//   id: string,
//   name?: string,
//   area?: string, // 'physics' | 'society' | 'engineering' | ...
//   tier?: number|string,
//   prerequisites?: string[],
//   required_species?: string[]
// }

// --- Loaders ---
export async function loadTechnologyData() {
  if (Array.isArray(_techs)) return _techs;
  // Guard against concurrent calls: reuse in-flight promise
  if (_techsPromise) return _techsPromise;
  _techsPromise = (async () => {
    const [physics, engineering, society] = await Promise.all([
      fetch('assets/tech/technology_physics.json').then(res => res.json()),
      fetch('assets/tech/technology_engineering.json').then(res => res.json()),
      fetch('assets/tech/technology_society.json').then(res => res.json()),
    ]);
    const data = [...physics, ...engineering, ...society];
    // Create a map of ID -> name for easy lookup
    const nameById = new Map();
    for (const t of data) {
      if (t.id && t.name) {
        nameById.set(t.id, t.name);
      }
    }

    // Normalize
    _techs = (data || []).map(t => ({
      ...t,
      prerequisites: Array.isArray(t.prerequisites) ? t.prerequisites : [],
      required_species: Array.isArray(t.required_species) ? t.required_species : [],
      unlocks: (Array.isArray(t.unlocks) ? t.unlocks : []).map(id => nameById.get(id) || id),
    }));
    _indexById = null; // reset index
    return _techs;
  })();
  return _techsPromise;
}

export async function loadSpeciesList() {
  if (Array.isArray(_species)) return _species;
  const res = await fetch('assets/tech/species.json');
  _species = await res.json();
  return _species;
}

// --- NEW Phase 2: Faction Data Loading ---
export async function loadFactionData() {
  if (Array.isArray(_factions)) return _factions;
  const res = await fetch('assets/tech/factions.json');
  _factions = await res.json();
  return _factions;
}

// --- Empires Data Loading (prescripted countries) ---
export async function loadEmpiresData() {
  if (Array.isArray(_empires)) return _empires;
  const res = await fetch('assets/tech/empires.json');
  _empires = await res.json();
  return _empires;
}

export async function loadTechItemMap() {
  if (_techItemMap) return _techItemMap;
  try {
    const res = await fetch('assets/tech_item_map.json');
    _techItemMap = await res.json();
  } catch (e) {
    console.warn('Tech-Item Map not available:', e);
    _techItemMap = { by_tech: {}, by_item: {} };
  }
  return _techItemMap;
}

export function getTechUnlocks(techId) {
  if (!_techItemMap || !_techItemMap.by_tech) return null;
  return _techItemMap.by_tech[techId] || null;
}

export async function initData() {
  // Best-effort parallel preload (including factions, empires, and tech-item map)
  await Promise.all([loadTechnologyData(), loadSpeciesList(), loadFactionData(), loadEmpiresData(), loadTechItemMap()]);
  return { techs: _techs, species: _species, factions: _factions, empires: _empires };
}

// --- Convenience wrappers for consumers ---

export function isTechDataLoaded() {
  return Array.isArray(_techs);
}

// --- Indexing ---
export function indexTechs(techs) {
  const map = new Map();
  for (const t of techs) map.set(t.id, t);
  return map;
}

function ensureIndex(techs) {
  if (!_indexById) _indexById = indexTechs(techs || _techs || []);
  return _indexById;
}

// --- Graph utilities ---
export function buildLinksFromPrereqs(techs) {
  const links = [];
  const ids = new Set((techs || []).map(t => t.id));
  for (const t of techs || []) {
    const prereqs = Array.isArray(t.prerequisites) ? t.prerequisites : [];
    for (const p of prereqs) {
      if (ids.has(p)) links.push({ source: p, target: t.id });
    }
  }
  return links;
}

export function getConnectedTechIds(startId, techs) {
  const list = techs || _techs || [];
  const connected = new Set();
  function findAncestors(id) {
    const node = list.find(t => t.id === id);
    if (node && node.prerequisites) {
      node.prerequisites.forEach(prereq => {
        if (!connected.has(prereq)) { connected.add(prereq); findAncestors(prereq); }
      });
    }
  }
  function findDescendants(id) {
    list.forEach(t => {
      if (t.prerequisites && t.prerequisites.includes(id) && !connected.has(t.id)) {
        connected.add(t.id);
        findDescendants(t.id);
      }
    });
  }
  connected.add(startId);
  findAncestors(startId);
  findDescendants(startId);
  return connected;
}

export function getPrerequisites(startId, techs) {
  const list = techs || _techs || [];
  const prerequisites = new Set();
  const techMap = new Map(list.map(t => [t.id, t]));
  (function findAncestors(id) {
    if (prerequisites.has(id)) return;
    prerequisites.add(id);
    const node = techMap.get(id);
    if (node && node.prerequisites) node.prerequisites.forEach(findAncestors);
  })(startId);
  return prerequisites;
}

export function calculateAllPaths(startId, endId, techs) {
  const list = techs || _techs || [];
  const techMap = new Map(list.map(t => [t.id, t]));

  // 1. Find all prerequisites for the end node
  const endPrereqs = new Set();
  function findAncestors(id) {
    if (endPrereqs.has(id)) return;
    endPrereqs.add(id);
    const node = techMap.get(id);
    if (node && node.prerequisites) {
      node.prerequisites.forEach(findAncestors);
    }
  }
  findAncestors(endId);

  // 2. Find all descendants of the start node
  const startDescendants = new Set();
  function findDescendants(id) {
    if (startDescendants.has(id)) return;
    startDescendants.add(id);
    const children = list.filter(t => t.prerequisites && t.prerequisites.includes(id));
    children.forEach(c => findDescendants(c.id));
  }
  findDescendants(startId);

  // 3. The intersection of these two sets are the nodes in the path
  const pathNodeIds = new Set([...endPrereqs].filter(id => startDescendants.has(id)));
  pathNodeIds.add(startId);
  pathNodeIds.add(endId);

  const pathNodes = list.filter(t => pathNodeIds.has(t.id));
  const pathLinks = [];
  pathNodes.forEach(t => {
    (t.prerequisites || []).forEach(p => {
      if (pathNodeIds.has(p)) {
        pathLinks.push({ source: p, target: t.id });
      }
    });
  });

  return { nodes: pathNodes, links: pathLinks };
}

export function calculateShortestPath(startId, endId, techs) {
  const list = techs || _techs || [];
  const techMap = new Map(list.map(t => [t.id, t]));
  const adj = new Map();
  list.forEach(t => {
    (t.prerequisites || []).forEach(p => {
      if (!adj.has(p)) adj.set(p, []);
      adj.get(p).push(t.id);
    });
  });

  // Bidirectional BFS across ancestors/descendants
  let qF = [startId], qB = [endId];
  let visitedF = new Map([[startId, [startId]]]), visitedB = new Map([[endId, [endId]]]);
  let path = [];

  while (qF.length > 0 && qB.length > 0) {
    // Forward step
    let currF = qF.shift();
    if (visitedB.has(currF)) { path = visitedF.get(currF).concat(visitedB.get(currF).reverse().slice(1)); break; }
    // Descendants
    if (adj.has(currF)) {
      for (const n of adj.get(currF)) if (!visitedF.has(n)) { visitedF.set(n, [...visitedF.get(currF), n]); qF.push(n); }
    }
    // Ancestors
    const techF = techMap.get(currF);
    if (techF && techF.prerequisites) {
      for (const n of techF.prerequisites) if (!visitedF.has(n)) { visitedF.set(n, [...visitedF.get(currF), n]); qF.push(n); }
    }

    // Backward step
    let currB = qB.shift();
    if (visitedF.has(currB)) { path = visitedF.get(currB).concat(visitedB.get(currB).reverse().slice(1)); break; }
    // Ancestors
    const techB = techMap.get(currB);
    if (techB && techB.prerequisites) {
      for (const n of techB.prerequisites) if (!visitedB.has(n)) { visitedB.set(n, [...visitedB.get(currB), n]); qB.push(n); }
    }
    // Descendants
    if (adj.has(currB)) {
      for (const n of adj.get(currB)) if (!visitedB.has(n)) { visitedB.set(n, [...visitedB.get(currB), n]); qB.push(n); }
    }
  }

  const pathNodeIds = new Set(path);
  const pathNodes = list.filter(t => pathNodeIds.has(t.id));
  const pathLinks = [];
  pathNodes.forEach(t => {
    (t.prerequisites || []).forEach(p => { if (pathNodeIds.has(p)) pathLinks.push({ source: p, target: t.id }); });
  });
  return { nodes: pathNodes, links: pathLinks };
}




// --- Getters (optional external use) ---
export function getAllTechsCached() { return _techs; }
export function getAllSpeciesCached() { return _species; }
export function getAllFactionsCached() { return _factions; }  // NEW Phase 2
export function getAllEmpiresCached() { return _empires; }    // Prescripted countries

/**
 * Get empire by ID
 *
 * @param {string} empireId - Empire ID
 * @returns {Empire|null} Empire object or null
 */
export function getEmpireById(empireId) {
  if (!_empires || !Array.isArray(_empires)) return null;
  return _empires.find(e => e.id === empireId) || null;
}

// --- NEW Phase 2: Faction-Aware Functions ---

/**
 * Filter technologies by faction availability
 *
 * @param {Array<Tech>} techs - Array of technologies
 * @param {string} factionId - Faction ID (e.g., 'federation', 'klingon', 'all')
 * @returns {Array<Tech>} Filtered technologies available to the faction
 */
export function filterTechsByFaction(techs, factionId) {
  if (factionId === 'all' || !factionId) return techs;

  return techs.filter(tech => {
    const availability = tech.faction_availability;

    // NEW: If faction_availability is empty, fallback to required_species
    if (!availability || Object.keys(availability).length === 0) {
      // Fallback: Use required_species field
      const requiredSpecies = tech.required_species || [];

      // If no species restrictions, available to all factions
      if (requiredSpecies.length === 0) {
        return true;
      }

      // Map common species names to faction IDs
      const speciesMap = {
        'Federation': 'federation',
        'Klingon': 'klingon',
        'Romulan': 'romulan',
        'Cardassian': 'cardassian',
        'Dominion': 'dominion',
        'Borg': 'borg',
        'Undine': 'undine',
        'Breen': 'breen',
        'Ferengi': 'ferengi',
        "Son'a": 'sona',
        'Hirogen': 'hirogen',
        'Voth': 'voth',
        'Krenim': 'krenim',
        'Vidiian': 'vidiian',
        'Suliban': 'suliban',
      };

      // Check if current faction is in required species
      return requiredSpecies.some(species => {
        const mappedFaction = speciesMap[species];
        return mappedFaction && mappedFaction.toLowerCase() === factionId.toLowerCase();
      });
    }

    // Use faction_availability data if present
    const factionKey = Object.keys(availability).find(
      key => key.toLowerCase() === factionId.toLowerCase()
    );

    if (!factionKey) return false;

    return availability[factionKey]?.available === true;
  });
}

/**
 * Get technology name (faction-specific if available)
 *
 * @param {Tech} tech - Technology object
 * @param {string} factionId - Faction ID
 * @returns {string} Tech name (faction-specific or default)
 */
// --- I18n helpers (used by tech-tree localisation) ---
// tech.html loads js/i18n.js since the localisation work; before that the
// tree only resolved pre-baked English strings stored in the tech JSONs.
// _locOr returns the localised string for `key` if I18n.t is available
// AND the lookup actually matched (I18n.t returns the key itself on miss).
function _i18n() {
  return (typeof window !== 'undefined') ? window.I18n : null;
}
function _locOr(key, fallback) {
  const i = _i18n();
  if (!i || typeof i.t !== 'function') return fallback;
  const r = i.t(key);
  return (r && r !== key) ? r : fallback;
}

export function getTechName(tech, factionId) {
  if (!tech) return '';

  // If no faction or 'all', use default name with i18n preference
  if (factionId === 'all' || !factionId) {
    return _locOr(tech.id, tech.name || tech.id || '');
  }

  // Faction-specific alternate names (no separate loc key for them)
  if (tech.alternate_names && typeof tech.alternate_names === 'object') {
    const altName = Object.keys(tech.alternate_names).find(
      key => key.toLowerCase() === factionId.toLowerCase()
    );
    if (altName) {
      return tech.alternate_names[altName] || _locOr(tech.id, tech.name || tech.id || '');
    }
  }

  return _locOr(tech.id, tech.name || tech.id || '');
}

/**
 * Tech description, prefer localised <id>_desc loc key over the pre-baked
 * English string in the tech JSON.
 */
export function getTechDescription(tech) {
  if (!tech) return '';
  const i = _i18n();
  if (i && typeof i.tMultiline === 'function') {
    const r = i.tMultiline(tech.id + '_desc');
    if (r) return r;
  }
  return tech.description || '';
}

/**
 * Localise a tech category slug (e.g. 'field_manipulation' → 'Feldmanipulation').
 * Stellaris stores these as raw lowercase keys in the loc files.
 */
export function getCategoryLabel(catSlug) {
  if (!catSlug) return '';
  return _locOr(catSlug, catSlug);
}

/**
 * Localise a tech area (physics/society/engineering). Stellaris does not
 * keep these as loc keys — fall back to UI strings, then capitalised raw.
 */
export function getAreaLabel(area) {
  if (!area) return '';
  const i = _i18n();
  // ui.filter.<area> already exists for the area-chip filter
  const k = 'ui.filter.' + area;
  if (i && typeof i.ui === 'function') {
    const r = i.ui(k);
    if (r && r !== k) return r;
  }
  return area.charAt(0).toUpperCase() + area.slice(1);
}

/**
 * Build a localised effect display string from raw key+value.
 * Mirrors update/techtree/create_tech_json_new.py:format_modifier_display
 * but pulls the modifier name from MOD_<KEY> loc data instead of the
 * humanise_modifier_key() heuristic. Falls back to effect.display
 * (the pre-baked English string) when the loc lookup misses.
 */
export function formatEffectDisplay(effect) {
  if (!effect) return '';
  const key = effect.key;
  if (!key) return effect.display || '';
  const val = parseFloat(effect.value);
  if (isNaN(val)) return effect.display || '';

  let formatted;
  if (key.endsWith('_mult')) {
    formatted = `${val >= 0 ? '+' : ''}${(val * 100).toFixed(0)}%`;
  } else if (key.endsWith('_add')) {
    formatted = `${val >= 0 ? '+' : ''}${val.toFixed(0)}`;
  } else {
    formatted = `${val >= 0 ? '+' : ''}${val.toFixed(2)}`;
  }

  // Stellaris convention: modifier loc key is MOD_<UPPERCASE_KEY>
  const locKey = 'MOD_' + key.toUpperCase();
  const name = _locOr(locKey, null);
  if (name) return `${formatted} ${name}`;
  return effect.display || `${formatted} ${key}`;
}

/**
 * Get faction by ID
 *
 * @param {string} factionId - Faction ID
 * @returns {Faction|null} Faction object or null
 */
export function getFactionById(factionId) {
  if (!_factions || !Array.isArray(_factions)) return null;
  return _factions.find(f => f.id === factionId) || null;
}

/**
 * Check if a faction has unique ships (faction_ships entries)
 * Factions without unique ships should only see generic ship names.
 *
 * @param {string} factionId - Faction ID
 * @returns {boolean} True if faction has unique ships
 */
export function factionHasUniqueShips(factionId) {
  if (!factionId || factionId === 'all') return true; // "All" shows everything
  const faction = getFactionById(factionId);
  return faction?.has_unique_ships ?? false;
}

/**
 * Check if a technology is faction-exclusive
 *
 * @param {Tech} tech - Technology object
 * @param {string} factionId - Faction ID
 * @returns {boolean} True if tech is exclusive to this faction
 */
export function isFactionExclusive(tech, factionId) {
  if (factionId === 'all' || !factionId) return false;

  const availability = tech.faction_availability;

  // NEW: Fallback to required_species if faction_availability is empty
  if (!availability || Object.keys(availability).length === 0) {
    const requiredSpecies = tech.required_species || [];

    // Not exclusive if no species requirements (available to all)
    if (requiredSpecies.length === 0) return false;

    // Not exclusive if multiple species can access
    if (requiredSpecies.length > 1) return false;

    // Exclusive if exactly one species matches current faction
    const speciesMap = {
      'Federation': 'federation',
      'Klingon': 'klingon',
      'Romulan': 'romulan',
      'Cardassian': 'cardassian',
      'Dominion': 'dominion',
      'Borg': 'borg',
      'Undine': 'undine',
      'Breen': 'breen',
      'Ferengi': 'ferengi',
      "Son'a": 'sona',
      'Hirogen': 'hirogen',
      'Voth': 'voth',
      'Krenim': 'krenim',
      'Vidiian': 'vidiian',
      'Suliban': 'suliban',
    };

    const mappedFaction = speciesMap[requiredSpecies[0]];
    return mappedFaction && mappedFaction.toLowerCase() === factionId.toLowerCase();
  }

  // Use faction_availability data if present
  const availableTo = Object.keys(availability).filter(
    key => availability[key]?.available === true
  );

  // Exclusive if only ONE faction can access it, and that's the current faction
  return availableTo.length === 1 &&
         availableTo[0].toLowerCase() === factionId.toLowerCase();
}
