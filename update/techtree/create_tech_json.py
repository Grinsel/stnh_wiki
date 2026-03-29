import os
import re
import json
from config import (
    MOD_TECHNOLOGY_DIR,
    OUTPUT_ASSETS_DIR,
    OUTPUT_ROOT_DIR,
    TECH_FILE_FILTER,
    print_config
)

def get_required_species_recursive(block_content, trigger_map):
    """
    Recursively analyzes a block of conditions to determine required and excluded species.
    """
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

def parse_stellaris_tech_files():
    """
    Parses all Stellaris technology files from the STNH mod directory
    and generates a JSON file containing structured data for each technology,
    including species-specific requirements.

    Uses config.py for path configuration.
    Reads from: git01/New-Horizons-Development/common/technology/ (READ-ONLY)
    Writes to: git09/stnh_techtree_interactive/assets/ (OUTPUT)
    """
    # Paths from config.py
    tech_dir = MOD_TECHNOLOGY_DIR
    output_dir = OUTPUT_ASSETS_DIR
    output_file = os.path.join(output_dir, 'technology.json')
    trigger_map_file = os.path.join(OUTPUT_ROOT_DIR, 'trigger_map.json')
    loc_map_file = os.path.join(OUTPUT_ROOT_DIR, 'localisation_map.json')

    # Print configuration
    print_config()

    all_technologies = []
    tech_ids = set()

    # Load the trigger map and localisation map
    with open(trigger_map_file, 'r', encoding='utf-8') as f:
        trigger_map = json.load(f)
    with open(loc_map_file, 'r', encoding='utf-8') as f:
        loc_map = json.load(f)

    tech_start_re = re.compile(r'^\s*([\w\._-]+)\s*=\s*\{', re.MULTILINE)
    area_re = re.compile(r'area\s*=\s*(\w+)')
    tier_re = re.compile(r'tier\s*=\s*(\d+)')
    cost_re = re.compile(r'cost\s*=\s*(\d+)')
    prereq_re = re.compile(r'prerequisites\s*=\s*\{([^}]+)\}')
    weight_re = re.compile(r'^\s*weight\s*=\s*@?[\w\.]+', re.MULTILINE)

    KEYWORD_BLOCKLIST = [
        "if", "else", "limit", "modifier", "weight_modifier", "potential", 
        "trigger", "OR", "AND", "NOT", "NOR", "weight_groups", 
        "mod_weight_if_group_picked", "feature_flags", "category", 
        "prereqfor_desc", "diplo_action", "ship", "custom", 
        "has_trait_in_council", "prerequisites", "ai_weight"
    ]

    if not os.path.exists(tech_dir):
        print(f"Error: Directory '{tech_dir}' not found.")
        return

    print(f"\nScanning for technology files in '{tech_dir}'...")

    for filename in os.listdir(tech_dir):
        # Use filter from config.py
        if TECH_FILE_FILTER and not TECH_FILE_FILTER(filename):
            continue
        if filename.endswith('.txt'):
            filepath = os.path.join(tech_dir, filename)
            print(f"Processing file: {filepath}")
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                content = f.read()
                content = re.sub(r'#.*', '', content)

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
                    
                    if brace_level != 0 or tech_id in KEYWORD_BLOCKLIST or tech_id in tech_ids:
                        cursor = block_end_pos
                        continue

                    block_content = content[block_start_pos : block_end_pos - 1]
                    tech_ids.add(tech_id)

                    area_match = area_re.search(block_content)
                    area = area_match.group(1) if area_match else None
                    tier_match = tier_re.search(block_content)
                    tier = int(tier_match.group(1)) if tier_match else 0
                    cost_match = cost_re.search(block_content)
                    cost = int(cost_match.group(1)) if cost_match else 0
                    prereq_match = prereq_re.search(block_content)
                    prerequisites = []
                    if prereq_match:
                        prereqs_str = prereq_match.group(1)
                        prerequisites = [p.strip().strip('"') for p in prereqs_str.split()]
                    weight_match = weight_re.search(block_content)
                    weight = None
                    if weight_match:
                        weight_value = weight_match.group(0).split('=')[1].strip()
                        weight = weight_value
                        
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
                    
                    required, excluded = get_required_species_recursive(potential_block_content, trigger_map)
                    final_species = list(required - excluded)

                    tech_name = loc_map.get(tech_id, tech_id)

                    tech_data = {
                        'id': tech_id,
                        'name': tech_name,
                        'area': area,
                        'tier': tier,
                        'cost': cost,
                        'prerequisites': prerequisites,
                        'weight': weight,
                        'required_species': final_species
                    }
                    all_technologies.append(tech_data)
                    
                    cursor = block_end_pos

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_technologies, f, indent=4)

    print(f"\nSuccessfully generated '{output_file}' with {len(all_technologies)} technologies.")

if __name__ == '__main__':
    parse_stellaris_tech_files()
