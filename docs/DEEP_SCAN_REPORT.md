# Deep-Scan Bericht: Offene Enden & Inkonsistenzen

Stand: nach Commit `e2d188d`. Ziel: strukturiertes Backlog offener Issues,
die wir der Reihe nach abarbeiten können.

**Aktueller Fortschritt** (Stand nach dem Refactor-Sprint):
- ✅ Schritt 1 — Navi-Quickfixes (Commit `5c8a367`)
- ✅ Schritt 2 — Legacy-Pages gelöscht (Commit `fa14787`)
- ✅ Schritt 3 — traits.html aufgelöst (Commit `76d229d`)
- ✅ Schritt 4 — Toter Code (empires species marked cold storage, Commit `28e9586`)
- ✅ Schritt 5 — Dokumentations-Drift (dieser Commit)
- ⏳ Schritt 6 — Low-Prio Kosmetik offen

## Zusammenfassung

| Prio | Kategorie | Anzahl |
|---|---|---|
| HIGH | Tote/falsche Navigations-Links | 4 |
| HIGH | traits.html-Status ungeklärt | 1 |
| MEDIUM | Legacy-Pages ohne Nav | 3 |
| MEDIUM | Toter Code in Page-Controllern | 2 |
| MEDIUM | Dokumentations-Drift | 6 |
| LOW | Kleinere Inkonsistenzen | 4 |

---

## 1. traits.html — der Sonderfall, den wir explizit besprechen wollten

Commit `2163fab` hat aus `traits.html` die Tab-Buttons für **Traditions** und
**Ascension Perks** entfernt. Übrig ist genau ein sichtbarer Tab: `Traits`.

### Was damit aktuell zusammenhängt

- **`js/pages/traits.js`** lädt weiterhin alle drei Datensätze
  (`traits.json`, `traditions.json`, `ascension_perks.json`) und enthält den
  vollen Render-Code für alle drei Modi — inklusive des Tradition-Tree-Overlays
  (~180-200 Zeilen tote Render-Pipeline: `renderTraditionTrees`,
  `expandTraditionOverlay`, `collapseTraditionOverlay`,
  `buildTraditionOverlayHtml`, SVG-Pfeil-Zeichnung).
- **Tab-Switch-Logik** (Zeile 86-98): referenziert `activeTab === 'traditions'`
  und `activeTab === 'perks'` — die Pfade werden nie erreicht, weil die
  Buttons fehlen, aber der Code ist da.
- **URL-Tab-Handling** (Zeile 629-641): `?tab=traditions` oder `?tab=perks`
  würde versuchen, den Tab-Button per `document.querySelector(...)` zu
  finden — der existiert nicht → Fallback auf Default-Tab `traits`. Kein
  Absturz, aber Deep-Links in Suchergebnissen (falls welche entstehen)
  landen falsch.
- **CHANGE_MODULE_MAP** in `hub.js:158` zeigt immer noch `traits: page: 'traits.html', tab: null`.
  Das ist korrekt für Leader-Traits. `traditions` und `ascension_perks`
  zeigen seit `2163fab` auf `governments.html` — auch korrekt.
- **WIKI_LINK_MAP** in `shared-render.js:156`: `trait → traits.html?tab=traits`
  (richtig), `perk → governments.html?tab=perks` (richtig), `tradition →
  governments.html?tab=traditions` (richtig).
- **`common.js:96`** Nav-Highlight-Map: `traits.html → governments.html`.
  Das passt zur "Leader Traits gehört in Governance"-Entscheidung. Bleibt.

### Offene Kernfrage

Die physische Seite `traits.html` existiert nur für die Leader Traits und
hat exakt einen Tab. Drei Optionen, unterschiedlich radikal:

**A) Status quo + Cleanup**
- traits.html bleibt als eigenständige Leader-Traits-Seite bestehen.
- `traits.js` bekommt allen tot en Tradition-/Perk-Code entfernt.
- Die Tab-Buttons-Zeile in der HTML wird entweder ganz entfernt
  (es bleibt ja nur einer) oder bleibt zur visuellen Konsistenz stehen.

**B) Tabs wiederherstellen**
- Tab-Buttons für Traditions und Perks zurück in `traits.html`.
- Dann haben Traditions und Perks wieder **zwei** Pages (governments.html + traits.html),
  genau der Zustand, den wir vor `2163fab` als "Redundanz" aufgelöst haben.
- Nicht empfohlen — verschiebt das Problem nur zurück.

**C) traits.html vollständig auflösen**
- Leader-Traits-Tab aus `empires.html` (wurde zuletzt dort entfernt) zurück in `empires.html` oder neu als Tab auf `governments.html`.
- `traits.html` löschen.
- `WIKI_LINK_MAP.trait`, `MODULE_PAGES['traits']`, `common.js HUB_MAP`, nav-links — alles anpassen.
- Grösster Refactor-Schritt, saubernste Endlösung.

Dein Call. Ich tendiere zu **A** — minimaler Fix, Code wird aufgeräumt,
keine User-facing Änderung. Sag Bescheid.

---

## 2. HIGH — Tote Navigations-Links (Global Search / Hub Update-Notes)

### 2.1 `CHANGE_MODULE_MAP.empires` zeigt falsch
**Datei:** `js/pages/hub.js:171`
```js
empires: { label: 'Empires', page: 'exploration.html', tab: 'empires' },
```
`exploration.html` hat keinen `empires`-Tab (nur anomalies + archaeology).
Wenn ein neues Empire in den Update-Notes auf dem Hub auftaucht, führt der
"Details"-Link ins Leere.
**Fix:** `page: 'empires.html'` (der `tab: 'empires'` passt dann).

### 2.2 `CHANGE_MODULE_MAP.anomalies` + `archaeology` gehen auf exploration.html
Zeilen 169-170. Das ist technisch korrekt (`exploration.html` hat beide Tabs),
aber inkonsistent mit dem Rest der Welt, in der der Cross-Link über
`WIKI_LINK_MAP` läuft. Funktioniert, aber erwähnen.

### 2.3 Fehlender `councilor`-Typ im `WIKI_LINK_MAP`
**Datei:** `js/shared-render.js:145-164`

Der Typ `councilor` ist nicht registriert. Cross-Links aus anderen Seiten
zu Councilor-Items (falls welche im Text vorkommen) würden nicht auflösen.
**Fix:** Einen Eintrag hinzufügen:
```js
councilor: { page: 'governments.html', param: 'search', tab: 'councilors' },
```

### 2.4 `CHANGE_MODULE_MAP` für `jobs/buildings/governments/traits/ships`
hat `tab: null` — das landet auf dem Default-Tab der Zielseite. Für z.B.
`jobs` auf economy.html wird so die Buildings-Seite gezeigt, nicht Jobs.
Sollte `tab: 'jobs'` werden (ähnlich für `buildings: 'buildings'`).

---

## 3. HIGH — Redundante Legacy-Pages ohne Nav-Anbindung

Drei HTML-Seiten existieren noch, werden aber nicht mehr verlinkt:

| Seite | Status | Lade-JS | Bemerkung |
|---|---|---|---|
| `buildings.html` | nicht im Nav | `js/pages/buildings.js` | Buildings+Districts zeigt `economy.html` vollständiger |
| `megastructures.html` | nicht im Nav | `js/pages/megastructures.js` | Megastructures+Relics zeigt `economy.html` vollständiger |
| `anomalies.html` | nicht im Nav | `js/pages/anomalies.js` | Anomalies+Archaeology zeigt `exploration.html` |

**Effekte:**
- Direkter URL-Tipp funktioniert noch.
- `common.js HUB_MAP` leitet Nav-Highlight auf die konsolidierte Page.
- Suchmaschinen könnten Duplicate-Content-Signal bekommen (beide Pages
  indexieren mit sehr ähnlichem Inhalt).
- Wartung: jede renderPagination- / wikiLink- / placeholder-Änderung muss
  6× statt 3× gemacht werden (wir haben das gerade mit der Pagination
  so gemacht — Zeit kostet das).

**Empfehlung:** die drei HTML-Seiten und ihre JS-Controller löschen
(`buildings.js`, `megastructures.js`, `anomalies.js`).
Redirect-HTMLs optional (301 via meta-refresh) für Bookmarks. Auch das
`HUB_MAP` in `common.js:89-97` kann dann um drei Einträge schrumpfen.

---

## 4. MEDIUM — Toter Code in Page-Controllern

### 4.1 `js/pages/traits.js` — siehe Abschnitt 1

### 4.2 `js/pages/empires.js` — Species-Tab-Logik verwaist
Der Species-Tab-Button wurde in Commit `2163fab` aus der HTML entfernt,
aber der Controller ist voll:
- `empires.js:42`, `:164`, `:377`: `activeTab === 'species'`-Abfragen zur
  Filter-Sichtbarkeit
- `:134`: Archetype-Dropdown-Population
- `:107,113`: `species.json` wird weiterhin geladen
- `:283-297`: vollständiger Species-Render-Pfad

**Begründung**, diesen Code *nicht* zu löschen: du hast gesagt, Species
kommt eines Tages zurück. Der Code ist erreichbar per `?tab=species`-URL
(der URL-Override in `empires.js:370-382` würde funktionieren, wenn der
Tab-Button wieder im HTML ist).

**Empfehlung**: Kommentar setzen `// Species tab hidden in UI, keep code for re-enable`
an den `species`-Referenzen. Dann explizit sichtbar, dass Cold Storage.

### 4.3 `js/pages/economy.js` — unreferenziert
Die Datei existiert, wird aber von keiner HTML geladen (`economy.html` nutzt
`economy-hub.js`). Kandidat zum Löschen.

---

## 5. MEDIUM — `common.js` Nav-Highlight-Drift

**Datei:** `js/common.js:89-97` (`HUB_MAP`):

```js
'anomalies.html': 'exploration.html',
'tech-list.html': 'tech-list.html',
'tech.html':      'tech-list.html',
'empires.html':   'empires.html',
'buildings.html': 'economy.html',
'megastructures.html': 'economy.html',
'traits.html':    'governments.html',
```

Zwei Punkte:
- `empires.html: 'empires.html'` — die Map braucht das eigentlich nicht,
  weil der Fallback `hubTarget = HUB_MAP[currentPage] || currentPage` genau
  das macht. Kann raus.
- Wenn wir die drei Legacy-Pages in §3 löschen, schrumpft die Map auf
  drei Einträge (`tech-list → tech-list`, `tech → tech-list`, `traits → governments`).

---

## 6. MEDIUM — Dokumentations-Drift

CLAUDE.md, DOCUMENTATION.md, docs/FRONTEND.md u.a. enthalten veraltete
Fakten. Nichts davon funktionsschädigend, aber irreführend für neue
Entwickler/Entwicklerinnen:

| Datei:Zeile | Stand dort | Realität |
|---|---|---|
| `CLAUDE.md:9` | "11 HTML pages" | 13 (siehe `ls *.html`) |
| `CLAUDE.md:9,35` | "53 JS files" | 59 (`find js/ -name '*.js' \| wc -l`) |
| `CLAUDE.md:9,44` | "77 Python pipeline files (50+27)" | 84 (57+27) |
| `DOCUMENTATION.md:13,95` | "38 JSON-Dateien" | >40 (core + tech + localisation Subdirs zählen) |
| `docs/FRONTEND.md:32` | `initFontSize()` dokumentiert | wurde in Commit `2c8869b` entfernt |
| `CLAUDE.md:9, FRONTEND.md:51, ARCHITECTURE.md:115` | "~19.740 searchable items" | 21.630 nach dem Species-Remove; Zahl sollte generiert/nicht hart kodiert sein |

Dazu Inhaltliches:
- Mehrere Docs (CLAUDE.md, DOCUMENTATION.md:217,474, FRONTEND.md:14,
  PIPELINE.md:37) sagen traits.html habe "Traits/Traditions/Perks".
  Stimmt seit `2163fab` nicht mehr.
- Die Hybrid-Resolver-Strategie und `_index.json`-Pro-Kategorie-Konvention
  sind in `docs/PIPELINE.md` teilweise drin, aber die neueste Iteration
  (relic portrait→icon) ist noch nicht dokumentiert.

---

## 7. LOW — Kleinere Inkonsistenzen

- **i18n-Keys**: `ui.tab.species`, `ui.tab.traditions`, `ui.tab.perks` in
  `js/ui-strings.js` werden weiter gebraucht (Stats-Label in Hub-Box
  und als Labels für die aktuell versteckten Tabs), nicht löschen.
  Aber wir haben keine Tests, die ungenutzte Keys finden. Irgendwann
  aufräumen.
- **`empires.html` Tab `traits` (Leader Traits)**: wir haben in der
  Governance-Box den Leader-Traits-Eintrag gesetzt (Zeile 64 in hub.js).
  Der Tab im `empires.html` existiert aber **auch noch** (Zeile 93).
  Doppelter Entry Point. Entscheidungs-Issue — soll der Tab aus
  empires.html raus, analog zu species?
- **`assets/species.json`** wird weiter generiert, aber nicht mehr
  konsumiert (Search-Index off, kein Tab). Pipeline-Arbeit die verpufft,
  bis Species zurückkommt. Okay, bewusst so.
- **Tech**: `tech-list.html` und `tech.html` sind beide live. tech.html
  ist der interaktive D3-Tree, tech-list.html die flache Liste.
  `MODULE_PAGES['tech']: 'tech.html'` — d.h. Search-Klicks gehen zur
  Tree-View. Vielleicht möchte man Listen-Treffer eher zur
  List-View leiten? Design-Frage.

---

## Empfohlene Fix-Reihenfolge

1. **Navigations-Fixes** (Abschnitt 2 — low risk, quick wins)
   - `CHANGE_MODULE_MAP.empires` Fix (Zeile hub.js:171)
   - `councilor` in `WIKI_LINK_MAP` hinzufügen
   - `CHANGE_MODULE_MAP` `tab: null` → korrekte tab-IDs
2. **traits.html Entscheidung** (Abschnitt 1 — Option A/B/C klären, dann ausführen)
3. **Legacy-Pages löschen** (Abschnitt 3 — ca. 6 Dateien weg, HUB_MAP schrumpft)
4. **Doku-Drift** (Abschnitt 6 — einmal durchziehen, Zahlen aktualisieren)
5. **Toter Code aufräumen** (Abschnitt 4 — traits.js, empires.js, economy.js)
6. **Low-Prio kosmetisch** wenn wir Langeweile haben

Ich empfehle Reihenfolge 1 → 3 → 2 → 5 → 4 → 6. Schritt 2 (traits.html)
zwischen die einfachen und aufwändigen weil das potentiell weitere
Kaskaden-Änderungen auslöst.
