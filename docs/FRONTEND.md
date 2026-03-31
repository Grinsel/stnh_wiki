# Frontend-Dokumentation

Vanilla HTML/CSS/JS, kein Build-System, kein Framework. Jede HTML-Seite laedt Shared-Module + seitenspezifische Scripts direkt per `<script>`.

## Seiten-Uebersicht

| Seite | Datei | Such-Input-ID | Tabs | Eigene Scripts |
|---|---|---|---|---|
| Hub | index.html | global-search-input | - | hub.js |
| Events | events.html | search-input | - | events.js + 7 Event-Module |
| Tech Tree | tech.html | search-input (Header) + tech-filter-input (Sidebar) | - | tech/main.js (ES Module, D3.js) |
| Ships | ships.html | search-input | Ships, Components | ships.js |
| Buildings | buildings.html | search-input | Buildings, Districts | buildings.js |
| Traits | traits.html | search-input | Traits, Traditions, Perks | traits.js |
| Governments | governments.html | search-input | Govs, Civics, Auth, Policies, Edicts | governments.js |
| Megastructures | megastructures.html | search-input | Megastructures, Relics | megastructures.js |
| Anomalies | anomalies.html | search-input | Anomalies, Archaeology | anomalies.js |
| Empires | empires.html | search-input | Empires, Species | empires.js |
| Economy | economy.html | search-input | Jobs, Deposits | economy.js |

## Shared Module (alle Seiten)

### `js/common.js` — Gemeinsame Initialisierung

```javascript
const Common = (() => {
    initTheme()          // Faction-Theme laden (9 Themes)
    injectThemePicker()  // Theme-Dots in Header injizieren
    initFontSize()       // Font-Size-Buttons (90%-160%)
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
    getTotalCount()               // Gesamt-Anzahl (~19.740)
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
    setLanguage(lang)   // Sprachdatei laden
    t(key)              // Mod-Content uebersetzen (Fallback: Key selbst)
    ui(key)             // UI-String aus UI_STRINGS
})();
```

### `js/ui-strings.js` — UI-String-Definitionen

310+ Keys fuer Navigation, Tabs, Filter, Labels, Suchfelder, Detail-Titel, Badges, Fehlermeldungen etc. Jeder Key hat mindestens `english` und `german`, manche alle 7 Sprachen.

### `js/humanize.js` — PDX-Syntax -> natuerliche Sprache

Konvertiert geparste PDX-JSON-Strukturen (Trigger, Effekte, Modifier, Conditions) in
menschenlesbare HTML-Ausgabe. Zielgruppe sind Spieler **ohne** Modding- oder PDX-Script-Kenntnisse.
Details siehe `docs/HUMANIZE.md`.

### `js/shared-render.js` — Gemeinsames Rendering

Rendering-Funktionen die von allen 8 Content-Seiten geteilt werden:
- Item-Cards, Detail-Panels, Pagination, Tab-Umschaltung
- `dualView(data, label)`: Code/Human-Toggle, reicht `label` an `Humanize.humanizeBlock(data, label)` weiter
- `initToggles(container)`: Click-Handler fuer den Toggle-Button

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

Dieses Pattern gilt fuer: ships.js, buildings.js, traits.js, governments.js, megastructures.js, anomalies.js, empires.js, economy.js.

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
- Minimaler I18n-Shim statt vollem i18n.js (nur `ui()` + `setLanguage()` als No-Op)
- Sidebar-Suche: `#tech-filter-input` (umbenannt, damit kein Konflikt mit GlobalSearch auf `#search-input` im Header)
- ES Modules (`type="module"`) statt IIFE

## GlobalSearch-Architektur

```
search_index.json (~19.740 Items, 2.6 MB)
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
