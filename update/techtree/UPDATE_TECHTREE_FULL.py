"""
=============================================================================
STNH TECHTREE - FULL UPDATE SCRIPT
=============================================================================

Complete automation of the techtree data regeneration process.
Run this script whenever the STNH mod or Stellaris base game is updated.

PREREQUISITES:
- Python 3.8+
- STNH mod at: C:\\Users\\marcj\\git01\\New-Horizons-Development
- Stellaris at: C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stellaris
- ImageMagick installed (for manual icon conversion)

USAGE:
    python UPDATE_TECHTREE_FULL.py

PHASES:
    1. Validation    - Check paths and Balance Center availability
    2. Data Caching  - Update localisation and trigger maps
    3. Icon Prep     - Extract icon mappings from tech files
    4. Generation    - Generate tech JSON files with all data
    5. Icons         - Verify and copy missing icons
    6. Finalization  - Statistics, logging, and summary

MANUAL STEPS AFTER:
    1. Run converter.bat in icons/ folder (if DDS files present)
    2. Delete DDS files after conversion
    3. Test locally in browser
    4. Commit and push changes

Author: STNH Techtree Project
=============================================================================
"""

import sys
import os
import subprocess
import time
import json
from pathlib import Path
from datetime import datetime

# Add update directory to path
UPDATE_DIR = Path(__file__).parent
sys.path.insert(0, str(UPDATE_DIR))

# Import logger
from update_logger import UpdateLogger

# Import config for validation
try:
    import config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False


def print_banner():
    """Print the startup banner."""
    print("""
=============================================================================
    _____ _____ _   _ _   _   _____ _____ ____ _   _ _____ ____  _____ _____
   /  ___|_   _| \\ | | | | | |_   _|  ___/ ___| | | |_   _|  _ \\| ____| ____|
   \\ `--. | | |  \\| | |_| |   | | | |_ | |   | |_| | | | | |_) |  _| |  _|
    `--. \\ | | | . ` |  _  |   | | |  _|| |   |  _  | | | |  _ <| |___| |___
   /\\__/ / | | | |\\  | | | |   | | | |  | |___| | | | | | | | \\ \\_____|_____|
   \\____/  \\_/ \\_| \\_\\_| |_|   \\_/ \\_|   \\____|_| |_| \\_/ |_|  \\_\\

                    FULL UPDATE SCRIPT v2.0
=============================================================================
    """)


def run_script(script_name: str, description: str, logger: UpdateLogger) -> tuple:
    """
    Run a Python script and capture its output.

    Returns:
        tuple: (success: bool, duration_ms: int, output: dict or None)
    """
    script_path = UPDATE_DIR / script_name

    if not script_path.exists():
        logger.add_error(f"Script not found: {script_name}")
        return False, 0, None

    print(f"\n  Running: {script_name}")
    print(f"  Purpose: {description}")
    print(f"  " + "-" * 50)

    start_time = time.time()

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(UPDATE_DIR),
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # Print output (truncated if too long)
        if result.stdout:
            lines = result.stdout.strip().split('\n')
            for line in lines[:30]:  # Max 30 lines
                print(f"    {line}")
            if len(lines) > 30:
                print(f"    ... ({len(lines) - 30} more lines)")

        if result.stderr and result.returncode != 0:
            print(f"  [STDERR]: {result.stderr[:500]}")

        success = result.returncode == 0

        if success:
            print(f"  [OK] Completed in {duration_ms}ms")
        else:
            print(f"  [FAILED] Exit code: {result.returncode}")
            logger.add_error(f"{script_name} failed with exit code {result.returncode}")

        return success, duration_ms, None

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        print(f"  [ERROR] {e}")
        logger.add_error(f"{script_name}: {str(e)}")
        return False, duration_ms, None


def validate_environment(logger: UpdateLogger) -> bool:
    """
    Phase 1: Validate all paths and dependencies.
    """
    print("\n" + "=" * 70)
    print("PHASE 1: VALIDATION")
    print("=" * 70)

    logger.start_phase("Validierung")
    start_time = time.time()

    # Check config availability
    if not CONFIG_AVAILABLE:
        logger.log_step("config.py", "error", 0, error_message="Config module not found")
        logger.end_phase(success=False)
        return False

    # Validate paths
    print("\n  Checking paths...")
    try:
        config.validate_paths()
        print(f"    STNH Mod: {config.STNH_MOD_ROOT}")
        print(f"    Techtree: {config.TECHTREE_PROJECT_ROOT}")
        print(f"    Assets:   {config.OUTPUT_ASSETS_DIR}")

        logger.set_environment(
            stnh_mod_path=config.STNH_MOD_ROOT,
            techtree_path=config.TECHTREE_PROJECT_ROOT
        )

    except FileNotFoundError as e:
        print(f"  [ERROR] Path validation failed: {e}")
        logger.log_step("config.py", "error", 0, error_message=str(e))
        logger.end_phase(success=False)
        return False

    # Check Balance Center
    print("\n  Checking Balance Center...")
    try:
        from balance_center_bridge import get_all_technologies_with_metadata
        print("    Balance Center: Available")
        balance_center_ok = True
    except ImportError as e:
        print(f"    Balance Center: Not available ({e})")
        print("    Will use supplemental parser as fallback")
        balance_center_ok = False
        logger.add_warning("Balance Center not available, using fallback parser")

    duration_ms = int((time.time() - start_time) * 1000)
    logger.log_step("config.py", "success", duration_ms, output={
        "paths_valid": True,
        "balance_center_available": balance_center_ok
    })
    logger.end_phase(success=True)

    print("\n  [OK] Validation complete")
    return True


def update_data_caches(logger: UpdateLogger) -> bool:
    """
    Phase 2: Update localisation and trigger map caches.
    """
    print("\n" + "=" * 70)
    print("PHASE 2: DATA CACHING")
    print("=" * 70)

    logger.start_phase("Daten-Caching")
    all_success = True

    # Update localisation map
    success, duration, _ = run_script(
        "parse_localisation.py",
        "Cache localisation strings (tech names, descriptions)",
        logger
    )
    logger.log_step("parse_localisation.py",
                    "success" if success else "error",
                    duration)
    if not success:
        all_success = False

    # Update trigger map
    success, duration, _ = run_script(
        "create_trigger_map.py",
        "Update faction/species trigger mappings",
        logger
    )
    logger.log_step("create_trigger_map.py",
                    "success" if success else "error",
                    duration)
    if not success:
        all_success = False

    logger.end_phase(success=all_success)
    return all_success


def extract_icon_mappings(logger: UpdateLogger) -> bool:
    """
    Phase 3: Extract icon mappings from tech files.
    """
    print("\n" + "=" * 70)
    print("PHASE 3: ICON PREPARATION")
    print("=" * 70)

    logger.start_phase("Icon-Vorbereitung")

    success, duration, _ = run_script(
        "extract_icon_mappings.py",
        "Extract icon references from technology files",
        logger
    )
    logger.log_step("extract_icon_mappings.py",
                    "success" if success else "error",
                    duration)

    logger.end_phase(success=success)
    return success


def generate_tech_data(logger: UpdateLogger) -> bool:
    """
    Phase 4: Generate tech JSON files.
    """
    print("\n" + "=" * 70)
    print("PHASE 4: TECH GENERATION")
    print("=" * 70)

    logger.start_phase("Tech-Generierung")
    all_success = True

    # Generate main tech JSON files
    success, duration, _ = run_script(
        "create_tech_json_new.py",
        "Generate complete tech JSON files with all data",
        logger
    )

    # Try to get statistics from generated files
    output_stats = {}
    try:
        assets_dir = Path(config.OUTPUT_ASSETS_DIR)
        for area in ['physics', 'engineering', 'society']:
            json_file = assets_dir / f'technology_{area}.json'
            if json_file.exists():
                with open(json_file, 'r', encoding='utf-8') as f:
                    techs = json.load(f)
                    output_stats[f'techs_{area}'] = len(techs)

        output_stats['techs_total'] = sum(
            output_stats.get(f'techs_{area}', 0)
            for area in ['physics', 'engineering', 'society']
        )

        # Check factions
        factions_file = assets_dir / 'factions.json'
        if factions_file.exists():
            with open(factions_file, 'r', encoding='utf-8') as f:
                factions = json.load(f)
                output_stats['factions'] = len(factions)

    except Exception as e:
        logger.add_warning(f"Could not read output statistics: {e}")

    logger.log_step("create_tech_json_new.py",
                    "success" if success else "error",
                    duration,
                    output=output_stats if output_stats else None)

    if not success:
        all_success = False

    # Generate unlock types JSON (for UI filter dropdown)
    success2, duration2, _ = run_script(
        "generate_unlock_types.py",
        "Generate unlock types list for UI filter",
        logger
    )
    logger.log_step("generate_unlock_types.py",
                    "success" if success2 else "error",
                    duration2)

    if not success2:
        all_success = False
        logger.add_warning("Unlock types generation failed - UI filter may not work")

    if output_stats:
        logger.set_statistics(**output_stats)

    logger.end_phase(success=all_success)
    return all_success


def verify_icons(logger: UpdateLogger) -> bool:
    """
    Phase 5: Verify and copy missing icons.
    """
    print("\n" + "=" * 70)
    print("PHASE 5: ICON VERIFICATION")
    print("=" * 70)

    logger.start_phase("Icon-Verifikation")

    success, duration, _ = run_script(
        "verify_all_icons.py",
        "Verify all icons exist and copy missing ones",
        logger
    )

    # Check for DDS files that need conversion
    icons_dir = UPDATE_DIR.parent / 'icons'
    dds_files = list(icons_dir.glob('*.dds'))
    dds_count = len(dds_files)

    # Check WebP coverage
    webp_dir = icons_dir / 'icons_webp'
    webp_count = len(list(webp_dir.glob('*.webp'))) if webp_dir.exists() else 0

    logger.log_step("verify_all_icons.py",
                    "success" if success else "error",
                    duration,
                    output={
                        'dds_files_to_convert': dds_count,
                        'webp_icons_available': webp_count
                    })

    # Update statistics
    logger.set_statistics(
        dds_files_to_convert=dds_count,
        icons_webp_available=webp_count
    )

    if dds_count > 0:
        logger.add_warning(f"{dds_count} DDS files need conversion")

    logger.end_phase(success=success)
    return success


def finalize(logger: UpdateLogger, overall_success: bool) -> None:
    """
    Phase 6: Finalization - statistics, logging, summary.
    """
    print("\n" + "=" * 70)
    print("PHASE 6: FINALIZATION")
    print("=" * 70)

    logger.start_phase("Abschluss")

    # Calculate icon coverage
    stats = logger.statistics
    if 'techs_total' in stats and 'icons_webp_available' in stats:
        techs_total = stats['techs_total']
        icons_available = stats['icons_webp_available']
        if techs_total > 0:
            coverage = (icons_available / techs_total) * 100
            logger.set_statistics(icon_coverage_percent=round(coverage, 2))

    # Add manual steps
    dds_count = stats.get('dds_files_to_convert', 0)
    if dds_count > 0:
        logger.add_manual_step(f"Run icons/converter.bat ({dds_count} DDS files to convert)")
        logger.add_manual_step("Delete DDS files from icons/ folder after conversion")
    logger.add_manual_step("Test locally in browser")
    logger.add_manual_step("Commit and push changes")

    logger.log_step("finalization", "success", 0)
    logger.end_phase(success=True)

    # End session
    logger.end_session(success=overall_success)

    # Save log file
    log_path = logger.save_to_file()
    print(f"\n  Log saved to: {log_path.name}")

    # Print summary
    logger.print_summary()


def main():
    """Main entry point."""
    print_banner()

    # Initialize logger
    logger = UpdateLogger()
    logger.start_session()

    # Track overall success
    phases_success = []

    # Phase 1: Validation
    if not validate_environment(logger):
        print("\n[ABORT] Validation failed. Cannot continue.")
        logger.end_session(success=False)
        logger.save_to_file()
        logger.print_summary()
        return 1

    phases_success.append(True)

    # Phase 2: Data Caching
    success = update_data_caches(logger)
    phases_success.append(success)
    if not success:
        print("\n[WARNING] Data caching had errors, continuing anyway...")

    # Phase 3: Icon Preparation
    success = extract_icon_mappings(logger)
    phases_success.append(success)
    if not success:
        print("\n[WARNING] Icon mapping had errors, continuing anyway...")

    # Phase 4: Tech Generation
    success = generate_tech_data(logger)
    phases_success.append(success)
    if not success:
        print("\n[ERROR] Tech generation failed!")

    # Phase 5: Icon Verification
    success = verify_icons(logger)
    phases_success.append(success)
    if not success:
        print("\n[WARNING] Icon verification had errors...")

    # Phase 6: Finalization
    overall_success = all(phases_success)
    finalize(logger, overall_success)

    return 0 if overall_success else 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
