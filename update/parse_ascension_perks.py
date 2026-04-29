"""
Ascension perks parser for STNH mod.
Parses common/ascension_perks/*.txt -> structured perk data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_prerequisites, extract_modifiers, extract_set_flags
from config import MOD_ASCENSION_PERKS_DIR


def extract_perk(perk_id, block, source_file):
    """Extract structured data from an ascension perk block."""
    possible_raw = get_value(block, 'possible')
    potential_raw = get_value(block, 'potential')

    req_techs = []
    req_traditions = []
    min_perks = None

    # Scan possible block (also inside custom_tooltip sub-blocks)
    if isinstance(possible_raw, list):
        for item in possible_raw:
            if isinstance(item, dict):
                tech = item.get('has_technology')
                if tech:
                    req_techs.append(tech)
                trad = item.get('has_tradition')
                if trad:
                    req_traditions.append(trad)
                ct = item.get('custom_tooltip')
                if isinstance(ct, list):
                    for sub in ct:
                        if isinstance(sub, dict):
                            t = sub.get('has_technology')
                            if t:
                                req_techs.append(t)
                            tr = sub.get('has_tradition')
                            if tr:
                                req_traditions.append(tr)
                            nap = sub.get('num_ascension_perks')
                            if isinstance(nap, dict):
                                for op, val in nap.items():
                                    if op == '>':
                                        min_perks = max(min_perks or 0, int(val) + 1)
                                    elif op == '>=':
                                        min_perks = max(min_perks or 0, int(val))

    # Extract flags from potential block
    req_flags = []
    if isinstance(potential_raw, list):
        for item in potential_raw:
            if isinstance(item, dict):
                flag = item.get('has_country_flag')
                if flag:
                    req_flags.append(flag)

    return {
        'id': perk_id,
        'name_key': perk_id,
        'icon': get_value(block, 'icon') or perk_id,
        'modifier': extract_modifiers(block, 'modifier'),
        'potential': serialize_block(potential_raw) if isinstance(potential_raw, list) else None,
        'possible': serialize_block(possible_raw) if isinstance(possible_raw, list) else None,
        'on_enabled': serialize_block(get_value(block, 'on_enabled')) if isinstance(get_value(block, 'on_enabled'), list) else None,
        'ai_weight': serialize_block(get_value(block, 'ai_weight')) if isinstance(get_value(block, 'ai_weight'), list) else None,
        'required_technologies': req_techs if req_techs else None,
        'required_traditions': req_traditions if req_traditions else None,
        'required_flags': req_flags if req_flags else None,
        'min_perks': min_perks,
        'set_flags': extract_set_flags(block),
        'source_file': os.path.basename(source_file),
    }


def parse_all_ascension_perks():
    """Parse all ascension perk files. Returns (perks_list, stats_dict)."""
    perks = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_ASCENSION_PERKS_DIR):
        print(f"  [WARN] Ascension perks directory not found: {MOD_ASCENSION_PERKS_DIR}")
        return perks, stats

    for filename in sorted(os.listdir(MOD_ASCENSION_PERKS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_ASCENSION_PERKS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key.startswith('ap_'):
                        item = extract_perk(key, value, filepath)
                        if item:
                            perks.append(item)
                            stats['items'] += 1

    return perks, stats


if __name__ == '__main__':
    items, stats = parse_all_ascension_perks()
    print(f"Files: {stats['files']}, Ascension Perks: {stats['items']}, Errors: {stats['errors']}")
