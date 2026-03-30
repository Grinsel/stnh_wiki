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
| `pictures_map.json` | 1,2 MB | GFX-Name -> {texturefile, frames} (3.960 Sprites) |
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
| `empires.json` | 115 KB | Imperien: Species, Ethik, Government, Origin |
| `species.json` | 74 KB | Spezies: Archetyp, Portraits |
| `jobs.json` | 219 KB | Berufe: Produktion, Konsum |
| `deposits.json` | 237 KB | Lagerstetten |
| `search_index.json` | 2,6 MB | Cross-Module Suchindex (~19.740 Items) |
| `cross_references.json` | 303 KB | Bidirektionale Cross-Refs |
| `module_pages.json` | 248 B | Modul -> HTML-Seite Mapping |
| `last_update.json` | 2,5 MB | Timestamp + Statistiken |

## Lokalisierung (`assets/localisation/`)

7 Sprach-Dateien, je ~100 KB mit ~200.000 Loc-Keys:
- `english.json`, `german.json`, `french.json`, `spanish.json`, `russian.json`, `polish.json`, `braz_por.json`

## Bilder

### Event-Bilder (`pictures/`)

- 986 WebP-Dateien
- ~12 MB gesamt
- Konvertiert aus DDS-Quellen via ImageMagick
- 480px Breite, proportional, Qualitaet 80
- Mapping: `pictures_map.json` ordnet GFX-Namen den Texturdateien zu

### Tech-Icons (`icons/tech/`)

- 1.659 WebP-Dateien
- Kopiert aus git09 (nicht von Pipeline generiert)
- Mapping: `icons/tech_icon_mappings.json`

### Unlock-Type-Icons (`icons/unlock_types/`)

- 25 WebP-Dateien
- Kategorisierung fuer Tech-Unlocks (z.B. ship, building, component, edict, etc.)

## Techtree-Assets (`assets/tech/`)

Aus git09 kopiert, separate JSON-Struktur fuer den D3.js Techtree:
- Technologie-Knoten mit Prerequisites, Unlocks, Area, Category, Tier
- Faction-spezifische Baum-Daten
- Von `tech/data.js` geladen (ES Module)

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
- Geladen von `global-search.js` auf allen 11 Seiten
