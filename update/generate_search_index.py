"""
Global search index generator for STNH Wiki.
Builds a unified search_index.json from all module JSON assets.
Each entry: { id, name_key, module, type, meta }
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR


# Module definitions: (json_file, module_name, type_name, meta_extractor)
MODULES = [
    ('events_index.json', 'events', 'event', lambda e: {
        'type': e.get('type', ''),
        'ns': e.get('ns', ''),
    }),
    ('ships.json', 'ships', 'ship', lambda e: {
        'class': e.get('class', ''),
    }),
    ('components.json', 'ships', 'component', lambda e: {
        'type': e.get('type', ''),
        'size': e.get('size', ''),
    }),
    ('buildings.json', 'buildings', 'building', lambda e: {
        'category': e.get('category', ''),
    }),
    ('districts.json', 'buildings', 'district', lambda e: {}),
    ('traits.json', 'empires', 'trait', lambda e: {
        'class': e.get('leader_class', ''),
    }),
    ('traditions.json', 'governments', 'tradition', lambda e: {
        'tree': e.get('tree', ''),
        'role': e.get('role', ''),
    }),
    ('ascension_perks.json', 'governments', 'ascension_perk', lambda e: {}),
    ('governments.json', 'governments', 'government', lambda e: {}),
    ('civics.json', 'governments', 'civic', lambda e: {
        'origin': e.get('is_origin', False),
    }),
    ('authorities.json', 'governments', 'authority', lambda e: {}),
    ('policies.json', 'governments', 'policy', lambda e: {}),
    ('edicts.json', 'governments', 'edict', lambda e: {}),
    ('councilors.json', 'governments', 'councilor', lambda e: {
        'civic': e.get('civic', ''),
    }),
    ('megastructures.json', 'megastructures', 'megastructure', lambda e: {
        'upgrade_from': e.get('upgrade_from', ''),
    }),
    ('relics.json', 'megastructures', 'relic', lambda e: {}),
    ('anomalies.json', 'anomalies', 'anomaly', lambda e: {
        'level': e.get('level'),
    }),
    ('archaeology.json', 'anomalies', 'archaeology', lambda e: {
        'stages': e.get('stages_count'),
    }),
    ('empires.json', 'empires', 'empire', lambda e: {
        'authority': e.get('authority', ''),
        'government': e.get('government', ''),
    }),
    # ('species.json', 'empires', 'species', lambda e: {
    #     'archetype': e.get('archetype', ''),
    # }),  # Species tab is hidden for now; re-enable when species UI returns.
    ('jobs.json', 'economy', 'job', lambda e: {
        'category': e.get('category', ''),
    }),
    ('deposits.json', 'economy', 'deposit', lambda e: {
        'category': e.get('category', ''),
    }),
    ('resources.json', 'economy', 'resource', lambda e: {
        'tradable': e.get('tradable', False),
        'source': e.get('source', ''),
    }),
    ('tech/technology_physics.json', 'tech', 'technology', lambda e: {
        'area': 'physics',
        'tier': e.get('tier', ''),
    }),
    ('tech/technology_engineering.json', 'tech', 'technology', lambda e: {
        'area': 'engineering',
        'tier': e.get('tier', ''),
    }),
    ('tech/technology_society.json', 'tech', 'technology', lambda e: {
        'area': 'society',
        'tier': e.get('tier', ''),
    }),
]

# Module -> page mapping for URLs. Matches the consolidated page layout:
# economy.html hosts buildings/districts/megastructures/jobs/deposits/relics,
# governments.html hosts governments/civics/authorities/policies/edicts/councilors/traditions/perks,
# exploration.html hosts anomalies/archaeology, and ships/traits/empires/tech
# keep their own pages. Kept in sync with WIKI_LINK_MAP in js/shared-render.js.
MODULE_PAGES = {
    'events': 'events.html',
    'ships': 'ships.html',
    'buildings': 'economy.html',
    'governments': 'governments.html',
    'megastructures': 'economy.html',
    'anomalies': 'exploration.html',
    'empires': 'empires.html',
    'economy': 'economy.html',
    'tech': 'tech.html',
}


def generate_search_index():
    """Build unified search index from all module JSON assets."""
    start = time.time()
    index = []
    stats = {}

    for json_file, module, item_type, meta_fn in MODULES:
        filepath = os.path.join(OUTPUT_ASSETS_DIR, json_file)
        if not os.path.exists(filepath):
            print(f"  [SKIP] {json_file} not found")
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            # Handle dict wrappers like ships.json {'items': [...], 'stats': {...}}
            if isinstance(data, dict) and 'items' in data:
                data = data['items']
            else:
                continue

        count = 0
        for item in data:
            entry = {
                'id': item.get('id', ''),
                'nk': item.get('name_key', item.get('name', item.get('id', ''))),
                'm': module,
                't': item_type,
            }

            # Add compact meta (remove empty values)
            meta = meta_fn(item)
            meta = {k: v for k, v in meta.items() if v}
            if meta:
                entry['x'] = meta

            # Add prerequisites for cross-module search
            prereqs = item.get('prerequisites', [])
            if prereqs:
                entry['p'] = prereqs

            # Add flags set by this item (for flag-based search)
            flags = item.get('set_flags', [])
            if flags:
                entry['f'] = flags

            # Icon stem (used by frontend to resolve icons/<category>/<stem>.webp).
            # Currently only components carry a GFX_-prefixed icon reference in
            # their JSON; other types store icons differently and aren't wired
            # up here yet.
            if item_type == 'component':
                ico = item.get('icon')
                if ico:
                    entry['i'] = ico[4:] if ico.startswith('GFX_') else ico

            index.append(entry)
            count += 1

        stats[item_type] = count
        # Simple pluralization
        label = item_type
        if label.endswith('y') and label not in ('authority',):
            label = label[:-1] + 'ies'
        elif label.endswith('s'):
            label = label + 'es'
        else:
            label = label + 's'
        print(f"    {count:>6} {label} from {json_file}")

    # Write index
    out_path = os.path.join(OUTPUT_ASSETS_DIR, 'search_index.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))

    # Write module pages mapping
    pages_path = os.path.join(OUTPUT_ASSETS_DIR, 'module_pages.json')
    with open(pages_path, 'w', encoding='utf-8') as f:
        json.dump(MODULE_PAGES, f, ensure_ascii=False, separators=(',', ':'))

    elapsed = time.time() - start
    total = len(index)
    size_kb = os.path.getsize(out_path) / 1024

    print(f"\n  Search index: {total} items, {size_kb:.0f} KB")
    print(f"  Written to: {out_path}")
    print(f"  Search index: {elapsed:.1f}s")

    return {
        'total_items': total,
        'size_kb': round(size_kb),
        'by_type': stats,
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    print("Generating search index...")
    stats = generate_search_index()
    print(f"\nDone: {stats['total_items']} items")
