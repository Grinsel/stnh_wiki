"""
Ship sizes parser for STNH mod.
Parses common/ship_sizes/*.txt -> structured ship data.
"""

import os
from parse_pdx import parse_file, get_value, get_all_values, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_prerequisites, extract_modifiers
from config import MOD_SHIP_SIZES_DIR


def extract_ship(ship_id, block, source_file):
    """Extract structured data from a ship_size block."""
    return {
        'id': ship_id,
        'name_key': ship_id,
        'class': get_value(block, 'class') or '',
        'formation_priority': get_value(block, 'formation_priority'),
        'max_speed': get_value(block, 'max_speed'),
        'acceleration': get_value(block, 'acceleration'),
        'rotation_speed': get_value(block, 'rotation_speed'),
        'collision_radius': get_value(block, 'collision_radius'),
        'max_hitpoints': get_value(block, 'max_hitpoints'),
        'size_multiplier': get_value(block, 'size_multiplier'),
        'fleet_slot_size': get_value(block, 'fleet_slot_size'),
        'base_buildtime': get_value(block, 'base_buildtime'),
        'can_have_federation_design': to_bool(get_value(block, 'can_have_federation_design')),
        'enable_default_design': to_bool(get_value(block, 'enable_default_design')),
        'is_space_station': to_bool(get_value(block, 'is_space_station')),
        'is_civilian': to_bool(get_value(block, 'is_civilian')),
        'is_designable': to_bool(get_value(block, 'is_designable')),
        'prerequisites': extract_prerequisites(block),
        'resources': extract_resources(block),
        'modifier': extract_modifiers(block, 'modifier', 'ship_modifier'),
        'section_slots': _extract_section_slots(block),
        'combat_disengage_chance': get_value(block, 'combat_disengage_chance'),
        'icon_frame': get_value(block, 'icon_frame'),
        'graphical_culture': _extract_graphical_culture(block),
        'source_file': os.path.basename(source_file),
    }


def _extract_graphical_culture(block):
    """Extract graphical_culture = { "federation" "terran" ... } -> list of strings."""
    val = get_value(block, 'graphical_culture')
    if isinstance(val, list):
        return [str(v) for v in val if isinstance(v, str)]
    return []


def _extract_section_slots(block):
    """Extract section_slots = { slot_name = { ... } } entries."""
    slots = []
    for section_block in get_blocks(block, 'section_slots'):
        for item in section_block:
            if isinstance(item, dict):
                for slot_name, slot_data in item.items():
                    entry = {'name': slot_name}
                    if isinstance(slot_data, list):
                        entry['locator'] = get_value(slot_data, 'locator') or ''
                    slots.append(entry)
    return slots


def parse_all_ships():
    """Parse all ship size files. Returns (ships_list, stats_dict)."""
    ships = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_SHIP_SIZES_DIR):
        print(f"  [WARN] Ship sizes directory not found: {MOD_SHIP_SIZES_DIR}")
        return ships, stats

    for filename in sorted(os.listdir(MOD_SHIP_SIZES_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_SHIP_SIZES_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_ship(key, value, filepath)
                        if item:
                            ships.append(item)
                            stats['items'] += 1

    return ships, stats


if __name__ == '__main__':
    items, stats = parse_all_ships()
    print(f"Files: {stats['files']}, Ships: {stats['items']}, Errors: {stats['errors']}")
