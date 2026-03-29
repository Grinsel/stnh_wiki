"""
Ships & Components JSON generator.
Orchestrates parse_ships + parse_components -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_ships import parse_all_ships
from parse_components import parse_all_components


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate ships.json and components.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/2] Parsing ship sizes...")
    ships, s_stats = parse_all_ships()
    print(f"    {s_stats['items']} ships from {s_stats['files']} files ({s_stats['errors']} errors)")

    print("  [2/2] Parsing component templates...")
    components, c_stats = parse_all_components()
    print(f"    {c_stats['items']} components from {c_stats['files']} files ({c_stats['errors']} errors)")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'ships.json'), ships)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'components.json'), components)

    elapsed = time.time() - start
    print(f"  Ships module: {elapsed:.1f}s")

    return {
        'ships': s_stats['items'],
        'components': c_stats['items'],
        'files': s_stats['files'] + c_stats['files'],
        'errors': s_stats['errors'] + c_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
