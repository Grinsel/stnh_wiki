"""
Enhanced Tech JSON Generator using Balance Center Infrastructure

This script replaces the old regex-based parser with a sophisticated
Balance Center integration that provides:
- Complete modifier parsing
- Faction availability detection
- Localized descriptions
- Faction-specific alternate names
- Detailed unlock information

Phase 1.3 of STNH Techtree Completion Plan
"""

import json
import re
from pathlib import Path
from balance_center_bridge import BalanceCenterBridge
from component_parser import ComponentParser
from supplemental_tech_parser import SupplementalTechParser
from reverse_unlock_parser import ReverseUnlockParser
from extract_icon_mappings import extract_icon_mappings
from ship_name_parser import build_tech_to_faction_ships_mapping
from prescripted_parser import build_empires_list
from config import STNH_MOD_ROOT, OUTPUT_ASSETS_DIR, OUTPUT_ROOT_DIR


def transform_tech_to_website_format(tech, faction_mappings, loc_loader, component_parser, reverse_unlocks, icon_mappings, ship_names_mapping=None):
    """
    Transform Balance Center tech format → Website JSON format

    Args:
        tech: Technology dict from Balance Center
        faction_mappings: Faction availability mappings from FactionDetector
        loc_loader: LocLoader instance for localization
        component_parser: ComponentParser instance for extracting component effects
        reverse_unlocks: Dict mapping tech_id -> list of things it unlocks
        icon_mappings: Dict mapping tech_id -> icon filename
        ship_names_mapping: Dict mapping tech_id -> list of ship display names

    Returns:
        Enhanced tech dict with all website-required fields
    """
    tech_id = tech.get('name', '')

    # Get localized name (fallback to tech_id if not found)
    localized_name = loc_loader.get(tech_id, tech_id)

    # Get icon mapping (fallback to tech_id if not found)
    icon_name = icon_mappings.get(tech_id, tech_id)

    # Basic fields (already present from Balance Center)
    enhanced = {
        'id': tech_id,
        'name': localized_name,  # Use localized name, not tech_id
        'area': tech.get('area', ''),
        'tier': tech.get('tier', 0),
        'cost': tech.get('cost', 0),
        'prerequisites': tech.get('prerequisites', []),
        'weight': tech.get('weight', 0),
        'icon': icon_name,  # Icon filename (without extension)
    }

    # PHASE 1 ADDITIONS:

    # 1. Description from localization
    description_key = f"{tech_id}_desc"
    description = loc_loader.get(description_key, "")
    enhanced['description'] = description

    # 2. Faction-specific alternate names
    # TODO: Implement extract_alternate_names()
    enhanced['alternate_names'] = extract_alternate_names(tech_id, loc_loader)

    # 3. Component Effects → Display format
    # STNH techs unlock components, which contain the actual modifiers
    enhanced['effects'] = extract_effects_from_components(tech_id, component_parser)

    # 4. Unlock details (combine prereqfor_desc + reverse lookup)
    unlocks = tech.get('unlocks', [])
    reverse_unlock_data = reverse_unlocks.get(tech_id, [])
    enhanced['unlock_details'] = extract_unlock_details(unlocks, reverse_unlock_data, loc_loader)

    # 4b. Add faction-specific ship names
    # ship_names_mapping is now: {faction: [ship_names], ...} where '_generic' = no faction
    if ship_names_mapping and tech_id in ship_names_mapping:
        faction_ships_data = ship_names_mapping[tech_id]
        if faction_ships_data:
            # Ensure unlocks_by_type exists
            if 'unlocks_by_type' not in enhanced['unlock_details']:
                enhanced['unlock_details']['unlocks_by_type'] = {}

            # Generic ships go to Ship Type (for backwards compatibility)
            if '_generic' in faction_ships_data:
                if 'Ship Type' not in enhanced['unlock_details']['unlocks_by_type']:
                    enhanced['unlock_details']['unlocks_by_type']['Ship Type'] = []
                existing = set(enhanced['unlock_details']['unlocks_by_type']['Ship Type'])
                for name in faction_ships_data['_generic']:
                    if name not in existing:
                        enhanced['unlock_details']['unlocks_by_type']['Ship Type'].append(name)

            # Faction-specific ships go to faction_ships
            faction_ships = {}
            for faction, ships in faction_ships_data.items():
                if faction != '_generic' and ships:
                    faction_ships[faction] = ships

            if faction_ships:
                enhanced['unlock_details']['faction_ships'] = faction_ships

    # 5. Faction availability
    # TODO: Implement determine_faction_availability()
    enhanced['faction_availability'] = determine_faction_availability(tech, faction_mappings)

    # 6. Additional metadata
    enhanced['is_rare'] = tech.get('is_rare', False)
    enhanced['is_dangerous'] = tech.get('is_dangerous', False)
    enhanced['is_reverse_engineerable'] = tech.get('is_reverse_engineerable', True)

    # 7. Categories (if present)
    enhanced['category'] = tech.get('category', [])

    # Keep required_species from old format for backwards compatibility
    # (will be replaced by faction_availability in Phase 2)
    enhanced['required_species'] = tech.get('required_species', [])

    return enhanced


def transform_supplemental_tech_to_website_format(tech, faction_mappings, loc_loader, component_parser, reverse_unlocks, icon_mappings, ship_names_mapping=None):
    """
    Transform Supplemental Parser tech format → Website JSON format

    Args:
        tech: Technology dict from Supplemental Parser
        faction_mappings: Faction availability mappings from FactionDetector
        loc_loader: LocLoader instance for localization
        component_parser: ComponentParser instance for extracting component effects
        reverse_unlocks: Dict mapping tech_id -> list of things it unlocks
        icon_mappings: Dict mapping tech_id -> icon filename
        ship_names_mapping: Dict mapping tech_id -> list of ship display names

    Returns:
        Enhanced tech dict with all website-required fields
    """
    tech_id = tech.get('name', '')

    # Get localized name (fallback to tech_id if not found)
    localized_name = loc_loader.get(tech_id, tech_id)

    # Get icon mapping (fallback to tech_id if not found)
    icon_name = icon_mappings.get(tech_id, tech_id)

    # Basic fields
    enhanced = {
        'id': tech_id,
        'name': localized_name,
        'area': tech.get('area', ''),
        'tier': tech.get('tier', 0),
        'cost': tech.get('cost', 0),
        'prerequisites': tech.get('prerequisites', []),
        'weight': tech.get('weight', 0),
        'icon': icon_name,  # Icon filename (without extension)
    }

    # Description from localization
    description_key = f"{tech_id}_desc"
    description = loc_loader.get(description_key, "")
    enhanced['description'] = description

    # Faction-specific alternate names (reuse existing function)
    enhanced['alternate_names'] = extract_alternate_names(tech_id, loc_loader)

    # Effects: Combine component effects + direct modifiers
    effects = extract_effects_from_components(tech_id, component_parser)

    # Add direct modifiers (some techs have modifiers directly, not via components)
    direct_modifiers = tech.get('direct_modifiers', {})
    if direct_modifiers:
        for modifier_key, value in direct_modifiers.items():
            display = format_modifier_display(modifier_key, value)
            effects.append({
                'type': 'modifier',
                'key': modifier_key,
                'value': value,
                'display': display,
                'source': 'tech_direct'  # Mark as direct tech modifier
            })

    enhanced['effects'] = effects

    # Unlock details from prereqfor_desc + reverse lookup
    prereqfor_desc = tech.get('prereqfor_desc', {})
    unlock_details = parse_prereqfor_desc_for_display(prereqfor_desc, loc_loader)

    # Merge reverse unlock data
    reverse_unlock_data = reverse_unlocks.get(tech_id, [])
    if reverse_unlock_data:
        unlock_details = merge_unlock_details_with_reverse(unlock_details, reverse_unlock_data)

    enhanced['unlock_details'] = unlock_details

    # Add faction-specific ship names
    if ship_names_mapping and tech_id in ship_names_mapping:
        faction_ships_data = ship_names_mapping[tech_id]
        if faction_ships_data:
            if 'unlocks_by_type' not in enhanced['unlock_details']:
                enhanced['unlock_details']['unlocks_by_type'] = {}

            # Generic ships go to Ship Type
            if '_generic' in faction_ships_data:
                if 'Ship Type' not in enhanced['unlock_details']['unlocks_by_type']:
                    enhanced['unlock_details']['unlocks_by_type']['Ship Type'] = []
                existing = set(enhanced['unlock_details']['unlocks_by_type']['Ship Type'])
                for name in faction_ships_data['_generic']:
                    if name not in existing:
                        enhanced['unlock_details']['unlocks_by_type']['Ship Type'].append(name)

            # Faction-specific ships go to faction_ships
            faction_ships = {}
            for faction, ships in faction_ships_data.items():
                if faction != '_generic' and ships:
                    faction_ships[faction] = ships

            if faction_ships:
                enhanced['unlock_details']['faction_ships'] = faction_ships

    # Faction availability (reuse existing function)
    enhanced['faction_availability'] = determine_faction_availability(tech, faction_mappings)

    # Additional metadata
    enhanced['is_rare'] = tech.get('is_rare', False)
    enhanced['is_dangerous'] = tech.get('is_dangerous', False)
    enhanced['is_reverse_engineerable'] = tech.get('is_reverse_engineerable', True)

    # Categories
    enhanced['category'] = tech.get('category', [])

    # Keep required_species for backwards compatibility (will be filled by merge script)
    enhanced['required_species'] = tech.get('required_species', [])

    return enhanced


def merge_unlock_details_with_reverse(unlock_details, reverse_unlock_data):
    """
    Merge unlock_details from prereqfor_desc with reverse lookup data

    Args:
        unlock_details: Dict from parse_prereqfor_desc_for_display or extract_unlock_details
        reverse_unlock_data: List of dicts from reverse parser

    Returns:
        Merged unlock_details with updated description and structured data
    """
    if not reverse_unlock_data:
        return unlock_details

    # Group reverse unlocks by type
    from collections import defaultdict
    by_type = defaultdict(list)
    for entry in reverse_unlock_data:
        by_type[entry['type']].append(entry['name'])

    # Store structured unlock data for UI rendering
    unlock_details['unlocks_by_type'] = dict(by_type)

    # Format reverse parts for description (legacy compatibility)
    reverse_parts = []
    for unlock_type, names in sorted(by_type.items()):
        if len(names) == 1:
            reverse_parts.append(f"{unlock_type}: {names[0]}")
        else:
            # Show ALL names
            reverse_parts.append(f"{unlock_type}s: {', '.join(names)}")

    # Merge descriptions (keep for backwards compatibility)
    if unlock_details.get('description'):
        if reverse_parts:
            unlock_details['description'] += " | " + " | ".join(reverse_parts)
    else:
        unlock_details['description'] = " | ".join(reverse_parts) if reverse_parts else ""

    return unlock_details


def parse_prereqfor_desc_for_display(prereqfor_desc, loc_loader):
    """
    Parse prereqfor_desc data and convert to display format with localized strings

    Args:
        prereqfor_desc: Dict from Supplemental Parser with unlock info
        loc_loader: LocLoader instance for localization

    Returns:
        unlock_details dict compatible with website format
    """
    if not prereqfor_desc:
        return {
            'technologies': [],
            'components': [],
            'buildings': [],
            'description': ''
        }

    unlock_details = {
        'technologies': prereqfor_desc.get('technologies', []),
        'components': prereqfor_desc.get('components', []),
        'buildings': prereqfor_desc.get('buildings', []),
        'description_parts': []
    }

    # Parse ship unlocks
    ship_data = prereqfor_desc.get('ship')
    if ship_data:
        title_key = ship_data.get('title_key', '')
        title = loc_loader.get(title_key, title_key)
        # Clean up formatting codes: §H ... §!
        title = re.sub(r'§[HYRGBhyrgb]([^§]+)§!', r'\1', title)
        unlock_details['description_parts'].append(title)

    # Parse feature unlocks (traits, edicts, etc.)
    feature_data = prereqfor_desc.get('feature')
    if feature_data:
        title_key = feature_data.get('title_key', '')
        title = loc_loader.get(title_key, title_key)
        title = re.sub(r'§[HYRGBhyrgb]([^§]+)§!', r'\1', title)
        unlock_details['description_parts'].append(title)

    # Parse component unlocks
    components = prereqfor_desc.get('components', [])
    if components:
        unlock_details['description_parts'].append(f"{len(components)} component(s)")

    # Parse building unlocks
    buildings = prereqfor_desc.get('buildings', [])
    if buildings:
        building_names = [loc_loader.get(b, b) for b in buildings[:3]]
        unlock_details['description_parts'].append(f"Buildings: {', '.join(building_names)}")

    # Parse technology unlocks
    techs = prereqfor_desc.get('technologies', [])
    if techs:
        tech_names = [loc_loader.get(t, t) for t in techs[:3]]
        unlock_details['description_parts'].append(f"Technologies: {', '.join(tech_names)}")

    # Combine into single description
    if unlock_details['description_parts']:
        unlock_details['description'] = ' | '.join(unlock_details['description_parts'])
    else:
        unlock_details['description'] = ''

    return unlock_details


def extract_effects_from_components(tech_id, component_parser):
    """
    Extract effects from components unlocked by this technology

    STNH techs don't have direct modifier blocks. Instead, they unlock
    components (weapons, utilities, etc.) which contain the actual modifiers.

    This function:
    1. Gets all components linked to this tech via prerequisites
    2. Extracts modifiers from each component
    3. Aggregates and converts to display format

    Args:
        tech_id: Technology identifier (e.g., "tech_physics_11282")
        component_parser: ComponentParser instance with parsed data

    Returns:
        List of effect dicts with human-readable display strings
    """
    effects = []

    # Get components unlocked by this tech
    components = component_parser.get_components_for_tech(tech_id)

    if not components:
        return effects

    # Aggregate all modifiers from all components
    # We'll show each component's modifiers separately with component name
    for component in components:
        modifiers = component.get('modifiers', {})
        component_key = component.get('key', 'Unknown')

        if not modifiers:
            continue

        # Convert modifiers to display format
        for modifier_key, value in modifiers.items():
            display = format_modifier_display(modifier_key, value)

            effects.append({
                'type': 'modifier',
                'key': modifier_key,
                'value': value,
                'display': display,
                'component': component_key  # NEW: Track which component provides this
            })

    return effects


def extract_alternate_names(tech_id, loc_loader):
    """
    Extract faction-specific alternate names for a technology

    STNH mod uses patterns like:
    - Federation: tech_society_fed_marines → "MACO Detachment"
    - Klingon: tech_society_kdf_marines_1 → "Klingon Raiding Techniques"
    - Romulan: tech_society_rom_marines → "Reman Shock Troops"

    This function scans for related tech IDs and maps them to faction names.

    Args:
        tech_id: Base technology identifier
        loc_loader: LocLoader instance

    Returns:
        Dict mapping faction names to alternate tech names
        Example: {"Federation": "MACO Detachment", "Klingon": "Klingon Raiding Techniques"}
    """
    alternate_names = {}

    # Common faction abbreviations in STNH
    faction_prefixes = {
        'fed': 'Federation',
        'kdf': 'Klingon',
        'rom': 'Romulan',
        'car': 'Cardassian',
        'dom': 'Dominion',
        'und': 'Undine',
        'tho': 'Tholian',
        'bre': 'Breen',
        'fer': 'Ferengi',
        'son': "Son'a",
        'hir': 'Hirogen',
        'vot': 'Voth',
        'kre': 'Krenim',
        'vid': 'Vidiian',
        'sul': 'Suliban',
    }

    # Extract base tech pattern (remove faction prefix if present)
    # Example: tech_society_fed_marines → tech_society_*_marines
    base_pattern = tech_id
    for prefix in faction_prefixes.keys():
        pattern = f"_{prefix}_"
        if pattern in tech_id:
            # Found faction-specific tech, extract base pattern
            base_pattern = tech_id.replace(pattern, "_*_")
            break

    # If this IS a faction-specific tech, search for other variants
    if base_pattern != tech_id:
        for prefix, faction_name in faction_prefixes.items():
            variant_id = base_pattern.replace("_*_", f"_{prefix}_")

            # Try exact match first
            variant_name = loc_loader.get(variant_id, "")
            if variant_name:
                alternate_names[faction_name] = variant_name
            else:
                # Try with _1 suffix (common pattern)
                variant_id_1 = variant_id + "_1"
                variant_name = loc_loader.get(variant_id_1, "")
                if variant_name:
                    alternate_names[faction_name] = variant_name

    # Get the "generic" name from current tech_id
    tech_name = loc_loader.get(tech_id, "")

    # If we found alternates, determine which faction this tech belongs to
    if alternate_names and tech_name:
        # Add current tech's name to the appropriate faction
        for prefix, faction_name in faction_prefixes.items():
            if f"_{prefix}_" in tech_id:
                alternate_names[faction_name] = tech_name
                break

    return alternate_names


def parse_modifiers_for_display(modifiers):
    """
    Convert raw modifiers to human-readable display format

    Example:
        Input:  {"ship_speed_mult": 0.1, "country_resource_minerals_mult": 0.15}
        Output: [
            {"type": "modifier", "key": "ship_speed_mult", "value": 0.1, "display": "+10% Ship Speed"},
            {"type": "modifier", "key": "country_resource_minerals_mult", "value": 0.15, "display": "+15% Mineral Income"}
        ]

    Args:
        modifiers: Dict of modifier_key: value pairs (or complex dict with nested structure)

    Returns:
        List of effect dicts with human-readable display strings
    """
    if not modifiers:
        return []

    effects = []

    # Handle both simple dict and complex nested structure
    if isinstance(modifiers, dict):
        for key, value in modifiers.items():
            try:
                # Skip non-numeric values (complex nested structures)
                if not isinstance(value, (int, float)):
                    continue

                # Convert modifier key to display string
                display = format_modifier_display(key, value)

                effects.append({
                    'type': 'modifier',
                    'key': key,
                    'value': value,
                    'display': display
                })
            except Exception as e:
                # Skip modifiers that can't be processed
                continue

    return effects


def format_modifier_display(key, value):
    """
    Format a single modifier into human-readable text

    Args:
        key: Modifier key (e.g., "ship_speed_mult")
        value: Modifier value (e.g., 0.1) - must be numeric

    Returns:
        Human-readable string (e.g., "+10% Ship Speed")
    """
    # Ensure value is numeric
    try:
        value = float(value)
    except (TypeError, ValueError):
        return f"{key}: {value}"

    # Determine if this is a multiplier (_mult) or additive (_add)
    is_mult = key.endswith('_mult')
    is_add = key.endswith('_add')

    # Format value
    if is_mult:
        # Multiplier: 0.1 → +10%
        formatted_value = f"{value * 100:+.0f}%"
    elif is_add:
        # Additive: 1 → +1
        formatted_value = f"{value:+.0f}"
    else:
        # Unknown type, show raw value
        formatted_value = f"{value:+.2f}"

    # Convert key to readable name
    readable_name = humanize_modifier_key(key)

    return f"{formatted_value} {readable_name}"


def humanize_modifier_key(key):
    """
    Convert modifier key to human-readable name

    Examples:
        ship_speed_mult → Ship Speed
        country_resource_minerals_mult → Mineral Income
        army_damage_mult → Army Damage
    """
    # Remove common prefixes
    name = key.replace('country_', '').replace('planet_', '').replace('pop_', '')
    name = name.replace('ship_', '').replace('starbase_', '').replace('army_', '')

    # Remove _mult, _add suffixes
    name = name.replace('_mult', '').replace('_add', '')

    # Special cases for resources
    if 'resource_' in name:
        name = name.replace('resource_', '').replace('_produces', ' Income').replace('_upkeep', ' Upkeep')

    # Replace underscores with spaces and title case
    name = name.replace('_', ' ').title()

    return name


def extract_unlock_details(unlocks, reverse_unlock_data, loc_loader):
    """
    Extract detailed unlock information from tech unlocks list + reverse lookup

    Args:
        unlocks: List of unlock strings from Balance Center (e.g., ["building_capital_2", "tech_advanced_sensors"])
        reverse_unlock_data: List of dicts from reverse parser (e.g., [{'type': 'Building', 'id': 'building_x', 'name': 'X'}])
        loc_loader: LocLoader instance

    Returns:
        Dict with categorized unlocks and description
        Example: {
            "technologies": ["tech_advanced_sensors"],
            "components": ["SENSOR_2"],
            "buildings": ["building_capital_2"],
            "description": "Unlocks Advanced Capital, Advanced Sensors, and Sensor Array II"
        }
    """
    # Categorize prereqfor_desc unlocks from Balance Center
    technologies = []
    components = []
    buildings = []
    other = []

    for unlock in (unlocks or []):
        if unlock.startswith('tech_'):
            technologies.append(unlock)
        elif unlock.startswith('building_'):
            buildings.append(unlock)
        elif unlock.startswith('COMPONENT_') or unlock.isupper():
            # Component templates are usually ALL_CAPS
            components.append(unlock)
        else:
            other.append(unlock)

    # Merge reverse lookup data
    reverse_parts = []
    if reverse_unlock_data:
        # Group by type
        from collections import defaultdict
        by_type = defaultdict(list)
        for entry in reverse_unlock_data:
            by_type[entry['type']].append(entry['name'])

        # Format grouped unlocks - SHOW ALL UNLOCKS COMPLETELY
        for unlock_type, names in sorted(by_type.items()):
            if len(names) == 1:
                reverse_parts.append(f"{unlock_type}: {names[0]}")
            else:
                # Show ALL names, not just first 3
                reverse_parts.append(f"{unlock_type}s: {', '.join(names)}")

    # Generate description combining both sources - SHOW ALL UNLOCKS COMPLETELY
    description_parts = []

    # Add localized names from prereqfor_desc (not just counts!)
    if buildings:
        building_names = [loc_loader.get(b, b) for b in buildings]
        if len(building_names) == 1:
            description_parts.append(f"Building: {building_names[0]}")
        else:
            description_parts.append(f"Buildings: {', '.join(building_names)}")

    if components:
        # Components are usually ALL_CAPS IDs, keep as-is
        if len(components) == 1:
            description_parts.append(f"Component: {components[0]}")
        else:
            description_parts.append(f"Components: {', '.join(components)}")

    if technologies:
        tech_names = [loc_loader.get(t, t) for t in technologies]
        if len(tech_names) == 1:
            description_parts.append(f"Technology: {tech_names[0]}")
        else:
            description_parts.append(f"Technologies: {', '.join(tech_names)}")

    if other:
        # Other unlocks - try to localize
        other_names = [loc_loader.get(o, o) for o in other]
        if len(other_names) == 1:
            description_parts.append(f"Other: {other_names[0]}")
        else:
            description_parts.append(f"Other: {', '.join(other_names)}")

    # Build final description - each part already has its category label
    all_parts = []
    if description_parts:
        all_parts.extend(description_parts)
    if reverse_parts:
        all_parts.extend(reverse_parts)

    description = " | ".join(all_parts) if all_parts else ""

    # Build structured unlocks_by_type for UI rendering
    from collections import defaultdict
    unlocks_by_type = defaultdict(list)

    # Add prereqfor_desc unlocks
    if buildings:
        building_names = [loc_loader.get(b, b) for b in buildings]
        unlocks_by_type['Building'].extend(building_names)

    if components:
        unlocks_by_type['Component'].extend(components)

    if technologies:
        tech_names = [loc_loader.get(t, t) for t in technologies]
        unlocks_by_type['Technology'].extend(tech_names)

    if other:
        other_names = [loc_loader.get(o, o) for o in other]
        unlocks_by_type['Other'].extend(other_names)

    # Merge reverse lookup data
    if reverse_unlock_data:
        for entry in reverse_unlock_data:
            unlocks_by_type[entry['type']].append(entry['name'])

    return {
        'technologies': technologies,
        'components': components,
        'buildings': buildings,
        'other': other,
        'description': description,
        'unlocks_by_type': dict(unlocks_by_type) if unlocks_by_type else {}
    }


def determine_faction_availability(tech, faction_mappings):
    """
    Determine which factions can access this technology

    Parses the potential_block from tech data and maps conditions
    to faction names using faction_mappings.

    Args:
        tech: Technology dict from Balance Center
        faction_mappings: Dict containing mapping tables:
            - country_flag_to_faction: {flag_name: faction_name}
            - civic_to_faction: {civic_name: faction_name}
            - graphical_culture_to_faction: {culture: faction_name}

    Returns:
        Dict mapping faction names to availability info
        Example: {
            "Federation": {"available": True, "condition": "country_flag"},
            "Klingon": {"available": True, "condition": "uses_trigger"}
        }
    """
    import re

    potential_block = tech.get('potential_block', '') or tech.get('_potential_raw', '')

    if not potential_block or not potential_block.strip():
        # No restrictions - available to all
        return {}

    # Extract mapping tables
    country_flag_map = faction_mappings.get('country_flag_to_faction', {})
    civic_map = faction_mappings.get('civic_to_faction', {})

    availability = {}

    # Pattern 1: has_country_flag = flag_name
    flag_matches = re.findall(r'has_country_flag\s*=\s*(\w+)', potential_block)
    for flag in flag_matches:
        if flag in country_flag_map:
            faction = country_flag_map[flag]
            availability[faction] = {'available': True, 'condition': 'country_flag'}

    # Pattern 2: has_civic = civic_name
    civic_matches = re.findall(r'has_civic\s*=\s*(\w+)', potential_block)
    for civic in civic_matches:
        if civic in civic_map:
            faction = civic_map[civic]
            availability[faction] = {'available': True, 'condition': 'civic'}

    # Pattern 3: uses_cloak_klingons, uses_cloak_romulans, etc.
    uses_patterns = {
        'uses_cloak_klingons': 'Klingon',
        'uses_cloak_romulans': 'Romulan',
        'uses_cloak_federation': 'Federation',
        'uses_cloak_cardassian': 'Cardassian',
        'uses_torpedoes_klingon': 'Klingon',
        'uses_torpedoes_romulan': 'Romulan',
        'uses_torpedoes_federation': 'Federation',
        'is_machine_empire': 'Machine',
        'is_hive_empire': 'Hive',
        'is_borg_empire': 'Borg',
    }

    for trigger, faction in uses_patterns.items():
        if trigger in potential_block:
            availability[faction] = {'available': True, 'condition': 'uses_trigger'}

    # Pattern 4: OR blocks with multiple country flags
    # This catches "OR = { has_country_flag = X has_country_flag = Y }"
    # Already handled by individual flag matching above

    return availability


def generate_complete_tech_data():
    """
    Main function to generate complete technology data using Balance Center

    Steps:
    1. Initialize Balance Center Bridge
    2. Extract ALL data (technologies, factions, faction mappings, localizations)
    3. Transform each tech to website format
    4. Split by area (physics, engineering, society)
    5. Generate factions.json
    6. Write all output files
    """
    print("=" * 60)
    print("STNH Techtree - Enhanced Data Generation (Phase 1.3)")
    print("=" * 60)
    print()

    # 1. Initialize Balance Center Bridge
    print("Step 1: Initializing Balance Center Bridge...")
    bridge = BalanceCenterBridge(STNH_MOD_ROOT)
    print()

    # 1b. Initialize Component Parser (Phase 3)
    print("Step 1b: Initializing Component Parser...")
    component_parser = ComponentParser(STNH_MOD_ROOT)
    components, tech_components = component_parser.parse_all_components()
    print()

    # 1c. Initialize Reverse Unlock Parser (Option 1 - Unlock Fix)
    print("Step 1c: Scanning game files for reverse unlocks...")
    reverse_unlock_parser = ReverseUnlockParser(STNH_MOD_ROOT)
    reverse_unlocks = reverse_unlock_parser.parse_all()
    print()

    # 1d. Extract Icon Mappings (Icon Integration)
    print("Step 1d: Extracting icon mappings from tech files...")
    icon_mappings = extract_icon_mappings()
    print()

    # 1e. Build Ship Names Mapping (Faction-specific ship class names)
    print("Step 1e: Building ship names mapping...")
    import os
    ship_sizes_dir = os.path.join(STNH_MOD_ROOT, "common", "ship_sizes")
    loc_dir = os.path.join(STNH_MOD_ROOT, "localisation", "english")
    component_dir = os.path.join(STNH_MOD_ROOT, "common", "component_templates")
    ship_names_mapping = build_tech_to_faction_ships_mapping(ship_sizes_dir, loc_dir, component_dir)
    print()

    # 2. Extract ALL data
    print("Step 2: Extracting data from Balance Center...")
    data = bridge.get_all_technologies_with_metadata()
    print()

    technologies = data['technologies']
    factions = data['factions']
    faction_mappings = data['faction_mappings']

    print(f"  Extracted {len(technologies)} technologies")
    print(f"  Found {len(factions)} factions")
    print()

    # 3. Transform to website format
    print("Step 3: Transforming to website format...")
    techs_enhanced = []

    for i, tech in enumerate(technologies):
        if (i + 1) % 500 == 0:
            print(f"  Processing technology {i+1}/{len(technologies)}...")

        try:
            enhanced = transform_tech_to_website_format(
                tech,
                faction_mappings,
                bridge.loc_loader,
                component_parser,
                reverse_unlocks,
                icon_mappings,
                ship_names_mapping
            )
            techs_enhanced.append(enhanced)
        except Exception as e:
            tech_id = tech.get('name', 'unknown')
            print(f"  [WARNING] Failed to transform {tech_id}: {e}")
            continue

    print(f"  Successfully transformed {len(techs_enhanced)} technologies")
    print()

    # 3b. Add missing techs from Supplemental Parser
    print("Step 3b: Adding missing techs from Supplemental Parser...")
    supplemental_parser = SupplementalTechParser(STNH_MOD_ROOT)
    all_techs_supplemental = supplemental_parser.parse_all_techs()

    # Get tech IDs from Balance Center
    bc_tech_ids = set(t['id'] for t in techs_enhanced)

    # Find missing techs
    missing_count = 0
    for supp_tech in all_techs_supplemental:
        if supp_tech['name'] not in bc_tech_ids:
            # Transform supplemental tech to website format
            enhanced = transform_supplemental_tech_to_website_format(
                supp_tech,
                faction_mappings,
                bridge.loc_loader,
                component_parser,
                reverse_unlocks,
                icon_mappings,
                ship_names_mapping
            )
            techs_enhanced.append(enhanced)
            missing_count += 1

    print(f"  Added {missing_count} missing techs")
    print(f"  Total techs now: {len(techs_enhanced)}")

    # 3c. Fix malformed area values from Balance Center parsing bug
    print("Step 3c: Fixing malformed area values...")
    fixed_count = 0
    for tech in techs_enhanced:
        area = tech.get('area', '')

        # Balance Center sometimes returns 'engineering category =' instead of 'engineering'
        if area.startswith('engineering'):
            tech['area'] = 'engineering'
            if area != 'engineering':
                fixed_count += 1
        elif area.startswith('physics'):
            tech['area'] = 'physics'
            if area != 'physics':
                fixed_count += 1
        elif area.startswith('society'):
            tech['area'] = 'society'
            if area != 'society':
                fixed_count += 1

    if fixed_count > 0:
        print(f"  Fixed {fixed_count} malformed area values")
    print()

    # 4. Split by area
    print("Step 4: Splitting by area...")
    physics = [t for t in techs_enhanced if t['area'] == 'physics']
    engineering = [t for t in techs_enhanced if t['area'] == 'engineering']
    society = [t for t in techs_enhanced if t['area'] == 'society']

    print(f"  Physics: {len(physics)} techs")
    print(f"  Engineering: {len(engineering)} techs")
    print(f"  Society: {len(society)} techs")
    print()

    # 5. Generate factions metadata
    print("Step 5: Generating faction metadata...")
    factions_metadata = generate_factions_metadata(factions, techs_enhanced)
    print(f"  Generated metadata for {len(factions_metadata)} factions")
    print()

    # 5b. Extract unique categories from all techs
    print("Step 5b: Extracting categories...")
    all_categories = set()
    for tech in techs_enhanced:
        cats = tech.get('category', [])
        if isinstance(cats, list):
            all_categories.update(cats)
        elif cats:
            all_categories.add(cats)
    categories_list = sorted(list(all_categories))
    print(f"  Found {len(categories_list)} unique categories")
    print()

    # 6. Write output files
    print("Step 6: Writing output files...")
    output_dir = Path(OUTPUT_ASSETS_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write tech JSONs
    write_json_file(physics, output_dir / 'technology_physics.json')
    write_json_file(engineering, output_dir / 'technology_engineering.json')
    write_json_file(society, output_dir / 'technology_society.json')

    # Write factions.json
    write_json_file(factions_metadata, output_dir / 'factions.json')

    # Generate empires.json from prescripted_countries
    print("Step 5c: Generating empires metadata...")
    prescripted_dir = Path(STNH_MOD_ROOT) / 'prescripted_countries'

    # Collect factions that have unique ships
    factions_with_ships = set()
    for tech in techs_enhanced:
        faction_ships = tech.get('unlock_details', {}).get('faction_ships', {})
        factions_with_ships.update(faction_ships.keys())

    empires_list = build_empires_list(prescripted_dir, bridge.loc_loader, factions_with_ships)
    print(f"  Generated metadata for {len(empires_list)} empires")
    print()

    # Write empires.json
    write_json_file(empires_list, output_dir / 'empires.json')

    # Write categories.json
    write_json_file(categories_list, output_dir / 'categories.json')

    print()
    print("=" * 60)
    print("[SUCCESS] Tech data generation complete!")
    print("=" * 60)
    print()
    print("Output files:")
    print(f"  - {output_dir / 'technology_physics.json'} ({len(physics)} techs)")
    print(f"  - {output_dir / 'technology_engineering.json'} ({len(engineering)} techs)")
    print(f"  - {output_dir / 'technology_society.json'} ({len(society)} techs)")
    print(f"  - {output_dir / 'factions.json'} ({len(factions_metadata)} factions)")
    print(f"  - {output_dir / 'empires.json'} ({len(empires_list)} empires)")
    print(f"  - {output_dir / 'categories.json'} ({len(categories_list)} categories)")
    print()


def generate_factions_metadata(factions, technologies):
    """
    Generate faction metadata including tech counts

    Args:
        factions: List of faction names from FactionDetector
        technologies: List of all enhanced technologies

    Returns:
        List of faction metadata dicts
    """
    # Faction display names and colors (from STNH lore)
    faction_info = {
        'Federation': {
            'name': 'United Federation of Planets',
            'short_name': 'UFP',
            'color': '#0066cc',
            'playable': True
        },
        'Klingon': {
            'name': 'Klingon Empire',
            'short_name': 'KDF',
            'color': '#cc0000',
            'playable': True
        },
        'Romulan': {
            'name': 'Romulan Star Empire',
            'short_name': 'RSE',
            'color': '#00cc66',
            'playable': True
        },
        'Cardassian': {
            'name': 'Cardassian Union',
            'short_name': 'CU',
            'color': '#cc6600',
            'playable': True
        },
        'Dominion': {
            'name': 'The Dominion',
            'short_name': 'DOM',
            'color': '#9966cc',
            'playable': True
        },
        'Borg': {
            'name': 'Borg Collective',
            'short_name': 'BC',
            'color': '#00cc00',
            'playable': True
        },
        'Undine': {
            'name': 'Undine',
            'short_name': 'UND',
            'color': '#cc00cc',
            'playable': True
        },
    }

    metadata = []

    # Collect all factions that have faction_ships entries
    factions_with_unique_ships = set()
    for tech in technologies:
        faction_ships = tech.get('unlock_details', {}).get('faction_ships', {})
        factions_with_unique_ships.update(faction_ships.keys())

    # Species-to-faction mapping for fallback
    species_to_faction = {
        'Federation': 'Federation',
        'Klingon': 'Klingon',
        'Romulan': 'Romulan',
        'Cardassian': 'Cardassian',
        'Dominion': 'Dominion',
        'Borg': 'Borg',
        'Undine': 'Undine',
        'Breen': 'Breen',
        'Ferengi': 'Ferengi',
        'Hirogen': 'Hirogen',
        'Vidiian': 'Vidiian',
        'Suliban': 'Romulan',  # Often grouped with Romulans
        'Tholian': 'Other',
        'Krenim': 'Other',
        'Voth': 'Other',
    }

    for faction_name in sorted(factions):
        # Count techs available to this faction
        tech_count = 0

        for tech in technologies:
            # Check faction_availability first
            faction_avail = tech.get('faction_availability', {})

            if faction_avail and faction_name in faction_avail:
                # Use faction_availability if present
                if faction_avail[faction_name].get('available'):
                    tech_count += 1
            else:
                # Fallback: Use required_species
                required_species = tech.get('required_species', [])

                if not required_species:
                    # No restrictions = available to all
                    tech_count += 1
                else:
                    # Check if any required species maps to this faction
                    for species in required_species:
                        mapped_faction = species_to_faction.get(species)
                        if mapped_faction == faction_name:
                            tech_count += 1
                            break

        # Get faction info or create default
        info = faction_info.get(faction_name, {
            'name': faction_name.replace('_', ' ').title(),
            'short_name': faction_name[:3].upper(),
            'color': '#cccccc',
            'playable': False
        })

        # Check if this faction has unique ships
        has_unique_ships = info['name'] in factions_with_unique_ships or faction_name in factions_with_unique_ships

        metadata.append({
            'id': faction_name.lower().replace(' ', '_'),
            'name': info['name'],
            'short_name': info['short_name'],
            'color': info['color'],
            'playable': info['playable'],
            'tech_count': tech_count,
            'has_unique_ships': has_unique_ships
        })

    return metadata


def write_json_file(data, filepath):
    """
    Write data to JSON file with pretty formatting

    Args:
        data: Data to write (list or dict)
        filepath: Path object for output file
    """
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Calculate file size
    size_kb = filepath.stat().st_size / 1024
    print(f"  [OK] Wrote {filepath.name} ({size_kb:.1f} KB)")


if __name__ == '__main__':
    generate_complete_tech_data()
