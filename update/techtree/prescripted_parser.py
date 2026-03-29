"""
Prescripted Countries Parser for STNH Techtree

Parses prescripted_countries files to extract all playable empires
with their graphical_culture and quadrant information.

Output: List of empire dicts for empires.json
"""

import os
import re
from pathlib import Path

# Import config for paths
try:
    from config import STNH_MOD_ROOT
except ImportError:
    STNH_MOD_ROOT = r"C:\Users\marcj\git01\New-Horizons-Development"


# Quadrant mapping from filename
FILENAME_TO_QUADRANT = {
    'STH_00_major_powers.txt': 'major',
    'STH_01_alpha_quadrant.txt': 'alpha',
    'STH_02_beta_quadrant.txt': 'beta',
    'STH_03_gamma_quadrant.txt': 'gamma',
    'STH_04_delta_quadrant.txt': 'delta',
    'STH_05_alt.txt': 'alternate',
}


def parse_prescripted_countries(prescripted_dir, loc_loader=None):
    """
    Parse all prescripted_countries files.

    Args:
        prescripted_dir: Path to prescripted_countries directory
        loc_loader: Optional LocLoader for name resolution

    Returns:
        List of empire dicts
    """
    empires = []

    files = [f for f in os.listdir(prescripted_dir) if f.startswith('STH_') and f.endswith('.txt')]
    print(f"[Prescripted Parser] Scanning {len(files)} prescripted_countries files...")

    for filename in sorted(files):
        quadrant = FILENAME_TO_QUADRANT.get(filename, 'unknown')
        filepath = os.path.join(prescripted_dir, filename)

        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                content = f.read()
        except Exception as e:
            print(f"  [WARNING] Could not read {filename}: {e}")
            continue

        # Parse each country block
        file_empires = parse_country_blocks(content, quadrant, loc_loader)
        empires.extend(file_empires)

    print(f"[Prescripted Parser] Found {len(empires)} empires")
    return empires


def parse_country_blocks(content, quadrant, loc_loader=None):
    """
    Parse country blocks from file content.

    Returns:
        List of empire dicts
    """
    empires = []

    # Find all top-level country definitions
    # Pattern: CountryName = {
    current_pos = 0

    while True:
        # Match country key at start of line
        match = re.search(r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{', content[current_pos:], re.MULTILINE)
        if not match:
            break

        country_key = match.group(1)
        block_start = current_pos + match.end()

        # Skip comments and non-country entries
        if country_key.startswith('#') or country_key in ['empire_flag', 'ruler', 'species']:
            current_pos = block_start
            continue

        # Find matching closing brace
        brace_count = 1
        block_end = block_start
        while brace_count > 0 and block_end < len(content):
            if content[block_end] == '{':
                brace_count += 1
            elif content[block_end] == '}':
                brace_count -= 1
            block_end += 1

        block_content = content[block_start:block_end]

        # Extract fields
        empire = extract_empire_data(country_key, block_content, quadrant, loc_loader)
        if empire:
            empires.append(empire)

        current_pos = block_end

    return empires


def extract_empire_data(country_key, block_content, quadrant, loc_loader=None):
    """
    Extract empire data from a country block.

    Returns:
        Empire dict or None
    """
    # Skip if it's a variant (_B suffix) - we'll handle those separately
    is_variant = country_key.endswith('_B')

    # Extract name key for localization
    name_key = None
    name_match = re.search(r'name\s*=\s*"([^"]+)"', block_content)
    if name_match:
        name_key = name_match.group(1)

    # Extract graphical_culture
    graphical_culture = None
    gc_match = re.search(r'graphical_culture\s*=\s*"?([^"\s\n]+)"?', block_content)
    if gc_match:
        graphical_culture = gc_match.group(1)

    # Extract species class (two formats)
    species_class = None
    # Format 1: species_class="FED"
    sc_match = re.search(r'species_class\s*=\s*"?([^"\s\n]+)"?', block_content)
    if sc_match:
        species_class = sc_match.group(1)
    else:
        # Format 2: species = { class = "FED" ... }
        species_block = re.search(r'species\s*=\s*\{([^}]+)\}', block_content, re.DOTALL)
        if species_block:
            class_match = re.search(r'class\s*=\s*"?([^"\s\n]+)"?', species_block.group(1))
            if class_match:
                species_class = class_match.group(1)

    # Extract playable condition
    playable_condition = None
    playable_match = re.search(r'playable\s*=\s*(\w+)', block_content)
    if playable_match:
        playable_condition = playable_match.group(1)

    # Extract ship prefix
    ship_prefix = None
    prefix_match = re.search(r'ship_prefix\s*=\s*"?([^"\s\n]+)"?', block_content)
    if prefix_match:
        ship_prefix = prefix_match.group(1)

    # Resolve name from localization
    display_name = country_key  # Fallback
    if loc_loader and name_key:
        localized = loc_loader.get(name_key)
        if localized:
            display_name = localized

    # Create empire dict
    empire = {
        'id': country_key.lower(),
        'key': country_key,
        'name': display_name,
        'name_key': name_key,
        'quadrant': quadrant,
        'graphical_culture': graphical_culture,
        'species_class': species_class,
        'ship_prefix': ship_prefix,
        'playable_condition': playable_condition,
        'is_variant': is_variant,
    }

    return empire


def build_empires_list(prescripted_dir, loc_loader=None, factions_with_ships=None):
    """
    Build the final empires list with all metadata.

    Args:
        prescripted_dir: Path to prescripted_countries directory
        loc_loader: LocLoader for name resolution
        factions_with_ships: Set of faction names that have unique ships

    Returns:
        List of empire dicts ready for empires.json
    """
    empires = parse_prescripted_countries(prescripted_dir, loc_loader)

    # Mapping from graphical_culture to faction name (for has_unique_ships)
    graphical_culture_to_faction = {
        'federation': 'Federation',
        'fed_01': 'Federation',
        'fed_02': 'Federation',
        'klingon': 'Klingon',
        'kdf_01': 'Klingon',
        'romulan': 'Romulan',
        'rom_01': 'Romulan',
        'cardassian': 'Cardassian',
        'cardassian_01': 'Cardassian',
        'dominion': 'Dominion',
        'dom_01': 'Dominion',
        'borg': 'Borg',
        'borg_01': 'Borg',
        'ferengi': 'Ferengi',
        'ferengi_01': 'Ferengi',
        'breen': 'Breen',
        'breen_01': 'Breen',
        'undine': 'Undine',
        'undine_01': 'Undine',
        'xindi': 'Xindi',
        'xindi_01': 'Xindi',
    }

    factions_with_ships = factions_with_ships or set()

    # Enhance empire data
    result = []
    skipped_count = 0
    for empire in empires:
        # Skip variants for now (they're duplicates with DLC conditions)
        if empire['is_variant']:
            skipped_count += 1
            continue

        name = empire['name']

        # Skip submod duplicates (2300s submod)
        if '2300s' in name or '2300' in empire.get('name_key', ''):
            skipped_count += 1
            continue

        # Skip entries with unresolved localization codes
        if '£' in name or '§' in name or '$' in name:
            skipped_count += 1
            continue

        # Clean up any remaining localization artifacts
        # Remove color codes like §A, §!, etc.
        clean_name = re.sub(r'§[A-Za-z!]', '', name)
        clean_name = clean_name.strip()

        # Skip if name is empty after cleanup
        if not clean_name:
            skipped_count += 1
            continue

        gc = empire.get('graphical_culture', '')

        # Determine has_unique_ships based on graphical_culture
        # Factions with "generic_XX" cultures use placeholder ship models
        # All other cultures have their own unique ship designs
        has_unique_ships = bool(gc) and not gc.startswith('generic_')

        # Create short name from species_class or first 3 chars
        short_name = empire.get('species_class') or empire['key'][:3].upper()

        result.append({
            'id': empire['id'],
            'name': clean_name,
            'short_name': short_name,
            'quadrant': empire['quadrant'],
            'graphical_culture': empire['graphical_culture'],
            'has_unique_ships': has_unique_ships,
            'playable': True,  # All prescripted countries are playable
            'playable_condition': empire['playable_condition'],
        })

    if skipped_count > 0:
        print(f"[Prescripted Parser] Skipped {skipped_count} entries (variants, submods, unresolved)")

    # Sort by name
    result.sort(key=lambda x: x['name'])

    return result


def main():
    """Test the prescripted parser."""
    prescripted_dir = os.path.join(STNH_MOD_ROOT, "prescripted_countries")

    print("=" * 60)
    print("STNH Prescripted Countries Parser - Test Run")
    print("=" * 60)
    print()

    empires = parse_prescripted_countries(prescripted_dir)

    print()
    print(f"Total empires: {len(empires)}")
    print()

    # Count by quadrant
    quadrant_counts = {}
    for emp in empires:
        q = emp['quadrant']
        quadrant_counts[q] = quadrant_counts.get(q, 0) + 1

    print("By quadrant:")
    for q, count in sorted(quadrant_counts.items()):
        print(f"  {q}: {count}")

    print()

    # Show some examples
    print("Examples:")
    for emp in empires[:5]:
        print(f"  {emp['key']}: gc={emp['graphical_culture']}, quadrant={emp['quadrant']}")

    return empires


if __name__ == "__main__":
    main()
