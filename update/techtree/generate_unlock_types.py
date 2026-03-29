"""
Generate unlock_types.json from technology data.

This script extracts all unique unlock types from the technology JSON files
and writes them to assets/unlock_types.json in alphabetical order.

The unlock types are used in the techtree UI for filtering technologies
by what they unlock (e.g., "Ship Type", "Building", "Megastructure").

Usage:
    python generate_unlock_types.py

Output:
    ../assets/unlock_types.json

Author: STNH Techtree Project
"""

import json
import os
from pathlib import Path

# Import config for paths
try:
    from config import OUTPUT_ASSETS_DIR
except ImportError:
    OUTPUT_ASSETS_DIR = Path(__file__).parent.parent / 'assets'


def extract_unlock_types(assets_dir: Path) -> set:
    """
    Extract all unique unlock types from technology JSON files.

    Args:
        assets_dir: Path to the assets directory containing technology_*.json files

    Returns:
        Set of unique unlock type strings
    """
    unlock_types = set()

    for tech_file in assets_dir.glob('technology_*.json'):
        try:
            with open(tech_file, 'r', encoding='utf-8') as f:
                techs = json.load(f)

            for tech in techs:
                unlocks = tech.get('unlock_details', {}).get('unlocks_by_type', {})
                unlock_types.update(unlocks.keys())

        except Exception as e:
            print(f"  [WARNING] Could not read {tech_file.name}: {e}")

    return unlock_types


def main():
    """Main entry point."""
    print("=" * 60)
    print("GENERATE UNLOCK TYPES")
    print("=" * 60)

    assets_dir = Path(OUTPUT_ASSETS_DIR)

    if not assets_dir.exists():
        print(f"[ERROR] Assets directory not found: {assets_dir}")
        return 1

    print(f"\nScanning: {assets_dir}")

    # Extract unlock types
    unlock_types = extract_unlock_types(assets_dir)

    if not unlock_types:
        print("[WARNING] No unlock types found!")
        return 1

    # Sort alphabetically
    sorted_types = sorted(unlock_types)

    print(f"\nFound {len(sorted_types)} unlock types:")
    for ut in sorted_types:
        print(f"  - {ut}")

    # Write to JSON
    output_file = assets_dir / 'unlock_types.json'

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sorted_types, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Written to: {output_file}")
    print("=" * 60)

    return 0


if __name__ == '__main__':
    exit(main())
