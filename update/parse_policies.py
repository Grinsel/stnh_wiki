"""
Policies parser for STNH mod.
Parses common/policies/*.txt -> structured policy data.
"""

import os
from parse_pdx import parse_file, get_value, get_all_values, get_blocks
from parse_helpers import serialize_block, to_bool, extract_modifiers, extract_list, _extract_icon_stem, extract_set_flags
from config import MOD_POLICIES_DIR


def extract_policy(policy_id, block, source_file):
    """Extract structured data from a policy block."""
    # Extract options
    options = []
    for opt_block in get_blocks(block, 'option'):
        opt = {
            'name': get_value(opt_block, 'name') or '',
            'icon': _extract_icon_stem(get_value(opt_block, 'icon')),
            'policy_flags': extract_list(opt_block, 'policy_flags'),
            'modifier': extract_modifiers(opt_block, 'modifier'),
            'potential': serialize_block(get_value(opt_block, 'potential')) if isinstance(get_value(opt_block, 'potential'), list) else None,
            'ai_weight': serialize_block(get_value(opt_block, 'ai_weight')) if isinstance(get_value(opt_block, 'ai_weight'), list) else None,
        }
        options.append(opt)

    return {
        'id': policy_id,
        'name_key': f'policy_{policy_id}',
        'icon': options[0]['icon'] if options and options[0].get('icon') else '',
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'allow': serialize_block(get_value(block, 'allow')) if isinstance(get_value(block, 'allow'), list) else None,
        'options': options,
        'set_flags': extract_set_flags(block),
        'source_file': os.path.basename(source_file),
    }


def parse_all_policies():
    """Parse all policy files. Returns (policies_list, stats_dict)."""
    policies = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_POLICIES_DIR):
        print(f"  [WARN] Policies directory not found: {MOD_POLICIES_DIR}")
        return policies, stats

    for filename in sorted(os.listdir(MOD_POLICIES_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_POLICIES_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_policy(key, value, filepath)
                        if item:
                            policies.append(item)
                            stats['items'] += 1

    return policies, stats


if __name__ == '__main__':
    items, stats = parse_all_policies()
    print(f"Files: {stats['files']}, Policies: {stats['items']}, Errors: {stats['errors']}")
