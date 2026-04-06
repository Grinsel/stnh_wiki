"""
Megastructures & Relics JSON generator.
Orchestrates parse_megastructures + parse_relics + parse_mega_models -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_megastructures import parse_all_megastructures
from parse_relics import parse_all_relics
from parse_mega_models import build_mega_models_map
from config import MOD_SHIP_MODELS_DIR, STNH_MOD_ROOT


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate megastructures.json, relics.json, and mega_models_map.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/3] Parsing megastructures...")
    megas, m_stats = parse_all_megastructures()
    print(f"    {m_stats['items']} megastructures from {m_stats['files']} files ({m_stats['errors']} errors)")

    print("  [2/3] Parsing relics...")
    relics, r_stats = parse_all_relics()
    print(f"    {r_stats['items']} relics from {r_stats['files']} files ({r_stats['errors']} errors)")

    print("  [3/3] Resolving megastructure 3D models...")
    mega_models_map, model_stats = build_mega_models_map(megas, MOD_SHIP_MODELS_DIR, STNH_MOD_ROOT)

    # Enrich megastructures with model info
    for mega in megas:
        mega_id = mega['id']
        if mega_id in mega_models_map:
            factions = sorted(mega_models_map[mega_id].keys())
            mega['has_model'] = True
            mega['model_factions'] = factions
        else:
            mega['has_model'] = False
            mega['model_factions'] = []

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'megastructures.json'), megas)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'relics.json'), relics)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'mega_models_map.json'), mega_models_map)

    elapsed = time.time() - start
    print(f"  Megastructures module: {elapsed:.1f}s")

    return {
        'megastructures': m_stats['items'],
        'relics': r_stats['items'],
        'megas_with_models': model_stats['megas_with_models'],
        'mega_model_variants': model_stats['total_variants'],
        'files': m_stats['files'] + r_stats['files'],
        'errors': m_stats['errors'] + r_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
