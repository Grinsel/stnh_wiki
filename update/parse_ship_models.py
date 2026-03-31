"""
Ship model mapping parser for STNH mod.
Parses .gfx and .asset files under gfx/models/ships/ to build
a mapping from ship_size -> faction -> { entity, mesh_file, scale, textures }.
"""

import os
from parse_pdx import parse_file, get_value, get_all_values, get_blocks
from config import MOD_SHIP_MODELS_DIR, STNH_MOD_ROOT, MOD_SHIP_SIZES_DIR


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

            # .gfx files have objectTypes = { pdxmesh = { ... } pdxmesh = { ... } }
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
    Returns dict: entity_name -> { pdxmesh, scale }
    """
    entities = {}
    file_count = 0
    error_count = 0

    for root, dirs, files in os.walk(models_dir):
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
                pdxmesh = get_value(ent_block, 'pdxmesh')
                if not name or not pdxmesh:
                    continue

                scale = get_value(ent_block, 'scale')
                if isinstance(scale, str):
                    try:
                        scale = float(scale)
                    except ValueError:
                        scale = 1.0

                entities[name] = {
                    'pdxmesh': pdxmesh,
                    'scale': scale if scale else 1.0,
                }

    return entities, file_count, error_count


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


def _detect_faction_from_path(filepath, models_dir):
    """Detect faction name from path relative to models/ships/."""
    rel = os.path.relpath(filepath, models_dir).replace('\\', '/')
    parts = rel.split('/')
    if parts:
        return parts[0]
    return 'unknown'


def build_ship_models_map(models_dir, ship_sizes_dir, mod_root):
    """Build the complete ship models map.

    Returns:
        ship_models_map: dict of ship_id -> { faction -> { entity, mesh_file, scale, textures } }
        stats: dict with counts
    """
    print("  [1/4] Parsing .gfx files (pdxmesh definitions)...")
    meshes, gfx_files, gfx_errors = parse_all_gfx(models_dir)
    print(f"    {len(meshes)} pdxmesh entries from {gfx_files} files ({gfx_errors} errors)")

    print("  [2/4] Parsing .asset files (entity definitions)...")
    entities, asset_files, asset_errors = parse_all_assets(models_dir)
    print(f"    {len(entities)} entity entries from {asset_files} files ({asset_errors} errors)")

    print("  [3/4] Parsing graphical_culture from ship_sizes...")
    cultures = parse_graphical_cultures(ship_sizes_dir)
    print(f"    {len(cultures)} ship sizes with graphical_culture")

    print("  [4/4] Building ship -> faction -> model mapping...")

    # Build entity_name -> faction lookup from entity naming conventions
    # Entity names follow pattern: {faction}_{shiptype}_entity
    # e.g. "federation_corvette_coreA_entity"

    # Build reverse map: for each ship_size, find matching entities per faction
    ship_models_map = {}

    # Strategy: For each entity, try to match it to a ship_size + faction
    # Entity names often contain the ship_id: federation_{ship_id}_entity
    # or {faction}_{ship_id}_section_X_entity
    for entity_name, ent_data in entities.items():
        pdxmesh_name = ent_data['pdxmesh']
        mesh_info = meshes.get(pdxmesh_name)
        if not mesh_info:
            continue

        mesh_file = mesh_info['file']
        if not mesh_file:
            continue

        # Verify mesh file exists
        full_mesh_path = os.path.join(mod_root, mesh_file.replace('/', os.sep))
        if not os.path.isfile(full_mesh_path):
            continue

        # Try to find faction from entity name or mesh path
        # Common patterns:
        # federation_corvette_coreA_entity -> faction=federation
        # klingon_01_corvette_frame_entity -> faction=klingon
        faction = None
        for gc_ship_id, gc_factions in cultures.items():
            for f in gc_factions:
                if entity_name.startswith(f + '_') or entity_name.startswith(f.replace('_01', '') + '_'):
                    # Check if this entity name references this ship_id
                    if gc_ship_id in entity_name or gc_ship_id.replace('_', '') in entity_name.replace('_', ''):
                        faction = f
                        if gc_ship_id not in ship_models_map:
                            ship_models_map[gc_ship_id] = {}
                        if faction not in ship_models_map[gc_ship_id]:
                            # Combine scales
                            combined_scale = (ent_data.get('scale', 1.0) or 1.0) * (mesh_info.get('scale', 1.0) or 1.0)
                            ship_models_map[gc_ship_id][faction] = {
                                'entity': entity_name,
                                'mesh_file': mesh_file,
                                'scale': round(combined_scale, 4),
                                'textures': mesh_info.get('textures', {}),
                            }
                        break
            if faction:
                break

    # Also build a simpler approach: match by mesh file path
    # gfx/models/ships/{faction}/... -> faction
    for entity_name, ent_data in entities.items():
        pdxmesh_name = ent_data['pdxmesh']
        mesh_info = meshes.get(pdxmesh_name)
        if not mesh_info or not mesh_info['file']:
            continue

        mesh_file = mesh_info['file']
        # Extract faction from path: gfx/models/ships/{faction}/...
        parts = mesh_file.replace('\\', '/').split('/')
        if len(parts) >= 4 and parts[0] == 'gfx' and parts[1] == 'models' and parts[2] == 'ships':
            path_faction = parts[3]
        else:
            continue

        # Match entity to ship_sizes by name
        for ship_id, gc_factions in cultures.items():
            # Check if path_faction matches or is a variant of a graphical_culture
            matching_faction = None
            for f in gc_factions:
                if path_faction == f or path_faction.startswith(f + '_') or path_faction == f.split('_')[0]:
                    matching_faction = f
                    break

            if not matching_faction:
                continue

            # Check if entity references this ship
            entity_lower = entity_name.lower()
            ship_lower = ship_id.lower()
            if ship_lower in entity_lower or ship_lower.replace('_', '') in entity_lower.replace('_', ''):
                if ship_id not in ship_models_map:
                    ship_models_map[ship_id] = {}
                if matching_faction not in ship_models_map[ship_id]:
                    combined_scale = (ent_data.get('scale', 1.0) or 1.0) * (mesh_info.get('scale', 1.0) or 1.0)
                    full_mesh_path = os.path.join(mod_root, mesh_file.replace('/', os.sep))
                    if os.path.isfile(full_mesh_path):
                        ship_models_map[ship_id][matching_faction] = {
                            'entity': entity_name,
                            'mesh_file': mesh_file,
                            'scale': round(combined_scale, 4),
                            'textures': mesh_info.get('textures', {}),
                        }

    # Remove empty entries
    ship_models_map = {k: v for k, v in ship_models_map.items() if v}

    stats = {
        'gfx_files': gfx_files,
        'asset_files': asset_files,
        'pdxmeshes': len(meshes),
        'entities': len(entities),
        'ship_sizes_with_culture': len(cultures),
        'ships_with_models': len(ship_models_map),
        'total_variants': sum(len(v) for v in ship_models_map.values()),
        'errors': gfx_errors + asset_errors,
    }

    print(f"    {stats['ships_with_models']} ships with models, {stats['total_variants']} faction variants")

    return ship_models_map, stats


def parse_all():
    """Main entry point. Returns (ship_models_map, stats)."""
    return build_ship_models_map(MOD_SHIP_MODELS_DIR, MOD_SHIP_SIZES_DIR, STNH_MOD_ROOT)


if __name__ == '__main__':
    import json
    model_map, stats = parse_all()
    print(f"\nStats: {json.dumps(stats, indent=2)}")
    # Show a few sample entries
    for ship_id in sorted(model_map.keys())[:5]:
        factions = model_map[ship_id]
        print(f"\n{ship_id}:")
        for faction, info in factions.items():
            print(f"  {faction}: {info['mesh_file']} ({info['scale']}x)")
            if info['textures']:
                print(f"    textures: {info['textures']}")
