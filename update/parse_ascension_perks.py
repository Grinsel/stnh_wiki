"""
Ascension perks parser for STNH mod.
Parses common/ascension_perks/*.txt -> structured perk data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_prerequisites, extract_modifiers
from config import MOD_ASCENSION_PERKS_DIR


def extract_perk(perk_id, block, source_file):
    """Extract structured data from an ascension perk block."""
    return {
        'id': perk_id,
        'name_key': perk_id,
        'modifier': extract_modifiers(block, 'modifier'),
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'on_enabled': serialize_block(get_value(block, 'on_enabled')) if isinstance(get_value(block, 'on_enabled'), list) else None,
        'ai_weight': serialize_block(get_value(block, 'ai_weight')) if isinstance(get_value(block, 'ai_weight'), list) else None,
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
