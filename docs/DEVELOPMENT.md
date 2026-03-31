# Entwicklung & Wartung

## Voraussetzungen

| Abhaengigkeit | Version | Zweck | Erforderlich? |
|---|---|---|---|
| Python | 3.8+ | Daten-Pipeline | Ja |
| ImageMagick | 7+ | DDS -> WebP Bildkonvertierung | Nur fuer Bilder |
| D3.js | v7 (CDN) | Tech Tree Visualisierung | Nur tech.html (wird vom CDN geladen) |
| Three.js | v0.172 (CDN) | 3D Ship Viewer | Nur ships.html (lazy-loaded per Button-Click) |
| pygltflib | 1.16+ | GLB-Erzeugung | Nur fuer Ship-Model-Pipeline |
| Git | - | Versionierung + Deployment | Ja |
| npm/Node | - | - | Nicht benoetigt |

Die Kern-Pipeline nutzt Python-Standardbibliothek. Die Ship-Model-Pipeline benoetigt `pygltflib` (`pip install -r update/requirements.txt`).

## Lokale Entwicklung

### Repository klonen

```bash
git clone <repo-url> stnh_wiki
```

### Pfade konfigurieren

`update/config.py` anpassen:
```python
STNH_MOD_ROOT = r"C:\Users\marcj\git01\New-Horizons-Development"  # Pfad zum STNH-Mod
WIKI_ROOT = r"C:\Users\marcj\git10\stnh_wiki"                     # Pfad zum Wiki-Repo
```

### Daten aktualisieren

```bash
cd update
python UPDATE_WIKI.py --skip-images     # Vollstaendig ohne Bilder (~12s)
python UPDATE_WIKI.py --only events     # Nur Events
python UPDATE_WIKI.py --only search     # Nur Suchindex
```

### Lokal ansehen

Lokaler HTTP-Server (fuer JSON-Fetches):
```bash
cd stnh_wiki
python -m http.server 8000
# Dann http://localhost:8000 oeffnen
```

Oder jede HTML-Datei direkt im Browser oeffnen (manche Features wie JSON-Fetch funktionieren dann nicht).

## Deployment

### Automatisch (GitHub Pages)

Jeder Push auf `master` triggert `.github/workflows/deploy.yml`:
```
Checkout -> Setup Pages -> Upload artifact -> Deploy
```

### Via BAT-Dateien

```
UPDATE.bat           # python UPDATE_WIKI.py + git add + commit + push
UPDATE_QUICK.bat     # python UPDATE_WIKI.py --skip-images + git add + commit + push
UPDATE_EVENTS.bat    # Nur Events + Deploy
UPDATE_TECHTREE.bat  # Techtree-Pipeline
```

## Neues Content-Modul hinzufuegen

### Pipeline-Seite

1. **Parser erstellen**: `update/parse_neues_ding.py`
   - `parse_pdx.py` importieren als Basis
   - Mod-Dateien aus git01 parsen
   - Dict/Liste zurueckgeben

2. **Generator erstellen**: `update/generate_neues_ding_json.py`
   - Parser-Output aggregieren
   - Lokalisierungs-Keys aufloesen (via parse_localisation)
   - Faction-Erkennung (Pattern-Matching)
   - JSON nach `assets/neues_ding.json` schreiben

3. **In UPDATE_WIKI.py einbinden**:
   - Neue Phase in der Pipeline-Reihenfolge
   - `--only neues_ding` Option hinzufuegen

4. **Suchindex erweitern**: `generate_search_index.py`
   - Neuen Typ und dessen Items aufnehmen

### Frontend-Seite

1. **HTML-Seite erstellen**: Kopie einer bestehenden Content-Seite (z.B. ships.html)
   - Title, OG-Tags anpassen
   - Tab-Namen und Filter aendern

2. **Page-Controller**: `js/pages/neues_ding.js`
   - IIFE-Pattern (siehe FRONTEND.md "Content-Page-Skeleton")
   - Daten laden, Tabs/Filter initialisieren, Rendering

3. **Navigation aktualisieren**: In allen 11 HTML-Dateien
   - Neuen `<a class="nav-link">` in `#wiki-nav` hinzufuegen
   - OG-Tags aktualisieren falls noetig

4. **Hub-Cards**: In `index.html`
   - Section-Card fuer das neue Modul

5. **GlobalSearch**: `global-search.js`
   - Neuen Typ-Prefix hinzufuegen (z.B. `ding:`)

## Haeufige Wartungsaufgaben

| Aufgabe | Datei(en) |
|---|---|
| Faction falsch zugeordnet | `generate_events_json.py` -> `FACTION_PATTERNS` |
| Parser-Fehler bei Mod-Update | `parse_pdx.py` (Basis) oder modulspezifischer Parser |
| Bilder fehlen nach Mod-Update | `parse_gfx_mappings.py` + `convert_images.py` |
| Lokalisierung falsch / fehlend | `parse_localisation.py` (Encoding? $key$-Referenzen?) |
| UI-String fehlt oder aendern | `js/ui-strings.js` (Key hinzufuegen, min. english + german) |
| Neuen Suchprefix hinzufuegen | `js/global-search.js` -> `TYPE_PREFIXES` |
| Theme-Farben aendern | `js/common.js` -> `THEMES` Objekt |
| Mobile Layout fixen | `style.css` -> `@media` Regeln + Hamburger-Sektion |
| Neue Sprache hinzufuegen | Siehe unten |

## Neue Sprache hinzufuegen

1. `update/config.py`: Sprache zu `LANGUAGES` Array hinzufuegen
2. Sicherstellen, dass `localisation/{sprache}/` im Mod (git01) existiert
3. Alle 11 HTML-Dateien: `<option>` zum `#lang-select` Dropdown hinzufuegen
4. `js/ui-strings.js`: Fuer alle 310+ Keys die neue Sprache ergaenzen (mindestens die wichtigsten)

## Neue Faction hinzufuegen

1. `update/generate_events_json.py`: Eintrag zu `FACTION_PATTERNS` hinzufuegen
2. Optional: `js/common.js` -> `THEMES` Objekt erweitern
3. Frontend erkennt neue Factions automatisch in Filtern und Sidebar

## Konventionen

- **Deutsch** fuer Plandokumente und Doku-Prosa
- **Englisch** fuer Code, Kommentare, Variablen-Namen, Commit-Messages
- **Keine Umlaute im Code** — `ae`, `oe`, `ue` in Identifiern verwenden
- **Seitentitel**: `Section - ST:NH Wiki` Format (z.B. `Ships - ST:NH Wiki`)
- **OG-Tags** auf allen Seiten fuer Social-Media-Preview
- **IIFE Pattern** (Revealing Module Pattern) fuer alle JS-Module (ausser tech/)
- **Git-Verzeichnisse**: git01 = STNH Mod (read-only), git09 = Techtree (live, nicht aendern!), git10 = Wiki

## Projekt-Statistiken

| Eigenschaft | Wert |
|---|---|
| HTML-Seiten | 11 |
| Events | ~8.867 |
| Techs | ~2.600 |
| Content-Items (Non-Event) | ~10.873 |
| Suchindex | ~19.740 Items |
| Sprachen | 7 |
| Loc-Keys | ~200.000+ pro Sprache |
| GFX Sprites | 3.960 |
| Event-Bilder | 986 (WebP) |
| Tech-Icons | 1.659 (WebP) |
| JSON-Assets | 30 + 272 Event-Details |
| JS-Dateien | 50 |
| Python-Pipeline | 44 Dateien |
| Projektgroesse | ~294 MB |
