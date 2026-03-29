"""
Shared helper functions for all content parsers.
Extracted from parse_events.py patterns.
"""


def serialize_block(block):
    """Convert parsed PDX block to JSON-serializable format."""
    if not isinstance(block, list):
        return block
    result = []
    for item in block:
        result.append(serialize_item(item))
    return result


def serialize_item(item):
    """Convert a single parsed item to JSON-serializable format."""
    if isinstance(item, dict):
        result = {}
        for k, v in item.items():
            if isinstance(v, list):
                result[str(k)] = serialize_block(v)
            else:
                result[str(k)] = v
        return result
    return item


def to_bool(val):
    """Convert PDX yes/no to Python bool."""
    if val == 'yes' or val is True:
        return True
    return False


def extract_resources(block):
    """Extract resources = { category cost upkeep produces } block."""
    from parse_pdx import get_value, get_blocks
    res_blocks = get_blocks(block, 'resources')
    if not res_blocks:
        return None
    res = res_blocks[0]
    result = {}
    category = get_value(res, 'category')
    if category:
        result['category'] = category

    for key in ('cost', 'upkeep', 'produces'):
        sub = get_value(res, key)
        if isinstance(sub, list):
            entries = {}
            for item in sub:
                if isinstance(item, dict):
                    for k, v in item.items():
                        entries[k] = v
            if entries:
                result[key] = entries
    return result if result else None


def extract_prerequisites(block):
    """Extract prerequisites = { "tech_x" "tech_y" } -> list of strings."""
    from parse_pdx import get_value
    val = get_value(block, 'prerequisites')
    if isinstance(val, list):
        return [str(v) for v in val if isinstance(v, str)]
    return []


def extract_modifiers(block, *keys):
    """Extract modifier blocks by key names. Returns dict of key -> serialized block."""
    from parse_pdx import get_value
    result = {}
    for key in keys:
        val = get_value(block, key)
        if isinstance(val, list):
            result[key] = serialize_block(val)
    return result if result else None


def extract_list(block, key):
    """Extract a list of values from a block key."""
    from parse_pdx import get_value
    val = get_value(block, key)
    if isinstance(val, list):
        return [str(v) for v in val if isinstance(v, str)]
    return []
