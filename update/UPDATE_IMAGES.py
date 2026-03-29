"""
=============================================================================
STNH WIKI - IMAGE CONVERSION MODULE UPDATER
=============================================================================

Standalone updater for image conversion only.
Runs: Validation → Image Conversion (DDS → WebP)

USAGE:
    python UPDATE_IMAGES.py
=============================================================================
"""

import sys
import time
from pathlib import Path

# Add update directory to path
sys.path.insert(0, str(Path(__file__).parent))

from UPDATE_WIKI import (phase_validation, phase_images,
                          write_log_entry)


def main():
    print("=== STNH Wiki: Image Conversion ===\n")
    start = time.time()

    if not phase_validation():
        print("\n[ABORT] Validation failed.")
        return 1

    results = {}
    results['images'] = phase_images(skip=False)

    elapsed = time.time() - start
    write_log_entry('images', results, elapsed)
    print(f"\n[DONE] Image conversion in {elapsed:.1f}s")
    return 0


if __name__ == '__main__':
    sys.exit(main())
