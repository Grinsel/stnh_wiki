"""
Ship Name Parser for STNH Techtree

Parses ship_sizes files and localization to extract faction-specific ship names
and map them to technologies.

Output: {tech_id: {faction: [ship_names], ...}}

Supports:
1. Individual faction designs (ship_sizes with direct prerequisites)
2. Global designs with faction upgrades (component_templates)
"""

import os
import re
from pathlib import Path

# Import config for paths
try:
    from config import STNH_MOD_ROOT
except ImportError:
    STNH_MOD_ROOT = r"C:\Users\marcj\git01\New-Horizons-Development"

# Faction mappings from graphical_culture / country_flag
GRAPHICAL_CULTURE_TO_FACTION = {
    'fed_01': 'Federation',
    'fed_02': 'Federation',
    'fed_03': 'Federation',
    'fed_future': 'Federation',
    'kdf_01': 'Klingon',
    'kdf_02': 'Klingon',
    'kdf_future': 'Klingon',
    'rom_01': 'Romulan',
    'rom_02': 'Romulan',
    'rom_future': 'Romulan',
    'cardassian_01': 'Cardassian',
    'cardassian_02': 'Cardassian',
    'dom_01': 'Dominion',
    'dom_02': 'Dominion',
    'borg_01': 'Borg',
    'borg_02': 'Borg',
    'borg_yellow_01': 'Borg',
    'borg_red_01': 'Borg',
    'borg_blue_01': 'Borg',
    'borg_purple_01': 'Borg',
    'borg_orange_01': 'Borg',
    'ferengi_01': 'Ferengi',
    'ferengi_02': 'Ferengi',
    'bajoran_01': 'Bajoran',
    'vulcan_01': 'Vulcan',
    'andorian_01': 'Andorian',
    'tellarite_01': 'Tellarite',
    'terran_01': 'Terran',
    'xindi_01': 'Xindi',
    'breen_01': 'Breen',
    'tholian_01': 'Tholian',
    'hirogen_01': 'Hirogen',
    'kazon_01': 'Kazon',
    'vidiian_01': 'Vidiian',
    'undine_01': 'Undine',
    'suliban_01': 'Suliban',
    'nausicaan_01': 'Nausicaan',
    'orion_01': 'Orion',
    'gorn_01': 'Gorn',
    'tzenkethi_01': 'Tzenkethi',
    'talarian_01': 'Talarian',
    'sona_01': "Son'a",
}

COUNTRY_FLAG_TO_FACTION = {
    'united_federation_of_planets': 'Federation',
    'ufp': 'Federation',
    'federation_founder': 'Federation',
    'klingon_empire': 'Klingon',
    'romulan_star_empire': 'Romulan',
    'cardassian_union': 'Cardassian',
    'the_dominion': 'Dominion',
    'the_borg_collective': 'Borg',
    'borg_collective': 'Borg',
    'ferengi_alliance': 'Ferengi',
    'bajoran_republic': 'Bajoran',
    'vulcan_high_command': 'Vulcan',
    'andorian_empire': 'Andorian',
    'tellarite_empire': 'Tellarite',
    'terran_empire': 'Terran',
    'xindi_council': 'Xindi',
    'breen_confederacy': 'Breen',
    'tholian_assembly': 'Tholian',
    'hirogen_hunters': 'Hirogen',
    'kazon_collective': 'Kazon',
    'vidiian_sodality': 'Vidiian',
    'undine': 'Undine',
    'suliban_cabal': 'Suliban',
    'nausicaan_tribes': 'Nausicaan',
    'orion_syndicate': 'Orion',
    'gorn_hegemony': 'Gorn',
}

# Scripted triggers like is_borg_empire = yes
SCRIPTED_TRIGGER_TO_FACTION = {
    'is_borg_empire': 'Borg',
    'is_federation_empire': 'Federation',
    'is_klingon_empire': 'Klingon',
    'is_romulan_empire': 'Romulan',
    'is_cardassian_empire': 'Cardassian',
    'is_dominion_empire': 'Dominion',
    'is_ferengi_empire': 'Ferengi',
    'is_terran_empire': 'Terran',
}


def extract_faction_from_block(block_content):
    """
    Extract faction from a ship_sizes block.

    Checks:
    1. graphical_culture = { "fed_01" } - single or multiple mapping to same faction
    2. potential_country = { has_country_flag = xxx }
    3. potential_country = { is_*_empire = yes }

    If graphical_culture has MULTIPLE values mapping to DIFFERENT factions,
    this is a generic ship - return None.

    Returns:
        str or None: Faction name or None if generic
    """
    # Try graphical_culture first
    gc_match = re.search(r'graphical_culture\s*=\s*\{([^}]+)\}', block_content)
    if gc_match:
        gc_content = gc_match.group(1)
        all_cultures = re.findall(r'"([^"]+)"', gc_content)

        if len(all_cultures) == 1:
            gc = all_cultures[0]
            if gc in GRAPHICAL_CULTURE_TO_FACTION:
                return GRAPHICAL_CULTURE_TO_FACTION[gc]
        elif len(all_cultures) > 1:
            # Check if ALL cultures map to the SAME faction
            factions = set()
            for gc in all_cultures:
                if gc in GRAPHICAL_CULTURE_TO_FACTION:
                    factions.add(GRAPHICAL_CULTURE_TO_FACTION[gc])

            # If exactly one faction -> not generic (e.g., all Borg variants)
            if len(factions) == 1:
                return factions.pop()

            # Multiple factions or unknown cultures -> generic
            return None

    # Try potential_country with has_country_flag
    pc_match = re.search(r'potential_country\s*=\s*\{[^}]*has_country_flag\s*=\s*(\w+)', block_content, re.DOTALL)
    if pc_match:
        flag = pc_match.group(1)
        if flag in COUNTRY_FLAG_TO_FACTION:
            return COUNTRY_FLAG_TO_FACTION[flag]

    # Try potential_country with is_*_empire = yes triggers
    empire_match = re.search(r'potential_country\s*=\s*\{[^}]*(is_\w+_empire)\s*=\s*yes', block_content, re.DOTALL)
    if empire_match:
        trigger = empire_match.group(1)
        if trigger in SCRIPTED_TRIGGER_TO_FACTION:
            return SCRIPTED_TRIGGER_TO_FACTION[trigger]

    return None


def extract_faction_from_valid_for_country(block_content):
    """
    Extract faction from valid_for_country block in component_templates.

    Pattern: valid_for_country = { has_country_flag = cardassian_union }

    Returns:
        str or None: Faction name or None if not found
    """
    vfc_match = re.search(r'valid_for_country\s*=\s*\{[^}]*has_country_flag\s*=\s*(\w+)', block_content, re.DOTALL)
    if vfc_match:
        flag = vfc_match.group(1)
        if flag in COUNTRY_FLAG_TO_FACTION:
            return COUNTRY_FLAG_TO_FACTION[flag]
    return None


def parse_ship_sizes_with_faction(ship_sizes_dir):
    """
    Parse ship_sizes files to extract tech prerequisites, component sets, and factions.

    Returns:
        tuple: (tech_to_components_with_faction, component_set_to_tech)
        - tech_to_components_with_faction: {tech_id: [(component_key, faction), ...]}
        - component_set_to_tech: {component_set: [tech_ids]} for global designs
    """
    tech_to_components = {}
    component_set_to_tech = {}

    files = [f for f in os.listdir(ship_sizes_dir) if f.endswith('.txt')]
    print(f"[Ship Parser] Scanning {len(files)} ship_sizes files...")

    for filename in files:
        filepath = os.path.join(ship_sizes_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                content = f.read()
        except Exception as e:
            print(f"  [WARNING] Could not read {filename}: {e}")
            continue

        current_pos = 0
        while True:
            match = re.search(r'^(\w+)\s*=\s*\{', content[current_pos:], re.MULTILINE)
            if not match:
                break

            ship_class_name = match.group(1)
            block_start = current_pos + match.end()

            # Find matching closing brace
            brace_count = 1
            block_end = block_start
            while brace_count > 0 and block_end < len(content):
                if content[block_end] == '{':
                    brace_count += 1
                elif content[block_end] == '}':
                    brace_count -= 1
                block_end += 1

            block_content = content[block_start:block_end]

            # Extract prerequisites
            prereq_match = re.search(r'prerequisites\s*=\s*\{\s*"([^"]+)"', block_content)
            tech_id = prereq_match.group(1) if prereq_match else None

            # Extract required_component_set (first one that starts with required_data_)
            component_matches = re.findall(r'required_component_set\s*=\s*"(required_data_[^"]+)"', block_content)

            # Extract faction
            faction = extract_faction_from_block(block_content)

            if tech_id and component_matches:
                component_set = component_matches[0]

                # Store with faction info
                if tech_id not in tech_to_components:
                    tech_to_components[tech_id] = []
                tech_to_components[tech_id].append((component_set, faction))

                # Build reverse mapping: component_set -> tech (for global designs)
                if component_set not in component_set_to_tech:
                    component_set_to_tech[component_set] = []
                if tech_id not in component_set_to_tech[component_set]:
                    component_set_to_tech[component_set].append(tech_id)

            current_pos = block_end

    ship_count = sum(len(v) for v in tech_to_components.values())
    print(f"[Ship Parser] Found {ship_count} ship classes from ship_sizes")
    return tech_to_components, component_set_to_tech


def parse_component_templates_with_faction(component_dir, component_set_to_tech):
    """
    Parse component_templates for ship class upgrades with faction info.

    For components WITHOUT prerequisites but WITH component_set,
    use the component_set_to_tech mapping to find the base tech.

    Returns:
        dict: {tech_id: [(component_key, faction), ...]}
    """
    tech_to_components = {}
    data_file = os.path.join(component_dir, "STH_unique_data_components.txt")

    if not os.path.exists(data_file):
        print(f"[Ship Parser] WARNING: {data_file} not found")
        return tech_to_components

    try:
        with open(data_file, 'r', encoding='utf-8-sig') as f:
            content = f.read()
    except Exception as e:
        print(f"[Ship Parser] ERROR reading component file: {e}")
        return tech_to_components

    current_pos = 0
    direct_count = 0
    indirect_count = 0

    while True:
        match = re.search(r'utility_component_template\s*=\s*\{', content[current_pos:])
        if not match:
            break

        block_start = current_pos + match.end()

        # Find matching closing brace
        brace_count = 1
        block_end = block_start
        while brace_count > 0 and block_end < len(content):
            if content[block_end] == '{':
                brace_count += 1
            elif content[block_end] == '}':
                brace_count -= 1
            block_end += 1

        block_content = content[block_start:block_end]

        # Extract key (component ID) - must start with required_data_
        key_match = re.search(r'key\s*=\s*"(required_data_[^"]+)"', block_content)
        if not key_match:
            current_pos = block_end
            continue

        component_key = key_match.group(1)

        # Extract faction from valid_for_country
        faction = extract_faction_from_valid_for_country(block_content)

        # Try direct prerequisites first
        prereq_match = re.search(r'prerequisites\s*=\s*\{\s*(\w+)\s*\}', block_content)

        if prereq_match:
            # Direct prerequisite
            tech_id = prereq_match.group(1)
            if tech_id not in tech_to_components:
                tech_to_components[tech_id] = []
            tech_to_components[tech_id].append((component_key, faction))
            direct_count += 1
        else:
            # No direct prerequisite - try to find via component_set
            comp_set_match = re.search(r'component_set\s*=\s*"(required_data_[^"]+)"', block_content)
            if comp_set_match and faction:  # Only map if we have a faction
                base_component_set = comp_set_match.group(1)
                # Find which tech unlocks this base component set
                if base_component_set in component_set_to_tech:
                    for tech_id in component_set_to_tech[base_component_set]:
                        if tech_id not in tech_to_components:
                            tech_to_components[tech_id] = []
                        tech_to_components[tech_id].append((component_key, faction))
                        indirect_count += 1

        current_pos = block_end

    print(f"[Ship Parser] Found {direct_count} direct + {indirect_count} indirect ship upgrades from component_templates")
    return tech_to_components


def parse_ship_localisation(loc_dir):
    """
    Parse localization files to get display names for ship component sets.

    Returns:
        dict: {component_set_key: display_name}
    """
    loc_data = {}
    ship_loc_file = os.path.join(loc_dir, "STH_ships_l_english.yml")

    if not os.path.exists(ship_loc_file):
        print(f"[Ship Parser] WARNING: {ship_loc_file} not found")
        return loc_data

    try:
        with open(ship_loc_file, 'r', encoding='utf-8-sig') as f:
            content = f.read()
    except Exception as e:
        print(f"[Ship Parser] ERROR reading localization: {e}")
        return loc_data

    # Find all required_data entries
    # More permissive pattern to catch all variants
    matches = re.findall(r'(required_data_[a-zA-Z0-9_]+):0\s+"([^"]+)"', content)

    for key, value in matches:
        # Skip _DESC entries
        if '_DESC' in key:
            continue
        # Skip if value contains formatting codes (descriptions)
        if '§' in value or '\\n' in value:
            continue
        # Skip if value is just a number
        if value.strip().isdigit():
            continue

        loc_data[key] = value

    print(f"[Ship Parser] Found {len(loc_data)} ship name localizations")
    return loc_data


def build_tech_to_faction_ships_mapping(ship_sizes_dir, loc_dir, component_dir=None):
    """
    Build mapping from tech_id to faction-specific ship names.

    Returns:
        dict: {tech_id: {faction: [ship_names], ...}}

    Example:
        {
            "tech_engineering_battleship_544": {
                "Cardassian": ["Galor-Class Battleship"],
                "Klingon": ["Vor'cha-Class Battlecruiser"],
                None: ["Battleship"]  # Generic (no faction)
            }
        }
    """
    # Parse ship_sizes with faction info
    tech_to_components_sizes, component_set_to_tech = parse_ship_sizes_with_faction(ship_sizes_dir)

    # Parse localization
    loc_data = parse_ship_localisation(loc_dir)

    # Parse component templates with faction info
    tech_to_components_upgrades = {}
    if component_dir:
        tech_to_components_upgrades = parse_component_templates_with_faction(
            component_dir, component_set_to_tech
        )

    # Merge both sources
    tech_to_components = {}

    for tech_id, comp_faction_list in tech_to_components_sizes.items():
        if tech_id not in tech_to_components:
            tech_to_components[tech_id] = []
        tech_to_components[tech_id].extend(comp_faction_list)

    for tech_id, comp_faction_list in tech_to_components_upgrades.items():
        if tech_id not in tech_to_components:
            tech_to_components[tech_id] = []
        tech_to_components[tech_id].extend(comp_faction_list)

    # Build tech -> {faction: [ship_names]} mapping
    tech_to_faction_ships = {}
    matched_count = 0

    for tech_id, comp_faction_list in tech_to_components.items():
        for component_key, faction in comp_faction_list:
            # Look up display name - try with and without _1 suffix
            display_name = loc_data.get(component_key)
            if not display_name:
                # Try without _1, _2, etc. suffix
                base_key = re.sub(r'_\d+$', '', component_key)
                display_name = loc_data.get(base_key)

            if display_name:
                if tech_id not in tech_to_faction_ships:
                    tech_to_faction_ships[tech_id] = {}

                faction_key = faction if faction else '_generic'
                if faction_key not in tech_to_faction_ships[tech_id]:
                    tech_to_faction_ships[tech_id][faction_key] = []

                # Avoid duplicates
                if display_name not in tech_to_faction_ships[tech_id][faction_key]:
                    tech_to_faction_ships[tech_id][faction_key].append(display_name)
                    matched_count += 1

    # Sort ship names within each faction
    for tech_id in tech_to_faction_ships:
        for faction in tech_to_faction_ships[tech_id]:
            tech_to_faction_ships[tech_id][faction].sort()

    print(f"[Ship Parser] Mapped {matched_count} ship names to {len(tech_to_faction_ships)} technologies")

    return tech_to_faction_ships


# Legacy function for backwards compatibility
def build_tech_to_ships_mapping(ship_sizes_dir, loc_dir, component_dir=None):
    """
    Build mapping from tech_id to list of ship display names (flat list).

    DEPRECATED: Use build_tech_to_faction_ships_mapping() for faction-aware mapping.

    Returns:
        dict: {tech_id: ["Constitution-Class Heavy Cruiser", ...]}
    """
    faction_mapping = build_tech_to_faction_ships_mapping(ship_sizes_dir, loc_dir, component_dir)

    # Flatten to simple list
    tech_to_ships = {}
    for tech_id, faction_ships in faction_mapping.items():
        all_ships = []
        for faction, ships in faction_ships.items():
            all_ships.extend(ships)
        tech_to_ships[tech_id] = sorted(set(all_ships))

    return tech_to_ships


def get_ship_names_for_tech(tech_id, tech_to_ships_mapping):
    """
    Get list of ship display names for a technology.
    """
    return tech_to_ships_mapping.get(tech_id, [])


def main():
    """Test the ship name parser."""
    ship_sizes_dir = os.path.join(STNH_MOD_ROOT, "common", "ship_sizes")
    loc_dir = os.path.join(STNH_MOD_ROOT, "localisation", "english")
    component_dir = os.path.join(STNH_MOD_ROOT, "common", "component_templates")

    print("=" * 60)
    print("STNH Ship Name Parser - Test Run (with Faction Support)")
    print("=" * 60)
    print()

    mapping = build_tech_to_faction_ships_mapping(ship_sizes_dir, loc_dir, component_dir)

    print()
    print(f"Total: {len(mapping)} techs with ship unlocks")
    print()

    # Count total ships by faction
    faction_counts = {}
    for tech_id, faction_ships in mapping.items():
        for faction, ships in faction_ships.items():
            if faction not in faction_counts:
                faction_counts[faction] = 0
            faction_counts[faction] += len(ships)

    print("Ships by faction:")
    for faction, count in sorted(faction_counts.items(), key=lambda x: -x[1]):
        faction_name = faction if faction != '_generic' else '(Generic)'
        print(f"  {faction_name}: {count}")

    print()

    # Show some examples with faction info
    print("Examples:")
    examples_shown = 0
    for tech_id, faction_ships in mapping.items():
        if len(faction_ships) > 1:  # Show techs with multiple factions
            print(f"  {tech_id}:")
            for faction, ships in faction_ships.items():
                faction_name = faction if faction != '_generic' else '(Generic)'
                print(f"    {faction_name}: {ships[:3]}{'...' if len(ships) > 3 else ''}")
            examples_shown += 1
            if examples_shown >= 5:
                break

    return mapping


if __name__ == "__main__":
    main()
