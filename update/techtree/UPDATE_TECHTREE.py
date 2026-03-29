"""
=============================================================================
STNH TECHTREE - MASTER UPDATE SCRIPT (DEPRECATED)
=============================================================================

*** DEPRECATED: Use UPDATE_TECHTREE_FULL.py instead! ***

UPDATE_TECHTREE_FULL.py provides:
- Structured JSON logging for each update session
- Pre-flight validation of all paths
- Localisation and trigger map caching
- Detailed statistics and summary
- Better error handling

This legacy script is kept for backwards compatibility only.

=============================================================================

This script regenerates ALL techtree data after a game/mod update.
Run this script whenever:
- The STNH mod is updated
- Stellaris base game is updated
- New technologies are added

PREREQUISITES:
- Python 3.8+
- ImageMagick installed (for icon conversion)
- STNH mod at: C:\\Users\\marcj\\git01\\New-Horizons-Development
- Stellaris at: C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stellaris

USAGE:
    python UPDATE_TECHTREE.py

STEPS PERFORMED:
1. Extract icon mappings from tech files
2. Generate tech JSON files (physics, engineering, society)
3. Verify and copy missing icons
4. Report status

MANUAL STEPS AFTER:
1. Run converter.bat in icons/ folder (converts DDS to WebP)
2. Delete DDS files after conversion
3. Test locally
4. Commit and push changes

Author: STNH Techtree Project
=============================================================================
"""

import sys
import subprocess
from pathlib import Path

# Update directory
UPDATE_DIR = Path(__file__).parent


def run_script(script_name, description):
    """Run a Python script and handle errors"""
    script_path = UPDATE_DIR / script_name

    if not script_path.exists():
        print(f"[ERROR] Script not found: {script_name}")
        return False

    print(f"\n{'='*70}")
    print(f"STEP: {description}")
    print(f"Script: {script_name}")
    print('='*70)

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(UPDATE_DIR),
            capture_output=False
        )
        return result.returncode == 0
    except Exception as e:
        print(f"[ERROR] Failed to run {script_name}: {e}")
        return False


def main():
    # Deprecation warning
    print("\n" + "!" * 70)
    print("!!! DEPRECATED: Use UPDATE_TECHTREE_FULL.py instead !!!")
    print("!!! This script lacks logging and validation features !!!")
    print("!" * 70)

    print("""
=============================================================================
    _____ _____ _   _ _   _   _____ _____ ____ _   _ _____ ____  _____ _____
   /  ___|_   _| \ | | | | | |_   _|  ___/ ___| | | |_   _|  _ \| ____| ____|
   \ `--.  | | |  \| | |_| |   | | | |_ | |   | |_| | | | | |_) |  _| |  _|
    `--. \ | | | . ` |  _  |   | | |  _|| |   |  _  | | | |  _ <| |___| |___
   /\__/ / | | | |\  | | | |   | | | |  | |___| | | | | | | | \ \_____|_____|
   \____/  \_/ \_| \_\_| |_|   \_/ \_|   \____|_| |_| \_/ |_|  \_\

                    MASTER UPDATE SCRIPT
=============================================================================
    """)

    steps = [
        ("extract_icon_mappings.py", "Extract icon mappings from tech files"),
        ("create_tech_json_new.py", "Generate tech JSON files with all data"),
        ("verify_all_icons.py", "Verify and copy missing icons"),
    ]

    success_count = 0
    failed_steps = []

    for script_name, description in steps:
        if run_script(script_name, description):
            success_count += 1
        else:
            failed_steps.append(script_name)

    # Final Report
    print("\n" + "=" * 70)
    print("UPDATE COMPLETE")
    print("=" * 70)
    print(f"\nSteps completed: {success_count}/{len(steps)}")

    if failed_steps:
        print(f"\n[WARNING] Failed steps:")
        for step in failed_steps:
            print(f"  - {step}")

    # Check for DDS files needing conversion
    icons_dir = UPDATE_DIR.parent / 'icons'
    dds_files = list(icons_dir.glob('*.dds'))

    if dds_files:
        print(f"\n[ACTION REQUIRED]")
        print(f"  {len(dds_files)} DDS files need conversion!")
        print(f"  1. Run: icons/converter.bat")
        print(f"  2. Delete DDS files after conversion")
        print(f"  3. Test locally in browser")
        print(f"  4. Commit and push changes")
    else:
        print(f"\n[OK] No DDS conversion needed")
        print(f"  1. Test locally in browser")
        print(f"  2. Commit and push changes")

    print("\n" + "=" * 70)


if __name__ == '__main__':
    main()
