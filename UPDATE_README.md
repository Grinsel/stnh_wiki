# STNH Wiki — Update-Pipeline

> Dokumentation der automatisierten Update-Pipeline, die Mod-Daten aus *Star Trek: New Horizons* extrahiert und als statische Website bereitstellt.

## Ueberblick

```
Stellaris Mod (git01)  →  Python Pipeline  →  JSON Assets  →  Statische Website (GitHub Pages)
```

Die Pipeline liest Rohdaten aus dem Mod-Repository (Events, Lokalisierung, GFX-Definitionen, Technologien, Schiffe, Gebaeude etc.), verarbeitet sie mit Python-Skripten und erzeugt JSON-Dateien. Die Website laedt diese JSON-Dateien und stellt sie als interaktive Seiten dar — ohne Backend, rein clientseitig.

## Voraussetzungen

- **Python 3.8+** mit Standardbibliothek (keine externen Pakete fuer die Hauptpipeline)
- **Mod-Repository** (`git01/New-Horizons-Development`) — Pfad in `update/config.py` konfiguriert
- **Balance Center** (optional) — nur fuer Techtree-Modul erforderlich, Pfad ebenfalls in `update/config.py`
- **ImageMagick** (optional) — nur fuer Bildkonvertierung (DDS → WebP)

## Batch-Dateien

Alle Batch-Dateien liegen im Wiki-Root und koennen per Doppelklick ausgefuehrt werden.

| Datei | Beschreibung |
|-------|-------------|
| `UPDATE.bat` | Vollstaendiges Update aller Module inkl. Bildkonvertierung, dann `git commit + push` |
| `UPDATE_QUICK.bat` | Wie `UPDATE.bat`, aber ohne Bildkonvertierung (`--skip-images`) — deutlich schneller |
| `UPDATE_EVENTS.bat` | Nur Events-Modul (Localisation → GFX → Events → Bilder), dann `git commit + push` |
| `UPDATE_EVENTS_QUICK.bat` | Nur Events-Modul ohne Bildkonvertierung (`--skip-images`) |
| `UPDATE_TECHTREE.bat` | Nur Techtree-Modul (`UPDATE_TECHTREE_FULL.py`), dann `git commit + push` |
| `SERVE.bat` | Startet einen lokalen Webserver auf Port 8000 zum Testen (`python -m http.server`) |

## Pipeline-Phasen

Die vollstaendige Pipeline (`UPDATE_WIKI.py`) durchlaeuft folgende Phasen:

| # | Phase | Was wird extrahiert | Zahlen (letzter Lauf) |
|---|-------|--------------------|-----------------------|
| 1 | **Validation** | Pfade + Dependencies pruefen | — |
| 2 | **Localisation** | 7 Sprachen aus `localisation/*.yml` | ~240.000 Keys/Sprache |
| 3 | **GFX Mappings** | Sprite-Definitionen aus `interface/*.gfx` | ~7.300 Sprites, ~1.500 Event-Bilder |
| 4 | **Events** | Alle Events aus `events/*.txt` | 8.867 Events, 430 Dateien, 287 Namespaces, 7.057 Beziehungen |
| 5a | **Ships & Components** | Schiffe, Komponenten, 3D-Modelle | 423 Schiffe, 6.406 Komponenten, 1.387 Fraktionsvarianten |
| 5b | **Buildings & Districts** | Gebaeude + Distrikte | 653 Gebaeude, 56 Distrikte |
| 5c | **Traits, Traditions, Ascension Perks** | Eigenschaften, Traditionen, Aufstiegsvorteile | 470 / 448 / 58 |
| 5d | **Governments & Policies** | Regierungen, Civics, Autoritaeten, Policies, Edikte | 185 / 332 / 17 / 53 / 86 |
| 5e | **Megastructures & Relics** | Megastrukturen + Relikte | 116 / 68 |
| 5f | **Anomalies & Archaeology** | Anomalien + Archaeologische Staetten | 132 / 29 |
| 5g | **Empires & Species** | Vorgefertigte Reiche + Spezies | 110 / 255 |
| 5h | **Galaxy Map** | Galaxiekarte mit Positionen + Flaggen | 105 platzierte Reiche |
| 5i | **Economy** | Jobs + Deposits | 309 / 667 |
| 6 | **Image Conversion** | DDS → WebP (Event-Bilder, Gebaeude-Icons, Schiffsmodelle) | nur bei Aenderungen |
| 7 | **Techtree** | Technologien (3 Bereiche), Fraktionen, Icons | 1.991 Technologien (739 Physik, 634 Engineering, 618 Gesellschaft) |
| 8 | **Search Index** | Suchindex + Cross-References + Tech-Item-Map | ~21.000 Items |

## `--only` Optionen

Einzelne Module koennen gezielt aktualisiert werden:

```bash
python UPDATE_WIKI.py --only <modul>
```

| Modul | Fuehrt aus |
|-------|-----------|
| `events` | Localisation → GFX → Events → Bilder |
| `loc` | Nur Localisation |
| `gfx` | Nur GFX Mappings |
| `images` | Nur Bildkonvertierung |
| `building_icons` | Nur Gebaeude-Icon-Konvertierung |
| `techtree` | Nur Techtree |
| `ships` | Localisation → Ships |
| `ship_models` | Localisation → Ships → 3D-Modell-Konvertierung |
| `buildings` | Localisation → Buildings → Building-Icons |
| `traits` | Localisation → Traits |
| `governments` | Localisation → Governments |
| `megastructures` | Localisation → Megastructures |
| `anomalies` | Localisation → Anomalies |
| `empires` | Localisation → Empires |
| `galaxy_map` | Nur Galaxy Map |
| `economy` | Localisation → Economy |
| `search` | Nur Search Index + Cross-References |
| `content` | Alle Content-Module + Search (ohne Events, Techtree, Bilder) |

## Inkrementelles Update

Jede Batch-Datei prueft nach der Pipeline-Ausfuehrung mit `git diff --cached --quiet`, ob tatsaechlich Aenderungen vorliegen. Nur wenn sich Dateien geaendert haben, wird ein Commit erstellt und gepusht. So werden leere Commits vermieden.

## Wartungshinweis

Wenn Module hinzukommen oder Batch-Dateien geaendert werden, muss diese Datei aktualisiert werden. Relevante Quellen:

- **Pipeline-Phasen**: `update/UPDATE_WIKI.py` (Phasen-Definitionen und `ONLY_MODULES` Dictionary)
- **Event-Pipeline**: `update/UPDATE_EVENTS.py`
- **Techtree-Pipeline**: `update/techtree/UPDATE_TECHTREE_FULL.py`
- **Batch-Dateien**: `*.bat` im Wiki-Root
- **Pfad-Konfiguration**: `update/config.py`

---

# STNH Wiki — Update Pipeline (English)

> Documentation of the automated update pipeline that extracts mod data from *Star Trek: New Horizons* and deploys it as a static website.

## Overview

```
Stellaris Mod (git01)  →  Python Pipeline  →  JSON Assets  →  Static Website (GitHub Pages)
```

The pipeline reads raw data from the mod repository (events, localisation, GFX definitions, technologies, ships, buildings, etc.), processes it with Python scripts, and produces JSON files. The website loads these JSON files and renders them as interactive pages — no backend, purely client-side.

## Requirements

- **Python 3.8+** with standard library (no external packages for the main pipeline)
- **Mod repository** (`git01/New-Horizons-Development`) — path configured in `update/config.py`
- **Balance Center** (optional) — only required for the techtree module, path also in `update/config.py`
- **ImageMagick** (optional) — only required for image conversion (DDS → WebP)

## Batch Files

All batch files are located in the wiki root and can be run by double-clicking.

| File | Description |
|------|-------------|
| `UPDATE.bat` | Full update of all modules including image conversion, then `git commit + push` |
| `UPDATE_QUICK.bat` | Same as `UPDATE.bat` but without image conversion (`--skip-images`) — significantly faster |
| `UPDATE_EVENTS.bat` | Events module only (Localisation → GFX → Events → Images), then `git commit + push` |
| `UPDATE_EVENTS_QUICK.bat` | Events module only without image conversion (`--skip-images`) |
| `UPDATE_TECHTREE.bat` | Techtree module only (`UPDATE_TECHTREE_FULL.py`), then `git commit + push` |
| `SERVE.bat` | Starts a local web server on port 8000 for testing (`python -m http.server`) |

## Pipeline Phases

The full pipeline (`UPDATE_WIKI.py`) runs through the following phases:

| # | Phase | What is extracted | Numbers (last run) |
|---|-------|-------------------|--------------------|
| 1 | **Validation** | Check paths + dependencies | — |
| 2 | **Localisation** | 7 languages from `localisation/*.yml` | ~240,000 keys/language |
| 3 | **GFX Mappings** | Sprite definitions from `interface/*.gfx` | ~7,300 sprites, ~1,500 event pictures |
| 4 | **Events** | All events from `events/*.txt` | 8,867 events, 430 files, 287 namespaces, 7,057 relationships |
| 5a | **Ships & Components** | Ships, components, 3D models | 423 ships, 6,406 components, 1,387 faction variants |
| 5b | **Buildings & Districts** | Buildings + districts | 653 buildings, 56 districts |
| 5c | **Traits, Traditions, Ascension Perks** | Traits, traditions, ascension perks | 470 / 448 / 58 |
| 5d | **Governments & Policies** | Governments, civics, authorities, policies, edicts | 185 / 332 / 17 / 53 / 86 |
| 5e | **Megastructures & Relics** | Megastructures + relics | 116 / 68 |
| 5f | **Anomalies & Archaeology** | Anomalies + archaeological sites | 132 / 29 |
| 5g | **Empires & Species** | Pre-made empires + species | 110 / 255 |
| 5h | **Galaxy Map** | Galaxy map with positions + flags | 105 placed empires |
| 5i | **Economy** | Jobs + deposits | 309 / 667 |
| 6 | **Image Conversion** | DDS → WebP (event pictures, building icons, ship models) | only on changes |
| 7 | **Techtree** | Technologies (3 areas), factions, icons | 1,991 technologies (739 Physics, 634 Engineering, 618 Society) |
| 8 | **Search Index** | Search index + cross-references + tech-item-map | ~21,000 items |

## `--only` Options

Individual modules can be updated selectively:

```bash
python UPDATE_WIKI.py --only <module>
```

| Module | Executes |
|--------|----------|
| `events` | Localisation → GFX → Events → Images |
| `loc` | Localisation only |
| `gfx` | GFX Mappings only |
| `images` | Image conversion only |
| `building_icons` | Building icon conversion only |
| `techtree` | Techtree only |
| `ships` | Localisation → Ships |
| `ship_models` | Localisation → Ships → 3D model conversion |
| `buildings` | Localisation → Buildings → Building Icons |
| `traits` | Localisation → Traits |
| `governments` | Localisation → Governments |
| `megastructures` | Localisation → Megastructures |
| `anomalies` | Localisation → Anomalies |
| `empires` | Localisation → Empires |
| `galaxy_map` | Galaxy Map only |
| `economy` | Localisation → Economy |
| `search` | Search Index + Cross-References only |
| `content` | All content modules + search (without events, techtree, images) |

## Incremental Updates

After running the pipeline, each batch file checks with `git diff --cached --quiet` whether any files have actually changed. A commit is only created and pushed if there are real changes, avoiding empty commits.

## Maintenance Note

When modules are added or batch files are modified, this file must be updated. Relevant sources:

- **Pipeline phases**: `update/UPDATE_WIKI.py` (phase definitions and `ONLY_MODULES` dictionary)
- **Event pipeline**: `update/UPDATE_EVENTS.py`
- **Techtree pipeline**: `update/techtree/UPDATE_TECHTREE_FULL.py`
- **Batch files**: `*.bat` in the wiki root
- **Path configuration**: `update/config.py`
