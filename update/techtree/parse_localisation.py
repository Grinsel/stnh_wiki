import os
import re
import json
import codecs
from config import (
    MOD_LOCALISATION_DIR,
    OUTPUT_ROOT_DIR,
    LOCALISATION_FILE_PATTERN,
    print_config
)

def parse_localisation_files():
    """
    Parses all Stellaris localisation files from the STNH mod directory
    and generates a JSON file mapping localisation keys to their English names.

    Uses config.py for path configuration.
    Reads from: git01/New-Horizons-Development/localisation/english/ (READ-ONLY)
    Writes to: git09/stnh_techtree_interactive/localisation_map.json (OUTPUT)
    """
    # Paths from config.py
    loc_dir = MOD_LOCALISATION_DIR
    output_file = os.path.join(OUTPUT_ROOT_DIR, 'localisation_map.json')

    # Print configuration
    print_config()

    localisation_map = {}

    if not os.path.exists(loc_dir):
        print(f"Error: Directory '{loc_dir}' not found.")
        return

    print(f"\nScanning for localisation files in '{loc_dir}'...")

    for filename in os.listdir(loc_dir):
        if filename.endswith('_l_english.yml'):
            filepath = os.path.join(loc_dir, filename)
            print(f"Processing file: {filepath}")
            with codecs.open(filepath, 'r', 'utf-8-sig') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and ':' in line:
                        match = re.match(r'^\s*([\w\._-]+):\d?\s*"(.*)"\s*$', line)
                        if match:
                            key = match.group(1)
                            value = match.group(2)
                            localisation_map[key] = value

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(localisation_map, f, indent=2)

    print(f"\nSuccessfully generated '{output_file}' with {len(localisation_map)} entries.")

if __name__ == '__main__':
    parse_localisation_files()
