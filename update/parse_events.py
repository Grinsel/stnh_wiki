"""
Event parser for STNH mod.
Iterates over all event files, extracts structured event data.
"""

import os
import re
from parse_pdx import parse_file, get_value, get_all_values, get_blocks
from config import MOD_EVENTS_DIR, EVENT_TYPES


def extract_event(event_type, block, source_file, namespace):
    """Extract structured data from a parsed event block."""
    event_id = get_value(block, 'id')
    if not event_id:
        return None

    # Title - can be string or absent
    title_key = get_value(block, 'title')

    # Description - can be string or list of conditional desc blocks
    desc_keys = []
    for item in block:
        if isinstance(item, dict) and 'desc' in item:
            desc_val = item['desc']
            if isinstance(desc_val, str):
                desc_keys.append({'text': desc_val})
            elif isinstance(desc_val, list):
                # Conditional desc block: { trigger = { ... } text = "key" }
                trigger = get_value(desc_val, 'trigger')
                text = get_value(desc_val, 'text')
                entry = {}
                if text:
                    entry['text'] = text
                if trigger:
                    entry['trigger'] = _serialize_block(trigger)
                if entry:
                    desc_keys.append(entry)

    # Picture - can be string or conditional block
    picture_raw = get_value(block, 'picture')
    if isinstance(picture_raw, str):
        picture = picture_raw
    elif isinstance(picture_raw, list):
        # Conditional picture: extract first picture name
        pic = get_value(picture_raw, 'picture')
        picture = pic if isinstance(pic, str) else None
    else:
        picture = None

    # Options
    options = []
    for opt_block in get_blocks(block, 'option'):
        opt = extract_option(opt_block)
        options.append(opt)

    # Trigger conditions
    trigger = get_value(block, 'trigger')
    trigger_data = _serialize_block(trigger) if isinstance(trigger, list) else None

    # Immediate effects
    immediate = get_value(block, 'immediate')
    immediate_data = _serialize_block(immediate) if isinstance(immediate, list) else None

    # After effects
    after = get_value(block, 'after')
    after_data = _serialize_block(after) if isinstance(after, list) else None

    # Flags
    is_triggered_only = get_value(block, 'is_triggered_only')
    hide_window = get_value(block, 'hide_window')
    fire_only_once = get_value(block, 'fire_only_once')
    diplomatic = get_value(block, 'diplomatic')

    # MTTH
    mtth = get_value(block, 'mean_time_to_happen')
    mtth_data = _serialize_block(mtth) if isinstance(mtth, list) else None

    # Location
    location = get_value(block, 'location')

    # Find triggered event IDs within this event (for relationship building)
    triggered_events = find_triggered_events(block)

    return {
        'id': str(event_id),
        'type': event_type,
        'namespace': namespace,
        'title_key': title_key,
        'desc_keys': desc_keys,
        'picture': picture,
        'options': options,
        'trigger': trigger_data,
        'immediate': immediate_data,
        'after': after_data,
        'is_triggered_only': _to_bool(is_triggered_only),
        'hide_window': _to_bool(hide_window),
        'fire_only_once': _to_bool(fire_only_once),
        'diplomatic': _to_bool(diplomatic),
        'mean_time_to_happen': mtth_data,
        'location': location,
        'triggered_events': triggered_events,
        'source_file': os.path.basename(source_file),
    }


def extract_option(block):
    """Extract option data from a parsed option block."""
    name_key = get_value(block, 'name')

    # Allow conditions
    allow = get_value(block, 'allow')
    allow_data = _serialize_block(allow) if isinstance(allow, list) else None

    # Trigger conditions (option-level)
    trigger = get_value(block, 'trigger')
    trigger_data = _serialize_block(trigger) if isinstance(trigger, list) else None

    # AI chance
    ai_chance = get_value(block, 'ai_chance')
    ai_chance_data = _serialize_block(ai_chance) if isinstance(ai_chance, list) else None

    # Find triggered events within option
    triggered_events = find_triggered_events(block)

    # Collect all effects (everything that's not name/allow/trigger/ai_chance)
    skip_keys = {'name', 'allow', 'trigger', 'ai_chance', 'custom_tooltip',
                 'tooltip', 'default_hide_option'}
    effects = []
    for item in block:
        if isinstance(item, dict):
            key = list(item.keys())[0]
            if key not in skip_keys:
                effects.append(_serialize_item(item))

    # Custom tooltip
    custom_tooltip = get_value(block, 'custom_tooltip')

    return {
        'name_key': name_key,
        'allow': allow_data,
        'trigger': trigger_data,
        'ai_chance': ai_chance_data,
        'effects': effects,
        'triggered_events': triggered_events,
        'custom_tooltip': custom_tooltip,
    }


def find_triggered_events(block):
    """Recursively find all event IDs triggered within a block."""
    event_ids = []
    if not isinstance(block, list):
        return event_ids

    for item in block:
        if isinstance(item, dict):
            for key, val in item.items():
                if key in ('country_event', 'planet_event', 'fleet_event',
                           'ship_event', 'pop_event'):
                    if isinstance(val, list):
                        eid = get_value(val, 'id')
                        if eid:
                            event_ids.append(str(eid))
                    elif isinstance(val, str):
                        event_ids.append(val)
                elif isinstance(val, list):
                    event_ids.extend(find_triggered_events(val))
    return list(set(event_ids))


def _serialize_block(block):
    """Convert parsed block to JSON-serializable format."""
    if not isinstance(block, list):
        return block
    result = []
    for item in block:
        result.append(_serialize_item(item))
    return result


def _serialize_item(item):
    """Convert a single parsed item to JSON-serializable format."""
    if isinstance(item, dict):
        result = {}
        for k, v in item.items():
            if isinstance(v, list):
                result[str(k)] = _serialize_block(v)
            else:
                result[str(k)] = v
        return result
    return item


def _to_bool(val):
    if val == 'yes' or val is True:
        return True
    return False


def parse_all_events():
    """Parse all event files. Returns (events_list, namespaces_dict, stats)."""
    all_events = []
    namespaces = {}
    stats = {'files': 0, 'events': 0, 'failed_files': 0, 'errors': []}

    for fn in sorted(os.listdir(MOD_EVENTS_DIR)):
        if not fn.endswith('.txt'):
            continue
        stats['files'] += 1
        fp = os.path.join(MOD_EVENTS_DIR, fn)

        data, err = parse_file(fp)
        if err:
            stats['failed_files'] += 1
            stats['errors'].append(f"{fn}: {err}")
            continue

        # Extract namespace
        namespace = None
        for item in data:
            if isinstance(item, dict) and 'namespace' in item:
                namespace = item['namespace']
                break

        if namespace and namespace not in namespaces:
            namespaces[namespace] = {
                'name': namespace,
                'source_files': [],
                'event_count': 0,
            }

        if namespace and fn not in namespaces[namespace]['source_files']:
            namespaces[namespace]['source_files'].append(fn)

        # Extract events
        for item in data:
            if isinstance(item, dict):
                for key in item:
                    if key in EVENT_TYPES:
                        block = item[key]
                        if isinstance(block, list):
                            event = extract_event(key, block, fp, namespace)
                            if event:
                                all_events.append(event)
                                stats['events'] += 1
                                if namespace and namespace in namespaces:
                                    namespaces[namespace]['event_count'] += 1

    return all_events, namespaces, stats


def main():
    print("=== Parsing Events ===")
    events, namespaces, stats = parse_all_events()
    print(f"\nFiles processed: {stats['files']}")
    print(f"Files failed: {stats['failed_files']}")
    print(f"Events extracted: {stats['events']}")
    print(f"Namespaces found: {len(namespaces)}")

    if stats['errors']:
        print(f"\nErrors:")
        for e in stats['errors'][:10]:
            print(f"  {e}")

    # Show some stats
    type_counts = {}
    for ev in events:
        t = ev['type']
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"\nBy type:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")

    return events, namespaces, stats


if __name__ == '__main__':
    main()
