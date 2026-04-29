"""
Buildings parser for STNH mod.
Parses common/buildings/*.txt -> structured building data.
"""

import os
from parse_pdx import parse_file, get_value, get_all_values, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_prerequisites, extract_modifiers, extract_list, extract_set_flags
from config import MOD_BUILDINGS_DIR


def extract_building(building_id, block, source_file):
    """Extract structured data from a building block."""
    icon_key = get_value(block, 'icon') or building_id
    return {
        'id': building_id,
        'name_key': building_id,
        'icon_key': icon_key,
        'category': get_value(block, 'category') or '',
        'base_buildtime': get_value(block, 'base_buildtime'),
        'base_cap_amount': get_value(block, 'base_cap_amount'),
        'capital': to_bool(get_value(block, 'capital')),
        'can_build': to_bool(get_value(block, 'can_build')) if get_value(block, 'can_build') is not None else True,
        'can_demolish': to_bool(get_value(block, 'can_demolish')) if get_value(block, 'can_demolish') is not None else True,
        'prerequisites': extract_prerequisites(block),
        'resources': extract_resources(block),
        'upgrades': extract_list(block, 'upgrades'),
        'modifier': extract_modifiers(block, 'planet_modifier', 'country_modifier', 'triggered_planet_modifier'),
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'allow': serialize_block(get_value(block, 'allow')) if isinstance(get_value(block, 'allow'), list) else None,
        'ai_weight': serialize_block(get_value(block, 'ai_weight')) if isinstance(get_value(block, 'ai_weight'), list) else None,
        'building_sets': extract_list(block, 'building_sets'),
        'set_flags': extract_set_flags(block),
        'source_file': os.path.basename(source_file),
    }


def parse_all_buildings():
    """Parse all building files. Returns (buildings_list, stats_dict)."""
    buildings = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_BUILDINGS_DIR):
        print(f"  [WARN] Buildings directory not found: {MOD_BUILDINGS_DIR}")
        return buildings, stats

    for filename in sorted(os.listdir(MOD_BUILDINGS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_BUILDINGS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key not in ('@', ):
                        item = extract_building(key, value, filepath)
                        if item:
                            buildings.append(item)
                            stats['items'] += 1

    return buildings, stats


if __name__ == '__main__':
    items, stats = parse_all_buildings()
    print(f"Files: {stats['files']}, Buildings: {stats['items']}, Errors: {stats['errors']}")
