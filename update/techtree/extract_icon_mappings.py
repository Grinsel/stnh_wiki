"""
Icon Mapping Extractor - Extracts icon references from tech files

Scans all technology files to find which icon each tech uses.
Many techs share icons (e.g., tech_society_16006 uses icon = tech_society_mars_503)
"""

import re
from pathlib import Path
from collections import defaultdict
import json
from config import STNH_MOD_ROOT


def extract_icon_mappings():
    """
    Extract icon mappings from all tech files

    Returns:
        dict: tech_id -> icon_name mapping
    """
    tech_dir = Path(STNH_MOD_ROOT) / 'common' / 'technology'
    tech_files = list(tech_dir.glob('*.txt'))

    icon_mappings = {}

    print(f"\n[Icon Mapping Parser] Scanning {len(tech_files)} technology files...")

    for tech_file in tech_files:
        try:
            content = tech_file.read_text(encoding='utf-8-sig', errors='ignore')

            # Extract all tech blocks
            blocks = _extract_tech_blocks(content)

            for tech_id, block_content in blocks:
                # Remove comments before searching for icon
                # (some icon lines might have comments after them)
                block_without_comments = re.sub(r'#.*$', '', block_content, flags=re.MULTILINE)

                # Look for: icon = tech_xxx or icon = "tech_xxx"
                # NOTE: Icon names can contain hyphens! (e.g., tech_engineering_starship-class_717)
                icon_match = re.search(r'icon\s*=\s*"?([a-zA-Z0-9_-]+)"?', block_without_comments)

                if icon_match:
                    icon_name = icon_match.group(1)
                    icon_mappings[tech_id] = icon_name
                else:
                    # No explicit icon = use tech_id as icon name (default behavior)
                    icon_mappings[tech_id] = tech_id

        except Exception as e:
            print(f"[WARNING] Error parsing {tech_file.name}: {e}")

    print(f"[Icon Mapping Parser] Extracted {len(icon_mappings)} icon mappings")

    return icon_mappings


def _extract_tech_blocks(content):
    """
    Extract all tech blocks from file content

    Returns:
        List of (tech_id, block_content) tuples
    """
    blocks = []
    lines = content.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Skip comments and empty lines
        if line.startswith('#') or not line:
            i += 1
            continue

        # Look for pattern: tech_xxx = {
        match = re.match(r'^(tech_\w+)\s*=\s*\{', line)
        if match:
            tech_id = match.group(1)

            # Count braces to find block end
            brace_count = 1
            block_lines = [line[len(match.group(0)):]]  # Content after opening brace
            i += 1

            while i < len(lines) and brace_count > 0:
                current_line = lines[i]
                block_lines.append(current_line)

                # Count braces (ignoring those in comments or strings)
                clean_line = re.sub(r'#.*$', '', current_line)  # Remove comments
                clean_line = re.sub(r'"[^"]*"', '', clean_line)  # Remove strings

                brace_count += clean_line.count('{')
                brace_count -= clean_line.count('}')

                i += 1

            block_content = '\n'.join(block_lines)
            blocks.append((tech_id, block_content))
        else:
            i += 1

    return blocks


def analyze_missing_icons(icon_mappings):
    """
    Analyze which of the "missing" icons actually exist under different names
    """
    # Load missing icons list
    missing_file = Path(__file__).parent.parent / 'icons' / 'missing_icons.txt'
    if not missing_file.exists():
        print("[WARNING] missing_icons.txt not found")
        return

    missing_techs = missing_file.read_text(encoding='utf-8').strip().split('\n')

    # Check which icons exist
    icons_dir = Path(__file__).parent.parent / 'icons'
    existing_icons = set()
    for icon_file in icons_dir.glob('*.dds'):
        # Remove .dds extension and add to set
        icon_name = icon_file.stem
        existing_icons.add(icon_name)

    print(f"\n[Icon Analysis]")
    print(f"  Missing techs: {len(missing_techs)}")
    print(f"  Existing icon files: {len(existing_icons)}")

    actually_missing = []
    found_via_mapping = []

    for tech_id in missing_techs:
        # Get icon mapping for this tech
        icon_name = icon_mappings.get(tech_id, tech_id)

        # Check if icon file exists
        if icon_name in existing_icons:
            found_via_mapping.append((tech_id, icon_name))
        else:
            actually_missing.append((tech_id, icon_name))

    print(f"\n[Results]")
    print(f"  Found via mapping: {len(found_via_mapping)} ({len(found_via_mapping)/len(missing_techs)*100:.1f}%)")
    print(f"  Actually missing: {len(actually_missing)} ({len(actually_missing)/len(missing_techs)*100:.1f}%)")

    # Save results
    output_dir = Path(__file__).parent.parent / 'icons'

    # Save icon mappings as JSON
    mappings_file = output_dir / 'tech_icon_mappings.json'
    with open(mappings_file, 'w', encoding='utf-8') as f:
        json.dump(icon_mappings, f, indent=2, sort_keys=True)
    print(f"\n[OK] Icon mappings saved to: {mappings_file.name}")

    # Update missing icons list with actually missing ones
    actually_missing_file = output_dir / 'actually_missing_icons.txt'
    with open(actually_missing_file, 'w', encoding='utf-8') as f:
        for tech_id, icon_name in actually_missing:
            f.write(f"{tech_id} -> {icon_name}\n")
    print(f"[OK] Actually missing icons saved to: {actually_missing_file.name}")

    # Save found mappings
    found_mappings_file = output_dir / 'found_via_mapping.txt'
    with open(found_mappings_file, 'w', encoding='utf-8') as f:
        for tech_id, icon_name in found_via_mapping:
            f.write(f"{tech_id} -> {icon_name}\n")
    print(f"[OK] Found icon mappings saved to: {found_mappings_file.name}")

    # Sample output
    if found_via_mapping:
        print(f"\n[Sample] Found icons via mapping (first 10):")
        for tech_id, icon_name in found_via_mapping[:10]:
            print(f"  {tech_id} -> {icon_name}")

    if actually_missing:
        print(f"\n[Sample] Actually missing icons (first 10):")
        for tech_id, icon_name in actually_missing[:10]:
            print(f"  {tech_id} -> {icon_name}")

    return {
        'found_via_mapping': found_via_mapping,
        'actually_missing': actually_missing,
        'icon_mappings': icon_mappings
    }


if __name__ == '__main__':
    print("=" * 60)
    print("STNH Tech Icon Mapping Extractor")
    print("=" * 60)

    # Extract icon mappings
    icon_mappings = extract_icon_mappings()

    # Analyze missing icons
    analyze_missing_icons(icon_mappings)

    print("\n" + "=" * 60)
    print("Icon mapping analysis complete!")
    print("=" * 60)
