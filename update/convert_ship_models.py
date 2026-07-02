"""
Ship model converter: PdxMesh (.mesh) -> GLB files (geometry only).

Converts binary .mesh files to glTF/GLB format with a uniform gray material.
Supports multi-mesh composition via attachment data (e.g. Borg Super Cube = skeleton + 8 cubes).
No textures — just the 3D mesh for a visual impression of each ship model.

Dependencies: pygltflib
"""

import os
import json
import math
import time
import struct
import hashlib

from config import STNH_MOD_ROOT, OUTPUT_MODELS_DIR, OUTPUT_ASSETS_DIR, VANILLA_ROOT
from pdx_mesh_reader import parse_mesh_file, extract_mesh_data

_pygltflib = None


def _ensure_deps():
    global _pygltflib
    if _pygltflib is None:
        import pygltflib
        _pygltflib = pygltflib


def _pack_floats(values):
    """Pack a list of floats into bytes (little-endian float32)."""
    return struct.pack(f'<{len(values)}f', *values)


def _pack_ints(values):
    """Pack a list of ints into bytes (uint16 or uint32 depending on range)."""
    max_val = max(values) if values else 0
    if max_val <= 65535:
        return struct.pack(f'<{len(values)}H', *values), 5123  # UNSIGNED_SHORT
    else:
        return struct.pack(f'<{len(values)}I', *values), 5125  # UNSIGNED_INT


def _euler_to_quaternion(pitch_deg, roll_deg, yaw_deg):
    """Convert Euler angles (degrees) to quaternion [x, y, z, w].

    Stellaris uses degrees with ZYX convention (yaw, pitch, roll).
    """
    p = math.radians(pitch_deg)
    r = math.radians(roll_deg)
    y = math.radians(yaw_deg)

    cp, sp = math.cos(p * 0.5), math.sin(p * 0.5)
    cr, sr = math.cos(r * 0.5), math.sin(r * 0.5)
    cy, sy = math.cos(y * 0.5), math.sin(y * 0.5)

    # ZYX order
    qw = cp * cr * cy + sp * sr * sy
    qx = sp * cr * cy - cp * sr * sy
    qy = cp * sr * cy + sp * cr * sy
    qz = cp * cr * sy - sp * sr * cy

    return [qx, qy, qz, qw]


def _build_mesh_nodes(mesh_data_list, model_scale, gltf, buffer_data, accessors,
                      buffer_views, meshes_gltf, material_idx):
    """Build GLB nodes from parsed mesh data. Returns list of node indices."""
    node_indices = []

    for mesh_data in mesh_data_list:
        positions = mesh_data['positions']
        normals = mesh_data['normals']
        triangles = mesh_data['triangles']
        vertex_count = mesh_data['vertex_count']

        if vertex_count == 0:
            continue

        # Apply scale
        if model_scale and model_scale != 1.0:
            positions = [p * model_scale for p in positions]

        attrs = {}

        # Positions
        pos_bytes = _pack_floats(positions)
        pos_offset = len(buffer_data)
        buffer_data.extend(pos_bytes)
        while len(buffer_data) % 4 != 0:
            buffer_data.append(0)

        pos_bv = len(buffer_views)
        buffer_views.append(gltf.BufferView(
            buffer=0, byteOffset=pos_offset, byteLength=len(pos_bytes),
            target=34962,
        ))

        # Bounding box
        min_pos = [float('inf')] * 3
        max_pos = [float('-inf')] * 3
        for i in range(vertex_count):
            for j in range(3):
                v = positions[i * 3 + j]
                min_pos[j] = min(min_pos[j], v)
                max_pos[j] = max(max_pos[j], v)

        pos_acc = len(accessors)
        accessors.append(gltf.Accessor(
            bufferView=pos_bv, byteOffset=0, componentType=5126,
            count=vertex_count, type='VEC3',
            max=max_pos, min=min_pos,
        ))
        attrs['POSITION'] = pos_acc

        # Normals
        if normals and len(normals) == vertex_count * 3:
            norm_bytes = _pack_floats(normals)
            norm_offset = len(buffer_data)
            buffer_data.extend(norm_bytes)
            while len(buffer_data) % 4 != 0:
                buffer_data.append(0)

            norm_bv = len(buffer_views)
            buffer_views.append(gltf.BufferView(
                buffer=0, byteOffset=norm_offset, byteLength=len(norm_bytes),
                target=34962,
            ))

            norm_acc = len(accessors)
            accessors.append(gltf.Accessor(
                bufferView=norm_bv, byteOffset=0, componentType=5126,
                count=vertex_count, type='VEC3',
            ))
            attrs['NORMAL'] = norm_acc

        # Triangle indices
        idx_bytes, idx_component_type = _pack_ints(triangles)
        idx_offset = len(buffer_data)
        buffer_data.extend(idx_bytes)
        while len(buffer_data) % 4 != 0:
            buffer_data.append(0)

        idx_bv = len(buffer_views)
        buffer_views.append(gltf.BufferView(
            buffer=0, byteOffset=idx_offset, byteLength=len(idx_bytes),
            target=34963,
        ))

        idx_acc = len(accessors)
        accessors.append(gltf.Accessor(
            bufferView=idx_bv, byteOffset=0, componentType=idx_component_type,
            count=len(triangles), type='SCALAR',
        ))

        primitive = gltf.Primitive(
            attributes=gltf.Attributes(**attrs),
            indices=idx_acc,
            material=material_idx,
        )

        mesh_index = len(meshes_gltf)
        meshes_gltf.append(gltf.Mesh(
            primitives=[primitive],
            name=mesh_data['name'],
        ))
        node_indices.append(mesh_index)

    return node_indices


def _load_mesh_data(mesh_file_path, root_dir=None):
    """Load and filter mesh data from a .mesh file. Returns list or None.
    Checks mod root first, then falls back to vanilla Stellaris root.
    """
    full_mesh_path = os.path.join(root_dir or STNH_MOD_ROOT, mesh_file_path.replace('/', os.sep))
    if not os.path.isfile(full_mesh_path):
        # Fallback: try vanilla Stellaris root
        full_mesh_path = os.path.join(VANILLA_ROOT, mesh_file_path.replace('/', os.sep))
        if not os.path.isfile(full_mesh_path):
            return None
    try:
        root = parse_mesh_file(full_mesh_path)
        mesh_data_list = extract_mesh_data(root)
    except Exception:
        return None
    mesh_data_list = [m for m in mesh_data_list if m['vertex_count'] > 0 and m['triangle_count'] > 0]
    return mesh_data_list if mesh_data_list else None


def convert_ship_to_glb(mesh_file_path, model_scale, output_path, attachments=None, root_dir=None):
    """Convert a ship (primary mesh + optional attachments) to .glb.

    Args:
        mesh_file_path: Relative path to primary .mesh file (from mod root)
        model_scale: Combined entity+mesh scale factor for primary mesh
        output_path: Where to write the .glb file
        attachments: Optional list of { mesh_file, scale, position, rotation }
        root_dir: Optional mod root override (default: STNH_MOD_ROOT)

    Returns:
        True on success, False on failure
    """
    _ensure_deps()
    gltf = _pygltflib

    primary_data = _load_mesh_data(mesh_file_path, root_dir=root_dir)
    if not primary_data:
        return False

    buffer_data = bytearray()
    accessors = []
    buffer_views = []
    meshes_gltf = []
    nodes = []

    material = gltf.Material(
        pbrMetallicRoughness=gltf.PbrMetallicRoughness(
            baseColorFactor=[0.6, 0.6, 0.7, 1.0],
            metallicFactor=0.3,
            roughnessFactor=0.5,
        ),
        doubleSided=True,
    )

    # Build primary mesh nodes
    primary_mesh_indices = _build_mesh_nodes(
        primary_data, model_scale, gltf, buffer_data, accessors,
        buffer_views, meshes_gltf, 0
    )
    for mi in primary_mesh_indices:
        nodes.append(gltf.Node(mesh=mi, name=meshes_gltf[mi].name or f"primary_{mi}"))

    # Build attachment mesh nodes
    if attachments:
        for att_idx, att in enumerate(attachments):
            att_mesh_file = att.get('mesh_file', '')
            att_scale = att.get('scale', 1.0)
            att_position = att.get('position', [0, 0, 0])
            att_rotation = att.get('rotation', [0, 0, 0])

            att_data = _load_mesh_data(att_mesh_file, root_dir=root_dir)
            if not att_data:
                continue

            att_mesh_indices = _build_mesh_nodes(
                att_data, att_scale, gltf, buffer_data, accessors,
                buffer_views, meshes_gltf, 0
            )

            if not att_mesh_indices:
                continue

            # Create child nodes for attachment meshes
            child_node_indices = []
            for mi in att_mesh_indices:
                child_idx = len(nodes)
                nodes.append(gltf.Node(mesh=mi, name=f"att{att_idx}_{mi}"))
                child_node_indices.append(child_idx)

            # Create a parent node with transform for the attachment group
            has_transform = (att_position != [0, 0, 0] or att_rotation != [0, 0, 0])
            if has_transform:
                parent_idx = len(nodes)
                parent_node = gltf.Node(
                    name=f"attach_{att_idx}",
                    children=child_node_indices,
                )
                # Apply translation (position scaled by primary model scale)
                if att_position != [0, 0, 0]:
                    parent_node.translation = att_position
                # Apply rotation (Euler to quaternion)
                if att_rotation != [0, 0, 0]:
                    parent_node.rotation = _euler_to_quaternion(
                        att_rotation[0], att_rotation[1], att_rotation[2]
                    )
                nodes.append(parent_node)
                # Only the parent goes into the scene root; children are nested
                # Mark child nodes to exclude from scene root
                for ci in child_node_indices:
                    nodes[ci]._is_child = True
                nodes[parent_idx]._is_child = False
            # No transform needed — just leave children at scene root

    if not nodes:
        return False

    # Build scene: only top-level nodes (not children of transform groups)
    scene_node_indices = []
    for i, node in enumerate(nodes):
        if not getattr(node, '_is_child', False):
            scene_node_indices.append(i)

    # Clean up temporary _is_child attribute
    for node in nodes:
        if hasattr(node, '_is_child'):
            del node._is_child

    scene = gltf.Scene(nodes=scene_node_indices)

    glb = gltf.GLTF2(
        scene=0,
        scenes=[scene],
        nodes=nodes,
        meshes=meshes_gltf,
        accessors=accessors,
        bufferViews=buffer_views,
        buffers=[gltf.Buffer(byteLength=len(buffer_data))],
        materials=[material],
    )

    glb.set_binary_blob(bytes(buffer_data))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    glb.save(output_path)
    return True


# Keep old name as alias for backwards compatibility during transition
convert_mesh_to_glb = convert_ship_to_glb


# ---------------------------------------------------------------------------
# Conversion cache (mtime + info-hash manifest)
#
# The old skip logic only checked whether the output .glb existed, so a mesh
# edited in place (or a changed scale/attachment set in the .gfx/.asset) was
# never re-converted. The manifest records, per output path, the newest source
# mtime and a hash of the model's info dict. An output is up to date only if it
# exists, the manifest matches the current info hash, and no source .mesh is
# newer than the recorded mtime.
# ---------------------------------------------------------------------------

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')


def _resolve_source_path(mesh_file_path):
    """Resolve a relative .mesh path to an absolute file (mod root, then vanilla).
    Returns the absolute path if found, else None.
    """
    rel = mesh_file_path.replace('/', os.sep)
    for root in (STNH_MOD_ROOT, VANILLA_ROOT):
        cand = os.path.join(root, rel)
        if os.path.isfile(cand):
            return cand
    return None


def _source_mesh_paths(info):
    """All source .mesh paths for a model variant (primary + attachments)."""
    paths = [info['mesh_file']]
    for att in (info.get('attachments') or []):
        mf = att.get('mesh_file')
        if mf:
            paths.append(mf)
    return paths


def _info_signature(info):
    """Stable hash of the fields that affect conversion output."""
    relevant = {
        'mesh_file': info.get('mesh_file'),
        'scale': info.get('scale', 1.0),
        'attachments': info.get('attachments'),
    }
    blob = json.dumps(relevant, sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(blob.encode('utf-8')).hexdigest()


def _load_manifest(name):
    path = os.path.join(CACHE_DIR, name)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_manifest(name, manifest):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, name)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f)


def _bootstrap_manifest(manifest, models_map, output_path_fn):
    """One-time seed for the migration from existence-only skipping.

    If the manifest is empty but GLBs already exist on disk, record their
    current signature + mtime so the first run after this change does not
    re-convert every already-present model. Mutates and returns manifest.
    """
    if manifest:
        return manifest
    for item_id, factions in models_map.items():
        for faction, info in factions.items():
            op = output_path_fn(item_id, faction)
            if os.path.isfile(op):
                manifest[op] = {
                    'sig': _info_signature(info),
                    'mtime': os.path.getmtime(op),
                }
    return manifest


def _is_up_to_date(output_path, info, manifest):
    """True if output_path exists and is current w.r.t. info + source mtimes."""
    if not os.path.isfile(output_path):
        return False
    rec = manifest.get(output_path)
    if not rec or rec.get('sig') != _info_signature(info):
        return False
    out_mtime = os.path.getmtime(output_path)
    for rel in _source_mesh_paths(info):
        src = _resolve_source_path(rel)
        if src is None:
            # Source vanished -> force a reconvert attempt (fails loudly rather
            # than silently serving a stale GLB).
            return False
        if os.path.getmtime(src) > out_mtime:
            return False
    return True


def convert_all(skip_existing=True):
    """Convert all ship models from ship_models_map.json to GLB.

    Returns stats dict.
    """
    _ensure_deps()

    start = time.time()
    map_path = os.path.join(OUTPUT_ASSETS_DIR, 'ship_models_map.json')
    if not os.path.isfile(map_path):
        print("  [ERROR] ship_models_map.json not found. Run parse_ship_models.py first.")
        return {'converted': 0, 'skipped': 0, 'failed': 0, 'elapsed': 0}

    with open(map_path, 'r', encoding='utf-8') as f:
        ship_models_map = json.load(f)

    manifest = _load_manifest('ship_model_manifest.json')
    _bootstrap_manifest(
        manifest, ship_models_map,
        lambda sid, fac: os.path.join(OUTPUT_MODELS_DIR, fac, f"{sid}.glb"),
    )

    converted = 0
    skipped = 0
    failed = 0
    multi_mesh = 0
    total = sum(len(factions) for factions in ship_models_map.values())

    print(f"  Converting {total} ship model variants to GLB (geometry only)...")

    for ship_id, factions in ship_models_map.items():
        for faction, info in factions.items():
            output_path = os.path.join(OUTPUT_MODELS_DIR, faction, f"{ship_id}.glb")

            if skip_existing and _is_up_to_date(output_path, info, manifest):
                skipped += 1
                continue

            attachments = info.get('attachments')
            success = convert_ship_to_glb(
                mesh_file_path=info['mesh_file'],
                model_scale=info.get('scale', 1.0),
                output_path=output_path,
                attachments=attachments,
            )

            if success:
                converted += 1
                if attachments:
                    multi_mesh += 1
                manifest[output_path] = {
                    'sig': _info_signature(info),
                    'mtime': os.path.getmtime(output_path),
                }
            else:
                failed += 1

    _save_manifest('ship_model_manifest.json', manifest)

    elapsed = time.time() - start
    stats = {
        'converted': converted,
        'skipped': skipped,
        'failed': failed,
        'multi_mesh': multi_mesh,
        'total': total,
        'elapsed': round(elapsed, 1),
    }
    print(f"  Converted: {converted} ({multi_mesh} multi-mesh), Skipped: {skipped}, Failed: {failed} ({elapsed:.1f}s)")
    return stats


if __name__ == '__main__':
    stats = convert_all()
    print(f"\nDone: {json.dumps(stats, indent=2)}")
