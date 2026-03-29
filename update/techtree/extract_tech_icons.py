"""
Tech Icon Extractor - Finds and copies all tech icons for web use

Scans all techs from JSON files and copies their corresponding .dds icons
from the mod's gfx/interface/icons/technologies/ folder to a local icons/ directory.
"""

import json
import shutil
from pathlib import Path
from config import STNH_MOD_ROOT

# Paths
MOD_ICONS_DIR = Path(STNH_MOD_ROOT) / 'gfx' / 'interface' / 'icons' / 'technologies'
OUTPUT_DIR = Path(__file__).parent.parent / 'icons'
TECH_JSON_DIR = Path(__file__).parent.parent / 'assets'


def load_all_techs():
    """Load all technologies from the JSON files"""
    techs = []

    for area in ['physics', 'engineering', 'society']:
        json_file = TECH_JSON_DIR / f'technology_{area}.json'
        if json_file.exists():
            with open(json_file, 'r', encoding='utf-8') as f:
                techs.extend(json.load(f))
        else:
            print(f"[WARNING] File not found: {json_file}")

    return techs


def find_icon_for_tech(tech_id, icon_dir):
    """
    Find the icon file for a given tech ID

    Tries multiple naming patterns:
    - tech_id.dds (exact match)
    - tech_id_1.dds (variant)
    - tech_id.png (if converted already)

    Args:
        tech_id: Tech identifier (e.g., 'tech_cruisers')
        icon_dir: Path to icons directory

    Returns:
        Path to icon file or None if not found
    """
    # Pattern 1: Exact match
    icon_path = icon_dir / f'{tech_id}.dds'
    if icon_path.exists():
        return icon_path

    # Pattern 2: With _1 suffix (common for variants)
    icon_path_1 = icon_dir / f'{tech_id}_1.dds'
    if icon_path_1.exists():
        return icon_path_1

    # Pattern 3: Without tech_ prefix (some icons use this)
    if tech_id.startswith('tech_'):
        short_id = tech_id[5:]  # Remove 'tech_' prefix
        icon_path_short = icon_dir / f'{short_id}.dds'
        if icon_path_short.exists():
            return icon_path_short

    return None


def extract_all_icons():
    """Main extraction function"""
    print("=" * 60)
    print("STNH Tech Icon Extractor")
    print("=" * 60)

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"\n[OK] Output directory: {OUTPUT_DIR}")

    # Load all techs
    print("\n[1] Loading technologies...")
    techs = load_all_techs()
    print(f"    Loaded {len(techs)} technologies")

    # Check mod icons directory
    if not MOD_ICONS_DIR.exists():
        print(f"\n[ERROR] Mod icons directory not found: {MOD_ICONS_DIR}")
        return

    print(f"\n[2] Scanning mod icons directory...")
    print(f"    {MOD_ICONS_DIR}")
    all_icon_files = list(MOD_ICONS_DIR.glob('*.dds'))
    print(f"    Found {len(all_icon_files)} .dds files")

    # Extract icons for each tech
    print(f"\n[3] Extracting tech icons...")

    found_count = 0
    not_found = []
    copied_count = 0

    for i, tech in enumerate(techs, 1):
        tech_id = tech.get('id', '')

        if not tech_id:
            continue

        # Find icon
        icon_path = find_icon_for_tech(tech_id, MOD_ICONS_DIR)

        if icon_path:
            found_count += 1

            # Copy to output directory
            dest_path = OUTPUT_DIR / icon_path.name
            try:
                shutil.copy2(icon_path, dest_path)
                copied_count += 1

                # Progress indicator
                if i % 100 == 0:
                    print(f"    Processed {i}/{len(techs)} techs... ({copied_count} icons copied)")
            except Exception as e:
                print(f"    [ERROR] Failed to copy {icon_path.name}: {e}")
        else:
            not_found.append(tech_id)

    # Summary
    print("\n" + "=" * 60)
    print("EXTRACTION COMPLETE")
    print("=" * 60)
    print(f"\nTotal techs:        {len(techs)}")
    print(f"Icons found:        {found_count} ({found_count/len(techs)*100:.1f}%)")
    print(f"Icons copied:       {copied_count}")
    print(f"Icons not found:    {len(not_found)} ({len(not_found)/len(techs)*100:.1f}%)")
    print(f"\nOutput directory:   {OUTPUT_DIR.absolute()}")

    # List some missing icons (for debugging)
    if not_found:
        print(f"\n[INFO] Sample of missing icons (first 20):")
        for tech_id in not_found[:20]:
            print(f"  - {tech_id}")

        # Write full list to file
        missing_file = OUTPUT_DIR / 'missing_icons.txt'
        with open(missing_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(not_found))
        print(f"\n[INFO] Full list of missing icons saved to: {missing_file.name}")

    print("\n" + "=" * 60)
    print(f"Ready for manual conversion! Convert .dds files in:")
    print(f"{OUTPUT_DIR.absolute()}")
    print("=" * 60)


if __name__ == '__main__':
    extract_all_icons()
