"""
Convert DDS event pictures to WebP format using ImageMagick.
Only converts pictures that are actually referenced by events.
"""

import os
import json
import subprocess
import time
from config import (
    MOD_GFX_EVENT_PICTURES, OUTPUT_ASSETS_DIR, OUTPUT_PICTURES_DIR
)


def get_referenced_pictures(events_index_path, pictures_map_path):
    """Get dict of texture_name -> frames for pictures used by events."""
    referenced = {}

    # Load index
    with open(events_index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)

    # Collect all picture references
    pic_refs = set()
    for ev in index:
        pic = ev.get('pic')
        if pic and isinstance(pic, str):
            pic_refs.add(pic)

    # Load GFX mappings
    with open(pictures_map_path, 'r', encoding='utf-8') as f:
        gfx_map = json.load(f)

    # Map GFX names to texture filenames + frame count
    for pic_ref in pic_refs:
        if pic_ref in gfx_map:
            entry = gfx_map[pic_ref]
            referenced[entry['texture_name']] = entry.get('frames', 1)

    return referenced


def convert_images(force=False):
    """Convert DDS files to WebP. Returns stats dict."""
    stats = {'total': 0, 'converted': 0, 'skipped': 0, 'failed': 0, 'errors': []}

    events_index_path = os.path.join(OUTPUT_ASSETS_DIR, 'events_index.json')
    pictures_map_path = os.path.join(OUTPUT_ASSETS_DIR, 'pictures_map.json')

    if not os.path.exists(events_index_path) or not os.path.exists(pictures_map_path):
        print("  [ERROR] Run generate_events_json.py first!")
        return stats

    referenced = get_referenced_pictures(events_index_path, pictures_map_path)
    print(f"  Referenced pictures: {len(referenced)}")

    animated_count = sum(1 for f in referenced.values() if f > 1)
    print(f"  Animated (multi-frame): {animated_count}")

    if not os.path.isdir(MOD_GFX_EVENT_PICTURES):
        print(f"  [ERROR] Event pictures directory not found: {MOD_GFX_EVENT_PICTURES}")
        return stats

    os.makedirs(OUTPUT_PICTURES_DIR, exist_ok=True)

    for fn in sorted(os.listdir(MOD_GFX_EVENT_PICTURES)):
        if not fn.endswith('.dds'):
            continue
        base_name = fn[:-4]

        if base_name not in referenced:
            continue

        stats['total'] += 1
        output_path = os.path.join(OUTPUT_PICTURES_DIR, f"{base_name}.webp")

        if not force and os.path.exists(output_path):
            stats['skipped'] += 1
            continue

        input_path = os.path.join(MOD_GFX_EVENT_PICTURES, fn)
        num_frames = referenced[base_name]

        try:
            if num_frames > 1:
                # Sprite sheet: get dimensions, crop first frame, then resize
                # First get the image dimensions
                id_result = subprocess.run(
                    ['magick', 'identify', '-format', '%w %h', input_path],
                    capture_output=True, text=True, timeout=30
                )
                if id_result.returncode != 0:
                    stats['failed'] += 1
                    stats['errors'].append(f"{fn}: identify failed: {id_result.stderr[:200]}")
                    continue

                dims = id_result.stdout.strip().split()
                total_width = int(dims[0])
                height = int(dims[1])
                frame_width = total_width // num_frames

                # Sanity check: frame aspect ratio should be ~2.35:1 (620:264)
                # If not, the frame count is wrong — treat as single image
                frame_ratio = frame_width / height if height > 0 else 0
                if frame_ratio < 1.5 or frame_ratio > 3.5:
                    result = subprocess.run(
                        ['magick', input_path, '-resize', '480x', '-quality', '80', output_path],
                        capture_output=True, text=True, timeout=30
                    )
                else:
                    # Crop first frame then resize (width 480, keep aspect ratio)
                    result = subprocess.run(
                        ['magick', input_path,
                         '-crop', f'{frame_width}x{height}+0+0', '+repage',
                         '-resize', '480x', '-quality', '80', output_path],
                        capture_output=True, text=True, timeout=30
                    )
            else:
                # Single frame: if aspect ratio is too wide, it's likely a
                # sprite sheet with wrong frame count — auto-detect frame width
                id_result = subprocess.run(
                    ['magick', 'identify', '-format', '%w %h', input_path],
                    capture_output=True, text=True, timeout=30
                )
                crop_cmd = []
                if id_result.returncode == 0:
                    dims = id_result.stdout.strip().split()
                    w, h = int(dims[0]), int(dims[1])
                    ratio = w / h if h > 0 else 0
                    if ratio > 3.5:
                        # Likely a sprite sheet — guess frame width ≈ height * 2.35
                        frame_w = round(h * 2.348)
                        crop_cmd = ['-crop', f'{frame_w}x{h}+0+0', '+repage']

                result = subprocess.run(
                    ['magick', input_path] + crop_cmd +
                    ['-resize', '480x', '-quality', '80', output_path],
                    capture_output=True, text=True, timeout=30
                )

            if result.returncode == 0:
                stats['converted'] += 1
            else:
                stats['failed'] += 1
                stats['errors'].append(f"{fn}: {result.stderr[:200]}")
        except FileNotFoundError:
            print("  [ERROR] ImageMagick not found. Install it to convert images.")
            stats['failed'] += 1
            break
        except Exception as e:
            stats['failed'] += 1
            stats['errors'].append(f"{fn}: {e}")

    return stats


def main():
    print("=== Converting Event Pictures (DDS -> WebP) ===")
    start = time.time()
    stats = convert_images()
    elapsed = time.time() - start
    print(f"\n  Total referenced: {stats['total']}")
    print(f"  Converted: {stats['converted']}")
    print(f"  Skipped (exists): {stats['skipped']}")
    print(f"  Failed: {stats['failed']}")
    print(f"  Elapsed: {elapsed:.1f}s")
    if stats['errors']:
        for e in stats['errors'][:5]:
            print(f"    {e}")
    return stats


if __name__ == '__main__':
    main()
