# Generierte Assets

Alle JSON-Dateien in `assets/` werden von der Python-Pipeline erzeugt und vom Frontend gelesen. **Nicht manuell editieren** — Aenderungen werden beim naechsten Pipeline-Lauf ueberschrieben.

## JSON-Assets (`assets/`)

| Datei | Groesse | Inhalt |
|---|---|---|
| `events_index.json` | 2,6 MB | Alle Events (kompakt): id, name, type, ns, pic, snippet, flags |
| `events_detail/{ns}.json` | ~4 MB | Volle Event-Daten (272 Dateien, ein JSON pro Namespace) |
| `namespaces.json` | 42 KB | Namespace -> faction, category, source_files, event_count |
| `relationships.json` | 637 KB | Event-Trigger-Graph (bidirektional) |
| `on_actions.json` | 30 KB | on_action -> [event_ids] |
| `event_chains.json` | 12 KB | Chain-Definitionen |
| `pictures_map.json` | 1,2 MB | GFX-Name -> {texturefile, frames} (7.338 Sprites) |
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
| `councilors.json` | 67 KB | Councilors: Civic-Zuordnung, Modifier, Leader-Klasse |
| `megastructures.json` | 160 KB | Megastrukturen: Stufen, Kosten, Effekte, Tech |
| `relics.json` | 61 KB | Relikte: Passive/Aktive Effekte, Cooldown |
| `anomalies.json` | 68 KB | Anomalien: Kategorie, Ergebnisse, Trigger |
| `archaeology.json` | 25 KB | Archaeologie: Kapitel, Belohnungen |
| `empires.json` | 115 KB | Reiche: Species, Ethik, Government, Origin |
| `species.json` | 74 KB | Spezies: Archetyp, Portraits |
| `jobs.json` | 219 KB | Berufe: Produktion, Konsum |
| `deposits.json` | 237 KB | Lagerstetten |
| `ship_models_map.json` | 443 KB | Ship-ID -> Fraktions-Modell Mapping |
| `galaxy_map.json` | 22 KB | Galaxy-Map Empire-Startpositionen |
| `galaxy_maps.json` | 282 KB | Erweiterte Galaxiekarten mit loc_key |
| `mega_models_map.json` | 56 KB | Megastruktur-3D-Modell-Mapping |
| `tech_item_map.json` | 1,05 MB | Tech -> Item Cross-Reference (Ships, Buildings, Components) |
| `search_index.json` | 2,6 MB | Cross-Module Suchindex (~19.740 Items) |
| `cross_references.json` | 303 KB | Bidirektionale Cross-Refs |
| `module_pages.json` | 248 B | Modul -> HTML-Seite Mapping |
| `changes.json` | 4,9 KB | Aenderungs-Tracking (aktueller vs. vorheriger Lauf) |
| `changes_history.json` | 908 KB | Aenderungs-Historie ueber alle Laeufe |
| `last_update.json` | 2,5 MB | Timestamp + Statistiken |

## Lokalisierung (`assets/localisation/`)

7 Sprach-Dateien, je ~100 KB mit ~200.000 Loc-Keys:
- `english.json`, `german.json`, `french.json`, `spanish.json`, `russian.json`, `polish.json`, `braz_por.json`
- `inject_missing_loc.py` injiziert 101 fehlende Keys pro Sprache vor der Ausgabe

## Bilder

### Event-Bilder (`pictures/`)

- 991 WebP-Dateien
- ~12 MB gesamt
- Konvertiert aus DDS-Quellen via ImageMagick
- 480px Breite, proportional, Qualitaet 80
- Mapping: `pictures_map.json` ordnet GFX-Namen den Texturdateien zu

### Tech-Icons (`icons/tech/`)

- 1.659 WebP-Dateien
- Kopiert aus git09 (nicht von Pipeline generiert)
- Mapping: `icons/tech_icon_mappings.json`

### Building-Icons (`icons/buildings/`)

- 754 WebP-Dateien
- Konvertiert aus DDS-Quellen via `convert_building_icons.py`
- Werden auf der Buildings-Seite neben jedem Gebaeude angezeigt

### Empire-Flaggen (`assets/flags/trek/`)

- 79 WebP-Dateien
- Empire-Flaggen fuer die Empires-Seite und Galaxy Map
- Konvertiert aus DDS-Quellen

### Traits-Icons (`icons/traits/`)

- 1.106 WebP-Dateien
- Konvertiert aus DDS-Quellen (Mod + Vanilla, rekursiv)

### Traditions-Icons (`icons/traditions/`)

- 407 WebP-Dateien
- Konvertiert aus DDS-Quellen (Mod + Vanilla, rekursiv)

### Ascension-Perks-Icons (`icons/ascension_perks/`)

- 66 WebP-Dateien
- Konvertiert aus DDS-Quellen

### Civics-Icons (`icons/civics/`)

- 330 WebP-Dateien
- Konvertiert aus DDS-Quellen (`governments/civics/`)

### Authorities-Icons (`icons/authorities/`)

- 154 WebP-Dateien
- Konvertiert aus DDS-Quellen (`governments/authorities/`)

### Jobs-Icons (`icons/jobs/`)

- 267 WebP-Dateien
- Konvertiert aus DDS-Quellen

### Deposits-Icons (`icons/deposits/`)

- 474 WebP-Dateien
- Konvertiert aus DDS-Quellen

### Relics-Icons (`icons/relics/`)

- 138 WebP-Dateien
- Konvertiert aus DDS-Quellen (152x152, exkl. `_shine` Overlays)

### Edicts-Icons (`icons/edicts/`)

- 4 WebP-Dateien
- Nur wenige Edicts haben eigene DDS-Icons

### Policies-Icons (`icons/policies/`)

- 11 WebP-Dateien
- Nur `diplomatic_stance`-Optionen haben eigene Icons

### Councilors-Icons (`icons/councilors/`)

- 20 WebP-Dateien
- GFX-resolved via `pictures_map.json`, Civic-Fallback fuer Councilors ohne eigenes Icon

### Components-Icons (`icons/components/`)

- 3.913 WebP-Dateien (gestemmt auf `ship_part_<key>`)
- Hybrid-Resolver: zuerst GFX-resolve via `pictures_map.json`, dann rekursiver
  Direct-Scan von `gfx/interface/icons/ship_parts/**/` als Fallback
- Mod-Icons ueberschreiben Vanilla-Fallbacks automatisch (Scan-Reihenfolge)
- ~79 Components (1,2 %) haben keine Datei — `onerror`-Fallback blendet sie aus

### Unlock-Type-Icons (`icons/unlock_types/`)

- 25 WebP-Dateien
- Kategorisierung fuer Tech-Unlocks (z.B. ship, building, component, edict, etc.)

## Techtree-Assets (`assets/tech/`)

Aus git09 kopiert, separate JSON-Struktur fuer den D3.js Techtree:
- Technologie-Knoten mit Prerequisites, Unlocks, Area, Category, Tier
- Faction-spezifische Baum-Daten
- Von `tech/data.js` geladen (ES Module)

## 3D-Modelle (`models/`)

GLB-Dateien fuer den 3D Ship Viewer, organisiert nach Fraktion:
- `models/{faction}/{ship_id}.glb` — Binary glTF, nur Geometrie (graues Material, keine Texturen)
- 275 Ships, 1.263 Fraktionsvarianten
- Median: 300 KB pro GLB, Gesamt: ~720 MB
- **In `.gitignore`** — lokal generieren mit `python UPDATE_WIKI.py --only ship_models` (~20s)
- Konvertiert aus PdxMesh-Binaerformat (.mesh) via `convert_ship_models.py`
- Mapping: `assets/ship_models_map.json` (ship_id -> faction -> model info)

## Cross-References (`cross_references.json`)

Bidirektionale Verlinkung zwischen allen Modulen:
- 1.231 Tech-Unlock-Mappings
- 307 Building-Upgrade-Chains
- 56 Anomalie-Event-Links
- 29 Archaeologie-Event-Links
- 110 Empire-Referenzen

Format: `{ "tech_unlocks": {...}, "building_upgrades": {...}, ... }`

## Suchindex (`search_index.json`)

~19.740 Items aller Module in einem Index:
- Jedes Item: `{ id, name, type, module, faction?, description? }`
- Praefix-Suche: `ship:`, `event:`, `building:`, `trait:`, `civic:`, `mega:`, ...
- Faction-Synonyme: `fed` -> federation, ufp, starfleet, ...
- Geladen von `global-search.js` auf allen 12 Seiten
