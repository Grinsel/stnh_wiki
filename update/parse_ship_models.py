"""
Ship model mapping parser for STNH mod.
Parses .gfx and .asset files under gfx/models/ships/ to build
a mapping from ship_size -> faction -> { entity, mesh_file, scale, textures, attachments }.

Supports multi-mesh entities via attach/locator chains (e.g. Borg Super Cube = skeleton + 8 cubes).
Uses a 4-strategy matching algorithm for reliable entity-to-ship assignment.
"""

import os
from parse_pdx import parse_file, get_value, get_all_values, get_blocks
from pdx_mesh_reader import parse_mesh_file, extract_locators
from config import MOD_SHIP_MODELS_DIR, STNH_MOD_ROOT, MOD_SHIP_SIZES_DIR, MOD_PRESCRIPTED_COUNTRIES_DIR, MOD_SECTION_TEMPLATES_DIR


def parse_all_gfx(models_dir):
    """Parse all .gfx files under models_dir.
    Returns dict: pdxmesh_name -> { file, scale, textures: { diffuse, normal, specular } }
    """
    meshes = {}
    file_count = 0
    error_count = 0

    for root, dirs, files in os.walk(models_dir):
        for filename in files:
            if not filename.endswith('.gfx'):
                continue
            filepath = os.path.join(root, filename)
            parsed, error = parse_file(filepath)
            file_count += 1
            if error:
                error_count += 1
                continue

            for entry in parsed:
                if not isinstance(entry, dict):
                    continue
                for key, value in entry.items():
                    if key == 'objectTypes' and isinstance(value, list):
                        _extract_pdxmeshes(value, meshes)

    return meshes, file_count, error_count


def _extract_pdxmeshes(block, meshes):
    """Extract pdxmesh blocks from an objectTypes block."""
    for item in block:
        if not isinstance(item, dict):
            continue
        if 'pdxmesh' not in item:
            continue
        mesh_block = item['pdxmesh']
        if not isinstance(mesh_block, list):
            continue

        name = get_value(mesh_block, 'name')
        mesh_file = get_value(mesh_block, 'file')
        if not name:
            continue

        scale = get_value(mesh_block, 'scale')
        if isinstance(scale, str):
            try:
                scale = float(scale)
            except ValueError:
                scale = 1.0

        # Extract textures from meshsettings
        textures = {}
        for ms_block in get_blocks(mesh_block, 'meshsettings'):
            for tex_key in ('texture_diffuse', 'texture_normal', 'texture_specular'):
                val = get_value(ms_block, tex_key)
                if val and isinstance(val, str):
                    short_key = tex_key.replace('texture_', '')
                    if short_key not in textures:
                        textures[short_key] = val

        meshes[name] = {
            'file': mesh_file or '',
            'scale': scale if scale else 1.0,
            'textures': textures,
        }


def parse_all_assets(models_dir):
    """Parse all .asset files under models_dir.
    Returns dict: entity_name -> { pdxmesh, scale, locators, attachments, source_dir }

    Entities without a pdxmesh are kept (they may be attach-only containers).
    """
    entities = {}
    file_count = 0
    error_count = 0

    for root, dirs, files in os.walk(models_dir):
        # source_dir = first path component relative to models_dir (faction folder)
        rel_root = os.path.relpath(root, models_dir).replace('\\', '/')
        source_dir = rel_root.split('/')[0] if rel_root != '.' else ''

        for filename in files:
            if not filename.endswith('.asset'):
                continue
            filepath = os.path.join(root, filename)
            parsed, error = parse_file(filepath)
            file_count += 1
            if error:
                error_count += 1
                continue

            for entry in parsed:
                if not isinstance(entry, dict):
                    continue
                if 'entity' not in entry:
                    continue
                ent_block = entry['entity']
                if not isinstance(ent_block, list):
                    continue

                name = get_value(ent_block, 'name')
                if not name:
                    continue

                pdxmesh = get_value(ent_block, 'pdxmesh')

                scale = get_value(ent_block, 'scale')
                if isinstance(scale, str):
                    try:
                        scale = float(scale)
                    except ValueError:
                        scale = 1.0

                # Parse locator blocks
                locators = {}
                for loc_block in get_blocks(ent_block, 'locator'):
                    loc_name = get_value(loc_block, 'name')
                    if not loc_name:
                        continue
                    loc_data = {}
                    pos = get_value(loc_block, 'position')
                    if isinstance(pos, list) and len(pos) >= 3:
                        loc_data['position'] = [float(v) for v in pos[:3]]
                    rot = get_value(loc_block, 'rotation')
                    if isinstance(rot, list) and len(rot) >= 3:
                        loc_data['rotation'] = [float(v) for v in rot[:3]]
                    loc_scale = get_value(loc_block, 'scale')
                    if loc_scale is not None:
                        try:
                            loc_data['scale'] = float(loc_scale)
                        except (ValueError, TypeError):
                            pass
                    if loc_data:
                        locators[loc_name] = loc_data

                # Parse attach blocks: attach = { locator_name = "entity_name" }
                attachments = []
                for att_block in get_blocks(ent_block, 'attach'):
                    for att_item in att_block:
                        if isinstance(att_item, dict):
                            for loc_name, target_entity in att_item.items():
                                if isinstance(target_entity, str):
                                    attachments.append({
                                        'locator': loc_name,
                                        'entity': target_entity,
                                    })

                entities[name] = {
                    'pdxmesh': pdxmesh,
                    'scale': scale if scale else 1.0,
                    'locators': locators,
                    'attachments': attachments,
                    'source_dir': source_dir,
                }

    return entities, file_count, error_count


def _get_mesh_locators(ent, meshes, mod_root, cache):
    """Get locators from the mesh binary file for an entity.

    Uses cache to avoid re-parsing the same .mesh file.
    Returns dict: locator_name -> { 'position': [x,y,z], ... }
    """
    pdxmesh_name = ent.get('pdxmesh')
    if not pdxmesh_name:
        return {}
    mesh_info = meshes.get(pdxmesh_name)
    if not mesh_info or not mesh_info.get('file'):
        return {}
    mesh_file = mesh_info['file']
    if mesh_file in cache:
        return cache[mesh_file]
    full_path = os.path.join(mod_root, mesh_file.replace('/', os.sep))
    if not os.path.isfile(full_path):
        cache[mesh_file] = {}
        return {}
    try:
        root = parse_mesh_file(full_path)
        locators = extract_locators(root)
    except Exception:
        locators = {}
    cache[mesh_file] = locators
    return locators


def resolve_attachment_tree(entity_name, entities, meshes, mod_root, depth=0, max_depth=3, visited=None, mesh_locator_cache=None):
    """Recursively resolve entity + all attachments into a flat list of meshes with transforms.

    Returns: [ { mesh_file, scale, position, rotation, textures } ]
    Position is additive from parent locator; scale is multiplicative.
    """
    if visited is None:
        visited = set()
    if mesh_locator_cache is None:
        mesh_locator_cache = {}
    if depth > max_depth or entity_name in visited:
        return []
    visited.add(entity_name)

    ent = entities.get(entity_name)
    if not ent:
        return []

    result = []
    ent_scale = ent.get('scale', 1.0) or 1.0

    # Resolve primary mesh (if entity has one)
    pdxmesh_name = ent.get('pdxmesh')
    if pdxmesh_name:
        mesh_info = meshes.get(pdxmesh_name)
        if mesh_info and mesh_info.get('file'):
            mesh_file = mesh_info['file']
            full_path = os.path.join(mod_root, mesh_file.replace('/', os.sep))
            if os.path.isfile(full_path):
                mesh_scale = mesh_info.get('scale', 1.0) or 1.0
                result.append({
                    'mesh_file': mesh_file,
                    'scale': round(ent_scale * mesh_scale, 4),
                    'position': [0, 0, 0],
                    'rotation': [0, 0, 0],
                    'textures': mesh_info.get('textures', {}),
                })

    # Resolve attachments
    for att in ent.get('attachments', []):
        loc_name = att['locator']
        target_entity = att['entity']

        loc_data = ent.get('locators', {}).get(loc_name, {})
        loc_pos = loc_data.get('position', [0, 0, 0])
        loc_rot = loc_data.get('rotation', [0, 0, 0])
        loc_scale = loc_data.get('scale', 1.0)

        # Fallback: if position is [0,0,0], check mesh-binary locators
        if loc_pos == [0, 0, 0]:
            mesh_locs = _get_mesh_locators(ent, meshes, mod_root, mesh_locator_cache)
            mesh_loc = mesh_locs.get(loc_name, {})
            if mesh_loc.get('position'):
                loc_pos = mesh_loc['position']

        child_meshes = resolve_attachment_tree(
            target_entity, entities, meshes, mod_root,
            depth=depth + 1, max_depth=max_depth, visited=visited.copy(),
            mesh_locator_cache=mesh_locator_cache
        )

        for cm in child_meshes:
            # Scale child positions by parent entity scale
            cm['position'] = [
                loc_pos[0] * ent_scale + cm['position'][0],
                loc_pos[1] * ent_scale + cm['position'][1],
                loc_pos[2] * ent_scale + cm['position'][2],
            ]
            # Only set rotation from locator for direct children (depth+1),
            # deeper children keep their own rotation chain
            if cm['rotation'] == [0, 0, 0]:
                cm['rotation'] = loc_rot
            cm['scale'] = round(cm['scale'] * loc_scale, 4)
            result.append(cm)

    return result


def parse_graphical_cultures(ship_sizes_dir):
    """Parse ship_sizes to get graphical_culture per ship_size.
    Returns dict: ship_id -> [faction1, faction2, ...]
    """
    cultures = {}
    if not os.path.isdir(ship_sizes_dir):
        return cultures

    for filename in sorted(os.listdir(ship_sizes_dir)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(ship_sizes_dir, filename)
        parsed, error = parse_file(filepath)
        if error:
            continue
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            for ship_id, block in entry.items():
                if not isinstance(block, list):
                    continue
                gc = get_value(block, 'graphical_culture')
                if isinstance(gc, list):
                    cultures[ship_id] = [str(v) for v in gc if isinstance(v, str)]

    return cultures


def parse_prescripted_cultures(prescripted_dir):
    """Parse prescripted_countries for empire -> graphical_culture mapping.
    Returns set of known graphical_culture values.
    """
    known_cultures = set()
    if not os.path.isdir(prescripted_dir):
        return known_cultures

    for filename in sorted(os.listdir(prescripted_dir)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(prescripted_dir, filename)
        parsed, error = parse_file(filepath)
        if error:
            continue
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            for key, block in entry.items():
                if not isinstance(block, list):
                    continue
                gc = get_value(block, 'graphical_culture')
                if gc and isinstance(gc, str):
                    known_cultures.add(gc)

    return known_cultures


def parse_all_ship_ids(ship_sizes_dir):
    """Parse ship_sizes to get ALL ship_id keys (including those without graphical_culture).
    Returns set of ship_id strings.
    """
    all_ids = set()
    if not os.path.isdir(ship_sizes_dir):
        return all_ids

    for filename in sorted(os.listdir(ship_sizes_dir)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(ship_sizes_dir, filename)
        parsed, error = parse_file(filepath)
        if error:
            continue
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            for ship_id in entry.keys():
                all_ids.add(ship_id)

    return all_ids


def parse_section_template_entities(section_templates_dir):
    """Parse section_templates to get entity names per ship_size.
    Returns dict: ship_id -> set(entity_names)
    """
    result = {}
    if not os.path.isdir(section_templates_dir):
        return result

    for filename in sorted(os.listdir(section_templates_dir)):
        if not filename.endswith('.txt'):
            continue
        filepath = os.path.join(section_templates_dir, filename)
        parsed, error = parse_file(filepath)
        if error:
            continue
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            if 'ship_section_template' not in entry:
                continue
            block = entry['ship_section_template']
            if not isinstance(block, list):
                continue
            ship_size = get_value(block, 'ship_size')
            entity = get_value(block, 'entity')
            if ship_size and entity:
                if isinstance(entity, str):
                    entity = entity.strip('"')
                if isinstance(ship_size, str):
                    ship_size = ship_size.strip('"')
                result.setdefault(ship_size, set()).add(entity)

    return result


def _is_frame_mesh(entity_name, entities, meshes, mod_root):
    """Check if an entity's mesh is a frame placeholder (<4KB)."""
    ent = entities.get(entity_name)
    if not ent:
        return True
    pdxmesh_name = ent.get('pdxmesh')
    if not pdxmesh_name:
        return True
    mesh_info = meshes.get(pdxmesh_name)
    if not mesh_info or not mesh_info.get('file'):
        return True
    full_path = os.path.join(mod_root, mesh_info['file'].replace('/', os.sep))
    try:
        return os.path.getsize(full_path) < 4096
    except OSError:
        return True


def _add_to_map(ship_models_map, ship_id, faction, entity_name, entities, meshes, mod_root):
    """Resolve entity attachment tree and add to the ship models map.
    Returns True if added, False if already present, failed, or frame placeholder.
    """
    if ship_id not in ship_models_map:
        ship_models_map[ship_id] = {}
    if faction in ship_models_map[ship_id]:
        return False

    # Skip frame placeholder meshes (<4KB, 1 triangle)
    if _is_frame_mesh(entity_name, entities, meshes, mod_root):
        return False

    mesh_list = resolve_attachment_tree(entity_name, entities, meshes, mod_root)
    if not mesh_list:
        return False

    primary = mesh_list[0]
    entry = {
        'entity': entity_name,
        'mesh_file': primary['mesh_file'],
        'scale': primary['scale'],
        'textures': primary['textures'],
    }
    if len(mesh_list) > 1:
        entry['attachments'] = [
            {
                'mesh_file': m['mesh_file'],
                'scale': m['scale'],
                'position': [round(v, 4) for v in m['position']],
                'rotation': [round(v, 4) for v in m['rotation']],
            }
            for m in mesh_list[1:]
        ]

    ship_models_map[ship_id][faction] = entry
    return True


def build_ship_models_map(models_dir, ship_sizes_dir, mod_root, section_templates_dir):
    """Build the complete ship models map.

    Uses a 5-strategy matching algorithm:
    1. Direct coreA entity match
    2. Section_1 entity match
    3. Fuzzy name match with source_dir faction check
    4. Path-based fallback
    5. Section-template entity match for ships without graphical_culture

    Returns:
        ship_models_map: dict of ship_id -> { faction -> { entity, mesh_file, scale, textures, attachments? } }
        stats: dict with counts
    """
    print("  [1/6] Parsing .gfx files (pdxmesh definitions)...")
    meshes, gfx_files, gfx_errors = parse_all_gfx(models_dir)
    print(f"    {len(meshes)} pdxmesh entries from {gfx_files} files ({gfx_errors} errors)")

    print("  [2/6] Parsing .asset files (entity + locator + attach)...")
    entities, asset_files, asset_errors = parse_all_assets(models_dir)
    attach_count = sum(len(e.get('attachments', [])) for e in entities.values())
    print(f"    {len(entities)} entities from {asset_files} files ({asset_errors} errors), {attach_count} attach refs")

    print("  [3/6] Parsing graphical_culture from ship_sizes...")
    cultures = parse_graphical_cultures(ship_sizes_dir)
    print(f"    {len(cultures)} ship sizes with graphical_culture")

    print("  [4/6] Parsing prescripted_countries for extra cultures...")
    extra_cultures = parse_prescripted_cultures(MOD_PRESCRIPTED_COUNTRIES_DIR)
    print(f"    {len(extra_cultures)} known graphical cultures from prescripted countries")

    print("  [5/6] Building ship -> faction -> model mapping (Strategy 1-4)...")

    # Collect all known factions from cultures + prescripted + entity source_dirs
    all_factions = set()
    for factions_list in cultures.values():
        all_factions.update(factions_list)
    all_factions.update(extra_cultures)
    # Also collect source_dirs as potential faction identifiers
    source_dir_factions = set()
    for ent in entities.values():
        sd = ent.get('source_dir', '')
        if sd:
            source_dir_factions.add(sd)

    # Build a reverse lookup: faction_prefix -> [known_factions]
    # e.g. "klingon" -> ["klingon_01"], "federation" -> ["federation"]
    faction_by_prefix = {}
    for f in all_factions:
        base = f.split('_')[0] if '_' in f else f
        faction_by_prefix.setdefault(base, []).append(f)

    ship_models_map = {}
    matched_by_strategy = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    for ship_id, gc_factions in cultures.items():
        for faction in gc_factions:
            # Strategy 1: Direct coreA entity match
            # Pattern: {faction}_{ship_id}_coreA_entity
            coreA_name = f"{faction}_{ship_id}_coreA_entity"
            if coreA_name in entities:
                if _add_to_map(ship_models_map, ship_id, faction, coreA_name, entities, meshes, mod_root):
                    matched_by_strategy[1] += 1
                    continue

            # Strategy 2: Section_1 entity match
            # Pattern: {faction}_{ship_id}_section_1_entity
            section_name = f"{faction}_{ship_id}_section_1_entity"
            if section_name in entities:
                if _add_to_map(ship_models_map, ship_id, faction, section_name, entities, meshes, mod_root):
                    matched_by_strategy[2] += 1
                    continue

            # Strategy 3: Fuzzy name match — entity name contains ship_id AND
            # source_dir matches faction. Collect ALL matches, prefer coreA > section > frame > other.
            candidates = []
            faction_base = faction.split('_')[0] if '_' in faction else faction
            for ent_name, ent_data in entities.items():
                ent_source = ent_data.get('source_dir', '')
                # source_dir must match faction or faction base
                if ent_source != faction and ent_source != faction_base and not ent_source.startswith(faction_base + '_'):
                    continue
                # Entity name must contain ship_id
                ent_lower = ent_name.lower()
                ship_lower = ship_id.lower()
                if ship_lower not in ent_lower:
                    continue
                # Also check entity name starts with faction prefix
                if not ent_lower.startswith(faction_base + '_'):
                    continue
                # Score: prefer coreA > section_1 > frame > other
                if '_corea_entity' in ent_lower:
                    score = 4
                elif '_section_1_entity' in ent_lower:
                    score = 3
                elif '_frame_entity' in ent_lower:
                    score = 2
                else:
                    score = 1
                candidates.append((score, ent_name))

            if candidates:
                candidates.sort(key=lambda x: -x[0])
                for _, cand_entity in candidates:
                    if _add_to_map(ship_models_map, ship_id, faction, cand_entity, entities, meshes, mod_root):
                        matched_by_strategy[3] += 1
                        break
                else:
                    # No candidate accepted → fall through to Strategy 4
                    pass
                if faction in ship_models_map.get(ship_id, {}):
                    continue

            # Strategy 4: Path-based fallback — find entity whose mesh file is in
            # gfx/models/ships/{faction}/ and whose name contains ship_id
            for ent_name, ent_data in entities.items():
                pdxmesh_name = ent_data.get('pdxmesh')
                if not pdxmesh_name:
                    continue
                mesh_info = meshes.get(pdxmesh_name)
                if not mesh_info or not mesh_info.get('file'):
                    continue
                mesh_file = mesh_info['file']
                parts = mesh_file.replace('\\', '/').split('/')
                if len(parts) >= 4 and parts[0] == 'gfx' and parts[2] == 'ships':
                    path_faction = parts[3]
                else:
                    continue
                # path_faction must match
                if path_faction != faction and path_faction != faction_base and not path_faction.startswith(faction_base + '_'):
                    continue
                ent_lower = ent_name.lower()
                ship_lower = ship_id.lower()
                if ship_lower in ent_lower:
                    if _add_to_map(ship_models_map, ship_id, faction, ent_name, entities, meshes, mod_root):
                        matched_by_strategy[4] += 1
                        break

    # Strategy 5: Section-template entity match for ships without graphical_culture
    print("  [6/6] Matching event ships via section templates (Strategy 5)...")
    all_ship_ids = parse_all_ship_ids(ship_sizes_dir)
    ships_without_culture = all_ship_ids - set(cultures.keys())
    section_entities = parse_section_template_entities(section_templates_dir)
    print(f"    {len(ships_without_culture)} ships without graphical_culture, "
          f"{len(section_entities)} ships with section templates")

    for ship_id in sorted(ships_without_culture):
        if ship_id in ship_models_map:
            continue
        ent_names = section_entities.get(ship_id, set())
        if not ent_names:
            continue
        # Filter: only real meshes, no frames
        real_entities = [e for e in ent_names if not _is_frame_mesh(e, entities, meshes, mod_root)]
        if not real_entities:
            continue
        best = sorted(real_entities)[0]
        if _add_to_map(ship_models_map, ship_id, 'other', best, entities, meshes, mod_root):
            matched_by_strategy[5] += 1

    # Remove empty entries
    ship_models_map = {k: v for k, v in ship_models_map.items() if v}

    stats = {
        'gfx_files': gfx_files,
        'asset_files': asset_files,
        'pdxmeshes': len(meshes),
        'entities': len(entities),
        'entities_with_attachments': sum(1 for e in entities.values() if e.get('attachments')),
        'total_attach_refs': attach_count,
        'ship_sizes_with_culture': len(cultures),
        'ships_with_models': len(ship_models_map),
        'total_variants': sum(len(v) for v in ship_models_map.values()),
        'variants_with_attachments': sum(
            1 for factions in ship_models_map.values()
            for info in factions.values()
            if info.get('attachments')
        ),
        'matched_strategy_1_coreA': matched_by_strategy[1],
        'matched_strategy_2_section': matched_by_strategy[2],
        'matched_strategy_3_fuzzy': matched_by_strategy[3],
        'matched_strategy_4_path': matched_by_strategy[4],
        'matched_strategy_5_section_tpl': matched_by_strategy[5],
        'errors': gfx_errors + asset_errors,
    }

    print(f"    {stats['ships_with_models']} ships with models, {stats['total_variants']} faction variants")
    print(f"    Strategy matches: coreA={matched_by_strategy[1]}, section={matched_by_strategy[2]}, "
          f"fuzzy={matched_by_strategy[3]}, path={matched_by_strategy[4]}, section_tpl={matched_by_strategy[5]}")
    print(f"    {stats['variants_with_attachments']} variants have multi-mesh attachments")

    return ship_models_map, stats


def parse_all():
    """Main entry point. Returns (ship_models_map, stats)."""
    return build_ship_models_map(MOD_SHIP_MODELS_DIR, MOD_SHIP_SIZES_DIR, STNH_MOD_ROOT, MOD_SECTION_TEMPLATES_DIR)


if __name__ == '__main__':
    import json
    model_map, stats = parse_all()
    print(f"\nStats: {json.dumps(stats, indent=2)}")

    # Show entries with attachments
    print("\n--- Ships with attachments ---")
    for ship_id in sorted(model_map.keys()):
        for faction, info in model_map[ship_id].items():
            att = info.get('attachments', [])
            if att:
                print(f"  {ship_id} ({faction}): {len(att)} attachments")

    # Show a few sample entries
    print("\n--- Sample entries ---")
    for ship_id in sorted(model_map.keys())[:5]:
        factions = model_map[ship_id]
        print(f"\n{ship_id}:")
        for faction, info in factions.items():
            print(f"  {faction}: {info['mesh_file']} ({info['scale']}x)")
            if info.get('attachments'):
                print(f"    + {len(info['attachments'])} attached meshes")
