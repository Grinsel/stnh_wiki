"""
Pop jobs parser for STNH mod.
Parses common/pop_jobs/*.txt -> structured job data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_modifiers
from config import MOD_JOBS_DIR


def extract_job(job_id, block, source_file):
    """Extract structured data from a pop job block."""
    # Try direct icon first
    icon_raw = get_value(block, 'icon')
    # Fallback: icon inside swappable_data.default
    if not icon_raw:
        swap = get_value(block, 'swappable_data')
        if isinstance(swap, list):
            default = get_value(swap, 'default')
            if isinstance(default, list):
                icon_raw = get_value(default, 'icon')
    # Build final icon: prepend job_ if bare name
    icon = 'job_' + icon_raw if icon_raw else 'job_' + job_id

    return {
        'id': job_id,
        'name_key': job_id,
        'icon': icon,
        'category': get_value(block, 'category') or '',
        'condition': get_value(block, 'condition') or '',
        'building_icon': get_value(block, 'building_icon') or '',
        'is_capped_by_modifier': to_bool(get_value(block, 'is_capped_by_modifier')),
        'resources': extract_resources(block),
        'possible_pre_triggers': serialize_block(get_value(block, 'possible_pre_triggers')) if isinstance(get_value(block, 'possible_pre_triggers'), list) else None,
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'modifier': extract_modifiers(block, 'planet_modifier', 'country_modifier', 'triggered_planet_modifier', 'triggered_country_modifier'),
        'weight': serialize_block(get_value(block, 'weight')) if isinstance(get_value(block, 'weight'), list) else None,
        'source_file': os.path.basename(source_file),
    }


# PDX scripting keywords that appear as top-level blocks but are not job definitions
# PDX scripting keywords that appear as top-level blocks but are not job definitions
# 'none' is a Stellaris dummy job (possible = { always = no }) with no useful data
_BLACKLIST = {'inline_script', 'scripted_trigger', 'scripted_effect', 'namespace',
              'if', 'else', 'else_if', 'while', 'switch', 'trigger', 'random_list',
              'none'}


def parse_all_jobs():
    """Parse all pop job files. Returns (jobs_list, stats_dict)."""
    jobs = []
    stats = {'files': 0, 'items': 0, 'errors': 0, 'filtered': 0}

    if not os.path.isdir(MOD_JOBS_DIR):
        print(f"  [WARN] Pop jobs directory not found: {MOD_JOBS_DIR}")
        return jobs, stats

    for filename in sorted(os.listdir(MOD_JOBS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_JOBS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        if key in _BLACKLIST:
                            stats['filtered'] += 1
                            continue
                        item = extract_job(key, value, filepath)
                        if item:
                            jobs.append(item)
                            stats['items'] += 1

    return jobs, stats


if __name__ == '__main__':
    items, stats = parse_all_jobs()
    print(f"Files: {stats['files']}, Jobs: {stats['items']}, Errors: {stats['errors']}")
