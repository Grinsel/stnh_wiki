/**
 * UI string translations for the STNH Wiki interface.
 * Mod content (item names, descriptions) is handled separately by I18n.t().
 * This file handles navigation, tabs, filters, labels, messages etc.
 */
const UI_STRINGS = {
    // ==========================================
    // Navigation
    // ==========================================
    'ui.nav.hub':             { english: 'Hub', german: 'Hub' },
    'ui.nav.events':          { english: 'Events', german: 'Ereignisse' },
    'ui.nav.tech':            { english: 'Tech Tree', german: 'Technologiebaum' },
    'ui.nav.ships':           { english: 'Ships', german: 'Schiffe' },
    'ui.nav.buildings':       { english: 'Buildings', german: 'Geb\u00e4ude' },
    'ui.nav.traits':          { english: 'Traits', german: 'Eigenschaften' },
    'ui.nav.governments':     { english: 'Governments', german: 'Regierungen' },
    'ui.nav.megastructures':  { english: 'Megastructures', german: 'Megastrukturen' },
    'ui.nav.anomalies':       { english: 'Anomalies', german: 'Anomalien' },
    'ui.nav.empires':         { english: 'Empires', german: 'Imperien' },
    'ui.nav.economy':         { english: 'Economy', german: 'Wirtschaft' },

    // ==========================================
    // Tab Buttons
    // ==========================================
    'ui.tab.ships':           { english: 'Ships', german: 'Schiffe' },
    'ui.tab.models':          { english: 'Models', german: 'Modelle' },
    'ui.tab.components':      { english: 'Components', german: 'Komponenten' },
    'ui.tab.buildings':       { english: 'Buildings', german: 'Geb\u00e4ude' },
    'ui.tab.districts':       { english: 'Districts', german: 'Bezirke' },
    'ui.tab.traits':          { english: 'Traits', german: 'Eigenschaften' },
    'ui.tab.traditions':      { english: 'Traditions', german: 'Traditionen' },
    'ui.tab.perks':           { english: 'Ascension Perks', german: 'Aufstiegsvorteile' },
    'ui.tab.governments':     { english: 'Governments', german: 'Regierungen' },
    'ui.tab.civics':          { english: 'Civics', german: 'B\u00fcrgerrechte' },
    'ui.tab.authorities':     { english: 'Authorities', german: 'Autoritäten' },
    'ui.tab.policies':        { english: 'Policies', german: 'Richtlinien' },
    'ui.tab.edicts':          { english: 'Edicts', german: 'Edikte' },
    'ui.tab.megastructures':  { english: 'Megastructures', german: 'Megastrukturen' },
    'ui.tab.relics':          { english: 'Relics', german: 'Relikte' },
    'ui.tab.anomalies':       { english: 'Anomalies', german: 'Anomalien' },
    'ui.tab.archaeology':     { english: 'Archaeology', german: 'Archäologie' },
    'ui.tab.empires':         { english: 'Empires', german: 'Imperien' },
    'ui.tab.species':         { english: 'Species', german: 'Spezies' },
    'ui.tab.jobs':            { english: 'Jobs', german: 'Berufe' },
    'ui.tab.deposits':        { english: 'Deposits', german: 'Lagerstätten' },
    'ui.view.list':           { english: '☰ List', german: '☰ Liste' },
    'ui.view.map':            { english: '✦ Galaxy Map', german: '✦ Galaxie-Karte' },

    // ==========================================
    // Filter Labels & Default Options
    // ==========================================
    'ui.filter.class':           { english: 'Class', german: 'Klasse' },
    'ui.filter.all_classes':     { english: 'All Classes', german: 'Alle Klassen' },
    'ui.filter.size':            { english: 'Size', german: 'Gr\u00f6\u00dfe' },
    'ui.filter.all_sizes':       { english: 'All Sizes', german: 'Alle Gr\u00f6\u00dfen' },
    'ui.filter.type':            { english: 'Type', german: 'Typ' },
    'ui.filter.all_types':       { english: 'All Types', german: 'Alle Typen' },
    'ui.filter.category':        { english: 'Category', german: 'Kategorie' },
    'ui.filter.all_categories':  { english: 'All Categories', german: 'Alle Kategorien' },
    'ui.filter.tree':            { english: 'Tree', german: 'Baum' },
    'ui.filter.all_trees':       { english: 'All Trees', german: 'Alle B\u00e4ume' },
    'ui.filter.level':           { english: 'Level', german: 'Stufe' },
    'ui.filter.all_levels':      { english: 'All Levels', german: 'Alle Stufen' },
    'ui.filter.authority':       { english: 'Authority', german: 'Autorit\u00e4t' },
    'ui.filter.all_authorities': { english: 'All Authorities', german: 'Alle Autorit\u00e4ten' },
    'ui.filter.archetype':       { english: 'Archetype', german: 'Archetyp' },
    'ui.filter.all_archetypes':  { english: 'All Archetypes', german: 'Alle Archetypen' },
    'ui.filter.faction':         { english: 'Faction', german: 'Fraktion' },
    'ui.filter.all_factions':    { english: 'All Factions', german: 'Alle Fraktionen' },
    'ui.filter.namespace':       { english: 'Namespace', german: 'Namensraum' },
    'ui.filter.all_namespaces':  { english: 'All Namespaces', german: 'Alle Namensr\u00e4ume' },
    'ui.filter.show_hidden':     { english: 'Show Hidden', german: 'Versteckte anzeigen' },
    'ui.filter.triggered_only':  { english: 'Triggered Only', german: 'Nur ausgel\u00f6ste' },
    'ui.filter.origins_only':    { english: 'Origins only', german: 'Nur Urspr\u00fcnge' },

    // ==========================================
    // Search Placeholders
    // ==========================================
    'ui.search.hub':          { english: 'Search all items... (ship:, event:, building:, ...)', german: 'Alle Eintr\u00e4ge durchsuchen... (ship:, event:, building:, ...)' },
    'ui.search.ships':        { english: 'Search ships & components...', german: 'Schiffe & Komponenten durchsuchen...' },
    'ui.search.buildings':    { english: 'Search buildings & districts...', german: 'Geb\u00e4ude & Bezirke durchsuchen...' },
    'ui.search.traits':       { english: 'Search traits, traditions & perks...', german: 'Eigenschaften, Traditionen & Vorteile durchsuchen...' },
    'ui.search.governments':  { english: 'Search governments, civics, policies...', german: 'Regierungen, B\u00fcrgerrechte, Richtlinien durchsuchen...' },
    'ui.search.megastructures': { english: 'Search megastructures & relics...', german: 'Megastrukturen & Relikte durchsuchen...' },
    'ui.search.anomalies':    { english: 'Search anomalies & archaeology...', german: 'Anomalien & Arch\u00e4ologie durchsuchen...' },
    'ui.search.empires':      { english: 'Search empires & species...', german: 'Imperien & Spezies durchsuchen...' },
    'ui.search.economy':      { english: 'Search jobs & deposits...', german: 'Berufe & Lagerst\u00e4tten durchsuchen...' },
    'ui.search.events':       { english: 'Search events... (id:, ns:, faction:)', german: 'Ereignisse durchsuchen... (id:, ns:, faction:)' },

    // ==========================================
    // Detail Section Titles
    // ==========================================
    'ui.detail.detail':           { english: 'Detail', german: 'Detail' },
    'ui.detail.stats':            { english: 'Stats', german: 'Werte' },
    'ui.detail.prerequisites':    { english: 'Prerequisites', german: 'Voraussetzungen' },
    'ui.detail.resources':        { english: 'Resources', german: 'Ressourcen' },
    'ui.detail.modifiers':        { english: 'Modifiers', german: 'Modifikatoren' },
    'ui.detail.section_slots':    { english: 'Section Slots', german: 'Sektionspl\u00e4tze' },
    'ui.detail.tags':             { english: 'Tags', german: 'Tags' },
    'ui.detail.description':      { english: 'Description', german: 'Beschreibung' },
    'ui.detail.opposites':        { english: 'Opposites', german: 'Gegenteile' },
    'ui.detail.requirements':     { english: 'Requirements', german: 'Anforderungen' },
    'ui.detail.on_enabled':       { english: 'On Enabled', german: 'Bei Aktivierung' },
    'ui.detail.tradition_swaps':  { english: 'Tradition Swaps', german: 'Traditionstausch' },
    'ui.detail.upgrades_to':      { english: 'Upgrades To', german: 'Ausbau zu' },
    'ui.detail.potential':        { english: 'Potential', german: 'Potenzial' },
    'ui.detail.options':          { english: 'Options', german: 'Optionen' },
    'ui.detail.weight':           { english: 'Weight', german: 'Gewichtung' },
    'ui.detail.active_effect':    { english: 'Active Effect', german: 'Aktiver Effekt' },
    'ui.detail.possible':         { english: 'Possible', german: 'M\u00f6glich' },
    'ui.detail.on_build_complete':{ english: 'On Build Complete', german: 'Bei Fertigstellung' },
    'ui.detail.success_outcomes': { english: 'Success Outcomes', german: 'Erfolgsergebnisse' },
    'ui.detail.spawn_chance':     { english: 'Spawn Chance', german: 'Erscheinungschance' },
    'ui.detail.stages':           { english: 'Stages', german: 'Stufen' },
    'ui.detail.info':             { english: 'Info', german: 'Info' },
    'ui.detail.ethics':           { english: 'Ethics', german: 'Ethiken' },
    'ui.detail.civics':           { english: 'Civics', german: 'B\u00fcrgerrechte' },
    'ui.detail.species':          { english: 'Species', german: 'Spezies' },
    'ui.detail.ruler':            { english: 'Ruler', german: 'Herrscher' },
    'ui.detail.portraits':        { english: 'Portraits', german: 'Portr\u00e4ts' },
    'ui.detail.drop_weight':      { english: 'Drop Weight', german: 'Fallgewichtung' },
    'ui.detail.3d_model':         { english: '3D Model', german: '3D-Modell' },

    // ==========================================
    // Meta Labels
    // ==========================================
    'ui.meta.id':              { english: 'ID', german: 'ID' },
    'ui.meta.class':           { english: 'Class', german: 'Klasse' },
    'ui.meta.type':            { english: 'Type', german: 'Typ' },
    'ui.meta.size':            { english: 'Size', german: 'Gr\u00f6\u00dfe' },
    'ui.meta.file':            { english: 'File', german: 'Datei' },
    'ui.meta.hp':              { english: 'HP', german: 'TP' },
    'ui.meta.speed':           { english: 'Speed', german: 'Geschwindigkeit' },
    'ui.meta.build_time':      { english: 'Build Time', german: 'Bauzeit' },
    'ui.meta.power':           { english: 'Power', german: 'Energie' },
    'ui.meta.damage':          { english: 'Damage', german: 'Schaden' },
    'ui.meta.range':           { english: 'Range', german: 'Reichweite' },
    'ui.meta.accuracy':        { english: 'Accuracy', german: 'Genauigkeit' },
    'ui.meta.tracking':        { english: 'Tracking', german: 'Zielverfolgung' },
    'ui.meta.category':        { english: 'Category', german: 'Kategorie' },
    'ui.meta.rarity':          { english: 'Rarity', german: 'Seltenheit' },
    'ui.meta.tier':            { english: 'Tier', german: 'Stufe' },
    'ui.meta.tree':            { english: 'Tree', german: 'Baum' },
    'ui.meta.role':            { english: 'Role', german: 'Rolle' },
    'ui.meta.cost':            { english: 'Cost', german: 'Kosten' },
    'ui.meta.ruler':           { english: 'Ruler', german: 'Herrscher' },
    'ui.meta.election':        { english: 'Election', german: 'Wahl' },
    'ui.meta.duration':        { english: 'Duration', german: 'Dauer' },
    'ui.meta.entity':          { english: 'Entity', german: 'Entit\u00e4t' },
    'ui.meta.upgrade_from':    { english: 'Upgrade From', german: 'Ausbau von' },
    'ui.meta.sensor_range':    { english: 'Sensor Range', german: 'Sensorreichweite' },
    'ui.meta.activation_duration': { english: 'Activation Duration', german: 'Aktivierungsdauer' },
    'ui.meta.score':           { english: 'Score', german: 'Punkte' },
    'ui.meta.desc':            { english: 'Desc', german: 'Beschr.' },
    'ui.meta.level':           { english: 'Level', german: 'Stufe' },
    'ui.meta.picture':         { english: 'Picture', german: 'Bild' },
    'ui.meta.max_once':        { english: 'Max Once', german: 'Max. einmal' },
    'ui.meta.max_instances':   { english: 'Max Instances', german: 'Max. Instanzen' },
    'ui.meta.authority':       { english: 'Authority', german: 'Autorit\u00e4t' },
    'ui.meta.government':      { english: 'Government', german: 'Regierung' },
    'ui.meta.origin':          { english: 'Origin', german: 'Ursprung' },
    'ui.meta.ship_prefix':     { english: 'Ship Prefix', german: 'Schiffspr\u00e4fix' },
    'ui.meta.culture':         { english: 'Culture', german: 'Kultur' },
    'ui.meta.homeworld':       { english: 'Homeworld', german: 'Heimatwelt' },
    'ui.meta.planet_class':    { english: 'Planet Class', german: 'Planetenklasse' },
    'ui.meta.system':          { english: 'System', german: 'System' },
    'ui.meta.archetype':       { english: 'Archetype', german: 'Archetyp' },
    'ui.meta.uplifted_into':   { english: 'Uplifted Into', german: 'Erhoben zu' },
    'ui.meta.gender':          { english: 'Gender', german: 'Geschlecht' },
    'ui.meta.building_icon':   { english: 'Building Icon', german: 'Geb\u00e4udesymbol' },
    'ui.meta.condition':       { english: 'Condition', german: 'Bedingung' },
    'ui.meta.capped_by_modifier': { english: 'Capped by Modifier', german: 'Begrenzt durch Modifikator' },
    'ui.meta.null_deposit':    { english: 'Null Deposit', german: 'Leer-Lagerst\u00e4tte' },
    'ui.meta.for_colonizable': { english: 'For Colonizable', german: 'F\u00fcr Kolonisierbare' },
    'ui.meta.stages':          { english: 'Stages', german: 'Stufen' },

    // ==========================================
    // Card Meta Prefixes
    // ==========================================
    'ui.card.tech':            { english: 'Tech', german: 'Tech' },
    'ui.card.build':           { english: 'Build', german: 'Bau' },
    'ui.card.from':            { english: 'From', german: 'Von' },
    'ui.card.score':           { english: 'Score', german: 'Punkte' },
    'ui.card.duration':        { english: 'Duration', german: 'Dauer' },
    'ui.card.options':         { english: 'options', german: 'Optionen' },
    'ui.card.outcomes':        { english: 'outcomes', german: 'Ergebnisse' },
    'ui.card.stages':          { english: 'stages', german: 'Stufen' },
    'ui.card.ethics':          { english: 'ethics', german: 'Ethiken' },

    // ==========================================
    // Badges
    // ==========================================
    'ui.badge.origin':         { english: 'Origin', german: 'Ursprung' },
    'ui.badge.ambition':       { english: 'Ambition', german: 'Ambition' },
    'ui.badge.unique':         { english: 'Unique', german: 'Einzigartig' },
    'ui.badge.capital':        { english: 'Capital', german: 'Hauptstadt' },
    'ui.badge.colonizable':    { english: 'Colonizable', german: 'Kolonisierbar' },
    'ui.badge.has_heir':       { english: 'Has Heir', german: 'Hat Erben' },
    'ui.badge.triggered_only': { english: 'triggered only', german: 'nur ausgel\u00f6st' },
    'ui.badge.hidden':         { english: 'hidden', german: 'versteckt' },
    'ui.badge.fire_once':      { english: 'fire once', german: 'einmalig' },
    'ui.badge.diplomatic':     { english: 'diplomatic', german: 'diplomatisch' },

    // ==========================================
    // Hub Page
    // ==========================================
    'ui.hub.subtitle':         { english: 'Comprehensive off-game reference for the STNH Stellaris mod', german: 'Umfassendes Off-Game-Nachschlagewerk f\u00fcr die STNH Stellaris-Mod' },
    'ui.hub.total_items':      { english: 'Total Items', german: 'Gesamtanzahl' },
    'ui.hub.last_update':      { english: 'Last Update', german: 'Letztes Update' },
    'ui.hub.desc_events':      { english: 'Browse all events with full localisation in 7 languages.', german: 'Alle Ereignisse mit voller Lokalisierung in 7 Sprachen durchsuchen.' },
    'ui.hub.desc_tech':        { english: 'Interactive technology tree with prerequisites and unlocks.', german: 'Interaktiver Technologiebaum mit Voraussetzungen und Freischaltungen.' },
    'ui.hub.desc_ships':       { english: 'Ship classes, sizes, components, and faction-specific designs.', german: 'Schiffsklassen, Gr\u00f6\u00dfen, Komponenten und fraktionsspezifische Designs.' },
    'ui.hub.desc_buildings':   { english: 'Planetary buildings, districts, and their production chains.', german: 'Planetare Geb\u00e4ude, Bezirke und ihre Produktionsketten.' },
    'ui.hub.desc_traits':      { english: 'Leader traits, traditions, ascension perks and their effects.', german: 'Anf\u00fchrereigenschaften, Traditionen, Aufstiegsvorteile und ihre Effekte.' },
    'ui.hub.desc_governments': { english: 'Government types, civics, authorities, policies, and edicts.', german: 'Regierungsformen, B\u00fcrgerrechte, Autorit\u00e4ten, Richtlinien und Edikte.' },
    'ui.hub.desc_megastructures': { english: 'Megastructure types, relics, build stages, and requirements.', german: 'Megastrukturtypen, Relikte, Baustufen und Anforderungen.' },
    'ui.hub.desc_anomalies':   { english: 'Anomaly categories, archaeological sites, outcomes, and events.', german: 'Anomaliekategorien, arch\u00e4ologische St\u00e4tten, Ergebnisse und Ereignisse.' },
    'ui.hub.desc_empires':     { english: 'Prescripted empires, species classes, factions, and portraits.', german: 'Vordefinierte Imperien, Speziesklassen, Fraktionen und Portr\u00e4ts.' },
    'ui.hub.desc_economy':     { english: 'Pop jobs, deposits, resource production, and economic chains.', german: 'Pop-Berufe, Lagerst\u00e4tten, Ressourcenproduktion und Wirtschaftsketten.' },

    // ==========================================
    // Event Detail Specific
    // ==========================================
    'ui.event.description':        { english: 'Description', german: 'Beschreibung' },
    'ui.event.condition':          { english: 'Condition', german: 'Bedingung' },
    'ui.event.trigger_conditions': { english: 'Trigger Conditions', german: 'Ausl\u00f6sebedingungen' },
    'ui.event.immediate_effects':  { english: 'Immediate Effects', german: 'Sofortige Effekte' },
    'ui.event.options':            { english: 'Options', german: 'Optionen' },
    'ui.event.after_effects':      { english: 'After Effects', german: 'Nachfolgende Effekte' },
    'ui.event.mtth':               { english: 'Mean Time to Happen', german: 'Durchschnittliche Ausl\u00f6sezeit' },
    'ui.event.on_actions':         { english: 'Triggered by On-Actions', german: 'Ausgel\u00f6st durch On-Actions' },
    'ui.event.triggered_by':       { english: 'Triggered By', german: 'Ausgel\u00f6st von' },
    'ui.event.triggers':           { english: 'Triggers', german: 'L\u00f6st aus' },
    'ui.event.requires':           { english: 'Requires', german: 'Erfordert' },
    'ui.event.shows_if':           { english: 'Shows if', german: 'Zeigt wenn' },
    'ui.event.effects':            { english: 'Effects', german: 'Effekte' },
    'ui.event.event_detail':       { english: 'Event Detail', german: 'Ereignisdetail' },
    'ui.event.event_chain':        { english: 'Event Chain', german: 'Ereigniskette' },
    'ui.event.namespaces':         { english: 'Namespaces', german: 'Namensr\u00e4ume' },

    // ==========================================
    // Type Labels (Global Search)
    // ==========================================
    'ui.type.event':           { english: 'Event', german: 'Ereignis' },
    'ui.type.ship':            { english: 'Ship', german: 'Schiff' },
    'ui.type.component':       { english: 'Component', german: 'Komponente' },
    'ui.type.building':        { english: 'Building', german: 'Geb\u00e4ude' },
    'ui.type.district':        { english: 'District', german: 'Bezirk' },
    'ui.type.trait':           { english: 'Trait', german: 'Eigenschaft' },
    'ui.type.tradition':       { english: 'Tradition', german: 'Tradition' },
    'ui.type.ascension_perk':  { english: 'Ascension Perk', german: 'Aufstiegsvorteil' },
    'ui.type.government':      { english: 'Government', german: 'Regierung' },
    'ui.type.civic':           { english: 'Civic', german: 'B\u00fcrgerrecht' },
    'ui.type.authority':       { english: 'Authority', german: 'Autorit\u00e4t' },
    'ui.type.policy':          { english: 'Policy', german: 'Richtlinie' },
    'ui.type.edict':           { english: 'Edict', german: 'Edikt' },
    'ui.type.megastructure':   { english: 'Megastructure', german: 'Megastruktur' },
    'ui.type.relic':           { english: 'Relic', german: 'Relikt' },
    'ui.type.anomaly':         { english: 'Anomaly', german: 'Anomalie' },
    'ui.type.archaeology':     { english: 'Archaeology', german: 'Arch\u00e4ologie' },
    'ui.type.empire':          { english: 'Empire', german: 'Imperium' },
    'ui.type.species':         { english: 'Species', german: 'Spezies' },
    'ui.type.job':             { english: 'Job', german: 'Beruf' },
    'ui.type.deposit':         { english: 'Deposit', german: 'Lagerst\u00e4tte' },
    'ui.type.technology':      { english: 'Technology', german: 'Technologie' },

    // ==========================================
    // Loading / Empty / Error States
    // ==========================================
    'ui.loading.ships':        { english: 'Loading ship data', german: 'Lade Schiffsdaten' },
    'ui.loading.buildings':    { english: 'Loading building data', german: 'Lade Geb\u00e4udedaten' },
    'ui.loading.traits':       { english: 'Loading trait data', german: 'Lade Eigenschaftsdaten' },
    'ui.loading.governments':  { english: 'Loading government data', german: 'Lade Regierungsdaten' },
    'ui.loading.megastructures': { english: 'Loading megastructure data', german: 'Lade Megastrukturdaten' },
    'ui.loading.anomalies':    { english: 'Loading anomaly data', german: 'Lade Anomaliedaten' },
    'ui.loading.empires':      { english: 'Loading empire data', german: 'Lade Imperiumsdaten' },
    'ui.loading.economy':      { english: 'Loading economy data', german: 'Lade Wirtschaftsdaten' },
    'ui.loading.events':       { english: 'Loading event data', german: 'Lade Ereignisdaten' },
    'ui.loading.generic':      { english: 'Loading...', german: 'Laden...' },
    'ui.loading.event_details':{ english: 'Loading event details', german: 'Lade Ereignisdetails' },

    'ui.empty.no_items':       { english: 'No items found', german: 'Keine Eintr\u00e4ge gefunden' },
    'ui.empty.no_events':      { english: 'No events found', german: 'Keine Ereignisse gefunden' },
    'ui.empty.no_results':     { english: 'No results found', german: 'Keine Ergebnisse gefunden' },
    'ui.empty.no_results_any': { english: 'No results found across any module.', german: 'Keine Ergebnisse in allen Modulen gefunden.' },
    'ui.empty.event_not_found':{ english: 'Event not found in detail data', german: 'Ereignis nicht in Detaildaten gefunden' },
    'ui.empty.other_namespaces': { english: 'Other namespaces', german: 'Andere Namensr\u00e4ume' },

    'ui.error.load_failed':    { english: 'Failed to load data', german: 'Daten konnten nicht geladen werden' },
    'ui.error.model_load_failed': { english: 'Could not load 3D model', german: '3D-Modell konnte nicht geladen werden' },

    // ==========================================
    // Search UI (Hub)
    // ==========================================
    'ui.search.matches':       { english: 'match', german: 'Treffer' },
    'ui.search.matches_plural':{ english: 'matches', german: 'Treffer' },
    'ui.search.press_enter':   { english: 'press Enter for full results', german: 'Enter f\u00fcr alle Ergebnisse dr\u00fccken' },
    'ui.search.more':          { english: 'more', german: 'mehr' },
    'ui.search.back':          { english: 'Back', german: 'Zur\u00fcck' },
    'ui.search.all':           { english: 'All', german: 'Alle' },
    'ui.search.results_for':   { english: 'results for', german: 'Ergebnisse f\u00fcr' },
    'ui.search.result':        { english: 'result', german: 'Ergebnis' },
    'ui.search.results':       { english: 'results', german: 'Ergebnisse' },
    'ui.search.also_searching':{ english: 'also searching', german: 'sucht auch nach' },
    'ui.search.global_results':{ english: 'Cross-module results', german: 'Modul\u00fcbergreifende Ergebnisse', french: 'R\u00e9sultats inter-modules', spanish: 'Resultados multi-m\u00f3dulo', russian: '\u041c\u0435\u0436\u043c\u043e\u0434\u0443\u043b\u044c\u043d\u044b\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b', polish: 'Wyniki mi\u0119dzymodu\u0142owe', braz_por: 'Resultados entre m\u00f3dulos' },
    'ui.search.global':        { english: 'Search all wiki...', german: 'Gesamtes Wiki durchsuchen...', french: 'Rechercher dans tout le wiki...', spanish: 'Buscar en toda la wiki...', russian: '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0432\u0441\u0435\u0439 \u0432\u0438\u043a\u0438...', polish: 'Szukaj w ca\u0142ej wiki...', braz_por: 'Pesquisar em toda a wiki...' },

    // ==========================================
    // Misc
    // ==========================================
    'ui.action.view_3d':       { english: 'View 3D Model', german: '3D-Modell anzeigen' },

    'ui.misc.yes':             { english: 'Yes', german: 'Ja' },
    'ui.misc.stage':           { english: 'Stage', german: 'Stufe' },
    'ui.misc.difficulty':      { english: 'difficulty', german: 'Schwierigkeit' },
    'ui.misc.event':           { english: 'Event', german: 'Ereignis' },
    'ui.misc.icon':            { english: 'Icon', german: 'Symbol' },
    'ui.misc.unnamed':         { english: '(unnamed)', german: '(unbenannt)' },
    'ui.misc.text':            { english: 'Text', german: 'Text' },
};
