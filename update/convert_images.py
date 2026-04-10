"""
Convert DDS event pictures to WebP format.
Uses ImageMagick (magick) if available, falls back to Pillow.
Only converts pictures that are actually referenced by events.
"""

import os
import json
import subprocess
import time
from config import (
    STNH_MOD_ROOT, VANILLA_ROOT,
    MOD_GFX_EVENT_PICTURES, VANILLA_GFX_EVENT_PICTURES,
    OUTPUT_ASSETS_DIR, OUTPUT_PICTURES_DIR
)


def get_referenced_pictures(events_index_path, pictures_map_path,
                            anomalies_path=None, archaeology_path=None):
    """Get dict of texture_name -> {frames, texture_path} for pictures used by events/anomalies/archaeology."""
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

    # Scan anomalies for picture references
    if anomalies_path and os.path.exists(anomalies_path):
        with open(anomalies_path, 'r', encoding='utf-8') as f:
            anomalies = json.load(f)
        for anom in anomalies:
            pic = anom.get('picture')
            if pic and isinstance(pic, str):
                pic_refs.add(pic)

    # Scan archaeology for picture references
    if archaeology_path and os.path.exists(archaeology_path):
        with open(archaeology_path, 'r', encoding='utf-8') as f:
            sites = json.load(f)
        for site in sites:
            pic = site.get('picture')
            if pic and isinstance(pic, str):
                pic_refs.add(pic)

    # Load GFX mappings
    with open(pictures_map_path, 'r', encoding='utf-8') as f:
        gfx_map = json.load(f)

    # Map GFX names to texture filenames + frame count + texture_path
    for pic_ref in pic_refs:
        entry = gfx_map.get(pic_ref)
        # Fuzzy fallback: try common variants (e.g. "sth_GFX_evt_X" -> "sth_GFX_evt_X+Era", "XEra")
        if not entry:
            for suffix in ['+Era', 'Era']:
                entry = gfx_map.get(pic_ref + suffix)
                if entry:
                    break
        # Prefix fallback: event uses "GFX_X" but map has "sth_GFX_X"
        if not entry and pic_ref.startswith('GFX_'):
            entry = gfx_map.get('sth_' + pic_ref)
        if entry:
            referenced[entry['texture_name']] = {
                'frames': entry.get('frames', 1),
                'texture_path': entry.get('texture_path', ''),
            }

    return referenced


def convert_images(force=False, anomalies_path=None, archaeology_path=None):
    """Convert DDS files to WebP. Returns stats dict."""
    global _HAS_IMAGEMAGICK
    _HAS_IMAGEMAGICK = _has_imagemagick()
    converter_name = 'ImageMagick' if _HAS_IMAGEMAGICK else 'Pillow'
    print(f"  Converter: {converter_name}")
    stats = {'total': 0, 'converted': 0, 'skipped': 0, 'failed': 0, 'errors': []}

    events_index_path = os.path.join(OUTPUT_ASSETS_DIR, 'events_index.json')
    pictures_map_path = os.path.join(OUTPUT_ASSETS_DIR, 'pictures_map.json')

    if not os.path.exists(events_index_path) or not os.path.exists(pictures_map_path):
        print("  [ERROR] Run generate_events_json.py first!")
        return stats

    # Default paths for anomalies/archaeology JSONs
    if anomalies_path is None:
        anomalies_path = os.path.join(OUTPUT_ASSETS_DIR, 'anomalies.json')
    if archaeology_path is None:
        archaeology_path = os.path.join(OUTPUT_ASSETS_DIR, 'archaeology.json')

    referenced = get_referenced_pictures(events_index_path, pictures_map_path,
                                         anomalies_path=anomalies_path,
                                         archaeology_path=archaeology_path)
    print(f"  Referenced pictures: {len(referenced)}")

    animated_count = sum(1 for r in referenced.values() if r['frames'] > 1)
    print(f"  Animated (multi-frame): {animated_count}")

    if not os.path.isdir(MOD_GFX_EVENT_PICTURES):
        print(f"  [WARN] Event pictures directory not found: {MOD_GFX_EVENT_PICTURES}")

    os.makedirs(OUTPUT_PICTURES_DIR, exist_ok=True)

    # Build DDS lookup: base_name -> full_path (mod recursive first, vanilla fallback)
    dds_lookup = {}
    # Vanilla event_pictures first (so mod overrides)
    if os.path.isdir(VANILLA_GFX_EVENT_PICTURES):
        for root, dirs, files in os.walk(VANILLA_GFX_EVENT_PICTURES):
            for fn in files:
                if fn.endswith('.dds'):
                    dds_lookup[fn[:-4]] = os.path.join(root, fn)
    # Mod event_pictures recursive (overrides vanilla)
    if os.path.isdir(MOD_GFX_EVENT_PICTURES):
        for root, dirs, files in os.walk(MOD_GFX_EVENT_PICTURES):
            for fn in files:
                if fn.endswith('.dds'):
                    dds_lookup[fn[:-4]] = os.path.join(root, fn)

    # For any referenced texture not yet found, try resolving via texture_path
    for base_name, info in referenced.items():
        if base_name in dds_lookup:
            continue
        tex_path = info.get('texture_path', '')
        if not tex_path:
            continue
        # texture_path is relative (e.g. "gfx/interface/leaders/...")
        # Try mod first, then vanilla
        for root_dir in [STNH_MOD_ROOT, VANILLA_ROOT]:
            candidate = os.path.join(root_dir, tex_path.replace('/', os.sep))
            if os.path.exists(candidate):
                dds_lookup[base_name] = candidate
                break

    for base_name in sorted(referenced.keys()):
        if base_name not in dds_lookup:
            continue

        stats['total'] += 1
        output_path = os.path.join(OUTPUT_PICTURES_DIR, f"{base_name}.webp")

        if not force and os.path.exists(output_path):
            stats['skipped'] += 1
            continue

        input_path = dds_lookup[base_name]
        num_frames = referenced[base_name]['frames']

        ok = _convert_one(input_path, output_path, num_frames, stats)
        if ok:
            stats['converted'] += 1

    return stats


def _has_imagemagick():
    """Return True if ImageMagick's magick command is available."""
    try:
        r = subprocess.run(['magick', '-version'], capture_output=True, timeout=5)
        return r.returncode == 0
    except (FileNotFoundError, OSError):
        return False


def _convert_one(input_path, output_path, num_frames, stats):
    """Convert a single DDS file to WebP. Returns True on success."""
    if _HAS_IMAGEMAGICK:
        return _convert_imagemagick(input_path, output_path, num_frames, stats)
    else:
        return _convert_pillow(input_path, output_path, num_frames, stats)


def _convert_imagemagick(input_path, output_path, num_frames, stats):
    try:
        if num_frames > 1:
            id_result = subprocess.run(
                ['magick', 'identify', '-format', '%w %h', input_path],
                capture_output=True, text=True, timeout=30
            )
            if id_result.returncode != 0:
                stats['failed'] += 1
                stats['errors'].append(f"{os.path.basename(input_path)}: identify failed")
                return False
            dims = id_result.stdout.strip().split()
            total_width, height = int(dims[0]), int(dims[1])
            frame_width = total_width // num_frames
            frame_ratio = frame_width / height if height > 0 else 0
            if frame_ratio < 1.5 or frame_ratio > 3.5:
                result = subprocess.run(
                    ['magick', input_path, '-resize', '480x', '-quality', '80', output_path],
                    capture_output=True, text=True, timeout=30
                )
            else:
                result = subprocess.run(
                    ['magick', input_path, '-crop', f'{frame_width}x{height}+0+0',
                     '+repage', '-resize', '480x', '-quality', '80', output_path],
                    capture_output=True, text=True, timeout=30
                )
        else:
            id_result = subprocess.run(
                ['magick', 'identify', '-format', '%w %h', input_path],
                capture_output=True, text=True, timeout=30
            )
            crop_cmd = []
            if id_result.returncode == 0:
                dims = id_result.stdout.strip().split()
                w, h = int(dims[0]), int(dims[1])
                if w / h > 3.5:
                    frame_w = round(h * 2.348)
                    crop_cmd = ['-crop', f'{frame_w}x{h}+0+0', '+repage']
            result = subprocess.run(
                ['magick', input_path] + crop_cmd +
                ['-resize', '480x', '-quality', '80', output_path],
                capture_output=True, text=True, timeout=30
            )
        if result.returncode == 0:
            return True
        stats['failed'] += 1
        stats['errors'].append(f"{os.path.basename(input_path)}: {result.stderr[:200]}")
        return False
    except FileNotFoundError:
        stats['failed'] += 1
        stats['errors'].append(f"{os.path.basename(input_path)}: ImageMagick not found")
        return False
    except Exception as e:
        stats['failed'] += 1
        stats['errors'].append(f"{os.path.basename(input_path)}: {e}")
        return False


def _convert_pillow(input_path, output_path, num_frames, stats):
    try:
        from PIL import Image
        img = Image.open(input_path)
        w, h = img.size
        if num_frames > 1:
            frame_width = w // num_frames
            frame_ratio = frame_width / h if h > 0 else 0
            if 1.5 <= frame_ratio <= 3.5:
                img = img.crop((0, 0, frame_width, h))
                w = frame_width
        elif w / h > 3.5:
            frame_w = round(h * 2.348)
            img = img.crop((0, 0, frame_w, h))
            w = frame_w
        # Resize to max 480px wide
        if w > 480:
            new_h = round(h * 480 / w)
            img = img.resize((480, new_h), Image.LANCZOS)
        if img.mode in ('RGBA', 'LA'):
            img.save(output_path, 'WEBP', quality=80, method=4)
        else:
            img.convert('RGB').save(output_path, 'WEBP', quality=80, method=4)
        return True
    except ImportError:
        stats['failed'] += 1
        stats['errors'].append(f"{os.path.basename(input_path)}: no converter (install ImageMagick or Pillow)")
        return False
    except Exception as e:
        stats['failed'] += 1
        stats['errors'].append(f"{os.path.basename(input_path)}: {e}")
        return False


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
