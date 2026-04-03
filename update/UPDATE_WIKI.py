"""
=============================================================================
STNH WIKI - FULL UPDATE SCRIPT
=============================================================================

Complete automation of the wiki data regeneration process.
Run this script whenever the STNH mod is updated.

PREREQUISITES:
- Python 3.8+
- STNH mod at: C:\\Users\\marcj\\git01\\New-Horizons-Development

USAGE:
    python UPDATE_WIKI.py
    python UPDATE_WIKI.py --skip-images

PHASES:
    1. Validation    - Check paths and dependencies
    2. Localisation  - Parse all 7 languages
    3. GFX Mapping   - Parse sprite definitions
    4. Events        - Parse all event files (stub)
    5. Content       - Parse content modules (stub)
    6. Images        - Convert DDS to WebP (stub)
    7. Summary       - Statistics and summary
=============================================================================
"""

import sys
import os
import time
import json
import argparse
from pathlib import Path
from datetime import datetime

# Add update directory to path
UPDATE_DIR = Path(__file__).parent
sys.path.insert(0, str(UPDATE_DIR))

ASSETS_DIR = os.path.join(UPDATE_DIR.parent, 'assets')


def print_banner():
    print("""
=============================================================================
    _____ _____ _   _ _   _  __        __  _   _  _  _
   /  ___|_   _| \\ | | | | | \\ \\      / / (_) | |(_)(_)
   \\ `--. | | |  \\| | |_| |  \\ \\ /\\ / /   _  | | _  _
    `--. \\ | | | . ` |  _  |   \\ V  V /   | | | || || |
   /\\__/ / | | | |\\  | | | |    \\_/\\_/    |_| |_||_||_|
   \\____/  \\_/ \\_| \\_\\_| |_|

              WIKI UPDATE SCRIPT v1.0
=============================================================================
    """)


def phase_validation():
    """Phase 1: Validate environment."""
    print("=" * 60)
    print("PHASE 1: VALIDATION")
    print("=" * 60)

    from config import validate_paths, print_config
    try:
        validate_paths()
        print_config()
        return True
    except FileNotFoundError as e:
        print(f"\n[ERROR] {e}")
        return False


def phase_localisation():
    """Phase 2: Parse localisation."""
    print("\n" + "=" * 60)
    print("PHASE 2: LOCALISATION")
    print("=" * 60)

    from parse_localisation import main as loc_main
    loc_data, stats = loc_main()
    return stats


def phase_gfx():
    """Phase 3: Parse GFX mappings."""
    print("\n" + "=" * 60)
    print("PHASE 3: GFX MAPPINGS")
    print("=" * 60)

    from parse_gfx_mappings import main as gfx_main
    return gfx_main()


def phase_events():
    """Phase 4: Parse events and generate all event JSON assets."""
    print("\n" + "=" * 60)
    print("PHASE 4: EVENTS")
    print("=" * 60)

    from generate_events_json import generate_all
    stats = generate_all()
    return stats


def phase_ships():
    """Phase: Ships & Components."""
    print("\n" + "=" * 60)
    print("PHASE: SHIPS & COMPONENTS")
    print("=" * 60)

    from generate_ships_json import generate_all
    return generate_all()


def phase_buildings():
    """Phase: Buildings & Districts."""
    print("\n" + "=" * 60)
    print("PHASE: BUILDINGS & DISTRICTS")
    print("=" * 60)

    from generate_buildings_json import generate_all
    return generate_all()


def phase_traits():
    """Phase: Traits, Traditions & Ascension Perks."""
    print("\n" + "=" * 60)
    print("PHASE: TRAITS, TRADITIONS & ASCENSION PERKS")
    print("=" * 60)

    from generate_traits_json import generate_all
    return generate_all()


def phase_governments():
    """Phase: Governments, Civics, Authorities, Policies & Edicts."""
    print("\n" + "=" * 60)
    print("PHASE: GOVERNMENTS & POLICIES")
    print("=" * 60)

    from generate_governments_json import generate_all
    return generate_all()


def phase_megastructures():
    """Phase: Megastructures & Relics."""
    print("\n" + "=" * 60)
    print("PHASE: MEGASTRUCTURES & RELICS")
    print("=" * 60)

    from generate_megastructures_json import generate_all
    return generate_all()


def phase_anomalies():
    """Phase: Anomalies & Archaeology."""
    print("\n" + "=" * 60)
    print("PHASE: ANOMALIES & ARCHAEOLOGY")
    print("=" * 60)

    from generate_anomalies_json import generate_all
    return generate_all()


def phase_empires():
    """Phase: Empires & Species."""
    print("\n" + "=" * 60)
    print("PHASE: EMPIRES & SPECIES")
    print("=" * 60)

    from generate_empires_json import generate_all
    return generate_all()


def phase_galaxy_map():
    """Phase: Galaxy Map JSON + Flag Images."""
    print("\n" + "=" * 60)
    print("PHASE: GALAXY MAP")
    print("=" * 60)

    from generate_galaxy_map_json import generate_galaxy_map
    return generate_galaxy_map()


def phase_economy():
    """Phase: Economy (Jobs & Deposits)."""
    print("\n" + "=" * 60)
    print("PHASE: ECONOMY (JOBS & DEPOSITS)")
    print("=" * 60)

    from generate_economy_json import generate_all
    return generate_all()


def phase_content():
    """Phase 5: Run all content modules."""
    print("\n" + "=" * 60)
    print("PHASE 5: CONTENT MODULES")
    print("=" * 60)

    results = {}
    results['ships'] = phase_ships()
    results['buildings'] = phase_buildings()
    results['traits'] = phase_traits()
    results['governments'] = phase_governments()
    results['megastructures'] = phase_megastructures()
    results['anomalies'] = phase_anomalies()
    results['empires'] = phase_empires()
    results['galaxy_map'] = phase_galaxy_map()
    results['economy'] = phase_economy()
    return results


def phase_search():
    """Phase: Search Index & Cross-References & Tech-Item Map."""
    print("\n" + "=" * 60)
    print("PHASE: SEARCH INDEX & CROSS-REFERENCES")
    print("=" * 60)

    from generate_search_index import generate_search_index
    from generate_cross_references import generate_cross_references
    from generate_tech_item_map import generate_tech_item_map

    search_stats = generate_search_index()
    xref_stats = generate_cross_references()
    tech_map_stats = generate_tech_item_map()

    return {
        'search_index': search_stats,
        'cross_references': xref_stats,
        'tech_item_map': tech_map_stats,
    }


def phase_techtree():
    """Phase: Techtree update - runs UPDATE_TECHTREE_FULL.py as subprocess."""
    print("\n" + "=" * 60)
    print("PHASE: TECHTREE")
    print("=" * 60)

    import subprocess

    techtree_script = os.path.join(UPDATE_DIR, 'techtree', 'UPDATE_TECHTREE_FULL.py')
    tech_json_dir = os.path.join(UPDATE_DIR.parent, 'assets', 'tech')

    if not os.path.exists(techtree_script):
        print(f"  [WARN] Techtree script not found: {techtree_script}")
        print("  [INFO] Using existing tech JSONs (fallback)")
        return {'skipped': True, 'fallback': True}

    try:
        print(f"  Running: {techtree_script}")
        result = subprocess.run(
            [sys.executable, techtree_script],
            cwd=os.path.join(UPDATE_DIR, 'techtree'),
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode != 0:
            print(f"  [WARN] Techtree script exited with code {result.returncode}")
            if result.stderr:
                for line in result.stderr.strip().split('\n')[-5:]:
                    print(f"    {line}")
            print("  [INFO] Using existing tech JSONs (fallback)")
            return {'skipped': False, 'fallback': True, 'returncode': result.returncode}

        # Print last few lines of output
        if result.stdout:
            for line in result.stdout.strip().split('\n')[-5:]:
                print(f"    {line}")

        # Verify output exists
        expected = ['technology_physics.json', 'technology_engineering.json', 'technology_society.json']
        found = sum(1 for f in expected if os.path.exists(os.path.join(tech_json_dir, f)))
        print(f"  Tech JSONs: {found}/{len(expected)} present")

        return {'skipped': False, 'fallback': False, 'tech_jsons': found}

    except subprocess.TimeoutExpired:
        print("  [WARN] Techtree script timed out (300s)")
        print("  [INFO] Using existing tech JSONs (fallback)")
        return {'skipped': False, 'fallback': True, 'timeout': True}
    except Exception as e:
        print(f"  [WARN] Techtree script failed: {e}")
        print("  [INFO] Using existing tech JSONs (fallback)")
        return {'skipped': False, 'fallback': True, 'error': str(e)}


def phase_images(skip=False):
    """Phase 6: Convert DDS event pictures to WebP."""
    print("\n" + "=" * 60)
    print("PHASE 6: IMAGE CONVERSION")
    print("=" * 60)

    if skip:
        print("  [SKIPPED] --skip-images flag set")
        return {'skipped': True}

    from convert_images import convert_images
    stats = convert_images()
    return stats


def phase_ship_models(skip=False):
    """Phase: Convert ship models to GLB."""
    print("\n" + "=" * 60)
    print("PHASE: SHIP MODELS (GLB)")
    print("=" * 60)

    if skip:
        print("  [SKIPPED] --skip-images flag set")
        return {'skipped': True}

    from convert_ship_models import convert_all
    stats = convert_all()
    return stats


def phase_building_icons(skip=False):
    """Phase: Convert DDS building icons to WebP."""
    print("\n" + "=" * 60)
    print("PHASE: BUILDING ICONS")
    print("=" * 60)

    if skip:
        print("  [SKIPPED] --skip-images flag set")
        return {'skipped': True}

    from convert_building_icons import convert_building_icons
    stats = convert_building_icons()
    print(f"  Converted: {stats['converted']}, Skipped: {stats['skipped']}, Failed: {stats['failed']}")
    return stats


def write_log_entry(module, results, elapsed):
    """Write or merge a log entry into last_update.json.

    For the 'full' module, overwrites the entire file.
    For other modules, merges into the existing file.
    """
    log_path = os.path.join(UPDATE_DIR.parent, 'assets', 'last_update.json')

    entry = {
        'timestamp': datetime.now().isoformat(),
        'elapsed_seconds': round(elapsed, 1),
        'results': {k: v for k, v in results.items() if isinstance(v, dict)},
    }

    if module == 'full':
        log_data = entry
    else:
        # Merge into existing log
        try:
            with open(log_path, 'r') as f:
                log_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            log_data = {}

        if 'modules' not in log_data:
            log_data['modules'] = {}
        log_data['modules'][module] = entry

    with open(log_path, 'w') as f:
        json.dump(log_data, f, indent=2, default=str)
    print(f"  Log written to: {log_path}")


# Maps --only values to the phases they run
ONLY_MODULES = {
    'events':      ['localisation', 'gfx', 'events', 'images'],
    'loc':         ['localisation'],
    'gfx':         ['gfx'],
    'images':      ['images'],
    'building_icons': ['building_icons'],
    'techtree':    ['techtree'],
    'ships':       ['localisation', 'ships'],
    'ship_models': ['localisation', 'ships', 'ship_models'],
    'buildings':   ['localisation', 'buildings', 'building_icons'],
    'traits':      ['localisation', 'traits'],
    'governments': ['localisation', 'governments'],
    'megastructures': ['localisation', 'megastructures'],
    'anomalies':      ['localisation', 'anomalies'],
    'empires':        ['localisation', 'empires'],
    'galaxy_map':     ['galaxy_map'],
    'economy':        ['localisation', 'economy'],
    'search':         ['search'],
    'content':        ['localisation', 'ships', 'buildings', 'building_icons', 'traits', 'governments',
                       'megastructures', 'anomalies', 'empires', 'galaxy_map', 'economy', 'search'],
}


def main():
    print_banner()
    start_time = time.time()

    parser = argparse.ArgumentParser(description='STNH Wiki - Full Update')
    parser.add_argument('--skip-images', action='store_true',
                        help='Skip DDS to WebP image conversion')
    parser.add_argument('--only', choices=list(ONLY_MODULES.keys()),
                        help='Run only a specific module')
    args = parser.parse_args()

    # Phase 1
    if not phase_validation():
        print("\n[ABORT] Validation failed.")
        return 1

    results = {}
    results['validation'] = 'OK'

    # Collect snapshots of all tracked JSONs before update
    from diff_tracker import collect_snapshots, compute_all_changes, print_changes, save_changes
    snapshots = collect_snapshots(ASSETS_DIR)

    if args.only:
        # Selective mode: run only specified phases
        phases = ONLY_MODULES[args.only]
        if 'localisation' in phases:
            results['localisation'] = phase_localisation()
        if 'gfx' in phases:
            results['gfx'] = phase_gfx()
        if 'events' in phases:
            results['events'] = phase_events()
        if 'ships' in phases:
            results['ships'] = phase_ships()
        if 'buildings' in phases:
            results['buildings'] = phase_buildings()
        if 'traits' in phases:
            results['traits'] = phase_traits()
        if 'governments' in phases:
            results['governments'] = phase_governments()
        if 'megastructures' in phases:
            results['megastructures'] = phase_megastructures()
        if 'anomalies' in phases:
            results['anomalies'] = phase_anomalies()
        if 'empires' in phases:
            results['empires'] = phase_empires()
        if 'galaxy_map' in phases:
            results['galaxy_map'] = phase_galaxy_map()
        if 'economy' in phases:
            results['economy'] = phase_economy()
        if 'search' in phases:
            results['search'] = phase_search()
        if 'ship_models' in phases:
            results['ship_models'] = phase_ship_models(skip=args.skip_images)
        if 'images' in phases:
            results['images'] = phase_images(skip=args.skip_images)
        if 'building_icons' in phases:
            results['building_icons'] = phase_building_icons(skip=args.skip_images)
        if 'techtree' in phases:
            results['techtree'] = phase_techtree()
        module_name = args.only
    else:
        # Full mode: run all phases
        results['localisation'] = phase_localisation()
        results['gfx'] = phase_gfx()
        results['events'] = phase_events()
        results['ships'] = phase_ships()
        results['buildings'] = phase_buildings()
        results['traits'] = phase_traits()
        results['governments'] = phase_governments()
        results['megastructures'] = phase_megastructures()
        results['anomalies'] = phase_anomalies()
        results['empires'] = phase_empires()
        results['galaxy_map'] = phase_galaxy_map()
        results['economy'] = phase_economy()
        results['techtree'] = phase_techtree()
        results['search'] = phase_search()
        results['ship_models'] = phase_ship_models(skip=args.skip_images)
        results['images'] = phase_images(skip=args.skip_images)
        results['building_icons'] = phase_building_icons(skip=args.skip_images)
        module_name = 'full'

    # Change tracking
    all_diffs = compute_all_changes(snapshots, ASSETS_DIR)
    print_changes(all_diffs)
    changes_path = os.path.join(ASSETS_DIR, 'changes.json')
    changes_report = save_changes(all_diffs, changes_path)

    # Summary
    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"\n  Total time: {elapsed:.1f}s")
    print(f"  Timestamp: {datetime.now().isoformat()}")
    print(f"\n  Results written to: {os.path.join(UPDATE_DIR.parent, 'assets')}")

    # Include change summary in log
    results['changes'] = changes_report.get('summary', {})
    write_log_entry(module_name, results, elapsed)

    print("\n  [DONE] Update complete!")
    return 0


if __name__ == '__main__':
    sys.exit(main())
