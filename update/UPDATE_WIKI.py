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


def phase_inject_missing_loc():
    """Phase 2c: Inject missing loc keys from loc_audit."""
    print("\n" + "=" * 60)
    print("PHASE 2c: INJECT MISSING LOC KEYS")
    print("=" * 60)

    from inject_missing_loc import inject_into_localisation
    return inject_into_localisation()


def phase_split_localisation():
    """Phase 2b: Split localisation into per-module files."""
    print("\n" + "=" * 60)
    print("PHASE 2b: LOCALISATION SPLITTING")
    print("=" * 60)

    from split_localisation import split_localisation
    return split_localisation()


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
    """Phase: Governments, Civics, Authorities, Policies, Edicts & Councilors."""
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


def phase_resources():
    """Phase: Strategic Resources + Producer Index.

    Must run AFTER all producer modules (economy, megas, relics, edicts,
    traditions, perks, governments) have written their JSONs to disk.
    """
    print("\n" + "=" * 60)
    print("PHASE: RESOURCES")
    print("=" * 60)

    from generate_resources_json import generate_all
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


def phase_mega_models(skip=False):
    """Phase: Convert megastructure models to GLB."""
    print("\n" + "=" * 60)
    print("PHASE: MEGASTRUCTURE MODELS (GLB)")
    print("=" * 60)

    if skip:
        print("  [SKIPPED] --skip-images flag set")
        return {'skipped': True}

    from convert_mega_models import convert_all
    stats = convert_all()
    return stats


def phase_all_icons(skip=False):
    """Phase: Convert DDS icons to WebP for all categories."""
    print("\n" + "=" * 60)
    print("PHASE: ALL ICONS")
    print("=" * 60)

    if skip:
        print("  [SKIPPED] --skip-images flag set")
        return {'skipped': True}

    from convert_icons import convert_all_icons
    result = convert_all_icons()
    t = result['total']
    print(f"  Total: {t['total']}, Converted: {t['converted']}, Skipped: {t['skipped']}, Failed: {t['failed']}")
    return result


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
    'events':      ['localisation', 'inject_missing_loc', 'gfx', 'events', 'images', 'split_loc'],
    'loc':         ['localisation', 'inject_missing_loc', 'split_loc'],
    'gfx':         ['gfx'],
    'images':      ['images'],
    'icons':       ['all_icons'],
    'techtree':    ['techtree'],
    'ships':       ['localisation', 'inject_missing_loc', 'ships', 'split_loc'],
    'ship_models': ['localisation', 'inject_missing_loc', 'ships', 'ship_models', 'split_loc'],
    'buildings':   ['localisation', 'inject_missing_loc', 'buildings', 'all_icons', 'split_loc'],
    'traits':      ['localisation', 'inject_missing_loc', 'traits', 'split_loc'],
    'governments': ['localisation', 'inject_missing_loc', 'governments', 'split_loc'],
    'megastructures': ['localisation', 'inject_missing_loc', 'megastructures', 'mega_models', 'split_loc'],
    'mega_models':    ['localisation', 'inject_missing_loc', 'megastructures', 'mega_models', 'split_loc'],
    'anomalies':      ['localisation', 'inject_missing_loc', 'anomalies', 'split_loc'],
    'empires':        ['localisation', 'inject_missing_loc', 'empires', 'split_loc'],
    'galaxy_map':     ['galaxy_map'],
    'economy':        ['localisation', 'inject_missing_loc', 'economy', 'split_loc'],
    'resources':      ['localisation', 'inject_missing_loc', 'resources', 'all_icons', 'split_loc'],
    'search':         ['search'],
    'content':        ['localisation', 'inject_missing_loc', 'ships', 'buildings', 'all_icons', 'traits',
                       'governments', 'megastructures', 'anomalies', 'empires', 'galaxy_map', 'economy',
                       'resources', 'search', 'mega_models', 'split_loc'],
}


def run_phase(key, fn, results, failures):
    """Run a single pipeline phase in isolation.

    On success, stores the phase's return value in results[key] (unchanged
    contract). On failure, prints the traceback, records an error marker in
    results[key], appends the key to failures, and lets the run continue so
    one bad phase does not discard every downstream phase (and the commit).
    """
    try:
        results[key] = fn()
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n  [PHASE FAILED] {key}: {type(e).__name__}: {e}")
        results[key] = {'error': f'{type(e).__name__}: {e}'}
        failures.append(key)


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
    failures = []

    # Collect snapshots of all tracked JSONs before update
    from diff_tracker import collect_snapshots, compute_all_changes, print_changes, save_changes
    snapshots = collect_snapshots(ASSETS_DIR)

    # Ordered phase table. Full mode runs every entry; --only filters it by
    # ONLY_MODULES[args.only] membership. Order matters: resources after all
    # producers, search after techtree, split_loc last.
    skip = args.skip_images
    PHASES = [
        ('localisation',       phase_localisation),
        ('inject_missing_loc', phase_inject_missing_loc),
        ('gfx',                phase_gfx),
        ('events',             phase_events),
        ('ships',              phase_ships),
        ('buildings',          phase_buildings),
        ('traits',             phase_traits),
        ('governments',        phase_governments),
        ('megastructures',     phase_megastructures),
        ('anomalies',          phase_anomalies),
        ('empires',            phase_empires),
        ('galaxy_map',         phase_galaxy_map),
        ('economy',            phase_economy),
        ('resources',          phase_resources),
        ('techtree',           phase_techtree),
        ('search',             phase_search),
        ('ship_models',        lambda: phase_ship_models(skip=skip)),
        ('mega_models',        lambda: phase_mega_models(skip=skip)),
        ('images',             lambda: phase_images(skip=skip)),
        ('all_icons',          lambda: phase_all_icons(skip=skip)),
        ('split_loc',          phase_split_localisation),
    ]

    if args.only:
        selected = set(ONLY_MODULES[args.only])
        run_list = [(k, fn) for k, fn in PHASES if k in selected]
        module_name = args.only
    else:
        run_list = PHASES
        module_name = 'full'

    for key, fn in run_list:
        run_phase(key, fn, results, failures)

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

    if failures:
        print("\n" + "=" * 60)
        print(f"  [DONE WITH ERRORS] {len(failures)} phase(s) failed:")
        for key in failures:
            print(f"    - {key}: {results[key].get('error')}")
        print("  Partial results were still written and can be committed.")
        print("=" * 60)
        return 2

    print("\n  [DONE] Update complete!")
    return 0


if __name__ == '__main__':
    sys.exit(main())
