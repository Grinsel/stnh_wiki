"""
Parse on_action files to build on_action -> event mappings.
"""

import os
import json
import re
from parse_pdx import parse_file, get_value, get_all_values
from config import MOD_ON_ACTIONS_DIR, OUTPUT_ASSETS_DIR


def find_event_refs(block, depth=0):
    """Recursively find all event references in a block.
    On_actions use: events = { event_id1 event_id2 ... }
    Also handles direct event calls: country_event = { id = X }
    """
    refs = []
    if not isinstance(block, list) or depth > 20:
        return refs
    for item in block:
        if isinstance(item, dict):
            for key, val in item.items():
                if key == 'events':
                    # events = { id1 id2 id3 } -> val is a list of strings
                    if isinstance(val, list):
                        for v in val:
                            if isinstance(v, str):
                                refs.append(v)
                elif key in ('country_event', 'planet_event', 'fleet_event',
                           'ship_event', 'pop_event', 'observer_event'):
                    if isinstance(val, list):
                        eid = get_value(val, 'id')
                        if eid:
                            refs.append(str(eid))
                    elif isinstance(val, str):
                        refs.append(val)
                elif isinstance(val, list):
                    refs.extend(find_event_refs(val, depth + 1))
        elif isinstance(item, str):
            # Bare string in a list = event id
            refs.append(item)
    return refs


def parse_on_actions():
    """Parse all on_action files. Returns dict of on_action_name -> [event_ids]."""
    on_actions = {}

    if not os.path.isdir(MOD_ON_ACTIONS_DIR):
        print(f"  [WARN] On-actions directory not found: {MOD_ON_ACTIONS_DIR}")
        return on_actions

    for fn in sorted(os.listdir(MOD_ON_ACTIONS_DIR)):
        if not fn.endswith('.txt'):
            continue
        fp = os.path.join(MOD_ON_ACTIONS_DIR, fn)
        data, err = parse_file(fp)
        if err:
            print(f"  [WARN] {fn}: {err}")
            continue

        for item in data:
            if isinstance(item, dict):
                for key, val in item.items():
                    if isinstance(val, list):
                        event_refs = find_event_refs(val)
                        if event_refs:
                            if key not in on_actions:
                                on_actions[key] = []
                            on_actions[key].extend(event_refs)

    # Deduplicate
    for key in on_actions:
        on_actions[key] = sorted(set(on_actions[key]))

    return on_actions


def main():
    print("=== Parsing On-Actions ===")
    on_actions = parse_on_actions()

    output_path = os.path.join(OUTPUT_ASSETS_DIR, 'on_actions.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(on_actions, f, indent=2)

    total_refs = sum(len(v) for v in on_actions.values())
    print(f"  On-actions: {len(on_actions)}, Event refs: {total_refs}")
    print(f"  Written: {output_path}")
    return on_actions


if __name__ == '__main__':
    main()
