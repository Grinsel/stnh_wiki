"""
Prescripted countries/empires parser for STNH mod.
Parses prescripted_countries/*.txt -> structured empire data.
Empires use two formats: nested species={} block or flat species_* keys.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks, get_all_values
from parse_helpers import serialize_block, extract_list
from config import MOD_PRESCRIPTED_COUNTRIES_DIR


def extract_empire_flag_icon(block):
    """Extract icon stem from empire_flag = { icon = { category file } } block."""
    flag_block = get_value(block, 'empire_flag')
    if not isinstance(flag_block, list):
        return ''
    icon_block = get_value(flag_block, 'icon')
    if not isinstance(icon_block, list):
        return ''
    category = get_value(icon_block, 'category')
    file_val = get_value(icon_block, 'file')
    if not category or not file_val:
        return ''
    # Strip quotes and .dds extension
    category = category.strip('"')
    file_val = file_val.strip('"')
    stem = file_val[:-4] if file_val.lower().endswith('.dds') else file_val
    return f"{category}__{stem}"


def extract_all_values_for_key(block, key):
    """Extract all values for a repeated key (e.g. multiple ethic = ...)."""
    values = []
    for item in block:
        if isinstance(item, dict) and key in item:
            values.append(item[key])
    return values if values else []


def extract_species_block(block):
    """Extract species data from nested species = {} block."""
    species_block = get_value(block, 'species')
    if not isinstance(species_block, list):
        return None
    data = {}
    traits = []
    for item in species_block:
        if isinstance(item, dict):
            for k, v in item.items():
                if k == 'trait':
                    traits.append(v)
                else:
                    data[k] = v
    if traits:
        data['traits'] = traits
    return data if data else None


def extract_empire(empire_id, block, source_file):
    """Extract structured data from a prescripted country block."""
    # Species: try nested block first, then flat keys
    species = extract_species_block(block)
    if not species:
        # Flat format (KlingonEmpire style)
        species = {}
        for key in ('species_name', 'species_plural', 'species_class', 'species_adjective'):
            val = get_value(block, key)
            if val:
                species[key.replace('species_', '')] = val
        portrait = get_value(block, 'portrait')
        if portrait and not species.get('portrait'):
            species['portrait'] = portrait
        # Flat traits
        traits = extract_all_values_for_key(block, 'trait')
        if traits:
            species['traits'] = traits
        if not species:
            species = None

    # Ethics (repeated key)
    ethics = extract_all_values_for_key(block, 'ethic')

    # Civics block
    civics_val = get_value(block, 'civics')
    civics = []
    if isinstance(civics_val, list):
        civics = [v for v in civics_val if isinstance(v, str)]

    # Ruler
    ruler_block = get_value(block, 'ruler')
    ruler = None
    if isinstance(ruler_block, list):
        ruler = {}
        for item in ruler_block:
            if isinstance(item, dict):
                for k, v in item.items():
                    ruler[k] = v

    return {
        'id': empire_id,
        'name_key': get_value(block, 'name') or empire_id,
        'adjective': get_value(block, 'adjective') or '',
        'icon': extract_empire_flag_icon(block) or empire_id,
        'ship_prefix': get_value(block, 'ship_prefix') or '',
        'spawn_enabled': get_value(block, 'spawn_enabled') or '',
        'species': species,
        'authority': get_value(block, 'authority') or '',
        'government': get_value(block, 'government') or '',
        'civics': civics,
        'ethics': ethics,
        'origin': get_value(block, 'origin') or '',
        'planet_name': get_value(block, 'planet_name') or '',
        'planet_class': get_value(block, 'planet_class') or '',
        'system_name': get_value(block, 'system_name') or '',
        'graphical_culture': get_value(block, 'graphical_culture') or '',
        'ruler': ruler,
        'flag': get_value(block, 'flag') or '',
        'source_file': os.path.basename(source_file),
    }


def parse_all_empires():
    """Parse all prescripted country files. Returns (empires_list, stats_dict)."""
    empires = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_PRESCRIPTED_COUNTRIES_DIR):
        print(f"  [WARN] Prescripted countries directory not found: {MOD_PRESCRIPTED_COUNTRIES_DIR}")
        return empires, stats

    for filename in sorted(os.listdir(MOD_PRESCRIPTED_COUNTRIES_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_PRESCRIPTED_COUNTRIES_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_empire(key, value, filepath)
                        if item:
                            empires.append(item)
                            stats['items'] += 1

    return empires, stats


if __name__ == '__main__':
    items, stats = parse_all_empires()
    print(f"Files: {stats['files']}, Empires: {stats['items']}, Errors: {stats['errors']}")
