# STNH Wiki - Developer Handover

Welcome to the Star Trek: New Horizons Wiki project. This file is your entry point.

## Quick Orientation

**What is this?** A modular off-game wiki for the STNH Stellaris mod. Vanilla HTML/CSS/JS, no build tools, no frameworks. Python pipeline generates JSON data, browser renders it.

**Key numbers:** 9 HTML pages, ~21,630 searchable items, 54 JS files, 84 Python pipeline files (57 core + 27 techtree).

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
  assets/                                Generated JSON data (38 files + 272 event details)
    flags/trek/                          79 WebP empire flags
  update/                                Python data pipeline (57 core + 27 techtree)
    UPDATE_WIKI.py                       Master orchestrator
    config.py                            Paths (STNH_MOD_ROOT, WIKI_ROOT)
    parse_pdx.py                         Shared PDX parser (recursive descent)
    parse_*.py                           26 module-specific parsers
    convert_*.py                         3 converters (images, ship models, building icons)
    generate_*.py                        13 JSON generators
    techtree/                            27 scripts (copied from git09, not yet functional)
  pictures/                              986 WebP event images
  icons/tech/                            1,659 tech icons
  icons/buildings/                       754 building icons
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
- **tech.html:** Imported from git09. Has its own inline CSS (~780 lines), D3.js (CDN), ES Modules. Sidebar search is `#tech-filter-input` (renamed to avoid conflict with GlobalSearch in header). Has a minimal I18n shim instead of full i18n.js. Tier-Layout is the default view (no separate tech-header).

## GlobalSearch Architecture

- `global-search.js` loads `search_index.json` (~19,740 items, all modules)
- On **Hub**: `hub.js` handles everything (preview dropdown + full results on Enter)
- On **Content pages**: `initGlobalSearch()` in `common.js` adds an overlay dropdown to `#search-input` (150ms debounce, min 2 chars, 3 results per type)
- Both local page filtering and GlobalSearch run in parallel on the same input
- Prefix search: `ship:`, `event:`, `building:`, `trait:`, etc.
- Faction synonyms: `fed` expands to federation/ufp/starfleet/...

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
| Add PDX keyword to humanizer | `js/humanize.js` → `TRIGGER_MAP` or `EFFECT_MAP` (see `docs/HUMANIZE.md`) |
| Add modifier display name | `js/humanize.js` → `MODIFIER_MAP` |
| Change theme colors | `js/common.js` → `THEMES` object |
| Fix mobile layout | `style.css` → `@media` rules + hamburger section |
| Update data | `cd update && python UPDATE_WIKI.py --skip-images` |
| Understand the architecture | `docs/ARCHITECTURE.md` |
| Pipeline details | `docs/PIPELINE.md` |
| Frontend patterns | `docs/FRONTEND.md` (incl. Content-Page-Skeleton) |
