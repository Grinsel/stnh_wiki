"""
Megastructure model mapping parser for STNH mod.
Resolves megastructure entity references to actual mod entities and their mesh data.

Handles two cases:
A) Direct entity: entity name exists in mod assets (e.g. "argus_array_entity")
B) Generic entity: entity name is a bare template (e.g. "orbital_habitat_entity")
   that doesn't exist, but faction-specific variants do (e.g. "suliban_01_orbital_habitat_entity")

Reuses parse_ship_models.py for GFX/asset parsing and attachment resolution.
"""

import os
import json

from config import MOD_SHIP_MODELS_DIR, STNH_MOD_ROOT, OUTPUT_ASSETS_DIR
from parse_megastructures import parse_all_megastructures
from parse_ship_models import (
    parse_all_gfx,
    parse_all_assets,
    resolve_attachment_tree,
    _is_frame_mesh,
)


def _find_faction_variants(bare_name, entities):
    """Find faction-specific variants of a generic entity name.

    E.g. 'orbital_habitat_entity' -> {'suliban_01': 'suliban_01_orbital_habitat_entity', ...}
    """
    suffix = f"_{bare_name}"
    return {
        name[:-len(suffix)]: name
        for name in entities
        if name.endswith(suffix) and name != bare_name
    }


def _resolve_entity_to_model(entity_name, entities, meshes, mod_root):
    """Resolve entity attachment tree into model data dict, or None on failure."""
    mesh_list = resolve_attachment_tree(entity_name, entities, meshes, mod_root)
    if not mesh_list:
        return None

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
    return entry


def _resolve_mega_entity(entity_name, entities, meshes, mod_root):
    """Resolve a megastructure entity name to model data.

    Returns dict: { faction_or_generic -> model_data } or {} on failure.

    1. Direct lookup: entity_name exists in entities -> {"generic": ...}
    2. Faction expansion: suffix-match -> {faction1: ..., faction2: ...}
    3. Frame filter: _is_frame_mesh() -> skip
    """
    # Strategy 1: Direct lookup
    if entity_name in entities:
        if _is_frame_mesh(entity_name, entities, meshes, mod_root):
            return {}
        model = _resolve_entity_to_model(entity_name, entities, meshes, mod_root)
        if model:
            return {'generic': model}
        return {}

    # Strategy 2: Faction variants
    variants = _find_faction_variants(entity_name, entities)
    if not variants:
        return {}

    result = {}
    for faction, full_name in sorted(variants.items()):
        if _is_frame_mesh(full_name, entities, meshes, mod_root):
            continue
        model = _resolve_entity_to_model(full_name, entities, meshes, mod_root)
        if model:
            result[faction] = model

    return result


def build_mega_models_map(megas, models_dir, mod_root):
    """Build the megastructure models map.

    Args:
        megas: List of megastructure dicts from parse_all_megastructures()
        models_dir: Path to gfx/models/ships/
        mod_root: STNH mod root path

    Returns:
        mega_models_map: dict of mega_id -> { faction -> model_data }
        stats: dict with counts
    """
    print("  [1/3] Parsing .gfx files (pdxmesh definitions)...")
    meshes, gfx_files, gfx_errors = parse_all_gfx(models_dir)
    print(f"    {len(meshes)} pdxmesh entries from {gfx_files} files ({gfx_errors} errors)")

    print("  [2/3] Parsing .asset files (entity definitions)...")
    entities, asset_files, asset_errors = parse_all_assets(models_dir)
    print(f"    {len(entities)} entities from {asset_files} files ({asset_errors} errors)")

    print("  [3/3] Resolving megastructure entities...")

    mega_models_map = {}
    resolved_direct = 0
    resolved_faction = 0
    skipped_vanilla = 0
    skipped_empty = 0
    skipped_frame = 0

    for mega in megas:
        mega_id = mega['id']

        # Priority: entity first, then construction_entity as fallback
        entity_name = mega.get('entity', '').strip('"').strip()
        if not entity_name:
            entity_name = mega.get('construction_entity', '').strip('"').strip()
        if not entity_name:
            skipped_empty += 1
            continue

        result = _resolve_mega_entity(entity_name, entities, meshes, mod_root)

        if not result:
            # Entity not found in mod -> likely vanilla
            skipped_vanilla += 1
            continue

        if 'generic' in result:
            resolved_direct += 1
        else:
            resolved_faction += 1

        mega_models_map[mega_id] = result

    # Remove empty entries
    mega_models_map = {k: v for k, v in mega_models_map.items() if v}

    total_variants = sum(len(v) for v in mega_models_map.values())
    variants_with_attachments = sum(
        1 for factions in mega_models_map.values()
        for info in factions.values()
        if info.get('attachments')
    )

    stats = {
        'megas_total': len(megas),
        'megas_with_models': len(mega_models_map),
        'total_variants': total_variants,
        'variants_with_attachments': variants_with_attachments,
        'resolved_direct': resolved_direct,
        'resolved_faction': resolved_faction,
        'skipped_vanilla': skipped_vanilla,
        'skipped_empty': skipped_empty,
        'errors': gfx_errors + asset_errors,
    }

    print(f"    {len(mega_models_map)} megas with models, {total_variants} variants")
    print(f"    Direct: {resolved_direct}, Faction-expanded: {resolved_faction}")
    print(f"    Skipped: {skipped_vanilla} vanilla, {skipped_empty} empty entity")
    print(f"    {variants_with_attachments} variants have multi-mesh attachments")

    return mega_models_map, stats


def parse_all():
    """Main entry point. Returns (mega_models_map, stats)."""
    megas, _ = parse_all_megastructures()
    return build_mega_models_map(megas, MOD_SHIP_MODELS_DIR, STNH_MOD_ROOT)


if __name__ == '__main__':
    model_map, stats = parse_all()
    print(f"\nStats: {json.dumps(stats, indent=2)}")

    # Show a few sample entries
    print(f"\n--- {len(model_map)} mega models ---")
    for mega_id in sorted(model_map.keys())[:10]:
        factions = model_map[mega_id]
        fac_list = ', '.join(sorted(factions.keys()))
        print(f"  {mega_id}: [{fac_list}]")

    # Show faction-expanded entries
    print("\n--- Faction-expanded megas ---")
    for mega_id in sorted(model_map.keys()):
        factions = model_map[mega_id]
        if len(factions) > 1:
            print(f"  {mega_id}: {len(factions)} variants")
