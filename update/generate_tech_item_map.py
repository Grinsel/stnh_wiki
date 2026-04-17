"""
Tech-Item Map generator for STNH Wiki.
Builds bidirectional mapping between techs and content items.

Input:
  - assets/cross_references.json (tech_unlocks section)
  - assets/*.json (content module JSONs for name_key lookup)

Output: assets/tech_item_map.json
{
    "by_tech": {
        "tech_id": {
            "ships": [{"id":"...", "nk":"...", "p":"ships.html", "tab":"ships"}],
            ...
        }
    },
    "by_item": {
        "item_id": ["tech_id", ...]
    }
}
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR


# Module key -> (json_file, page_url, tab_name). Kept in sync with
# WIKI_LINK_MAP in js/shared-render.js and MODULE_PAGES in
# generate_search_index.py — legacy pages (buildings.html, megastructures.html,
# anomalies.html) were folded into the consolidated pages.
MODULE_CONFIG = {
    'ships':          ('ships.json',          'ships.html',       'ships'),
    'components':     ('components.json',     'ships.html',       'components'),
    'buildings':      ('buildings.json',      'economy.html',     'buildings'),
    'districts':      ('districts.json',      'economy.html',     'districts'),
    'traits':         ('traits.json',         'traits.html',      'traits'),
    'edicts':         ('edicts.json',         'governments.html', 'edicts'),
    'megastructures': ('megastructures.json', 'economy.html',     'megastructures'),
}


def _load_json(name):
    path = os.path.join(OUTPUT_ASSETS_DIR, name)
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict) and 'items' in data:
        return data['items']
    return data if isinstance(data, list) else []


def generate_tech_item_map():
    """Build tech <-> item bidirectional map."""
    start = time.time()

    # Load cross-references for tech_unlocks
    xref_path = os.path.join(OUTPUT_ASSETS_DIR, 'cross_references.json')
    if not os.path.exists(xref_path):
        print("  [SKIP] cross_references.json not found")
        return {'skipped': True}

    with open(xref_path, 'r', encoding='utf-8') as f:
        xref = json.load(f)

    tech_unlocks = xref.get('tech_unlocks', {})

    # Build name_key lookup for each module
    name_keys = {}  # item_id -> name_key
    for module_key, (json_file, _, _) in MODULE_CONFIG.items():
        items = _load_json(json_file)
        for item in items:
            item_id = item.get('id', '')
            nk = item.get('name_key', item.get('name', item_id))
            name_keys[item_id] = nk

    # Build by_tech: enrich cross-ref data with name_key, page, tab
    by_tech = {}
    for tech_id, unlocks in tech_unlocks.items():
        tech_entry = {}
        for module_key, item_ids in unlocks.items():
            if module_key not in MODULE_CONFIG:
                continue
            _, page, tab = MODULE_CONFIG[module_key]
            enriched = []
            for item_id in item_ids:
                enriched.append({
                    'id': item_id,
                    'nk': name_keys.get(item_id, item_id),
                    'p': page,
                    'tab': tab,
                })
            if enriched:
                tech_entry[module_key] = enriched
        if tech_entry:
            by_tech[tech_id] = tech_entry

    # Build by_item: inverse mapping
    by_item = {}
    for tech_id, modules in by_tech.items():
        for module_key, items in modules.items():
            for item in items:
                item_id = item['id']
                if item_id not in by_item:
                    by_item[item_id] = []
                if tech_id not in by_item[item_id]:
                    by_item[item_id].append(tech_id)

    # Write output
    result = {
        'by_tech': by_tech,
        'by_item': by_item,
    }

    out_path = os.path.join(OUTPUT_ASSETS_DIR, 'tech_item_map.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))

    elapsed = time.time() - start
    size_kb = os.path.getsize(out_path) / 1024

    print(f"\n  Tech-Item Map: {len(by_tech)} techs, {len(by_item)} items, {size_kb:.0f} KB")
    print(f"  Written to: {out_path}")
    print(f"  Tech-Item Map: {elapsed:.1f}s")

    return {
        'techs': len(by_tech),
        'items': len(by_item),
        'size_kb': round(size_kb),
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    print("Generating tech-item map...")
    stats = generate_tech_item_map()
    print(f"\nDone: {stats}")
