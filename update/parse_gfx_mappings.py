"""
Parse GFX sprite definitions from .gfx files.
Maps GFX sprite names to DDS texture file paths.
"""

import os
import re
import json
from config import MOD_INTERFACE_DIR, VANILLA_INTERFACE_DIR, OUTPUT_ASSETS_DIR, \
    MOD_GFX_ROOM_TEXTURES, VANILLA_GFX_ROOM_TEXTURES


# Match the sprite-type header (case-insensitive — .gfx files use both
# "SpriteType" and "spriteType", and likewise "frameAnimatedSpriteType").
SPRITE_HEADER_RE = re.compile(
    r'(?:spriteType|frameAnimatedSpriteType)\s*=\s*\{',
    re.IGNORECASE
)
NAME_RE = re.compile(r'name\s*=\s*"?(\S+?)"?\s')
TEXTURE_RE = re.compile(r'[tT]exture[fF]ile\s*=\s*"?([^"\s}]+)"?')
FRAMES_RE = re.compile(r'noOfFrames\s*=\s*(\d+)')


def _extract_block(content, start):
    """Given an opening brace position, return the content between matching
    braces (handles nested animation = {...} blocks). Returns (inner, end_pos)
    or (None, start) on mismatch."""
    depth = 1
    i = start + 1
    n = len(content)
    while i < n and depth > 0:
        ch = content[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return content[start + 1:i], i + 1
        i += 1
    return None, start


def _parse_gfx_dir(directory, mappings):
    """Parse .gfx files from a directory into mappings dict. Later calls override earlier entries."""
    if not os.path.isdir(directory):
        return 0
    count = 0
    for fn in sorted(os.listdir(directory)):
        if not fn.endswith('.gfx'):
            continue
        fp = os.path.join(directory, fn)
        try:
            with open(fp, 'r', encoding='utf-8-sig') as f:
                content = f.read()
        except Exception as e:
            print(f"  [WARN] {fn}: {e}")
            continue

        pos = 0
        while True:
            header = SPRITE_HEADER_RE.search(content, pos)
            if not header:
                break
            brace_pos = header.end() - 1
            block, end_pos = _extract_block(content, brace_pos)
            pos = end_pos if block is not None else header.end()
            if block is None:
                continue
            name_m = NAME_RE.search(block)
            tex_m = TEXTURE_RE.search(block)
            if not name_m or not tex_m:
                continue
            name = name_m.group(1)
            texture = tex_m.group(1)
            texture_name = os.path.basename(texture)
            if texture_name.endswith('.dds'):
                texture_name = texture_name[:-4]
            frames = 1
            frames_m = FRAMES_RE.search(block)
            if frames_m:
                frames = int(frames_m.group(1))
            mappings[name] = {
                'texture_path': texture,
                'texture_name': texture_name,
                'frames': frames,
            }
            count += 1
    return count


def parse_gfx_mappings():
    """Parse .gfx files for sprite -> texture mappings. Vanilla first, mod overrides."""
    mappings = {}

    # Vanilla first (mod will override matching names)
    vanilla_count = _parse_gfx_dir(VANILLA_INTERFACE_DIR, mappings)
    if vanilla_count:
        print(f"  Vanilla sprites: {vanilla_count}")

    # Mod overrides vanilla
    if not os.path.isdir(MOD_INTERFACE_DIR):
        print(f"  [WARN] Interface directory not found: {MOD_INTERFACE_DIR}")
        return mappings
    mod_count = _parse_gfx_dir(MOD_INTERFACE_DIR, mappings)
    print(f"  Mod sprites: {mod_count}")

    # Add room textures from city_sets directories (vanilla first, mod overrides)
    room_count = 0
    for city_sets_dir in [VANILLA_GFX_ROOM_TEXTURES, MOD_GFX_ROOM_TEXTURES]:
        if not os.path.isdir(city_sets_dir):
            continue
        for fn in sorted(os.listdir(city_sets_dir)):
            if fn.endswith('.dds'):
                stem = fn[:-4]
                mappings[stem] = {
                    'texture_path': f'gfx/portraits/city_sets/{fn}',
                    'texture_name': stem,
                    'frames': 1,
                }
                room_count += 1
    if room_count:
        print(f"  Room textures: {room_count}")

    return mappings


def main():
    print("=== Parsing GFX Mappings ===")
    mappings = parse_gfx_mappings()

    output_path = os.path.join(OUTPUT_ASSETS_DIR, 'pictures_map.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(mappings, f, indent=2)

    # Count event pictures specifically
    event_pics = {k: v for k, v in mappings.items()
                  if 'event_pictures' in v['texture_path']}

    print(f"  Total sprites: {len(mappings)}")
    print(f"  Event pictures: {len(event_pics)}")
    print(f"  Written: {output_path}")
    return mappings


if __name__ == '__main__':
    main()
