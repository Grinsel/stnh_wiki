"""
Anomalies parser for STNH mod.
Parses common/anomalies/*.txt -> structured anomaly data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_modifiers, extract_set_flags
from config import MOD_ANOMALIES_DIR


def extract_on_success(block):
    """Extract on_success weighted event outcomes: { 20 = event.1  2 = event.2 }"""
    val = get_value(block, 'on_success')
    if not isinstance(val, list):
        return None
    outcomes = []
    for item in val:
        if isinstance(item, dict):
            for weight, event_id in item.items():
                outcomes.append({'weight': weight, 'event': event_id})
    return outcomes if outcomes else None


def extract_anomaly(anom_id, block, source_file):
    """Extract structured data from an anomaly block."""
    return {
        'id': anom_id,
        'name_key': anom_id,
        'desc': get_value(block, 'desc') or '',
        'picture': get_value(block, 'picture') or '',
        'level': get_value(block, 'level'),
        'max_once': to_bool(get_value(block, 'max_once')),
        'spawn_chance': serialize_block(get_value(block, 'spawn_chance')) if isinstance(get_value(block, 'spawn_chance'), list) else None,
        'on_success': extract_on_success(block),
        'on_fail': serialize_block(get_value(block, 'on_fail')) if isinstance(get_value(block, 'on_fail'), list) else None,
        'on_critical_fail': serialize_block(get_value(block, 'on_critical_fail')) if isinstance(get_value(block, 'on_critical_fail'), list) else None,
        'set_flags': extract_set_flags(block),
        'source_file': os.path.basename(source_file),
    }


def parse_all_anomalies():
    """Parse all anomaly files. Returns (anomalies_list, stats_dict)."""
    anomalies = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_ANOMALIES_DIR):
        print(f"  [WARN] Anomalies directory not found: {MOD_ANOMALIES_DIR}")
        return anomalies, stats

    for filename in sorted(os.listdir(MOD_ANOMALIES_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_ANOMALIES_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_anomaly(key, value, filepath)
                        if item:
                            anomalies.append(item)
                            stats['items'] += 1

    return anomalies, stats


if __name__ == '__main__':
    items, stats = parse_all_anomalies()
    print(f"Files: {stats['files']}, Anomalies: {stats['items']}, Errors: {stats['errors']}")
