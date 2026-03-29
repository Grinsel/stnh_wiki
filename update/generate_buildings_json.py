"""
Buildings & Districts JSON generator.
Orchestrates parse_buildings + parse_districts -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_buildings import parse_all_buildings
from parse_districts import parse_all_districts


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate buildings.json and districts.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/2] Parsing buildings...")
    buildings, b_stats = parse_all_buildings()
    print(f"    {b_stats['items']} buildings from {b_stats['files']} files ({b_stats['errors']} errors)")

    print("  [2/2] Parsing districts...")
    districts, d_stats = parse_all_districts()
    print(f"    {d_stats['items']} districts from {d_stats['files']} files ({d_stats['errors']} errors)")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'buildings.json'), buildings)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'districts.json'), districts)

    elapsed = time.time() - start
    print(f"  Buildings module: {elapsed:.1f}s")

    return {
        'buildings': b_stats['items'],
        'districts': d_stats['items'],
        'files': b_stats['files'] + d_stats['files'],
        'errors': b_stats['errors'] + d_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
