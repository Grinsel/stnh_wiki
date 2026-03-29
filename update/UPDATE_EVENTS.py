"""
=============================================================================
STNH WIKI - EVENTS MODULE UPDATER
=============================================================================

Standalone updater for the Events module only.
Runs: Validation → Localisation → GFX → Events → Images (optional)

USAGE:
    python UPDATE_EVENTS.py
    python UPDATE_EVENTS.py --skip-images
=============================================================================
"""

import sys
import time
import argparse
from pathlib import Path

# Add update directory to path
sys.path.insert(0, str(Path(__file__).parent))

from UPDATE_WIKI import (phase_validation, phase_localisation,
                          phase_gfx, phase_events, phase_images,
                          write_log_entry)


def main():
    parser = argparse.ArgumentParser(description='STNH Wiki - Update Events')
    parser.add_argument('--skip-images', action='store_true',
                        help='Skip DDS to WebP image conversion')
    args = parser.parse_args()

    print("=== STNH Wiki: Events Update ===\n")
    start = time.time()

    if not phase_validation():
        print("\n[ABORT] Validation failed.")
        return 1

    results = {}
    results['localisation'] = phase_localisation()
    results['gfx'] = phase_gfx()
    results['events'] = phase_events()
    results['images'] = phase_images(skip=args.skip_images)

    elapsed = time.time() - start
    write_log_entry('events', results, elapsed)
    print(f"\n[DONE] Events update in {elapsed:.1f}s")
    return 0


if __name__ == '__main__':
    sys.exit(main())
