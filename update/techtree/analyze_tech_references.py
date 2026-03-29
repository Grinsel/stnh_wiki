"""
Analyze all STNH common/ directories to find which contain tech references
"""

import os
import re
from pathlib import Path
from collections import defaultdict

STNH_MOD_ROOT = Path(r"C:\Users\marcj\git01\New-Horizons-Development")
COMMON_DIR = STNH_MOD_ROOT / "common"

def scan_directory_for_tech_refs(dir_path):
    """Scan a directory for tech references"""
    tech_refs = []

    # Patterns to search for
    patterns = [
        r'prerequisites\s*=\s*\{[^}]*tech_\w+',
        r'required_technology\s*=\s*tech_\w+',
        r'has_technology\s*=\s*tech_\w+',
        r'NOT\s*=\s*\{\s*has_technology\s*=\s*tech_\w+',
    ]

    for file_path in dir_path.glob('**/*.txt'):
        try:
            content = file_path.read_text(encoding='utf-8-sig', errors='ignore')

            for pattern in patterns:
                matches = re.findall(pattern, content, re.DOTALL)
                tech_refs.extend(matches)
        except Exception:
            pass

    return tech_refs

def main():
    print("Scanning STNH common/ directories for tech references...")
    print()

    results = {}

    # Scan all subdirectories
    for subdir in sorted(COMMON_DIR.iterdir()):
        if not subdir.is_dir():
            continue

        dir_name = subdir.name
        tech_refs = scan_directory_for_tech_refs(subdir)

        if tech_refs:
            results[dir_name] = len(tech_refs)

    # Sort by count
    sorted_results = sorted(results.items(), key=lambda x: x[1], reverse=True)

    print("Directories with tech references (sorted by count):")
    print("=" * 70)
    print(f"{'Directory':<40} {'Tech References':>20}")
    print("=" * 70)

    for dir_name, count in sorted_results:
        print(f"{dir_name:<40} {count:>20}")

    print("=" * 70)
    print(f"Total directories with tech refs: {len(results)}")
    print(f"Total tech references found: {sum(results.values())}")
    print()

    # Show which directories are currently NOT scanned
    currently_scanned = {
        'buildings', 'ship_sizes', 'starbase_buildings', 'starbase_modules',
        'megastructures', 'districts', 'decisions', 'edicts', 'tradition_categories',
        'armies', 'component_sets', 'policies', 'strategic_resources', 'deposits',
        'terraform', 'bombardment_stances', 'ascension_perks', 'war_goals'
    }

    not_scanned = [d for d in results.keys() if d not in currently_scanned]

    print("Directories with tech refs that are NOT currently scanned:")
    print("=" * 70)
    for dir_name in sorted(not_scanned):
        print(f"  {dir_name:<40} {results[dir_name]:>20} tech refs")

    print("=" * 70)
    print(f"Total NOT scanned: {len(not_scanned)} directories")
    print(f"Missing tech references: {sum(results[d] for d in not_scanned)}")

if __name__ == '__main__':
    main()
