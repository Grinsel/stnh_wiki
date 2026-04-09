# STNH Wiki - Projektdokumentation

Vollstaendige technische Dokumentation des Star Trek: New Horizons Wiki.
Eine modulare Multi-Page-Website zur Darstellung aller spielrelevanten Daten des STNH Stellaris-Mods.

> **Hinweis:** Die Dokumentation ist auch in spezialisierten Einzeldateien im `docs/`-Ordner verfuegbar:
> | Datei | Inhalt |
> |---|---|
> | `docs/ARCHITECTURE.md` | Systemuebersicht, Datenfluss, Frontend-Architektur, Design-Prinzipien |
> | `docs/PIPELINE.md` | Python-Pipeline: Master-Script, Parser, Generatoren, Konfiguration |
> | `docs/FRONTEND.md` | JS-Module, Page-Controller-Skeleton, Events/Tech-Module, Design-System |
> | `docs/FILE_STRUCTURE.md` | Vollstaendiger annotierter Verzeichnisbaum |
> | `docs/ASSETS.md` | Alle 33 JSON-Dateien, Bilder, Icons, Cross-References, Suchindex |
> | `docs/DEVELOPMENT.md` | Lokale Einrichtung, Deployment, Module hinzufuegen, Wartung |

---

## Inhaltsverzeichnis

1. [Projektuebersicht](#1-projektuebersicht)
2. [Verzeichnisstruktur](#2-verzeichnisstruktur)
3. [Daten-Pipeline (Python)](#3-daten-pipeline-python)
4. [Frontend (HTML/CSS/JS)](#4-frontend-htmlcssjs)
5. [Generierte Assets](#5-generierte-assets)
6. [Deployment (GitHub Pages)](#6-deployment-github-pages)
7. [Update-Workflow](#7-update-workflow)
8. [Konfiguration anpassen](#8-konfiguration-anpassen)
9. [Erweiterung & Wartung](#9-erweiterung--wartung)

---

## 1. Projektuebersicht

| Eigenschaft | Wert |
|---|---|
| HTML-Seiten | 11 (Hub + 9 Content + Tech Tree) |
| Events | ~8.867 (430 Dateien, 287 Namespaces) |
| Techs | ~2.600 (D3.js Graph, aus git09 kopiert) |
| Content-Items (Non-Event) | ~10.873 (Ships, Buildings, Traits, Govs, Megas, Anomalies, Empires, Economy) |
| Suchindex | ~19.740 Items (2,6 MB, cross-module) |
| Sprachen | 7 (EN, DE, FR, ES, RU, PL, BR-PT) |
| Loc-Keys | ~200.000+ pro Sprache |
| GFX Sprites | 7.338 gesamt, ~986 konvertierte Event-Bilder, 754 Building-Icons |
| Tech-Icons | 1.659 (WebP, aus git09) |
| JSON-Assets | 33 Dateien + 272 Event-Detail-JSONs |
| JS-Dateien | 53 (12 shared + 11 pages + 5 UI + 24 tech + 1 ship-viewer) |
| Python-Pipeline | 77 Dateien (50 core + 27 techtree) |
| Pipeline-Laufzeit | ~12 Sekunden (ohne Bilder) |
| Projektgroesse | ~1,4 GB (inkl. 3D-Modelle, ohne: ~294 MB) |
| Frontend | Vanilla HTML/CSS/JS (kein Framework, kein Build-Tool) |
| Deployment | GitHub Pages (automatisch bei push auf master) |
| Abhaengigkeiten | Python 3.8+ (stdlib), ImageMagick (nur fuer Bilder), D3.js v7 (CDN, nur tech.html) |

### Architektur-Diagramm

```
+----------------------------------------------------------------+
|  STNH Mod (git01/)                                 [READ-ONLY] |
|  +-- events/*.txt                (430 Dateien, PDX-Syntax)     |
|  +-- localisation/{lang}/        (7 Sprachen, .yml)            |
|  +-- interface/*.gfx             (45 Dateien, Sprite-Defs)     |
|  +-- gfx/event_pictures/         (DDS-Quelldateien)            |
|  +-- common/                                                    |
|  |   +-- on_actions/             (18 Dateien)                  |
|  |   +-- event_chains/           (19 Dateien)                  |
|  |   +-- ship_sizes/             (47 Dateien)                  |
|  |   +-- component_templates/    (97 Dateien)                  |
|  |   +-- buildings/              (36 Dateien)                  |
|  |   +-- districts/              Distrikte                     |
|  |   +-- traits/                 (50 Dateien)                  |
|  |   +-- traditions/             (38 Dateien)                  |
|  |   +-- ascension_perks/        (2 Dateien)                   |
|  |   +-- governments/            (27 Dateien, +authorities/, +civics/) |
|  |   +-- policies/               Richtlinien                   |
|  |   +-- edicts/                 Edikte                        |
|  |   +-- megastructures/         (51 Dateien)                  |
|  |   +-- relics/                 (16 Dateien)                  |
|  |   +-- anomalies/              Anomalien                     |
|  |   +-- archaeological_site_types/  Archaeologie              |
|  |   +-- pop_jobs/               (31 Dateien)                  |
|  |   +-- deposits/               (27 Dateien)                  |
|  |   +-- species_classes/        Spezies                       |
|  |   +-- species_archetypes/     Archetypen                    |
|  +-- prescripted_countries/      Empires                       |
+----------------------------------------------------------------+
                    | Python Pipeline
                    | +-- UPDATE_WIKI.py      (Master-Orchestrator)
                    | +-- 26 Parser + 13 Generatoren + 3 Konverter
                    v
+----------------------------------------------------------------+
|  STNH Wiki (git10/stnh_wiki/)                                   |
|  +-- 11 HTML-Seiten              (Hub, Events, Tech, 8 Content)|
|  +-- assets/                     (33 JSON + 272 Event-Details) |
|  +-- pictures/                   (986 WebP-Bilder)             |
|  +-- icons/tech/                 (1.659 Tech-Icons)            |
|  +-- icons/buildings/            (754 Building-Icons)          |
|  +-- js/                         (53 JS-Module)                |
|  +-- style.css                   (44 KB, Dark Theme)           |
+----------------------------------------------------------------+
                    | git push -> GitHub Pages
                    v
              [ Live Website ]
```

### Phasen-System

| Phase | Modul | Status |
|---|---|---|
| 0 | Projekt-Grundlage (Skeleton, Pipeline, Frontend) | Fertig |
| 1 | Events (Event Browser Migration) | Fertig |
| 2 | Schiffe & Komponenten | Fertig |
| 3 | Gebaeude & Distrikte | Fertig |
| 4 | Traits & Traditionen | Fertig |
| 5 | Regierung & Diplomatie | Fertig |
| 6 | Megastrukturen & Relics | Fertig |
| 7 | Anomalien & Archaeologie | Fertig |
| 8 | Fraktionen & Empires | Fertig |
| 9 | Ressourcen & Wirtschaft | Fertig |
| 10 | Suche & Vernetzung (Cross-Module) | Fertig |
| 11 | Techtree (Kopie aus git09) | 11.1 Fertig, 11.2 offen, 11.3+11.4 teilweise, 11.5+11.6 offen |

### Cross-Cutting Features (nicht phasengebunden)

| Feature | Beschreibung |
|---|---|
| GlobalSearch | Cross-module Suche auf allen 11 Seiten (initGlobalSearch in common.js) |
| Hamburger-Menue | Responsive Navigation ab 768px (initHamburger in common.js) |
| OG-Tags | Open Graph Meta-Tags fuer Social-Media-Preview auf allen Seiten |
| Faction-Themes | 9 waehlbare Farbschemata (Cardassian, Federation, Klingon, ...) |
| 7-Sprachen-UI | UI-Strings in ui-strings.js, Mod-Content via i18n.js |
| Font-Size-Control | Dynamische Schriftgroesse (90%-160%) |

---

## 2. Verzeichnisstruktur

```
stnh_wiki/
|
+-- .github/
|   +-- workflows/
|       +-- deploy.yml                 # GitHub Pages Auto-Deployment
|
+-- assets/                            # [GENERIERT] JSON-Daten (33 Dateien)
|   +-- events_index.json              # Event-Index (2,6 MB)
|   +-- namespaces.json                # Namespace-Metadaten (42 KB)
|   +-- relationships.json             # Event-Trigger-Graph (637 KB)
|   +-- on_actions.json                # On-Action -> Event Mappings (30 KB)
|   +-- event_chains.json              # Event-Chain-Definitionen (12 KB)
|   +-- pictures_map.json              # GFX-Name -> Textur-Pfad (1,2 MB, 7.338 Sprites)
|   +-- ships.json                     # Schiffe (320 KB)
|   +-- components.json                # Komponenten (4,9 MB)
|   +-- buildings.json                 # Gebaeude (506 KB)
|   +-- districts.json                 # Distrikte (44 KB)
|   +-- traits.json                    # Traits (213 KB)
|   +-- traditions.json                # Traditionen (151 KB)
|   +-- ascension_perks.json           # Aufstiegsvorteile (34 KB)
|   +-- governments.json               # Regierungen (60 KB)
|   +-- civics.json                    # Buergerrechte (159 KB)
|   +-- authorities.json               # Autoritaeten (7,6 KB)
|   +-- policies.json                  # Richtlinien (63 KB)
|   +-- edicts.json                    # Edikte (49 KB)
|   +-- megastructures.json            # Megastrukturen (160 KB)
|   +-- relics.json                    # Relikte (61 KB)
|   +-- anomalies.json                 # Anomalien (68 KB)
|   +-- archaeology.json               # Archaeologie (25 KB)
|   +-- empires.json                   # Reiche (115 KB)
|   +-- species.json                   # Spezies (74 KB)
|   +-- jobs.json                      # Berufe (219 KB)
|   +-- deposits.json                  # Lagerstetten (237 KB)
|   +-- ship_models_map.json            # Ship-ID -> Fraktions-Modell Mapping (443 KB)
|   +-- galaxy_map.json                # Galaxy-Map Startpositionen (22 KB)
|   +-- tech_item_map.json             # Tech -> Item Cross-Reference (1,05 MB)
|   +-- search_index.json              # Suchindex cross-module (2,6 MB, ~19.740 Items)
|   +-- cross_references.json          # Bidirektionale Cross-Refs (303 KB)
|   +-- module_pages.json              # Modul -> HTML-Seite Mapping
|   +-- last_update.json               # Timestamp + Statistiken
|   +-- events_detail/                 # Detail-JSONs pro Namespace (272 Dateien)
|   +-- localisation/                  # Loc-Keys pro Sprache (7 Dateien)
|   +-- tech/                          # Techtree-Assets (aus git09)
|   +-- flags/trek/                   # Empire-Flaggen (79 WebP)
|
+-- pictures/                          # [GENERIERT] WebP Event-Bilder (986 Dateien)
|
+-- icons/                             # Tech/Item-Icons
|   +-- tech/                          # 1.659 Tech-Icons (WebP, aus git09)
|   +-- buildings/                     # 754 Building-Icons (WebP, aus DDS konvertiert)
|   +-- unlock_types/                  # 25 Unlock-Type-Icons (WebP)
|   +-- tech_icon_mappings.json        # Icon-Name -> Datei-Mapping
|
+-- fonts/                             # Star Trek Schriftarten
|   +-- federation-ds9-title.TTF
|   +-- Tungsten-Light.ttf
|
+-- js/                                # Frontend JavaScript (53 Dateien)
|   +-- common.js                      # Shared: Theme, Font, Lang, Nav, Hamburger, GlobalSearch
|   +-- data.js                        # DataManager - Asynchrones JSON-Laden + Cache
|   +-- state.js                       # AppState - URL-synchronisierter State
|   +-- i18n.js                        # Internationalisierung (7 Sprachen)
|   +-- ui-strings.js                  # UI-String-Definitionen (310+ Keys)
|   +-- global-search.js              # GlobalSearch - Cross-Module Prefix-Suche
|   +-- search.js                      # SearchEngine - Event-spezifische Suche
|   +-- filters.js                     # Filter-Pipeline (AND-Logik, Events)
|   +-- chain-index.js                 # Chain-Index (Connected Components)
|   +-- render.js                      # Event HTML-Rendering (Cards + Detail)
|   +-- humanize.js                    # PDX-Syntax -> lesbarer Text
|   +-- shared-render.js               # Gemeinsames Rendering fuer Content-Module
|   +-- ship-viewer.js                 # 3D Ship Viewer (Three.js, lazy-loaded)
|   +-- pages/                         # 11 Seiten-Controller
|   |   +-- hub.js                     # Hub: Stats, GlobalSearch Full-Results
|   |   +-- events.js                  # Events: Filter, Sidebar, Detail, Chains
|   |   +-- ships.js                   # Ships: Tabs (Ships/Components), Filter, Detail
|   |   +-- buildings.js               # Buildings: Tabs (Buildings/Districts), Filter
|   |   +-- traits.js                  # Traits: Tabs (Traits/Traditions/Perks), Filter
|   |   +-- governments.js             # Govs: Tabs (Govs/Civics/Auth/Policies/Edicts)
|   |   +-- megastructures.js          # Megas: Tabs (Megastructures/Relics)
|   |   +-- anomalies.js              # Anomalies: Tabs (Anomalies/Archaeology)
|   |   +-- empires.js                 # Empires: Tabs (Empires/Species)
|   |   +-- economy.js                 # Economy: Tabs (Jobs/Deposits)
|   |   +-- galaxy-map.js             # Galaxy Map: Empire-Startpositionen (Canvas)
|   +-- ui/                            # 5 UI-Komponenten
|   |   +-- event-list.js              # Paginierte Event-Liste
|   |   +-- event-detail.js            # Event-Detailansicht
|   |   +-- namespace-nav.js           # Sidebar-Navigation
|   |   +-- chain-viewer.js            # Event-Chain-Visualisierung
|   |   +-- category-chips.js          # Chip-Bar Filter (Ships, Buildings)
|   +-- tech/                          # 24 Tech-Module (aus git09)
|       +-- main.js                    # Einstiegspunkt (ES Module)
|       +-- data.js, render.js, filters.js, search.js, state.js, factions.js
|       +-- ui/                        # Tech UI-Komponenten
|           +-- events.js, zoom.js, tabs.js, tiers.js, popup.js, ...
|           +-- layouts/               # 5 Layout-Engines (force, grid, tier, arrows, disjoint)
|
+-- update/                            # Python Daten-Pipeline (77 Dateien: 50 core + 27 techtree)
|   +-- UPDATE_WIKI.py                 # Master-Orchestrator (alle Phasen)
|   +-- UPDATE_EVENTS.py               # Modul-Updater: Events
|   +-- UPDATE_LOC.py                  # Modul-Updater: Localisation
|   +-- UPDATE_GFX.py                  # Modul-Updater: GFX-Mappings
|   +-- UPDATE_IMAGES.py               # Modul-Updater: Bildkonvertierung
|   +-- config.py                      # Pfade & Konfiguration
|   +-- parse_pdx.py                   # Rekursiver PDX-Parser (Basis fuer alle)
|   +-- parse_helpers.py               # Gemeinsame Parser-Hilfsfunktionen
|   +-- parse_localisation.py          # Lokalisierungs-Parser (7 Sprachen)
|   +-- parse_gfx_mappings.py          # GFX Sprite-Mappings
|   +-- parse_events.py                # Event-Extraktion
|   +-- parse_on_actions.py            # On-Action-Parser
|   +-- parse_event_chains.py          # Event-Chain-Parser
|   +-- parse_ships.py                 # Schiffe
|   +-- parse_components.py            # Komponenten
|   +-- parse_buildings.py             # Gebaeude
|   +-- parse_districts.py             # Distrikte
|   +-- parse_traits.py                # Traits
|   +-- parse_traditions.py            # Traditionen
|   +-- parse_ascension_perks.py       # Aufstiegsvorteile
|   +-- parse_governments.py           # Regierungen
|   +-- parse_policies.py              # Richtlinien
|   +-- parse_edicts.py                # Edikte
|   +-- parse_megastructures.py        # Megastrukturen
|   +-- parse_relics.py                # Relikte
|   +-- parse_anomalies.py             # Anomalien
|   +-- parse_archaeology.py           # Archaeologie
|   +-- parse_empires.py               # Reiche
|   +-- parse_species.py               # Spezies
|   +-- parse_jobs.py                  # Berufe
|   +-- parse_deposits.py              # Lagerstetten
|   +-- build_relationships.py         # Event-Trigger-Graph
|   +-- generate_events_json.py        # Events JSON + Faction-Mapping
|   +-- generate_ships_json.py         # Ships + Components JSON
|   +-- generate_buildings_json.py     # Buildings + Districts JSON
|   +-- generate_traits_json.py        # Traits + Traditions + Perks JSON
|   +-- generate_governments_json.py   # Govs + Civics + Auth + Policies + Edicts JSON
|   +-- generate_megastructures_json.py# Megastructures + Relics JSON
|   +-- generate_anomalies_json.py     # Anomalies + Archaeology JSON
|   +-- generate_empires_json.py       # Empires + Species JSON
|   +-- generate_economy_json.py       # Jobs + Deposits JSON
|   +-- generate_search_index.py       # Cross-Module Suchindex
|   +-- generate_cross_references.py   # Bidirektionale Cross-Refs
|   +-- generate_galaxy_map_json.py   # Galaxy-Map Startpositionen
|   +-- generate_tech_item_map.py     # Tech -> Item Cross-Reference Map
|   +-- convert_images.py              # DDS -> WebP Konvertierung (Event-Bilder)
|   +-- convert_building_icons.py     # DDS -> WebP Konvertierung (Building-Icons)
|   +-- convert_ship_models.py        # PdxMesh -> GLB 3D-Modelle
|   +-- pdx_mesh_reader.py            # Binaer-Parser fuer PdxMesh (.mesh)
|   +-- techtree/                      # Techtree-Pipeline (27 Scripts, aus git09, NOCH NICHT LAUFFAEHIG)
|
+-- index.html                         # Hub / Landing Page
+-- events.html                        # Event Browser
+-- tech.html                          # Tech Tree (D3.js, eigenes Inline-CSS)
+-- ships.html                         # Schiffe & Komponenten
+-- buildings.html                     # Gebaeude & Distrikte
+-- traits.html                        # Traits & Traditionen
+-- governments.html                   # Regierung & Diplomatie
+-- megastructures.html                # Megastrukturen & Relics
+-- anomalies.html                     # Anomalien & Archaeologie
+-- empires.html                       # Fraktionen & Empires
+-- economy.html                       # Wirtschaft
+-- style.css                          # Gemeinsames Dark Theme (44 KB)
+-- tech_showcase.js                   # Techtree Legacy-Einstiegspunkt
+-- tech_localisation_map.json         # Techtree Lokalisierung (21 MB)
+-- tech_trigger_map.json              # Techtree Trigger-Map
+-- pre_tree_bg.png                    # Techtree Hintergrundbild
|
+-- UPDATE.bat                         # Gesamt-Update + Deploy
+-- UPDATE_QUICK.bat                   # Gesamt-Update ohne Bilder + Deploy
+-- UPDATE_EVENTS.bat                  # Events-Update
+-- UPDATE_EVENTS_QUICK.bat            # Events-Update ohne Bilder
+-- UPDATE_TECHTREE.bat                # Techtree-Pipeline starten
|
+-- CLAUDE.md                          # Entwickler-Handover (Einstiegspunkt)
+-- DOCUMENTATION.md                   # Diese Datei (ausfuehrliche Doku)
+-- TODO.md                            # Master-Projektplan (12 Phasen + Backlog)
+-- .gitignore
```

---

## 3. Daten-Pipeline (Python)

### 3.1 Master-Script: `UPDATE_WIKI.py`

Orchestriert alle Phasen der Datenverarbeitung:

```
Phase 1: Validation     -> config.validate_paths()
Phase 2: Localisation   -> parse_localisation.main()
Phase 3: GFX Mapping    -> parse_gfx_mappings.main()
Phase 4: Events         -> generate_events_json.generate_all()
Phase 5: Content
   5a: Ships            -> generate_ships_json.generate_all()
   5b: Buildings        -> generate_buildings_json.generate_all()
   5c: Traits           -> generate_traits_json.generate_all()
   5d: Governments      -> generate_governments_json.generate_all()
   5e: Megastructures   -> generate_megastructures_json.generate_all()
   5f: Anomalies        -> generate_anomalies_json.generate_all()
   5g: Empires          -> generate_empires_json.generate_all()
   5h: Economy          -> generate_economy_json.generate_all()
   5i: Search           -> generate_search_index + generate_cross_references
Phase 6: Images         -> convert_images.convert_images()  [optional]
Phase 7: Summary        -> Statistiken + last_update.json
```

**Aufruf:**
```bash
python UPDATE_WIKI.py                        # Vollstaendig (~12s + Bilder)
python UPDATE_WIKI.py --skip-images          # Ohne Bilder (~12s)
python UPDATE_WIKI.py --only events          # Nur Events-Modul
python UPDATE_WIKI.py --only ships           # Nur Ships & Components
python UPDATE_WIKI.py --only buildings       # Nur Buildings & Districts
python UPDATE_WIKI.py --only traits          # Nur Traits, Traditions, Perks
python UPDATE_WIKI.py --only governments     # Nur Govs, Civics, Policies, Edicts
python UPDATE_WIKI.py --only megastructures  # Nur Megastructures & Relics
python UPDATE_WIKI.py --only anomalies       # Nur Anomalies & Archaeology
python UPDATE_WIKI.py --only empires         # Nur Empires & Species
python UPDATE_WIKI.py --only economy         # Nur Jobs & Deposits
python UPDATE_WIKI.py --only search          # Nur Search Index & Cross-References
python UPDATE_WIKI.py --only content         # Alle 8 Content-Module + Search
python UPDATE_WIKI.py --only loc             # Nur Localisation
python UPDATE_WIKI.py --only gfx             # Nur GFX-Mappings
python UPDATE_WIKI.py --only images          # Nur Bildkonvertierung
```

### 3.2 Parser-Architektur

Alle Parser nutzen `parse_pdx.py` als gemeinsame Basis (rekursiver Descent Parser).

**Warum kein PLY?** PLY hatte Probleme mit Error Recovery bei PDX-Sonderfaellen (Doppelpunkte in IDs, Operatoren, @Variablen).

```python
# parse_pdx.py - Tokenizer + Parser
class PdxLexer:
    # Token: COMMENT, STRING, OPERATOR, LBRACE, RBRACE, VARIABLE, NUMBER, WORD
    def tokenize(text) -> list[Token]

class PdxParser:
    def parse(text) -> list[dict]
    # key = value       -> {'key': 'value'}
    # key = { ... }     -> {'key': [nested...]}
    # { val1 val2 }     -> [val1, val2]

# Hilfsfunktionen
def get_value(data, key, default=None)
def get_all_values(data, key)
def get_blocks(data, key)
```

### 3.3 Konfiguration: `config.py`

```python
# Nur diese beiden Pfade muessen angepasst werden:
STNH_MOD_ROOT = r"C:\Users\marcj\git01\New-Horizons-Development"
WIKI_ROOT = r"C:\Users\marcj\git10\stnh_wiki"

# Automatisch abgeleitet:
MOD_EVENTS_DIR, MOD_LOCALISATION_DIR, MOD_ON_ACTIONS_DIR, ...
OUTPUT_ASSETS_DIR, OUTPUT_PICTURES_DIR, OUTPUT_ICONS_DIR, ...

LANGUAGES = ['english', 'german', 'french', 'spanish', 'russian', 'polish', 'braz_por']
```

### 3.4 Parser & Generatoren pro Modul

| Modul | Parser | Generator | Output-JSONs |
|---|---|---|---|
| Events | parse_events, parse_on_actions, parse_event_chains, build_relationships | generate_events_json | events_index, events_detail/*, namespaces, relationships, on_actions, event_chains |
| Localisation | parse_localisation | (direkt) | localisation/{lang}.json |
| GFX | parse_gfx_mappings | (direkt) | pictures_map.json |
| Ships | parse_ships, parse_components | generate_ships_json | ships.json, components.json |
| Buildings | parse_buildings, parse_districts | generate_buildings_json | buildings.json, districts.json |
| Traits | parse_traits, parse_traditions, parse_ascension_perks | generate_traits_json | traits.json, traditions.json, ascension_perks.json |
| Governments | parse_governments, parse_policies, parse_edicts | generate_governments_json | governments.json, civics.json, authorities.json, policies.json, edicts.json |
| Megastructures | parse_megastructures, parse_relics | generate_megastructures_json | megastructures.json, relics.json |
| Anomalies | parse_anomalies, parse_archaeology | generate_anomalies_json | anomalies.json, archaeology.json |
| Empires | parse_empires, parse_species | generate_empires_json | empires.json, species.json |
| Economy | parse_jobs, parse_deposits | generate_economy_json | jobs.json, deposits.json |
| Galaxy Map | (Empires-Daten) | generate_galaxy_map_json | galaxy_map.json |
| Tech Item Map | (Tech + Content-Daten) | generate_tech_item_map | tech_item_map.json |
| Search | (alle obigen) | generate_search_index, generate_cross_references | search_index.json, cross_references.json, module_pages.json |
| Images | (GFX-Mapping) | convert_images | pictures/*.webp |

### 3.5 Lokalisierungs-Parser

```python
# parse_localisation.py
# Parst .yml-Dateien aller 7 Sprachen
# Regex: key:0 "value" oder key: "value"
# Encoding: UTF-8-SIG mit latin-1 Fallback
# Format-Codes (§R, §W, etc.) werden entfernt
# $key$-Referenzen werden rekursiv aufgeloest (Loop-Protection)
```

### 3.6 Bildkonvertierung

```python
# convert_images.py
# DDS -> WebP via ImageMagick (magick convert)
# Animierte Sprites: Erster Frame zugeschnitten
# Resize: 480px Breite, proportional, Qualitaet 80
# Inkrementell: Nur neue/geaenderte Bilder
# Voraussetzung: ImageMagick im PATH
```

---

## 4. Frontend (HTML/CSS/JS)

### 4.1 Seiten-Uebersicht

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

Alle Seiten (ausser index.html) teilen dieselbe Grundstruktur:
- Header (Logo, Suche, Sprach-Dropdown, Theme-Picker, Font-Size)
- Wiki-Navigation (11 Links, Hamburger auf Mobile)
- GlobalSearch-Results-Container (Overlay-Dropdown)
- Filter-Bar (Tabs + modulspezifische Filter)
- Content (Liste + Detail-Panel)
- Footer

**tech.html Sonderfall:** Hat zusaetzlich eigenes Inline-CSS (~780 Zeilen), eigene D3.js-Abhaengigkeit (CDN), einen minimalen I18n-Shim statt des vollen i18n.js, und laed D3 + ES-Module. Die Sidebar-Suche nutzt `#tech-filter-input` (nicht `#search-input`), damit kein Konflikt mit dem GlobalSearch im Header.

### 4.2 Shared Module

#### `js/common.js` - Gemeinsame Initialisierung

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
    // Hub handled GlobalSearch selbst in hub.js
})();
```

#### `js/global-search.js` - Cross-Module Suche

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

#### `js/data.js` - DataManager

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

#### `js/state.js` - AppState

```javascript
const AppState = (() => {
    // URL-synchronisierter State mit localStorage-Persistenz
    init()                     // URL-Parameter lesen
    get(key), set(key, value)  // Lesen/Schreiben + URL
    setMultiple(updates)       // Mehrere Werte
    onChange(callback)          // Listener
})();
```

#### `js/i18n.js` - Internationalisierung

```javascript
const I18n = (() => {
    setLanguage(lang)   // Sprachdatei laden
    t(key)              // Mod-Content uebersetzen (Fallback: Key selbst)
    ui(key)             // UI-String aus UI_STRINGS
})();
```

#### `js/ui-strings.js` - UI-String-Definitionen

310+ Keys fuer Navigation, Tabs, Filter, Labels, Suchfelder, Detail-Titel, Badges, Fehlermeldungen etc. Jeder Key hat mindestens `english` und `german`, manche alle 7 Sprachen.

#### `js/humanize.js` - PDX-Syntax -> lesbarer Text

Konvertiert PDX-Trigger/Effekt-Bloecke in menschenlesbare Saetze.

#### `js/shared-render.js` - Gemeinsames Rendering

Rendering-Funktionen die von allen 8 Content-Seiten (nicht Events, nicht Hub) geteilt werden:
- Item-Cards, Detail-Panels, Pagination, Tab-Umschaltung
- Humanisierte Modifier/Trigger/Effekte

### 4.3 Page-Controller-Muster (Content-Seiten)

Alle 8 Content-Seiten (ships, buildings, traits, governments, megastructures, anomalies, empires, economy) folgen demselben IIFE-Pattern:

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

### 4.4 Events-Module (nur events.html)

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

### 4.5 Tech-Module (nur tech.html, aus git09)

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

### 4.6 Design-System (`style.css`)

```
Theme:
  --bg-primary: #111111
  --bg-header: #161618
  --bg-card: rgba(0,0,0,0.86)
  --text-primary: #e4e7eb
  --accent-gold: rgba(209,206,4,0.69)  (dynamisch per Faction-Theme)

Schriftarten:
  federation-ds9-title.TTF   (Ueberschriften)
  Tungsten-Light.ttf         (Badges/Labels)

Responsive Breakpoints:
  768px  - Hamburger-Menue aktiv
  921px  - Header wraps, Detail-Panel unter Liste
  544px  - Filter vertikal, Thumbnails ausgeblendet
  1200px - Sidebar schmaler
```

---

## 5. Generierte Assets

| Datei | Groesse | Inhalt |
|---|---|---|
| `events_index.json` | 2,6 MB | Alle Events (kompakt): id, name, type, ns, pic, snippet, flags |
| `events_detail/{ns}.json` | ~4 MB | Volle Event-Daten (272 Dateien) |
| `namespaces.json` | 42 KB | Namespace -> faction, category, source_files, event_count |
| `relationships.json` | 637 KB | Event-Trigger-Graph (bidirektional) |
| `on_actions.json` | 30 KB | on_action -> [event_ids] |
| `event_chains.json` | 12 KB | Chain-Definitionen |
| `pictures_map.json` | 1,2 MB | GFX-Name -> {texturefile, frames} (7.338 Sprites) |
| `ship_models_map.json` | 443 KB | Ship-ID -> Fraktions-Modell Mapping |
| `ships.json` | 320 KB | Schiffe: Name, Klasse, Groesse, HP, Sektionen, Tech |
| `components.json` | 4,9 MB | Komponenten: Name, Typ, Tier, Stats, Tech |
| `buildings.json` | 506 KB | Gebaeude: Name, Kategorie, Kosten, Modifier, Jobs, Tech |
| `districts.json` | 44 KB | Distrikte |
| `traits.json` | 213 KB | Traits: Name, Typ, Kosten, Modifier, Gegensaetze |
| `traditions.json` | 151 KB | Traditionen: Name, Baum, Stufe, Effekte |
| `ascension_perks.json` | 34 KB | Aufstiegsvorteile |
| `governments.json` | 60 KB | Regierungen |
| `civics.json` | 159 KB | Buergerrechte |
| `authorities.json` | 7,6 KB | Autoritaeten |
| `policies.json` | 63 KB | Richtlinien |
| `edicts.json` | 49 KB | Edikte |
| `megastructures.json` | 160 KB | Megastrukturen: Stufen, Kosten, Effekte, Tech |
| `relics.json` | 61 KB | Relikte: Passive/Aktive Effekte, Cooldown |
| `anomalies.json` | 68 KB | Anomalien: Kategorie, Ergebnisse, Trigger |
| `archaeology.json` | 25 KB | Archaeologie: Kapitel, Belohnungen |
| `empires.json` | 115 KB | Reiche: Species, Ethik, Government, Origin |
| `species.json` | 74 KB | Spezies: Archetyp, Portraits |
| `jobs.json` | 219 KB | Berufe: Produktion, Konsum |
| `deposits.json` | 237 KB | Lagerstetten |
| `galaxy_map.json` | 22 KB | Galaxy-Map Empire-Startpositionen |
| `tech_item_map.json` | 1,05 MB | Tech -> Item Cross-Reference (Ships, Buildings, Components) |
| `search_index.json` | 2,6 MB | Cross-Module Suchindex (~19.740 Items) |
| `cross_references.json` | 303 KB | Bidirektionale Cross-Refs |
| `module_pages.json` | 248 B | Modul -> HTML-Seite Mapping |
| `last_update.json` | 2,5 MB | Timestamp + Statistiken |
| `localisation/{lang}.json` | ~100 KB | Loc-Keys pro Sprache (~200k Keys) |
| `pictures/*.webp` | ~12 MB | WebP-Bilder (480x204, Q80, 986 Dateien) |

---

## 6. Deployment (GitHub Pages)

### `.github/workflows/deploy.yml`

```yaml
on:
  push:
    branches: [master]
  workflow_dispatch:        # Manuell ausloesbar

jobs:
  deploy:
    permissions: pages: write, id-token: write, contents: read
    steps: Checkout -> Setup Pages -> Upload artifact -> Deploy
    concurrency: group "pages" (nur ein Deployment gleichzeitig)
```

**Trigger:** Jeder Push auf `master` startet automatisch das Deployment.

---

## 7. Update-Workflow

### Gesamt-Update

```
UPDATE.bat (oder UPDATE_QUICK.bat ohne Bilder)
  |
  +-- python UPDATE_WIKI.py [--skip-images]
  |   +-- Phase 1-7 (alle Module)
  |
  +-- git add assets/ pictures/ icons/ fonts/
  +-- git commit -m "Update STNH Wiki - {datum}"
  +-- git push -> GitHub Pages Deployment
```

### Selektive Updates

```bash
python UPDATE_WIKI.py --only events         # Nur Events
python UPDATE_WIKI.py --only content        # Alle 8 Content-Module + Search
python UPDATE_WIKI.py --only search         # Nur Suchindex + Cross-Refs
python UPDATE_WIKI.py --only loc            # Nur Localisation
```

---

## 8. Konfiguration anpassen

### Anderes System

Nur `update/config.py` aendern:
```python
STNH_MOD_ROOT = r"D:\Games\Stellaris\mod\stnh"
WIKI_ROOT = r"D:\Projects\stnh_wiki"
```

### Neue Sprache

1. `config.py`: Sprache zu `LANGUAGES` hinzufuegen
2. Sicherstellen, dass `localisation/{sprache}/` im Mod existiert
3. Alle HTML-Dateien: `<option>` zum Sprach-Dropdown hinzufuegen

### Neue Faction

1. `generate_events_json.py`: Eintrag zu `FACTION_PATTERNS` hinzufuegen
2. Frontend erkennt neue Factions automatisch

---

## 9. Erweiterung & Wartung

### Neues Modul hinzufuegen (Pipeline)

1. Parser: `update/parse_neues_ding.py` (nutzt parse_pdx.py)
2. Generator: `update/generate_neues_ding_json.py`
3. In `UPDATE_WIKI.py` neue Phase einbinden
4. In `generate_search_index.py` neuen Typ hinzufuegen

### Neues Modul hinzufuegen (Frontend)

1. HTML: Kopie einer bestehenden Content-Seite (z.B. ships.html)
2. Page-Controller: `js/pages/neues_ding.js` (IIFE-Pattern wie oben)
3. Tab-Definitionen, Filter, Rendering
4. Navigation: Links in allen 11 HTML-Dateien + Hub-Cards in index.html
5. OG-Tags in neuem HTML hinzufuegen

### Haeufige Wartungsaufgaben

| Aufgabe | Datei(en) |
|---|---|
| Faction falsch zugeordnet | `generate_events_json.py` -> `FACTION_PATTERNS` |
| Parser-Fehler | `parse_pdx.py` (Basis) oder modulspezifischer Parser |
| Bilder fehlen | `parse_gfx_mappings.py` + `convert_images.py` |
| Lokalisierung falsch | `parse_localisation.py` (Encoding? $key$-Referenzen?) |
| UI-String fehlt | `js/ui-strings.js` (Key hinzufuegen, min. english + german) |
| Neuer Suchprefix | `js/global-search.js` -> `TYPE_PREFIXES` |
| Styling | `style.css` (44 KB, dark theme) |

### Abhaengigkeiten

| Abhaengigkeit | Version | Zweck | Erforderlich? |
|---|---|---|---|
| Python | 3.8+ | Pipeline | Ja |
| ImageMagick | 7+ | DDS->WebP | Nur fuer Bilder |
| D3.js | v7 (CDN) | Tech Tree Visualisierung | Nur tech.html |
| Git | - | Deployment | Ja |
| npm/Node | - | - | Nicht benoetigt |
