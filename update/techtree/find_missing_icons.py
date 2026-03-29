"""
Missing Icon Finder - Searches for "missing" icons throughout gfx/ directory

Many techs use their tech_id as icon name by default (hardcoded).
This script searches the entire gfx/ folder for these icons.
"""

import shutil
from pathlib import Path
from config import STNH_MOD_ROOT


def find_and_copy_missing_icons():
    """
    Search for "actually missing" icons in gfx/ directory and copy them
    """
    # Paths
    icons_dir = Path(__file__).parent.parent / 'icons'
    gfx_root = Path(STNH_MOD_ROOT) / 'gfx'
    missing_file = icons_dir / 'actually_missing_icons.txt'

    if not missing_file.exists():
        print("[ERROR] actually_missing_icons.txt not found!")
        print(f"Expected at: {missing_file}")
        return

    # Load missing icons list
    print("\n" + "=" * 60)
    print("STNH Missing Icon Finder")
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

    # Search entire gfx/ directory for .dds files
    print(f"\n[2] Scanning gfx/ directory for .dds files...")
    print(f"    Root: {gfx_root}")

    all_dds_files = list(gfx_root.rglob('*.dds'))
    print(f"    Found {len(all_dds_files)} total .dds files in gfx/")

    # Build a mapping of icon_name -> full_path
    icon_file_map = {}
    for dds_file in all_dds_files:
        icon_name = dds_file.stem  # Filename without extension
        # Store first occurrence (prefer icons/technologies/ if multiple exist)
        if icon_name not in icon_file_map or 'technologies' in str(dds_file):
            icon_file_map[icon_name] = dds_file

    print(f"    Indexed {len(icon_file_map)} unique icon names")

    # Find which "missing" icons actually exist
    print(f"\n[3] Searching for missing icons...")

    found_icons = []
    still_missing = []

    for tech_id, icon_name in missing_icons.items():
        if icon_name in icon_file_map:
            found_icons.append((tech_id, icon_name, icon_file_map[icon_name]))
        else:
            still_missing.append((tech_id, icon_name))

    print(f"\n[Results]")
    print(f"  Found: {len(found_icons)} ({len(found_icons)/len(missing_icons)*100:.1f}%)")
    print(f"  Still missing: {len(still_missing)} ({len(still_missing)/len(missing_icons)*100:.1f}%)")

    # Copy found icons to icons/ directory
    if found_icons:
        print(f"\n[4] Copying found icons to {icons_dir.name}/...")

        copied_count = 0
        for tech_id, icon_name, source_path in found_icons:
            dest_path = icons_dir / source_path.name

            # Skip if already exists
            if dest_path.exists():
                continue

            try:
                shutil.copy2(source_path, dest_path)
                copied_count += 1

                if copied_count % 50 == 0:
                    print(f"    Copied {copied_count}/{len(found_icons)} icons...")
            except Exception as e:
                print(f"    [ERROR] Failed to copy {source_path.name}: {e}")

        print(f"    [OK] Copied {copied_count} new icons")

    # Save updated lists
    print(f"\n[5] Updating icon lists...")

    # Update found_via_mapping.txt with newly found icons
    found_via_mapping_file = icons_dir / 'found_via_mapping.txt'
    existing_found = []
    if found_via_mapping_file.exists():
        existing_found = found_via_mapping_file.read_text(encoding='utf-8').strip().split('\n')

    with open(found_via_mapping_file, 'a', encoding='utf-8') as f:
        if existing_found and not existing_found[-1].endswith('\n'):
            f.write('\n')
        f.write('\n# Found via gfx/ directory search:\n')
        for tech_id, icon_name, source_path in found_icons:
            f.write(f"{tech_id} -> {icon_name} (from {source_path.relative_to(gfx_root)})\n")

    print(f"    [OK] Updated {found_via_mapping_file.name}")

    # Update actually_missing_icons.txt with truly missing ones
    if still_missing:
        with open(missing_file, 'w', encoding='utf-8') as f:
            for tech_id, icon_name in still_missing:
                f.write(f"{tech_id} -> {icon_name}\n")
        print(f"    [OK] Updated {missing_file.name} ({len(still_missing)} truly missing)")
    else:
        # All found! Delete the file
        missing_file.unlink()
        print(f"    [OK] All icons found! Deleted {missing_file.name}")

    # Print sample results
    if found_icons:
        print(f"\n[Sample] Found icons (first 15):")
        for tech_id, icon_name, source_path in found_icons[:15]:
            rel_path = source_path.relative_to(gfx_root)
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
    print(f"Originally missing:  {len(missing_icons)}")
    print(f"Found in gfx/:       {len(found_icons)} ({len(found_icons)/len(missing_icons)*100:.1f}%)")
    print(f"Truly missing:       {len(still_missing)} ({len(still_missing)/len(missing_icons)*100:.1f}%)")

    # Calculate overall coverage
    # We need total tech count for this
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


if __name__ == '__main__':
    find_and_copy_missing_icons()
