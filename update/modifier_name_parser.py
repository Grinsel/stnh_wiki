"""
Heuristic parser for Stellaris modifier names like:
  planet_miners_minerals_produces_mult
  country_alloys_produces_mult
  pop_category_slaves_minerals_upkeep_mult
  country_base_sr_latinum_produces_add

Returns a dict {resource, producer_stem, axis, op, scope} or None if the
modifier name cannot be confidently mapped to a (resource, producer) pair.
"""

import re

# scope prefixes that the modifier may carry. order matters: longer first so
# 'pop_category_' wins over 'pop_'.
_SCOPE_PREFIXES = (
    'pop_category_',
    'country_base_',
    'country_',
    'planet_',
    'starbase_',
    'ships_',
    'armies_',
    'leaders_',
    'pop_',
)

_SUFFIX_RE = re.compile(r'_(produces|upkeep|cost)_(add|mult)$')


def build_resource_set(resources):
    """Set of canonical resource ids from parsed resources list."""
    return {r['id'] for r in resources}


def build_producer_stems(jobs=None, districts=None, buildings=None):
    """Producer stems used in modifier names. Currently sourced from job ids
    (with the leading 'job_' stripped, both singular and pluralized forms)."""
    stems = set()
    if jobs:
        for j in jobs:
            jid = j.get('id', '')
            if jid.startswith('job_'):
                base = jid[4:]
            else:
                base = jid
            if base:
                stems.add(base)
                # crude pluralization: many modifier stems end in 's' (miners, farmers)
                if not base.endswith('s'):
                    stems.add(base + 's')
    return stems


def parse_resource_modifier(name, resources, producer_stems=None):
    """Return {resource, producer_stem, axis, op, scope} or None."""
    if not isinstance(name, str):
        return None

    suf = _SUFFIX_RE.search(name)
    if not suf:
        return None
    axis = suf.group(1)  # produces / upkeep / cost
    op = suf.group(2)    # add / mult
    body = name[:suf.start()]

    scope = None
    for prefix in _SCOPE_PREFIXES:
        if body.startswith(prefix):
            scope = prefix.rstrip('_')
            body = body[len(prefix):]
            break

    if not body:
        return None

    # longest-suffix match against the resource set
    resource = None
    for cand in sorted(resources, key=len, reverse=True):
        if body == cand or body.endswith('_' + cand):
            resource = cand
            break

    if not resource:
        return None

    producer_stem = body[:-len(resource)].rstrip('_') or None
    if producer_stem and producer_stems and producer_stem not in producer_stems:
        # keep raw stem; flag is implicit in mismatch but we don't drop it
        pass

    return {
        'resource': resource,
        'producer_stem': producer_stem,
        'axis': axis,
        'op': op,
        'scope': scope,
    }


if __name__ == '__main__':
    samples = [
        'planet_miners_minerals_produces_mult',
        'country_alloys_produces_mult',
        'pop_category_slaves_minerals_upkeep_mult',
        'country_base_sr_latinum_produces_add',
        'planet_jobs_sr_time_crystal_produces_mult',
        'planet_metallurgists_alloys_produces_add',
        'planet_jobs_produces_mult',
        'starbase_shipyard_build_cost_mult',
        'ships_upkeep_mult',
        'leaders_upkeep_mult',
        'country_unity_produces_mult',
    ]
    fake_res = {
        'minerals', 'energy', 'food', 'alloys', 'unity', 'influence',
        'sr_latinum', 'sr_time_crystal', 'physics_research',
        'society_research', 'engineering_research',
    }
    for s in samples:
        print(f'{s:55s} -> {parse_resource_modifier(s, fake_res)}')
