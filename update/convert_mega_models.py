"""
Megastructure model converter: reads mega_models_map.json, converts each to GLB.
Reuses convert_ship_to_glb() from convert_ship_models.py.

Output structure:
  models/megastructures/{mega_id}/{faction_or_generic}.glb
"""

import os
import json
import time

from config import STNH_MOD_ROOT, OUTPUT_MEGA_MODELS_DIR, OUTPUT_ASSETS_DIR
from convert_ship_models import (
    convert_ship_to_glb, _load_manifest, _save_manifest,
    _is_up_to_date, _info_signature, _bootstrap_manifest,
)


def convert_all(skip_existing=True):
    """Convert all megastructure models from mega_models_map.json to GLB.

    Returns stats dict.
    """
    start = time.time()
    map_path = os.path.join(OUTPUT_ASSETS_DIR, 'mega_models_map.json')
    if not os.path.isfile(map_path):
        print("  [ERROR] mega_models_map.json not found. Run generate_megastructures_json.py first.")
        return {'converted': 0, 'skipped': 0, 'failed': 0, 'elapsed': 0}

    with open(map_path, 'r', encoding='utf-8') as f:
        mega_models_map = json.load(f)

    manifest = _load_manifest('mega_model_manifest.json')
    _bootstrap_manifest(
        manifest, mega_models_map,
        lambda mid, fac: os.path.join(OUTPUT_MEGA_MODELS_DIR, mid, f"{fac}.glb"),
    )

    converted = 0
    skipped = 0
    failed = 0
    multi_mesh = 0
    total = sum(len(factions) for factions in mega_models_map.values())

    print(f"  Converting {total} megastructure model variants to GLB...")

    for mega_id, factions in mega_models_map.items():
        for faction, info in factions.items():
            output_path = os.path.join(OUTPUT_MEGA_MODELS_DIR, mega_id, f"{faction}.glb")

            if skip_existing and _is_up_to_date(output_path, info, manifest):
                skipped += 1
                continue

            attachments = info.get('attachments')
            success = convert_ship_to_glb(
                mesh_file_path=info['mesh_file'],
                model_scale=info.get('scale', 1.0),
                output_path=output_path,
                attachments=attachments,
                root_dir=STNH_MOD_ROOT,
            )

            if success:
                converted += 1
                if attachments:
                    multi_mesh += 1
                manifest[output_path] = {
                    'sig': _info_signature(info),
                    'mtime': os.path.getmtime(output_path),
                }
            else:
                failed += 1

    _save_manifest('mega_model_manifest.json', manifest)

    elapsed = time.time() - start
    stats = {
        'converted': converted,
        'skipped': skipped,
        'failed': failed,
        'multi_mesh': multi_mesh,
        'total': total,
        'elapsed': round(elapsed, 1),
    }
    print(f"  Converted: {converted} ({multi_mesh} multi-mesh), Skipped: {skipped}, Failed: {failed} ({elapsed:.1f}s)")
    return stats


if __name__ == '__main__':
    stats = convert_all()
    print(f"\nDone: {json.dumps(stats, indent=2)}")
