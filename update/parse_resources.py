"""
Strategic resources parser.
Parses common/strategic_resources/*.txt from vanilla and STNH mod -> structured resource data.
Mod entries override vanilla entries with the same id.
"""

import os
from parse_pdx import parse_file, get_value
from parse_helpers import to_bool, extract_prerequisites
from config import MOD_STRATEGIC_RESOURCES_DIR, VANILLA_STRATEGIC_RESOURCES_DIR


def _ai_weight_value(block):
    val = get_value(block, 'ai_weight')
    if isinstance(val, list):
        for item in val:
            if isinstance(item, dict) and 'weight' in item:
                return item['weight']
    return None


def _ai_wants_base(block):
    val = get_value(block, 'ai_wants')
    if isinstance(val, list):
        for item in val:
            if isinstance(item, dict) and 'base' in item:
                return item['base']
    return None


def extract_resource(rid, block, source_file, source_kind):
    return {
        'id': rid,
        'name_key': rid,
        'desc_key': f'{rid}_desc',
        'icon': rid,
        'tradable': to_bool(get_value(block, 'tradable')),
        'market_amount': get_value(block, 'market_amount'),
        'market_price': get_value(block, 'market_price'),
        'max': get_value(block, 'max'),
        'deficit_modifier': get_value(block, 'deficit_modifier'),
        'deficit_trade_conversion_mult': get_value(block, 'deficit_trade_conversion_mult'),
        'ai_weight': _ai_weight_value(block),
        'ai_wants_base': _ai_wants_base(block),
        'prerequisites': extract_prerequisites(block),
        'category': get_value(block, 'category') or '',
        'source': source_kind,
        'source_file': os.path.basename(source_file),
    }


def _parse_dir(directory, source_kind, by_id, stats):
    if not os.path.isdir(directory):
        print(f"  [WARN] Strategic resources dir not found: {directory}")
        return
    for filename in sorted(os.listdir(directory)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(directory, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            for key, value in entry.items():
                if isinstance(value, list):
                    by_id[key] = extract_resource(key, value, filepath, source_kind)


def parse_all_resources():
    """Parse vanilla + STNH strategic resources. Returns (resources_list, stats_dict).
    Mod entries override vanilla entries when ids collide."""
    by_id = {}
    stats = {'files': 0, 'items': 0, 'errors': 0, 'vanilla': 0, 'stnh': 0, 'overrides': 0}

    _parse_dir(VANILLA_STRATEGIC_RESOURCES_DIR, 'vanilla', by_id, stats)
    vanilla_ids = set(by_id.keys())
    stats['vanilla'] = len(vanilla_ids)

    _parse_dir(MOD_STRATEGIC_RESOURCES_DIR, 'stnh', by_id, stats)
    stnh_ids = set(by_id.keys()) - vanilla_ids
    stats['stnh'] = len(stnh_ids)
    stats['overrides'] = sum(
        1 for rid in vanilla_ids
        if rid in by_id and by_id[rid]['source'] == 'stnh'
    )

    resources = sorted(by_id.values(), key=lambda r: r['id'])
    stats['items'] = len(resources)
    return resources, stats


if __name__ == '__main__':
    items, stats = parse_all_resources()
    print(f"Files: {stats['files']}, Resources: {stats['items']}, "
          f"Vanilla: {stats['vanilla']}, STNH-new: {stats['stnh']}, "
          f"Mod-overrides: {stats['overrides']}, Errors: {stats['errors']}")
