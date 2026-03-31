"""
Convert building icon DDS files to WebP format using ImageMagick.
Source: gfx/interface/icons/buildings/ (vanilla first, mod overrides)
Output: wiki/icons/buildings/
"""

import os
import subprocess
import time
from config import (
    MOD_GFX_BUILDINGS_ICONS,
    VANILLA_GFX_BUILDINGS_ICONS,
    OUTPUT_ICONS_DIR,
)

OUTPUT_BUILDINGS_ICONS_DIR = os.path.join(OUTPUT_ICONS_DIR, "buildings")


def convert_building_icons(force=False):
    """Convert building icon DDS files to WebP. Returns stats dict."""
    stats = {'total': 0, 'converted': 0, 'skipped': 0, 'failed': 0, 'errors': []}

    # Build DDS lookup: stem -> full_path (vanilla first so mod overrides)
    dds_lookup = {}
    for src_dir in [VANILLA_GFX_BUILDINGS_ICONS, MOD_GFX_BUILDINGS_ICONS]:
        if not os.path.isdir(src_dir):
            continue
        for fn in os.listdir(src_dir):
            if fn.lower().endswith('.dds'):
                stem = fn[:-4]
                dds_lookup[stem] = os.path.join(src_dir, fn)

    if not dds_lookup:
        print("  [WARN] No building icon DDS files found.")
        return stats

    print(f"  Building icon DDS files found: {len(dds_lookup)}")
    os.makedirs(OUTPUT_BUILDINGS_ICONS_DIR, exist_ok=True)

    for stem in sorted(dds_lookup.keys()):
        input_path = dds_lookup[stem]
        output_path = os.path.join(OUTPUT_BUILDINGS_ICONS_DIR, f"{stem}.webp")
        stats['total'] += 1

        if not force and os.path.exists(output_path):
            stats['skipped'] += 1
            continue

        try:
            result = subprocess.run(
                ['magick', input_path, '-resize', '64x64', '-quality', '80', output_path],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                stats['converted'] += 1
            else:
                stats['failed'] += 1
                stats['errors'].append(f"{stem}: {result.stderr[:200]}")
        except FileNotFoundError:
            print("  [ERROR] ImageMagick not found. Install it to convert building icons.")
            stats['failed'] += 1
            break
        except Exception as e:
            stats['failed'] += 1
            stats['errors'].append(f"{stem}: {e}")

    return stats


def main():
    print("=== Converting Building Icons (DDS -> WebP) ===")
    start = time.time()
    stats = convert_building_icons()
    elapsed = time.time() - start

    print(f"  Total:     {stats['total']}")
    print(f"  Converted: {stats['converted']}")
    print(f"  Skipped:   {stats['skipped']}")
    print(f"  Failed:    {stats['failed']}")
    if stats['errors']:
        for err in stats['errors'][:5]:
            print(f"  [ERR] {err}")
    print(f"  Time: {elapsed:.1f}s")


if __name__ == '__main__':
    main()
