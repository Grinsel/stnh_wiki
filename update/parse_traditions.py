"""
Traditions parser for STNH mod.
Parses common/traditions/*.txt -> structured tradition data.
Uses tradition_categories to resolve tree names correctly (handles
multi-word trees like the_link, great_houses, section_31 etc.)
"""

import os
from parse_pdx import parse_file, get_value, get_blocks
from parse_helpers import serialize_block, to_bool, extract_prerequisites, extract_modifiers
from config import MOD_TRADITIONS_DIR, OUTPUT_ICONS_DIR, OUTPUT_ASSETS_DIR, STNH_MOD_ROOT, VANILLA_ROOT


# --- Tree name lookup from tradition_categories ---

_TREE_MAP = None  # tradition_id -> tree_name

def _build_tree_map():
    """Build tradition ID -> tree name lookup from tradition_categories files."""
    tree_map = {}
    cat_dirs = [
        os.path.join(VANILLA_ROOT, 'common', 'tradition_categories'),
        os.path.join(STNH_MOD_ROOT, 'common', 'tradition_categories'),
    ]
    for d in cat_dirs:
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.endswith('.txt'):
                continue
            parsed, err = parse_file(os.path.join(d, fn))
            if err:
                continue
            for entry in parsed:
                if isinstance(entry, dict):
                    for key, val in entry.items():
                        if isinstance(val, list) and key.startswith('tradition_'):
                            tree_name = key[len('tradition_'):]
                            adopt = get_value(val, 'adoption_bonus')
                            finish = get_value(val, 'finish_bonus')
                            trads = get_value(val, 'traditions')
                            if adopt:
                                tree_map[adopt] = tree_name
                            if finish:
                                tree_map[finish] = tree_name
                            if isinstance(trads, list):
                                for t in trads:
                                    if isinstance(t, str):
                                        tree_map[t] = tree_name
    return tree_map


def _get_tree(trad_id):
    """Get tree name for a tradition ID. Uses categories lookup, falls back to ID parsing."""
    global _TREE_MAP
    if _TREE_MAP is None:
        _TREE_MAP = _build_tree_map()
    if trad_id in _TREE_MAP:
        return _TREE_MAP[trad_id]
    # Fallback: guess from ID (only correct for single-word trees)
    parts = trad_id.split('_')
    if len(parts) >= 3 and parts[0] == 'tr':
        return parts[1]
    return ''


# --- Icon resolution ---

def _build_tradition_icon_lookup():
    """Build set of available tradition icon stems."""
    icon_dir = os.path.join(OUTPUT_ICONS_DIR, 'traditions')
    if not os.path.isdir(icon_dir):
        return set()
    return set(f[:-5] for f in os.listdir(icon_dir) if f.endswith('.webp'))

_TRAD_ICONS = None
_GFX_TREE_ICONS = None

def _build_gfx_tree_icon_map():
    """Build tree -> icon_stem from GFX sprite definitions in pictures_map.json."""
    import json
    pmap_path = os.path.join(OUTPUT_ASSETS_DIR, 'pictures_map.json')
    if not os.path.exists(pmap_path):
        return {}
    with open(pmap_path, 'r', encoding='utf-8') as f:
        pmap = json.load(f)
    result = {}
    prefix = 'GFX_tradition_category_icon_tradition_'
    for key, val in pmap.items():
        if key.startswith(prefix):
            tree = key[len(prefix):]
            result[tree] = val.get('texture_name', '')
    return result

def resolve_tradition_icon(trad_id, tree):
    """Resolve best matching icon for a tradition.

    6-tier resolution:
    1. Exact match (tr_X)
    2. Vanilla naming remap (tr_X -> tradition_X)
    3. GFX tree icon from pictures_map.json
    4. Tree icon fallback (tradition_icon_{tree})
    5. Base tree fallback (tradition_icon_{base}) for variant trees
       e.g. tree=adaptability_borg -> base=adaptability
    6. First node icon for adopt/finish (tr_{tree}_1)
    """
    global _TRAD_ICONS, _GFX_TREE_ICONS
    if _TRAD_ICONS is None:
        _TRAD_ICONS = _build_tradition_icon_lookup()
    if _GFX_TREE_ICONS is None:
        _GFX_TREE_ICONS = _build_gfx_tree_icon_map()

    # Tier 1: exact match (tr_X)
    if trad_id in _TRAD_ICONS:
        return trad_id
    # Tier 2: vanilla naming (tradition_X)
    vanilla_name = 'tradition_' + trad_id[3:] if trad_id.startswith('tr_') else ''
    if vanilla_name and vanilla_name in _TRAD_ICONS:
        return vanilla_name
    # Tier 3: GFX tree icon from pictures_map.json
    gfx_icon = _GFX_TREE_ICONS.get(tree, '')
    if gfx_icon and gfx_icon in _TRAD_ICONS:
        return gfx_icon
    # Tier 4: tree icon fallback (tradition_icon_{tree})
    tree_icon = f'tradition_icon_{tree}' if tree else ''
    if tree_icon and tree_icon in _TRAD_ICONS:
        return tree_icon
    # Tier 5: base tree fallback for variant trees (adaptability_borg -> adaptability)
    if tree and '_' in tree:
        base_tree = tree.split('_')[0]
        base_icon = f'tradition_icon_{base_tree}'
        if base_icon in _TRAD_ICONS:
            return base_icon
    # Tier 6: first node icon for adopt/finish
    if trad_id.endswith('_adopt') or trad_id.endswith('_finish'):
        first_node = f'tr_{tree}_1'
        if first_node in _TRAD_ICONS:
            return first_node
    # No match
    return trad_id


def extract_tradition(trad_id, block, source_file):
    """Extract structured data from a tradition block."""
    tree = _get_tree(trad_id)
    role = 'node'
    last = trad_id.split('_')[-1]
    if last == 'adopt':
        role = 'adopt'
    elif last == 'finish':
        role = 'finish'

    # Tradition swap
    swap_data = None
    swap_blocks = get_blocks(block, 'tradition_swap')
    if swap_blocks:
        swaps = []
        for sb in swap_blocks:
            swap_entry = {
                'name': get_value(sb, 'name'),
                'trigger': serialize_block(get_value(sb, 'trigger')) if isinstance(get_value(sb, 'trigger'), list) else None,
                'modifier': extract_modifiers(sb, 'modifier'),
            }
            swaps.append(swap_entry)
        swap_data = swaps

    return {
        'id': trad_id,
        'name_key': trad_id,
        'icon': get_value(block, 'icon') or resolve_tradition_icon(trad_id, tree),
        'tree': tree,
        'role': role,
        'modifier': extract_modifiers(block, 'modifier'),
        'tradition_swap': swap_data,
        'possible': serialize_block(get_value(block, 'possible')) if isinstance(get_value(block, 'possible'), list) else None,
        'ai_weight': serialize_block(get_value(block, 'ai_weight')) if isinstance(get_value(block, 'ai_weight'), list) else None,
        'source_file': os.path.basename(source_file),
    }


def parse_all_traditions():
    """Parse all tradition files. Returns (traditions_list, stats_dict)."""
    traditions = []
    stats = {'files': 0, 'items': 0, 'errors': 0}

    if not os.path.isdir(MOD_TRADITIONS_DIR):
        print(f"  [WARN] Traditions directory not found: {MOD_TRADITIONS_DIR}")
        return traditions, stats

    for filename in sorted(os.listdir(MOD_TRADITIONS_DIR)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(MOD_TRADITIONS_DIR, filename)
        parsed, error = parse_file(filepath)
        stats['files'] += 1
        if error:
            stats['errors'] += 1
            continue
        for entry in parsed:
            if isinstance(entry, dict):
                for key, value in entry.items():
                    if isinstance(value, list) and key.startswith('tr_'):
                        item = extract_tradition(key, value, filepath)
                        if item:
                            traditions.append(item)
                            stats['items'] += 1

    return traditions, stats


if __name__ == '__main__':
    items, stats = parse_all_traditions()
    print(f"Files: {stats['files']}, Traditions: {stats['items']}, Errors: {stats['errors']}")
