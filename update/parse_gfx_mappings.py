"""
Parse GFX sprite definitions from .gfx files.
Maps GFX sprite names to DDS texture file paths.
"""

import os
import re
import json
from config import MOD_INTERFACE_DIR, OUTPUT_ASSETS_DIR


# Regex to extract sprite definitions from .gfx files
# Handles both spriteType and frameAnimatedSpriteType
# Captures the full block so we can extract noOfFrames separately
SPRITE_RE = re.compile(
    r'(?:spriteType|frameAnimatedSpriteType)\s*=\s*\{([^}]*?name\s*=\s*"?\S+?"?\s+[^}]*?texturefile\s*=\s*"?[^"\s}]+"?[^}]*?)\}',
    re.DOTALL
)
NAME_RE = re.compile(r'name\s*=\s*"?(\S+?)"?\s')
TEXTURE_RE = re.compile(r'texturefile\s*=\s*"?([^"\s}]+)"?')
FRAMES_RE = re.compile(r'noOfFrames\s*=\s*(\d+)')


def parse_gfx_mappings():
    """Parse all .gfx files for sprite -> texture mappings."""
    mappings = {}

    if not os.path.isdir(MOD_INTERFACE_DIR):
        print(f"  [WARN] Interface directory not found: {MOD_INTERFACE_DIR}")
        return mappings

    for fn in sorted(os.listdir(MOD_INTERFACE_DIR)):
        if not fn.endswith('.gfx'):
            continue
        fp = os.path.join(MOD_INTERFACE_DIR, fn)
        try:
            with open(fp, 'r', encoding='utf-8-sig') as f:
                content = f.read()
        except Exception as e:
            print(f"  [WARN] {fn}: {e}")
            continue

        for match in SPRITE_RE.finditer(content):
            block = match.group(1)
            name_m = NAME_RE.search(block)
            tex_m = TEXTURE_RE.search(block)
            if not name_m or not tex_m:
                continue
            name = name_m.group(1)
            texture = tex_m.group(1)
            # Extract just the filename from the path
            texture_name = os.path.basename(texture)
            if texture_name.endswith('.dds'):
                texture_name = texture_name[:-4]  # strip .dds
            # Extract noOfFrames if present
            frames = 1
            frames_m = FRAMES_RE.search(block)
            if frames_m:
                frames = int(frames_m.group(1))
            mappings[name] = {
                'texture_path': texture,
                'texture_name': texture_name,
                'frames': frames,
            }

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
