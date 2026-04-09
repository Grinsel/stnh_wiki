"""
Galaxy Map JSON generator + Flag image converter for STNH wiki.

Reads:
  - prescripted_countries/STH_*.txt -> empire ID, initializer, trek flag file
  - map/setup_scenarios/*.txt       -> initializer -> {x, y, system_name}

Outputs:

  - assets/galaxy_map.json          -> empire homeworld positions (default map, backward compat)
  - assets/galaxy_maps.json         -> all non-random STNH map presets
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
MOD_GALAXY_SCENARIOS_DIR = os.path.join(STNH_MOD_ROOT, "map", "setup_scenarios")
MOD_GALAXY_MAP_FILE = os.path.join(
    MOD_GALAXY_SCENARIOS_DIR,
    "01 STH_galaxy_default_galaxy_map.txt",
)
OUTPUT_FLAGS_TREK_DIR = os.path.join(WIKI_ROOT, "assets", "flags", "trek")

# ─── Non-random map definitions ──────────────────────────────────────────────
# type: full_galaxy | mirror_galaxy | alpha_beta | mirror_alpha_beta |
#       gamma | delta | botf
# era:  classic | tng

MAP_DEFINITIONS = [
    {
        'file': '01 STH_galaxy_default_galaxy_map.txt',
        'id': 'default',
        'label': 'Default Galaxy (All Races)',
        'type': 'full_galaxy',
        'era': 'classic',
    },
    {
        'file': '02 STH_galaxy_medium_galaxy_map.txt',
        'id': 'medium',
        'label': 'Medium Galaxy (~30 Races)',
        'type': 'full_galaxy',
        'era': 'classic',
    },
    {
        'file': '03 STH_galaxy_alpha_beta_quadrant.txt',
        'id': 'alpha_beta',
        'label': 'Alpha/Beta Quadrant (Large)',
        'type': 'alpha_beta',
        'era': 'classic',
    },
    {
        'file': '04 STH_galaxy_tiny_alpha_beta.txt',
        'id': 'alpha_beta_small',
        'label': 'Alpha/Beta Quadrant (Small)',
        'type': 'alpha_beta',
        'era': 'classic',
    },
    {
        'file': '05 STH_galaxy_delta_quadrant.txt',
        'id': 'delta',
        'label': 'Delta Quadrant',
        'type': 'delta',
        'era': 'classic',
    },
    {
        'file': '06 STH_galaxy_gamma_quadrant.txt',
        'id': 'gamma',
        'label': 'Gamma Quadrant',
        'type': 'gamma',
        'era': 'classic',
    },
    {
        'file': '07 STH_galaxy_mirror_galaxy_map.txt',
        'id': 'mirror',
        'label': 'Mirror Universe (Full)',
        'type': 'mirror_galaxy',
        'era': 'classic',
    },
    {
        'file': '08 STH_galaxy_alpha_beta_mirror.txt',
        'id': 'alpha_beta_mirror',
        'label': 'Mirror Universe (Alpha/Beta)',
        'type': 'mirror_alpha_beta',
        'era': 'classic',
    },
    {
        'file': '09 STH_galaxy_botf_map.txt',
        'id': 'botf',
        'label': 'Birth of the Federation',
        'type': 'botf',
        'era': 'classic',
    },
    {
        'file': '17 STH_galaxy_new_lore_galaxy_map.txt',
        'id': 'lore',
        'label': 'Lore Galaxy Map',
        'type': 'full_galaxy',
        'era': 'classic',
    },
    {
        'file': '18 STH_galaxy_mirror_new_lore_galaxy_map.txt',
        'id': 'mirror_lore',
        'label': 'Mirror Lore Galaxy',
        'type': 'mirror_galaxy',
        'era': 'classic',
    },
    {
        'file': '19 STH_galaxy_tng_galaxy_map.txt',
        'id': 'tng',
        'label': 'TNG Galaxy Map',
        'type': 'full_galaxy',
        'era': 'tng',
    },
    {
        'file': '20 STH_galaxy_tng_lore_galaxy_map.txt',
        'id': 'tng_lore',
        'label': 'TNG Lore Galaxy Map',
        'type': 'full_galaxy',
        'era': 'tng',
    },
    {
        'file': '21 STH_galaxy_mirror_tng_galaxy_map.txt',
        'id': 'tng_mirror',
        'label': 'TNG Mirror Universe',
        'type': 'mirror_galaxy',
        'era': 'tng',
    },
    {
        'file': '22 STH_galaxy_mirror_tng_lore_galaxy_map.txt',
        'id': 'tng_mirror_lore',
        'label': 'TNG Mirror Lore',
        'type': 'mirror_galaxy',
        'era': 'tng',
    },
    {
        'file': '23 STH_galaxy_default_b_galaxy_map.txt',
        'id': 'default_b',
        'label': 'Default Galaxy (Variant B)',
        'type': 'full_galaxy',
        'era': 'classic',
    },
]

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


# ─── Scenario name reader ─────────────────────────────────────────────────────

def _parse_scenario_name(filepath):
    """Read the internal name = "..." from the first matching line of a
    setup_scenario file.  This is also the galaxy_size / localisation key."""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for line in f:
                m = re.match(r'\s*name\s*=\s*"([^"]+)"', line)
                if m:
                    return m.group(1)
    except OSError:
        pass
    return ''


# ─── Galaxy Map Parser ────────────────────────────────────────────────────────

def _midpoint(lo, hi):
    return (float(lo) + float(hi)) / 2.0


def parse_galaxy_map(filepath):
    """Parse galaxy map file. Returns dict: initializer -> {x, y, system_name}.
    Supports two position formats:
      A: position = { x = { min = N max = N } y = { min = N max = N } }
      B: position = { x = N y = M }
    Also handles multi-line system blocks via brace-depth parsing.
    """
    result = {}
    if not os.path.isfile(filepath):
        print(f"  [WARN] Galaxy map file not found: {filepath}")
        return result

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    init_pat  = re.compile(r'\binitializer\s*=\s*(\w+)')
    name_pat  = re.compile(r'\bname\s*=\s*"([^"]*)"')
    # Position format A: min/max blocks
    pos_a = re.compile(
        r'position\s*=\s*\{\s*x\s*=\s*\{\s*min\s*=\s*(-?\d+(?:\.\d+)?)\s+max\s*=\s*(-?\d+(?:\.\d+)?)\s*\}\s*'
        r'y\s*=\s*\{\s*min\s*=\s*(-?\d+(?:\.\d+)?)\s+max\s*=\s*(-?\d+(?:\.\d+)?)\s*\}'
    )
    # Position format B: direct x/y values
    pos_b = re.compile(r'position\s*=\s*\{\s*x\s*=\s*(-?\d+(?:\.\d+)?)\s+y\s*=\s*(-?\d+(?:\.\d+)?)\s*\}')

    i = 0
    while i < len(content):
        # Find next system block
        m = re.search(r'\bsystem\s*=\s*\{', content[i:])
        if not m:
            break
        brace_pos = i + m.end() - 1   # index of the opening '{'

        # Collect entire block with brace-depth tracking (handles multi-line entries)
        depth = 1
        j = brace_pos + 1
        while j < len(content) and depth > 0:
            if content[j] == '{':  depth += 1
            elif content[j] == '}': depth -= 1
            j += 1

        block = content[i + m.start(): j]
        i = j  # advance past this block

        # Flatten whitespace so regexes work on multi-line blocks
        flat = ' '.join(block.split())

        init_m = init_pat.search(flat)
        if not init_m:
            continue
        initializer = init_m.group(1).strip()

        # Try position format A first, then B
        pos_m = pos_a.search(flat)
        if pos_m:
            x = _midpoint(pos_m.group(1), pos_m.group(2))
            y = _midpoint(pos_m.group(3), pos_m.group(4))
        else:
            pos_m = pos_b.search(flat)
            if not pos_m:
                continue
            x = float(pos_m.group(1))
            y = float(pos_m.group(2))

        name_m = name_pat.search(flat)
        system_name = name_m.group(1) if name_m else ''

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

# Empires whose ID prefix marks them as TNG-era.  Classic maps exclude these;
# TNG maps exclude the classic Earth variants below instead.
_TNG_EMPIRE_PREFIXES = ('tng',)

# Classic Earth variants that stack on top of their TNG equivalents on TNG-era maps.
_CLASSIC_EARTH_IDS = frozenset({'UnitedEarth', 'ConfederationEarth'})


def _build_placed_list(empire_map_data, coord_lookup, flag_map,
                       name_fallback=None, map_era='classic'):
    """Build placed/unplaced lists for one map's coord_lookup.
    name_fallback: optional dict (initializer -> coords) used when this map's
    system_name is empty (e.g. BotF scenario files use name = "").
    map_era: 'classic' or 'tng' — used to exclude era-mismatched empires that
    share an initializer with their era counterpart (would otherwise stack).
    """
    placed = []
    unplaced = []
    for emp in empire_map_data:
        # Era filter: skip TNG-prefix empires on classic maps and vice versa.
        if map_era == 'classic' and emp['id'].startswith(_TNG_EMPIRE_PREFIXES):
            continue
        if map_era == 'tng' and emp['id'] in _CLASSIC_EARTH_IDS:
            continue
        coords = coord_lookup.get(emp['initializer'])
        if not coords:
            unplaced.append(emp['id'])
            continue
        system_name = coords['system_name']
        if not system_name and name_fallback:
            fb = name_fallback.get(emp['initializer'])
            if fb:
                system_name = fb['system_name']
        flag_img = flag_map.get(emp['trek_dds']) if emp['trek_dds'] else None
        placed.append({
            'id': emp['id'],
            'initializer': emp['initializer'],
            'x': round(coords['x'], 1),
            'y': round(coords['y'], 1),
            'system_name': system_name,
            'source_file': emp['source_file'],
            'quadrant': emp['quadrant'],
            'flag_img': flag_img,
        })
    return placed, unplaced


def _filter_stub_positions(placed, min_cluster=5):
    """Remove empires whose x-coordinate is shared with min_cluster or more others.

    Some scenario files (e.g. medium galaxy) assign a single fixed x-column to
    all empire homeworlds that aren't part of the map's intended race set.
    These mass-assigned stub positions produce clusters of 10-20 empires at an
    identical x, often on the wrong side of the galactic center.  By stripping
    any empire whose rounded x appears >= min_cluster times we remove the
    placeholders while keeping all individually placed homeworlds.
    """
    from collections import Counter
    x_counts = Counter(round(e['x']) for e in placed)
    stub_xs = {x for x, cnt in x_counts.items() if cnt >= min_cluster}
    if not stub_xs:
        return placed, []
    filtered  = [e for e in placed if round(e['x']) not in stub_xs]
    removed   = [e['id'] for e in placed if round(e['x']) in stub_xs]
    return filtered, removed


def _compute_bounds(placed):
    if not placed:
        return {'x_min': -500, 'x_max': 500, 'y_min': -500, 'y_max': 500}
    xs = [p['x'] for p in placed]
    ys = [p['y'] for p in placed]
    # Add 10 % margin so extreme-edge empires don't get clipped by the SVG edge-fade mask.
    x_pad = max((max(xs) - min(xs)) * 0.10, 30)
    y_pad = max((max(ys) - min(ys)) * 0.10, 30)
    return {
        'x_min': min(xs) - x_pad,
        'x_max': max(xs) + x_pad,
        'y_min': min(ys) - y_pad,
        'y_max': max(ys) + y_pad,
    }


def generate_galaxy_map(force_flags=False):
    """Main entry point. Returns stats dict."""
    start = time.time()

    print("\n  [1/5] Parsing prescripted empire data...")
    empire_map_data = parse_prescripted_empires_for_map(
        MOD_PRESCRIPTED_COUNTRIES_DIR, STH_FILE_ORDER,
    )
    print(f"    {len(empire_map_data)} empires with initializers")

    print("  [2/5] Converting trek flag images (DDS -> WebP)...")
    needed_dds = {e['trek_dds'] for e in empire_map_data if e['trek_dds']}
    flag_map = convert_trek_flags(needed_dds, force=force_flags)

    # ── Default map (galaxy_map.json, backward compat) ────────────────────────
    print("  [3/5] Building galaxy_map.json (default map)...")
    coord_lookup_default = parse_galaxy_map(MOD_GALAXY_MAP_FILE)
    placed_default, unplaced_default = _build_placed_list(
        empire_map_data, coord_lookup_default, flag_map,
    )
    output_default = {'empires': placed_default, 'bounds': _compute_bounds(placed_default)}
    with open(os.path.join(OUTPUT_ASSETS_DIR, 'galaxy_map.json'), 'w', encoding='utf-8') as f:
        json.dump(output_default, f, ensure_ascii=False, separators=(',', ':'))
    print(f"    {len(placed_default)} placed, {len(unplaced_default)} unplaced")

    # ── All non-random maps (galaxy_maps.json) ────────────────────────────────
    print("  [4/5] Building galaxy_maps.json (all non-random maps)...")
    all_maps = []
    total_unplaced = set()
    for map_def in MAP_DEFINITIONS:
        map_file = os.path.join(MOD_GALAXY_SCENARIOS_DIR, map_def['file'])
        coords = parse_galaxy_map(map_file)
        placed, unplaced = _build_placed_list(empire_map_data, coords, flag_map,
                                              name_fallback=coord_lookup_default,
                                              map_era=map_def['era'])
        placed, stub_removed = _filter_stub_positions(placed)
        if stub_removed:
            print(f"      stub filter: removed {len(stub_removed)} ({', '.join(stub_removed[:6])}{'...' if len(stub_removed)>6 else ''})")
        total_unplaced.update(unplaced)
        loc_key = _parse_scenario_name(map_file)
        all_maps.append({
            'id': map_def['id'],
            'label': map_def['label'],
            'loc_key': loc_key,
            'type': map_def['type'],
            'era': map_def['era'],
            'empires': placed,
            'bounds': _compute_bounds(placed),
        })
        print(f"    {map_def['id']}: {len(placed)} empires")

    output_maps = {'maps': all_maps}
    with open(os.path.join(OUTPUT_ASSETS_DIR, 'galaxy_maps.json'), 'w', encoding='utf-8') as f:
        json.dump(output_maps, f, ensure_ascii=False, separators=(',', ':'))

    elapsed = time.time() - start
    print(f"\n  [5/5] Done — {len(all_maps)} maps, {elapsed:.1f}s")

    return {
        'placed': len(placed_default),
        'unplaced': len(unplaced_default),
        'maps': len(all_maps),
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
