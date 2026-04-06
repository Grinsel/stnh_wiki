"""
PdxMesh binary format reader (.mesh files).

Parses the Paradox binary mesh format (@@b@ header) into a Python tree structure.
Extracts vertices, normals, UVs, triangle indices, and material info.

Binary format:
  - Header: @@b@ (4 bytes)
  - Tokens: ! (property) or [ (object/node)
  - Properties: ! name_len name type count data
  - Objects: [[[name\0  (depth = number of [ characters)
  - Types: i=int32[], f=float32[], s=string[]

References:
  - JoroDox (DaanBroekhof/JoroDox, MIT license)
  - io_pdx_mesh (ross-g/io_pdx_mesh, MIT license)
"""

import struct


class PdxNode:
    """A node in the PdxMesh binary tree."""
    __slots__ = ('name', 'depth', 'properties', 'children')

    def __init__(self, name, depth):
        self.name = name
        self.depth = depth
        self.properties = {}   # name -> (type_char, values_list)
        self.children = []

    def find(self, name):
        """Find first child with given name."""
        for c in self.children:
            if c.name == name:
                return c
        return None

    def find_all(self, name):
        """Find all children with given name."""
        return [c for c in self.children if c.name == name]

    def prop(self, name, default=None):
        """Get property values by name, or default."""
        if name in self.properties:
            return self.properties[name][1]
        return default

    def prop_str(self, name, default=''):
        """Get first string value of a property."""
        vals = self.prop(name)
        if vals and len(vals) > 0:
            return vals[0]
        return default


def parse_mesh_file(filepath):
    """Parse a .mesh file. Returns PdxNode tree root.

    Raises ValueError on format errors.
    """
    with open(filepath, 'rb') as f:
        data = f.read()
    return parse_mesh_data(data)


def parse_mesh_data(data):
    """Parse binary mesh data. Returns PdxNode tree root."""
    if len(data) < 4 or data[0:4] != b'@@b@':
        raise ValueError(f"Bad magic: expected @@b@, got {data[0:4]!r}")

    pos = 4
    root = PdxNode('root', 0)
    stack = [root]
    data_len = len(data)

    while pos < data_len:
        b = data[pos]

        if b == 0x21:  # '!' = property
            pos += 1
            name_len = data[pos]
            pos += 1
            name = data[pos:pos + name_len].decode('latin-1').rstrip('\x00')
            pos += name_len
            type_char = chr(data[pos])
            pos += 1
            count = struct.unpack_from('<I', data, pos)[0]
            pos += 4

            if type_char == 'i':
                vals = list(struct.unpack_from(f'<{count}i', data, pos))
                pos += count * 4
            elif type_char == 'f':
                vals = list(struct.unpack_from(f'<{count}f', data, pos))
                pos += count * 4
            elif type_char == 's':
                vals = []
                for _ in range(count):
                    slen = struct.unpack_from('<I', data, pos)[0]
                    pos += 4
                    vals.append(data[pos:pos + slen].decode('latin-1').rstrip('\x00'))
                    pos += slen
            else:
                raise ValueError(f'Unknown type 0x{ord(type_char):02x} at pos {pos - 5}')

            stack[-1].properties[name] = (type_char, vals)

        elif b == 0x5B:  # '[' = object
            depth = 0
            while pos < data_len and data[pos] == 0x5B:
                depth += 1
                pos += 1
            # Read null-terminated name
            name_start = pos
            while pos < data_len and data[pos] != 0:
                pos += 1
            name = data[name_start:pos].decode('latin-1')
            pos += 1  # skip null terminator

            node = PdxNode(name, depth)
            while len(stack) > depth:
                stack.pop()
            stack[-1].children.append(node)
            stack.append(node)

        else:
            raise ValueError(f'Unexpected byte 0x{b:02x} at pos {pos}')

    return root


def extract_mesh_data(root):
    """Extract mesh geometry from a parsed PdxNode tree.

    Returns list of dicts, one per mesh object:
    {
        'name': str,
        'positions': [x,y,z, ...],  # flat float array
        'normals': [x,y,z, ...],
        'uvs': [u,v, ...],
        'triangles': [i0,i1,i2, ...],
        'vertex_count': int,
        'triangle_count': int,
        'material': { 'shader': str, 'diffuse': str, 'normal': str, 'specular': str },
    }
    """
    results = []
    object_node = root.find('object')
    if not object_node:
        return results

    for mesh_obj in object_node.children:
        mesh_node = mesh_obj.find('mesh')
        if not mesh_node:
            continue

        positions = mesh_node.prop('p', [])
        normals = mesh_node.prop('n', [])
        uvs = mesh_node.prop('u0', [])
        triangles = mesh_node.prop('tri', [])

        vertex_count = len(positions) // 3 if positions else 0
        triangle_count = len(triangles) // 3 if triangles else 0

        # Extract material info
        material = {'shader': '', 'diffuse': '', 'normal': '', 'specular': ''}
        mat_node = mesh_node.find('material')
        if mat_node:
            material['shader'] = mat_node.prop_str('shader')
            material['diffuse'] = mat_node.prop_str('diff')
            material['normal'] = mat_node.prop_str('n')
            material['specular'] = mat_node.prop_str('spec')

        results.append({
            'name': mesh_obj.name,
            'positions': positions,
            'normals': normals,
            'uvs': uvs,
            'triangles': triangles,
            'vertex_count': vertex_count,
            'triangle_count': triangle_count,
            'material': material,
        })

    return results


def extract_locators(root):
    """Extract locator positions from a parsed PdxNode tree.

    Mesh binary structure:
        locator (depth=1)
          spacedock_loc_01 (depth=2)
            .p (fx3): [x, y, z]       <- position
            .q (fx4): [qx, qy, qz, qw] <- quaternion rotation

    Returns dict: locator_name -> { 'position': [x,y,z], 'rotation': [qx,qy,qz,qw] }
    """
    result = {}
    loc_node = root.find('locator')
    if not loc_node:
        return result

    for child in loc_node.children:
        entry = {}
        pos = child.prop('p')
        if pos and len(pos) >= 3:
            entry['position'] = [round(pos[0], 4), round(pos[1], 4), round(pos[2], 4)]
        quat = child.prop('q')
        if quat and len(quat) >= 4:
            entry['rotation'] = [round(quat[0], 4), round(quat[1], 4), round(quat[2], 4), round(quat[3], 4)]
        if entry:
            result[child.name] = entry

    return result


if __name__ == '__main__':
    import sys
    import os

    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    else:
        # Default test file
        filepath = os.path.join(
            r"C:\Users\marcj\git01\New-Horizons-Development",
            "gfx", "models", "ships", "federation", "carrier",
            "federation_carrier_achilles.mesh"
        )

    if not os.path.isfile(filepath):
        print(f"File not found: {filepath}")
        sys.exit(1)

    print(f"Parsing: {filepath}")
    print(f"Size: {os.path.getsize(filepath):,} bytes")

    root = parse_mesh_file(filepath)
    meshes = extract_mesh_data(root)

    for m in meshes:
        print(f"\n  Mesh: {m['name']}")
        print(f"    Vertices: {m['vertex_count']}")
        print(f"    Triangles: {m['triangle_count']}")
        print(f"    Material: {m['material']}")
