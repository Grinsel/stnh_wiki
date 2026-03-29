"""
Fix Missing Icons - Copies icons based on actual icon mappings, not tech IDs

The original extract_tech_icons.py searched for tech_id.dds but should have
used the icon_name from mappings (e.g., tech_icon_quantum_resonance_charge.dds)
"""

import json
import shutil
from pathlib import Path
from config import STNH_MOD_ROOT


def fix_missing_icons():
    """
    Find and copy all icons that are referenced but missing
    """
    icons_dir = Path(__file__).parent.parent / 'icons'
    icons_webp_dir = icons_dir / 'icons_webp'
    mappings_file = icons_dir / 'tech_icon_mappings.json'
    mod_gfx = Path(STNH_MOD_ROOT) / 'gfx'

    # Also check vanilla Stellaris
    vanilla_gfx = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Stellaris\gfx")

    print("=" * 60)
    print("FIX MISSING ICONS")
    print("=" * 60)

    # Load icon mappings
    print(f"\n[1] Loading icon mappings...")
    with open(mappings_file, 'r', encoding='utf-8') as f:
        icon_mappings = json.load(f)
    print(f"    Total mappings: {len(icon_mappings)}")

    # Get all unique icon names needed
    needed_icons = set(icon_mappings.values())
    print(f"    Unique icons needed: {len(needed_icons)}")

    # Get already available icons (as webp)
    available_icons = set(f.stem for f in icons_webp_dir.glob('*.webp'))
    print(f"    Already available (webp): {len(available_icons)}")

    # Find missing icons
    missing_icons = needed_icons - available_icons
    print(f"    Missing icons: {len(missing_icons)}")

    if not missing_icons:
        print("\n[OK] All icons are already available!")
        return

    # Build index of all DDS files in mod and vanilla
    print(f"\n[2] Building DDS file index...")
    dds_index = {}

    # Scan mod gfx
    print(f"    Scanning mod: {mod_gfx}")
    for dds_file in mod_gfx.rglob('*.dds'):
        icon_name = dds_file.stem
        if icon_name not in dds_index or 'technologies' in str(dds_file):
            dds_index[icon_name] = dds_file

    # Scan vanilla gfx
    if vanilla_gfx.exists():
        print(f"    Scanning vanilla: {vanilla_gfx}")
        for dds_file in vanilla_gfx.rglob('*.dds'):
            icon_name = dds_file.stem
            if icon_name not in dds_index or 'technologies' in str(dds_file):
                dds_index[icon_name] = dds_file

    print(f"    Total indexed: {len(dds_index)}")

    # Find and copy missing icons
    print(f"\n[3] Copying missing icons...")

    found = []
    not_found = []

    for icon_name in missing_icons:
        if icon_name in dds_index:
            found.append((icon_name, dds_index[icon_name]))
        else:
            not_found.append(icon_name)

    print(f"    Found: {len(found)}")
    print(f"    Not found: {len(not_found)}")

    # Copy found icons to icons/ folder (for conversion)
    if found:
        copied = 0
        for icon_name, source_path in found:
            dest_path = icons_dir / f"{icon_name}.dds"
            if not dest_path.exists():
                try:
                    shutil.copy2(source_path, dest_path)
                    copied += 1
                except Exception as e:
                    print(f"    [ERROR] {icon_name}: {e}")
        print(f"    Copied {copied} new DDS files to icons/")

    # Report not found
    if not_found:
        print(f"\n[WARNING] Could not find {len(not_found)} icons:")
        for icon_name in sorted(not_found)[:20]:
            print(f"    - {icon_name}")
        if len(not_found) > 20:
            print(f"    ... and {len(not_found) - 20} more")

        # Save to file
        not_found_file = icons_dir / 'truly_missing_icons.txt'
        with open(not_found_file, 'w', encoding='utf-8') as f:
            for icon_name in sorted(not_found):
                f.write(f"{icon_name}\n")
        print(f"    Saved to: {not_found_file.name}")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Missing icons identified: {len(missing_icons)}")
    print(f"Found and copied (DDS):   {len(found)}")
    print(f"Still missing:            {len(not_found)}")
    print(f"\nNext step: Run converter.bat to convert new DDS files to WebP")
    print("=" * 60)


if __name__ == '__main__':
    fix_missing_icons()
