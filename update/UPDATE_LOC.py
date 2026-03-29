"""
=============================================================================
STNH WIKI - LOCALISATION MODULE UPDATER
=============================================================================

Standalone updater for Localisation only.
Runs: Validation → Localisation

USAGE:
    python UPDATE_LOC.py
=============================================================================
"""

import sys
import time
from pathlib import Path

# Add update directory to path
sys.path.insert(0, str(Path(__file__).parent))

from UPDATE_WIKI import (phase_validation, phase_localisation,
                          write_log_entry)


def main():
    print("=== STNH Wiki: Localisation Update ===\n")
    start = time.time()

    if not phase_validation():
        print("\n[ABORT] Validation failed.")
        return 1

    results = {}
    results['localisation'] = phase_localisation()

    elapsed = time.time() - start
    write_log_entry('loc', results, elapsed)
    print(f"\n[DONE] Localisation update in {elapsed:.1f}s")
    return 0


if __name__ == '__main__':
    sys.exit(main())
