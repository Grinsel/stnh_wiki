"""
Governments, civics, and authorities parser for STNH mod.
Parses common/governments/*.txt, civics/*.txt, authorities/*.txt.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_modifiers, _extract_icon_stem
from config import MOD_GOVERNMENTS_DIR, MOD_CIVICS_DIR, MOD_AUTHORITIES_DIR


def extract_government(gov_id, block, source_file):
    """Extract structured data from a government block."""
    return {
        'id': gov_id,
        'name_key': gov_id,
        'ruler_title': get_value(block, 'ruler_title') or '',
        'ruler_title_female': get_value(block, 'ruler_title_female') or '',
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'weight': serialize_block(get_value(block, 'weight')) if isinstance(get_value(block, 'weight'), list) else None,
        'source_file': os.path.basename(source_file),
    }


def extract_civic(civic_id, block, source_file):
    """Extract structured data from a civic block."""
    return {
        'id': civic_id,
        'name_key': civic_id,
        'icon': _extract_icon_stem(get_value(block, 'icon')) or civic_id,
        'is_origin': to_bool(get_value(block, 'is_origin')),
        'playable': serialize_block(get_value(block, 'playable')) if isinstance(get_value(block, 'playable'), list) else None,
        'potential': serialize_block(get_value(block, 'potential')) if isinstance(get_value(block, 'potential'), list) else None,
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'pickable_at_start': to_bool(get_value(block, 'pickable_at_start')) if get_value(block, 'pickable_at_start') is not None else True,
        'modification': to_bool(get_value(block, 'modification')) if get_value(block, 'modification') is not None else True,
        'random_weight': serialize_block(get_value(block, 'random_weight')) if isinstance(get_value(block, 'random_weight'), list) else None,
        'modifier': extract_modifiers(block, 'modifier'),
        'source_file': os.path.basename(source_file),
    }


def extract_authority(auth_id, block, source_file):
    """Extract structured data from an authority block."""
    return {
        'id': auth_id,
        'name_key': auth_id,
        'icon': _extract_icon_stem(get_value(block, 'icon')) or auth_id,
        'has_heir': to_bool(get_value(block, 'has_heir')),
        'election_type': get_value(block, 'election_type') or '',
        'election_term_years': get_value(block, 'election_term_years'),
        'can_reform': to_bool(get_value(block, 'can_reform')) if get_value(block, 'can_reform') is not None else True,
        'has_agendas': to_bool(get_value(block, 'has_agendas')),
        'uses_mandates': to_bool(get_value(block, 'uses_mandates')),
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'modifier': extract_modifiers(block, 'country_modifier'),
        'source_file': os.path.basename(source_file),
    }


def _parse_directory(directory, extract_fn, prefix_filter=None):
    """Generic directory parser."""
    items = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(directory):
        print(f"  [WARN] Directory not found: {directory}")
        return items, stats

    for filename in sorted(os.listdir(directory)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(directory, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list):
                        if prefix_filter and not key.startswith(prefix_filter):
                            continue
                        item = extract_fn(key, value, filepath)
                        if item:
                            items.append(item)
                            stats['items'] += 1

    return items, stats


def parse_all_governments():
    """Parse government type files. Returns (governments_list, stats_dict)."""
    # Only parse .txt files directly in governments dir (not subdirs)
    govs = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_GOVERNMENTS_DIR):
        print(f"  [WARN] Governments directory not found: {MOD_GOVERNMENTS_DIR}")
        return govs, stats

    for filename in sorted(os.listdir(MOD_GOVERNMENTS_DIR)):
        filepath = os.path.join(MOD_GOVERNMENTS_DIR, filename)
        if not filename.endswith('.txt') or os.path.isdir(filepath):
            continue
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key.startswith('gov_'):
                        item = extract_government(key, value, filepath)
                        if item:
                            govs.append(item)
                            stats['items'] += 1

    return govs, stats


def parse_all_civics():
    """Parse civic files. Returns (civics_list, stats_dict)."""
    return _parse_directory(MOD_CIVICS_DIR, extract_civic, 'civic_')


def parse_all_authorities():
    """Parse authority files. Returns (authorities_list, stats_dict)."""
    return _parse_directory(MOD_AUTHORITIES_DIR, extract_authority, 'auth_')


if __name__ == '__main__':
    govs, gs = parse_all_governments()
    civics, cs = parse_all_civics()
    auths, a_s = parse_all_authorities()
    print(f"Governments: {gs['items']}, Civics: {cs['items']}, Authorities: {a_s['items']}")
