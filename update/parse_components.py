"""
Component templates parser for STNH mod.
Parses common/component_templates/*.txt -> structured component data.
"""

import os
from parse_pdx import parse_file, get_value, get_all_values, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_prerequisites, extract_modifiers, extract_list
from config import MOD_COMPONENT_TEMPLATES_DIR

COMPONENT_TYPES = [
    'weapon_component_template',
    'utility_component_template',
    'strike_craft_component_template',
]


def extract_component(comp_type, comp_id, block, source_file):
    """Extract structured data from a component template block."""
    key = get_value(block, 'key') or comp_id

    # Damage stats (for weapons)
    damage = None
    damage_block = get_value(block, 'damage')
    if isinstance(damage_block, list):
        damage = {
            'min': get_value(damage_block, 'min'),
            'max': get_value(damage_block, 'max'),
        }

    return {
        'id': key,
        'name_key': key,
        'type': comp_type.replace('_component_template', ''),
        'key': key,
        'size': get_value(block, 'size') or '',
        'icon': get_value(block, 'icon') or '',
        'icon_frame': get_value(block, 'icon_frame'),
        'power': get_value(block, 'power'),
        'component_set': get_value(block, 'component_set') or '',
        'upgrades_to': get_value(block, 'upgrades_to') or '',
        'prerequisites': extract_prerequisites(block),
        'resources': extract_resources(block),
        'damage': damage,
        'windup': get_value(block, 'windup'),
        'cooldown': get_value(block, 'cooldown'),
        'range': get_value(block, 'range'),
        'accuracy': get_value(block, 'accuracy'),
        'tracking': get_value(block, 'tracking'),
        'hull_damage': get_value(block, 'hull_damage'),
        'armor_damage': get_value(block, 'armor_damage'),
        'armor_penetration': get_value(block, 'armor_penetration'),
        'shield_damage': get_value(block, 'shield_damage'),
        'shield_penetration': get_value(block, 'shield_penetration'),
        'tags': extract_list(block, 'tags') if get_value(block, 'tags') else [],
        'modifier': extract_modifiers(block, 'modifier', 'ship_modifier'),
        'hidden': to_bool(get_value(block, 'hidden')),
        'source_file': os.path.basename(source_file),
    }


def parse_all_components():
    """Parse all component template files. Returns (components_list, stats_dict)."""
    components = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_COMPONENT_TEMPLATES_DIR):
        print(f"  [WARN] Component templates directory not found: {MOD_COMPONENT_TEMPLATES_DIR}")
        return components, stats

    for filename in sorted(os.listdir(MOD_COMPONENT_TEMPLATES_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_COMPONENT_TEMPLATES_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if key in COMPONENT_TYPES and isinstance(value, list):
                        comp_key = get_value(value, 'key') or f"_unnamed_{stats['items']}"
                        item = extract_component(key, comp_key, value, filepath)
                        if item:
                            components.append(item)
                            stats['items'] += 1

    return components, stats


if __name__ == '__main__':
    items, stats = parse_all_components()
    print(f"Files: {stats['files']}, Components: {stats['items']}, Errors: {stats['errors']}")
