# Verzeichnisstruktur

Vollstaendige annotierte Verzeichnisstruktur des Projekts.

```
stnh_wiki/
|
+-- .github/
|   +-- workflows/
|       +-- deploy.yml                 # GitHub Pages Auto-Deployment
|
+-- assets/                            # [GENERIERT] JSON-Daten (36 Dateien)
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
|   +-- councilors.json                # Councilors (67 KB)
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
|   +-- changes.json                   # Aenderungs-Tracking (4,9 KB)
|   +-- changes_history.json           # Aenderungs-Historie (908 KB)
|   +-- last_update.json               # Timestamp + Statistiken
|   +-- events_detail/                 # Detail-JSONs pro Namespace (272 Dateien)
|   +-- localisation/                  # Loc-Keys pro Sprache (7 Dateien)
|   +-- tech/                          # Techtree-Assets (aus git09)
|   +-- flags/trek/                   # Empire-Flaggen (79 WebP)
|
+-- pictures/                          # [GENERIERT] WebP Event-Bilder (991 Dateien)
|
+-- icons/                             # Item-Icons (15 Kategorien, 5.901 WebP)
|   +-- tech/                          # 1.659 Tech-Icons (WebP, aus git09)
|   +-- buildings/                     # 754 Building-Icons (WebP)
|   +-- traits/                        # 1.106 Trait-Icons (WebP)
|   +-- traditions/                    # 407 Traditions-Icons (WebP)
|   +-- ascension_perks/               # 66 Ascension-Perk-Icons (WebP)
|   +-- civics/                        # 330 Civic-Icons (WebP)
|   +-- authorities/                   # 154 Authority-Icons (WebP)
|   +-- jobs/                          # 267 Job-Icons (WebP)
|   +-- deposits/                      # 474 Deposit-Icons (WebP)
|   +-- relics/                        # 138 Relic-Icons (WebP)
|   +-- edicts/                        # 4 Edict-Icons (WebP)
|   +-- policies/                      # 11 Policy-Icons (WebP)
|   +-- councilors/                    # 20 Councilor-Icons (WebP)
|   +-- flags/                         # 486 Flag-Icons (WebP)
|   +-- unlock_types/                  # 25 Unlock-Type-Icons (WebP)
|   +-- tech_icon_mappings.json        # Icon-Name -> Datei-Mapping
|
+-- fonts/                             # Star Trek Schriftarten
|   +-- federation-ds9-title.TTF
|   +-- Tungsten-Light.ttf
|
+-- js/                                # Frontend JavaScript (59 Dateien)
|   +-- common.js                      # Shared: Theme, Font, Lang, Nav, Hamburger, GlobalSearch
|   +-- data.js                        # DataManager - Asynchrones JSON-Laden + Cache
|   +-- state.js                       # AppState - URL-synchronisierter State
|   +-- i18n.js                        # Internationalisierung (7 Sprachen)
|   +-- ui-strings.js                  # UI-String-Definitionen (310+ Keys)
|   +-- global-search.js               # GlobalSearch - Cross-Module Prefix-Suche
|   +-- search.js                      # SearchEngine - Event-spezifische Suche
|   +-- filters.js                     # Filter-Pipeline (AND-Logik, Events)
|   +-- chain-index.js                 # Chain-Index (Connected Components)
|   +-- render.js                      # Event HTML-Rendering (Cards + Detail)
|   +-- humanize.js                    # PDX-Syntax -> lesbarer Text
|   +-- shared-render.js               # Gemeinsames Rendering fuer Content-Module
|   +-- ship-viewer.js                 # 3D Ship Viewer (Three.js, lazy-loaded)
|   +-- pages/                         # 14 Seiten-Controller
|   |   +-- hub.js                     # Hub: Stats, GlobalSearch Full-Results
|   |   +-- events.js                  # Events: Filter, Sidebar, Detail, Chains
|   |   +-- exploration.js             # Exploration: Tabs (Anomalies/Archaeology)
|   |   +-- ships.js                   # Ships: Tabs (Ships/Components), Filter, Detail
|   |   +-- buildings.js               # Buildings: Tabs (Buildings/Districts), Filter
|   |   +-- traits.js                  # Traits: Tabs (Traits/Traditions/Perks), Filter
|   |   +-- governments.js             # Govs: Tabs (Govs/Civics/Auth/Policies/Edicts/Traits)
|   |   +-- megastructures.js          # Megas: Tabs (Megastructures/Relics)
|   |   +-- empires.js                 # Empires: Tabs (Empires/Species/Traits)
|   |   +-- economy.js                 # Economy: Tabs (Buildings/Districts/Jobs/Resources/Megas/Relics)
|   |   +-- economy-hub.js            # Economy Hub Controller
|   |   +-- galaxy-map.js             # Galaxy Map: Empire-Startpositionen (Canvas)
|   |   +-- tech-list.js              # Tech-List: Tabellarische Tech-Uebersicht
|   +-- ui/                            # 5 UI-Komponenten
|   |   +-- event-list.js              # Paginierte Event-Liste
|   |   +-- event-detail.js            # Event-Detailansicht
|   |   +-- namespace-nav.js           # Sidebar-Navigation
|   |   +-- chain-viewer.js            # Event-Chain-Visualisierung
|   |   +-- category-chips.js          # Chip-Bar Filter (Ships, Buildings)
|   +-- tech/                          # 27 Tech-Module (aus git09)
|       +-- main.js                    # Einstiegspunkt (ES Module)
|       +-- canvas-renderer.js         # Canvas-basierter Tech-Renderer
|       +-- force-worker.js            # Web Worker fuer Force-Layout
|       +-- data.js, render.js, filters.js, search.js, state.js, factions.js
|       +-- ui/                        # Tech UI-Komponenten
|           +-- events.js, zoom.js, tabs.js, tiers.js, popup.js, ...
|           +-- worker-physics.js      # Web Worker Physics-Engine
|           +-- layouts/               # 5 Layout-Engines (force, grid, tier, arrows, disjoint)
|
+-- update/                            # Python Daten-Pipeline (84 Dateien: 57 core + 27 techtree)
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
|   +-- parse_councilors.py            # Councilors
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
|   +-- generate_governments_json.py   # Govs + Civics + Auth + Policies + Edicts + Councilors JSON
|   +-- generate_megastructures_json.py# Megastructures + Relics JSON
|   +-- generate_anomalies_json.py     # Anomalies + Archaeology JSON
|   +-- generate_empires_json.py       # Empires + Species JSON
|   +-- generate_economy_json.py       # Jobs + Deposits JSON
|   +-- generate_search_index.py       # Cross-Module Suchindex
|   +-- generate_cross_references.py   # Bidirektionale Cross-Refs
|   +-- generate_galaxy_map_json.py   # Galaxy-Map Startpositionen
|   +-- generate_tech_item_map.py     # Tech -> Item Cross-Reference Map
|   +-- generate_changes_json.py      # Aenderungs-Tracking (changes.json, changes_history.json)
|   +-- inject_missing_loc.py           # Fehlende Loc-Keys aus loc_audit injizieren
|   +-- split_localisation.py          # Localisation-Splitting pro Modul
|   +-- diff_tracker.py                # Aenderungs-Tracking zwischen Pipeline-Laeufen
|   +-- convert_images.py              # DDS -> WebP Konvertierung (Event-Bilder)
|   +-- convert_icons.py               # DDS -> WebP Konvertierung (allgemein)
|   +-- convert_building_icons.py     # DDS -> WebP Konvertierung (Building-Icons)
|   +-- convert_ship_models.py        # PdxMesh -> GLB 3D-Modelle
|   +-- pdx_mesh_reader.py            # Binaer-Parser fuer PdxMesh (.mesh)
|   +-- data/                          # Statische Daten fuer Pipeline
|   |   +-- missing_loc.json           # 101 fehlende Loc-Keys pro Sprache
|   +-- techtree/                      # Techtree-Pipeline (27 Scripts, aus git09, NOCH NICHT LAUFFAEHIG)
|
+-- docs/                              # Projekt-Dokumentation
|   +-- ARCHITECTURE.md                # System-Architektur + Design-Prinzipien
|   +-- PIPELINE.md                    # Python Daten-Pipeline
|   +-- FRONTEND.md                    # Frontend JS-Module + Page-Skeleton + Design-System
|   +-- FILE_STRUCTURE.md              # Diese Datei
|   +-- ASSETS.md                      # Generierte Assets + Quell-Verzeichnisse
|   +-- HUMANIZE.md                    # Humanize-Engine: Maps, Modifier, Scopes, Erweiterung
|   +-- DEVELOPMENT.md                 # Lokale Entwicklung + Erweiterung + Wartung
|
+-- index.html                         # Hub / Landing Page
+-- events.html                        # Event Browser
+-- tech.html                          # Tech Tree (D3.js, eigenes Inline-CSS)
+-- tech-list.html                     # Tech-Liste (tabellarische Uebersicht)
+-- ships.html                         # Schiffe & Komponenten
+-- governments.html                   # Regierung, Civics, Auth, Policies, Edicts, Councilors, Traditions, Perks
+-- exploration.html                   # Anomalien & Archaeologie
+-- empires.html                       # Fraktionen, Leader Traits (Species versteckt)
+-- economy.html                       # Buildings, Districts, Jobs, Deposits, Megastructures, Relics
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
+-- DOCUMENTATION.md                   # Ausfuehrliche Doku (Legacy, verweist auf docs/)
+-- TODO.md                            # Master-Projektplan (12 Phasen + Backlog)
+-- .gitignore
```

## Quell-Verzeichnisse in git01 (Mod, READ-ONLY)

```
git01/New-Horizons-Development/
+-- events/                   430 Dateien (PDX-Syntax)
+-- localisation/
|   +-- english/              .yml-Dateien (~200k Keys)
|   +-- german/
|   +-- french/
|   +-- spanish/
|   +-- russian/
|   +-- polish/
|   +-- braz_por/
+-- interface/                45 .gfx-Dateien (7.338 Sprites)
+-- gfx/event_pictures/       DDS-Quelldateien
+-- common/
|   +-- on_actions/           18 Dateien
|   +-- event_chains/         19 Dateien
|   +-- ship_sizes/           47 Dateien
|   +-- component_templates/  97 Dateien
|   +-- buildings/            36 Dateien
|   +-- districts/
|   +-- traits/               50 Dateien
|   +-- traditions/           38 Dateien
|   +-- ascension_perks/      2 Dateien
|   +-- governments/          27 Dateien (+authorities/, +civics/)
|   +-- policies/
|   +-- edicts/
|   +-- megastructures/       51 Dateien
|   +-- relics/               16 Dateien
|   +-- anomalies/
|   +-- archaeological_site_types/
|   +-- pop_jobs/             31 Dateien
|   +-- deposits/             27 Dateien
|   +-- species_classes/
|   +-- species_archetypes/
+-- prescripted_countries/    Empires
```
