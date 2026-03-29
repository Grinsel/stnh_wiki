"""
Traditions parser for STNH mod.
Parses common/traditions/*.txt -> structured tradition data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_prerequisites, extract_modifiers
from config import MOD_TRADITIONS_DIR


def extract_tradition(trad_id, block, source_file):
    """Extract structured data from a tradition block."""
    # Determine tree from ID prefix: tr_aptitude_adopt -> aptitude
    parts = trad_id.split('_')
    tree = ''
    role = 'node'
    if len(parts) >= 3 and parts[0] == 'tr':
        tree = parts[1]
        last = parts[-1]
        if last == 'adopt':
            role = 'adopt'
        elif last == 'finish':
            role = 'finish'

    # Tradition swap
    swap_data = None
    swap_blocks = get_blocks(block, 'tradition_swap')
    if swap_blocks:
        swaps = []
        for sb in swap_blocks:
            swap_entry = {
                'name': get_value(sb, 'name'),
                'trigger': serialize_block(get_value(sb, 'trigger')) if isinstance(get_value(sb, 'trigger'), list) else None,
                'modifier': extract_modifiers(sb, 'modifier'),
            }
            swaps.append(swap_entry)
        swap_data = swaps

    return {
        'id': trad_id,
        'name_key': trad_id,
        'tree': tree,
        'role': role,
        'modifier': extract_modifiers(block, 'modifier'),
        'tradition_swap': swap_data,
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'ai_weight': serialize_block(get_value(block, 'ai_weight')) if isinstance(get_value(block, 'ai_weight'), list) else None,
        'source_file': os.path.basename(source_file),
    }


def parse_all_traditions():
    """Parse all tradition files. Returns (traditions_list, stats_dict)."""
    traditions = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_TRADITIONS_DIR):
        print(f"  [WARN] Traditions directory not found: {MOD_TRADITIONS_DIR}")
        return traditions, stats

    for filename in sorted(os.listdir(MOD_TRADITIONS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_TRADITIONS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key.startswith('tr_'):
                        item = extract_tradition(key, value, filepath)
                        if item:
                            traditions.append(item)
                            stats['items'] += 1

    return traditions, stats


if __name__ == '__main__':
    items, stats = parse_all_traditions()
    print(f"Files: {stats['files']}, Traditions: {stats['items']}, Errors: {stats['errors']}")
