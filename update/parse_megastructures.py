"""
Megastructures parser for STNH mod.
Parses common/megastructures/*.txt -> structured megastructure data.
Megastructures have multiple build stages (e.g. build_stage -> build_complete).
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_prerequisites, extract_modifiers
from config import MOD_MEGASTRUCTURES_DIR


def extract_megastructure(mega_id, block, source_file):
    """Extract structured data from a megastructure block."""
    upgrade_from_block = get_value(block, 'upgrade_from')
    upgrade_from = None
    if isinstance(upgrade_from_block, list):
        for item in upgrade_from_block:
            if isinstance(item, dict):
                for k, v in item.items():
                    upgrade_from = v
                    break

    return {
        'id': mega_id,
        'name_key': mega_id,
        'entity': get_value(block, 'entity') or '',
        'portrait': get_value(block, 'portrait') or '',
        'build_time': get_value(block, 'build_time'),
        'resources': extract_resources(block),
        'prerequisites': extract_prerequisites(block),
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'upgrade_from': upgrade_from,
        'modifier': extract_modifiers(block, 'country_modifier', 'station_modifier', 'triggered_country_modifier'),
        'on_build_complete': serialize_block(get_value(block, 'on_build_complete')) if isinstance(get_value(block, 'on_build_complete'), list) else None,
        'sensor_range': get_value(block, 'sensor_range'),
        'source_file': os.path.basename(source_file),
    }


def parse_all_megastructures():
    """Parse all megastructure files. Returns (megas_list, stats_dict)."""
    megas = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_MEGASTRUCTURES_DIR):
        print(f"  [WARN] Megastructures directory not found: {MOD_MEGASTRUCTURES_DIR}")
        return megas, stats

    for filename in sorted(os.listdir(MOD_MEGASTRUCTURES_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_MEGASTRUCTURES_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_megastructure(key, value, filepath)
                        if item:
                            megas.append(item)
                            stats['items'] += 1

    return megas, stats


if __name__ == '__main__':
    items, stats = parse_all_megastructures()
    print(f"Files: {stats['files']}, Megastructures: {stats['items']}, Errors: {stats['errors']}")
