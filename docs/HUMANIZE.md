# Humanize Engine (`js/humanize.js`)

## Ziel

Die Humanize-Engine uebersetzt geparste PDX-Script-Strukturen (JSON) in natuerliche Sprache.
Zielgruppe sind **Spieler ohne Modding-Kenntnisse** — die Ausgabe soll sich lesen wie ein
Wiki-Artikel, nicht wie Code. Dabei darf **keine Information verloren gehen**: auch interne
Mechaniken (Flags, Scopes, Event-Targets, hidden_effect) werden dargestellt, nur eben in
verstaendlicher Form.

## Architektur

```
Geparste PDX-Daten (JSON aus der Pipeline)
    |
    v
humanizeBlock(block, label)        ← Oeffentliche API
    |
    +-- Wenn label ein Weight-Typ ist  → humanizeAiWeight()
    |
    +-- humanizeItems(items, depth)    → iteriert ueber Array
         |
         +-- humanizeEntry(key, val, depth)  → Einzelner Key-Value
              |
              +-- TRIGGER_MAP[key]    → Bekannter Trigger
              +-- EFFECT_MAP[key]     → Bekannter Effekt
              +-- isScopeKey(key)     → Scope-Wechsel mit lesbarem Label
              +-- Vergleichs-Operator → "at least 10" statt ">= 10"
              +-- Numerischer Wert   → formatModifierValue() mit Farbe
              +-- @Variable          → Gedaempft dargestellt
              +-- Fallback           → locOrClean(key) = locOrClean(val)
```

## Komponenten

### 1. TRIGGER_MAP (~130 Eintraege)

Uebersetzt PDX-Trigger-Keywords in natuerliche Saetze:

| PDX-Syntax | Humanisierte Ausgabe |
|---|---|
| `has_ethic: ethic_militarist` | Has **Militarist** ethic |
| `is_at_war: yes` | Is at war |
| `is_gestalt: no` | Is not a Gestalt Consciousness |
| `has_technology: tech_warp_drive` | Has researched **Warp Drive** |
| `exists: FromFrom` | The source's source exists |
| `OR: [...]` | Inline: `X or Y` (einfach) oder "Any one of:" (komplex) |
| `NOT: [...]` | Inline: `Not: X` (einfach) oder "None of the following:" (komplex) |
| `any_owned_planet: [...]` | For any owned planet where: ... |
| `always: yes` | *Always* |

**Erweitern:** Neuen Eintrag in `TRIGGER_MAP` hinzufuegen. Funktions-Signatur:
- `(v) => string` — fuer einfache Key-Value-Paare
- `(v, d) => string` — fuer verschachtelte Bloecke (muss `nested(v, d)` aufrufen)

### 2. EFFECT_MAP (~120 Eintraege)

Uebersetzt PDX-Effekt-Keywords:

| PDX-Syntax | Humanisierte Ausgabe |
|---|---|
| `set_country_flag: "X"` | Set country flag *"X"* |
| `add_modifier: [...]` | Apply modifier **"Name"** for 30 days |
| `country_event: {id: X}` | Trigger event X (klickbarer Link) |
| `hidden_effect: [...]` | Behind the scenes: ... |
| `clone_leader: [...]` | Clone a leader: ... |
| `add_trait: {trait: X}` | Gain trait: **X** |
| `save_event_target_as: "X"` | Remember this as target *"X"* |
| `kill_leader: [...]` | Kill leader: ... |
| `response_text: "loc_key"` | Response text: [aufgeloester Text] (als Block) |
| `is_dialog_only: yes` | *Dialog only — no gameplay effects* |

**Erweitern:** Neuen Eintrag in `EFFECT_MAP` hinzufuegen, gleiche Signatur wie TRIGGER_MAP.

### 3. MODIFIER_MAP (~170 Eintraege) + formatModifierValue()

Uebersetzt numerische Stellaris-Modifier-Keys in lesbare, farbcodierte Werte:

| PDX-Syntax | Humanisierte Ausgabe |
|---|---|
| `planet_amenities_add: 500` | <span style="color:green">+500 Amenities</span> |
| `ship_fire_rate_mult: 0.15` | <span style="color:green">+15% Fire Rate</span> |
| `country_war_exhaustion_mult: -0.1` | <span style="color:green">-10% War Exhaustion</span> (gruen, weil weniger = gut) |
| `planet_crime_add: 10` | <span style="color:red">+10 Crime</span> (rot, weil mehr = schlecht) |

**Drei-Stufen-Aufloesung:**
1. Statische `MODIFIER_MAP` Lookup (Top ~170 Keys)
2. Pattern-basierter Fallback (`job_X_add` → "X Jobs", `pc_X_habitability` → "X Habitability", etc.)
3. `locOrClean(key)` als letzter Fallback

**Farb-Invertierung:** Manche Stats sind "invertiert" — ein positiver Wert ist schlecht
(Crime, War Exhaustion, Empire Size, etc.). Die Liste `invertedStats` sorgt dafuer,
dass diese rot statt gruen dargestellt werden.

**Erweitern:** Neuen Eintrag in `MODIFIER_MAP` hinzufuegen: `'modifier_key': 'Lesbarer Name'`.
Fuer neue invertierte Stats den Namen in `invertedStats` im `formatModifierValue()` hinzufuegen.

### 4. Scope-Labels (SCOPE_LABELS)

Ersetzt kryptische PDX-Scope-Woerter durch lesbare Beschreibungen:

| PDX-Scope | Anzeige |
|---|---|
| `owner` | The owner |
| `from` | The source |
| `fromfrom` | The source's source |
| `root` | The root scope |
| `capital_scope` | The capital planet |
| `event_target:the_dominion` | Target "the dominion" |
| `planet.owner` | The planet → The owner |

**Erweitern:** Neuen Eintrag in `SCOPE_LABELS` hinzufuegen.

### 5. Condition-Flattening

Einfache OR/AND/NOT-Bedingungen werden als Inline-Satz dargestellt statt als verschachtelter Baum:

- `OR: [{has_ethic: X}, {is_ai: yes}]` → `Has X ethic OR Is AI-controlled`
- `NOT: [{is_at_war: yes}]` → `Not: Is at war`

Kriterien fuer Inline-Darstellung: Maximal 5 Kinder, alle sind einfache Key-Value-Paare
(kein verschachteltes Array/Object als Wert). Bei komplexeren Bedingungen wird die
verschachtelte Baumdarstellung beibehalten.

### 6. AI-Weight-Zusammenfassung

Erkennt Weight/AI-Weight/Spawn-Chance-Bloecke am `label`-Parameter und stellt sie als
Zusammenfassung dar:

| PDX-Struktur | Anzeige |
|---|---|
| `weight: 10` | Base priority: 10 |
| `modifier: {factor: 0, ...}` | **Blocked** if [Bedingung] |
| `modifier: {factor: 2, ...}` | **More likely (×2)** if [Bedingung] |
| `modifier: {factor: 0.5, ...}` | **Less likely (×0.5)** if [Bedingung] |

Wird automatisch aktiviert wenn das Label eines `dualView()`-Blocks `weight`, `ai_weight`,
`spawn_chance`, `drop_weight` oder `mean_time_to_happen` heisst.

### 7. If/Else-Bloecke

If-Bloecke werden in zwei Teile zerlegt:

```
If the following is true:
    [Bedingungen aus dem limit-Block]
Then do:
    [Effekte]
Otherwise:
    [Else-Effekte]
```

## CSS-Klassen

| Klasse | Verwendung |
|---|---|
| `.h-line` | Einzelne Zeile in der Ausgabe |
| `.condition` | Eingerueckter verschachtelter Block (linker Rand) |
| `.negation` | NOT/NOR/NAND Labels (rot) |
| `.h-label` | Block-Label / Scope-Label (gold, fett) |
| `.h-behind-scenes` | Hidden effects, @Variablen, Logs (gedaempft, kursiv) |
| `.mod-positive` | Positiver Modifier-Wert (gruen) |
| `.mod-negative` | Negativer Modifier-Wert (rot) |
| `.cond-join` | Inline-Connector "or" / "and" (gold, Grossbuchstaben) |
| `.ai-never` | "Blocked" in AI-Weight (rot) |
| `.ai-boost` | "More likely" in AI-Weight (gruen) |
| `.ai-reduce` | "Less likely" in AI-Weight (orange) |
| `.ai-base` | Basis-Gewicht (gedaempft) |
| `.unknown` | Unbekannte Keys im Fallback (Monospace, gedaempft) |
| `.event-link` | Klickbare Event-Links mit `data-event-id` |

## Datenfluss: Wer ruft was auf?

```
events.html:   render.js → dualView(block, label) → Humanize.humanizeBlock(block, label)
8 Content Pages: pages/*.js → SharedRender.dualView(data, label) → Humanize.humanizeBlock(data, label)
```

Beide `dualView()`-Implementierungen erzeugen einen Toggle-Container mit Code-View
(`formatBlock()` → PDX-Syntax) und Human-View (`humanizeBlock()` → natuerliche Sprache).
Der `label`-Parameter wird durchgereicht, damit `humanizeBlock()` Weight-Bloecke erkennen kann.

## Haeufige Erweiterungsaufgaben

### Neues PDX-Keyword hinzufuegen

1. Pruefen ob Trigger oder Effekt → Eintrag in `TRIGGER_MAP` bzw. `EFFECT_MAP`
2. Einfache Werte: `'keyword': (v) => 'Lesbarer Text'`
3. Verschachtelte Bloecke: `'keyword': (v, d) => \`Label:\${nested(v, d)}\``
4. Fuer Block-Labels `<span class="h-label">` verwenden

### Neuen Modifier-Key hinzufuegen

1. Eintrag in `MODIFIER_MAP`: `'modifier_key': 'Lesbarer Name'`
2. Falls der Stat "invertiert" ist (mehr = schlechter): Namen in `invertedStats` in `formatModifierValue()` aufnehmen

### Neuen Scope hinzufuegen

1. Eintrag in `SCOPE_LABELS`: `'scope_key': 'Lesbare Beschreibung'`
2. Wird automatisch in `humanizeEntry()` erkannt und mit dem Label gerendert

### Neue yes/no-Checks hinzufuegen

Stellaris hat hunderte `is_X`-Checks. Pattern in TRIGGER_MAP:
```js
'is_new_thing': (v) => yn(v, 'Is a New Thing', 'Is not a New Thing'),
```
Die `yn(v, yes, no)` Hilfsfunktion waehlt den passenden Text basierend auf `yes`/`no`.
