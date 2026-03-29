"""
COMPLETE ICON VERIFICATION AND EXTRACTION

This script performs a FULL verification of all tech icons:
1. Loads all tech data from JSONs
2. Extracts icon references from each tech
3. Checks which icons are available (as WebP)
4. Searches ALL known sources for missing icons
5. Reports comprehensive statistics

Icon Sources (in order of priority):
1. STNH Mod: gfx/interface/icons/technologies/
2. STNH Mod: gfx/ (entire directory - recursive)
3. Vanilla Stellaris: gfx/interface/icons/technologies/
4. Vanilla Stellaris: gfx/ (entire directory - recursive)

Author: Claude Code Assistant
"""

import json
import shutil
from pathlib import Path
from collections import defaultdict
from config import STNH_MOD_ROOT

# Configuration
VANILLA_ROOT = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Stellaris")
ICONS_DIR = Path(__file__).parent.parent / 'icons'
ICONS_WEBP_DIR = ICONS_DIR / 'icons_webp'
ASSETS_DIR = Path(__file__).parent.parent / 'assets'


def load_all_techs():
    """Load all technologies from JSON files"""
    techs = []
    for area in ['physics', 'engineering', 'society']:
        json_file = ASSETS_DIR / f'technology_{area}.json'
        if json_file.exists():
            with open(json_file, 'r', encoding='utf-8') as f:
                techs.extend(json.load(f))
    return techs


def build_icon_index(roots):
    """
    Build comprehensive index of all DDS files from multiple roots

    Args:
        roots: List of (name, path) tuples

    Returns:
        Dict mapping icon_name -> (source_name, full_path)
    """
    index = {}

    for source_name, root_path in roots:
        if not root_path.exists():
            print(f"    [SKIP] {source_name}: Path not found")
            continue

        print(f"    Scanning {source_name}...")
        count = 0

        for dds_file in root_path.rglob('*.dds'):
            icon_name = dds_file.stem

            # Prioritize icons from technologies/ folders
            is_tech_folder = 'technologies' in str(dds_file)

            if icon_name not in index or is_tech_folder:
                index[icon_name] = (source_name, dds_file)
                count += 1

        print(f"        Found {count} unique icons")

    return index


def verify_and_fix_icons():
    """Main verification and fix function"""
    print("=" * 70)
    print("COMPLETE ICON VERIFICATION")
    print("=" * 70)

    # Step 1: Load all techs
    print("\n[1] Loading technologies from JSON files...")
    techs = load_all_techs()
    print(f"    Total technologies: {len(techs)}")

    # Step 2: Extract all icon references
    print("\n[2] Extracting icon references...")
    icon_refs = {}  # icon_name -> list of tech_ids using it

    for tech in techs:
        tech_id = tech.get('id', '')
        icon_name = tech.get('icon', tech_id)  # Fallback to tech_id if no icon field

        if icon_name not in icon_refs:
            icon_refs[icon_name] = []
        icon_refs[icon_name].append(tech_id)

    print(f"    Unique icons needed: {len(icon_refs)}")
    print(f"    Icons shared by multiple techs: {sum(1 for refs in icon_refs.values() if len(refs) > 1)}")

    # Step 3: Check available WebP icons
    print("\n[3] Checking available WebP icons...")
    available_webp = set()
    if ICONS_WEBP_DIR.exists():
        available_webp = set(f.stem for f in ICONS_WEBP_DIR.glob('*.webp'))
    print(f"    WebP icons available: {len(available_webp)}")

    # Step 4: Identify missing icons
    print("\n[4] Identifying missing icons...")
    missing = set(icon_refs.keys()) - available_webp
    print(f"    Missing icons: {len(missing)}")

    if not missing:
        print("\n" + "=" * 70)
        print("ALL ICONS ARE AVAILABLE! No action needed.")
        print("=" * 70)
        return True

    # Step 5: Build comprehensive DDS index
    print("\n[5] Building DDS file index from all sources...")

    sources = [
        ("STNH Mod (technologies)", Path(STNH_MOD_ROOT) / 'gfx' / 'interface' / 'icons' / 'technologies'),
        ("STNH Mod (full gfx)", Path(STNH_MOD_ROOT) / 'gfx'),
        ("Vanilla (technologies)", VANILLA_ROOT / 'gfx' / 'interface' / 'icons' / 'technologies'),
        ("Vanilla (full gfx)", VANILLA_ROOT / 'gfx'),
    ]

    dds_index = build_icon_index(sources)
    print(f"    Total indexed DDS files: {len(dds_index)}")

    # Step 6: Find and copy missing icons
    print("\n[6] Searching for missing icons...")

    found = []
    not_found = []
    by_source = defaultdict(list)

    for icon_name in missing:
        if icon_name in dds_index:
            source_name, dds_path = dds_index[icon_name]
            found.append((icon_name, source_name, dds_path))
            by_source[source_name].append(icon_name)
        else:
            not_found.append(icon_name)

    print(f"\n    Found: {len(found)}")
    for source_name, icons in by_source.items():
        print(f"        {source_name}: {len(icons)}")
    print(f"    Not found: {len(not_found)}")

    # Step 7: Copy found icons
    if found:
        print("\n[7] Copying missing icons to icons/ folder...")
        copied = 0
        for icon_name, source_name, dds_path in found:
            dest_path = ICONS_DIR / f"{icon_name}.dds"
            if not dest_path.exists():
                try:
                    shutil.copy2(dds_path, dest_path)
                    copied += 1
                except Exception as e:
                    print(f"    [ERROR] {icon_name}: {e}")
        print(f"    Copied {copied} DDS files")

    # Step 8: Report unfound icons
    if not_found:
        print(f"\n[8] Icons that could NOT be found ({len(not_found)}):")

        # Group by affected techs
        unfound_details = []
        for icon_name in not_found:
            affected_techs = icon_refs.get(icon_name, [])
            unfound_details.append((icon_name, affected_techs))

        for icon_name, affected_techs in sorted(unfound_details)[:20]:
            tech_str = ', '.join(affected_techs[:3])
            if len(affected_techs) > 3:
                tech_str += f" (+{len(affected_techs)-3} more)"
            print(f"    - {icon_name} (used by: {tech_str})")

        if len(not_found) > 20:
            print(f"    ... and {len(not_found) - 20} more")

        # Save detailed report
        report_file = ICONS_DIR / 'unfound_icons_report.txt'
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("# Icons that could not be found in any source\n")
            f.write(f"# Total: {len(not_found)}\n\n")
            for icon_name, affected_techs in sorted(unfound_details):
                f.write(f"{icon_name}\n")
                for tech_id in affected_techs:
                    f.write(f"    -> {tech_id}\n")
                f.write("\n")
        print(f"\n    Detailed report saved to: {report_file.name}")

    # Final Summary
    print("\n" + "=" * 70)
    print("VERIFICATION SUMMARY")
    print("=" * 70)
    print(f"\nTotal technologies:     {len(techs)}")
    print(f"Unique icons needed:    {len(icon_refs)}")
    print(f"Already available:      {len(available_webp)}")
    print(f"Missing icons:          {len(missing)}")
    print(f"  - Found and copied:   {len(found)}")
    print(f"  - Truly unfindable:   {len(not_found)}")

    if found:
        print(f"\n[ACTION REQUIRED]")
        print(f"  1. Run converter.bat in icons/ folder to convert {len(found)} new DDS to WebP")
        print(f"  2. Delete DDS files after conversion")
        print(f"  3. Push changes to remote")

    coverage = (len(available_webp) + len(found)) / len(icon_refs) * 100
    print(f"\nExpected coverage after conversion: {coverage:.1f}%")
    print("=" * 70)

    return len(not_found) == 0


if __name__ == '__main__':
    verify_and_fix_icons()
