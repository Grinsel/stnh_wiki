"""
Vanilla Icon Finder - Searches for missing icons in Stellaris base game

Some techs use vanilla Stellaris icons that are not included in the mod.
This script searches the Stellaris installation for these icons.
"""

import shutil
from pathlib import Path


# Stellaris installation path
STELLARIS_ROOT = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Stellaris")
STELLARIS_ICONS_DIR = STELLARIS_ROOT / 'gfx' / 'interface' / 'icons' / 'technologies'


def find_and_copy_vanilla_icons():
    """
    Search for remaining missing icons in Stellaris base game
    """
    # Paths
    icons_dir = Path(__file__).parent.parent / 'icons'
    missing_file = icons_dir / 'actually_missing_icons.txt'

    if not missing_file.exists():
        print("[INFO] No missing icons file found - all icons already located!")
        return

    # Load missing icons list
    print("\n" + "=" * 60)
    print("STNH Vanilla Icon Finder")
    print("=" * 60)
    print(f"\n[1] Loading missing icons list...")

    missing_entries = missing_file.read_text(encoding='utf-8').strip().split('\n')

    # Parse entries (format: "tech_id -> icon_name")
    missing_icons = {}
    for entry in missing_entries:
        if '->' in entry:
            tech_id, icon_name = entry.split('->')
            tech_id = tech_id.strip()
            icon_name = icon_name.strip()
            missing_icons[tech_id] = icon_name
        else:
            # Fallback: entry is just tech_id
            tech_id = entry.strip()
            missing_icons[tech_id] = tech_id

    print(f"    Loaded {len(missing_icons)} missing icon references")

    # Build search list (icon names to search for)
    icon_names_to_find = set(missing_icons.values())
    print(f"    Unique icon names to search: {len(icon_names_to_find)}")

    # Check if Stellaris installation exists
    if not STELLARIS_ROOT.exists():
        print(f"\n[ERROR] Stellaris installation not found at:")
        print(f"    {STELLARIS_ROOT}")
        print(f"\nPlease update STELLARIS_ROOT in this script to your Stellaris installation path.")
        return

    if not STELLARIS_ICONS_DIR.exists():
        print(f"\n[ERROR] Stellaris icons directory not found at:")
        print(f"    {STELLARIS_ICONS_DIR}")
        return

    print(f"\n[2] Scanning Stellaris base game for .dds files...")
    print(f"    Root: {STELLARIS_ICONS_DIR}")

    # Search in Stellaris tech icons directory
    vanilla_dds_files = list(STELLARIS_ICONS_DIR.glob('*.dds'))
    print(f"    Found {len(vanilla_dds_files)} .dds files in vanilla tech icons")

    # Also search entire gfx/ directory for comprehensive search
    print(f"\n[3] Scanning entire Stellaris gfx/ directory...")
    stellaris_gfx = STELLARIS_ROOT / 'gfx'
    all_vanilla_dds = list(stellaris_gfx.rglob('*.dds'))
    print(f"    Found {len(all_vanilla_dds)} total .dds files in vanilla gfx/")

    # Build a mapping of icon_name -> full_path
    icon_file_map = {}
    for dds_file in all_vanilla_dds:
        icon_name = dds_file.stem  # Filename without extension
        # Prefer icons from technologies/ folder if multiple exist
        if icon_name not in icon_file_map or 'technologies' in str(dds_file):
            icon_file_map[icon_name] = dds_file

    print(f"    Indexed {len(icon_file_map)} unique vanilla icon names")

    # Find which "missing" icons exist in vanilla
    print(f"\n[4] Searching for missing icons in vanilla Stellaris...")

    found_icons = []
    still_missing = []

    for tech_id, icon_name in missing_icons.items():
        if icon_name in icon_file_map:
            found_icons.append((tech_id, icon_name, icon_file_map[icon_name]))
        else:
            still_missing.append((tech_id, icon_name))

    print(f"\n[Results]")
    print(f"  Found in vanilla: {len(found_icons)} ({len(found_icons)/len(missing_icons)*100:.1f}%)")
    print(f"  Truly missing:    {len(still_missing)} ({len(still_missing)/len(missing_icons)*100:.1f}%)")

    # Copy found vanilla icons to icons/ directory
    if found_icons:
        print(f"\n[5] Copying vanilla icons to {icons_dir.name}/...")

        copied_count = 0
        for tech_id, icon_name, source_path in found_icons:
            dest_path = icons_dir / source_path.name

            # Skip if already exists
            if dest_path.exists():
                continue

            try:
                shutil.copy2(source_path, dest_path)
                copied_count += 1

                if copied_count % 20 == 0:
                    print(f"    Copied {copied_count}/{len(found_icons)} icons...")
            except Exception as e:
                print(f"    [ERROR] Failed to copy {source_path.name}: {e}")

        print(f"    [OK] Copied {copied_count} vanilla icons")

    # Save updated lists
    print(f"\n[6] Updating icon lists...")

    # Update found_via_mapping.txt with newly found vanilla icons
    found_via_mapping_file = icons_dir / 'found_via_mapping.txt'
    with open(found_via_mapping_file, 'a', encoding='utf-8') as f:
        f.write('\n# Found in vanilla Stellaris:\n')
        for tech_id, icon_name, source_path in found_icons:
            rel_path = source_path.relative_to(STELLARIS_ROOT)
            f.write(f"{tech_id} -> {icon_name} (vanilla: {rel_path})\n")

    print(f"    [OK] Updated {found_via_mapping_file.name}")

    # Update actually_missing_icons.txt with truly missing ones
    if still_missing:
        with open(missing_file, 'w', encoding='utf-8') as f:
            f.write("# Icons that could not be found in mod or vanilla Stellaris\n")
            for tech_id, icon_name in still_missing:
                f.write(f"{tech_id} -> {icon_name}\n")
        print(f"    [OK] Updated {missing_file.name} ({len(still_missing)} truly missing)")
    else:
        # All found! Delete the file
        missing_file.unlink()
        print(f"    [OK] All icons found! Deleted {missing_file.name}")

    # Print sample results
    if found_icons:
        print(f"\n[Sample] Found vanilla icons (first 15):")
        for tech_id, icon_name, source_path in found_icons[:15]:
            rel_path = source_path.relative_to(STELLARIS_ROOT)
            print(f"  {icon_name} -> {rel_path}")

    if still_missing:
        print(f"\n[Sample] Truly missing icons (first 15):")
        for tech_id, icon_name in still_missing[:15]:
            print(f"  {tech_id} -> {icon_name}")

    # Final statistics
    print("\n" + "=" * 60)
    print("FINAL ICON STATISTICS")
    print("=" * 60)

    total_icons_in_dir = len(list(icons_dir.glob('*.dds')))
    print(f"\nTotal icons in icons/ directory: {total_icons_in_dir}")
    print(f"Originally missing:   {len(missing_icons)}")
    print(f"Found in vanilla:     {len(found_icons)} ({len(found_icons)/len(missing_icons)*100:.1f}%)")
    print(f"Truly missing:        {len(still_missing)} ({len(still_missing)/len(missing_icons)*100:.1f}%)")

    # Calculate overall coverage
    import json
    tech_json_dir = icons_dir.parent / 'assets'
    total_techs = 0
    for area in ['physics', 'engineering', 'society']:
        json_file = tech_json_dir / f'technology_{area}.json'
        if json_file.exists():
            with open(json_file, 'r', encoding='utf-8') as f:
                total_techs += len(json.load(f))

    if total_techs > 0:
        icon_coverage = (total_icons_in_dir / total_techs) * 100
        print(f"\nOverall icon coverage: {total_icons_in_dir}/{total_techs} ({icon_coverage:.1f}%)")

    print("\n" + "=" * 60)
    print("Icon extraction complete!")
    print("=" * 60)


if __name__ == '__main__':
    find_and_copy_vanilla_icons()
