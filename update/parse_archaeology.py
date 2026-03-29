"""
Archaeological site types parser for STNH mod.
Parses common/archaeological_site_types/*.txt -> structured archaeology data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks, get_all_values
from parse_helpers import serialize_block, to_bool
from config import MOD_ARCHAEOLOGICAL_SITES_DIR


def extract_stages(block):
    """Extract stage blocks from archaeological site."""
    stages = []
    for item in block:
        if isinstance(item, dict) and 'stage' in item:
            stage_block = item['stage']
            if isinstance(stage_block, list):
                stage_data = {}
                for entry in stage_block:
                    if isinstance(entry, dict):
                        for k, v in entry.items():
                            stage_data[k] = v
                stages.append(stage_data)
    return stages if stages else None


def extract_archaeology(site_id, block, source_file):
    """Extract structured data from an archaeological site block."""
    return {
        'id': site_id,
        'name_key': site_id,
        'desc': get_value(block, 'desc') or '',
        'picture': get_value(block, 'picture') or '',
        'stages_count': get_value(block, 'stages'),
        'max_instances': get_value(block, 'max_instances'),
        'stages': extract_stages(block),
        'weight': serialize_block(get_value(block, 'weight')) if isinstance(get_value(block, 'weight'), list) else None,
        'visible': serialize_block(get_value(block, 'visible')) if isinstance(get_value(block, 'visible'), list) else None,
        'allow': serialize_block(get_value(block, 'allow')) if isinstance(get_value(block, 'allow'), list) else None,
        'on_roll_failed': serialize_block(get_value(block, 'on_roll_failed')) if isinstance(get_value(block, 'on_roll_failed'), list) else None,
        'source_file': os.path.basename(source_file),
    }


def parse_all_archaeology():
    """Parse all archaeological site files. Returns (sites_list, stats_dict)."""
    sites = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_ARCHAEOLOGICAL_SITES_DIR):
        print(f"  [WARN] Archaeological sites directory not found: {MOD_ARCHAEOLOGICAL_SITES_DIR}")
        return sites, stats

    for filename in sorted(os.listdir(MOD_ARCHAEOLOGICAL_SITES_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_ARCHAEOLOGICAL_SITES_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_archaeology(key, value, filepath)
                        if item:
                            sites.append(item)
                            stats['items'] += 1

    return sites, stats


if __name__ == '__main__':
    items, stats = parse_all_archaeology()
    print(f"Files: {stats['files']}, Archaeological Sites: {stats['items']}, Errors: {stats['errors']}")
