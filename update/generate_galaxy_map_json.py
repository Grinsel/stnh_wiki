"""
Galaxy Map JSON generator + Flag image converter for STNH wiki.

Reads:
  - prescripted_countries/STH_*.txt -> empire ID, initializer, trek flag file
  - map/setup_scenarios/*.txt       -> initializer -> {x, y, system_name}

Outputs:
  - assets/galaxy_map.json          -> empire homeworld positions
  - assets/flags/trek/*.webp        -> converted flag images
"""

import os
import re
import json
import time

from config import (
    STNH_MOD_ROOT,
    OUTPUT_ASSETS_DIR,
    WIKI_ROOT,
    MOD_PRESCRIPTED_COUNTRIES_DIR,
)

# ─── Paths ────────────────────────────────────────────────────────────────────

MOD_FLAGS_TREK_DIR = os.path.join(STNH_MOD_ROOT, "flags", "trek")
MOD_GALAXY_MAP_FILE = os.path.join(
    STNH_MOD_ROOT, "map", "setup_scenarios",
    "01 STH_galaxy_default_galaxy_map.txt",
)
OUTPUT_FLAGS_TREK_DIR = os.path.join(WIKI_ROOT, "assets", "flags", "trek")

# STH country files we care about (major + quadrant files)
STH_FILE_ORDER = [
    "STH_00_major_powers.txt",
    "STH_01_alpha_quadrant.txt",
    "STH_02_beta_quadrant.txt",
    "STH_03_gamma_quadrant.txt",
    "STH_04_delta_quadrant.txt",
    "STH_05_alt.txt",
]

QUADRANT_LABELS = {
    "STH_00_major_powers.txt": "Major Powers",
    "STH_01_alpha_quadrant.txt": "Alpha Quadrant",
    "STH_02_beta_quadrant.txt": "Beta Quadrant",
    "STH_03_gamma_quadrant.txt": "Gamma Quadrant",
    "STH_04_delta_quadrant.txt": "Delta Quadrant",
    "STH_05_alt.txt": "Alternate Timeline",
}


# ─── Galaxy Map Parser ────────────────────────────────────────────────────────

def _midpoint(lo, hi):
    return (float(lo) + float(hi)) / 2.0


def parse_galaxy_map(filepath):
    """Parse galaxy map file. Returns dict: initializer -> {x, y, system_name}."""
    result = {}
    if not os.path.isfile(filepath):
        print(f"  [WARN] Galaxy map file not found: {filepath}")
        return result

    # Pattern: system = { ... initializer = NAME ... position = { x = { min M max M } y = { min M max M } } ... }
    # Each system is on a single long line
    sys_pat = re.compile(
        r'system\s*=\s*\{[^}]*?'
        r'name\s*=\s*"([^"]*)"[^}]*?'
        r'position\s*=\s*\{\s*x\s*=\s*\{\s*min\s*=\s*(-?\d+(?:\.\d+)?)\s+max\s*=\s*(-?\d+(?:\.\d+)?)\s*\}\s*'
        r'y\s*=\s*\{\s*min\s*=\s*(-?\d+(?:\.\d+)?)\s+max\s*=\s*(-?\d+(?:\.\d+)?)\s*\}',
        re.DOTALL,
    )
    init_pat = re.compile(r'\binitializer\s*=\s*(\w+)')

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Split into individual system blocks (each line starts with "system = {")
    lines = content.splitlines()
    for line in lines:
        line = line.strip()
        if not line.startswith('system') and 'system' not in line[:20]:
            continue

        init_m = init_pat.search(line)
        if not init_m:
            continue
        initializer = init_m.group(1).strip()

        # Extract coords from position block
        pos_m = re.search(
            r'position\s*=\s*\{\s*x\s*=\s*\{\s*min\s*=\s*(-?\d+(?:\.\d+)?)\s+max\s*=\s*(-?\d+(?:\.\d+)?)\s*\}\s*'
            r'y\s*=\s*\{\s*min\s*=\s*(-?\d+(?:\.\d+)?)\s+max\s*=\s*(-?\d+(?:\.\d+)?)\s*\}',
            line,
        )
        if not pos_m:
            continue

        name_m = re.search(r'name\s*=\s*"([^"]*)"', line)
        system_name = name_m.group(1) if name_m else ''

        x = _midpoint(pos_m.group(1), pos_m.group(2))
        y = _midpoint(pos_m.group(3), pos_m.group(4))

        # Only keep first occurrence (homeworld entries are first)
        if initializer not in result:
            result[initializer] = {'x': x, 'y': y, 'system_name': system_name}

    return result


# ─── Prescripted Country Parser ───────────────────────────────────────────────

_INIT_PAT = re.compile(r'\binitializer\s*=\s*"?(\w+)"?')
_FLAG_BLOCK_PAT = re.compile(
    r'empire_flag\s*=\s*\{(.*?)\n\s*\}(?:\s*\n\s*\})?',
    re.DOTALL,
)
_ICON_PAT = re.compile(
    r'icon\s*=\s*\{[^}]*?category\s*=\s*"?(\w+)"?[^}]*?file\s*=\s*"([^"]+)"',
    re.DOTALL,
)
_ICON_PAT2 = re.compile(
    r'icon\s*=\s*\{[^}]*?file\s*=\s*"([^"]+)"[^}]*?category\s*=\s*"?(\w+)"?',
    re.DOTALL,
)
_EMPIRE_NAME_PAT = re.compile(r'^(\w+)\s*=\s*\{', re.MULTILINE)


def _parse_empire_block(empire_id, text):
    """Extract initializer and trek flag file from a single empire block."""
    init_m = _INIT_PAT.search(text)
    initializer = init_m.group(1) if init_m else None

    trek_flag = None
    # Look for empire_flag block containing icon with category="trek"
    flag_m = _FLAG_BLOCK_PAT.search(text)
    if flag_m:
        icon_block = flag_m.group(1)
        m = _ICON_PAT.search(icon_block) or _ICON_PAT2.search(icon_block)
        if m:
            if m.lastindex == 2:
                cat, fn = (m.group(1), m.group(2)) if 'category' in m.group(0)[:m.start(2) - m.start()] else (m.group(2), m.group(1))
                # try both orders
                cat_m = re.search(r'category\s*=\s*"?(\w+)"?', icon_block)
                file_m = re.search(r'file\s*=\s*"([^"]+)"', icon_block)
                if cat_m and file_m:
                    if cat_m.group(1).lower() == 'trek':
                        trek_flag = file_m.group(1)

    return initializer, trek_flag


def parse_prescripted_empires_for_map(files_root, filenames):
    """
    Parse STH_*.txt files to extract initializer + trek flag for each empire.
    Returns list of dicts: {id, initializer, trek_dds, source_file, quadrant}.
    """
    results = []
    seen_ids = set()

    for filename in filenames:
        filepath = os.path.join(files_root, filename)
        if not os.path.isfile(filepath):
            continue

        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        # Find each top-level empire block: EMPIRE_ID = { ... }
        # Split on top-level identifiers followed by = {
        # Strategy: find all "WORD = {" at column 0, extract block content
        entries = re.findall(
            r'^(\w+)\s*=\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}',
            content,
            re.MULTILINE | re.DOTALL,
        )

        for empire_id, block_text in entries:
            if empire_id in seen_ids:
                continue
            seen_ids.add(empire_id)

            initializer, trek_dds = _parse_empire_block(empire_id, block_text)
            if initializer:
                results.append({
                    'id': empire_id,
                    'initializer': initializer,
                    'trek_dds': trek_dds,
                    'source_file': filename,
                    'quadrant': QUADRANT_LABELS.get(filename, filename),
                })

    return results


# ─── Flag Converter ───────────────────────────────────────────────────────────

def convert_trek_flags(trek_dds_files, force=False):
    """
    Convert needed DDS flag files to WebP using Pillow.
    trek_dds_files: set of .dds filenames (e.g. {"Klingon.dds", "borg.dds"})
    Returns dict: dds_filename -> output webp relative path (or None on failure).
    """
    try:
        from PIL import Image
    except ImportError:
        print("  [WARN] Pillow not installed. Skipping flag image conversion.")
        return {}

    os.makedirs(OUTPUT_FLAGS_TREK_DIR, exist_ok=True)

    results = {}
    converted = skipped = failed = 0

    for dds_fn in sorted(trek_dds_files):
        if not dds_fn:
            continue
        src = os.path.join(MOD_FLAGS_TREK_DIR, dds_fn)
        if not os.path.isfile(src):
            failed += 1
            continue

        stem = os.path.splitext(dds_fn)[0]
        out_fn = stem + '.webp'
        out_path = os.path.join(OUTPUT_FLAGS_TREK_DIR, out_fn)

        if not force and os.path.isfile(out_path):
            skipped += 1
            results[dds_fn] = f'assets/flags/trek/{out_fn}'
            continue

        try:
            img = Image.open(src).convert('RGBA')
            img = img.resize((64, 64), Image.LANCZOS)
            img.save(out_path, 'WEBP', quality=85)
            results[dds_fn] = f'assets/flags/trek/{out_fn}'
            converted += 1
        except Exception as e:
            print(f"    [WARN] Flag conversion failed for {dds_fn}: {e}")
            failed += 1

    print(f"  Flag images: {converted} converted, {skipped} skipped, {failed} failed")
    return results


# ─── Main generator ───────────────────────────────────────────────────────────

def generate_galaxy_map(force_flags=False):
    """Main entry point. Returns stats dict."""
    start = time.time()

    print("\n  [1/4] Parsing galaxy map coordinates...")
    coord_lookup = parse_galaxy_map(MOD_GALAXY_MAP_FILE)
    print(f"    {len(coord_lookup)} initializer positions found")

    print("  [2/4] Parsing prescripted empire data...")
    empire_map_data = parse_prescripted_empires_for_map(
        MOD_PRESCRIPTED_COUNTRIES_DIR, STH_FILE_ORDER,
    )
    print(f"    {len(empire_map_data)} empires with initializers")

    print("  [3/4] Converting trek flag images (DDS -> WebP)...")
    needed_dds = {e['trek_dds'] for e in empire_map_data if e['trek_dds']}
    flag_map = convert_trek_flags(needed_dds, force=force_flags)

    print("  [4/4] Building galaxy_map.json...")
    placed = []
    unplaced = []

    for emp in empire_map_data:
        coords = coord_lookup.get(emp['initializer'])
        if not coords:
            unplaced.append(emp['id'])
            continue

        flag_img = flag_map.get(emp['trek_dds']) if emp['trek_dds'] else None

        placed.append({
            'id': emp['id'],
            'initializer': emp['initializer'],
            'x': round(coords['x'], 1),
            'y': round(coords['y'], 1),
            'system_name': coords['system_name'],
            'source_file': emp['source_file'],
            'quadrant': emp['quadrant'],
            'flag_img': flag_img,
        })

    if unplaced:
        print(f"    [INFO] {len(unplaced)} empires with no map position: {', '.join(unplaced[:8])}{'...' if len(unplaced) > 8 else ''}")

    # Compute bounds for the JS renderer
    if placed:
        xs = [p['x'] for p in placed]
        ys = [p['y'] for p in placed]
        bounds = {
            'x_min': min(xs), 'x_max': max(xs),
            'y_min': min(ys), 'y_max': max(ys),
        }
    else:
        bounds = {'x_min': -500, 'x_max': 500, 'y_min': -500, 'y_max': 500}

    output = {'empires': placed, 'bounds': bounds}
    output_path = os.path.join(OUTPUT_ASSETS_DIR, 'galaxy_map.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    elapsed = time.time() - start
    print(f"  Galaxy map: {len(placed)} placed, {len(unplaced)} unplaced — {elapsed:.1f}s")

    return {
        'placed': len(placed),
        'unplaced': len(unplaced),
        'flags_converted': sum(1 for v in flag_map.values() if v),
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--force-flags', action='store_true', help='Re-convert all flag images')
    args = ap.parse_args()
    print("=== Galaxy Map Generator ===")
    stats = generate_galaxy_map(force_flags=args.force_flags)
    print(f"\nDone: {stats}")
