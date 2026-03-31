# Daten-Pipeline (Python)

Die Python-Pipeline transformiert Paradox-Mod-Dateien aus git01 in JSON-Assets fuer das Frontend.

## Master-Script: `UPDATE_WIKI.py`

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
Phase 6: Ship Models    -> convert_ship_models.convert_all()  [optional]
Phase 7: Images         -> convert_images.convert_images()  [optional]
Phase 8: Summary        -> Statistiken + last_update.json
```

### Aufruf-Beispiele

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
python UPDATE_WIKI.py --only ship_models    # Nur Ships + 3D-Modell-Konvertierung
```

## Parser-Architektur

Alle Parser nutzen `parse_pdx.py` als gemeinsame Basis (rekursiver Descent Parser).

**Warum kein PLY?** PLY hatte Probleme mit Error Recovery bei PDX-Sonderfaellen (Doppelpunkte in IDs, Operatoren, @Variablen). Der rekursive Descent Parser in parse_pdx.py ist robuster.

### Tokenizer (PdxLexer)

Token-Typen: `COMMENT`, `STRING`, `OPERATOR`, `LBRACE`, `RBRACE`, `VARIABLE`, `NUMBER`, `WORD`

### Parser (PdxParser)

```python
# Syntax-Mapping:
# key = value       -> {'key': 'value'}
# key = { ... }     -> {'key': [nested...]}
# { val1 val2 }     -> [val1, val2]
```

### Hilfsfunktionen (parse_helpers.py)

```python
get_value(data, key, default=None)   # Einzelwert extrahieren
get_all_values(data, key)            # Alle Werte eines Keys
get_blocks(data, key)                # Alle Bloecke eines Keys
```

## Konfiguration: `config.py`

```python
# Nur diese beiden Pfade muessen angepasst werden:
STNH_MOD_ROOT = r"C:\Users\marcj\git01\New-Horizons-Development"
WIKI_ROOT = r"C:\Users\marcj\git10\stnh_wiki"

# Automatisch abgeleitet:
MOD_EVENTS_DIR, MOD_LOCALISATION_DIR, MOD_ON_ACTIONS_DIR, ...
OUTPUT_ASSETS_DIR, OUTPUT_PICTURES_DIR, OUTPUT_ICONS_DIR, ...

LANGUAGES = ['english', 'german', 'french', 'spanish', 'russian', 'polish', 'braz_por']
```

## Parser & Generatoren pro Modul

| Modul | Parser-Dateien | Generator | Output-JSONs |
|---|---|---|---|
| Events | parse_events, parse_on_actions, parse_event_chains, build_relationships | generate_events_json | events_index, events_detail/*, namespaces, relationships, on_actions, event_chains |
| Localisation | parse_localisation | (direkt) | localisation/{lang}.json |
| GFX | parse_gfx_mappings | (direkt) | pictures_map.json |
| Ships | parse_ships, parse_components, parse_ship_models | generate_ships_json | ships.json, components.json, ship_models_map.json |
| Ship Models | pdx_mesh_reader, convert_ship_models | (direkt) | models/{faction}/{ship}.glb |
| Buildings | parse_buildings, parse_districts | generate_buildings_json | buildings.json, districts.json |
| Traits | parse_traits, parse_traditions, parse_ascension_perks | generate_traits_json | traits.json, traditions.json, ascension_perks.json |
| Governments | parse_governments, parse_policies, parse_edicts | generate_governments_json | governments.json, civics.json, authorities.json, policies.json, edicts.json |
| Megastructures | parse_megastructures, parse_relics | generate_megastructures_json | megastructures.json, relics.json |
| Anomalies | parse_anomalies, parse_archaeology | generate_anomalies_json | anomalies.json, archaeology.json |
| Empires | parse_empires, parse_species | generate_empires_json | empires.json, species.json |
| Economy | parse_jobs, parse_deposits | generate_economy_json | jobs.json, deposits.json |
| Search | (alle obigen) | generate_search_index, generate_cross_references | search_index.json, cross_references.json, module_pages.json |
| Images | (GFX-Mapping) | convert_images | pictures/*.webp |

## Lokalisierungs-Parser

```
parse_localisation.py
- Parst .yml-Dateien aller 7 Sprachen
- Regex: key:0 "value" oder key: "value"
- Encoding: UTF-8-SIG mit latin-1 Fallback (manche .yml haben Encoding-Probleme)
- Format-Codes (§R, §W, etc.) werden entfernt
- $key$-Referenzen werden rekursiv aufgeloest (Loop-Protection)
```

## Bildkonvertierung

```
convert_images.py
- DDS -> WebP via ImageMagick (magick convert)
- Animierte Sprites: Erster Frame zugeschnitten
- Resize: 480px Breite, proportional, Qualitaet 80
- Inkrementell: Nur neue/geaenderte Bilder
- Voraussetzung: ImageMagick im PATH
```

## Ship Model Pipeline

```
Modell-Kette:
  common/ship_sizes/*.txt          -> graphical_culture per ship_size
  gfx/models/ships/{faction}/*.asset -> entity -> pdxmesh name
  gfx/models/ships/{faction}/*.gfx   -> pdxmesh -> .mesh file + textures
  gfx/models/ships/{faction}/*.mesh  -> Binary PdxMesh (@@b@ header)
  gfx/models/ships/{faction}/*.dds   -> DDS-Texturen (Diffuse, Normal, Specular)

Pipeline:
  1. parse_ship_models.py  -> ship_models_map.json (ship_id -> faction -> model info)
  2. pdx_mesh_reader.py    -> PdxMesh-Binaer-Parser (@@b@ -> Vertices, Normals, Triangles)
  3. convert_ship_models.py -> .mesh -> .glb (nur Geometrie, pygltflib)

Output:
  models/{faction}/{ship_id}.glb  (nur Mesh-Geometrie, graues Material, keine Texturen)

Inkrementell: Skip-if-exists (wie convert_images.py).
Voraussetzungen: pygltflib>=1.16.0
```

## Techtree-Pipeline (noch nicht lauffaehig)

```
update/techtree/                    # 27 Scripts, Kopie aus git09
- balance_center_bridge.py          # Braucht Anpassung (balance_center/ fehlt)
- parse_technologies.py             # Eigener PLY-basierter Parser
- generate_tech_json.py             # Tech-Baum generieren
```

Status: Kopiert, aber `balance_center_bridge.py` benoetigt `balance_center/` Verzeichnis, das in git01 nicht existiert. Muss adaptiert oder ersetzt werden (siehe TODO.md Phase 11.2).

## Abhaengigkeiten

| Abhaengigkeit | Version | Zweck | Erforderlich? |
|---|---|---|---|
| Python | 3.8+ | Pipeline | Ja |
| pygltflib | 1.16+ | GLB-Erzeugung (Ship Models) | Nur fuer Ship Models |
| ImageMagick | 7+ | DDS->WebP (Event-Bilder) | Nur fuer Bilder |
| npm/Node | - | - | Nicht benoetigt |

Die Kern-Pipeline nutzt Python-Standardbibliothek. Die Ship-Model-Pipeline benoetigt zusaetzlich `pygltflib` (siehe `update/requirements.txt`).
