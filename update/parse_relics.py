"""
Relics parser for STNH mod.
Parses common/relics/*.txt -> structured relic data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_modifiers
from config import MOD_RELICS_DIR, OUTPUT_ICONS_DIR


def _build_relic_icon_lookup():
    """Build relic icon lookup with substring matching."""
    icon_dir = os.path.join(OUTPUT_ICONS_DIR, 'relics')
    if not os.path.isdir(icon_dir):
        return set(), {}
    stems = set()
    suffix_map = {}  # suffix -> full stem (for substring match)
    for f in os.listdir(icon_dir):
        if f.endswith('.webp'):
            stem = f[:-5]
            stems.add(stem)
            # Index by suffix after faction prefix: r_bajoran_orb_of_X -> orb_of_X
            parts = stem.split('_', 2)
            if len(parts) >= 3:
                suffix = parts[2]  # after r_faction_
                suffix_map.setdefault(suffix, stem)
    return stems, suffix_map

_RELIC_ICONS = None
_RELIC_SUFFIX = None

def resolve_relic_icon(relic_id):
    """Resolve best matching icon for a relic.

    Direct match first, then substring match for faction-prefixed DDS files
    (e.g. r_orb_of_X -> r_bajoran_orb_of_X).
    """
    global _RELIC_ICONS, _RELIC_SUFFIX
    if _RELIC_ICONS is None:
        _RELIC_ICONS, _RELIC_SUFFIX = _build_relic_icon_lookup()

    # Direct match
    if relic_id in _RELIC_ICONS:
        return relic_id
    # Substring match: r_orb_of_X -> look for *_orb_of_X
    if relic_id.startswith('r_'):
        suffix = relic_id[2:]  # strip r_
        if suffix in _RELIC_SUFFIX:
            return _RELIC_SUFFIX[suffix]
    return relic_id


def extract_relic(relic_id, block, source_file):
    """Extract structured data from a relic block."""
    return {
        'id': relic_id,
        'name_key': relic_id,
        'icon': resolve_relic_icon(relic_id),
        'activation_duration': get_value(block, 'activation_duration'),
        'portrait': get_value(block, 'portrait') or '',
        'score': get_value(block, 'score'),
        'resources': extract_resources(block),
        'modifier': extract_modifiers(block, 'triggered_country_modifier', 'country_modifier'),
        'active_effect': serialize_block(get_value(block, 'active_effect')) if isinstance(get_value(block, 'active_effect'), list) else None,
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'ai_weight': serialize_block(get_value(block, 'ai_weight')) if isinstance(get_value(block, 'ai_weight'), list) else None,
        'source_file': os.path.basename(source_file),
    }


def parse_all_relics():
    """Parse all relic files. Returns (relics_list, stats_dict)."""
    relics = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_RELICS_DIR):
        print(f"  [WARN] Relics directory not found: {MOD_RELICS_DIR}")
        return relics, stats

    for filename in sorted(os.listdir(MOD_RELICS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_RELICS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key.startswith('r_'):
                        item = extract_relic(key, value, filepath)
                        if item:
                            relics.append(item)
                            stats['items'] += 1

    return relics, stats


if __name__ == '__main__':
    items, stats = parse_all_relics()
    print(f"Files: {stats['files']}, Relics: {stats['items']}, Errors: {stats['errors']}")
