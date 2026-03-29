"""
Empires & Species JSON generator.
Orchestrates parse_empires + parse_species -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_empires import parse_all_empires
from parse_species import parse_all_species


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate empires.json and species.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/2] Parsing prescripted empires...")
    empires, e_stats = parse_all_empires()
    print(f"    {e_stats['items']} empires from {e_stats['files']} files ({e_stats['errors']} errors)")

    print("  [2/2] Parsing species classes...")
    species, s_stats = parse_all_species()
    print(f"    {s_stats['items']} species classes from {s_stats['files']} files ({s_stats['errors']} errors)")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'empires.json'), empires)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'species.json'), species)

    elapsed = time.time() - start
    print(f"  Empires module: {elapsed:.1f}s")

    return {
        'empires': e_stats['items'],
        'species': s_stats['items'],
        'files': e_stats['files'] + s_stats['files'],
        'errors': e_stats['errors'] + s_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
