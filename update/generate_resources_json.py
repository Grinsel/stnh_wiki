"""
Resources module JSON generator.
Writes resources.json (definitions) and resource_producers.json (index).

Depends on the producer-side module JSONs already being on disk in
OUTPUT_ASSETS_DIR (buildings, jobs, deposits, megastructures, relics,
edicts, traditions, ascension_perks, governments, civics, authorities,
districts). Run this phase AFTER all of those.
"""

import json
import os
import time

from config import OUTPUT_ASSETS_DIR
from parse_resources import parse_all_resources
from generate_resource_index import build_resource_index


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    start = time.time()

    print("\n  [1/2] Parsing strategic resources...")
    resources, r_stats = parse_all_resources()
    print(f"    {r_stats['items']} resources "
          f"(vanilla={r_stats['vanilla']}, stnh-new={r_stats['stnh']}, "
          f"mod-overrides={r_stats['overrides']}, errors={r_stats['errors']})")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'resources.json'), resources)

    print("  [2/2] Building producer/modifier index...")
    index = build_resource_index(resources, OUTPUT_ASSETS_DIR)
    s = index['stats']
    print(f"    {s['producer_links']} producer links, "
          f"{s['modifier_links']} modifier links "
          f"({s['unparsed_modifiers']} unparsed) from {s['modules_loaded']} modules")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'resource_producers.json'), index)

    elapsed = time.time() - start
    print(f"  Resources module: {elapsed:.1f}s")

    return {
        'resources': r_stats['items'],
        'producer_links': s['producer_links'],
        'modifier_links': s['modifier_links'],
        'unparsed_modifiers': s['unparsed_modifiers'],
        'errors': r_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
