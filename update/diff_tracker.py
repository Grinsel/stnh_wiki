"""
Change-Tracking for STNH Wiki Update Pipeline.

Snapshot-based diff: reads old JSON before update, compares after,
and generates a detailed change report (new/modified/removed items).
"""

import json
import os
from datetime import datetime


# Mapping: which JSON files to track per module
# (filename, id_field, items_key_or_None)
TRACKED_FILES = {
    'events':        [('events_index.json', 'id', None)],
    'ships':         [('ships.json', 'id', 'items')],
    'buildings':     [('buildings.json', 'id', None), ('districts.json', 'id', None)],
    'traits':        [('traits.json', 'id', None), ('traditions.json', 'id', None),
                      ('ascension_perks.json', 'id', None)],
    'governments':   [('governments.json', 'id', None), ('civics.json', 'id', None),
                      ('authorities.json', 'id', None), ('policies.json', 'id', None),
                      ('edicts.json', 'id', None), ('councilors.json', 'id', None)],
    'megastructures':[('megastructures.json', 'id', None), ('relics.json', 'id', None)],
    'anomalies':     [('anomalies.json', 'id', None), ('archaeology.json', 'id', None)],
    'empires':       [('empires.json', 'id', None), ('species.json', 'id', None)],
    'economy':       [('jobs.json', 'id', None), ('deposits.json', 'id', None)],
    'components':    [('components.json', 'id', None)],
}


def load_snapshot(json_path, id_field='id', items_key=None):
    """Read existing JSON file and return {id: item_dict}.

    Args:
        json_path: Path to JSON file
        id_field: Key used as unique identifier in each item
        items_key: If set, items are nested under this key (e.g. 'items' for ships.json)

    Returns:
        dict mapping id -> item_dict. Empty dict if file doesn't exist.
    """
    if not os.path.exists(json_path):
        return {}

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}

    if items_key and isinstance(data, dict):
        data = data.get(items_key, [])

    if not isinstance(data, list):
        return {}

    return {item[id_field]: item for item in data if isinstance(item, dict) and id_field in item}


def compute_diff(old_items, new_items, label):
    """Compare two {id: item_dict} maps and return a diff report.

    Returns:
        dict with keys: label, old_count, new_count, added, removed, modified
    """
    old_ids = set(old_items.keys())
    new_ids = set(new_items.keys())

    added_ids = sorted(new_ids - old_ids)
    removed_ids = sorted(old_ids - new_ids)
    common_ids = old_ids & new_ids

    modified = []
    for item_id in sorted(common_ids):
        old_json = json.dumps(old_items[item_id], sort_keys=True)
        new_json = json.dumps(new_items[item_id], sort_keys=True)
        if old_json != new_json:
            changed_fields = _find_changed_fields(old_items[item_id], new_items[item_id])
            modified.append({'id': item_id, 'changed_fields': changed_fields,
                             'name_key': new_items[item_id].get('name_key') or new_items[item_id].get('name', '')})

    return {
        'label': label,
        'old_count': len(old_items),
        'new_count': len(new_items),
        'added': [{'id': i, 'name_key': new_items[i].get('name_key') or new_items[i].get('name', '')} for i in added_ids],
        'removed': [{'id': i, 'name_key': old_items[i].get('name_key') or old_items[i].get('name', '')} for i in removed_ids],
        'modified': modified,
    }


def _find_changed_fields(old_item, new_item):
    """Find which top-level keys differ between two items."""
    all_keys = set(old_item.keys()) | set(new_item.keys())
    changed = []
    for key in sorted(all_keys):
        old_val = old_item.get(key)
        new_val = new_item.get(key)
        if json.dumps(old_val, sort_keys=True) != json.dumps(new_val, sort_keys=True):
            changed.append(key)
    return changed


def collect_snapshots(assets_dir):
    """Load snapshots for all tracked JSON files before the update runs.

    Returns:
        dict: {label: {id: item_dict}} for each tracked file
    """
    snapshots = {}
    for module, files in TRACKED_FILES.items():
        for filename, id_field, items_key in files:
            label = filename.replace('.json', '')
            path = os.path.join(assets_dir, filename)
            snapshots[label] = load_snapshot(path, id_field, items_key)
    return snapshots


def compute_all_changes(snapshots, assets_dir):
    """After update, load new JSONs and compute diffs against snapshots.

    Returns:
        list of diff dicts (one per tracked file)
    """
    all_diffs = []
    for module, files in TRACKED_FILES.items():
        for filename, id_field, items_key in files:
            label = filename.replace('.json', '')
            path = os.path.join(assets_dir, filename)
            new_items = load_snapshot(path, id_field, items_key)
            old_items = snapshots.get(label, {})
            diff = compute_diff(old_items, new_items, label)
            all_diffs.append(diff)
    return all_diffs


def print_changes(all_diffs):
    """Print formatted change summary to console."""
    print("\n" + "=" * 60)
    print("CHANGES SUMMARY")
    print("=" * 60)

    any_changes = False
    for diff in all_diffs:
        n_add = len(diff['added'])
        n_rem = len(diff['removed'])
        n_mod = len(diff['modified'])
        old_c = diff['old_count']
        new_c = diff['new_count']
        label = diff['label']

        if n_add == 0 and n_rem == 0 and n_mod == 0:
            print(f"\n  {label + ':':<22} {old_c:>5} -> {new_c:<5}  (no changes)")
            continue

        any_changes = True
        parts = []
        if n_add: parts.append(f"+{n_add} new")
        if n_mod: parts.append(f"~{n_mod} modified")
        if n_rem: parts.append(f"-{n_rem} removed")
        print(f"\n  {label + ':':<22} {old_c:>5} -> {new_c:<5}  ({', '.join(parts)})")

        if diff['added']:
            print("    NEW:")
            for item in diff['added'][:10]:
                print(f"      + {item['id']}")
            if len(diff['added']) > 10:
                print(f"      ... and {len(diff['added']) - 10} more")

        if diff['modified']:
            print("    MODIFIED:")
            for item in diff['modified'][:10]:
                fields = ', '.join(item['changed_fields'][:5])
                print(f"      ~ {item['id']:<25} [{fields}]")
            if len(diff['modified']) > 10:
                print(f"      ... and {len(diff['modified']) - 10} more")

        if diff['removed']:
            print("    REMOVED:")
            for item in diff['removed'][:10]:
                print(f"      - {item['id']}")
            if len(diff['removed']) > 10:
                print(f"      ... and {len(diff['removed']) - 10} more")

    if not any_changes:
        print("\n  No changes detected in any tracked module.")

    return any_changes


def save_changes(all_diffs, output_path):
    """Write changes.json with full diff data, archiving previous report to history."""
    total_added = sum(len(d['added']) for d in all_diffs)
    total_removed = sum(len(d['removed']) for d in all_diffs)
    total_modified = sum(len(d['modified']) for d in all_diffs)
    modules_changed = sum(1 for d in all_diffs
                          if d['added'] or d['removed'] or d['modified'])
    modules_unchanged = len(all_diffs) - modules_changed

    # Archive previous changes.json to history before overwriting
    history_path = os.path.join(os.path.dirname(output_path), 'changes_history.json')
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                old_report = json.load(f)
            # Only archive if the old report had actual changes
            old_summary = old_report.get('summary', {})
            if (old_summary.get('total_added', 0) + old_summary.get('total_removed', 0)
                    + old_summary.get('total_modified', 0)) > 0:
                history = []
                if os.path.exists(history_path):
                    try:
                        with open(history_path, 'r', encoding='utf-8') as f:
                            history = json.load(f)
                    except (json.JSONDecodeError, OSError):
                        history = []
                history.insert(0, old_report)
                history = history[:50]  # Keep max 50 entries
                with open(history_path, 'w', encoding='utf-8') as f:
                    json.dump(history, f, indent=2, ensure_ascii=False)
                print(f"  Archived previous report to: {history_path} ({len(history)} entries)")
        except (json.JSONDecodeError, OSError):
            pass  # No valid old report to archive

    modules = {}
    for diff in all_diffs:
        modules[diff['label']] = {
            'old_count': diff['old_count'],
            'new_count': diff['new_count'],
            'added': diff['added'],
            'removed': diff['removed'],
            'modified': diff['modified'],
        }

    report = {
        'timestamp': datetime.now().isoformat(),
        'summary': {
            'total_added': total_added,
            'total_removed': total_removed,
            'total_modified': total_modified,
            'modules_changed': modules_changed,
            'modules_unchanged': modules_unchanged,
        },
        'modules': modules,
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved to: {output_path}")

    return report
