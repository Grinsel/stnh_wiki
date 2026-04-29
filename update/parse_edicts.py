"""
Edicts parser for STNH mod.
Parses common/edicts/*.txt -> structured edict data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_prerequisites, extract_modifiers, _extract_icon_stem, extract_set_flags
from config import MOD_EDICTS_DIR


def extract_edict(edict_id, block, source_file):
    """Extract structured data from an edict block."""
    return {
        'id': edict_id,
        'name_key': f'edict_{edict_id}',
        'icon': _extract_icon_stem(get_value(block, 'icon')),
        'length': get_value(block, 'length'),
        'is_ambition': to_bool(get_value(block, 'is_ambition')),
        'prerequisites': extract_prerequisites(block),
        'resources': extract_resources(block),
        'modifier': extract_modifiers(block, 'modifier'),
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'allow': serialize_block(get_value(block, 'allow')) if isinstance(get_value(block, 'allow'), list) else None,
        'ai_weight': serialize_block(get_value(block, 'ai_weight')) if isinstance(get_value(block, 'ai_weight'), list) else None,
        'set_flags': extract_set_flags(block),
        'source_file': os.path.basename(source_file),
    }


def parse_all_edicts():
    """Parse all edict files. Returns (edicts_list, stats_dict)."""
    edicts = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_EDICTS_DIR):
        print(f"  [WARN] Edicts directory not found: {MOD_EDICTS_DIR}")
        return edicts, stats

    for filename in sorted(os.listdir(MOD_EDICTS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_EDICTS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_edict(key, value, filepath)
                        if item:
                            edicts.append(item)
                            stats['items'] += 1

    return edicts, stats


if __name__ == '__main__':
    items, stats = parse_all_edicts()
    print(f"Files: {stats['files']}, Edicts: {stats['items']}, Errors: {stats['errors']}")
