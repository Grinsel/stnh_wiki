"""
Megastructures & Relics JSON generator.
Orchestrates parse_megastructures + parse_relics -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_megastructures import parse_all_megastructures
from parse_relics import parse_all_relics


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate megastructures.json and relics.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/2] Parsing megastructures...")
    megas, m_stats = parse_all_megastructures()
    print(f"    {m_stats['items']} megastructures from {m_stats['files']} files ({m_stats['errors']} errors)")

    print("  [2/2] Parsing relics...")
    relics, r_stats = parse_all_relics()
    print(f"    {r_stats['items']} relics from {r_stats['files']} files ({r_stats['errors']} errors)")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'megastructures.json'), megas)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'relics.json'), relics)

    elapsed = time.time() - start
    print(f"  Megastructures module: {elapsed:.1f}s")

    return {
        'megastructures': m_stats['items'],
        'relics': r_stats['items'],
        'files': m_stats['files'] + r_stats['files'],
        'errors': m_stats['errors'] + r_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
