# STNH Wiki - Developer Handover

Welcome to the Star Trek: New Horizons Wiki project. This file is your entry point.

## Quick Orientation

**What is this?** A modular off-game wiki for the STNH Stellaris mod. Vanilla HTML/CSS/JS, no build tools, no frameworks. Python pipeline generates JSON data, browser renders it.

**Key numbers:** 9 HTML pages, ~21,630 searchable items, 54 JS files, ~88 Python pipeline files (~61 core + 27 techtree).

_Last updated: 2026-04-27_

## Documentation

| File | Purpose |
|---|---|
| `CLAUDE.md` | **This file** — quick-start for new developers |
| `TODO.md` | Master project plan — 12 phases + backlog. Phases 0-10 done, Phase 11 (Techtree) partially done |
| `DOCUMENTATION.md` | Full technical reference (monolithic, references docs/ for details) |
| `docs/ARCHITECTURE.md` | System overview, data flow, frontend architecture, design principles |
| `docs/PIPELINE.md` | Python data pipeline: master script, parsers, generators, config |
| `docs/FRONTEND.md` | JS modules, page controller skeleton, events/tech modules, design system |
| `docs/FILE_STRUCTURE.md` | Complete annotated directory tree (wiki + mod source) |
| `docs/ASSETS.md` | All 38 JSON files, images, icons, cross-references, search index |
| `docs/HUMANIZE.md` | Humanize engine: Architektur, Maps, Modifier, Scopes, Erweiterung |
| `docs/DEVELOPMENT.md` | Local setup, deployment, adding modules, maintenance, conventions |

**Read order:** This file first, then `TODO.md` for open tasks, then `docs/` files as needed.

## Project Structure (minimal)

```
stnh_wiki/
  index.html, events.html, tech.html    9 HTML pages
  ships.html, economy.html, ...
  style.css                              Shared dark theme (45 KB)
  js/                                    54 JS files
    common.js                            Shared init (theme, hamburger, global search)
    global-search.js                     Cross-module search (on all pages)
    data.js, state.js, i18n.js           Core shared modules
    ui-strings.js                        UI translations (310+ keys, 7 languages)
    pages/{hub,events,ships,...}.js       8 page controllers (incl. galaxy-map)
    tech/                                Techtree modules (ES Modules, D3.js)
  assets/                                Generated JSON data (40+ files + 272 event details)
    resources.json                       46 strategic resources (25 vanilla + 21 STNH)
    resource_producers.json              Resource <-> producer/consumer/modifier index
    flags/trek/                          79 WebP empire flags
  update/                                Python data pipeline (~61 core + 27 techtree)
    UPDATE_WIKI.py                       Master orchestrator (incl. phase_resources)
    config.py                            Paths (STNH_MOD_ROOT, WIKI_ROOT)
    parse_pdx.py                         Shared PDX parser (recursive descent, global @-vars)
    parse_*.py                           ~28 module-specific parsers (incl. parse_resources)
    modifier_name_parser.py              Heuristic: planet_miners_minerals_produces_mult -> (resource, producer, axis, op)
    generate_resource_index.py           Builds resource_producers.json (by_resource + by_producer)
    convert_*.py                         3 converters (images, ship models, building icons)
    generate_*.py                        ~14 JSON generators (incl. resources, resource_index)
    techtree/                            27 scripts (copied from git09, not yet functional)
  pictures/                              986 WebP event images
  icons/tech/                            1,659 tech icons
  icons/buildings/                       754 building icons
  icons/districts/                       143 district icons (filename = district id)
  icons/resources/                       120 resource icons
```

## Architecture

```
git01 (STNH Mod, READ-ONLY)  -->  Python Pipeline  -->  JSON assets  -->  Browser renders
```

- **Data source:** `C:\Users\marcj\git01\New-Horizons-Development` (Stellaris mod files, PDX syntax)
- **Pipeline:** `update/UPDATE_WIKI.py` parses mod files, generates JSON into `assets/`
- **Frontend:** Each HTML page loads shared JS + page-specific JS, fetches JSON, renders

## How to Run

### Update data (after mod changes)
```bash
cd update
python UPDATE_WIKI.py --skip-images     # Full update without image conversion (~12s)
python UPDATE_WIKI.py --only events     # Only events module
python UPDATE_WIKI.py --only search     # Only rebuild search index
```

### View locally
Open any HTML file directly in a browser. Needs a local HTTP server for JSON fetches:
```bash
python -m http.server 8000
# Then open http://localhost:8000
```

### Deploy
```bash
# UPDATE.bat does: python UPDATE_WIKI.py + git add + git commit + git push
# GitHub Pages deploys automatically on push to master
```

## Key Design Decisions

1. **No build system.** Vanilla HTML/CSS/JS. Files are served as-is.
2. **One parser per mod data type.** All parsers share `parse_pdx.py` as base.
3. **JSON as intermediate format.** Python generates, JS renders.
4. **Progressive Enhancement.** Each module works standalone.
5. **7-language support** built in from the start (UI strings + mod content).
6. **IIFE pattern** for all JS modules (Revealing Module Pattern). No imports/exports except tech/.

## Content Pages Pattern

All 6 standard content pages (ships, governments, exploration, empires, economy, tech-list) follow the same pattern:
- **HTML:** Header + Nav + GlobalSearch container + Filter bar (tabs + filters) + Content (list + detail panel) + Footer
- **JS:** IIFE async init → load JSON → init tabs/filters → render list → handle URL params (?search=, ?tab=)
- **Search:** `#search-input` handles both local filtering (page-specific) AND GlobalSearch overlay (cross-module) simultaneously

## Special Pages

- **index.html (Hub):** Landing page with section cards + stats. GlobalSearch with full-results mode (Enter → replaces page content). Handled by `hub.js`, NOT by `initGlobalSearch()` in common.js.
- **events.html:** Most complex page. Has its own namespace sidebar, chain viewer modal, event detail panel. Uses chain-index.js for connected components.
- **tech.html:** Imported from git09. Has its own inline CSS (~780 lines), D3.js (CDN), ES Modules. Sidebar search is `#tech-filter-input` (renamed to avoid conflict with GlobalSearch in header). Now uses the full `js/i18n.js` (no longer a mock) and loads the `tech` loc-module on init; `js/i18n.js` exposes `I18n` on `window` so ES-module code under `js/tech/*` can read it. Tier-Layout is the default view (no separate tech-header). CSS sets `#tech-tree > svg { position: relative; z-index: 2 }` so D3 SVG renders above the tier-layout Canvas (CanvasTechRenderer in `js/tech/canvas-renderer.js`); `render.js:updateLOD` additionally calls `linksLayer.lower()` + `nodesLayer.raise()` as a safety net.

## GlobalSearch Architecture

- `global-search.js` loads `search_index.json` (~19,740 items, all modules)
- On **Hub**: `hub.js` handles everything (preview dropdown + full results on Enter)
- On **Content pages**: `initGlobalSearch()` in `common.js` adds an overlay dropdown to `#search-input` (150ms debounce, min 2 chars, 3 results per type)
- Both local page filtering and GlobalSearch run in parallel on the same input
- Prefix search: `ship:`, `event:`, `building:`, `trait:`, etc.
- Faction synonyms: `fed` expands to federation/ufp/starfleet/...

## Recent Changes (2026-04)

### Resources module (new)
- 46 Strategic Resources (25 vanilla + 21 STNH) parsed from `common/strategic_resources/` with vanilla-then-mod-override semantics.
- New pipeline files: `parse_resources.py`, `modifier_name_parser.py` (heuristic for `planet_miners_minerals_produces_mult` → resource/producer/axis/op), `generate_resource_index.py`, `generate_resources_json.py`. New `phase_resources()` in `UPDATE_WIKI.py` runs **after** all producer phases.
- Outputs: `assets/resources.json`, `assets/resource_producers.json` (1898 producer-links + 502 modifier-links, indexed `by_resource` + `by_producer`), `icons/resources/` (120 WebP).
- Frontend: `economy.html` has a `data-tab="resources"` tab; existing planet-deposit tab renamed to **Deposits**. Default view shows only "used" resources (allowlist `RESOURCE_FORCED_VISIBLE` for sr_living_metal/sr_dark_matter/sr_new_horizons; blocklist `RESOURCE_FORCED_HIDDEN` for vanilla-only astral_threads/rare_crystals). "Show unused" toggle reveals all. Categories consolidated from 4 (Basic/Advanced/Strategic/STNH) to 2 (Economic/Strategic).

### Pipeline: global @variable resolution
- `parse_pdx.py` now loads all `*.txt` from `common/scripted_variables/` (vanilla + mod, mod overrides) via `load_global_scripted_variables()` with lazy init (`_ensure_globals_loaded()`). 2652 globals loaded.
- File-local `@vars` still take precedence over globals (Stellaris semantics). Building/job fields like `energy = @b1_upkeep` now show the resolved value instead of the literal `@b1_upkeep`.

### Tech-tree i18n + lang reactivity
- All 7 content pages now have a `wiki-lang-changed` handler that re-renders the open detail pane. Pattern: track `currentDetailItem`, call `showDetail(currentDetailItem)` on event. Implemented in `economy-hub.js`, `empires.js`, `events.js`, `exploration.js`, `governments.js`, `ships.js`, `tech-list.js`, `tech_showcase.js`.
- `common.js`: `loadFullLocalisation()` is now `await`-ed before dispatching `wiki-lang-changed` (race-condition fix for cross-module loc lookups, e.g. civic names on empires.html).
- `economy-hub.js` re-merges `economy`, `megastructures`, `governments` loc-modules in the handler since `common.js` only re-loads the primary module.
- New helpers in `js/tech/data.js`: `getTechName`, `getTechDescription`, `getCategoryLabel`, `getAreaLabel`, `formatEffectDisplay`. Stellaris modifier loc-key convention: `MOD_<KEY_UPPERCASE>`. `js/pages/tech-list.js` replicates these inline (classic script, no ES-module).
- New `wiki-lang-changed` handler in `tech_showcase.js` triggers `updateVisualization` to re-render the detail pane.

### Cross-link bug fixes
- `js/shared-render.js:initTechLinks` had hardcoded `'exploration.html?tab=technology&focus=...'` — clicks on tech prereq badges landed on the anomaly page. Fixed to use `WIKI_LINK_MAP` like `initWikiLinks`.
- `WIKI_LINK_MAP` extended with `resource`, `job`, `deposit`, `relic`, `ascension_perk`.

### Other
- `parse_traits.py`: dict-by-id pattern (vanilla → mod overrides) instead of flat append. 470 → 461 unique (9 dups removed).
- `convert_icons.py`: new `districts` category (143 icons; 55/56 coverage, filename = district id). `economy-hub.js` renders `icons/districts/<id>.webp` in card list + detail pane.
- `economy-hub.js:megaIsStnh()` hides 40 vanilla-only megastructures (those without `STH_` prefix on `source_file`); 76 STNH megas visible by default. "Show unused" toggle reveals all.
- `split_localisation.py`: `economy` loc-module now also takes `resources.json` + deficit-keys (`<sr_id>_deficit`).
- `js/ui-strings.js`: many missing keys added — see `ui.misc.no`, `ui.detail.modifier|conditions|on_spawn`, `ui.card.stage`, `ui.tab.resources` (new), `ui.tab.deposits` (renamed from "Resources"), `ui.filter.show_unused`, `ui.type.resource`, `ui.type.councilor`, `ui.tech.{area,tier,category,rare,dangerous,reverse_engineerable,view_in_tree}`, `ui.resource.{producers,consumers,modifiers,tradable,market_price,market_supply,max_stockpile,ai_weight,axis_output,axis_upkeep,axis_cost}`, `ui.trait.{class,rarity,tier,cost}`.

## Open Work (see TODO.md)

### Phase 11 — Techtree Integration (partially done)
- 11.1 DONE: Files copied from git09, paths adapted
- 11.2 TODO: Techtree pipeline not yet functional (balance_center_bridge.py needs adaptation)
- 11.3 TODO: Web page needs further Wiki-layout integration
- 11.4 TODO: Tech ↔ other module cross-links
- 11.5 TODO: Replace git09 with wiki version
- 11.6 TODO: Tech tree localisation (currently English only)

### Backlog ideas (from TODO.md)
- Name Lists Browser, Starbase Module Catalog, Translation Dashboard, etc.
- Galaxy Map: Embedded in empires.html, shows empire starting positions (galaxy_map.json + galaxy-map.js)

## Conventions

- **German** for plan descriptions and documentation prose
- **English** for code, comments, variable names, commit messages
- **No Umlauts in code** — use `ae`, `oe`, `ue` in identifiers
- **Titles:** `Section - ST:NH Wiki` format (e.g., `Ships - ST:NH Wiki`)
- **OG tags** on all pages for social media preview
- **Git directories:** git01 = STNH Mod, git09 = Techtree (live, don't modify), git10 = Wiki

## Common Tasks

| Task | Where to look |
|---|---|
| Add a new content module | `docs/DEVELOPMENT.md` (pipeline + frontend checklists) |
| Fix parser error | `update/parse_pdx.py` (base) or module-specific parser |
| Add UI translation | `js/ui-strings.js` (add key with min. english + german) |
| Add search prefix | `js/global-search.js` → `TYPE_PREFIXES` |
| Add wiki-link target type | `js/shared-render.js` → `WIKI_LINK_MAP` |
| Add PDX keyword to humanizer | `js/humanize.js` → `TRIGGER_MAP` or `EFFECT_MAP` (see `docs/HUMANIZE.md`) |
| Add modifier display name | `js/humanize.js` → `MODIFIER_MAP` |
| Add producer-link for new resource modifier | `update/modifier_name_parser.py` (heuristic) |
| Force resource visible/hidden | `js/pages/economy-hub.js` → `RESOURCE_FORCED_VISIBLE` / `RESOURCE_FORCED_HIDDEN` |
| Change theme colors | `js/common.js` → `THEMES` object |
| Fix mobile layout | `style.css` → `@media` rules + hamburger section |
| Update data | `cd update && python UPDATE_WIKI.py --skip-images` |
| Understand the architecture | `docs/ARCHITECTURE.md` |
| Pipeline details | `docs/PIPELINE.md` |
| Frontend patterns | `docs/FRONTEND.md` (incl. Content-Page-Skeleton) |
