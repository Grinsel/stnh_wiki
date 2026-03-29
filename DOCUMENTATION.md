# STNH Wiki - Projektdokumentation

Vollständige technische Dokumentation des Star Trek: New Horizons Wiki.
Eine modulare Multi-Page-Website zur Darstellung aller spielrelevanten Daten des STNH Stellaris-Mods.

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Verzeichnisstruktur](#2-verzeichnisstruktur)
3. [Daten-Pipeline (Python)](#3-daten-pipeline-python)
4. [Frontend (HTML/CSS/JS)](#4-frontend-htmlcssjs)
5. [Generierte Assets](#5-generierte-assets)
6. [Deployment (GitHub Pages)](#6-deployment-github-pages)
7. [Update-Workflow](#7-update-workflow)
8. [Konfiguration anpassen](#8-konfiguration-anpassen)
9. [Erweiterung & Wartung](#9-erweiterung--wartung)

---

## 1. Projektübersicht

| Eigenschaft | Wert |
|---|---|
| Events | ~8.867 |
| Event-Dateien | 430 (0 Parse-Fehler) |
| Namespaces | 287 (272 Detail-JSONs) |
| Sprachen | 7 (EN, DE, FR, ES, RU, PL, BR-PT) |
| Loc-Keys | ~200.000+ pro Sprache |
| GFX Sprites | 3.960 gesamt, ~728 Event-Bilder |
| Pipeline-Laufzeit | ~9 Sekunden (ohne Bilder) |
| Frontend | Vanilla HTML/CSS/JS (kein Framework) |
| Deployment | GitHub Pages (automatisch bei push) |
| Abhängigkeiten | Keine (Python stdlib + ImageMagick für Bilder) |

### Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│  STNH Mod (git01/)                              [READ-ONLY] │
│  ├── events/*.txt            (430 Dateien, PDX-Syntax)      │
│  ├── localisation/{lang}/    (7 Sprachen, .yml)             │
│  ├── interface/*.gfx         (45 Dateien, Sprite-Defs)      │
│  ├── common/on_actions/      (18 Dateien)                    │
│  ├── common/event_chains/    (19 Dateien)                    │
│  └── gfx/event_pictures/     (DDS-Quelldateien)             │
└──────────────────────┬──────────────────────────────────────┘
                       │ Python Pipeline
                       │ ├── UPDATE_WIKI.py      (Gesamt-Updater)
                       │ ├── UPDATE_EVENTS.py    (Events-Modul)
                       │ ├── UPDATE_LOC.py       (Nur Localisation)
                       │ ├── UPDATE_GFX.py       (Nur GFX)
                       │ └── UPDATE_IMAGES.py    (Nur Bilder)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  STNH Wiki (git10/)                                          │
│  ├── index.html              (Hub / Landing Page)            │
│  ├── events.html             (Event Browser)                 │
│  ├── assets/                 (generierte JSON-Dateien)       │
│  ├── pictures/               (konvertierte WebP-Bilder)      │
│  ├── js/                     (Frontend-Module)               │
│  └── style.css               (Dark Theme)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ git push → GitHub Pages
                       ▼
              [ Live Website ]
```

### Phasen-System

Das Wiki wird modular aufgebaut. Jede Phase ist ein eigenständiges Modul:

| Phase | Modul | Status |
|---|---|---|
| 0 | Projekt-Grundlage (Skeleton, Pipeline, Frontend) | ✓ Fertig |
| 1 | Events (Event Browser Migration) | ✓ Fertig |
| 2 | Schiffe & Komponenten | ✓ Fertig |
| 3 | Gebäude & Distrikte | ✓ Fertig |
| 4 | Traits & Traditionen | ✓ Fertig |
| 5 | Regierung & Diplomatie | ✓ Fertig |
| 6 | Megastrukturen & Relics | Geplant |
| 7 | Anomalien & Archäologie | Geplant |
| 8 | Fraktionen & Empires | Geplant |
| 9 | Ressourcen & Wirtschaft | Geplant |
| 10 | Suche & Vernetzung (Cross-Module) | Geplant |
| 11 | Techtree (Kopie aus git09) | 11.1 Fertig (Kopie + Frontend) |

---

## 2. Verzeichnisstruktur

```
stnh_wiki/
│
├── .github/
│   └── workflows/
│       └── deploy.yml                 # GitHub Pages Auto-Deployment
│
├── assets/                            # [GENERIERT] JSON-Daten
│   ├── events_index.json              # Event-Index (2,6 MB)
│   ├── namespaces.json                # Namespace-Metadaten (44 KB)
│   ├── relationships.json             # Event-Trigger-Graph (636 KB)
│   ├── on_actions.json                # On-Action → Event Mappings (32 KB)
│   ├── event_chains.json              # Event-Chain-Definitionen (12 KB)
│   ├── pictures_map.json              # GFX-Name → Textur-Pfad (648 KB)
│   ├── last_update.json               # Timestamp + Phasen-Statistiken
│   ├── _no_namespace.json             # Events ohne Namespace
│   ├── events_detail/                 # Detail-JSONs pro Namespace (272 Dateien)
│   │   ├── STH_federation_flavour.json
│   │   ├── STH_klingon_story.json
│   │   └── ...
│   └── localisation/                  # Loc-Keys pro Sprache (7 Dateien)
│       ├── english.json               # ~200k Keys
│       ├── german.json
│       └── ...
│
├── pictures/                          # [GENERIERT] WebP Event-Bilder
│
├── icons/                             # Tech/Item-Icons
│   ├── tech/                          # 1.659 Tech-Icons (WebP, aus git09)
│   ├── unlock_types/                  # 25 Unlock-Type-Icons (WebP)
│   └── tech_icon_mappings.json        # Icon-Name → Datei-Mapping
│
├── fonts/                             # Star Trek Schriftarten
│   ├── federation-ds9-title.TTF
│   └── Tungsten-Light.ttf
│
├── js/                                # Frontend JavaScript
│   ├── tech/                          # Techtree JS-Module (aus git09)
│   │   ├── main.js                    # Einstiegspunkt → tech_showcase.js
│   │   ├── data.js                    # Daten-Laden (fetch assets/tech/*.json)
│   │   ├── render.js                  # D3.js Rendering + LOD
│   │   ├── filters.js                 # Filter-Logik
│   │   ├── search.js, state.js, factions.js
│   │   └── ui/                        # UI-Komponenten + Layouts
│   ├── common.js                      # Gemeinsame Hilfsfunktionen
│   ├── data.js                        # DataManager - Asynchrones Laden
│   ├── state.js                       # AppState - URL-synchronisierter State
│   ├── i18n.js                        # Mehrsprachigkeit (7 Sprachen)
│   ├── search.js                      # Volltextsuche mit Prefixen
│   ├── filters.js                     # Filterlogik (AND-Pipeline)
│   ├── render.js                      # HTML-Rendering (Cards + Detail)
│   ├── pages/                         # Seiten-Controller
│   │   ├── hub.js                     # Hub / Landing Page
│   │   └── events.js                  # Event Browser
│   └── ui/                            # UI-Komponenten
│       ├── event-list.js              # Paginierte Event-Liste
│       ├── event-detail.js            # Event-Detailansicht
│       ├── namespace-nav.js           # Sidebar-Navigation
│       └── chain-viewer.js            # Event-Chain-Visualisierung
│
├── update/                            # Python Daten-Pipeline
│   ├── techtree/                      # Techtree-Pipeline (27 Scripts, aus git09)
│   │   ├── UPDATE_TECHTREE_FULL.py    # Techtree Master-Script
│   │   ├── config.py                  # Pfade auf Wiki angepasst
│   │   ├── create_tech_json_new.py    # Hauptparser
│   │   ├── balance_center_bridge.py   # Benötigt balance_center/ (noch nicht lauffähig)
│   │   └── logs/                      # Techtree-Update-Logs
│   ├── UPDATE_WIKI.py                 # Master-Orchestrator (alle Phasen)
│   ├── UPDATE_EVENTS.py               # Modul-Updater: Events
│   ├── UPDATE_LOC.py                  # Modul-Updater: Localisation
│   ├── UPDATE_GFX.py                  # Modul-Updater: GFX-Mappings
│   ├── UPDATE_IMAGES.py               # Modul-Updater: Bildkonvertierung
│   ├── config.py                      # Pfade & Konfiguration
│   ├── parse_pdx.py                   # Rekursiver PDX-Parser
│   ├── parse_events.py                # Event-Extraktion
│   ├── parse_localisation.py          # Lokalisierungs-Parser
│   ├── parse_gfx_mappings.py          # GFX Sprite-Mappings
│   ├── parse_on_actions.py            # On-Action-Parser
│   ├── parse_event_chains.py          # Event-Chain-Parser
│   ├── build_relationships.py         # Trigger-Graph-Builder
│   ├── generate_events_json.py        # JSON-Generierung + Faction-Mapping
│   ├── convert_images.py              # DDS → WebP Konvertierung
│   └── requirements.txt               # Python-Abhängigkeiten
│
├── index.html                         # Hub / Landing Page
├── events.html                        # Event Browser
├── tech.html                          # Techtree (D3.js Visualisierung, aus git09)
├── tech_showcase.js                   # Techtree Legacy-Einstiegspunkt
├── tech_localisation_map.json         # Techtree Lokalisierung (21 MB)
├── tech_trigger_map.json              # Techtree Trigger-Map
├── pre_tree_bg.png                    # Techtree Hintergrundbild
├── style.css                          # Gemeinsames Dark Theme (16 KB)
│
├── UPDATE.bat                         # Gesamt-Update + Deploy
├── UPDATE_QUICK.bat                   # Gesamt-Update ohne Bilder + Deploy
├── UPDATE_EVENTS.bat                  # Events-Update
├── UPDATE_EVENTS_QUICK.bat            # Events-Update ohne Bilder
├── UPDATE_TECHTREE.bat                # Techtree-Pipeline starten
│
├── DOCUMENTATION.md                   # Diese Datei
├── TODO.md                            # Master-Projektplan (12 Phasen)
└── .gitignore
```

---

## 3. Daten-Pipeline (Python)

### 3.1 Master-Script: `UPDATE_WIKI.py`

Orchestriert alle Phasen der Datenverarbeitung:

```
Phase 1: Validation     → config.validate_paths()
Phase 2: Localisation   → parse_localisation.main()
Phase 3: GFX Mapping    → parse_gfx_mappings.main()
Phase 4: Events         → generate_events_json.generate_all()
Phase 5: Content        → Ships, Buildings, Traits, Governments
   5a: Ships            → generate_ships_json.generate_all()
   5b: Buildings        → generate_buildings_json.generate_all()
   5c: Traits           → generate_traits_json.generate_all()
   5d: Governments      → generate_governments_json.generate_all()
Phase 6: Images         → convert_images.convert_images()  [optional]
Phase 7: Summary        → Statistiken + last_update.json
```

**Aufruf:**
```bash
python UPDATE_WIKI.py                     # Vollständig (~9s + Bilder)
python UPDATE_WIKI.py --skip-images       # Ohne Bilder (~9s)
python UPDATE_WIKI.py --only events       # Nur Events-Modul
python UPDATE_WIKI.py --only ships        # Nur Ships & Components
python UPDATE_WIKI.py --only buildings    # Nur Buildings & Districts
python UPDATE_WIKI.py --only traits       # Nur Traits, Traditions, Ascension Perks
python UPDATE_WIKI.py --only governments  # Nur Governments, Civics, Policies, Edicts
python UPDATE_WIKI.py --only content      # Alle Content-Module (Ships+Buildings+Traits+Govs)
python UPDATE_WIKI.py --only loc          # Nur Localisation
python UPDATE_WIKI.py --only gfx          # Nur GFX-Mappings
python UPDATE_WIKI.py --only images       # Nur Bildkonvertierung
```

### 3.2 Modul-Updater

Für schnelle Einzelaktualisierungen stehen spezialisierte Updater bereit:

| Script | Phasen | Zweck |
|---|---|---|
| `UPDATE_EVENTS.py` | Validation → Loc → GFX → Events → Images | Komplettes Events-Update |
| `UPDATE_LOC.py` | Validation → Localisation | Nur Lokalisierung |
| `UPDATE_GFX.py` | Validation → GFX | Nur GFX-Mappings |
| `UPDATE_IMAGES.py` | Validation → Images | Nur Bildkonvertierung |

Jeder Modul-Updater:
- Führt `phase_validation()` aus (Pfade prüfen)
- Führt nur seine eigenen Phasen aus
- Schreibt eigenen Eintrag in `last_update.json` (merge, nicht überschreiben)
- Kann standalone aufgerufen werden: `python UPDATE_EVENTS.py`
- Unterstützt `--skip-images` wo relevant

### 3.3 Konfiguration: `config.py`

Zentrale Pfad- und Datendefinitionen:

```python
# === PFADE ANPASSEN ===

# Stellaris-Mod-Verzeichnis (Quelldaten, read-only)
STNH_MOD_ROOT = r"C:\Users\marcj\git01\New-Horizons-Development"

# Wiki Repository (Ausgabe)
WIKI_ROOT = r"C:\Users\marcj\git10\stnh_wiki"

# Automatisch abgeleitet:
MOD_EVENTS_DIR       = STNH_MOD_ROOT / "events"
MOD_LOCALISATION_DIR = STNH_MOD_ROOT / "localisation"
MOD_ON_ACTIONS_DIR   = STNH_MOD_ROOT / "common/on_actions"
MOD_EVENT_CHAINS_DIR = STNH_MOD_ROOT / "common/event_chains"
MOD_INTERFACE_DIR    = STNH_MOD_ROOT / "interface"
MOD_GFX_EVENT_PICTURES = STNH_MOD_ROOT / "gfx/event_pictures"

OUTPUT_ASSETS_DIR        = WIKI_ROOT / "assets"
OUTPUT_EVENTS_DETAIL_DIR = OUTPUT_ASSETS_DIR / "events_detail"
OUTPUT_LOCALISATION_DIR  = OUTPUT_ASSETS_DIR / "localisation"
OUTPUT_PICTURES_DIR      = WIKI_ROOT / "pictures"
OUTPUT_ICONS_DIR         = WIKI_ROOT / "icons"

# Sprachen (Unterordner in localisation/)
LANGUAGES = ['english', 'german', 'french', 'spanish',
             'russian', 'polish', 'braz_por']

# Event-Typen (PDX-Schlüsselwörter)
EVENT_TYPES = ['country_event', 'planet_event', 'fleet_event',
               'ship_event', 'pop_event', 'observer_event',
               'situation_event']

# Funktionen
validate_paths()  # Prüft ob alle Quellpfade existieren
print_config()    # Gibt Konfiguration aus
```

**Zum Anpassen für andere Systeme:** Nur `STNH_MOD_ROOT` und `WIKI_ROOT` ändern.

### 3.4 PDX-Parser: `parse_pdx.py`

Eigenentwickelter rekursiver Parser für Stellaris PDX-Syntax (nicht PLY-basiert).

**Warum kein PLY?** PLY hatte Probleme mit Error Recovery bei den vielen Sonderfällen der PDX-Syntax (Doppelpunkte in IDs, Operatoren, @Variablen).

**Architektur:**

```python
# Tokenizer
class PdxLexer:
    """Regex-basierter Tokenizer für PDX-Syntax."""
    # Token-Typen: COMMENT, STRING, OPERATOR (>=, <=, >, <, =),
    #              LBRACE, RBRACE, VARIABLE (@name), NUMBER, WORD
    def tokenize(text) → list[Token]

# Parser
class PdxParser:
    """Rekursiver Descent Parser."""
    def parse(text) → list[dict]
    # Erkennt automatisch:
    # - key = value       → {'key': 'value'}
    # - key = { ... }     → {'key': [nested...]}   (Block)
    # - { val1 val2 }     → [val1, val2]           (Liste)

# Hilfsfunktionen
def get_value(data, key, default=None)   # Einzelwert
def get_all_values(data, key)             # Alle Werte eines Keys
def get_blocks(data, key)                 # Alle Blöcke eines Keys
```

### 3.5 Event-Parser: `parse_events.py`

Extrahiert alle Events aus den 430 Event-Dateien.

```python
# Pro Event extrahierte Felder:
event = {
    'id':               'STH_federation_flavour.100',
    'type':             'country_event',
    'namespace':        'STH_federation_flavour',
    'source_file':      'STH_federation_flavour_events.txt',
    'title':            'STH_federation_flavour.100.name',
    'descriptions':     [{'text': 'loc_key', 'trigger': {...}}],
    'picture':          'GFX_evt_federation_council',
    'is_triggered_only': True,
    'hide_window':      False,
    'fire_only_once':   True,
    'diplomatic':       False,
    'trigger':          [...],
    'immediate':        [...],
    'after':            [...],
    'mean_time_to_happen': [...],
    'options':          [{
        'name': 'loc_key',
        'allow': [...],
        'trigger': [...],
        'ai_chance': [...],
        'effects': [...],
        'triggered_events': ['event.id1', 'event.id2']
    }],
    'triggered_events': ['event.id1', ...]
}
```

### 3.6 Lokalisierungs-Parser: `parse_localisation.py`

```python
def main() → (loc_data, stats):
    """Parst .yml-Dateien aller 7 Sprachen.
    Regex: key:0 "value" oder key: "value"
    Encoding: UTF-8-SIG mit latin-1 Fallback
    Format-Codes (§R, §W, etc.) werden entfernt.
    $key$-Referenzen werden rekursiv aufgelöst.
    Loop-Protection verhindert Endlos-Rekursion."""
```

**Bekanntes Problem:** Einige `.yml`-Dateien haben Encoding-Probleme. Der Parser versucht zuerst UTF-8-SIG, dann latin-1 als Fallback.

### 3.7 GFX-Mapping-Parser: `parse_gfx_mappings.py`

```python
def main() → {sprite_name: {texturefile, frames}}
    """Parst 45 .gfx-Dateien, extrahiert spriteType und
    frameAnimatedSpriteType Blöcke.
    Ergebnis: 3.960 Sprites, davon ~728 Event-Bilder."""
```

### 3.8 On-Actions-Parser: `parse_on_actions.py`

```python
def parse_on_actions() → {on_action_name: [event_ids]}
    """Parst 18 On-Action-Dateien.
    Unterstützt: events = { id1 id2 } und
                 country_event = { id = X }"""
```

### 3.9 Event-Chains-Parser: `parse_event_chains.py`

```python
def parse_event_chains() → {chain_id: {title, desc, picture, icon, counters}}
    """Parst 19 Event-Chain-Dateien."""
```

### 3.10 JSON-Generierung: `generate_events_json.py`

Zentrale Datei für die Ausgabe-Generierung. Enthält auch die **Faction-Zuordnung**.

```python
FACTION_PATTERNS = {
    'federation': ['federation', 'fed_', 'starfleet', 'earth_', 'human_'],
    'klingon':    ['klingon', 'klg_'],
    'romulan':    ['romulan', 'rom_', 'reman'],
    'cardassian': ['cardassian', 'card_'],
    'dominion':   ['dominion'],
    'borg':       ['borg'],
    'ferengi':    ['ferengi'],
    'bajoran':    ['bajor'],
    ...
    'generic':    [],  # Fallback
}

def detect_faction(namespace) → str
def detect_category(namespace, source_file) → str
def generate_all() → stats
```

**Neue Faction hinzufügen:**
1. Neuen Eintrag in `FACTION_PATTERNS` hinzufügen
2. Pattern-Strings sind Teilstring-Matches auf den lowercased Namespace-Namen
3. Frontend erkennt neue Factions automatisch (keine Änderung nötig)

### 3.11 Beziehungs-Graph: `build_relationships.py`

```python
def build_relationships(events) → {event_id: {triggers: [...], triggered_by: [...]}}
    """Baut bidirektionalen Trigger-Graph.
    Berücksichtigt: Event-Level und Option-Level triggered_events."""
```

### 3.12 Bildkonvertierung: `convert_images.py`

```python
def convert_images() → stats:
    """Konvertiert Event-referenzierte DDS-Bilder zu WebP.
    Benötigt: ImageMagick (magick convert)

    - Animierte Sprites (frames > 1): Erster Frame wird zugeschnitten
    - Einzelbilder: Direkte Konvertierung
    - Resize: 480px Breite, proportionale Höhe, Qualität 80
    - Nur neue/geänderte Bilder werden konvertiert (Timestamp-Check)"""
```

**Voraussetzung:** [ImageMagick](https://imagemagick.org/) muss installiert sein (`magick` im PATH). Wird bei `--skip-images` übersprungen.

---

## 4. Frontend (HTML/CSS/JS)

### 4.1 Seitenstruktur

Multi-Page-Website ohne Build-Tools, Frameworks oder npm. Vanilla HTML/CSS/JS.

| Seite | Datei | Beschreibung |
|---|---|---|
| Hub | `index.html` | Landing Page mit Navigation zu allen Modulen |
| Events | `events.html` | Event Browser mit Filter, Suche, Detail-Panel |
| Tech Tree | `tech.html` | Interaktiver Techtree (D3.js, ~2.600 Techs, eigenes CSS/JS) |
| Ships | `ships.html` | Ship sizes & component templates, Tab-Umschaltung, Filter |
| Buildings | `buildings.html` | Buildings & districts, Kategorie-Filter |
| Traits | `traits.html` | Traits, traditions & ascension perks, Class/Tree-Filter |
| Governments | `governments.html` | Governments, civics, authorities, policies, edicts |

Zukünftige Seiten: `megastructures.html`, `anomalies.html`, etc.

### 4.2 Shared Module

#### `js/data.js` - DataManager

Asynchrones Laden und Caching aller Daten.

```javascript
const DataManager = (() => {
    loadInitial()              // → Promise: events_index + namespaces + pictures_map
    loadNamespaceDetail(ns)    // → Promise: Lazy-Load Detail-JSON
    loadLocalisation(lang)     // → Promise: Lazy-Load Sprachdatei
    loadRelationships()        // → Promise: Trigger-Graph
    loadOnActions()            // → Promise: On-Action-Mappings
    loadEventChains()          // → Promise: Event-Chains

    getIndex()                 // → events_index Daten
    getNamespaces()            // → namespaces Daten
    getPictureUrl(gfxName)     // → WebP-Pfad oder null
})();
```

#### `js/state.js` - AppState

URL-synchronisierter State mit localStorage-Persistenz.

```javascript
const AppState = (() => {
    // State-Felder (URL-Parameter):
    // search, type, faction, category, namespace,
    // showHidden, triggeredOnly, page, lang, selectedEvent, sort

    init()                     // URL-Parameter lesen
    get(key)                   // Wert lesen
    set(key, value)            // Wert setzen + URL aktualisieren
    setMultiple(updates)       // Mehrere Werte + URL
    onChange(callback)          // Listener registrieren
})();
```

#### `js/i18n.js` - Internationalisierung

```javascript
const I18n = (() => {
    setLanguage(lang)          // Sprachdatei laden
    t(key)                     // Übersetzen (Fallback: Key selbst)
    getLang()                  // Aktuelle Sprache
})();
```

#### `js/search.js` - SearchEngine

```javascript
const SearchEngine = (() => {
    search(query, events)      // → Gefilterte Events
    highlightText(text, query) // → HTML mit <mark>-Tags

    // Such-Modi:
    // "id:xyz"      → Event-ID-Suche
    // "ns:xyz"      → Namespace-Suche
    // "faction:xyz" → Faction-Suche
    // "xyz abc"     → Multi-Term AND über id, name, ns, snippet
})();
```

#### `js/common.js` - Gemeinsame Hilfsfunktionen

Utility-Funktionen die von mehreren Modulen genutzt werden.

### 4.3 Event-Module

#### `js/filters.js` - Filter-Pipeline

```javascript
const Filters = (() => {
    apply(events, state)       // → Gefilterte Events (AND-Logik)
    populateDropdowns(events)  // → Dropdowns aus Daten befüllen
    // Pipeline: Type → Faction → Category → Hidden → Search → Namespace
})();
```

#### `js/render.js` - HTML-Rendering

```javascript
const Render = (() => {
    eventCard(event, query)    // → HTML für Event-Karte
    eventDetail(event, rels)   // → HTML für Detailansicht
    // Detail enthält: Bild, Meta-Badges, Beschreibungen,
    // Trigger, Immediate, Options, After, MTTH, Beziehungen
})();
```

#### `js/ui/event-list.js` - Paginierte Event-Liste (100 pro Seite)
#### `js/ui/event-detail.js` - Event-Detailansicht mit allen Feldern
#### `js/ui/namespace-nav.js` - Sidebar mit Faction-Gruppierung
#### `js/ui/chain-viewer.js` - Event-Chain-Visualisierung (rekursiver Tree-Build)

### 4.4 Page-Controller

#### `js/pages/hub.js` - Hub / Landing Page

Initialisiert die Landing Page mit Navigationslinks zu allen Wiki-Modulen.

#### `js/pages/events.js` - Event Browser

Initialisiert den Event Browser:
- DataManager.loadInitial()
- I18n.setLanguage(default)
- Event-Namen aus Loc-Keys auflösen
- Filter-Dropdowns befüllen
- Namespace-Sidebar rendern
- EventDetail + ChainViewer init
- Initiales Rendering

### 4.5 Design-System (`style.css`)

```css
/* Basis-Schriftgröße (dynamisch per JS steuerbar) */
html { font-size: var(--base-font-size, 118%); }

/* Farbschema */
--bg:      #111111        /* Hintergrund */
--text:    #e4e7eb        /* Text */
--accent:  #d1ce04        /* Gold (Primär) */
--surface: #1a1a1a        /* Karten-Hintergrund */

/* Event-Typ-Farben */
country:   #4a9eff  (Blau)
ship:      #4aff7a  (Grün)
planet:    #c97a3a  (Orange)
fleet:     #ff9a4a  (Hell-Orange)
situation: #a64aff  (Lila)
observer:  #ff4a8a  (Pink)
pop:       #4affc8  (Cyan)

/* Schriftarten */
federation-ds9-title.TTF    /* Star Trek Überschriften */
Tungsten-Light.ttf          /* Badges und Labels */

/* Responsive Breakpoints */
@media (max-width: 1200px)  /* Sidebar verstecken */
@media (max-width: 921px)   /* Detail-Panel untendrunter */
@media (max-width: 544px)   /* Mobile Layout */
```

### Event Browser Layout

```
┌──────────────────────────────────────────────────┐
│ Header: Logo | Suchfeld | Sprach-Dropdown | Text ±│
├──────────────────────────────────────────────────┤
│ Filter-Bar: Typ | Faction | Kategorie | Toggles  │
├────────┬─────────────────────────┬───────────────┤
│ Side-  │ Event-Liste             │ Event-Detail  │
│ bar    │ (paginiert, 100/Seite)  │ (sticky)      │
│        │                         │               │
│ Fac-   │ [Card] [Card] [Card]    │ Bild          │
│ tions  │ [Card] [Card] [Card]    │ Meta-Badges   │
│  └ NS  │ [Card] [Card] [Card]    │ Beschreibung  │
│  └ NS  │                         │ Trigger       │
│        │ Pagination              │ Optionen      │
│        │                         │ Effekte       │
├────────┴─────────────────────────┴───────────────┤
│ Footer                                            │
└──────────────────────────────────────────────────┘
```

---

## 5. Generierte Assets

| Datei | Größe | Inhalt |
|---|---|---|
| `events_index.json` | 2,6 MB | Alle Events (kompakt): id, name, type, ns, pic, snippet, flags |
| `events_detail/{ns}.json` | ~4 MB | Volle Event-Daten pro Namespace (272 Dateien) |
| `namespaces.json` | 44 KB | Namespace → faction, category, source_files, event_count |
| `relationships.json` | 636 KB | Event-Trigger-Graph (bidirektional) |
| `on_actions.json` | 32 KB | on_action → [event_ids] |
| `event_chains.json` | 12 KB | Chain-Definitionen |
| `pictures_map.json` | 648 KB | GFX-Name → {texturefile, frames} (3.960 Sprites) |
| `localisation/{lang}.json` | ~100 KB | Loc-Keys pro Sprache (~200k Keys) |
| `last_update.json` | ~1 KB | Timestamp + Phasen-Statistiken |
| `pictures/*.webp` | ~6 MB | WebP-Bilder (480×204, Q80) |

---

## 6. Deployment (GitHub Pages)

### `.github/workflows/deploy.yml`

```yaml
on:
  push:
    branches: [master]
  workflow_dispatch:        # Manuell auslösbar

jobs:
  deploy:
    permissions:
      pages: write
      id-token: write
      contents: read
    steps:
      - Checkout
      - Setup Pages
      - Upload artifact (ganzes Repo)
      - Deploy to GitHub Pages

concurrency:
  group: "pages"            # Nur ein Deployment gleichzeitig
```

**Trigger:** Jeder Push auf `master` startet automatisch das Deployment. Manuell über GitHub Actions "Run workflow" möglich.

---

## 7. Update-Workflow

### Gesamt-Update (mit Bildern)

```
UPDATE.bat per Doppelklick starten
  │
  ├── python UPDATE_WIKI.py
  │   ├── Phase 1: Pfade validieren
  │   ├── Phase 2: 7 Sprachen parsen
  │   ├── Phase 3: GFX Sprites parsen
  │   ├── Phase 4: Events parsen + JSON generieren
  │   ├── Phase 5: Content Module (Stub)
  │   ├── Phase 6: Bilder konvertieren (DDS → WebP)
  │   └── Phase 7: Zusammenfassung
  │
  ├── git add assets/ pictures/ icons/ fonts/
  ├── git commit -m "Update STNH Wiki - {datum}"
  └── git push → GitHub Pages Deployment
```

### Schnell-Update (ohne Bilder)

```
UPDATE_QUICK.bat per Doppelklick starten
  │
  ├── python UPDATE_WIKI.py --skip-images
  ├── git add assets/
  ├── git commit -m "Update STNH Wiki (quick) - {datum}"
  └── git push
```

### Modul-Update (nur Events)

```
UPDATE_EVENTS.bat per Doppelklick starten
  │
  └── python UPDATE_EVENTS.py
      ├── Phase 1: Pfade validieren
      ├── Phase 2: Localisation parsen
      ├── Phase 3: GFX Sprites parsen
      ├── Phase 4: Events parsen + JSON generieren
      └── Phase 6: Bilder konvertieren
```

### Modul-Update ohne Bilder

```
UPDATE_EVENTS_QUICK.bat per Doppelklick starten
  │
  └── python UPDATE_EVENTS.py --skip-images
```

### Selektive Updates via Master-Script

```bash
python UPDATE_WIKI.py --only events       # Wie UPDATE_EVENTS.py
python UPDATE_WIKI.py --only loc          # Nur Localisation
python UPDATE_WIKI.py --only gfx          # Nur GFX-Mappings
python UPDATE_WIKI.py --only images       # Nur Bildkonvertierung
python UPDATE_WIKI.py --only events --skip-images  # Events ohne Bilder
python UPDATE_WIKI.py --only techtree             # Techtree (stub - zeigt Hinweis)
```

---

## 8. Konfiguration anpassen

### Anderes System / andere Pfade

Nur `update/config.py` ändern:

```python
# Diese beiden Pfade anpassen:
STNH_MOD_ROOT = r"D:\Games\Stellaris\mod\stnh"       # Mod-Verzeichnis
WIKI_ROOT = r"D:\Projects\stnh_wiki"                  # Wiki-Repo
```

### Neue Sprache hinzufügen

1. `config.py`: Sprache zu `LANGUAGES` und `LANGUAGE_SUFFIXES` hinzufügen
2. Sicherstellen, dass `localisation/{neue_sprache}/` im Mod existiert
3. `events.html`: `<option>` zum Sprach-Dropdown hinzufügen

### Neue Faction hinzufügen

1. `generate_events_json.py`: Eintrag zu `FACTION_PATTERNS` hinzufügen:
   ```python
   'neue_faction': ['pattern1', 'pattern2'],
   ```
2. Frontend erkennt neue Factions automatisch (dynamische Sidebar)

### Neuen Event-Typ unterstützen

1. `config.py`: Typ zu `EVENT_TYPES` hinzufügen
2. `style.css`: Farbe für neuen Typ definieren:
   ```css
   .type-badge.neuer_event { background: #farbe; }
   ```

### Schriftgröße anpassen

- **Benutzer:** Text −/+ Buttons im Header
- **Entwickler:** Default in `style.css`:
  ```css
  html { font-size: var(--base-font-size, 118%); }
  ```
- **Bereich:** 90% – 160% (in 10%-Schritten)
- **Persistenz:** `localStorage`

### Bilder-Qualität / Größe ändern

In `convert_images.py` die ImageMagick-Parameter anpassen:
- Zielbreite: `480` (resize Parameter, Höhe proportional)
- Qualität: `80` (quality Parameter)

---

## 9. Erweiterung & Wartung

### Neues Modul hinzufügen (Pipeline)

1. Neue Datei `update/parse_neues_ding.py` erstellen
2. Funktion `main() → data` implementieren (parse_pdx.py als Basis nutzen)
3. In `UPDATE_WIKI.py` neue Phase einbinden
4. JSON-Ausgabe in `assets/` generieren
5. Optional: Eigenen Modul-Updater `UPDATE_NEUES_DING.py` erstellen

### Neues Modul hinzufügen (Frontend)

1. Neue HTML-Seite erstellen (z.B. `ships.html`)
2. Page-Controller `js/pages/ships.js` erstellen
3. Modul als IIFE (Revealing Module Pattern):
   ```javascript
   const ShipsPage = (() => {
       function init() { ... }
       function render() { ... }
       return { init, render };
   })();
   ```
4. In HTML einbinden (shared modules + page-specific modules)
5. Navigation im Hub (`index.html`) aktualisieren

### Häufige Wartungsaufgaben

| Aufgabe | Datei(en) |
|---|---|
| Faction falsch zugeordnet | `generate_events_json.py` → `FACTION_PATTERNS` |
| Neue Events werden nicht erkannt | `parse_pdx.py` (Parser-Fehler?) oder `parse_events.py` |
| Bilder fehlen | `parse_gfx_mappings.py` + `convert_images.py` prüfen |
| Lokalisierung fehlt/falsch | `parse_localisation.py` (Encoding? $key$-Referenzen?) |
| Filter funktioniert nicht | `js/filters.js` |
| Styling anpassen | `style.css` |

### Abhängigkeiten

| Abhängigkeit | Version | Zweck | Erforderlich? |
|---|---|---|---|
| Python | 3.8+ | Pipeline | Ja |
| ImageMagick | 7+ | DDS→WebP | Nur für Bilder |
| Git | - | Deployment | Ja |
| npm/Node | - | - | Nicht benötigt |
