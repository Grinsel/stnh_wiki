"""
Traits parser for STNH mod.
Parses common/traits/*.txt -> structured trait data.
"""

import os
from parse_pdx import parse_file, get_value, get_all_values, get_blocks
from parse_helpers import serialize_block, to_bool, extract_prerequisites, extract_modifiers, extract_list
from config import MOD_TRAITS_DIR


def extract_trait(trait_id, block, source_file):
    """Extract structured data from a trait block."""
    # Inline script parameters (common in STNH traits)
    inline_params = {}
    for inline_block in get_blocks(block, 'inline_script'):
        for item in inline_block:
            if isinstance(item, dict):
                for k, v in item.items():
                    if k != 'script':
                        inline_params[k] = v

    leader_class = get_value(block, 'leader_class') or inline_params.get('CLASS', '')
    icon = get_value(block, 'icon') or inline_params.get('ICON', '')
    rarity = inline_params.get('RARITY', '')
    tier = inline_params.get('TIER', '')

    return {
        'id': trait_id,
        'name_key': trait_id,
        'leader_class': leader_class,
        'icon': icon,
        'rarity': rarity,
        'tier': tier,
        'cost': get_value(block, 'cost'),
        'prerequisites': extract_prerequisites(block),
        'opposites': extract_list(block, 'opposites'),
        'modifier': extract_modifiers(block, 'modifier', 'self_modifier', 'councilor_modifier',
                                       'planet_modifier', 'sector_modifier'),
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'leader_potential_add': serialize_block(get_value(block, 'leader_potential_add')) if isinstance(get_value(block, 'leader_potential_add'), list) else None,
        'is_veteran_trait': to_bool(get_value(block, 'is_veteran_trait')),
        'source_file': os.path.basename(source_file),
    }


def parse_all_traits():
    """Parse all trait files. Returns (traits_list, stats_dict)."""
    traits = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_TRAITS_DIR):
        print(f"  [WARN] Traits directory not found: {MOD_TRAITS_DIR}")
        return traits, stats

    for filename in sorted(os.listdir(MOD_TRAITS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_TRAITS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key.startswith('trait_'):
                        item = extract_trait(key, value, filepath)
                        if item:
                            traits.append(item)
                            stats['items'] += 1

    return traits, stats


if __name__ == '__main__':
    items, stats = parse_all_traits()
    print(f"Files: {stats['files']}, Traits: {stats['items']}, Errors: {stats['errors']}")
