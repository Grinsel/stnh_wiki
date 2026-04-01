/**
 * Humanize engine – converts parsed PDX JSON structures into human-readable HTML.
 * Designed for casual players: natural language, visual hierarchy, no code feel.
 * Client-side only, no pipeline changes needed.
 */
const Humanize = (() => {

    // =========================================================================
    // Helpers
    // =========================================================================

    function locOrClean(key) {
        if (!key || typeof key !== 'string') return String(key ?? '');
        const resolved = I18n.t(key);
        if (resolved !== key) return resolved;
        let clean = key
            .replace(/^(ethic_|trait_|civic_|tech_|ap_|tradition_|building_|ship_size_|weapon_type_|authority_|origin_|species_trait_|leader_trait_)/, '')
            .replace(/_/g, ' ');
        return clean.replace(/\b\w/g, c => c.toUpperCase());
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = String(s ?? '');
        return d.innerHTML;
    }

    /** Format a yes/no value as natural text */
    function yn(v, yes, no) { return v === 'yes' ? yes : no; }

    /** Scope labels: make fromfrom etc readable */
    const SCOPE_LABELS = {
        'owner':        'The owner',
        'from':         'The source',
        'fromfrom':     'The source\u2019s source',
        'fromfromfrom':  'The source (3rd level)',
        'fromfromfromfrom': 'The source (4th level)',
        'root':         'The root scope',
        'prev':         'The previous scope',
        'prevprev':     'Two scopes back',
        'prevprevprev':  'Three scopes back',
        'this':         'This scope',
        'capital_scope': 'The capital planet',
        'solar_system': 'The star system',
        'star':         'The star',
        'planet':       'The planet',
        'leader':       'The leader',
        'species':      'The species',
        'pop':          'The pop',
        'army':         'The army',
        'fleet':        'The fleet',
        'ship':         'The ship',
        'sector':       'The sector',
        'federation':   'The federation',
        'galactic_community': 'The Galactic Community',
        'overlord':     'The overlord',
        'subject':      'The subject',
        'controller':   'The controller',
        'home_planet':  'The home planet',
        'orbit':        'The orbited body',
        'pop_faction':  'The pop faction',
    };

    function scopeLabel(key) {
        if (SCOPE_LABELS[key]) return SCOPE_LABELS[key];
        if (key.startsWith('event_target:')) {
            const name = key.slice(13).replace(/_/g, ' ');
            return `Target "${name}"`;
        }
        // Dotted scopes like "root.fromfromfrom" or "planet.owner"
        if (key.includes('.')) {
            return key.split('.').map(p => SCOPE_LABELS[p] || locOrClean(p)).join(' \u2192 ');
        }
        return null;
    }

    const SCOPE_KEYS = new Set(Object.keys(SCOPE_LABELS));
    function isScopeKey(key) {
        return SCOPE_KEYS.has(key) || key.startsWith('event_target:') || key.includes('.');
    }

    // =========================================================================
    // Comparison & resource helpers
    // =========================================================================

    function fmtCmp(label, val) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            const ops = Object.entries(val);
            if (ops.length === 1 && ['>', '<', '>=', '<='].includes(ops[0][0])) {
                const sym = { '>': 'more than', '<': 'fewer than', '>=': 'at least', '<=': 'at most' };
                return `${label}: ${sym[ops[0][0]] || ops[0][0]} ${ops[0][1]}`;
            }
        }
        return `${label}: ${val}`;
    }

    function parseResourceCheck(v) {
        if (!Array.isArray(v)) return `Has resource: ${JSON.stringify(v)}`;
        const parts = []; let type = null;
        for (const item of v) {
            if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                if (k === 'type') type = val; else parts.push(fmtCmp(locOrClean(k), val));
            }
        }
        return type ? `Has ${locOrClean(type)}: ${parts.join(', ')}` : `Has resource: ${parts.join(', ')}`;
    }

    function parseResourceEffect(v) {
        if (!Array.isArray(v)) return `Add resources: ${JSON.stringify(v)}`;
        const parts = [];
        for (const item of v) {
            if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                parts.push(`${locOrClean(k)} ${Number(val) >= 0 ? '+' : ''}${val}`);
            }
        }
        return `Gain ${parts.join(', ')}`;
    }

    function parseModifierEffect(v) {
        if (!Array.isArray(v)) return `Apply modifier "${locOrClean(String(v))}"`;
        let name = ''; const parts = [];
        for (const item of v) {
            if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                if (k === 'modifier') name = locOrClean(val);
                else if (k === 'days' || k === 'months' || k === 'years') parts.push(`${val} ${k}`);
                else parts.push(`${k}: ${val}`);
            }
        }
        return `Apply modifier <strong>"${esc(name)}"</strong>` + (parts.length ? ` for ${parts.join(', ')}` : '');
    }

    function parseTimedFlag(scope, v) {
        if (!Array.isArray(v)) return `Set timed ${scope} flag: ${JSON.stringify(v)}`;
        let flag = '', duration = '';
        for (const item of v) {
            if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                if (k === 'flag') flag = val; else if (k === 'days' || k === 'months' || k === 'years') duration = `${val} ${k}`;
            }
        }
        return `Set ${scope} flag <em>"${esc(flag)}"</em>` + (duration ? ` (${duration})` : '');
    }

    function parseEventCall(v) {
        if (typeof v === 'string') return `Trigger event <span class="event-link" data-event-id="${esc(v)}">${esc(v)}</span>`;
        if (!Array.isArray(v)) return `Trigger event: ${JSON.stringify(v)}`;
        let id = '', days = '', random = '';
        for (const item of v) {
            if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                if (k === 'id') id = val; else if (k === 'days') days = val; else if (k === 'random') random = val;
            }
        }
        let s = `Trigger event <span class="event-link" data-event-id="${esc(id)}">${esc(id)}</span>`;
        if (days) s += ` after ${days} days`;
        if (random) s += ` (random delay up to ${random} days)`;
        return s;
    }

    function parseVariable(v) {
        if (!Array.isArray(v)) return `Variable: ${JSON.stringify(v)}`;
        let which = '', val = '';
        for (const item of v) {
            if (typeof item === 'object') for (const [k, v2] of Object.entries(item)) {
                if (k === 'which') which = v2; else if (k === 'value') val = v2;
            }
        }
        return `Set variable <em>"${esc(which)}"</em> = ${val}`;
    }

    function parseOpinionModifier(v) {
        if (!Array.isArray(v)) return `Add opinion modifier: ${JSON.stringify(v)}`;
        let mod = '', who = '';
        for (const item of v) {
            if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                if (k === 'modifier') mod = val; else if (k === 'who') who = val;
            }
        }
        return `Apply opinion modifier <em>"${esc(mod)}"</em>` + (who ? ` towards ${scopeLabel(who) || who}` : '');
    }

    function parseTraitEffect(v) {
        if (!Array.isArray(v)) return `Gain trait: ${locOrClean(String(v))}`;
        let trait = '';
        for (const item of v) {
            if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                if (k === 'trait') trait = val;
            }
        }
        return `Gain trait: <strong>${esc(locOrClean(trait))}</strong>`;
    }

    function parseRemoveTraitEffect(v) {
        if (!Array.isArray(v)) return `Lose trait: ${locOrClean(String(v))}`;
        let trait = '';
        for (const item of v) {
            if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                if (k === 'trait') trait = val;
            }
        }
        return `Lose trait: <strong>${esc(locOrClean(trait))}</strong>`;
    }

    // =========================================================================
    // Condition flattening for simple cases
    // =========================================================================

    function isSimpleLeaf(items) {
        if (!Array.isArray(items) || !items.length || items.length > 5) return false;
        for (const item of items) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
            const keys = Object.keys(item);
            if (keys.length !== 1) return false;
            const v = item[keys[0]];
            if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return false;
        }
        return true;
    }

    function leafText(item) {
        const k = Object.keys(item)[0];
        const v = item[k];
        const fn = TRIGGER_MAP[k] || EFFECT_MAP[k];
        if (fn && fn.length < 2) return fn(v);
        if (typeof v === 'number' && !STRUCTURAL_KEYS.has(k)) return formatModifierValue(k, v);
        if (typeof v === 'string') return `${locOrClean(k)}: ${locOrClean(v)}`;
        return `${locOrClean(k)} = ${v}`;
    }

    // =========================================================================
    // TRIGGER MAP — natural language
    // =========================================================================

    const TRIGGER_MAP = {
        // --- Logic operators ---
        'NOT': (v, d) => {
            if (isSimpleLeaf(v) && v.length === 1)
                return `<span class="negation">Not:</span> ${leafText(v[0])}`;
            return `<span class="h-label negation">None of the following:</span>${nested(v, d)}`;
        },
        'OR': (v, d) => {
            if (isSimpleLeaf(v))
                return v.map(i => leafText(i)).join(' <span class="cond-join">or</span> ');
            return `<span class="h-label">Any one of:</span>${nested(v, d)}`;
        },
        'AND': (v, d) => {
            if (isSimpleLeaf(v))
                return v.map(i => leafText(i)).join(' <span class="cond-join">and</span> ');
            return `<span class="h-label">All of:</span>${nested(v, d)}`;
        },
        'NOR': (v, d) => `<span class="h-label negation">None of these:</span>${nested(v, d)}`,
        'NAND': (v, d) => `<span class="h-label negation">Not all of these:</span>${nested(v, d)}`,

        // --- Flag checks ---
        'has_country_flag':     (v) => `Country flag <em>"${esc(v)}"</em> is set`,
        'has_global_flag':      (v) => `Global flag <em>"${esc(v)}"</em> is set`,
        'has_planet_flag':      (v) => `Planet flag <em>"${esc(v)}"</em> is set`,
        'has_star_flag':        (v) => `Star flag <em>"${esc(v)}"</em> is set`,
        'has_fleet_flag':       (v) => `Fleet flag <em>"${esc(v)}"</em> is set`,
        'has_ship_flag':        (v) => `Ship flag <em>"${esc(v)}"</em> is set`,
        'has_system_flag':      (v) => `System flag <em>"${esc(v)}"</em> is set`,
        'has_pop_flag':         (v) => `Pop flag <em>"${esc(v)}"</em> is set`,
        'has_megastructure_flag': (v) => `Megastructure flag <em>"${esc(v)}"</em> is set`,
        'has_species_flag':     (v) => `Species flag <em>"${esc(v)}"</em> is set`,
        'has_leader_flag':      (v) => `Leader flag <em>"${esc(v)}"</em> is set`,
        'has_first_contact_flag': (v) => `First contact flag <em>"${esc(v)}"</em> is set`,

        // --- Properties ---
        'has_ethic':            (v) => `Has <strong>${esc(locOrClean(v))}</strong> ethic`,
        'has_technology':       (v) => `Has researched <strong>${esc(locOrClean(v))}</strong>`,
        'has_tradition':        (v) => `Has adopted tradition <strong>${esc(locOrClean(v))}</strong>`,
        'has_civic':            (v) => `Has civic <strong>${esc(locOrClean(v))}</strong>`,
        'has_authority':        (v) => `Has authority type <strong>${esc(locOrClean(v))}</strong>`,
        'has_origin':           (v) => `Has origin <strong>${esc(locOrClean(v))}</strong>`,
        'has_ascension_perk':   (v) => `Has ascension perk <strong>${esc(locOrClean(v))}</strong>`,
        'has_modifier':         (v) => `Has active modifier <strong>${esc(locOrClean(v))}</strong>`,
        'has_trait':            (v) => `Has trait <strong>${esc(locOrClean(v))}</strong>`,
        'has_deposit':          (v) => `Has deposit <strong>${esc(locOrClean(v))}</strong>`,
        'has_building':         (v) => `Has building <strong>${esc(locOrClean(v))}</strong>`,
        'has_district':         (v) => `Has district <strong>${esc(locOrClean(v))}</strong>`,
        'has_job':              (v) => `Has job <strong>${esc(locOrClean(v))}</strong>`,
        'has_resource':         (v) => parseResourceCheck(v),

        // --- Identity checks ---
        'is_country_type':      (v) => `Country type is <strong>${esc(locOrClean(v))}</strong>`,
        'is_planet_class':      (v) => `Planet class is <strong>${esc(locOrClean(v))}</strong>`,
        'is_star_class':        (v) => `Star class is <strong>${esc(locOrClean(v))}</strong>`,
        'is_same_species':      (v) => `Is the same species as ${scopeLabel(v) || v}`,
        'is_species_class':     (v) => `Species class is <strong>${esc(locOrClean(v))}</strong>`,
        'is_ship_size':         (v) => `Ship size is <strong>${esc(locOrClean(v))}</strong>`,
        'is_ship_class':        (v) => `Ship class is <strong>${esc(locOrClean(v))}</strong>`,
        'is_same_value':        (v) => `Is the same as ${scopeLabel(v) || v}`,
        'is_same_empire':       (v) => `Is the same empire as ${scopeLabel(v) || v}`,
        'is_owned_by':          (v) => `Is owned by ${scopeLabel(v) || v}`,
        'is_war_leader':        (v) => yn(v, 'Is the war leader', 'Is not the war leader'),

        // --- State checks ---
        'is_ai':                (v) => yn(v, 'Is AI-controlled', 'Is player-controlled'),
        'is_at_war':            (v) => yn(v, 'Is at war', 'Is at peace'),
        'is_at_war_with':       (v) => `Is at war with ${scopeLabel(v) || v}`,
        'is_hostile_to':        (v) => `Is hostile to ${scopeLabel(v) || v}`,
        'is_homicidal':         (v) => yn(v, 'Is homicidal', 'Is not homicidal'),
        'is_militarist':        (v) => yn(v, 'Is Militarist', 'Is not Militarist'),
        'is_pacifist':          (v) => yn(v, 'Is Pacifist', 'Is not Pacifist'),
        'is_xenophile':         (v) => yn(v, 'Is Xenophile', 'Is not Xenophile'),
        'is_xenophobe':         (v) => yn(v, 'Is Xenophobe', 'Is not Xenophobe'),
        'is_materialist':       (v) => yn(v, 'Is Materialist', 'Is not Materialist'),
        'is_spiritualist':      (v) => yn(v, 'Is Spiritualist', 'Is not Spiritualist'),
        'is_egalitarian':       (v) => yn(v, 'Is Egalitarian', 'Is not Egalitarian'),
        'is_authoritarian':     (v) => yn(v, 'Is Authoritarian', 'Is not Authoritarian'),
        'is_gestalt':           (v) => yn(v, 'Is a Gestalt Consciousness', 'Is not a Gestalt Consciousness'),
        'is_machine_empire':    (v) => yn(v, 'Is a Machine Empire', 'Is not a Machine Empire'),
        'is_hive_empire':       (v) => yn(v, 'Is a Hive Mind', 'Is not a Hive Mind'),
        'is_megacorp':          (v) => yn(v, 'Is a Megacorp', 'Is not a Megacorp'),
        'is_fallen_empire':     (v) => yn(v, 'Is a Fallen Empire', 'Is not a Fallen Empire'),
        'is_subject':           (v) => yn(v, 'Is a subject/vassal', 'Is independent'),
        'is_overlord':          (v) => yn(v, 'Is an overlord', 'Is not an overlord'),
        'is_federation_leader': (v) => yn(v, 'Is federation leader', 'Is not federation leader'),
        'is_galactic_community_member': (v) => yn(v, 'Is a Galactic Community member', 'Is not a Galactic Community member'),
        'is_enslaved':          (v) => yn(v, 'Is enslaved', 'Is free'),
        'is_being_purged':      (v) => yn(v, 'Is being purged', 'Is not being purged'),
        'is_sapient':           (v) => yn(v, 'Is sapient', 'Is not sapient'),
        'is_colony':            (v) => yn(v, 'Is a colony', 'Is not a colony'),
        'is_capital':           (v) => yn(v, 'Is the capital world', 'Is not the capital'),
        'is_occupied_flag':     (v) => yn(v, 'Is occupied', 'Is not occupied'),
        'is_homeworld':         (v) => yn(v, 'Is the homeworld', 'Is not the homeworld'),
        'is_primitive':         (v) => yn(v, 'Is a primitive civilization', 'Is not primitive'),
        'is_assimilator':       (v) => yn(v, 'Is an Assimilator empire', 'Is not an Assimilator'),
        'is_regular_empire':    (v) => yn(v, 'Is a regular empire', 'Is not a regular empire'),
        'is_normal_country':    (v) => yn(v, 'Is a normal country', 'Is not a normal country'),
        'is_playable_country':  (v) => yn(v, 'Is a playable country', 'Is not playable'),
        'is_pirate':            (v) => yn(v, 'Is a pirate', 'Is not a pirate'),
        'is_criminal_syndicate':(v) => yn(v, 'Is a Criminal Syndicate', 'Is not a Criminal Syndicate'),
        'is_lithoid_empire':    (v) => yn(v, 'Is a Lithoid empire', 'Is not a Lithoid empire'),
        'is_catalytic_empire':  (v) => yn(v, 'Is a Catalytic empire', 'Is not Catalytic'),
        'is_robot_pop':         (v) => yn(v, 'Is a robot', 'Is not a robot'),
        'is_organic_species':   (v) => yn(v, 'Is organic', 'Is not organic'),
        'is_being_assimilated': (v) => yn(v, 'Is being assimilated', 'Is not being assimilated'),
        'is_drone':             (v) => yn(v, 'Is a drone', 'Is not a drone'),
        'is_ruler':             (v) => yn(v, 'Is the ruler', 'Is not the ruler'),
        'is_idle':              (v) => yn(v, 'Is idle/unassigned', 'Is assigned'),
        'has_owner':            (v) => yn(v, 'Has an owner', 'Has no owner'),
        'has_ground_combat':    (v) => yn(v, 'Has ground combat', 'No ground combat'),
        'exists':               (v) => typeof v === 'string' ? `${scopeLabel(v) || v} exists` : yn(v, 'Exists', 'Does not exist'),

        // --- Numeric ---
        'num_pops':             (v) => fmtCmp('Population', v),
        'num_owned_planets':    (v) => fmtCmp('Owned planets', v),
        'num_communications':   (v) => fmtCmp('Known empires', v),
        'count_owned_pops':     (v) => fmtCmp('Owned pops', v),
        'years_passed':         (v) => fmtCmp('Years passed', v),
        'num_fleets':           (v) => fmtCmp('Fleets', v),
        'num_armies':           (v) => fmtCmp('Armies', v),
        'fleet_power':          (v) => fmtCmp('Fleet power', v),
        'pop_amount':           (v) => fmtCmp('Pops on planet', v),
        'num_buildings':        (v) => fmtCmp('Buildings', v),
        'num_districts':        (v) => fmtCmp('Districts', v),
        'free_housing':         (v) => fmtCmp('Free housing', v),
        'free_jobs':            (v) => fmtCmp('Free jobs', v),
        'relative_power':       (v) => `Relative power: ${JSON.stringify(v)}`,
        'num_active_gateways':  (v) => fmtCmp('Active gateways', v),

        // --- Quantifiers / scoped triggers ---
        'any_owned_planet':     (v, d) => `<span class="h-label">For any owned planet where:</span>${nested(v, d)}`,
        'any_owned_leader':     (v, d) => `<span class="h-label">For any owned leader where:</span>${nested(v, d)}`,
        'any_owned_pop':        (v, d) => `<span class="h-label">For any owned pop where:</span>${nested(v, d)}`,
        'any_owned_fleet':      (v, d) => `<span class="h-label">For any owned fleet where:</span>${nested(v, d)}`,
        'any_owned_ship':       (v, d) => `<span class="h-label">For any owned ship where:</span>${nested(v, d)}`,
        'any_system_within_border': (v, d) => `<span class="h-label">For any system within borders where:</span>${nested(v, d)}`,
        'any_neighbor_country': (v, d) => `<span class="h-label">For any neighboring country where:</span>${nested(v, d)}`,
        'any_country':          (v, d) => `<span class="h-label">For any country where:</span>${nested(v, d)}`,
        'any_planet':           (v, d) => `<span class="h-label">For any planet where:</span>${nested(v, d)}`,
        'any_pop':              (v, d) => `<span class="h-label">For any pop where:</span>${nested(v, d)}`,
        'any_war':              (v, d) => `<span class="h-label">For any war where:</span>${nested(v, d)}`,
        'any_fleet_in_system':  (v, d) => `<span class="h-label">For any fleet in system where:</span>${nested(v, d)}`,
        'any_ship_in_system':   (v, d) => `<span class="h-label">For any ship in system where:</span>${nested(v, d)}`,
        'any_army':             (v, d) => `<span class="h-label">For any army where:</span>${nested(v, d)}`,
        'any_species':          (v, d) => `<span class="h-label">For any species where:</span>${nested(v, d)}`,
        'any_member':           (v, d) => `<span class="h-label">For any member where:</span>${nested(v, d)}`,
        'any_federation_ally':  (v, d) => `<span class="h-label">For any federation ally where:</span>${nested(v, d)}`,
        'any_subject':          (v, d) => `<span class="h-label">For any subject where:</span>${nested(v, d)}`,
        'any_rival_country':    (v, d) => `<span class="h-label">For any rival where:</span>${nested(v, d)}`,
        'any_relation':         (v, d) => `<span class="h-label">For any relation where:</span>${nested(v, d)}`,
        'any_playable_country': (v, d) => `<span class="h-label">For any playable country where:</span>${nested(v, d)}`,
        'any_deposit':          (v, d) => `<span class="h-label">For any deposit where:</span>${nested(v, d)}`,
        'any_tile':             (v, d) => `<span class="h-label">For any tile where:</span>${nested(v, d)}`,
        'any_envoy':            (v, d) => `<span class="h-label">For any envoy where:</span>${nested(v, d)}`,
        'every_owned_planet':   (v, d) => `<span class="h-label">For every owned planet:</span>${nested(v, d)}`,
        'every_owned_pop':      (v, d) => `<span class="h-label">For every owned pop:</span>${nested(v, d)}`,
        'every_owned_fleet':    (v, d) => `<span class="h-label">For every owned fleet:</span>${nested(v, d)}`,
        'every_owned_leader':   (v, d) => `<span class="h-label">For every owned leader:</span>${nested(v, d)}`,
        'every_country':        (v, d) => `<span class="h-label">For every country:</span>${nested(v, d)}`,
        'every_planet':         (v, d) => `<span class="h-label">For every planet:</span>${nested(v, d)}`,
        'every_system':         (v, d) => `<span class="h-label">For every system:</span>${nested(v, d)}`,
        'every_pop':            (v, d) => `<span class="h-label">For every pop:</span>${nested(v, d)}`,
        'count_owned_planet':   (v, d) => `<span class="h-label">Count owned planets where:</span>${nested(v, d)}`,
        'count_country':        (v, d) => `<span class="h-label">Count countries where:</span>${nested(v, d)}`,

        // --- STNH-specific ---
        'is_vulcan_story_empire':   (v) => yn(v, 'Is a Vulcan story empire', 'Is not a Vulcan story empire'),
        'has_any_drone_authority':   (v) => yn(v, 'Has a drone authority', 'Does not have a drone authority'),
        'is_earth_story_empire':     (v) => yn(v, 'Is an Earth story empire', 'Is not an Earth story empire'),

        // --- Miscellaneous ---
        'always':               (v) => yn(v, '<em>Always</em>', '<em>Never</em>'),
        'host_has_dlc':         (v) => `Requires DLC: <strong>${esc(v)}</strong>`,
        'has_event_chain':      (v) => `Event chain <em>"${esc(v)}"</em> is active`,
        'is_event_leader':      (v) => yn(v, 'Is the event leader', 'Is not the event leader'),
        'has_communications':   (v) => `Has communications with ${scopeLabel(v) || v}`,
        'has_policy_flag':      (v) => `Has policy: <em>"${esc(v)}"</em>`,
        'has_valid_civic':      (v) => `Has valid civic: <strong>${esc(locOrClean(v))}</strong>`,
        'check_variable':       (v) => parseVariable(v),
        'text':                 (v) => `${locOrClean(v)}`,
        'custom_tooltip':       (v) => `<em>${esc(locOrClean(v))}</em>`,
        'custom_tooltip_fail':  (v) => `<em>(On fail) ${esc(locOrClean(v))}</em>`,
        'has_paragon_dlc':      (v) => yn(v, 'Requires Paragon DLC', 'Paragon DLC not installed'),
        'has_overlord_dlc':     (v) => yn(v, 'Requires Overlord DLC', 'Overlord DLC not installed'),
        'has_ancrel':           (v) => yn(v, 'Requires Ancient Relics DLC', 'Ancient Relics DLC not installed'),
        'has_nemesis':          (v) => yn(v, 'Requires Nemesis DLC', 'Nemesis DLC not installed'),
        'has_federations_dlc':  (v) => yn(v, 'Requires Federations DLC', 'Federations DLC not installed'),
        'is_scope_valid':       (v) => yn(v, 'Scope is valid', 'Scope is invalid'),
        'is_triggered_only':    (v) => yn(v, 'Can only be triggered by other events', 'Can fire naturally'),
        'target':               (v, d) => `<span class="h-label">Target:</span>${nested(v, d)}`,
    };

    // =========================================================================
    // EFFECT MAP — natural language with action arrows
    // =========================================================================

    const EFFECT_MAP = {
        // --- Flags ---
        'set_country_flag':     (v) => `Set country flag <em>"${esc(v)}"</em>`,
        'set_global_flag':      (v) => `Set global flag <em>"${esc(v)}"</em>`,
        'set_planet_flag':      (v) => `Set planet flag <em>"${esc(v)}"</em>`,
        'set_star_flag':        (v) => `Set star flag <em>"${esc(v)}"</em>`,
        'set_fleet_flag':       (v) => `Set fleet flag <em>"${esc(v)}"</em>`,
        'set_ship_flag':        (v) => `Set ship flag <em>"${esc(v)}"</em>`,
        'set_system_flag':      (v) => `Set system flag <em>"${esc(v)}"</em>`,
        'set_pop_flag':         (v) => `Set pop flag <em>"${esc(v)}"</em>`,
        'set_leader_flag':      (v) => `Set leader flag <em>"${esc(v)}"</em>`,
        'set_species_flag':     (v) => `Set species flag <em>"${esc(v)}"</em>`,
        'remove_country_flag':  (v) => `Remove country flag <em>"${esc(v)}"</em>`,
        'remove_global_flag':   (v) => `Remove global flag <em>"${esc(v)}"</em>`,
        'remove_planet_flag':   (v) => `Remove planet flag <em>"${esc(v)}"</em>`,
        'remove_star_flag':     (v) => `Remove star flag <em>"${esc(v)}"</em>`,
        'remove_fleet_flag':    (v) => `Remove fleet flag <em>"${esc(v)}"</em>`,
        'remove_ship_flag':     (v) => `Remove ship flag <em>"${esc(v)}"</em>`,
        'remove_system_flag':   (v) => `Remove system flag <em>"${esc(v)}"</em>`,
        'remove_pop_flag':      (v) => `Remove pop flag <em>"${esc(v)}"</em>`,
        'remove_leader_flag':   (v) => `Remove leader flag <em>"${esc(v)}"</em>`,
        'set_timed_country_flag': (v) => parseTimedFlag('country', v),
        'set_timed_planet_flag':  (v) => parseTimedFlag('planet', v),
        'set_timed_global_flag':  (v) => parseTimedFlag('global', v),
        'set_timed_star_flag':    (v) => parseTimedFlag('star', v),

        // --- Resources / modifiers ---
        'add_resource':         (v) => parseResourceEffect(v),
        'add_modifier':         (v) => parseModifierEffect(v),
        'remove_modifier':      (v) => `Remove modifier <strong>"${esc(locOrClean(String(v)))}"</strong>`,
        'add_deposit':          (v) => `Add deposit: <strong>${esc(locOrClean(String(v)))}</strong>`,
        'remove_deposit':       (v) => `Remove deposit: <strong>${esc(locOrClean(String(v)))}</strong>`,
        'add_building':         (v) => `Build: <strong>${esc(locOrClean(String(v)))}</strong>`,
        'remove_building':      (v) => `Demolish: <strong>${esc(locOrClean(String(v)))}</strong>`,
        'add_district':         (v) => `Add district: <strong>${esc(locOrClean(String(v)))}</strong>`,

        // --- Trait changes ---
        'add_trait':            (v) => typeof v === 'string' ? `Gain trait: <strong>${esc(locOrClean(v))}</strong>` : parseTraitEffect(v),
        'remove_trait':         (v) => typeof v === 'string' ? `Lose trait: <strong>${esc(locOrClean(v))}</strong>` : parseRemoveTraitEffect(v),

        // --- Events ---
        'country_event':        (v) => parseEventCall(v),
        'planet_event':         (v) => parseEventCall(v),
        'ship_event':           (v) => parseEventCall(v),
        'fleet_event':          (v) => parseEventCall(v),
        'pop_event':            (v) => parseEventCall(v),
        'observer_event':       (v) => parseEventCall(v),
        'situation_event':      (v) => parseEventCall(v),

        // --- Hidden effects ---
        'hidden_effect':        (v, d) => `<span class="h-label h-behind-scenes">Behind the scenes:</span>${nested(v, d)}`,

        // --- Scope effects (random/every) ---
        'random_owned_planet':  (v, d) => `<span class="h-label">Pick a random owned planet:</span>${nested(v, d)}`,
        'random_owned_pop':     (v, d) => `<span class="h-label">Pick a random owned pop:</span>${nested(v, d)}`,
        'random_owned_fleet':   (v, d) => `<span class="h-label">Pick a random owned fleet:</span>${nested(v, d)}`,
        'random_owned_ship':    (v, d) => `<span class="h-label">Pick a random owned ship:</span>${nested(v, d)}`,
        'random_owned_leader':  (v, d) => `<span class="h-label">Pick a random owned leader:</span>${nested(v, d)}`,
        'random_country':       (v, d) => `<span class="h-label">Pick a random country:</span>${nested(v, d)}`,
        'random_planet':        (v, d) => `<span class="h-label">Pick a random planet:</span>${nested(v, d)}`,
        'random_system':        (v, d) => `<span class="h-label">Pick a random system:</span>${nested(v, d)}`,
        'random_pop':           (v, d) => `<span class="h-label">Pick a random pop:</span>${nested(v, d)}`,
        'random_army':          (v, d) => `<span class="h-label">Pick a random army:</span>${nested(v, d)}`,
        'random_envoy':         (v, d) => `<span class="h-label">Pick a random envoy:</span>${nested(v, d)}`,
        'random_spynetwork':    (v, d) => `<span class="h-label">Pick a random spy network:</span>${nested(v, d)}`,
        'random_list':          (v, d) => `<span class="h-label">Randomly choose one of:</span>${nested(v, d)}`,
        'every_owned_planet':   (v, d) => `<span class="h-label">For every owned planet:</span>${nested(v, d)}`,
        'every_owned_pop':      (v, d) => `<span class="h-label">For every owned pop:</span>${nested(v, d)}`,
        'every_owned_fleet':    (v, d) => `<span class="h-label">For every owned fleet:</span>${nested(v, d)}`,
        'every_owned_leader':   (v, d) => `<span class="h-label">For every owned leader:</span>${nested(v, d)}`,
        'every_country':        (v, d) => `<span class="h-label">For every country:</span>${nested(v, d)}`,
        'every_planet':         (v, d) => `<span class="h-label">For every planet:</span>${nested(v, d)}`,
        'every_system':         (v, d) => `<span class="h-label">For every system:</span>${nested(v, d)}`,
        'every_pop':            (v, d) => `<span class="h-label">For every pop:</span>${nested(v, d)}`,

        // --- Conditionals ---
        'if':                   (v, d) => humanizeIf(v, d),
        'else':                 (v, d) => `<span class="h-label">Otherwise:</span>${nested(v, d)}`,
        'else_if':              (v, d) => humanizeElseIf(v, d),
        'while':                (v, d) => `<span class="h-label">Repeat while:</span>${nested(v, d)}`,
        'switch':               (v, d) => `<span class="h-label">Depending on:</span>${nested(v, d)}`,
        'limit':                (v, d) => `<span class="h-label">Where:</span>${nested(v, d)}`,

        // --- Creation / destruction ---
        'create_country':       (v, d) => `<span class="h-label">Create a new country:</span>${nested(v, d)}`,
        'create_fleet':         (v, d) => `<span class="h-label">Create a new fleet:</span>${nested(v, d)}`,
        'create_ship':          (v, d) => `<span class="h-label">Create a new ship:</span>${nested(v, d)}`,
        'create_army':          (v, d) => `<span class="h-label">Create a new army:</span>${nested(v, d)}`,
        'create_leader':        (v, d) => `<span class="h-label">Create a new leader:</span>${nested(v, d)}`,
        'create_pop':           (v, d) => `<span class="h-label">Create a new pop:</span>${nested(v, d)}`,
        'create_species':       (v, d) => `<span class="h-label">Create a new species:</span>${nested(v, d)}`,
        'create_point_of_interest': (v, d) => `<span class="h-label">Create a point of interest:</span>${nested(v, d)}`,
        'create_espionage_asset': (v, d) => `<span class="h-label">Create espionage asset:</span>${nested(v, d)}`,
        'clone_leader':         (v, d) => `<span class="h-label">Clone a leader:</span>${nested(v, d)}`,
        'last_created_leader':  (v, d) => `<span class="h-label">The newly created leader:</span>${nested(v, d)}`,
        'last_created_fleet':   (v, d) => `<span class="h-label">The newly created fleet:</span>${nested(v, d)}`,
        'last_created_country': (v, d) => `<span class="h-label">The newly created country:</span>${nested(v, d)}`,
        'last_created_ship':    (v, d) => `<span class="h-label">The newly created ship:</span>${nested(v, d)}`,
        'last_created_pop':     (v, d) => `<span class="h-label">The newly created pop:</span>${nested(v, d)}`,
        'destroy_country':      (v) => `Destroy country: ${scopeLabel(v) || v}`,
        'kill_leader':          (v, d) => typeof v === 'string' ? `Kill leader: ${scopeLabel(v) || v}` : `<span class="h-label">Kill leader:</span>${nested(v, d)}`,
        'kill_pop':             () => 'Kill pop',
        'remove_planet':        (v) => `Remove planet: ${scopeLabel(v) || v}`,

        // --- Government / empire changes ---
        'change_government':    (v, d) => `<span class="h-label">Change government:</span>${nested(v, d)}`,
        'add_ethic':            (v) => `Adopt ethic: <strong>${esc(locOrClean(v))}</strong>`,
        'remove_ethic':         (v) => `Remove ethic: <strong>${esc(locOrClean(v))}</strong>`,
        'add_civic':            (v) => `Add civic: <strong>${esc(locOrClean(v))}</strong>`,
        'remove_civic':         (v) => `Remove civic: <strong>${esc(locOrClean(v))}</strong>`,
        'add_technology':       (v) => `Research technology: <strong>${esc(locOrClean(v))}</strong>`,
        'add_tradition':        (v) => `Adopt tradition: <strong>${esc(locOrClean(v))}</strong>`,
        'set_name':             (v, d) => Array.isArray(v) ? `<span class="h-label">Rename:</span>${nested(v, d)}` : `Rename to <strong>"${esc(locOrClean(v))}"</strong>`,
        'set_owner':            (v) => `Transfer ownership to: ${scopeLabel(v) || v}`,
        'set_controller':       (v) => `Transfer control to: ${scopeLabel(v) || v}`,

        // --- Variables / state ---
        'change_variable':      (v) => parseVariable(v),
        'set_variable':         (v) => parseVariable(v),
        'save_event_target_as': (v) => `Remember this as target <em>"${esc(v)}"</em>`,
        'save_global_event_target_as': (v) => `Remember this globally as target <em>"${esc(v)}"</em>`,

        // --- Diplomacy ---
        'add_opinion_modifier': (v) => parseOpinionModifier(v),
        'set_hostile':          (v) => `Become hostile towards ${scopeLabel(v) || v}`,
        'set_relation':         (v, d) => `<span class="h-label">Set relation:</span>${nested(v, d)}`,
        'add_intel':            (v, d) => {
            if (!Array.isArray(v)) return `Add intel: ${JSON.stringify(v)}`;
            let amount = '', who = '';
            for (const item of v) {
                if (typeof item === 'object') for (const [k, val] of Object.entries(item)) {
                    if (k === 'amount') amount = val; else if (k === 'who') who = val;
                }
            }
            return `Gain ${amount} intel on ${scopeLabel(who) || who}`;
        },

        // --- Leader ---
        'unassign_leader':      (v) => `Unassign leader${v && v !== 'this' ? ': ' + (scopeLabel(v) || v) : ''}`,
        'assign_leader':        (v) => `Assign leader${v && v !== 'this' ? ': ' + (scopeLabel(v) || v) : ''}`,
        'exile_leader_as':      (v) => `Exile leader as: ${v}`,
        'set_leader_flag':      (v) => `Set leader flag <em>"${esc(v)}"</em>`,

        // --- Misc effects ---
        'custom_tooltip':       (v) => `<em>${esc(locOrClean(v))}</em>`,
        'response_text':        (v) => {
            const text = locOrClean(v);
            return `<div class="response-text-block"><span class="h-label">Response text:</span> ${esc(text)}</div>`;
        },
        'is_dialog_only':       (v) => yn(v, '<em>Dialog only — no gameplay effects</em>', ''),
        'tooltip':              (v, d) => `<span class="h-label">Tooltip info:</span>${nested(v, d)}`,
        'begin_event_chain':    (v, d) => typeof v === 'string' ? `Begin event chain: <em>"${esc(v)}"</em>` : `<span class="h-label">Begin event chain:</span>${nested(v, d)}`,
        'end_event_chain':      (v) => `End event chain: <em>"${esc(v)}"</em>`,
        'enable_special_project': (v, d) => typeof v === 'string' ? `Enable special project: <em>"${esc(v)}"</em>` : `<span class="h-label">Enable special project:</span>${nested(v, d)}`,
        'trigger_megastructure_icon': (v) => `Show megastructure icon: ${v}`,
        'activate_gateway':     (v) => `Activate gateway: ${scopeLabel(v) || v}`,
        'upgrade_megastructure_to': (v) => `Upgrade megastructure to: <strong>${esc(locOrClean(v))}</strong>`,
        'finish_upgrade':       (v) => yn(v, 'Complete the upgrade immediately', 'Do not complete upgrade'),
        'set_starbase_size':    (v) => `Set starbase size: <strong>${esc(locOrClean(v))}</strong>`,
        'set_starbase_module':  (v, d) => `<span class="h-label">Set starbase module:</span>${nested(v, d)}`,
        'add_monthly_resource_mult': (v, d) => `<span class="h-label">Gain monthly resources (scaled):</span>${nested(v, d)}`,
        'log':                  (v) => `<span class="h-behind-scenes">Log: "${esc(v)}"</span>`,
        'break':                () => 'Stop processing',
        'set_confused':         (v) => yn(v, 'Confuse this entity', 'Clear confusion'),
    };

    // =========================================================================
    // Modifier knowledge base (numeric modifier keys → human names)
    // =========================================================================

    const MODIFIER_MAP = {
        // --- Planet ---
        'planet_amenities_add': 'Amenities', 'planet_amenities_mult': 'Amenities',
        'planet_amenities_no_happiness_add': 'Amenities',
        'planet_housing_add': 'Housing', 'planet_housing_mult': 'Housing',
        'planet_stability_add': 'Stability', 'planet_stability_mult': 'Stability',
        'planet_crime_add': 'Crime', 'planet_crime_mult': 'Crime',
        'planet_crime_no_happiness_add': 'Crime',
        'planet_max_districts_add': 'Max Districts', 'planet_max_buildings_add': 'Max Buildings',
        'planet_max_branch_office_buildings_add': 'Max Branch Office Buildings',
        'planet_defense_armies_add': 'Defense Armies',
        'planet_orbital_bombardment_damage': 'Orbital Bombardment Damage',
        'planet_sensor_range_add': 'Sensor Range',
        'planet_pop_assembly_mult': 'Pop Assembly Speed', 'planet_pop_assembly_add': 'Pop Assembly',
        'planet_army_build_speed_mult': 'Army Build Speed',
        'planet_building_build_speed_mult': 'Building Build Speed',
        'planet_clear_blocker_speed_mult': 'Blocker Clear Speed',
        'planet_decision_enact_speed_mult': 'Decision Enact Speed',
        'planet_resettlement_unemployed_destination_mult': 'Immigration Pull',
        'planet_resettlement_unemployed_mult': 'Immigration Pull',
        // Planet production
        'planet_jobs_produces_mult': 'Job Output',
        'planet_jobs_energy_produces_mult': 'Energy from Jobs',
        'planet_jobs_minerals_produces_mult': 'Minerals from Jobs',
        'planet_jobs_food_produces_mult': 'Food from Jobs',
        'planet_jobs_consumer_goods_produces_mult': 'Consumer Goods from Jobs',
        'planet_jobs_alloys_produces_mult': 'Alloys from Jobs',
        'planet_jobs_unity_produces_mult': 'Unity from Jobs',
        'planet_jobs_physics_research_produces_mult': 'Physics Research from Jobs',
        'planet_jobs_society_research_produces_mult': 'Society Research from Jobs',
        'planet_jobs_engineering_research_produces_mult': 'Engineering Research from Jobs',
        'planet_researchers_produces_mult': 'Researcher Output',
        'planet_metallurgists_alloys_produces_mult': 'Alloys from Metallurgists',
        'planet_farmers_food_produces_mult': 'Food from Farmers',
        'planet_pops_consumer_goods_upkeep_mult': 'Pop Consumer Goods Upkeep',
        'planet_pops_organics_food_upkeep_mult': 'Organic Pop Food Upkeep',
        // --- Country ---
        'country_unity_produces_mult': 'Unity Production', 'country_unity_produces_add': 'Unity Production',
        'country_energy_produces_mult': 'Energy Production', 'country_energy_produces_add': 'Energy Production',
        'country_minerals_produces_mult': 'Minerals Production', 'country_food_produces_mult': 'Food Production',
        'country_alloys_produces_mult': 'Alloys Production',
        'country_consumer_goods_produces_mult': 'Consumer Goods Production',
        'country_physics_research_produces_mult': 'Physics Research',
        'country_society_research_produces_mult': 'Society Research',
        'country_engineering_research_produces_mult': 'Engineering Research',
        'country_naval_cap_add': 'Naval Capacity', 'country_naval_cap_mult': 'Naval Capacity',
        'country_leader_cap_add': 'Leader Capacity', 'country_leader_pool_size': 'Leader Pool Size',
        'country_starbase_capacity_add': 'Starbase Capacity',
        'country_starbase_influence_cost_mult': 'Starbase Influence Cost',
        'country_war_exhaustion_mult': 'War Exhaustion',
        'country_claim_influence_cost_mult': 'Claim Influence Cost',
        'country_trade_produces_mult': 'Trade Value', 'country_trade_fee': 'Trade Fee',
        'country_border_friction_mult': 'Border Friction',
        'country_edict_fund_add': 'Edict Fund', 'country_edict_fund_mult': 'Edict Fund',
        'country_government_civic_points_add': 'Civic Points',
        'country_base_influence_produces_add': 'Base Influence',
        'country_base_unity_produces_add': 'Base Unity',
        'country_occupation_annexation_acceptance_add': 'Annexation Acceptance',
        'country_power_projection_influence_produces_mult': 'Influence from Power Projection',
        'country_subject_power_penalty_mult': 'Subject Power Penalty',
        // --- Ships ---
        'ship_armor_add': 'Armor', 'ship_armor_mult': 'Armor',
        'ship_hull_add': 'Hull Points', 'ship_hull_mult': 'Hull Points',
        'ship_shield_add': 'Shields', 'ship_shield_mult': 'Shields',
        'ship_evasion_add': 'Evasion', 'ship_evasion_mult': 'Evasion',
        'ship_fire_rate_mult': 'Fire Rate', 'ship_weapon_damage': 'Weapon Damage',
        'ship_weapon_range_mult': 'Weapon Range',
        'ship_speed_mult': 'Ship Speed', 'ship_speed_add': 'Ship Speed',
        'ship_sensor_range_add': 'Sensor Range',
        'ship_home_territory_fire_rate_mult': 'Home Territory Fire Rate',
        'ship_anomaly_research_speed_mult': 'Anomaly Research Speed',
        'ship_anomaly_generation_chance_mult': 'Anomaly Chance',
        'ship_hyperlane_range_add': 'Hyperlane Range',
        'ship_windup_mult': 'Jump Charge Time', 'ship_disengage_chance_mult': 'Disengage Chance',
        'ship_emergency_ftl_mult': 'Emergency FTL',
        'ship_tracking_add': 'Tracking', 'ship_tracking_mult': 'Tracking',
        'ship_accuracy_add': 'Accuracy', 'ship_accuracy_mult': 'Accuracy',
        'ship_piracy_suppression_add': 'Piracy Suppression',
        'ship_orbital_bombardment_mult': 'Orbital Bombardment',
        'ship_corvette_cost_mult': 'Corvette Cost', 'ship_destroyer_cost_mult': 'Destroyer Cost',
        'ship_cruiser_cost_mult': 'Cruiser Cost', 'ship_battleship_cost_mult': 'Battleship Cost',
        'ship_corvette_hull_mult': 'Corvette Hull', 'ship_destroyer_hull_mult': 'Destroyer Hull',
        'ship_cruiser_hull_mult': 'Cruiser Hull', 'ship_battleship_hull_mult': 'Battleship Hull',
        // --- Upkeep / cost ---
        'ships_upkeep_mult': 'Ship Upkeep', 'leaders_upkeep_mult': 'Leader Upkeep',
        'starbases_upkeep_mult': 'Starbase Upkeep', 'armies_upkeep_mult': 'Army Upkeep',
        'edicts_cost_mult': 'Edict Cost',
        'starbase_shipyard_build_cost_mult': 'Shipyard Build Cost',
        'starbase_upgrade_cost_mult': 'Starbase Upgrade Cost',
        'starbase_upgrade_speed_mult': 'Starbase Upgrade Speed',
        'pop_resettlement_cost_mult': 'Resettlement Cost',
        'deposit_blockers_cost_mult': 'Blocker Clear Cost',
        'megastructure_build_speed_mult': 'Megastructure Build Speed',
        // --- Pop ---
        'pop_happiness': 'Happiness', 'pop_happiness_add': 'Happiness',
        'pop_environment_tolerance': 'Habitability',
        'pop_government_ethic_attraction': 'Governing Ethics Attraction',
        'pop_citizen_happiness': 'Citizen Happiness', 'pop_slave_happiness': 'Slave Happiness',
        'pop_housing_usage_mult': 'Housing Usage', 'pop_amenities_usage_mult': 'Amenities Usage',
        'pop_amenities_usage_add': 'Amenities Usage',
        'pop_job_amenities_mult': 'Job Amenities Output',
        'pop_growth_speed': 'Pop Growth Speed', 'pop_growth_speed_mult': 'Pop Growth Speed',
        'pop_decline_speed_mult': 'Pop Decline Speed', 'pop_purge_speed': 'Purge Speed',
        // --- Army ---
        'army_damage_mult': 'Army Damage', 'army_health': 'Army Health',
        'army_health_mult': 'Army Health', 'army_defense_damage_mult': 'Defense Army Damage',
        'army_morale': 'Army Morale', 'army_morale_damage_mult': 'Morale Damage',
        // --- Empire size ---
        'empire_size_mult': 'Empire Size', 'empire_size_add': 'Empire Size',
        'empire_size_pops_mult': 'Empire Size from Pops',
        'empire_size_districts_mult': 'Empire Size from Districts',
        'empire_size_colonies_mult': 'Empire Size from Colonies',
        'empire_size_systems_mult': 'Empire Size from Systems',
        'species_empire_size_mult': 'Empire Size from Species',
        // --- Diplomacy / Intel ---
        'envoys_add': 'Envoys', 'envoy_improve_relations_mult': 'Improve Relations Speed',
        'envoy_harm_relations_mult': 'Harm Relations Speed',
        'intel_decryption_add': 'Intel Decryption', 'intel_encryption_add': 'Intel Encryption',
        'spy_network_daily_value_mult': 'Spy Network Growth',
        'espionage_operation_difficulty_add': 'Espionage Difficulty',
        'espionage_operation_speed_mult': 'Espionage Speed',
        'add_base_country_intel': 'Base Intel',
        'diplo_weight_mult': 'Diplomatic Weight',
        'diplo_weight_economy_mult': 'Diplomatic Weight (Economy)',
        'diplo_weight_technology_mult': 'Diplomatic Weight (Technology)',
        'diplo_weight_naval_mult': 'Diplomatic Weight (Fleet)',
        'monthly_loyalty': 'Monthly Loyalty',
        // --- Leaders ---
        'leader_lifespan_add': 'Leader Lifespan', 'leader_skill_levels': 'Leader Skill Levels',
        'leader_skill_levels_add': 'Leader Skill Levels',
        'species_leader_exp_gain': 'Leader Experience Gain',
        'leader_initial_skill_add': 'Leader Starting Skill',
        // --- Research ---
        'all_technology_research_speed': 'Research Speed',
        'num_tech_alternatives_add': 'Research Alternatives',
        'science_ship_survey_speed': 'Survey Speed', 'assist_research_mult': 'Assist Research Output',
        // --- Trade ---
        'trade_value_add': 'Trade Value', 'trade_value_mult': 'Trade Value',
        'branch_office_value_mult': 'Branch Office Value',
        // --- Misc ---
        'ascension_perks_add': 'Ascension Perks', 'logistic_growth_mult': 'Pop Growth',
        'bonus_pop_growth_mult': 'Bonus Pop Growth', 'terraform_speed_mult': 'Terraform Speed',
        'command_limit_add': 'Command Limit',
        // --- Starbase ---
        'starbase_shipyard_build_speed_mult': 'Shipyard Build Speed',
        'starbase_shipyard_capacity_add': 'Shipyard Capacity',
        'starbase_building_capacity_add': 'Starbase Building Slots',
        'starbase_module_capacity_add': 'Starbase Module Slots',
        'starbase_defense_platform_capacity_add': 'Defense Platform Capacity',
        'shipclass_starbase_hull_mult': 'Starbase Hull',
        'shipclass_starbase_damage_mult': 'Starbase Damage',
    };

    // =========================================================================
    // Modifier formatting
    // =========================================================================

    const STRUCTURAL_KEYS = new Set([
        'weight', 'factor', 'base', 'days', 'months', 'years', 'count',
        'min', 'max', 'id', 'priority', 'tier', 'icon', 'ai_weight',
        'add', 'mult', 'value', 'num', 'size', 'amount', 'class', 'type',
        'key', 'target', 'who', 'flag', 'show_notification',
    ]);

    function formatModifierKey(key) {
        if (MODIFIER_MAP[key]) return MODIFIER_MAP[key];
        let m;
        if ((m = key.match(/^job_(.+?)_add$/))) return locOrClean(m[1]) + ' Jobs';
        if ((m = key.match(/^pc_(.+?)_habitability$/))) return locOrClean(m[1]) + ' Habitability';
        if ((m = key.match(/^(?:planet_|country_)?(?:jobs_)?(.+?)_produces_(?:mult|add)$/))) return locOrClean(m[1]) + ' Production';
        if ((m = key.match(/^(.+?)_upkeep_(?:mult|add)$/))) return locOrClean(m[1]) + ' Upkeep';
        if ((m = key.match(/^(.+?)_cost_(?:mult|add)$/))) return locOrClean(m[1]) + ' Cost';
        if ((m = key.match(/^(.+?)_speed_(?:mult|add)$/))) return locOrClean(m[1]) + ' Speed';
        if ((m = key.match(/^(.+?)_damage_(?:mult|add)$/))) return locOrClean(m[1]) + ' Damage';
        return locOrClean(key);
    }

    function formatModifierValue(key, value) {
        const name = formatModifierKey(key);
        const isMult = key.endsWith('_mult') || key.endsWith('_speed') || key.endsWith('_damage');
        let display, isPositive;
        if (isMult) {
            const pct = Math.round(value * 100);
            display = `${pct >= 0 ? '+' : ''}${pct}% ${esc(name)}`;
            isPositive = pct >= 0;
        } else {
            display = `${value >= 0 ? '+' : ''}${value} ${esc(name)}`;
            isPositive = value >= 0;
        }
        const invertedStats = new Set([
            'Crime', 'War Exhaustion', 'Empire Size', 'Empire Size from Pops',
            'Empire Size from Districts', 'Empire Size from Colonies',
            'Empire Size from Systems', 'Empire Size from Species',
            'Pop Consumer Goods Upkeep', 'Organic Pop Food Upkeep',
            'Housing Usage', 'Amenities Usage', 'Pop Decline Speed',
            'Espionage Difficulty', 'Border Friction', 'Subject Power Penalty',
        ]);
        if (invertedStats.has(name)) isPositive = !isPositive;
        return `<span class="${isPositive ? 'mod-positive' : 'mod-negative'}">${display}</span>`;
    }

    // =========================================================================
    // If / Else If helpers
    // =========================================================================

    function humanizeIf(v, depth) {
        if (!Array.isArray(v)) return `If: ${esc(JSON.stringify(v))}`;
        let limitHtml = '';
        const bodyItems = [];
        for (const item of v) {
            if (typeof item === 'object' && item !== null) {
                const keys = Object.keys(item);
                if (keys.length === 1 && keys[0] === 'limit') {
                    limitHtml = `<div class="condition"><span class="h-label">If the following is true:</span>${nested(item.limit, depth)}</div>`;
                } else bodyItems.push(item);
            }
        }
        const bodyHtml = bodyItems.length
            ? `<div class="condition"><span class="h-label">Then do:</span>${wrapNested(humanizeItems(bodyItems, (depth||0)+1), depth)}</div>`
            : '';
        return limitHtml + bodyHtml;
    }

    function humanizeElseIf(v, depth) {
        if (!Array.isArray(v)) return `Else if: ${esc(JSON.stringify(v))}`;
        let limitHtml = '';
        const bodyItems = [];
        for (const item of v) {
            if (typeof item === 'object' && item !== null) {
                const keys = Object.keys(item);
                if (keys.length === 1 && keys[0] === 'limit') {
                    limitHtml = `<div class="condition"><span class="h-label">Otherwise, if:</span>${nested(item.limit, depth)}</div>`;
                } else bodyItems.push(item);
            }
        }
        const bodyHtml = bodyItems.length
            ? `<div class="condition"><span class="h-label">Then do:</span>${wrapNested(humanizeItems(bodyItems, (depth||0)+1), depth)}</div>`
            : '';
        return limitHtml + bodyHtml;
    }

    // =========================================================================
    // Core rendering
    // =========================================================================

    function humanizeEntry(key, val, depth) {
        // Known trigger/effect?
        const trigFn = TRIGGER_MAP[key];
        if (trigFn) return trigFn.length >= 2 ? trigFn(val, depth) : trigFn(val);
        const effFn = EFFECT_MAP[key];
        if (effFn) return effFn.length >= 2 ? effFn(val, depth) : effFn(val);

        // Scope change with readable label
        if (isScopeKey(key) && (Array.isArray(val) || (typeof val === 'object' && val !== null))) {
            const label = scopeLabel(key) || locOrClean(key);
            return `<span class="h-label">${esc(label)}:</span>${nested(val, depth)}`;
        }

        // Comparison operators
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            const entries = Object.entries(val);
            if (entries.length === 1 && ['>', '<', '>=', '<='].includes(entries[0][0])) {
                const sym = { '>': 'more than', '<': 'fewer than', '>=': 'at least', '<=': 'at most' };
                return `${esc(locOrClean(key))}: ${sym[entries[0][0]] || entries[0][0]} ${esc(String(entries[0][1]))}`;
            }
            if (entries.length >= 1) {
                const inner = entries.map(([k, v2]) => humanizeEntry(k, v2, depth)).join('');
                return `<span class="h-label">${esc(locOrClean(key))}:</span>${wrapNested(inner, depth)}`;
            }
        }

        // Array value (unknown scope)
        if (Array.isArray(val)) {
            return `<span class="h-label">${esc(locOrClean(key))}:</span>${nested(val, depth)}`;
        }

        // Numeric modifier
        if (typeof val === 'number' && !STRUCTURAL_KEYS.has(key)) {
            return formatModifierValue(key, val);
        }

        // @ variables (PDX scripted values)
        if (key.startsWith('@')) {
            return `<span class="h-behind-scenes">${esc(key)} = ${esc(String(val))}</span>`;
        }

        // Yes/no unknown keys
        if (val === 'yes' || val === 'no') {
            return `${esc(locOrClean(key))}: <strong>${val}</strong>`;
        }

        // String value
        if (typeof val === 'string') {
            return `${esc(locOrClean(key))}: ${esc(locOrClean(val))}`;
        }

        // Fallback
        return `<span class="unknown">${esc(key)} = ${esc(String(val))}</span>`;
    }

    function humanizeItems(items, depth) {
        if (!items || !items.length) return '';
        const lines = [];
        for (const item of items) {
            if (item === null || item === undefined) continue;
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                lines.push(`<div class="h-line">${esc(String(item))}</div>`);
                continue;
            }
            if (typeof item === 'object' && !Array.isArray(item)) {
                for (const [k, v] of Object.entries(item)) {
                    const html = humanizeEntry(k, v, depth);
                    if (html) lines.push(`<div class="h-line">${html}</div>`);
                }
            }
        }
        return lines.join('');
    }

    function nested(val, depth) {
        depth = (depth || 0) + 1;
        if (depth > 12) return '<span class="unknown">[too deeply nested]</span>';
        if (Array.isArray(val)) return wrapNested(humanizeItems(val, depth), depth);
        if (val && typeof val === 'object') {
            const items = Object.entries(val).map(([k, v]) => ({ [k]: v }));
            return wrapNested(humanizeItems(items, depth), depth);
        }
        return ` ${esc(String(val))}`;
    }

    function wrapNested(innerHtml, depth) {
        if (!innerHtml) return '';
        return `<div class="condition">${innerHtml}</div>`;
    }

    // =========================================================================
    // AI Weight / Spawn Chance summarization
    // =========================================================================

    const WEIGHT_LABELS = new Set([
        'weight', 'ai_weight', 'spawn_chance', 'drop_weight',
        'mean_time_to_happen', 'mtth',
    ]);

    function humanizeAiWeight(items) {
        if (!Array.isArray(items)) return humanizeItems(items ? [items] : [], 0);
        let baseWeight = null;
        const modifiers = [];
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const keys = Object.keys(item);
            if (keys.length === 1 && keys[0] === 'weight') baseWeight = item.weight;
            else if (keys.length === 1 && keys[0] === 'base') baseWeight = item.base;
            else if (keys.length === 1 && keys[0] === 'modifier' && Array.isArray(item.modifier)) {
                let factor = null; const conditions = [];
                for (const sub of item.modifier) {
                    if (!sub || typeof sub !== 'object') continue;
                    const sk = Object.keys(sub);
                    if (sk.length === 1 && sk[0] === 'factor') factor = sub.factor;
                    else if (sk.length === 1 && sk[0] === 'add') {
                        modifiers.push({ type: 'add', value: sub.add, conditions: [] }); continue;
                    } else conditions.push(sub);
                }
                if (factor !== null && conditions.length) modifiers.push({ type: 'factor', value: factor, conditions });
            } else modifiers.push({ type: 'other', item });
        }
        const lines = [];
        if (baseWeight !== null) lines.push(`<div class="h-line"><span class="ai-base">Base priority: ${baseWeight}</span></div>`);
        for (const mod of modifiers) {
            if (mod.type === 'other') {
                const html = humanizeEntry(Object.keys(mod.item)[0], Object.values(mod.item)[0], 0);
                if (html) lines.push(`<div class="h-line">${html}</div>`);
                continue;
            }
            if (mod.type === 'add') {
                const cls = mod.value >= 0 ? 'ai-boost' : 'ai-reduce';
                lines.push(`<div class="h-line"><span class="${cls}">${mod.value >= 0 ? '+' : ''}${mod.value} priority</span></div>`);
                continue;
            }
            const condHtml = summarizeConditions(mod.conditions);
            if (mod.value === 0) lines.push(`<div class="h-line"><span class="ai-never">Blocked</span> if ${condHtml}</div>`);
            else if (mod.value > 1) lines.push(`<div class="h-line"><span class="ai-boost">More likely (&times;${mod.value})</span> if ${condHtml}</div>`);
            else if (mod.value > 0 && mod.value < 1) lines.push(`<div class="h-line"><span class="ai-reduce">Less likely (&times;${mod.value})</span> if ${condHtml}</div>`);
            else lines.push(`<div class="h-line">Factor ${mod.value} if ${condHtml}</div>`);
        }
        return lines.join('');
    }

    function summarizeConditions(items) {
        if (!items || !items.length) return '(always)';
        if (isSimpleLeaf(items)) return items.map(i => leafText(i)).filter(t => t).join(' <span class="cond-join">and</span> ');
        return humanizeItems(items, 1);
    }

    // =========================================================================
    // Public API
    // =========================================================================

    function humanizeBlock(block, label) {
        if (!block) return '';
        if (typeof block === 'string') return esc(block);
        if (label && WEIGHT_LABELS.has(label.toLowerCase().replace(/[\s-]/g, '_'))) {
            const items = Array.isArray(block) ? block
                : typeof block === 'object' ? Object.entries(block).map(([k, v]) => ({ [k]: v }))
                : null;
            if (items) return humanizeAiWeight(items);
        }
        if (Array.isArray(block)) return humanizeItems(block, 0);
        if (typeof block === 'object') {
            const items = Object.entries(block).map(([k, v]) => ({ [k]: v }));
            return humanizeItems(items, 0);
        }
        return esc(String(block));
    }

    return { humanizeBlock, locOrClean };
})();
