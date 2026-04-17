"""
Relics parser for STNH mod.
Parses common/relics/*.txt -> structured relic data.
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_resources, extract_modifiers
from config import MOD_RELICS_DIR


def _portrait_to_icon_stem(block, relic_id):
    """Derive the icon stem from the relic's `portrait` field.

    Mod definitions use `portrait = "GFX_relic_<name>"` (occasionally
    `"GFX_r_<name>"` or bare `"GFX_<name>"`). The frontend looks up icons
    under icons/relics/r_<core>.webp, and the hybrid resolver in
    convert_icons.py is configured with stem_strip_prefix='r_' + gfx_key_prefix
    'GFX_relic_', so we must return stems shaped like 'r_<core>'.

    Fall back to the relic id when no portrait is set — that's what many
    vanilla-ish relics look like and the downstream direct-scan picks them
    up by filename match.
    """
    portrait = get_value(block, 'portrait') or ''
    if isinstance(portrait, str) and portrait.startswith('GFX_'):
        core = portrait[len('GFX_'):]
        if core.startswith('relic_'):
            core = core[len('relic_'):]
        elif core.startswith('r_'):
            core = core[len('r_'):]
        if core:
            return 'r_' + core
    return relic_id


def extract_relic(relic_id, block, source_file):
    """Extract structured data from a relic block."""
    return {
        'id': relic_id,
        'name_key': relic_id,
        'icon': _portrait_to_icon_stem(block, relic_id),
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
