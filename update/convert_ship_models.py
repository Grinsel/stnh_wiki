"""
Ship model converter: PdxMesh (.mesh) -> GLB files (geometry only).

Converts binary .mesh files to glTF/GLB format with a uniform gray material.
No textures — just the 3D mesh for a visual impression of each ship model.

Dependencies: pygltflib
"""

import os
import json
import time
import struct

from config import STNH_MOD_ROOT, OUTPUT_MODELS_DIR, OUTPUT_ASSETS_DIR
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


def convert_mesh_to_glb(mesh_file_path, model_scale, output_path):
    """Convert a single .mesh file to .glb (geometry only, no textures).

    Args:
        mesh_file_path: Relative path to .mesh file (from mod root)
        model_scale: Combined entity+mesh scale factor
        output_path: Where to write the .glb file

    Returns:
        True on success, False on failure
    """
    _ensure_deps()
    gltf = _pygltflib

    full_mesh_path = os.path.join(STNH_MOD_ROOT, mesh_file_path.replace('/', os.sep))
    if not os.path.isfile(full_mesh_path):
        return False

    try:
        root = parse_mesh_file(full_mesh_path)
        mesh_data_list = extract_mesh_data(root)
    except Exception:
        return False

    if not mesh_data_list:
        return False

    # Filter out meshes with no geometry
    mesh_data_list = [m for m in mesh_data_list if m['vertex_count'] > 0 and m['triangle_count'] > 0]
    if not mesh_data_list:
        return False

    # Single gray material for all sub-meshes
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
            material=0,
        )

        mesh_index = len(meshes_gltf)
        meshes_gltf.append(gltf.Mesh(
            primitives=[primitive],
            name=mesh_data['name'],
        ))
        nodes.append(gltf.Node(mesh=mesh_index, name=mesh_data['name']))

    if not nodes:
        return False

    scene = gltf.Scene(nodes=list(range(len(nodes))))

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

    converted = 0
    skipped = 0
    failed = 0
    total = sum(len(factions) for factions in ship_models_map.values())

    print(f"  Converting {total} ship model variants to GLB (geometry only)...")

    for ship_id, factions in ship_models_map.items():
        for faction, info in factions.items():
            output_path = os.path.join(OUTPUT_MODELS_DIR, faction, f"{ship_id}.glb")

            if skip_existing and os.path.isfile(output_path):
                skipped += 1
                continue

            success = convert_mesh_to_glb(
                mesh_file_path=info['mesh_file'],
                model_scale=info.get('scale', 1.0),
                output_path=output_path,
            )

            if success:
                converted += 1
            else:
                failed += 1

    elapsed = time.time() - start
    stats = {
        'converted': converted,
        'skipped': skipped,
        'failed': failed,
        'total': total,
        'elapsed': round(elapsed, 1),
    }
    print(f"  Converted: {converted}, Skipped: {skipped}, Failed: {failed} ({elapsed:.1f}s)")
    return stats


if __name__ == '__main__':
    stats = convert_all()
    print(f"\nDone: {json.dumps(stats, indent=2)}")
