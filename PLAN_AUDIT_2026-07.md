# Plan: STNH Wiki — Audit, Bugfixes & Optimierung

> **Status: FINAL** (Audit abgeschlossen am 02.07.2026, drei Explore-Agenten + Plan-Agent + eigene Verifikation)
> Erster Umsetzungsschritt: diesen Plan als `C:\Users\marcj\git10\stnh_wiki\PLAN_AUDIT_2026-07.md` im Projektordner speichern.

## Kontext

Das STNH-Wiki (`git10/stnh_wiki`, stnewhorizons.org) soll auditiert werden: Fehler finden, bestehende Features und Code optimieren. Bekanntes Hauptproblem: Beim letzten vollständigen Pipeline-Update wurden neue Mesh-Files des Mods zwar datenseitig erkannt (Schiffe erscheinen im Wiki), aber die 3D-Modelle sind im Ship-Viewer nicht renderbar — als wären keine Dateien vorhanden.

Relevante 3D-Pipeline (aus TODO.md Phase 2.4):
- `update/parse_ship_models.py` — .gfx/.asset Parser → ship_models_map.json
- `update/pdx_mesh_reader.py` — PdxMesh Binär-Parser
- `update/convert_ship_models.py` — .mesh+.dds → .glb (pygltflib + Pillow)
- `js/ship-viewer.js` — Three.js GLB Viewer

## Befunde (werden ergänzt)

### BESTÄTIGT: Root Cause des 3D-Mesh-Bugs (selbst verifiziert)

Die Konvertierung funktioniert — das Deployment nicht:

1. Letzter Full-Update-Log (`logs/UPDATE_2026-06-13_2323.log`): `PHASE: SHIP MODELS (GLB) — Converted: 67, Skipped: 1624, Failed: 0`. Die neuen Varianten wurden fehlerfrei nach `models/` konvertiert.
2. `git status` in `stnh_wiki`: Die neuen GLBs liegen **untracked** im Arbeitsverzeichnis: `models/delta_02/`, `models/devore_01/`, `models/nygean_01/`, `models/tamarian_01/`, `models/vaadwaur_01/*.glb` (6 neue), `models/yridian_01/`, `models/megastructures/sth_hyper_relay/hirogen_01.glb`. Dateien sind valide (0,5–2 MB).
3. **Ursache:** `UPDATE.bat:64` staged nach dem Pipeline-Lauf nur `git add assets/ pictures/ icons/ fonts/` — **`models/` fehlt**. Die GLBs werden also nie committet/gepusht → GitHub Pages liefert 404 → Ship-Viewer zeigt „keine Datei".
4. Gleiches Muster in allen Update-Skripten: `UPDATE_QUICK.bat:64` (`git add assets/`), `UPDATE_EVENTS.bat:64`, `UPDATE_EVENTS_QUICK.bat:64`, `UPDATE_TECHTREE.bat:64`.
5. Nebeneffekt: Das `git add -A` im Pre-Update-Schritt (Zeile 25) würde die Reste erst beim **nächsten** Lauf einsammeln — Modelle wären immer einen Full-Update-Zyklus verspätet online.

**Fix:** `models/` in die `git add`-Liste von `UPDATE.bat` aufnehmen (+ sofortiger Einmal-Fix: die liegengebliebenen GLBs committen und pushen). Details unter Maßnahmen.

### Audit-Befunde: Python-Pipeline (`update/`)

**P1 — Orchestrator ohne Phasen-Isolation.** `UPDATE_WIKI.py:468-537`: Alle Phasen laufen ungeschützt (`results['ships'] = phase_ships()`); nur Validation und `phase_techtree` haben try/except. Wirft eine Phase eine Exception, bricht der komplette Lauf ab → `UPDATE.bat` springt zu `:pipeline_failed`, kein Commit/Push, alle nachgelagerten Phasen verloren.

**P1 — Kein „completed with errors"-Exitcode.** `UPDATE_WIKI.py:559` gibt immer `return 0`, egal wie viele Parser-Fehler aufliefen. Entweder Totalabbruch oder scheinbarer Erfolg — kein Zwischenzustand.

**P2 — `parse_pdx.py` Syntax-Lücken:**
- Inline-Math `@[ ... ]` (Zeilen 20-36): `@[`-Token fällt durch zu `OTHER` und wird verworfen → korrumpierte Trigger-/Weight-Blöcke (kommt im Mod in `common/script_values`, `situations`, `static_modifiers` vor).
- `color = hsv { ... }` / `rgb { ... }` (Zeilen 173-192): `hsv` wird als Skalar gelesen, der `{...}`-Block desynchronisiert den Parser als eigenes Statement.

**P2 — Localisation wird doppelt geparst.** `phase_localisation()` (`UPDATE_WIKI.py:516`) UND nochmal als Subprozess in `techtree/UPDATE_TECHTREE_FULL.py:210-214` — ~240k Keys × 7 Sprachen zweimal; größter Laufzeit-Hotspot (79s-Lauf). Zudem existieren zwei divergente Kopien von `parse_localisation.py` und `config.py` (Haupt vs. `techtree/`).

**P2 — `--only resources` unvollständig:** Der `--only`-Map fehlt die Abhängigkeit auf die Producer-Phasen; auf frischem Tree entsteht ein unvollständiger Producer-Index.

**P3 — Portabilität:** Absolute Pfade hardcoded in `config.py:15-17`, `techtree/config.py:21-24` + ~12 Techtree-Skripten + `pdx_mesh_reader.py:228` (re-hardcoded statt config-Import).

**P3 — `convert_icons.py:387-406`:** Fehlendes ImageMagick wird pro Kategorie verschluckt; `_index.json` wird trotzdem (unvollständig) geschrieben.

Techtree-Subfolder ist inert-safe (Subprozess mit Timeout, alle Fehler → WARN-Fallback). `create_tech_json.py` (alt) ist toter Code neben `create_tech_json_new.py`.

### Audit-Befunde: Frontend (`js/`)

**P1 — WebGL-Context-Leak im Ship-Viewer.** `js/ship-viewer.js:198-234` (`dispose()`): Canvas wird nie aus dem DOM entfernt, kein `renderer.forceContextLoss()`. `createViewer()` (Zeile 109-110) orphaned den alten Canvas. Chrome cappt ~16 Live-Contexts → nach mehreren Schiffs-/Fraktionswechseln wird der Viewer schwarz („Too many active WebGL contexts").

**P1 — `three-ready`-Promise kann ewig hängen.** `js/ship-viewer.js:57-68`: Reject nur bei Script-Netzwerkfehler; wirft der Inline-ES-Module-Import zur Laufzeit (CDN/Import-Map, gepinnte `THREE_VERSION='0.172.0'`), bleibt `_loading=true` und alle künftigen `createViewer`-Aufrufe hängen — Spinner für immer, kein Retry.

**P1 — XSS-Lücken in `js/humanize.js`:** Mehrere Handler interpolieren Lokalisierungs-Strings ohne `esc()` in HTML (`leafText` Z.224, `'text'`-Trigger Z.411, `parseResourceCheck` Z.105, `parseResourceEffect` Z.113, `fmtCmp` Z.91) — Sink via `innerHTML` in `event-detail.js`. Community-Übersetzungen = Stored-XSS-Oberfläche.

**P2 — „7 Sprachen" sind real 4.** `js/ui-strings.js`: 379 englische Keys, aber nur 13 mit spanish/polish/braz_por (de/fr/ru vollständig). ES/PL/PT-Nutzer sehen zu ~97 % englische UI.

**P2 — Suche: Voll-Scan pro Tastendruck.** `js/global-search.js:243-305`: ~19.700 Items linear, pro Item wird der lowercased Haystack neu gebaut (`_matchItem` Z.183-237). Fix: Haystack einmalig beim Laden vorberechnen. Hub-Vollergebnisse ohne Virtualisierung (`hub.js:515-539`).

**P3 — Unvollständiges Textur-Disposal:** `ship-viewer.js:212-225` disposed nur `material.map`, nicht normal/roughness/metalness/emissive/ao-Maps.

**P3 — `empires.js` doppelter Detail-State:** `_currentDetailItem` (Z.183) vs. `currentDetailItem` (Z.222) können auseinanderlaufen.

Explizit als OK verifiziert: Cross-Page-Konsistenz (`wiki-lang-changed`, URL-Params), Script-Ladereihenfolge, `DataManager.loadJSON`-Memoization, `WIKI_LINK_MAP`-Ziele, Hamburger/Overlay-A11y.

### Audit-Befunde: Mesh-Pipeline im Detail (Agent 3)

Der Mesh-Bug hat **zwei zusammenwirkende Ursachen** — die Deployment-Lücke (oben) plus einen veralteten Pipeline-Stand:

- Letzter Full-Run: **13.06.2026** (belegt durch `assets/last_update.json`, neuestes Log, neueste GLB-mtime). Der Mod (`git01`, HEAD `9bcb2cd741`) erhielt danach weitere Schiffe: u. a. **Voth-Schiffe am 26.06.** (`gfx/models/ships/voth_01/*.mesh`), Releases 4.4.1–4.4.3 (15.–20.06.).
- Der 3D-Button wird über `has_model`/`model_factions` in `ships.json` gesteuert (`generate_ships_json.py:40-56`, `js/pages/ships.js:256`); Pfad: `models/<faction>/<id>.glb` (`ships.js:289-291`). Zwei Symptom-Klassen:
  - **Nach 13.06. hinzugefügte Schiffe** (Voth …): kein GLB, `has_model:false` → gar kein 3D-Button.
  - **Am 13.06. konvertierte Schiffe** (delta_02, devore, nygean, tamarian, vaadwaur, yridian): `ships.json` (committet via `assets/`) sagt `has_model:true`, aber GLB nie gepusht → Button da, Laden schlägt fehl (404) — exakt „als wären keine Files da".
- **Konverter ist gesund**: Failed: 0; Voth-Meshes sind format-kompatibel (>4-KB-Filter, Standard-Naming `{faction}_{ship}_coreA`, Strategy 1 matcht).
- **Ausgeschlossen:** Konvertierungs-/Formatproblem, .gitignore (models/ nicht ignoriert), `wiki_glb_backup` (verwaister April-Snapshot, nirgends referenziert).
- **Latenter Drittbug:** `convert_ship_models.py:323,351` — Skip nur bei GLB-Existenz, kein mtime-Vergleich mit der Quell-.mesh → in-place editierte Meshes werden nie neu konvertiert.
- **Wichtig:** `--skip-images` überspringt auch die Modell-Konvertierung (`UPDATE_WIKI.py:502/532`) — Full-Update muss ohne dieses Flag laufen.

## Maßnahmen (in Umsetzungsreihenfolge)

Aufwand: S = klein, M = mittel, L = groß. Konventionen beachten: Code/Kommentare Englisch, keine Umlaute in Identifiern, git01 read-only, git09 unangetastet, kein Framework/Build-System.

### Schritt 0 — Plan im Projekt ablegen (S)
Diesen Plan als `PLAN_AUDIT_2026-07.md` nach `C:\Users\marcj\git10\stnh_wiki\` kopieren (Wunsch des Nutzers: Plan liegt im Projektordner).

### Phase 0 — Hotfix: liegengebliebene GLBs deployen (S)
- In `git10/stnh_wiki`: `git add models/`, committen, pushen. Behebt sofort die Live-404s für delta_02, devore_01, nygean_01, tamarian_01, vaadwaur_01, yridian_01 + hirogen-Megastruktur — deren `ships.json`-Daten (has_model:true) sind bereits deployed, nur die Binärdateien fehlen.
- Im selben Zug: `logs/` und `update/techtree/logs/` in `.gitignore` aufnehmen (werden sonst vom Pre-Update `git add -A` in die History gespült).
- **Watch-Item:** `models/` ist bereits ~1,6 GB bei einem GitHub-Pages-Soft-Limit von 1 GB — funktioniert aktuell, aber bei der nächsten großen Fraktions-Welle GLB-Kompression (Draco/meshopt) evaluieren. Im Plan dokumentieren, nicht jetzt umsetzen.

### Phase 1 — Update-Skripte fixen (S)
- In allen 5 Skripten (`UPDATE.bat`, `UPDATE_QUICK.bat`, `UPDATE_EVENTS.bat`, `UPDATE_EVENTS_QUICK.bat`, `UPDATE_TECHTREE.bat`) Zeile 64: `models/` zur `git add`-Liste hinzufügen.
- Empfohlen: Pre-Update `git add -A` (Zeile 25) durch explizite Pfadliste ersetzen (`assets/ pictures/ icons/ fonts/ models/ js/ *.html update/`) — verhindert, dass Müll im Arbeitsverzeichnis mitcommittet wird.

### Phase 2 — Pipeline neu laufen lassen (S + ~80s Laufzeit)
- `cd update && python UPDATE_WIKI.py` — **ohne** `--skip-images` (Flag überspringt sonst die Modell-Konvertierung). Erzeugt GLBs + `has_model:true` für alle nach dem 13.06. hinzugekommenen Schiffe (Voth etc.).
- Danach via gefixtes `UPDATE.bat` committen/pushen.
- Falls der Lauf wegen neuer Mod-Syntax abbricht: Phase 4a (parse_pdx) vorziehen.

### Phase 3 — Pipeline-Härtung (M)
**3a. Phasen-Isolation + Exitcodes** (`update/UPDATE_WIKI.py:456-559` + alle .bat):
- Geordnete Phasen-Tabelle `PHASES = [(key, callable), ...]` + `run_phase()` mit try/except: Fehler → `results[key] = {'error': ...}` + Traceback, Lauf geht weiter. Ersetzt auch die duplizierten if-Ketten des `--only`-Modus (Filter über die Tabelle).
- Exitcodes: 0 = sauber, 2 = fertig mit Phasen-Fehlern (Summary listet `FAILED PHASES`), 1 = Validation-Abbruch/Crash.
- `UPDATE.bat`: bei Exitcode 2 trotzdem committen/pushen (Commit-Message-Suffix „(with phase errors)"), nur bei 1/anderen abbrechen.

**3b. mtime-bewusste Skip-Logik** (`update/convert_ship_models.py:323-368` + Mega-Pendant):
- Statt reiner Existenzprüfung: Manifest `update/cache/model_manifest.json` (gitignored) mit `{max_source_mtime, hash(info)}` pro Output — deckt auch Scale-/Attachment-Änderungen in `.asset`/`.gfx` ab, nicht nur editierte `.mesh`. Bei Multi-Mesh alle Attachment-Quellen einbeziehen.
- Dabei `pdx_mesh_reader.py:228` (re-hardcoded `STNH_MOD_ROOT`) auf config-Import umstellen.

### Phase 4 — Pipeline-Korrektheit + Speed (M)
**4a. `parse_pdx.py`:** (mit Vorher/Nachher-Diff der `assets/`-Outputs absichern)
- Inline-Math `@[ ... ]` als ein Token lexen (bis zum schließenden `]`), Auswertung über bekannte `@vars` + sicheren Mini-Evaluator; Fallback: Literal-String behalten. Kritisch ist, den Tokenstrom nicht mehr zu desynchronisieren.
- Named-Block-Werte: Bareword aus `{hsv, rgb, hsv360, rgb255, cw}` gefolgt von `{` → Block konsumieren, `{'hsv': [...]}` liefern.
- Fixture-Selbsttests in `update/tests/test_parse_pdx.py` (manuell ausführbar, kein CI vorhanden).

**4b. Localisation nur einmal parsen:**
- Freshness-Skip in `parse_localisation.py`: mtime-Vergleich Quell-`.yml` vs. `assets/localisation/<lang>.json`; wenn Output aktuell → laden statt parsen.
- Techtree-Subprozess (`UPDATE_TECHTREE_FULL.py:210-214`): per Env-Var `STNH_LOC_CACHE` auf `assets/localisation/english.json` zeigen lassen statt eigenem Voll-Parse. Vorher prüfen: Haupt-Parser strippt `§…§!`-Formatcodes, Techtree-Kopie nicht — Diff von `localisation_map.json` auf Stichproben + grep im Techtree-JS nach `§`-Handling.
- Bewusst KEIN Merge der zwei Parser-/Config-Kopien (divergente Semantik, Standalone-Entrypoint) — Cache-Konsum statt Refactor.

**4c. `convert_icons.py` fail-fast (S):** `shutil.which('magick')` am Phasenstart, bei Fehlen `RuntimeError` (→ Exitcode 2 via 3a) und `_index.json` NICHT unvollständig schreiben.

**4d. `--only resources` (S):** Producer-Phasen in die `ONLY_MODULES['resources']`-Liste aufnehmen (fällt mit 3a fast gratis ab).

**4e. Hardcoded Pfade (S–M, niedrigste Prio):** `WIKI_ROOT` via `Path(__file__).parents[1]`, `STNH_MOD_ROOT`/`VANILLA_ROOT` via `os.environ.get(...)` mit aktuellem Default; Techtree-Skripte auf config-Import umstellen. Reiner Portabilitätswert.

### Phase 5 — Frontend-Korrektheit (M)
**5a. `js/ship-viewer.js`** (zweite Hälfte des sichtbaren 3D-Bugs):
- `dispose()`: `disposeMaterial()`-Helper, der ALLE Textur-Slots freigibt (map, normalMap, roughnessMap, metalnessMap, emissiveMap, aoMap, specularMap, envMap, alphaMap); `_renderer.forceContextLoss()` + `domElement.remove()` vor `dispose()`; `_container` leeren.
- Loader: Promise memoizen (`_threePromise`), 15s-Timeout-Reject, bei jedem Fehler `_threePromise = null` + injizierte Script-/Importmap-Nodes entfernen → nächster Klick retried sauber. Neuer UI-Key `ui.error.viewer_init_failed`.

**5b. `js/humanize.js` XSS (S–M):** `escapeHtml()` (vorher greppen, ob shared Util existiert) auf die interpolierten Daten in Z.91, 105, 113, 224, 411 anwenden — nur Daten escapen, nicht das selbstgebaute Markup. Caller von `leafText`/`'text'` vorher prüfen; nach Umstellung auf Doppel-Escaping (`&amp;amp;`) durchklicken.

**5c. `js/pages/empires.js` (S):** `_currentDetailItem`/`currentDetailItem` auf eine Variable vereinheitlichen.

### Phase 6 — Frontend-Performance (M)
- `js/global-search.js`: Haystack pro Item einmalig beim Index-Load vorberechnen (`item._hay`), Suche wird `includes` auf Fertig-String. **Achtung:** Haystack enthält `I18n.t(item.nk)` → bei `wiki-lang-changed` Cache invalidieren/neu bauen.
- `js/pages/hub.js:515-539`: Voll-Ergebnisse auf 50 Zeilen cappen + „Show more"-Button (keine echte Virtualisierung — over-engineered für No-Build-Site); Gesamtzahl im Header anzeigen.

### Phase 7 — i18n-Vervollständigung (L, mechanisch)
- `js/ui-strings.js`: je ~366 fehlende Keys für `spanish`, `polish`, `braz_por` ergänzen (de/fr/ru als Stil-Referenz; Vanilla-Stellaris-Loc unter dem Steam-Pfad als Glossar für Fachbegriffe, read-only).
- Ad-hoc-Checkskript: Key-Sets aller 7 Sprachen diffen. Neue Keys aus 5a mitnehmen. In Doku vermerken: ES/PL/PT maschinell übersetzt, Native-Review ausstehend.

### Aufwands-/Reihenfolgeübersicht

| # | Maßnahme | Aufwand | Abhängig von |
|---|----------|---------|--------------|
| 0 | Plan in Projektordner + GLBs pushen + .gitignore | S | — |
| 1 | `models/` in 5 .bat-Stage-Zeilen | S | — |
| 2 | Voller Pipeline-Lauf (Voth etc.) + Push | S | 1 |
| 3a | Phasen-Tabelle + Exitcodes 0/1/2 | M | — |
| 3b | Manifest-Skip-Logik Modelle | M | — |
| 4a | parse_pdx `@[...]` + `hsv{}` | M | 3a hilfreich |
| 4b | Loc-Cache + Techtree-Konsum | M | — |
| 4c/4d | Icons fail-fast, `--only resources` | S | 3a |
| 4e | Pfad-Cleanup | S–M | — (verschiebbar) |
| 5a | Ship-Viewer dispose + Loader-Recovery | M | — |
| 5b/5c | XSS-Escaping, empires-State | S–M | — |
| 6 | Such-Haystack + Hub-Cap | M | — |
| 7 | ES/PL/PT-UI-Strings | L | 5a (neue Keys) |

Phasen 0–2 beheben den Live-3D-Bug vollständig in einer Sitzung; alles danach ist Härtung, die genau diese Fehlerklasse künftig früh sichtbar macht (3a/3b hätten den Bug Monate früher gezeigt).

## Verifikation

**3D-Bug (Phasen 0–2):**
1. Nach Pages-Build: `curl -sI https://stnewhorizons.org/models/delta_02/<ship>.glb` → 200; Delta-/Vaadwaur-Schiff live öffnen, 3D-View lädt, Network-Tab ohne 404.
2. Nach Pipeline-Lauf: `models/voth_01/*.glb` vorhanden; `assets/ships.json` enthält Voth-Einträge mit `has_model:true` + `model_factions`; lokal via `python -m http.server 8000` Ships → Voth → 3D-Button rendert.

**Pipeline (Phasen 3–4):**
- Absichtliches `raise` in eine Phase injizieren → Lauf läuft weiter, Summary listet Fehler, `%ERRORLEVEL%` = 2, UPDATE.bat committet mit Warnung. Wieder entfernen.
- mtime-Test: `(Get-Item x.glb).LastWriteTime = '2020-01-01'` (nur git10) → Re-Konvertierung genau dieser Datei.
- Idempotenz als stärkstes Regressionssignal für 4a/4b: zwei volle Läufe auf unverändertem Mod → `git diff --stat assets/` muss leer sein; nach 4a dürfen sich nur Dateien ändern, deren Quellen `@[` oder `hsv {` enthalten (vorher per grep im Mod enumerieren).
- 4c: `magick` temporär aus PATH → Phase FAILED, `_index.json` unangetastet, Exit 2.

**Frontend (Phasen 5–6):**
- WebGL: 20+ Schiffs-/Fraktionswechsel mit offenem Viewer → Konsole ohne „Too many active WebGL contexts", `document.querySelectorAll('canvas').length` ≤ 1.
- Loader: CDN im DevTools-Network blockieren → Fehler-UI nach ≤15s; entsperren → nächster Klick funktioniert ohne Reload.
- XSS: Loc-Wert mit `<b>` muss auf Event-Detail-Seite literal erscheinen; DOM auf sichtbare `&amp;`-Artefakte prüfen (Doppel-Escaping).
- Suche: DevTools-Performance, Tastenanschlag vorher/nachher (Ziel <5ms Scripting); Sprachwechsel → Suche findet lokalisierte Namen weiterhin.

**i18n (Phase 7):** UI-Sprache auf es/pl/pt stellen, Hub/Ships/Events/Tech durchklicken — keine englischen UI-Labels mehr.

**Deployment generell:** Nach jedem Push Pages-Build abwarten, einen repräsentativen neuen Asset-URL per `curl -sI` prüfen + betroffene Live-Seite einmal manuell ansehen.
