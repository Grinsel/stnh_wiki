# Architektur

## Systemuebersicht

```
git01 (STNH Mod)          Python Pipeline           git10 (Wiki)            GitHub Pages
READ-ONLY                  update/*.py               assets/*.json           Live Website
                                                     js/, *.html
events/*.txt          -->  parse_events.py      -->  events_index.json  -->  events.html
localisation/{lang}/  -->  parse_localisation.py -->  localisation/*.json     (alle Seiten)
interface/*.gfx       -->  parse_gfx_mappings.py -->  pictures_map.json
common/ship_sizes/    -->  parse_ships.py        -->  ships.json         -->  ships.html
common/buildings/     -->  parse_buildings.py     -->  buildings.json     -->  buildings.html
   ... (26 Parser)         ... (15 Generatoren)      ... (33 JSONs)         ... (11 Seiten)
```

## Datenfluss

```
1. Mod-Dateien (PDX-Syntax, .txt/.yml/.gfx)
   |
   v
2. Python-Parser (parse_pdx.py als gemeinsame Basis)
   |  - Rekursiver Descent Parser (kein PLY - Error Recovery Probleme)
   |  - Tokenizer: COMMENT, STRING, OPERATOR, LBRACE, RBRACE, VARIABLE, NUMBER, WORD
   |  - Parser: key=value, key={block}, {list}
   |
   v
3. Python-Generatoren (generate_*_json.py)
   |  - Aggregieren Parser-Output
   |  - Faction-Erkennung (Pattern-Matching auf Namespaces)
   |  - Lokalisierungs-Keys aufloesen
   |  - Cross-References berechnen
   |
   v
4. JSON-Assets (assets/*.json, 33 Dateien + 272 Event-Details)
   |
   v
5. Browser (Vanilla JS, kein Framework)
   |  - DataManager laedt JSON asynchron + Cache
   |  - AppState synchronisiert URL-Parameter + localStorage
   |  - I18n laedt Sprachdateien on-demand
   |  - Page-Controller rendert modulspezifische UI
   |
   v
6. GitHub Pages (automatisch bei push auf master)
```

## Frontend-Architektur

### Seitentypen

**Hub (index.html)**
- Sonderfall: Eigener GlobalSearch mit Full-Results-Modus
- Stats-Dashboard, Section-Cards mit Item-Counts
- Kein Filter-Bar, kein Detail-Panel

**8 Standard Content Pages (ships, buildings, traits, governments, megastructures, anomalies, empires, economy)**
- Alle folgen demselben Pattern (siehe FRONTEND.md "Content-Page-Skeleton")
- Header + Nav + GlobalSearch-Overlay + Filter-Bar (Tabs + Filter) + Content (Liste + Detail)
- IIFE Page-Controller mit async init

**Events Page (events.html)**
- Komplexeste Seite, eigene Module: chain-index, filters, render, search
- 3-Panel Layout: Namespace-Sidebar + Event-Liste + Detail-Panel
- Chain-Viewer Modal fuer Event-Ketten

**Tech Page (tech.html)**
- Komplett eigenes System (aus git09 importiert)
- Eigenes Inline-CSS (~780 Zeilen), D3.js (CDN), ES Modules
- Sidebar-Filter + SVG-Visualisierung + Tooltip + Path-Analyse
- Minimaler I18n-Shim statt vollem i18n.js

### JS-Modul-Architektur

```
Shared (alle Seiten):
  common.js          Theme, Font, Lang, Nav, Hamburger, GlobalSearch-Init
  data.js            DataManager (JSON-Loader + Cache)
  state.js           AppState (URL + localStorage)
  i18n.js            Internationalisierung (7 Sprachen)
  ui-strings.js      310+ UI-String-Definitionen
  global-search.js   Cross-Module Prefix-Suche (~19.740 Items)

Content-Pages (8 Seiten):
  shared-render.js   Gemeinsame Rendering-Funktionen
  humanize.js        PDX-Syntax -> lesbarer Text
  pages/*.js         10 Page-Controller (IIFE Pattern)

Events-Only:
  chain-index.js     BFS Connected Components
  filters.js         AND-Filter-Pipeline
  render.js          Event Cards + Detail HTML
  search.js          Event-spezifische Suche (id:, ns:, faction:)
  ui/event-list.js   Paginierte Liste (100/Seite)
  ui/event-detail.js Detail-Panel
  ui/namespace-nav.js Sidebar mit Faction-Gruppen + Chains
  ui/chain-viewer.js Chain-Visualisierung (Modal)

Tech-Only (ES Modules):
  tech/main.js       Einstiegspunkt
  tech/data.js       Daten-Loader (assets/tech/*.json)
  tech/render.js     D3.js SVG-Rendering + LOD
  tech/filters.js    Area/Category/Faction/Tier Filter
  tech/search.js     Autocomplete-Suche
  tech/state.js      localStorage + URL-State
  tech/factions.js   Faction-Daten + Icons
  tech/ui/           Events, Zoom, Tabs, Tiers, Popup, Selection, History
  tech/ui/layouts/   5 Layout-Engines (force, grid, tier, arrows, disjoint)
```

### GlobalSearch-Architektur

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

## Design-Prinzipien

1. **Kein Build-System** — Vanilla HTML/CSS/JS, direkt im Browser lauffaehig
2. **Ein Parser pro Datentyp** — Alle nutzen parse_pdx.py als Basis
3. **JSON als Zwischenformat** — Python generiert, JS rendert
4. **Progressive Enhancement** — Jedes Modul funktioniert standalone
5. **7-Sprachen-Support** — Von Anfang an eingebaut (UI + Mod-Content)
6. **Cross-References optional** — Module verlinken sich, sind aber unabhaengig
7. **IIFE Pattern** — Revealing Module Pattern fuer alle JS-Module (ausser tech/)
