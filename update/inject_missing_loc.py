"""
Phase 2c: Inject missing localisation keys from loc_audit results.
Reads missing_loc.json and adds resolved values to {lang}.json files.
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / 'data'
LOC_DIR = Path(__file__).parent.parent / 'assets' / 'localisation'
MISSING_LOC_FILE = DATA_DIR / 'missing_loc.json'

LANGUAGES = ['english', 'german', 'french', 'spanish', 'russian', 'polish', 'braz_por']


def load_missing_keys():
    """Load resolved keys from loc_audit output."""
    with open(MISSING_LOC_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    inject = {}  # key -> resolved_value

    # Modifier keys (MODIFIER_MAP + pattern): all have resolved values
    for entry in data.get('modifiers_modifier_map', []):
        inject[entry['key']] = entry['resolved']
        inject[f"mod_{entry['key']}"] = entry['resolved']

    for entry in data.get('modifiers_pattern', []):
        inject[entry['key']] = entry['resolved']
        inject[f"mod_{entry['key']}"] = entry['resolved']

    # Content names: have resolved values
    for entry in data.get('content_names', []):
        if entry.get('resolved'):
            inject[entry['key']] = entry['resolved']

    # Content descs: no resolved values (need manual text)
    # -> Don't inject, frontend shows nothing instead of wrong text

    return inject


def inject_into_localisation():
    """Inject missing keys into all language JSON files."""
    if not MISSING_LOC_FILE.exists():
        print("  [SKIP] No missing_loc.json found — run loc_audit first")
        return {'skipped': True}

    inject = load_missing_keys()
    if not inject:
        print("  [SKIP] No injectable keys found")
        return {'skipped': True, 'reason': 'no_keys'}

    stats = {}
    for lang in LANGUAGES:
        loc_path = LOC_DIR / f'{lang}.json'
        if not loc_path.exists():
            continue

        with open(loc_path, 'r', encoding='utf-8') as f:
            loc_data = json.load(f)

        added = 0
        for key, value in inject.items():
            if key not in loc_data:
                loc_data[key] = value
                added += 1

        with open(loc_path, 'w', encoding='utf-8') as f:
            json.dump(loc_data, f, ensure_ascii=False)

        stats[lang] = added

    total = sum(stats.values())
    print(f"  Injected {total} keys across {len(stats)} languages")
    for lang, count in stats.items():
        if count:
            print(f"    {lang}: +{count}")

    return stats


def main():
    print("=== Injecting Missing Localisation Keys ===")
    return inject_into_localisation()


if __name__ == '__main__':
    main()
