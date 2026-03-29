/**
 * Humanize engine – converts parsed PDX JSON structures into human-readable HTML.
 * Client-side only, no pipeline changes needed.
 */
const Humanize = (() => {

    // -------------------------------------------------------------------------
    // Helper: try loc resolution, fall back to cleaned-up key
    // -------------------------------------------------------------------------
    function locOrClean(key) {
        if (!key || typeof key !== 'string') return String(key ?? '');
        const resolved = I18n.t(key);
        if (resolved !== key) return resolved;
        // Strip common prefixes and prettify
        let clean = key
            .replace(/^(ethic_|trait_|civic_|tech_|ap_|tradition_|building_|ship_size_|weapon_type_|authority_|origin_|species_trait_)/, '')
            .replace(/_/g, ' ');
        // Title-case
        return clean.replace(/\b\w/g, c => c.toUpperCase());
    }

    function escHtml(s) {
        const d = document.createElement('div');
        d.textContent = String(s ?? '');
        return d.innerHTML;
    }

    // -------------------------------------------------------------------------
    // Comparison helper: { ">": 10 } → "> 10"
    // -------------------------------------------------------------------------
    function fmtComparison(label, val) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            const ops = Object.entries(val);
            if (ops.length === 1 && ['>', '<', '>=', '<='].includes(ops[0][0])) {
                return `${label} ${ops[0][0]} ${ops[0][1]}`;
            }
        }
        return `${label}: ${val}`;
    }

    // -------------------------------------------------------------------------
    // Resource helpers
    // -------------------------------------------------------------------------
    function parseResourceCheck(v) {
        if (!Array.isArray(v)) return `Has resource: ${JSON.stringify(v)}`;
        const parts = [];
        let type = null;
        for (const item of v) {
            if (typeof item === 'object') {
                for (const [k, val] of Object.entries(item)) {
                    if (k === 'type') type = val;
                    else parts.push(fmtComparison(locOrClean(k), val));
                }
            }
        }
        if (type) return `Has ${locOrClean(type)}: ${parts.join(', ')}`;
        return `Has resource: ${parts.join(', ')}`;
    }

    function parseResourceEffect(v) {
        if (!Array.isArray(v)) return `Add resource: ${JSON.stringify(v)}`;
        const parts = [];
        for (const item of v) {
            if (typeof item === 'object') {
                for (const [k, val] of Object.entries(item)) {
                    parts.push(`${locOrClean(k)} ${Number(val) >= 0 ? '+' : ''}${val}`);
                }
            }
        }
        return `Add: ${parts.join(', ')}`;
    }

    function parseModifierEffect(v) {
        if (!Array.isArray(v)) return `Add modifier: ${locOrClean(String(v))}`;
        const parts = [];
        let name = '';
        for (const item of v) {
            if (typeof item === 'object') {
                for (const [k, val] of Object.entries(item)) {
                    if (k === 'modifier') name = locOrClean(val);
                    else if (k === 'days' || k === 'months' || k === 'years')
                        parts.push(`${val} ${k}`);
                    else parts.push(`${k}: ${val}`);
                }
            }
        }
        return `Add modifier "${name}"` + (parts.length ? ` for ${parts.join(', ')}` : '');
    }

    function parseTimedFlag(v) {
        if (!Array.isArray(v)) return `Set timed flag: ${JSON.stringify(v)}`;
        let flag = '', duration = '';
        for (const item of v) {
            if (typeof item === 'object') {
                for (const [k, val] of Object.entries(item)) {
                    if (k === 'flag') flag = val;
                    else if (k === 'days' || k === 'months' || k === 'years')
                        duration = `${val} ${k}`;
                }
            }
        }
        return `Set timed flag "${flag}"` + (duration ? ` (${duration})` : '');
    }

    function parseEventCall(v) {
        if (typeof v === 'string') return `Fire event ${v}`;
        if (!Array.isArray(v)) return `Fire event: ${JSON.stringify(v)}`;
        let id = '', days = '';
        for (const item of v) {
            if (typeof item === 'object') {
                for (const [k, val] of Object.entries(item)) {
                    if (k === 'id') id = val;
                    else if (k === 'days') days = val;
                }
            }
        }
        let s = `Fire event <span class="event-link" data-event-id="${escHtml(id)}">${escHtml(id)}</span>`;
        if (days) s += ` (after ${days} days)`;
        return s;
    }

    // -------------------------------------------------------------------------
    // Trigger knowledge base
    // -------------------------------------------------------------------------
    const TRIGGER_MAP = {
        // Logic operators
        'NOT':                  (v, d) => `<span class="negation">NOT:</span>${nested(v, d)}`,
        'OR':                   (v, d) => `Any of:${nested(v, d)}`,
        'AND':                  (v, d) => `All of:${nested(v, d)}`,
        'NOR':                  (v, d) => `<span class="negation">None of:</span>${nested(v, d)}`,
        'NAND':                 (v, d) => `<span class="negation">Not all of:</span>${nested(v, d)}`,

        // Flag checks
        'has_country_flag':     (v) => `Has country flag "${v}"`,
        'has_global_flag':      (v) => `Has global flag "${v}"`,
        'has_planet_flag':      (v) => `Has planet flag "${v}"`,
        'has_star_flag':        (v) => `Has star flag "${v}"`,
        'has_fleet_flag':       (v) => `Has fleet flag "${v}"`,
        'has_ship_flag':        (v) => `Has ship flag "${v}"`,
        'has_system_flag':      (v) => `Has system flag "${v}"`,
        'has_pop_flag':         (v) => `Has pop flag "${v}"`,
        'has_megastructure_flag': (v) => `Has megastructure flag "${v}"`,
        'has_species_flag':     (v) => `Has species flag "${v}"`,
        'has_leader_flag':      (v) => `Has leader flag "${v}"`,
        'has_first_contact_flag': (v) => `Has first contact flag "${v}"`,

        // Ethic / civic / authority / trait / tech / tradition
        'has_ethic':            (v) => `Has ethic: ${locOrClean(v)}`,
        'has_technology':       (v) => `Has technology: ${locOrClean(v)}`,
        'has_tradition':        (v) => `Has tradition: ${locOrClean(v)}`,
        'has_civic':            (v) => `Has civic: ${locOrClean(v)}`,
        'has_authority':        (v) => `Has authority: ${locOrClean(v)}`,
        'has_origin':           (v) => `Has origin: ${locOrClean(v)}`,
        'has_ascension_perk':   (v) => `Has ascension perk: ${locOrClean(v)}`,
        'has_modifier':         (v) => `Has modifier: ${locOrClean(v)}`,
        'has_trait':            (v) => `Has trait: ${locOrClean(v)}`,
        'has_deposit':          (v) => `Has deposit: ${locOrClean(v)}`,
        'has_building':         (v) => `Has building: ${locOrClean(v)}`,
        'has_district':         (v) => `Has district: ${locOrClean(v)}`,
        'has_job':              (v) => `Has job: ${locOrClean(v)}`,

        // Resource
        'has_resource':         (v) => parseResourceCheck(v),

        // Scope checks
        'is_country_type':      (v) => `Is country type: ${v}`,
        'is_planet_class':      (v) => `Planet class is: ${v}`,
        'is_star_class':        (v) => `Star class is: ${v}`,
        'is_same_species':      (v) => `Is same species as ${v}`,
        'is_species_class':     (v) => `Species class is: ${v}`,
        'is_ship_size':         (v) => `Ship size is: ${locOrClean(v)}`,
        'is_ship_class':        (v) => `Ship class is: ${locOrClean(v)}`,
        'is_same_value':        (v) => `Is same value as ${v}`,
        'is_same_empire':       (v) => `Is same empire as ${v}`,
        'is_war_leader':        (v) => v === 'yes' ? 'Is war leader' : 'Is not war leader',

        // State checks
        'is_ai':                (v) => v === 'yes' ? 'Is AI-controlled' : 'Is player-controlled',
        'is_at_war':            (v) => v === 'yes' ? 'Is at war' : 'Is at peace',
        'is_at_war_with':       (v) => `Is at war with ${v}`,
        'is_hostile_to':        (v) => `Is hostile to ${v}`,
        'is_homicidal':         (v) => v === 'yes' ? 'Is homicidal' : 'Is not homicidal',
        'is_militarist':        (v) => v === 'yes' ? 'Is militarist' : 'Is not militarist',
        'is_pacifist':          (v) => v === 'yes' ? 'Is pacifist' : 'Is not pacifist',
        'is_xenophile':         (v) => v === 'yes' ? 'Is xenophile' : 'Is not xenophile',
        'is_xenophobe':         (v) => v === 'yes' ? 'Is xenophobe' : 'Is not xenophobe',
        'is_materialist':       (v) => v === 'yes' ? 'Is materialist' : 'Is not materialist',
        'is_spiritualist':      (v) => v === 'yes' ? 'Is spiritualist' : 'Is not spiritualist',
        'is_egalitarian':       (v) => v === 'yes' ? 'Is egalitarian' : 'Is not egalitarian',
        'is_authoritarian':     (v) => v === 'yes' ? 'Is authoritarian' : 'Is not authoritarian',
        'is_gestalt':           (v) => v === 'yes' ? 'Is gestalt' : 'Is not gestalt',
        'is_machine_empire':    (v) => v === 'yes' ? 'Is machine empire' : 'Is not machine empire',
        'is_hive_empire':       (v) => v === 'yes' ? 'Is hive empire' : 'Is not hive empire',
        'is_megacorp':          (v) => v === 'yes' ? 'Is megacorp' : 'Is not megacorp',
        'is_fallen_empire':     (v) => v === 'yes' ? 'Is fallen empire' : 'Is not fallen empire',
        'is_subject':           (v) => v === 'yes' ? 'Is a subject' : 'Is independent',
        'is_overlord':          (v) => v === 'yes' ? 'Is an overlord' : 'Is not an overlord',
        'is_federation_leader': (v) => v === 'yes' ? 'Is federation leader' : 'Is not federation leader',
        'is_galactic_community_member': (v) => v === 'yes' ? 'Is galactic community member' : 'Is not galactic community member',
        'is_enslaved':          (v) => v === 'yes' ? 'Is enslaved' : 'Is not enslaved',
        'is_being_purged':      (v) => v === 'yes' ? 'Is being purged' : 'Is not being purged',
        'is_sapient':           (v) => v === 'yes' ? 'Is sapient' : 'Is not sapient',
        'is_colony':            (v) => v === 'yes' ? 'Is a colony' : 'Is not a colony',
        'is_capital':           (v) => v === 'yes' ? 'Is the capital' : 'Is not the capital',
        'is_occupied_flag':     (v) => v === 'yes' ? 'Is occupied' : 'Is not occupied',
        'is_homeworld':         (v) => v === 'yes' ? 'Is homeworld' : 'Is not homeworld',
        'has_owner':            (v) => v === 'yes' ? 'Has owner' : 'Has no owner',
        'has_ground_combat':    (v) => v === 'yes' ? 'Has ground combat' : 'No ground combat',
        'exists':               (v) => typeof v === 'string' ? `${v} exists` : (v === 'yes' ? 'Exists' : 'Does not exist'),

        // Numeric
        'num_pops':             (v) => fmtComparison('Population', v),
        'num_owned_planets':    (v) => fmtComparison('Owned planets', v),
        'num_communications':   (v) => fmtComparison('Communications', v),
        'count_owned_pops':     (v) => fmtComparison('Owned pops', v),
        'years_passed':         (v) => fmtComparison('Years passed', v),
        'num_fleets':           (v) => fmtComparison('Fleets', v),
        'num_armies':           (v) => fmtComparison('Armies', v),
        'fleet_power':          (v) => fmtComparison('Fleet power', v),
        'relative_power':       (v) => `Relative power: ${JSON.stringify(v)}`,

        // Quantifiers / scoped triggers
        'any_owned_planet':     (v, d) => `Any owned planet:${nested(v, d)}`,
        'any_owned_leader':     (v, d) => `Any owned leader:${nested(v, d)}`,
        'any_owned_pop':        (v, d) => `Any owned pop:${nested(v, d)}`,
        'any_owned_fleet':      (v, d) => `Any owned fleet:${nested(v, d)}`,
        'any_owned_ship':       (v, d) => `Any owned ship:${nested(v, d)}`,
        'any_system_within_border': (v, d) => `Any system within border:${nested(v, d)}`,
        'any_neighbor_country': (v, d) => `Any neighbor country:${nested(v, d)}`,
        'any_country':          (v, d) => `Any country:${nested(v, d)}`,
        'any_planet':           (v, d) => `Any planet:${nested(v, d)}`,
        'any_pop':              (v, d) => `Any pop:${nested(v, d)}`,
        'any_war':              (v, d) => `Any war:${nested(v, d)}`,
        'any_fleet_in_system':  (v, d) => `Any fleet in system:${nested(v, d)}`,
        'any_ship_in_system':   (v, d) => `Any ship in system:${nested(v, d)}`,
        'any_army':             (v, d) => `Any army:${nested(v, d)}`,
        'any_species':          (v, d) => `Any species:${nested(v, d)}`,
        'any_member':           (v, d) => `Any member:${nested(v, d)}`,
        'any_federation_ally':  (v, d) => `Any federation ally:${nested(v, d)}`,
        'any_subject':          (v, d) => `Any subject:${nested(v, d)}`,
        'any_rival_country':    (v, d) => `Any rival country:${nested(v, d)}`,
        'any_relation':         (v, d) => `Any relation:${nested(v, d)}`,
        'any_playable_country': (v, d) => `Any playable country:${nested(v, d)}`,
        'any_deposit':          (v, d) => `Any deposit:${nested(v, d)}`,
        'any_tile':             (v, d) => `Any tile:${nested(v, d)}`,
        'every_owned_planet':   (v, d) => `Every owned planet:${nested(v, d)}`,
        'every_owned_pop':      (v, d) => `Every owned pop:${nested(v, d)}`,
        'every_country':        (v, d) => `Every country:${nested(v, d)}`,
        'count_owned_planet':   (v, d) => `Count owned planets:${nested(v, d)}`,
        'count_country':        (v, d) => `Count countries:${nested(v, d)}`,

        // STNH-specific
        'is_vulcan_story_empire':   (v) => v === 'yes' ? 'Is a Vulcan story empire' : 'Is not a Vulcan story empire',
        'has_any_drone_authority':   (v) => v === 'yes' ? 'Has any drone authority' : 'Has no drone authority',

        // Misc
        'always':               (v) => v === 'yes' ? 'Always true' : 'Always false',
        'host_has_dlc':         (v) => `Requires DLC: ${v}`,
        'has_event_chain':      (v) => `Has event chain: ${v}`,
        'is_event_leader':      (v) => v === 'yes' ? 'Is event leader' : 'Is not event leader',
        'has_communications':   (v) => `Has communications with ${v}`,
        'has_policy_flag':      (v) => `Has policy flag: ${v}`,
        'has_valid_civic':      (v) => `Has valid civic: ${locOrClean(v)}`,
        'check_variable':       (v) => parseVariable(v),
        'text':                 (v) => `${locOrClean(v)}`,
        'custom_tooltip':       (v) => `${locOrClean(v)}`,
        'custom_tooltip_fail':  (v) => `(On fail) ${locOrClean(v)}`,
    };

    // -------------------------------------------------------------------------
    // Effect knowledge base
    // -------------------------------------------------------------------------
    const EFFECT_MAP = {
        // Flags
        'set_country_flag':     (v) => `Set country flag "${v}"`,
        'set_global_flag':      (v) => `Set global flag "${v}"`,
        'set_planet_flag':      (v) => `Set planet flag "${v}"`,
        'set_star_flag':        (v) => `Set star flag "${v}"`,
        'set_fleet_flag':       (v) => `Set fleet flag "${v}"`,
        'set_ship_flag':        (v) => `Set ship flag "${v}"`,
        'set_system_flag':      (v) => `Set system flag "${v}"`,
        'set_pop_flag':         (v) => `Set pop flag "${v}"`,
        'set_leader_flag':      (v) => `Set leader flag "${v}"`,
        'set_species_flag':     (v) => `Set species flag "${v}"`,
        'remove_country_flag':  (v) => `Remove country flag "${v}"`,
        'remove_global_flag':   (v) => `Remove global flag "${v}"`,
        'remove_planet_flag':   (v) => `Remove planet flag "${v}"`,
        'remove_star_flag':     (v) => `Remove star flag "${v}"`,
        'remove_fleet_flag':    (v) => `Remove fleet flag "${v}"`,
        'remove_ship_flag':     (v) => `Remove ship flag "${v}"`,
        'remove_system_flag':   (v) => `Remove system flag "${v}"`,
        'remove_pop_flag':      (v) => `Remove pop flag "${v}"`,
        'remove_leader_flag':   (v) => `Remove leader flag "${v}"`,
        'set_timed_country_flag': (v) => parseTimedFlag(v),
        'set_timed_planet_flag':  (v) => parseTimedFlag(v),
        'set_timed_global_flag':  (v) => parseTimedFlag(v),
        'set_timed_star_flag':    (v) => parseTimedFlag(v),

        // Resources / modifiers
        'add_resource':         (v) => parseResourceEffect(v),
        'add_modifier':         (v) => parseModifierEffect(v),
        'remove_modifier':      (v) => `Remove modifier: ${locOrClean(String(v))}`,
        'add_deposit':          (v) => `Add deposit: ${locOrClean(String(v))}`,
        'remove_deposit':       (v) => `Remove deposit: ${locOrClean(String(v))}`,
        'add_building':         (v) => `Add building: ${locOrClean(String(v))}`,
        'remove_building':      (v) => `Remove building: ${locOrClean(String(v))}`,
        'add_district':         (v) => `Add district: ${locOrClean(String(v))}`,

        // Event triggers
        'country_event':        (v) => parseEventCall(v),
        'planet_event':         (v) => parseEventCall(v),
        'ship_event':           (v) => parseEventCall(v),
        'fleet_event':          (v) => parseEventCall(v),
        'pop_event':            (v) => parseEventCall(v),
        'observer_event':       (v) => parseEventCall(v),
        'situation_event':      (v) => parseEventCall(v),

        // Hidden
        'hidden_effect':        (v, d) => `<span class="negation">(Hidden)</span>${nested(v, d)}`,

        // Scopes (effects)
        'random_owned_planet':  (v, d) => `Random owned planet:${nested(v, d)}`,
        'random_owned_pop':     (v, d) => `Random owned pop:${nested(v, d)}`,
        'random_owned_fleet':   (v, d) => `Random owned fleet:${nested(v, d)}`,
        'random_owned_ship':    (v, d) => `Random owned ship:${nested(v, d)}`,
        'random_owned_leader':  (v, d) => `Random owned leader:${nested(v, d)}`,
        'random_country':       (v, d) => `Random country:${nested(v, d)}`,
        'random_planet':        (v, d) => `Random planet:${nested(v, d)}`,
        'random_system':        (v, d) => `Random system:${nested(v, d)}`,
        'random_pop':           (v, d) => `Random pop:${nested(v, d)}`,
        'random_army':          (v, d) => `Random army:${nested(v, d)}`,
        'random_list':          (v, d) => `Random one of:${nested(v, d)}`,
        'every_owned_planet':   (v, d) => `Every owned planet:${nested(v, d)}`,
        'every_owned_pop':      (v, d) => `Every owned pop:${nested(v, d)}`,
        'every_owned_fleet':    (v, d) => `Every owned fleet:${nested(v, d)}`,
        'every_owned_leader':   (v, d) => `Every owned leader:${nested(v, d)}`,
        'every_country':        (v, d) => `Every country:${nested(v, d)}`,
        'every_planet':         (v, d) => `Every planet:${nested(v, d)}`,
        'every_system':         (v, d) => `Every system:${nested(v, d)}`,
        'every_pop':            (v, d) => `Every pop:${nested(v, d)}`,

        // Conditionals
        'if':                   (v, d) => humanizeIf(v, d),
        'else':                 (v, d) => `Else:${nested(v, d)}`,
        'else_if':              (v, d) => humanizeElseIf(v, d),
        'while':                (v, d) => `While:${nested(v, d)}`,
        'switch':               (v, d) => `Switch:${nested(v, d)}`,
        'limit':                (v, d) => `Condition:${nested(v, d)}`,

        // Common effects
        'add_opinion_modifier': (v) => parseOpinionModifier(v),
        'set_hostile':          (v) => `Set hostile towards ${v}`,
        'set_relation':         (v) => `Set relation: ${JSON.stringify(v)}`,
        'save_event_target_as': (v) => `Save as event target "${v}"`,
        'save_global_event_target_as': (v) => `Save as global event target "${v}"`,
        'create_country':       (v, d) => `Create country:${nested(v, d)}`,
        'create_fleet':         (v, d) => `Create fleet:${nested(v, d)}`,
        'create_ship':          (v, d) => `Create ship:${nested(v, d)}`,
        'create_army':          (v, d) => `Create army:${nested(v, d)}`,
        'create_leader':        (v, d) => `Create leader:${nested(v, d)}`,
        'create_pop':           (v, d) => `Create pop:${nested(v, d)}`,
        'create_species':       (v, d) => `Create species:${nested(v, d)}`,
        'create_point_of_interest': (v, d) => `Create point of interest:${nested(v, d)}`,
        'destroy_country':      (v) => `Destroy country: ${v}`,
        'kill_leader':          (v) => `Kill leader: ${JSON.stringify(v)}`,
        'kill_pop':             (v) => `Kill pop`,
        'remove_planet':        (v) => `Remove planet: ${v}`,
        'change_government':    (v, d) => `Change government:${nested(v, d)}`,
        'add_ethic':            (v) => `Add ethic: ${locOrClean(v)}`,
        'remove_ethic':         (v) => `Remove ethic: ${locOrClean(v)}`,
        'add_civic':            (v) => `Add civic: ${locOrClean(v)}`,
        'remove_civic':         (v) => `Remove civic: ${locOrClean(v)}`,
        'add_technology':       (v) => `Add technology: ${locOrClean(v)}`,
        'add_tradition':        (v) => `Add tradition: ${locOrClean(v)}`,
        'set_name':             (v) => `Set name: "${locOrClean(v)}"`,
        'set_owner':            (v) => `Set owner: ${v}`,
        'set_controller':       (v) => `Set controller: ${v}`,
        'change_variable':      (v) => parseVariable(v),
        'set_variable':         (v) => parseVariable(v),
        'set_planet_flag':      (v) => `Set planet flag "${v}"`,
        'set_confused':         (v) => v === 'yes' ? 'Set confused' : 'Clear confused',
        'custom_tooltip':       (v) => `${locOrClean(v)}`,
        'tooltip':              (v, d) => `Tooltip:${nested(v, d)}`,
        'begin_event_chain':    (v) => `Begin event chain: ${JSON.stringify(v)}`,
        'end_event_chain':      (v) => `End event chain: ${v}`,
        'enable_special_project': (v) => `Enable special project: ${JSON.stringify(v)}`,
        'trigger_megastructure_icon': (v) => `Trigger megastructure icon: ${v}`,
        'break':                () => 'Break',
        'log':                  (v) => `Log: "${v}"`,
    };

    // -------------------------------------------------------------------------
    // Variable helper
    // -------------------------------------------------------------------------
    function parseVariable(v) {
        if (!Array.isArray(v)) return `Variable: ${JSON.stringify(v)}`;
        let which = '', val = '';
        for (const item of v) {
            if (typeof item === 'object') {
                for (const [k, v2] of Object.entries(item)) {
                    if (k === 'which') which = v2;
                    else if (k === 'value') val = v2;
                }
            }
        }
        return `Variable "${which}" = ${val}`;
    }

    function parseOpinionModifier(v) {
        if (!Array.isArray(v)) return `Add opinion modifier: ${JSON.stringify(v)}`;
        let mod = '', who = '';
        for (const item of v) {
            if (typeof item === 'object') {
                for (const [k, val] of Object.entries(item)) {
                    if (k === 'modifier') mod = val;
                    else if (k === 'who') who = val;
                }
            }
        }
        return `Add opinion modifier "${mod}"` + (who ? ` towards ${who}` : '');
    }

    // -------------------------------------------------------------------------
    // Known scope keywords (used for scope-change detection)
    // -------------------------------------------------------------------------
    const SCOPE_KEYS = new Set([
        'owner', 'from', 'root', 'prev', 'prevprev', 'prevprevprev', 'prevprevprevprev',
        'this', 'capital_scope', 'solar_system', 'star', 'planet', 'leader', 'species',
        'pop', 'army', 'fleet', 'ship', 'sector', 'federation', 'galactic_community',
        'overlord', 'subject', 'controller', 'home_planet', 'orbit', 'pop_faction',
        'event_target:', 'fromfrom', 'fromfromfrom', 'fromfromfromfrom',
    ]);

    function isScopeKey(key) {
        if (SCOPE_KEYS.has(key)) return true;
        if (key.startsWith('event_target:')) return true;
        return false;
    }

    // -------------------------------------------------------------------------
    // if / else_if helpers
    // -------------------------------------------------------------------------
    function humanizeIf(v, depth) {
        if (!Array.isArray(v)) return `If: ${escHtml(JSON.stringify(v))}`;
        let limitHtml = '';
        const bodyItems = [];
        for (const item of v) {
            if (typeof item === 'object' && item !== null) {
                const keys = Object.keys(item);
                if (keys.length === 1 && keys[0] === 'limit') {
                    limitHtml = `<div class="condition">If:${nested(item.limit, depth)}</div>`;
                } else {
                    bodyItems.push(item);
                }
            }
        }
        const bodyHtml = bodyItems.length ? humanizeItems(bodyItems, depth) : '';
        return limitHtml + bodyHtml;
    }

    function humanizeElseIf(v, depth) {
        if (!Array.isArray(v)) return `Else if: ${escHtml(JSON.stringify(v))}`;
        let limitHtml = '';
        const bodyItems = [];
        for (const item of v) {
            if (typeof item === 'object' && item !== null) {
                const keys = Object.keys(item);
                if (keys.length === 1 && keys[0] === 'limit') {
                    limitHtml = `<div class="condition">Else if:${nested(item.limit, depth)}</div>`;
                } else {
                    bodyItems.push(item);
                }
            }
        }
        const bodyHtml = bodyItems.length ? humanizeItems(bodyItems, depth) : '';
        return limitHtml + bodyHtml;
    }

    // -------------------------------------------------------------------------
    // Core: humanize a single key-value pair
    // -------------------------------------------------------------------------
    function humanizeEntry(key, val, depth) {
        // Check trigger map first, then effect map
        const trigFn = TRIGGER_MAP[key];
        if (trigFn) {
            return trigFn.length >= 2 ? trigFn(val, depth) : trigFn(val);
        }
        const effFn = EFFECT_MAP[key];
        if (effFn) {
            return effFn.length >= 2 ? effFn(val, depth) : effFn(val);
        }

        // Scope change – render as "Scope: key" with nested content
        if (isScopeKey(key) && Array.isArray(val)) {
            return `<em>${escHtml(key)}</em>:${nested(val, depth)}`;
        }

        // Comparison operators in value object
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            const entries = Object.entries(val);
            if (entries.length === 1 && ['>', '<', '>=', '<='].includes(entries[0][0])) {
                return `${escHtml(key)} ${entries[0][0]} ${escHtml(String(entries[0][1]))}`;
            }
            // Nested object with sub-keys – render as scope
            if (entries.length >= 1) {
                const inner = entries.map(([k, v2]) => {
                    if (Array.isArray(v2)) {
                        return humanizeEntry(k, v2, depth);
                    }
                    return humanizeEntry(k, v2, depth);
                }).join('');
                return `${escHtml(key)}:${wrapNested(inner, depth)}`;
            }
        }

        // Array value but unknown key – might be a modded scope/trigger
        if (Array.isArray(val)) {
            return `${escHtml(key)}:${nested(val, depth)}`;
        }

        // Fallback: plain key = value in monospace
        return `<span class="unknown">${escHtml(key)} = ${escHtml(String(val))}</span>`;
    }

    // -------------------------------------------------------------------------
    // Render an array of items
    // -------------------------------------------------------------------------
    function humanizeItems(items, depth) {
        if (!items || !items.length) return '';
        const lines = [];
        for (const item of items) {
            if (item === null || item === undefined) continue;
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                lines.push(`<div class="h-line">${escHtml(String(item))}</div>`);
                continue;
            }
            if (typeof item === 'object' && !Array.isArray(item)) {
                for (const [k, v] of Object.entries(item)) {
                    lines.push(`<div class="h-line">${humanizeEntry(k, v, depth)}</div>`);
                }
            }
        }
        return lines.join('');
    }

    // -------------------------------------------------------------------------
    // Nested block wrapper
    // -------------------------------------------------------------------------
    function nested(val, depth) {
        depth = (depth || 0) + 1;
        if (depth > 12) return '<span class="unknown">[nested too deep]</span>';
        if (Array.isArray(val)) {
            return wrapNested(humanizeItems(val, depth), depth);
        }
        if (val && typeof val === 'object') {
            const items = Object.entries(val).map(([k, v]) => ({ [k]: v }));
            return wrapNested(humanizeItems(items, depth), depth);
        }
        return ` ${escHtml(String(val))}`;
    }

    function wrapNested(innerHtml, depth) {
        if (!innerHtml) return '';
        return `<div class="condition">${innerHtml}</div>`;
    }

    // -------------------------------------------------------------------------
    // Public: humanizeBlock(block)
    // -------------------------------------------------------------------------
    function humanizeBlock(block) {
        if (!block) return '';
        if (typeof block === 'string') return escHtml(block);
        if (Array.isArray(block)) {
            return humanizeItems(block, 0);
        }
        if (typeof block === 'object') {
            const items = Object.entries(block).map(([k, v]) => ({ [k]: v }));
            return humanizeItems(items, 0);
        }
        return escHtml(String(block));
    }

    return { humanizeBlock, locOrClean };
})();
