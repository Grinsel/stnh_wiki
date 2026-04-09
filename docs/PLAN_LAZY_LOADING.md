# Plan: Lazy-Loading — Datenlast reduzieren

> Status: Geplant, noch nicht umgesetzt.
> Erstellt: 2026-03-31

## Problem

Bei langsamer Internetverbindung laden Content-Seiten grosse JSON-Dateien komplett, bevor
irgendetwas angezeigt wird. Besonders problematisch:

| Datei | Groesse | Geladen auf |
|---|---|---|
| components.json | 4.9 MB | ships.html |
| search_index.json | 2.6 MB | **alle 11 Seiten** |
| events_index.json | 2.6 MB | events.html |
| buildings.json | 506 KB | buildings.html |
| ships.json | 320 KB | ships.html |

Bei 3G (~1 Mbps) wartet man allein fuer ships.html ~8 Sekunden, bevor die erste Zeile erscheint.

## Ziel

Listen-Ansicht sofort anzeigen mit minimalem Datensatz (~10-15% der Originaldaten).
Detail-Daten erst laden wenn ein Item ausgewaehlt wird.

**Vorbild:** Die Events-Seite macht das bereits — `events_index.json` (kompakt) fuer die Liste,
`events_detail/{ns}.json` (voll) on-demand.

## Einschraenkung

Die Python-Pipeline kann nur auf dem Hauptgeraet ausgefuehrt werden (git01 noetig).
Pipeline-Aenderungen muessen dort getestet werden.

## Betroffene Dateien

### Pipeline (update/)
| Datei | Aenderung |
|---|---|
| `update/generate_ships_json.py` | Zweite Output-Datei: `ships_index.json` + `components_index.json` |
| `update/generate_buildings_json.py` | Index-Dateien fuer buildings, districts |
| `update/generate_traits_json.py` | Index-Dateien fuer traits, traditions, ascension_perks |
| `update/generate_governments_json.py` | Index-Dateien fuer governments, civics, authorities, policies, edicts |
| `update/generate_megastructures_json.py` | Index-Dateien fuer megastructures, relics |
| `update/generate_anomalies_json.py` | Index-Dateien fuer anomalies, archaeology |
| `update/generate_empires_json.py` | Index-Dateien fuer empires, species |
| `update/generate_economy_json.py` | Index-Dateien fuer jobs, deposits |

### Frontend (js/)
| Datei | Aenderung |
|---|---|
| `js/data.js` | Neue Methode `loadItemDetail(module, id)` |
| `js/global-search.js` | Deferred loading — Index erst bei erster Sucheingabe laden |
| `js/common.js` | `initGlobalSearch()` auf deferred umstellen |
| `js/pages/*.js` | Alle 8 Content-Pages: Index laden statt Vollbild, Detail on-click |
| `js/pages/hub.js` | Search-Index deferred laden |

## Schritte

### Schritt 1: GlobalSearch deferred laden (groesster Quick-Win)

**Problem:** `search_index.json` (2.6 MB) wird auf **jeder** Seite sofort geladen.

**Loesung:** Index erst laden wenn der User zum ersten Mal ins Suchfeld klickt oder tippt.

- `js/global-search.js`: `init()` laedt nichts mehr. Neues `ensureLoaded()` das den Index
  beim ersten Aufruf laedt und cached.
- `js/common.js`: `initGlobalSearch()` registriert nur einen `focus`/`input`-Listener auf
  `#search-input`, der `GlobalSearch.ensureLoaded()` aufruft.
- `js/pages/hub.js`: Gleiches Prinzip — Search-Index erst bei Interaktion laden.

**Ersparnis:** 2.6 MB weniger auf JEDEM Seitenaufruf sofort.

### Schritt 2: Index-Dateien in der Pipeline generieren

Fuer jedes Content-Modul eine `*_index.json` erzeugen die NUR die Listen-Felder enthaelt.

**Index-Felder pro Modul:**

| Modul | Index-Felder | Geschaetzte Groesse |
|---|---|---|
| ships | id, name_key, class, max_hitpoints, size_multiplier, icon_frame | ~30 KB (statt 320 KB) |
| components | id, name_key, type, size, power, icon, icon_frame, tags, hidden | ~500 KB (statt 4.9 MB) |
| buildings | id, name_key, category, icon_key, capital, building_sets | ~40 KB (statt 506 KB) |
| districts | id, name_key, category, icon_key | ~5 KB (statt 44 KB) |
| traits | id, name_key, leader_class, icon, rarity, tier, cost | ~40 KB (statt 213 KB) |
| traditions | id, name_key, category, icon | ~20 KB (statt 151 KB) |
| ascension_perks | id, name_key, icon | ~5 KB (statt 34 KB) |
| governments | id, name_key | ~5 KB (statt 60 KB) |
| civics | id, name_key, category | ~15 KB (statt 159 KB) |
| policies | id, name_key | ~5 KB (statt 63 KB) |
| edicts | id, name_key | ~5 KB (statt 49 KB) |
| megastructures | id, name_key, category | ~10 KB (statt 160 KB) |
| relics | id, name_key | ~5 KB (statt 61 KB) |
| anomalies | id, name_key, category | ~5 KB (statt 68 KB) |
| empires | id, name_key, species_name, ethic, government | ~20 KB (statt 115 KB) |
| jobs | id, name_key, category, building_icon | ~15 KB (statt 219 KB) |
| deposits | id, name_key, category | ~15 KB (statt 237 KB) |

**Gesamt:** ~730 KB statt ~7.4 MB fuer alle Index-Dateien zusammen.

**Implementierung in jedem Generator:**
```python
# Bestehend: volles JSON
write_json(output_path / 'ships.json', full_data)

# Neu: Index-JSON mit nur Listenfeldern
INDEX_FIELDS = ['id', 'name_key', 'class', 'max_hitpoints', 'size_multiplier', 'icon_frame']
index_data = [{k: item[k] for k in INDEX_FIELDS if k in item} for item in full_data]
write_json(output_path / 'ships_index.json', index_data)
```

Die vollen `*.json` bleiben — sie dienen als Detail-Quelle.

### Schritt 3: DataManager erweitern (js/data.js)

```js
/**
 * Load detail data for a single item.
 * Laedt die volle JSON beim ersten Aufruf fuer das Modul, cached sie,
 * gibt dann das Item per ID zurueck.
 */
async loadItemDetail(module, itemId) {
    const fullData = await this.loadJSON(`assets/${module}.json`);
    return fullData.find(item => item.id === itemId);
}
```

Einfacher als pro-Item-Dateien: Volle JSON wird erst bei erstem Detail-Click geladen,
dann fuer alle weiteren Items im Cache.

### Schritt 4: Content-Pages auf Index + Lazy-Detail umstellen

**Muster (am Beispiel ships.js):**

Vorher:
```js
const [shipsData, componentsData] = await Promise.all([
    DataManager.loadJSON('assets/ships.json'),
    DataManager.loadJSON('assets/components.json'),
]);
```

Nachher:
```js
const [shipsIndex, componentsIndex] = await Promise.all([
    DataManager.loadJSON('assets/ships_index.json'),
    DataManager.loadJSON('assets/components_index.json'),
]);

async function showDetail(itemId, module) {
    showDetailSpinner();
    const detail = await DataManager.loadItemDetail(module, itemId);
    renderDetailPanel(detail);
}
```

Fuer alle 8 Content-Pages identisch. Pro Page:
1. `loadJSON('assets/X.json')` → `loadJSON('assets/X_index.json')`
2. Detail-Rendering in async Funktion mit `loadItemDetail()`
3. Loading-Spinner waehrend Detail laedt

### Schritt 5: Loading-Indikator fuer Detail-Panel

Kurzer Spinner waehrend die volle JSON im Hintergrund laedt:
```html
<div class="detail-loading">Loading details...</div>
```
Verschwindet sobald `loadItemDetail()` zurueckkehrt (~<1s, volle JSON wird gecacht).

## Reihenfolge & Abhaengigkeiten

```
Schritt 1 (GlobalSearch defer)      ← Sofort umsetzbar, kein Pipeline-Bedarf
    ↓
Schritt 2 (Index-Generierung)       ← Pipeline, Test auf Hauptgeraet noetig
    ↓
Schritt 3 (DataManager erweitern)   ← Sofort umsetzbar
    ↓
Schritt 4 (Pages umstellen)         ← Abhaengig von Schritt 2 + 3
    ↓
Schritt 5 (Loading-Spinner)         ← Sofort umsetzbar
```

## Erwartete Verbesserung

| Seite | Vorher (3G) | Nachher (3G) | Verbesserung |
|---|---|---|---|
| ships.html | ~8s | ~1s initial, +1s erster Detail-Click | 87% schneller |
| buildings.html | ~3s | ~0.5s initial | 83% schneller |
| alle Seiten | +2.6s (search) | 0s (deferred) | search-index entfaellt |

## Verifikation

1. `python -m http.server 8000` + Chrome DevTools Network-Tab
2. Network Throttling auf "Slow 3G" setzen
3. ships.html laden → sollte Index in <1s laden, Liste sofort zeigen
4. Item anklicken → "Loading..." kurz sichtbar, dann Detail
5. Zweites Item → Detail sofort (aus Cache)
6. Suche erst benutzen → search_index.json wird erst dann geladen
