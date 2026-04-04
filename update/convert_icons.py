"""
Generic icon converter for all wiki modules.
Converts DDS icon files to WebP format using ImageMagick.
Replaces convert_building_icons.py with a unified approach.
"""

import os
import json
import subprocess
import time
from config import (
    OUTPUT_ICONS_DIR, OUTPUT_ASSETS_DIR, STNH_MOD_ROOT, VANILLA_ROOT,
    MOD_GFX_BUILDINGS_ICONS, VANILLA_GFX_BUILDINGS_ICONS,
    MOD_GFX_TRAITS_ICONS, VANILLA_GFX_TRAITS_ICONS,
    MOD_GFX_TRADITIONS_ICONS, VANILLA_GFX_TRADITIONS_ICONS,
    MOD_GFX_ASCENSION_PERKS_ICONS, VANILLA_GFX_ASCENSION_PERKS_ICONS,
    MOD_GFX_CIVICS_ICONS, VANILLA_GFX_CIVICS_ICONS,
    MOD_GFX_AUTHORITIES_ICONS, VANILLA_GFX_AUTHORITIES_ICONS,
    MOD_GFX_JOBS_ICONS, VANILLA_GFX_JOBS_ICONS,
    MOD_GFX_DEPOSITS_ICONS, VANILLA_GFX_DEPOSITS_ICONS,
    MOD_GFX_RELICS_ICONS, VANILLA_GFX_RELICS_ICONS,
    MOD_FLAGS_DIR, VANILLA_FLAGS_DIR,
)

ICON_CATEGORIES = [
    {
        'name': 'buildings',
        'mod': [MOD_GFX_BUILDINGS_ICONS],
        'vanilla': [VANILLA_GFX_BUILDINGS_ICONS],
        'output': 'buildings',
        'size': '64x64',
    },
    {
        'name': 'traits',
        'mod': [MOD_GFX_TRAITS_ICONS],
        'vanilla': [VANILLA_GFX_TRAITS_ICONS],
        'output': 'traits',
        'size': '64x64',
        'recursive': True,
    },
    {
        'name': 'traditions',
        'mod': [MOD_GFX_TRADITIONS_ICONS],
        'vanilla': [VANILLA_GFX_TRADITIONS_ICONS],
        'output': 'traditions',
        'size': '64x64',
        'recursive': True,
    },
    {
        'name': 'ascension_perks',
        'mod': [MOD_GFX_ASCENSION_PERKS_ICONS],
        'vanilla': [VANILLA_GFX_ASCENSION_PERKS_ICONS],
        'output': 'ascension_perks',
        'size': '64x64',
    },
    {
        'name': 'civics',
        'mod': [MOD_GFX_CIVICS_ICONS],
        'vanilla': [VANILLA_GFX_CIVICS_ICONS],
        'output': 'civics',
        'size': '64x64',
    },
    {
        'name': 'authorities',
        'mod': [MOD_GFX_AUTHORITIES_ICONS],
        'vanilla': [VANILLA_GFX_AUTHORITIES_ICONS],
        'output': 'authorities',
        'size': '64x64',
    },
    {
        'name': 'jobs',
        'mod': [MOD_GFX_JOBS_ICONS],
        'vanilla': [VANILLA_GFX_JOBS_ICONS],
        'output': 'jobs',
        'size': '64x64',
    },
    {
        'name': 'deposits',
        'mod': [MOD_GFX_DEPOSITS_ICONS],
        'vanilla': [VANILLA_GFX_DEPOSITS_ICONS],
        'output': 'deposits',
        'size': '64x64',
    },
    {
        'name': 'relics',
        'mod': [MOD_GFX_RELICS_ICONS],
        'vanilla': [VANILLA_GFX_RELICS_ICONS],
        'output': 'relics',
        'size': '152x152',
        'exclude': '_shine',
    },
    {
        'name': 'flags',
        'mod': [MOD_FLAGS_DIR],
        'vanilla': [VANILLA_FLAGS_DIR],
        'output': 'flags',
        'size': '128x128',
        'flags_lookup': True,
        'exclude': 'backgrounds',
    },
    {
        'name': 'edicts',
        'output': 'edicts',
        'size': '64x64',
        'gfx_resolve': True,
        'json_file': 'edicts.json',
        'icon_field': 'icon',
    },
    {
        'name': 'policies',
        'output': 'policies',
        'size': '64x64',
        'gfx_resolve': True,
        'json_file': 'policies.json',
        'icon_field': 'options[].icon',
    },
]


def _build_dds_lookup(src_dirs, recursive=False):
    """Build stem -> full_path lookup from source directories.
    Earlier dirs have lower priority (vanilla first, mod overrides).
    """
    lookup = {}
    for src_dir in src_dirs:
        if not os.path.isdir(src_dir):
            continue
        if recursive:
            for root, dirs, files in os.walk(src_dir):
                for fn in files:
                    if fn.lower().endswith('.dds'):
                        stem = fn[:-4]
                        lookup[stem] = os.path.join(root, fn)
        else:
            for fn in os.listdir(src_dir):
                if fn.lower().endswith('.dds'):
                    stem = fn[:-4]
                    lookup[stem] = os.path.join(src_dir, fn)
    return lookup


def _build_gfx_resolve_lookup(config):
    """Build stem -> DDS path lookup by resolving GFX names through pictures_map.json.
    Collects unique icon stems from the JSON data, looks up GFX_<stem> in pictures_map,
    and resolves the texture_path to an actual DDS file (mod before vanilla).
    """
    # Load pictures_map
    pmap_path = os.path.join(OUTPUT_ASSETS_DIR, 'pictures_map.json')
    if not os.path.exists(pmap_path):
        print(f"  [WARN] pictures_map.json not found, run parse_gfx_mappings first")
        return {}
    with open(pmap_path, 'r', encoding='utf-8') as f:
        pictures_map = json.load(f)

    # Load the data JSON to collect unique icon stems
    json_path = os.path.join(OUTPUT_ASSETS_DIR, config['json_file'])
    if not os.path.exists(json_path):
        print(f"  [WARN] {config['json_file']} not found")
        return {}
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Collect unique stems from icon_field (supports nested like 'options[].icon')
    stems = set()
    field = config['icon_field']
    if '[].' in field:
        arr_key, sub_key = field.split('[].', 1)
        for item in data:
            for sub in (item.get(arr_key) or []):
                v = sub.get(sub_key)
                if v:
                    stems.add(v)
    else:
        for item in data:
            v = item.get(field)
            if v:
                stems.add(v)

    # Resolve each stem via pictures_map -> texture_path -> DDS file
    lookup = {}
    for stem in stems:
        gfx_name = f"GFX_{stem}"
        entry = pictures_map.get(gfx_name)
        if not entry:
            continue
        tex_path = entry.get('texture_path', '')
        # Try mod first, then vanilla
        for root in [STNH_MOD_ROOT, VANILLA_ROOT]:
            full_path = os.path.join(root, tex_path.replace('/', os.sep))
            if os.path.exists(full_path):
                lookup[stem] = full_path
                break

    return lookup


def _build_flags_dds_lookup(src_dirs):
    """Build category__stem -> full_path lookup for flag directories.
    Flag dirs contain category subfolders (trek/, human/, etc.).
    Earlier dirs have lower priority (vanilla first, mod overrides).
    """
    lookup = {}
    for src_dir in src_dirs:
        if not os.path.isdir(src_dir):
            continue
        for category in os.listdir(src_dir):
            cat_path = os.path.join(src_dir, category)
            if not os.path.isdir(cat_path):
                continue
            for fn in os.listdir(cat_path):
                if fn.lower().endswith('.dds'):
                    stem = fn[:-4]
                    key = f"{category}__{stem}"
                    lookup[key] = os.path.join(cat_path, fn)
    return lookup


def convert_category(config, force=False):
    """Convert all DDS icons for one category. Returns stats dict."""
    stats = {'total': 0, 'converted': 0, 'skipped': 0, 'failed': 0, 'errors': []}

    src_dirs = config.get('vanilla', []) + config.get('mod', [])
    recursive = config.get('recursive', False)
    exclude = config.get('exclude', None)

    if config.get('gfx_resolve'):
        dds_lookup = _build_gfx_resolve_lookup(config)
    elif config.get('flags_lookup'):
        dds_lookup = _build_flags_dds_lookup(src_dirs)
    else:
        dds_lookup = _build_dds_lookup(src_dirs, recursive=recursive)

    # Filter excluded stems
    if exclude:
        dds_lookup = {k: v for k, v in dds_lookup.items() if exclude not in k}

    if not dds_lookup:
        return stats

    output_dir = os.path.join(OUTPUT_ICONS_DIR, config['output'])
    os.makedirs(output_dir, exist_ok=True)
    size = config.get('size', '64x64')

    for stem in sorted(dds_lookup.keys()):
        input_path = dds_lookup[stem]
        output_path = os.path.join(output_dir, f"{stem}.webp")
        stats['total'] += 1

        if not force and os.path.exists(output_path):
            stats['skipped'] += 1
            continue

        try:
            result = subprocess.run(
                ['magick', input_path, '-resize', size, '-quality', '80', output_path],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                stats['converted'] += 1
            else:
                stats['failed'] += 1
                stats['errors'].append(f"{stem}: {result.stderr[:200]}")
        except FileNotFoundError:
            print(f"  [ERROR] ImageMagick not found. Install it to convert icons.")
            stats['failed'] += 1
            break
        except Exception as e:
            stats['failed'] += 1
            stats['errors'].append(f"{stem}: {e}")

    return stats


def convert_all_icons(categories=None, force=False):
    """Convert icons for all (or specified) categories. Returns combined stats."""
    all_stats = {}
    total = {'total': 0, 'converted': 0, 'skipped': 0, 'failed': 0}

    for cat in ICON_CATEGORIES:
        if categories and cat['name'] not in categories:
            continue
        stats = convert_category(cat, force=force)
        all_stats[cat['name']] = stats
        for k in total:
            total[k] += stats[k]
        print(f"  {cat['name']:20s}  total={stats['total']:4d}  "
              f"new={stats['converted']:4d}  skip={stats['skipped']:4d}  "
              f"fail={stats['failed']:2d}")
        if stats['errors']:
            for err in stats['errors'][:3]:
                print(f"    [ERR] {err}")

    return {'categories': all_stats, 'total': total}


def main():
    print("=== Converting All Icons (DDS -> WebP) ===")
    start = time.time()
    result = convert_all_icons()
    elapsed = time.time() - start

    t = result['total']
    print(f"\n  Grand total:  {t['total']} icons")
    print(f"  Converted:    {t['converted']}")
    print(f"  Skipped:      {t['skipped']}")
    print(f"  Failed:       {t['failed']}")
    print(f"  Time:         {elapsed:.1f}s")


if __name__ == '__main__':
    main()
