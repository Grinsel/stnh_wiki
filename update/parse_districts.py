"""
Districts parser for STNH mod.
Parses common/districts/*.txt -> structured district data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_prerequisites, extract_modifiers
from config import MOD_DISTRICTS_DIR


def extract_district(district_id, block, source_file):
    """Extract structured data from a district block."""
    return {
        'id': district_id,
        'name_key': district_id,
        'base_buildtime': get_value(block, 'base_buildtime'),
        'is_capped_by_modifier': to_bool(get_value(block, 'is_capped_by_modifier')),
        'min_for_deposits_on_planet': get_value(block, 'min_for_deposits_on_planet'),
        'prerequisites': extract_prerequisites(block),
        'resources': extract_resources(block),
        'modifier': extract_modifiers(block, 'planet_modifier', 'triggered_planet_modifier'),
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'allow': serialize_block(get_value(block, 'allow')) if isinstance(get_value(block, 'allow'), list) else None,
        'source_file': os.path.basename(source_file),
    }


def parse_all_districts():
    """Parse all district files. Returns (districts_list, stats_dict)."""
    districts = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_DISTRICTS_DIR):
        print(f"  [WARN] Districts directory not found: {MOD_DISTRICTS_DIR}")
        return districts, stats

    for filename in sorted(os.listdir(MOD_DISTRICTS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_DISTRICTS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key.startswith('district_'):
                        item = extract_district(key, value, filepath)
                        if item:
                            districts.append(item)
                            stats['items'] += 1

    return districts, stats


if __name__ == '__main__':
    items, stats = parse_all_districts()
    print(f"Files: {stats['files']}, Districts: {stats['items']}, Errors: {stats['errors']}")
