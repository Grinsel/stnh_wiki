"""
Deposits parser for STNH mod.
Parses common/deposits/*.txt -> structured deposit data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_modifiers
from config import MOD_DEPOSITS_DIR


def extract_deposit(dep_id, block, source_file):
    """Extract structured data from a deposit block."""
    return {
        'id': dep_id,
        'name_key': dep_id,
        'is_null': to_bool(get_value(block, 'is_null')),
        'is_for_colonizable': to_bool(get_value(block, 'is_for_colonizable')),
        'category': get_value(block, 'category') or '',
        'resources': extract_resources(block),
        'modifier': extract_modifiers(block, 'planet_modifier', 'station_modifier', 'blocked_modifier', 'constant_modifier'),
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'drop_weight': serialize_block(get_value(block, 'drop_weight')) if isinstance(get_value(block, 'drop_weight'), list) else None,
        'source_file': os.path.basename(source_file),
    }


def parse_all_deposits():
    """Parse all deposit files. Returns (deposits_list, stats_dict)."""
    deposits = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_DEPOSITS_DIR):
        print(f"  [WARN] Deposits directory not found: {MOD_DEPOSITS_DIR}")
        return deposits, stats

    for filename in sorted(os.listdir(MOD_DEPOSITS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_DEPOSITS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_deposit(key, value, filepath)
                        if item:
                            deposits.append(item)
                            stats['items'] += 1

    return deposits, stats


if __name__ == '__main__':
    items, stats = parse_all_deposits()
    print(f"Files: {stats['files']}, Deposits: {stats['items']}, Errors: {stats['errors']}")
