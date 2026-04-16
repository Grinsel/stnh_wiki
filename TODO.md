# STNH Wiki – Master TODO

> Off-Game Wiki für die Star Trek: New Horizons Mod (Stellaris).
> Ziel: Alle spielrelevanten Daten der Mod als durchsuchbare, verlinkte Website bereitstellen.
> Ansatz: Schrittweise – jede Sektion ist ein eigenständiges Modul mit eigenem Python-Pipeline-Schritt und eigener Web-Seite.
> Datenquelle: `git01/New-Horizons-Development` (read-only)
> Techtree-Daten: Kopie aus `git09/stnh_techtree_interactive` (git09 bleibt unangetastet – live Website!)
> Projekt-Ort: `git10/stnh_wiki`
> Design: Vanilla HTML/CSS/JS, dunkles Star-Trek-Theme (wie Event Browser), keine Frameworks.

---

## Phase 0 – Projekt-Grundlage

- [x] **0.1 Projekt-Skelett erstellen**
  - Verzeichnisstruktur: `update/`, `assets/`, `js/`, `fonts/`, `pictures/`, `icons/`
  - `update/config.py` mit Pfaden zu git01-Mod und git10-Wiki
  - `update/parse_pdx.py` – Kopie des bewährten rekursiven Parsers aus dem Event Browser
  - `update/parse_localisation.py` – Kopie aus dem Event Browser
  - `.gitignore`, `requirements.txt`

- [x] **0.2 Gemeinsames Frontend-Gerüst**
  - `index.html` – Landing Page / Hub mit Navigation zu allen Sektionen
  - `style.css` – Basis-Theme (dark, Star-Trek-Fonts, responsive)
  - `js/data.js`, `js/state.js`, `js/i18n.js`, `js/search.js` – Kern-Module
  - 7-Sprachen-Support von Anfang an

- [x] **0.3 Shared Data Pipeline**
  - `update/UPDATE_WIKI.py` – Master-Orchestrator (wie `UPDATE_EVENTS.py`)
  - Phase-System: Validation → Localisation → GFX → Module → JSON-Output
  - `update/parse_localisation.py` → `assets/localisation/*.json`
  - `update/parse_gfx_mappings.py` → `assets/pictures_map.json`

- [x] **0.4 GitHub Pages Deployment**
  - `.github/workflows/deploy.yml`
  - `UPDATE.bat` / `UPDATE_QUICK.bat`

---

## Phase 1 – Events (Event Browser Migration)

- [x] **1.1 Event-Pipeline aus git10/stnh_event_browser übernehmen**
  - Parser bereits vorhanden – adaptieren für Wiki-Struktur
  - Output: `assets/events_index.json`, `assets/events_detail/*.json`
  - Event-Bilder: `pictures/*.webp`

- [x] **1.2 Event-Browser Web-Seite**
  - Bestehendes Frontend portieren in Wiki-Layout
  - Filter, Suche, Namespace-Navigation, Detail-Panel, Chain-Viewer

- [x] **1.3 Verlinkung: Events ↔ andere Module**
  - Events ↔ Techs, Events ↔ Gebäude, Events ↔ Relics, etc.

---

## Phase 2 – Schiffe & Komponenten

- [x] **2.1 Ship Parser**
  - `update/parse_ships.py`
  - Quellen: `common/ship_sizes/` (47 Dateien)
  - Daten: Name, Klasse, Größe, HP, Sektionen, Required Tech, Faction
  - Output: `assets/ships.json`

- [x] **2.2 Component Parser**
  - `update/parse_components.py`
  - Quellen: `common/component_templates/` (97 Dateien)
  - Daten: Name, Typ (Waffe/Schild/Antrieb/etc.), Tier, Stats, Required Tech
  - Output: `assets/components.json`

- [x] **2.3 Schiffe & Komponenten Web-Seite**
  - Schiffsliste mit Filtern (Klasse, Faction, Tier)
  - Schiff-Detailansicht mit Sektionen und möglichen Komponenten
  - Komponenten-Liste mit Vergleich
  - Verlinkung: Schiff ↔ Tech, Komponente ↔ Tech

- [x] **2.4 3D Ship Model Viewer**
  - `update/parse_ship_models.py` — .gfx/.asset Parser -> ship_models_map.json
  - `update/pdx_mesh_reader.py` — PdxMesh Binaer-Parser (@@b@ Header)
  - `update/convert_ship_models.py` — .mesh+.dds -> .glb (pygltflib + Pillow)
  - `js/ship-viewer.js` — Three.js GLB Viewer (lazy-loaded, IIFE)
  - 275 Ships, 1.263 Fraktionsvarianten als interaktive 3D-Modelle
  - Fraktions-Dropdown zum Umschalten, Auto-Rotate, OrbitControls

---

## Phase 3 – Gebäude & Distrikte

- [x] **3.1 Building Parser**
  - `update/parse_buildings.py`
  - Quellen: `common/buildings/` (36 Dateien)
  - Daten: Name, Kategorie, Kosten, Unterhalt, Modifiers, Jobs, Required Tech, Upgrade-Pfad
  - Output: `assets/buildings.json`

- [x] **3.2 District Parser**
  - `update/parse_districts.py`
  - Quellen: `common/districts/`
  - Output: `assets/districts.json`

- [x] **3.3 Gebäude & Distrikte Web-Seite**
  - Gebäudeliste mit Filtern (Kategorie, Tier, Faction)
  - Detail-Panel mit Kosten, Jobs, Modifiers
  - Upgrade-Ketten visualisieren
  - Verlinkung: Gebäude ↔ Tech, Gebäude ↔ Jobs

---

## Phase 4 – Traits & Traditionen

- [x] **4.1 Trait Parser**
  - `update/parse_traits.py`
  - Quellen: `common/traits/` (50 Dateien)
  - Daten: Name, Typ (Species/Leader/Ruler), Kosten, Modifiers, Gegensätze
  - Output: `assets/traits.json`

- [x] **4.2 Tradition Parser**
  - `update/parse_traditions.py`
  - Quellen: `common/traditions/` (38 Dateien)
  - Daten: Name, Kategorie, Stufe, Effekte, Adoption/Finish-Boni
  - Output: `assets/traditions.json`

- [x] **4.3 Ascension Perks Parser**
  - `update/parse_ascension_perks.py`
  - Quellen: `common/ascension_perks/` (2 Dateien)
  - Output: `assets/ascension_perks.json`

- [x] **4.4 Traits & Traditionen Web-Seite**
  - Trait-Browser mit Filtern (Typ, Kosten, Effekt-Kategorie)
  - Traditions-Bäume visualisieren
  - Ascension-Perks-Übersicht
  - Verlinkung: Trait ↔ Species, Tradition ↔ Tech

---

## Phase 5 – Regierung & Diplomatie

- [x] **5.1 Government Parser**
  - `update/parse_governments.py`
  - Quellen: `common/governments/` (27 Dateien), `common/governments/authorities/`, `common/governments/civics/`
  - Daten: Regierungstyp, Ethik-Anforderungen, Civics, Boni
  - Output: `assets/governments.json`

- [x] **5.2 Policies & Edicts Parser**
  - `update/parse_policies.py`, `update/parse_edicts.py`
  - Quellen: `common/policies/`, `common/edicts/`
  - Output: `assets/policies.json`, `assets/edicts.json`

- [x] **5.3 Regierung & Diplomatie Web-Seite**
  - Regierungsformen-Browser
  - Civic-Katalog
  - Policy- und Edikt-Übersicht
  - Verlinkung: Government ↔ Ethik, Civic ↔ Tech

- [x] **5.4 Councilors Parser**
  - `update/parse_councilors.py`
  - Quellen: `common/governments/councilors/` (9 Dateien)
  - Civic-Fallback: Icon aus `possible { has_valid_civic }` wenn kein eigenes Icon
  - Output: `assets/councilors.json`

---

## Phase 6 – Megastrukturen & Relics

- [x] **6.1 Megastructure Parser**
  - `update/parse_megastructures.py`
  - Quellen: `common/megastructures/` (51 Dateien)
  - Daten: Name, Stufen, Kosten, Bauzeit, Effekte, Required Tech/Ascension Perk
  - Output: `assets/megastructures.json`

- [x] **6.2 Relics Parser**
  - `update/parse_relics.py`
  - Quellen: `common/relics/` (16 Dateien)
  - Daten: Name, Passive Effekte, Aktive Effekte, Cooldown, Trigger
  - Output: `assets/relics.json`

- [x] **6.3 Megastrukturen & Relics Web-Seite**
  - Mega-Galerie mit Baustufen
  - Relics-Katalog
  - Verlinkung: Mega ↔ Tech, Mega ↔ Ascension Perk

---

## Phase 7 – Anomalien & Archäologie

- [x] **7.1 Anomaly Parser**
  - `update/parse_anomalies.py`
  - Quellen: `common/anomalies/`
  - Daten: Name, Kategorie, Mögliche Ergebnisse, Trigger
  - Output: `assets/anomalies.json`

- [x] **7.2 Archaeological Sites Parser**
  - `update/parse_archaeology.py`
  - Quellen: `common/archaeological_site_types/`
  - Daten: Name, Kapitel, Belohnungen, Narrative
  - Output: `assets/archaeology.json`

- [x] **7.3 Anomalien & Archäologie Web-Seite**
  - Anomalie-Browser
  - Archäologie-Storylines mit Kapitel-Darstellung
  - Verlinkung: Anomalie ↔ Event, Archäologie ↔ Event ↔ Relic

---

## Phase 8 – Fraktionen & Empires

- [x] **8.1 Prescripted Countries Parser**
  - `update/parse_empires.py`
  - Quellen: `prescripted_countries/`
  - Daten: Name, Species, Ethik, Government, Civics, Traits, Origin, Schiffe, Startposition
  - Output: `assets/empires.json`

- [x] **8.2 Species & Portraits Parser**
  - `update/parse_species.py`
  - Quellen: `common/species_classes/`, `common/species_archetypes/`, Portrait-Dateien
  - Output: `assets/species.json`

- [x] **8.3 Fraktionen & Empires Web-Seite**
  - Fraktions-Enzyklopädie mit Portraits
  - Empire-Steckbriefe (Government, Ethik, Traits, Ships)
  - Species-Katalog
  - Verlinkung: Fraktion ↔ Ships, Fraktion ↔ Techs, Fraktion ↔ Events

---

## Phase 9 – Ressourcen & Wirtschaft

- [x] **9.1 Jobs Parser**
  - `update/parse_jobs.py`
  - Quellen: `common/pop_jobs/` (31 Dateien)
  - Output: `assets/jobs.json`

- [x] **9.2 Deposits Parser**
  - `update/parse_deposits.py`
  - Quellen: `common/deposits/` (27 Dateien)
  - Output: `assets/deposits.json`

- [x] **9.3 Wirtschaft Web-Seite**
  - Job-Übersicht mit Produktion/Konsum
  - Deposit-Katalog
  - Verlinkung: Job ↔ Building, Deposit ↔ Planet-Typ

---

## Phase 10 – Suche & Vernetzung (Cross-Module)

- [x] **10.1 Globale Volltextsuche**
  - Über alle Module hinweg suchen
  - Suchindex: `assets/search_index.json` (19.740 Items, 2.6 MB)
  - Prefix-basiert: `ship:`, `event:`, `building:`, `trait:`, `civic:`, `mega:`, etc.

- [x] **10.2 Cross-Referenz-System**
  - Bidirektionale Links zwischen allen Modulen generieren
  - `assets/cross_references.json` (303 KB)
  - Tech → 1.231 Tech-Unlock-Mappings, 307 Building-Upgrade-Chains, 56 Anomalie-Events, 29 Archäologie-Events, 110 Empire-Refs

- [x] **10.3 Landing Page / Hub**
  - Statistik-Dashboard: Anzahl pro Modul (Events, Ships, Buildings, etc.)
  - Zuletzt aktualisiert (Timestamp aus last_update.json)
  - Quick-Links zu allen Sektionen (klickbare Stat-Cards)
  - Globale Suche direkt auf der Hub-Seite

---

## Phase 11 – Techtree (Kopie aus git09 → Wiki integrieren)

> **WICHTIG:** git09/stnh_techtree_interactive ist eine öffentliche Live-Website!
> Wir erstellen eine **Kopie** des Projekts ins Wiki und arbeiten nur an der Kopie.
> git09 bleibt unangetastet, bis die Wiki-Version vollständig funktioniert.
> Erst wenn alles läuft: git09 archivieren und auf Wiki-Techtree umleiten.

- [x] **11.1 Kopie des Techtree-Projekts anlegen**
  - Relevante Dateien aus git09 nach `stnh_wiki/` kopiert (git09 unverändert!)
  - Frontend (tech.html, js/tech/, tech_showcase.js), Assets (assets/tech/), Icons (icons/tech/, icons/unlock_types/)
  - Pfade angepasst (HTML, JS fetch(), Icon-Pfade, config.py)
  - Hub-Navigation aktiviert, UPDATE_WIKI.py erweitert (techtree stub)
  - ~1.750 Dateien, ~33 MB

- [ ] **11.2 Techtree-Parser in Wiki-Pipeline integrieren**
  - Pipeline kopiert nach `update/techtree/` (27 Scripts), aber noch nicht lauffähig
  - `balance_center_bridge.py` benötigt `balance_center/` (existiert nicht in git01)
  - `update/parse_technologies.py` – Balance-Center-Bridge adaptieren oder ersetzen
  - Component/Ship-Name/Reverse-Unlock Parser übernehmen
  - In `UPDATE_WIKI.py` einbinden
  - Output: `assets/technologies.json`, `icons/tech/`

- [~] **11.3 Techtree Web-Seite im Wiki** (teilweise fertig)
  - [x] `tech.html` – D3.js Graph-Visualisierung eingebettet
  - [x] `showcase.js` + Layout-Engines portiert ins Wiki-Layout
  - [x] Filter: Area, Tier, Faction, Kategorie, Unlock-Typ
  - [x] Tech-Detail-Panel mit Icon, Beschreibung, Prerequisites, Unlocks
  - [x] Tier-Layout als Default-Ansicht (statt Force-Directed)
  - [x] Tech-Header entfernt (Beta-Badge, Title)
  - [x] Prerequisites mit klickbaren Links
  - [x] Tech-Item-Map: Cross-Reference welche Items eine Tech freischaltet
  - [ ] Weitere UI-Verfeinerungen offen

- [~] **11.4 Verlinkung: Tech ↔ andere Module** (teilweise fertig)
  - [x] Tech-Item-Map (`tech_item_map.json`): Tech → Ships, Buildings, Components
  - [x] Prerequisites-Links innerhalb des Techtrees
  - [ ] Techs ↔ Events, Techs ↔ weitere Module

- [ ] **11.5 git09 ablösen**
  - Wiki-Techtree verifizieren (Feature-Parität mit git09)
  - git09 archivieren / Redirect auf Wiki setzen

- [ ] **11.6 Tech Tree Lokalisierung**
  - Techtree aus git09 importiert, hat nur englische Einträge
  - Lokalisierungsdaten für Techs aus git01 localisation/ extrahieren
  - 7-Sprachen-Support wie bei allen anderen Modulen

---

## Cross-Module Wiki-Links (erledigt)

- [x] **Universelle Cross-Links zwischen Wiki-Items**
  - `SharedRender.wikiLink(itemId, type, displayName)` + `initWikiLinks(container)`
  - 18 Typen: event, building, district, megastructure, civic, authority, government, tradition, policy, edict, trait, perk, anomaly, archaeology, technology, ship, component, empire
  - `WIKI_LINK_MAP` steuert Ziel-Seite + Tab + Query-Parameter
  - Implementiert in: anomalies.js, exploration.js, buildings.js, governments.js, traits.js, megastructures.js, empires.js, economy-hub.js
  - CSS: `.wiki-link` mit Theme-Farben (`--accent` / `--accent-bright`)

---

## Component-Icons (erledigt)

- [x] **Ship-Component-Icons in Liste, Detail und Global Search**
  - Pipeline: neue Icon-Kategorie `components` in `convert_icons.py`
  - Neuer Hybrid-Resolver: GFX-Resolve via `pictures_map.json` zuerst, dann
    rekursiver Direct-Scan ueber `gfx/interface/icons/ship_parts/**/` als Fallback
  - Mod ueberschreibt Vanilla automatisch; Vanilla-Components bekommen Vanilla-Icons
  - Output: `icons/components/*.webp` (3.913 Dateien)
  - Search-Index: neues Top-Level-Feld `i` fuer Components (`GFX_`-Prefix
    entfernt), `GlobalSearch.getIconHtml(item, cls)` rendert Icons in Preview,
    Full-Results und Content-Page-Overlay-Dropdown
  - Frontend: `item-card-icon-inline` in Liste (24px), `detail-icon` in
    Detail-Panel (48px), beide mit `onerror`-Fallback

---

## Zukünftige Ideen (Backlog)

- [ ] Name Lists Browser (168 Dateien – Namens-Generatoren)
- [ ] Starbase-Modul-Katalog
- [x] Galaxy Map (Empire-Startpositionen, eingebettet in Empires-Seite, Canvas-basiert)
- [ ] Übersetzungs-Dashboard (Vergleich der 7 Sprachen, fehlende Keys)
- [ ] Mod-Changelog / Version-Tracker
- [ ] Community-Beitrags-System (GitHub Issues Integration)
- [ ] Druckbare Faction-Guides (PDF-Export)

---

## Architektur-Notizen

### Verzeichnisstruktur (Ziel)
```
stnh_wiki/
├── index.html                    # Hub / Landing Page
├── events.html                   # Event Browser
├── tech.html                     # Techtree
├── ships.html                    # Schiffe & Komponenten
├── buildings.html                # Gebäude & Distrikte
├── traits.html                   # Traits & Traditionen
├── governments.html              # Regierung & Diplomatie
├── megastructures.html           # Megastrukturen & Relics
├── anomalies.html                # Anomalien & Archäologie
├── empires.html                  # Fraktionen & Empires
├── economy.html                  # Wirtschaft
├── style.css                     # Gemeinsames Theme
├── js/                           # Shared JS-Module
│   ├── data.js
│   ├── state.js
│   ├── i18n.js
│   ├── search.js
│   ├── filters.js
│   ├── render.js
│   └── main.js
├── fonts/
├── assets/                       # Generierte JSON-Daten
│   ├── localisation/
│   ├── events_index.json
│   ├── technologies.json
│   ├── ships.json
│   ├── ...
│   └── cross_references.json
├── pictures/                     # Event-Bilder (WebP)
├── icons/                        # Tech/Item-Icons (WebP)
├── update/                       # Python Data Pipeline
│   ├── UPDATE_WIKI.py            # Master-Orchestrator
│   ├── config.py
│   ├── parse_pdx.py
│   ├── parse_localisation.py
│   ├── parse_events.py
│   ├── parse_technologies.py
│   ├── parse_ships.py
│   ├── parse_buildings.py
│   ├── ...
│   └── requirements.txt
├── .github/workflows/deploy.yml
├── UPDATE.bat
└── UPDATE_QUICK.bat
```

### Design-Prinzipien
1. **Kein Build-System** – Vanilla HTML/CSS/JS, direkt im Browser lauffähig
2. **Ein Parser pro Modul** – Jeder Datentyp hat seinen eigenen Parser
3. **Shared PDX-Parser** – `parse_pdx.py` ist die gemeinsame Basis
4. **JSON als Zwischenformat** – Python generiert JSON, JS rendert
5. **Progressive Enhancement** – Jedes Modul funktioniert standalone
6. **Cross-References optional** – Module verlinken sich, sind aber unabhängig
7. **7-Sprachen-Support** – Von Anfang an eingebaut
