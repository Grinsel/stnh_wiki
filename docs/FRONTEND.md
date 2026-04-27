# Frontend-Dokumentation

Vanilla HTML/CSS/JS, kein Build-System, kein Framework. Jede HTML-Seite laedt Shared-Module + seitenspezifische Scripts direkt per `<script>`.

## Seiten-Uebersicht

| Seite | Datei | Such-Input-ID | Tabs | Eigene Scripts |
|---|---|---|---|---|
| Hub | index.html | global-search-input | - | hub.js |
| Events | events.html | search-input | - | events.js + 7 Event-Module |
| Tech Tree | tech.html | search-input (Header) + tech-filter-input (Sidebar) | - | tech/main.js (ES Module, D3.js) |
| Tech List | tech-list.html | search-input | - | tech-list.js |
| Ships | ships.html | search-input | Ships, Components | ships.js |
| Governments | governments.html | search-input | Govs, Civics, Auth, Policies, Edicts, Councilors, Traditions, Perks | governments.js |
| Exploration | exploration.html | search-input | Anomalies, Archaeology | exploration.js |
| Empires | empires.html | search-input | Empires, Leader Traits (species hidden) | empires.js |
| Economy | economy.html | search-input | Buildings, Districts, Jobs, Deposits, Resources, Megastructures, Relics | economy-hub.js |

**Galaxy Map:** Kein eigenes HTML — eingebettet in empires.html als Canvas-Modul via `galaxy-map.js`. Zeigt Empire-Startpositionen auf einer stilisierten Galaxiekarte. Daten aus `assets/galaxy_map.json`.

## Shared Module (alle Seiten)

### `js/common.js` — Gemeinsame Initialisierung

```javascript
const Common = (() => {
    initTheme()          // Faction-Theme laden (9 Themes)
    injectThemePicker()  // Theme-Dots in Header injizieren
    initLangSelect()     // Sprach-Dropdown -> I18n.setLanguage()
    initNavHighlight()   // Aktive Nav-Page markieren
    initHamburger()      // Mobile Hamburger-Menue injizieren (< 768px)
    initStickyNav()      // Header-Hoehe als CSS-Variable
    applyUiStrings()     // data-i18n Attribute ausfuellen
    initGlobalSearch()   // GlobalSearch-Overlay (alle Seiten ausser Hub)
})();
```

### `js/global-search.js` — Cross-Module Suche

```javascript
const GlobalSearch = (() => {
    init()                        // Laedt search_index.json + module_pages.json
    searchPreview(query, perType) // Live-Dropdown: max N pro Typ (schnell)
    searchFull(query)             // Alle Treffer (Enter auf Hub)
    getItemUrl(result)            // URL mit ?search= und ?tab= Parameter
    getStats()                    // Item-Counts pro Typ
    getTotalCount()               // Gesamt-Anzahl (~21.630)
    getExpandedInfo(query)        // Faction-Synonym-Info fuer UI-Hint

    // Prefix-basiert: ship:, event:, building:, trait:, civic:, mega:, ...
    // Faction-Synonyme: fed -> federation, ufp, starfleet, ...
})();
```

### `js/data.js` — DataManager

```javascript
const DataManager = (() => {
    loadJSON(url)              // Generischer JSON-Loader mit Cache
    loadInitial()              // Events: events_index + namespaces + pictures_map
    loadNamespaceDetail(ns)    // Lazy-Load Detail-JSON
    loadLocalisation(lang)     // Lazy-Load Sprachdatei
    loadRelationships()        // Trigger-Graph
    loadOnActions()            // On-Action-Mappings
    loadEventChains()          // Event-Chains
    getIndex(), getNamespaces(), getPictureUrl(gfxName)
})();
```

### `js/state.js` — AppState

```javascript
const AppState = (() => {
    // URL-synchronisierter State mit localStorage-Persistenz
    init()                     // URL-Parameter lesen
    get(key), set(key, value)  // Lesen/Schreiben + URL
    setMultiple(updates)       // Mehrere Werte
    onChange(callback)          // Listener
})();
```

### `js/i18n.js` — Internationalisierung

```javascript
const I18n = (() => {
    setLanguage(lang)         // Sprachdatei laden
    setLangSync(lang)         // Sprache setzen ohne Datei laden
    mergeModule(lang, module) // Modul-Loc-Datei nachladen + mergen
    t(key)                    // Mod-Content uebersetzen (Fallback: Key selbst)
    tMultiline(key)           // Multiline-Key (\n-getrennt)
    ui(key)                   // UI-String aus UI_STRINGS
})();
// I18n wird zusaetzlich auf `window` gesetzt, damit ES-Module unter
// js/tech/* darauf zugreifen koennen. tech.html nutzt jetzt das volle
// i18n.js (kein Mock mehr) und laedt das `tech` Loc-Modul beim Init.
```

### Lang-Switch-Reaktivitaet

`common.js` ruft `loadFullLocalisation()` `await`-ed auf, **bevor** das
`wiki-lang-changed` Event dispatched wird — sonst Race Condition bei
cross-Modul Loc-Lookups (z.B. Civic-Namen auf empires.html).

Jede Page mit Detail-Pane trackt `currentDetailItem` und ruft im
`wiki-lang-changed` Handler `showDetail(currentDetailItem)` auf, damit
der offene Detail-View ohne Reload uebersetzt wird. Implementiert in:
`economy-hub.js`, `empires.js`, `events.js`, `exploration.js`,
`governments.js`, `ships.js`, `tech-list.js`, `tech_showcase.js`.

`economy-hub.js` re-merget zusaetzlich die Loc-Module `economy`,
`megastructures`, `governments` im Handler, weil `common.js` nur das
Primary-Modul re-loaded. `tech_showcase.js` triggert
`updateVisualization` zur Re-Render der Detail-Pane.

### `js/ui-strings.js` — UI-String-Definitionen

330+ Keys fuer Navigation, Tabs, Filter, Labels, Suchfelder, Detail-Titel, Badges, Fehlermeldungen etc. Jeder Key hat mindestens `english` und `german`, manche alle 7 Sprachen.

Neu (2026-04):
- `ui.misc.no` (war komplett missing)
- `ui.detail.modifier`, `ui.detail.conditions`, `ui.detail.on_spawn`, `ui.card.stage`
- `ui.tab.resources` (neu), `ui.tab.deposits` (umbenannt — vorher "Resources")
- `ui.filter.show_unused`
- `ui.type.resource`, `ui.type.councilor`
- `ui.tech.{area, tier, category, rare, dangerous, reverse_engineerable, view_in_tree}`
- `ui.resource.{producers, consumers, modifiers, tradable, market_price, market_supply, max_stockpile, ai_weight, axis_output, axis_upkeep, axis_cost}`
- `ui.trait.{class, rarity, tier, cost}`

### `js/humanize.js` — PDX-Syntax -> natuerliche Sprache

Konvertiert geparste PDX-JSON-Strukturen (Trigger, Effekte, Modifier, Conditions) in
menschenlesbare HTML-Ausgabe. Zielgruppe sind Spieler **ohne** Modding- oder PDX-Script-Kenntnisse.
Details siehe `docs/HUMANIZE.md`.

### `js/shared-render.js` — Gemeinsames Rendering

Rendering-Funktionen die von allen 8 Content-Seiten geteilt werden:
- Item-Cards, Detail-Panels, Pagination, Tab-Umschaltung
- `dualView(data, label)`: Code/Human-Toggle, reicht `label` an `Humanize.humanizeBlock(data, label)` weiter
- `initToggles(container)`: Click-Handler fuer den Toggle-Button
- `techLink(id)` / `techLinks(arr)` / `initTechLinks(container)`: Klickbare Gold-Badges fuer Tech-Prerequisites. **Bugfix 2026-04:** `initTechLinks` nutzt jetzt `WIKI_LINK_MAP` statt einer hardgecodeten `exploration.html?tab=technology&focus=...` URL — vorher landeten Klicks auf der Anomalie-Seite.
- `wikiLink(itemId, type, displayName)`: Universeller Cross-Link zu jedem Wiki-Item (23 Typen: event, building, civic, tradition, megastructure, authority, government, trait, perk, anomaly, archaeology, technology, ship, component, empire, district, policy, edict, **resource, job, deposit, relic, ascension_perk**)
- `initWikiLinks(container)`: Click-Handler fuer `.wiki-link` Elemente, navigiert anhand `WIKI_LINK_MAP` zur richtigen Seite+Tab
- `WIKI_LINK_MAP`: Typ → {page, param, tab} Mapping fuer URL-Generierung

### `js/ship-viewer.js` — 3D Ship Viewer (nur ships.html)

Three.js-basierter 3D-Modell-Viewer fuer Schiffe mit `has_model: true`. Lazy-loaded per Button-Click.

### `js/ui/category-chips.js` — Chip-Bar Filter (ships.html, economy.html)

Wiederverwendbare UI-Komponente fuer Kategorie-Filter als Chip-Leiste. Wird von ships.js und buildings.js genutzt.

## Content-Page-Skeleton

Alle 8 Standard-Content-Pages (ships, buildings, traits, governments, megastructures, anomalies, empires, economy) folgen demselben Aufbau:

### HTML-Struktur

```html
<!-- Header -->
<header id="masthead">
  <div class="header-inner">
    <a class="header-logo">ST:NH Wiki</a>
    <div class="header-search">
      <input id="search-input" type="text" data-i18n-placeholder="...">
    </div>
    <div class="header-controls">
      <!-- Theme-Picker (per JS injiziert) -->
      <select id="lang-select">...</select>
      <button id="font-size-down">A-</button>
      <button id="font-size-up">A+</button>
    </div>
  </div>
</header>

<!-- Navigation -->
<nav id="wiki-nav">
  <!-- Hamburger-Button (per JS injiziert) -->
  <div class="nav-inner">
    <a class="nav-link" href="index.html">Home</a>
    <a class="nav-link" href="events.html">Events</a>
    <!-- ... 9 weitere Links ... -->
  </div>
</nav>

<!-- GlobalSearch Overlay -->
<div id="global-search-results" class="global-search-results hidden"></div>

<!-- Filter-Bar -->
<div class="filter-bar">
  <div class="tabs">...</div>
  <div class="filters">...</div>
</div>

<!-- Content -->
<div class="content-wrapper">
  <div class="item-list">...</div>
  <div class="detail-panel">...</div>
</div>

<!-- Footer -->
<footer>...</footer>

<!-- Scripts -->
<script src="js/ui-strings.js"></script>
<script src="js/data.js"></script>
<script src="js/state.js"></script>
<script src="js/i18n.js"></script>
<script src="js/global-search.js"></script>
<script src="js/common.js"></script>
<script src="js/humanize.js"></script>
<script src="js/shared-render.js"></script>
<script src="js/pages/{modul}.js"></script>
```

### JS Page-Controller Pattern (IIFE)

```javascript
(async function initModuleName() {
    AppState.init();
    Common.init();
    await I18n.setLanguage(AppState.get('lang'));

    // Daten laden
    const data = await DataManager.loadJSON('assets/module.json');

    // Tabs initialisieren
    // Filter initialisieren
    // Suche (lokaler Filter auf #search-input)
    // Rendering (Liste + Detail-Panel)
    // URL-Parameter auswerten (?search=, ?tab=)
})();
```

Dieses Pattern gilt fuer: ships.js, buildings.js, traits.js, governments.js, megastructures.js, anomalies.js, empires.js, economy.js, tech-list.js. Galaxy-map.js folgt einem eigenen Canvas-basierten Pattern.

### Dual-Search-Verhalten

`#search-input` auf Content-Pages bedient **zwei** Suchen parallel:
1. **Lokal:** Der Page-Controller filtert die eigene Item-Liste (200ms debounce)
2. **Global:** `initGlobalSearch()` in common.js zeigt ein Overlay-Dropdown mit Cross-Module-Ergebnissen (150ms debounce, min 2 Zeichen, max 3 pro Typ)

Beide `addEventListener('input', ...)` Listener laufen gleichzeitig.

## Events-Module (nur events.html)

Die Events-Seite hat die komplexeste Architektur mit eigenen Sub-Modulen:

| Modul | Funktion |
|---|---|
| chain-index.js | BFS Connected Components aus Trigger-Graph |
| filters.js | AND-Filter-Pipeline: Type -> Faction -> Category -> Hidden -> Search -> Namespace -> Chain |
| render.js | Event-Cards + Detail-HTML |
| search.js | Event-spezifische Suche (id:, ns:, faction:, Multi-Term AND) |
| ui/event-list.js | Paginierte Liste (100 pro Seite) |
| ui/event-detail.js | Detail-Panel mit Bild, Meta, Beschreibung, Trigger, Optionen, Effekte |
| ui/namespace-nav.js | Sidebar: Faction-Gruppen -> Namespaces -> Chains |
| ui/chain-viewer.js | Modal: Rekursive Chain-Visualisierung |

**Layout:** 3-Panel — Namespace-Sidebar + Event-Liste + Detail-Panel

## Tech-Module (nur tech.html, aus git09 importiert)

Eigenes modulares System (ES Modules), komplett getrennt von den Wiki-Shared-Modulen:

| Modul | Funktion |
|---|---|
| tech/main.js | Einstiegspunkt, Orchestrierung |
| tech/data.js | Daten laden (assets/tech/*.json) |
| tech/render.js | D3.js SVG-Rendering + LOD (Level of Detail) |
| tech/filters.js | Filter: Area, Category, Species, Faction, Tier-Range |
| tech/search.js | Tech-Suche + Autocomplete |
| tech/state.js | localStorage + URL-State |
| tech/factions.js | Faction-Daten + Icon-Mappings |
| tech/ui/events.js | DOM Event-Handler (alle Buttons, Inputs, Keyboard) |
| tech/ui/layouts/ | 5 Layout-Engines: force, grid, tier, arrows, disjoint |
| tech/ui/zoom.js | D3 Zoom + Pan |
| tech/ui/popup.js | Tech-Path-Analyse Popup |
| tech/ui/tabs.js | Sidebar-Tab-Umschaltung |

**Sonderfaelle tech.html:**
- Eigenes Inline-CSS (~780 Zeilen) statt style.css
- D3.js v7 (CDN) fuer SVG-Rendering
- Volles `js/i18n.js` (kein Mock mehr seit 2026-04). Laedt das `tech` Loc-Modul beim Init. `I18n` wird auf `window` exportiert, damit ES-Module unter `js/tech/*` darauf zugreifen koennen.
- Sidebar-Suche: `#tech-filter-input` (umbenannt, damit kein Konflikt mit GlobalSearch auf `#search-input` im Header)
- ES Modules (`type="module"`) statt IIFE
- Tier-Layout als Default-Ansicht (kein separater Tech-Header)
- Prerequisites mit klickbaren Links zu anderen Techs
- Tech-Item-Map: Cross-Reference welche Items (Ships, Buildings, Components) eine Tech freischaltet
- Z-Order-Fix: `#tech-tree > svg { position: relative; z-index: 2 }` — sonst rendert die Canvas-Tech-Lines (CanvasTechRenderer in `js/tech/canvas-renderer.js`) im Tier-Layout ueber den Cards. `js/tech/render.js:updateLOD` ruft zusaetzlich `linksLayer.lower()` + `nodesLayer.raise()` als Sicherheitsnetz.

**Tech-Loc-Helpers (in `js/tech/data.js`):**
- `getTechName`, `getTechDescription`, `getCategoryLabel`, `getAreaLabel`, `formatEffectDisplay`
- Stellaris-Modifier-Loc-Key Konvention: `MOD_<KEY_UPPERCASE>`
- `js/pages/tech-list.js` repliziert die Helpers inline (classic script, kein ES-Module)
- `js/tech/render.js` rendert via Helpers statt pre-baked English Strings.

## GlobalSearch-Architektur

```
search_index.json (~21.630 Items, 2.6 MB)
  |
  v
GlobalSearch.init() -- laedt Index + module_pages.json
  |
  +-- Hub (hub.js):
  |     searchPreview(query, 5) -> Dropdown (max 5 pro Typ)
  |     searchFull(query) -> Full-Results-Page (Enter)
  |     Eigene Event-Listener, common.js skippt Hub
  |
  +-- Content-Pages (common.js -> initGlobalSearch()):
  |     searchPreview(query, 3) -> Overlay-Dropdown (max 3 pro Typ)
  |     150ms debounce, min 2 Zeichen
  |     Laeuft parallel zum lokalen Page-Filter
  |     Escape/Click-outside schliesst Overlay
  |
  +-- Tech-Page:
        Header-Search (#search-input) -> GlobalSearch
        Sidebar-Search (#tech-filter-input) -> Tech-eigene Suche
```

## Economy-Hub (`js/pages/economy-hub.js`)

Sieben Tabs: Buildings, Districts, Jobs, Deposits, **Resources** (neu), Megastructures, Relics.

### Resources-Tab (neu, 2026-04)

- Liest `assets/resources.json` (46 Strategic Resources) + `assets/resource_producers.json` (Producer/Consumer/Modifier-Index, `by_resource` und `by_producer`).
- Kategorien sind von 4 (Basic/Advanced/Strategic/STNH) auf 2 (**Economic/Strategic**) konsolidiert.
- Default-Filter zeigt nur "used" Resources (mind. ein Producer/Consumer/Modifier-Link).
- `RESOURCE_FORCED_VISIBLE` Allowlist: erzwungen sichtbar (sr_living_metal, sr_dark_matter, sr_new_horizons).
- `RESOURCE_FORCED_HIDDEN` Blocklist: vanilla-only ausgeblendet (astral_threads, rare_crystals).
- Toggle "Show unused" (`ui.filter.show_unused`) macht alle sichtbar.
- Detail-Pane zeigt: Producer, Consumer, Modifier, Tradable, Market-Price, Market-Supply, Max-Stockpile, AI-Weight, Axis-Output/Upkeep/Cost.

### Districts-Tab

- Rendert `icons/districts/<id>.webp` in Card-List + Detail-Pane (143 Icons, Filename = District-ID).

### Megastructures-Tab

- `megaIsStnh(item)` filtert Megas, deren `source_file` nicht mit `STH_` beginnt — 40 vanilla-only Megas werden default ausgeblendet, 76 STNH-Megas bleiben sichtbar.
- "Show unused" Toggle zeigt auch Vanilla-Megas.

### Lang-Switch

`economy-hub.js` re-merget die Loc-Module `economy`, `megastructures`, `governments` im `wiki-lang-changed` Handler, weil `common.js` nur das Primary-Modul re-loaded.

## 3D Ship Viewer

Die Ships-Seite enthaelt einen interaktiven 3D-Modell-Viewer fuer Schiffe mit `has_model: true`.

### Architektur

```javascript
// js/ship-viewer.js (IIFE, lazy-loaded)
const ShipViewer = (() => {
    createViewer(container, glbPath)  // WebGL Canvas erstellen + GLB laden
    dispose()                         // Aufraeumen bei Schiffswechsel
})();
```

### Three.js Lazy-Loading

Three.js (~700 KB) wird erst beim Button-Click geladen (nicht beim Seitenaufruf):
- Three.js Core: CDN (UMD Global Build)
- GLTFLoader + OrbitControls: CDN (ES Module, dynamisch importiert)
- Version: 0.172.0 (pinned)

### Viewer-Features

- PerspectiveCamera (45 FOV) + AmbientLight + DirectionalLight
- Auto-Center + Auto-Scale (BoundingBox -> Camera-Position)
- OrbitControls (Drag = Rotate, Scroll = Zoom, Auto-Rotate)
- Transparenter Hintergrund (passt zum Dark Theme)
- Fraktions-Dropdown zum Umschalten zwischen Varianten
- `dispose()` bei Schiffswechsel (kein WebGL-Context-Leak)
- ResizeObserver fuer responsive Canvas-Groesse

### Integration in ships.js

```javascript
// In showDetail():
if (item.has_model) {
    // Fraktions-Dropdown + "View 3D Model" Button rendern
    // Button-Click -> ShipViewer.createViewer(container, 'models/{faction}/{id}.glb')
    // Dropdown-Wechsel -> dispose() + neues GLB laden
}
```

## Design-System (`style.css`)

### Theme-Variablen

```
--bg-primary: #111111
--bg-header: #161618
--bg-card: rgba(0,0,0,0.86)
--text-primary: #e4e7eb
--accent-gold: rgba(209,206,4,0.69)   (dynamisch per Faction-Theme)
--accent-gold-solid: #d1ce04          (dynamisch)
--accent-hover: #b57d04               (dynamisch)
--accent-bright: #fcf800              (dynamisch)
```

### Faction-Themes (9 Stueck)

```javascript
// In common.js -> THEMES:
cardassian  #d1ce04   (Default)
federation  #4a9eff
klingon     #cc2222
romulan     #22aa44
borg        #00cc66
dominion    #9944cc
ferengi     #dd8822
bajoran     #cc8844
lcars       #ff9900
```

### Schriftarten

```
federation-ds9-title.TTF   Ueberschriften
Tungsten-Light.ttf         Badges/Labels
```

### Responsive Breakpoints

```
1200px  Sidebar schmaler
921px   Header wraps, Detail-Panel unter Liste
768px   Hamburger-Menue aktiv, Nav zugeklappt
544px   Filter vertikal, Thumbnails ausgeblendet
```

### Hamburger-Menue

- Per JS injiziert in `#wiki-nav` (initHamburger in common.js)
- Sichtbar ab `max-width: 768px`
- 3 Bars mit CSS-Transition → X-Animation bei `.active`
- Schliesst bei: Link-Click, Click ausserhalb, Escape-Taste
