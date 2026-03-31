"""
Ships & Components JSON generator.
Orchestrates parse_ships + parse_components -> JSON output.
Also generates ship_models_map.json for the 3D model pipeline.
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
    """Generate ships.json, components.json, and ship_models_map.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/3] Parsing ship sizes...")
    ships, s_stats = parse_all_ships()
    print(f"    {s_stats['items']} ships from {s_stats['files']} files ({s_stats['errors']} errors)")

    print("  [2/3] Parsing component templates...")
    components, c_stats = parse_all_components()
    print(f"    {c_stats['items']} components from {c_stats['files']} files ({c_stats['errors']} errors)")

    print("  [3/3] Building ship models map...")
    from parse_ship_models import parse_all as parse_all_models
    model_map, m_stats = parse_all_models()

    # Enrich ships with model info
    model_map_lookup = model_map  # ship_id -> { faction -> { entity, mesh_file, ... } }
    for ship in ships:
        factions = model_map_lookup.get(ship['id'])
        if factions:
            ship['has_model'] = True
            faction_list = sorted(factions.keys())
            ship['model_factions'] = faction_list
            ship['default_model'] = f"{faction_list[0]}/{ship['id']}"
        else:
            ship['has_model'] = False

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'ships.json'), ships)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'components.json'), components)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'ship_models_map.json'), model_map)

    elapsed = time.time() - start
    print(f"  Ships module: {elapsed:.1f}s")

    return {
        'ships': s_stats['items'],
        'components': c_stats['items'],
        'ships_with_models': m_stats.get('ships_with_models', 0),
        'model_variants': m_stats.get('total_variants', 0),
        'files': s_stats['files'] + c_stats['files'],
        'errors': s_stats['errors'] + c_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
