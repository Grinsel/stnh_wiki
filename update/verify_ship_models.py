"""
Model consistency checker (read-only, warn-only, never fatal).

Cross-checks the generated ship/mega JSON assets against the GLB files on disk:
  - Ship GLBs: models/{faction}/{ship_id}.glb for every has_model ship x faction
  - Mega GLBs: models/megastructures/{mega_id}/{faction}.glb for every mega variant

Missing files are reported as [WARN] (something the matcher/converter should have
produced). Orphan files on disk are reported as [INFO] (harmless leftovers). The
checker never raises and never changes the pipeline exit code.
"""

import os
import json

from config import OUTPUT_ASSETS_DIR, OUTPUT_MODELS_DIR, OUTPUT_MEGA_MODELS_DIR

# Cap for printed detail lists so a large mismatch does not flood the log.
_LIST_CAP = 20


def _print_capped(entries, prefix):
    """Print up to _LIST_CAP entries with a given per-line prefix, then a summary."""
    for entry in entries[:_LIST_CAP]:
        print(f"{prefix}{entry}")
    if len(entries) > _LIST_CAP:
        print(f"    ... and {len(entries) - _LIST_CAP} more")


def _load_ships():
    """Return the list of ship dicts from ships.json, or None if unavailable."""
    path = os.path.join(OUTPUT_ASSETS_DIR, 'ships.json')
    if not os.path.isfile(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict):
        # ships.json is a dict; the ship list lives under a 'ships' key (fall
        # back to the first list-valued entry).
        if isinstance(data.get('ships'), list):
            return data['ships']
        for value in data.values():
            if isinstance(value, list):
                return value
        return []
    return data


def verify_models():
    """Verify referenced ship/mega GLBs exist on disk. Warn-only.

    Returns a stats dict (see keys built at the end). On a missing ships.json,
    returns {'skipped': True}.
    """
    ships = _load_ships()
    if ships is None:
        print("[WARN] ships.json not found")
        return {'skipped': True}

    # ---------------------------------------------------------------------
    # Ship GLBs
    # ---------------------------------------------------------------------
    expected_ship_paths = set()
    ships_without_model = 0

    for ship in ships:
        if not ship.get('has_model'):
            ships_without_model += 1
            continue
        ship_id = ship.get('id')
        for faction in (ship.get('model_factions') or []):
            expected_ship_paths.add(
                os.path.join(OUTPUT_MODELS_DIR, faction, f"{ship_id}.glb")
            )

    ship_missing = sorted(
        p for p in expected_ship_paths if not os.path.isfile(p)
    )

    # Orphan ship GLBs: everything under models/*/ except the megastructures
    # subtree, that is not in the expected set.
    on_disk_ship_paths = set()
    if os.path.isdir(OUTPUT_MODELS_DIR):
        mega_dir_abs = os.path.abspath(OUTPUT_MEGA_MODELS_DIR)
        for faction_name in os.listdir(OUTPUT_MODELS_DIR):
            faction_dir = os.path.join(OUTPUT_MODELS_DIR, faction_name)
            if not os.path.isdir(faction_dir):
                continue
            if os.path.abspath(faction_dir) == mega_dir_abs:
                continue  # skip the megastructures subtree
            for fname in os.listdir(faction_dir):
                if fname.endswith('.glb'):
                    on_disk_ship_paths.add(os.path.join(faction_dir, fname))

    ship_orphans = sorted(on_disk_ship_paths - expected_ship_paths)

    # ---------------------------------------------------------------------
    # Mega GLBs
    # ---------------------------------------------------------------------
    expected_mega_paths = set()
    mega_map_path = os.path.join(OUTPUT_ASSETS_DIR, 'mega_models_map.json')
    if os.path.isfile(mega_map_path):
        with open(mega_map_path, 'r', encoding='utf-8') as f:
            mega_map = json.load(f)
        for mega_id, factions in mega_map.items():
            for faction in factions:
                expected_mega_paths.add(
                    os.path.join(OUTPUT_MEGA_MODELS_DIR, mega_id, f"{faction}.glb")
                )
    else:
        print("[INFO] mega_models_map.json not found, skipping mega cross-check")

    mega_missing = sorted(
        p for p in expected_mega_paths if not os.path.isfile(p)
    )

    on_disk_mega_paths = set()
    if os.path.isdir(OUTPUT_MEGA_MODELS_DIR):
        for mega_id in os.listdir(OUTPUT_MEGA_MODELS_DIR):
            mega_subdir = os.path.join(OUTPUT_MEGA_MODELS_DIR, mega_id)
            if not os.path.isdir(mega_subdir):
                continue
            for fname in os.listdir(mega_subdir):
                if fname.endswith('.glb'):
                    on_disk_mega_paths.add(os.path.join(mega_subdir, fname))

    mega_orphans = sorted(on_disk_mega_paths - expected_mega_paths)

    # ---------------------------------------------------------------------
    # Report
    # ---------------------------------------------------------------------
    print(f"  Ship GLBs: {len(expected_ship_paths) - len(ship_missing)}/{len(expected_ship_paths)} present")
    if ship_missing:
        print(f"  [WARN] {len(ship_missing)} referenced ship GLB(s) missing:")
        _print_capped([os.path.relpath(p, OUTPUT_MODELS_DIR) for p in ship_missing], "    - ")
    if ship_orphans:
        print(f"  [INFO] {len(ship_orphans)} orphan ship GLB(s) on disk (harmless):")
        _print_capped([os.path.relpath(p, OUTPUT_MODELS_DIR) for p in ship_orphans], "    - ")

    print(f"  Mega GLBs: {len(expected_mega_paths) - len(mega_missing)}/{len(expected_mega_paths)} present")
    if mega_missing:
        print(f"  [WARN] {len(mega_missing)} referenced mega GLB(s) missing:")
        _print_capped([os.path.relpath(p, OUTPUT_MEGA_MODELS_DIR) for p in mega_missing], "    - ")
    if mega_orphans:
        print(f"  [INFO] {len(mega_orphans)} orphan mega GLB(s) on disk (harmless):")
        _print_capped([os.path.relpath(p, OUTPUT_MEGA_MODELS_DIR) for p in mega_orphans], "    - ")

    print(f"  [INFO] {ships_without_model} ship(s) have has_model == false (matcher misses indicator)")

    ok = not ship_missing and not mega_missing
    if ok:
        print("[OK] All referenced GLBs present")

    return {
        'ship_expected': len(expected_ship_paths),
        'ship_missing': len(ship_missing),
        'ship_missing_list': [os.path.relpath(p, OUTPUT_MODELS_DIR) for p in ship_missing[:_LIST_CAP]],
        'ship_orphan': len(ship_orphans),
        'mega_expected': len(expected_mega_paths),
        'mega_missing': len(mega_missing),
        'mega_missing_list': [os.path.relpath(p, OUTPUT_MEGA_MODELS_DIR) for p in mega_missing[:_LIST_CAP]],
        'mega_orphan': len(mega_orphans),
        'ships_without_model': ships_without_model,
        'ok': ok,
    }


if __name__ == '__main__':
    stats = verify_models()
    print(f"\n{json.dumps(stats, indent=2)}")
