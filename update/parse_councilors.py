"""
Councilors parser for STNH mod.
Parses common/governments/councilors/*.txt -> structured councilor data.
"""

import os
from parse_pdx import parse_file, get_value
from parse_helpers import serialize_block, to_bool, extract_modifiers, _extract_icon_stem
from config import MOD_COUNCILORS_DIR

SKIP_FILES = {'000_councilor_documentation.txt'}


def extract_councilor(cid, block, source_file):
    """Extract structured data from a councilor block."""
    # leader_class: can be a list block { scientist official } or a single string
    lc_raw = get_value(block, 'leader_class')
    if isinstance(lc_raw, list):
        leader_class = [str(v) for v in lc_raw if isinstance(v, str)]
    elif isinstance(lc_raw, str):
        leader_class = [lc_raw]
    else:
        leader_class = []

    # civic
    civic = get_value(block, 'civic')
    if isinstance(civic, list):
        civic = None

    # icon: strip GFX_ prefix for icon stem; None if absent
    icon_raw = get_value(block, 'icon')
    icon = _extract_icon_stem(icon_raw) if icon_raw else None

    # possible, is_leader_possible
    possible_raw = get_value(block, 'possible')
    is_leader_possible_raw = get_value(block, 'is_leader_possible')

    # required
    required = to_bool(get_value(block, 'required'))

    return {
        'id': cid,
        'name_key': cid,
        'leader_class': leader_class if leader_class else None,
        'icon': icon,
        'icon_dir': 'councilors' if icon else None,
        'civic': civic,
        'modifier': extract_modifiers(block, 'modifier'),
        'possible': serialize_block(possible_raw) if isinstance(possible_raw, list) else None,
        'is_leader_possible': serialize_block(is_leader_possible_raw) if isinstance(is_leader_possible_raw, list) else None,
        'required': required,
        'source_file': os.path.basename(source_file),
    }


def parse_all_councilors():
    """Parse all councilor files. Returns (councilors_list, stats_dict)."""
    councilors = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_COUNCILORS_DIR):
        print(f"  [WARN] Councilors directory not found: {MOD_COUNCILORS_DIR}")
        return councilors, stats

    for filename in sorted(os.listdir(MOD_COUNCILORS_DIR)):
        if not filename.endswith('.txt'):
            continue
        if filename in SKIP_FILES:
            continue
        filepath = os.path.join(MOD_COUNCILORS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key.startswith('councilor_'):
                        item = extract_councilor(key, value, filepath)
                        if item:
                            councilors.append(item)
                            stats['items'] += 1

    return councilors, stats


if __name__ == '__main__':
    items, stats = parse_all_councilors()
    print(f"Files: {stats['files']}, Councilors: {stats['items']}, Errors: {stats['errors']}")
    if items:
        print(f"\nFirst 5:")
        for item in items[:5]:
            print(f"  {item['id']} | leader_class={item['leader_class']} | icon={item['icon']} | civic={item['civic']}")
