"""
=============================================================================
STNH WIKI - GFX MAPPINGS MODULE UPDATER
=============================================================================

Standalone updater for GFX mappings only.
Runs: Validation → GFX Mappings

USAGE:
    python UPDATE_GFX.py
=============================================================================
"""

import sys
import time
from pathlib import Path

# Add update directory to path
sys.path.insert(0, str(Path(__file__).parent))

from UPDATE_WIKI import (phase_validation, phase_gfx,
                          write_log_entry)


def main():
    print("=== STNH Wiki: GFX Mappings Update ===\n")
    start = time.time()

    if not phase_validation():
        print("\n[ABORT] Validation failed.")
        return 1

    results = {}
    results['gfx'] = phase_gfx()

    elapsed = time.time() - start
    write_log_entry('gfx', results, elapsed)
    print(f"\n[DONE] GFX mappings update in {elapsed:.1f}s")
    return 0


if __name__ == '__main__':
    sys.exit(main())
