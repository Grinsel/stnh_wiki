"""
=============================================================================
STNH WIKI - LOCALISATION SPLITTER
=============================================================================

Reads module data JSONs and extracts referenced localisation keys.
Writes per-module + per-language filtered loc files for fast page loading.

Output:  assets/localisation/{lang_short}/{module}.json

USAGE:
    python split_localisation.py          (standalone)
    Called from UPDATE_WIKI.py / UPDATE_LOC.py as phase
=============================================================================
"""

import json
import os
import re
import sys
from pathlib import Path

UPDATE_DIR = Path(__file__).parent
ASSETS_DIR = UPDATE_DIR.parent / 'assets'
LOC_DIR = ASSETS_DIR / 'localisation'

LANGUAGES = {
    'english': 'en',
    'german': 'de',
    'french': 'fr',
    'spanish': 'es',
    'russian': 'ru',
    'polish': 'pl',
    'braz_por': 'pt',
}

# Common key prefixes that should be in every module split
COMMON_PREFIXES = [
    'mod_', 'modifier_', 'MODIFIER_',
    'MOD_', 'TRAIT_', 'CIVIC_',
    'pop_cat_', 'job_', 'DISTRICT_',
    'planet_', 'ship_', 'BUILDING_',
    'TECH_', 'TRADITION_',
    'country_', 'empire_', 'species_',
    'ethic_', 'authority_', 'government_',
    'policy_', 'edict_',
    'MEGASTRUCTURE_', 'RELIC_',
    'anomaly_', 'archaeology_',
    'ASC_', 'origin_',
    # UI strings
    'stnh_wiki_', 'wiki_',
]


def load_json(path):
    """Load a JSON file, return empty list/dict on failure."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"  [WARN] Could not load {path}: {e}")
        return []


def load_loc(lang):
    """Load full localisation for a language."""
    path = LOC_DIR / f'{lang}.json'
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"  [WARN] Could not load loc {path}: {e}")
        return {}


def expand_key_variants(base_key):
    """Given a base key, return related keys (_desc, _effect, _tooltip, etc.)."""
    variants = [base_key]
    # Standard suffixes used in Stellaris loc
    for suffix in ['_desc', '_effect', '_tooltip', '_delayed', '_modifier']:
        variants.append(base_key + suffix)
    return variants


def extract_name_keys(items):
    """Extract name_key values from a list of item dicts."""
    keys = set()
    for item in items:
        if isinstance(item, dict):
            nk = item.get('name_key')
            if nk:
                for k in expand_key_variants(nk):
                    keys.add(k)
            # Also add id-based variants
            item_id = item.get('id')
            if item_id:
                for k in expand_key_variants(item_id):
                    keys.add(k)
    return keys


def extract_events_keys(events):
    """Extract loc keys from events_index.json entries."""
    keys = set()
    for ev in events:
        eid = ev.get('id', '')
        if eid:
            keys.add(eid + '.name')
            keys.add(eid + '.desc')
            # Also try base namespace pattern
            base = eid.rsplit('.', 1)[0] if '.' in eid else eid
            keys.add(base + '.name')
            keys.add(base + '.desc')
    return keys


def extract_tech_keys(tech_dir):
    """Extract loc keys from tech JSON files."""
    keys = set()
    for fname in ['technology_physics.json', 'technology_engineering.json', 'technology_society.json']:
        techs = load_json(tech_dir / fname)
        for t in techs:
            tid = t.get('id', '')
            if tid:
                for k in expand_key_variants(tid):
                    keys.add(k)
    return keys


def extract_governments_keys():
    """Extract loc keys from government-related JSONs."""
    keys = set()
    for fname in ['governments.json', 'civics.json', 'authorities.json',
                   'policies.json', 'edicts.json']:
        items = load_json(ASSETS_DIR / fname)
        for item in items:
            if isinstance(item, dict):
                nk = item.get('name_key')
                if nk:
                    for k in expand_key_variants(nk):
                        keys.add(k)
                item_id = item.get('id')
                if item_id:
                    for k in expand_key_variants(item_id):
                        keys.add(k)
                # ruler titles
                for rt in ['ruler_title', 'ruler_title_female',
                            'heir_title', 'heir_title_female']:
                    val = item.get(rt)
                    if val:
                        keys.add(val)
                # policy options
                options = item.get('options')
                if isinstance(options, list):
                    for opt in options:
                        if isinstance(opt, dict):
                            oname = opt.get('name') or opt.get('id')
                            if oname:
                                for k in expand_key_variants(oname):
                                    keys.add(k)
    return keys


def extract_empires_keys():
    """Extract loc keys from empires + species."""
    keys = set()
    for fname in ['empires.json', 'species.json']:
        items = load_json(ASSETS_DIR / fname)
        for item in items:
            if isinstance(item, dict):
                nk = item.get('name_key')
                if nk:
                    for k in expand_key_variants(nk):
                        keys.add(k)
                item_id = item.get('id')
                if item_id:
                    for k in expand_key_variants(item_id):
                        keys.add(k)
                # Empire-specific fields
                for field in ['adjective', 'ship_prefix']:
                    val = item.get(field)
                    if val:
                        keys.add(val)
                # Nested species in empires
                sp = item.get('species')
                if isinstance(sp, dict):
                    for sk in ['name', 'plural', 'adjective', 'name_key']:
                        sv = sp.get(sk)
                        if sv:
                            keys.add(sv)
    return keys


def extract_traits_keys():
    """Extract loc keys from traits, traditions, ascension perks."""
    keys = set()
    for fname in ['traits.json', 'traditions.json', 'ascension_perks.json']:
        items = load_json(ASSETS_DIR / fname)
        keys.update(extract_name_keys(items))
        # Traditions have tree names
        for item in items:
            if isinstance(item, dict):
                tree = item.get('tree')
                if tree:
                    for k in expand_key_variants(tree):
                        keys.add(k)
                # Opposites in traits
                opposites = item.get('opposites')
                if isinstance(opposites, list):
                    for opp in opposites:
                        if opp:
                            for k in expand_key_variants(opp):
                                keys.add(k)
    return keys


def extract_common_keys(full_loc):
    """Extract common/shared keys based on prefix patterns."""
    keys = set()
    for key in full_loc:
        for prefix in COMMON_PREFIXES:
            if key.startswith(prefix):
                keys.add(key)
                break
    return keys


# Module definitions: module_name -> key extraction function
def get_module_keys():
    """Build key sets for all modules. Returns dict of module_name -> set of keys."""
    modules = {}

    # Events
    events = load_json(ASSETS_DIR / 'events_index.json')
    modules['events'] = extract_events_keys(events)
    print(f"    events: {len(modules['events']):,} keys")

    # Buildings + Districts
    buildings = load_json(ASSETS_DIR / 'buildings.json')
    districts = load_json(ASSETS_DIR / 'districts.json')
    modules['buildings'] = extract_name_keys(buildings) | extract_name_keys(districts)
    print(f"    buildings: {len(modules['buildings']):,} keys")

    # Ships + Components
    ships = load_json(ASSETS_DIR / 'ships.json')
    components = load_json(ASSETS_DIR / 'components.json')
    ship_items = ships['items'] if isinstance(ships, dict) and 'items' in ships else ships
    modules['ships'] = extract_name_keys(ship_items) | extract_name_keys(components)
    print(f"    ships: {len(modules['ships']):,} keys")

    # Tech
    tech_dir = ASSETS_DIR / 'tech'
    modules['tech'] = extract_tech_keys(tech_dir)
    print(f"    tech: {len(modules['tech']):,} keys")

    # Traits + Traditions + Ascension Perks
    modules['traits'] = extract_traits_keys()
    print(f"    traits: {len(modules['traits']):,} keys")

    # Governments + Civics + Authorities + Policies + Edicts
    modules['governments'] = extract_governments_keys()
    print(f"    governments: {len(modules['governments']):,} keys")

    # Megastructures + Relics
    megas = load_json(ASSETS_DIR / 'megastructures.json')
    relics = load_json(ASSETS_DIR / 'relics.json')
    modules['megastructures'] = extract_name_keys(megas) | extract_name_keys(relics)
    print(f"    megastructures: {len(modules['megastructures']):,} keys")

    # Anomalies + Archaeology
    anomalies = load_json(ASSETS_DIR / 'anomalies.json')
    archaeology = load_json(ASSETS_DIR / 'archaeology.json')
    anom_keys = extract_name_keys(anomalies) | extract_name_keys(archaeology)
    # anomalies also have 'desc' field
    for item in anomalies + archaeology:
        if isinstance(item, dict):
            desc = item.get('desc')
            if desc:
                anom_keys.add(desc)
    modules['anomalies'] = anom_keys
    print(f"    anomalies: {len(modules['anomalies']):,} keys")

    # Economy (Jobs + Deposits)
    jobs = load_json(ASSETS_DIR / 'jobs.json')
    deposits = load_json(ASSETS_DIR / 'deposits.json')
    modules['economy'] = extract_name_keys(jobs) | extract_name_keys(deposits)
    print(f"    economy: {len(modules['economy']):,} keys")

    # Empires + Species
    modules['empires'] = extract_empires_keys()
    print(f"    empires: {len(modules['empires']):,} keys")

    return modules


def split_localisation():
    """Main split function. Returns stats dict."""
    print("  Extracting module key sets...")
    module_keys = get_module_keys()

    stats = {'modules': {}, 'languages': {}}
    total_files = 0

    for lang, short in LANGUAGES.items():
        print(f"\n  Processing {lang} ({short})...")
        full_loc = load_loc(lang)
        if not full_loc:
            print(f"    [SKIP] No loc data for {lang}")
            continue

        # Create output directory
        out_dir = LOC_DIR / short
        out_dir.mkdir(parents=True, exist_ok=True)

        lang_stats = {}

        # Common keys
        common_keys = extract_common_keys(full_loc)
        common_loc = {k: v for k, v in full_loc.items() if k in common_keys}
        out_path = out_dir / 'common.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(common_loc, f, ensure_ascii=False, separators=(',', ':'))
        lang_stats['common'] = len(common_loc)
        total_files += 1

        # Module splits
        for module, keys in module_keys.items():
            # Filter: only keys that actually exist in this language's loc
            mod_loc = {k: v for k, v in full_loc.items() if k in keys}
            out_path = out_dir / f'{module}.json'
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(mod_loc, f, ensure_ascii=False, separators=(',', ':'))
            lang_stats[module] = len(mod_loc)
            total_files += 1

        stats['languages'][lang] = lang_stats
        # Print summary for this language
        total_keys = sum(lang_stats.values())
        print(f"    {len(lang_stats)} files, {total_keys:,} total keys "
              f"(full loc: {len(full_loc):,})")

    stats['total_files'] = total_files
    stats['modules_count'] = len(module_keys)

    # Print size comparison for english
    en_dir = LOC_DIR / 'en'
    if en_dir.exists():
        print("\n  English split sizes:")
        for f in sorted(en_dir.iterdir()):
            size = f.stat().st_size
            if size > 1024 * 1024:
                print(f"    {f.name:30s} {size / 1024 / 1024:.1f} MB")
            else:
                print(f"    {f.name:30s} {size / 1024:.0f} KB")

    return stats


def main():
    """Standalone entry point."""
    print("=" * 60)
    print("LOCALISATION SPLITTER")
    print("=" * 60)
    stats = split_localisation()
    print(f"\n  [DONE] Created {stats['total_files']} split files "
          f"for {len(stats['languages'])} languages")
    return stats


if __name__ == '__main__':
    main()
