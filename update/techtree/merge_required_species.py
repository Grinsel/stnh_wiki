"""
Quick fix: Merge required_species from old parser into new JSONs

This script:
1. Runs the old parser to get required_species data
2. Loads the new JSONs
3. Merges required_species into new JSONs
4. Writes updated files
"""

import json
import os
import re
from pathlib import Path
from config import MOD_TECHNOLOGY_DIR, OUTPUT_ASSETS_DIR, OUTPUT_ROOT_DIR

# Import old parser function
def get_required_species_recursive(block_content, trigger_map):
    """Recursively analyzes a block of conditions to determine required and excluded species."""
    required = set()
    excluded = set()

    # Flatten the trigger map for easier lookup
    all_triggers = []
    for category in trigger_map.values():
        all_triggers.extend(category)

    for trigger in all_triggers:
        condition = trigger['condition']
        species = trigger['species']
        trigger_type = trigger['type']

        if re.search(r'\b' + re.escape(condition) + r'\b', block_content):
            if trigger_type == 'include':
                required.update(species)
            elif trigger_type == 'exclude':
                excluded.update(species)

    return required, excluded


def extract_required_species_from_mod():
    """Extract required_species from mod tech files using old parser logic"""

    # Load trigger map
    trigger_map_file = os.path.join(OUTPUT_ROOT_DIR, 'trigger_map.json')
    with open(trigger_map_file, 'r', encoding='utf-8') as f:
        trigger_map = json.load(f)

    tech_species_map = {}  # tech_id -> required_species list

    # Parse tech files
    tech_start_re = re.compile(r'^\s*([\w\._-]+)\s*=\s*\{', re.MULTILINE)
    KEYWORD_BLOCKLIST = [
        "if", "else", "limit", "modifier", "weight_modifier", "potential",
        "trigger", "OR", "AND", "NOT", "NOR", "weight_groups",
        "mod_weight_if_group_picked", "feature_flags", "category",
        "prereqfor_desc", "diplo_action", "ship", "custom",
        "has_trait_in_council", "prerequisites", "ai_weight"
    ]

    print(f"Scanning tech files in {MOD_TECHNOLOGY_DIR}...")

    tech_ids_seen = set()
    for filename in os.listdir(MOD_TECHNOLOGY_DIR):
        if not ("sth" in filename and filename.endswith('.txt')):
            continue

        filepath = os.path.join(MOD_TECHNOLOGY_DIR, filename)
        print(f"  Processing {filename}...")

        with open(filepath, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            content = re.sub(r'#.*', '', content)  # Remove comments

            cursor = 0
            while cursor < len(content):
                match = tech_start_re.search(content, cursor)
                if not match:
                    break

                tech_id = match.group(1)
                block_start_pos = match.end()
                brace_level = 1
                current_pos = block_start_pos

                while current_pos < len(content) and brace_level > 0:
                    char = content[current_pos]
                    if char == '{':
                        brace_level += 1
                    elif char == '}':
                        brace_level -= 1
                    current_pos += 1

                block_end_pos = current_pos

                if brace_level != 0 or tech_id in KEYWORD_BLOCKLIST or tech_id in tech_ids_seen:
                    cursor = block_end_pos
                    continue

                block_content = content[block_start_pos : block_end_pos - 1]
                tech_ids_seen.add(tech_id)

                # Extract potential block
                potential_block_content = ""
                potential_match = re.search(r'potential\s*=\s*{', block_content)
                if potential_match:
                    start = potential_match.end()
                    braces = 1
                    for i, char in enumerate(block_content[start:]):
                        if char == '{':
                            braces += 1
                        elif char == '}':
                            braces -= 1
                        if braces == 0:
                            potential_block_content = block_content[start:start+i]
                            break

                # Get required species
                required, excluded = get_required_species_recursive(potential_block_content, trigger_map)
                final_species = list(required - excluded)

                if final_species:  # Only store if there are species requirements
                    tech_species_map[tech_id] = final_species

                cursor = block_end_pos

    print(f"\n  Found {len(tech_species_map)} techs with species requirements")
    return tech_species_map


def merge_into_jsons(tech_species_map):
    """Merge required_species into the new JSON files"""

    output_dir = Path(OUTPUT_ASSETS_DIR)

    for json_file in ['technology_physics.json', 'technology_engineering.json', 'technology_society.json']:
        filepath = output_dir / json_file

        print(f"\nProcessing {json_file}...")

        # Load JSON
        with open(filepath, 'r', encoding='utf-8') as f:
            techs = json.load(f)

        # Merge required_species
        updated_count = 0
        for tech in techs:
            tech_id = tech.get('id')
            if tech_id in tech_species_map:
                tech['required_species'] = tech_species_map[tech_id]
                updated_count += 1

        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(techs, f, indent=2, ensure_ascii=False)

        print(f"  Updated {updated_count}/{len(techs)} techs with required_species")


if __name__ == '__main__':
    print("="*60)
    print("Merging required_species from mod files into new JSONs")
    print("="*60)
    print()

    # Extract from mod files
    tech_species_map = extract_required_species_from_mod()

    # Merge into new JSONs
    merge_into_jsons(tech_species_map)

    print()
    print("="*60)
    print("[SUCCESS] required_species merged successfully!")
    print("="*60)
