"""
Species classes parser for STNH mod.
Parses common/species_classes/*.txt -> structured species class data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool
from config import MOD_SPECIES_CLASSES_DIR


def extract_species_class(class_id, block, source_file):
    """Extract structured data from a species class block."""
    # Portraits list
    portraits_val = get_value(block, 'portraits')
    portraits = []
    if isinstance(portraits_val, list):
        portraits = [v for v in portraits_val if isinstance(v, str)]

    return {
        'id': class_id,
        'name_key': class_id,
        'archetype': get_value(block, 'archetype') or '',
        'playable': serialize_block(get_value(block, 'playable')) if isinstance(get_value(block, 'playable'), list) else get_value(block, 'playable'),
        'randomized': serialize_block(get_value(block, 'randomized')) if isinstance(get_value(block, 'randomized'), list) else get_value(block, 'randomized'),
        'graphical_culture': get_value(block, 'graphical_culture') or '',
        'move_pop_sound_effect': get_value(block, 'move_pop_sound_effect') or '',
        'uplifted_into': get_value(block, 'uplifted_into') or '',
        'gender': get_value(block, 'gender'),
        'portrait_modding': to_bool(get_value(block, 'portrait_modding')),
        'portraits': portraits,
        'source_file': os.path.basename(source_file),
    }


def parse_all_species():
    """Parse all species class files. Returns (species_list, stats_dict)."""
    species = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_SPECIES_CLASSES_DIR):
        print(f"  [WARN] Species classes directory not found: {MOD_SPECIES_CLASSES_DIR}")
        return species, stats

    for filename in sorted(os.listdir(MOD_SPECIES_CLASSES_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_SPECIES_CLASSES_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        item = extract_species_class(key, value, filepath)
                        if item:
                            species.append(item)
                            stats['items'] += 1

    return species, stats


if __name__ == '__main__':
    items, stats = parse_all_species()
    print(f"Files: {stats['files']}, Species Classes: {stats['items']}, Errors: {stats['errors']}")
