"""
Builds the resource producer / modifier index from already-generated module JSONs.

Inputs (read from assets/):
    buildings.json, districts.json, jobs.json, deposits.json,
    edicts.json, relics.json, megastructures.json, traditions.json,
    ascension_perks.json, governments.json, civics.json, authorities.json

Output:
    by_resource[res_id] = {
        'producers': [ {id, module, page, tab, kind, flat, ...} ],
        'modifiers': [ {owner_id, owner_module, page, tab, name, axis, op, value, scope, producer_stem} ],
    }
    by_producer[producer_id] = {
        'module', 'produces': {res: flat}, 'upkeep': {res: flat}
    }
    stats = {...}
"""

import json
import os
from collections import defaultdict

from modifier_name_parser import (
    build_resource_set, build_producer_stems, parse_resource_modifier,
)

# (json_filename, module_name, frontend_page, frontend_tab)
_PRODUCER_MODULES = [
    ('buildings.json',       'buildings',       'economy.html',      'buildings'),
    ('districts.json',       'districts',       'economy.html',      'districts'),
    ('jobs.json',            'jobs',            'economy.html',      'jobs'),
    ('deposits.json',        'deposits',        'economy.html',      'deposits'),
    ('megastructures.json',  'megastructures',  'economy.html',      'megastructures'),
    ('relics.json',          'relics',          'economy.html',      'relics'),
    ('edicts.json',          'edicts',          'governments.html',  'edicts'),
    ('traditions.json',      'traditions',      'governments.html',  'traditions'),
    ('ascension_perks.json', 'ascension_perks', 'governments.html',  'ascension_perks'),
    ('governments.json',     'governments',     'governments.html',  'governments'),
    ('civics.json',          'civics',          'governments.html',  'civics'),
    ('authorities.json',     'authorities',     'governments.html',  'authorities'),
]

_MODIFIER_FIELDS = (
    'modifier', 'planet_modifier', 'country_modifier',
    'triggered_planet_modifier', 'triggered_country_modifier',
    'station_modifier', 'blocked_modifier', 'constant_modifier',
    'triggered_modifier', 'pop_modifier',
)


def _load_module(assets_dir, filename):
    path = os.path.join(assets_dir, filename)
    if not os.path.isfile(path):
        return []
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def _iter_modifier_pairs(modifier_field):
    """modifier_field is the value of item['modifier'] / item['planet_modifier'] etc.
    In producer JSONs it's a dict {block_name: [{key:val}, ...]}.
    Yield (block_name, key, value) triples."""
    if not isinstance(modifier_field, dict):
        return
    for block_name, entries in modifier_field.items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            for key, value in entry.items():
                yield block_name, key, value


def _flat_produces(item):
    res = item.get('resources')
    if not isinstance(res, dict):
        return {}
    out = res.get('produces')
    return out if isinstance(out, dict) else {}


def _flat_upkeep(item):
    res = item.get('resources')
    if not isinstance(res, dict):
        return {}
    out = res.get('upkeep')
    return out if isinstance(out, dict) else {}


def build_resource_index(resources, assets_dir):
    res_set = build_resource_set(resources)

    # Producer-stem hint set from jobs (for diagnostics; parser does not require it)
    jobs_for_stems = _load_module(assets_dir, 'jobs.json')
    producer_stems = build_producer_stems(jobs=jobs_for_stems)

    by_resource = defaultdict(lambda: {'producers': [], 'consumers': [], 'modifiers': []})
    by_producer = {}

    stats = {
        'modules_loaded': 0,
        'producer_links': 0,
        'consumer_links': 0,
        'modifier_links': 0,
        'unparsed_modifiers': 0,
        'unparsed_samples': [],
    }

    for filename, module, page, tab in _PRODUCER_MODULES:
        items = _load_module(assets_dir, filename)
        if not items:
            continue
        stats['modules_loaded'] += 1
        for item in items:
            iid = item.get('id')
            if not iid:
                continue
            produces = _flat_produces(item)
            upkeep = _flat_upkeep(item)
            if produces or upkeep:
                by_producer[iid] = {
                    'module': module,
                    'produces': dict(produces),
                    'upkeep': dict(upkeep),
                }
            for res, flat in produces.items():
                if res in res_set:
                    by_resource[res]['producers'].append({
                        'id': iid, 'module': module,
                        'page': page, 'tab': tab,
                        'kind': 'produces', 'flat': flat,
                    })
                    stats['producer_links'] += 1
            for res, flat in upkeep.items():
                if res in res_set:
                    by_resource[res]['consumers'].append({
                        'id': iid, 'module': module,
                        'page': page, 'tab': tab,
                        'kind': 'upkeep', 'flat': flat,
                    })
                    stats['consumer_links'] += 1
            for field in _MODIFIER_FIELDS:
                mfield = item.get(field)
                for block_name, key, value in _iter_modifier_pairs(mfield):
                    parsed = parse_resource_modifier(key, res_set, producer_stems)
                    if not parsed:
                        if (key.endswith('_produces_add') or key.endswith('_produces_mult')
                                or key.endswith('_upkeep_add') or key.endswith('_upkeep_mult')
                                or key.endswith('_cost_add') or key.endswith('_cost_mult')):
                            stats['unparsed_modifiers'] += 1
                            if len(stats['unparsed_samples']) < 25:
                                stats['unparsed_samples'].append(key)
                        continue
                    by_resource[parsed['resource']]['modifiers'].append({
                        'owner_id': iid, 'owner_module': module,
                        'page': page, 'tab': tab,
                        'block': block_name, 'name': key, 'value': value,
                        'axis': parsed['axis'], 'op': parsed['op'],
                        'scope': parsed['scope'],
                        'producer_stem': parsed['producer_stem'],
                    })
                    stats['modifier_links'] += 1

    # Drop duplicates among unparsed_samples
    seen = []
    for k in stats['unparsed_samples']:
        if k not in seen:
            seen.append(k)
    stats['unparsed_samples'] = seen

    return {
        'by_resource': dict(by_resource),
        'by_producer': by_producer,
        'stats': stats,
    }


if __name__ == '__main__':
    from config import OUTPUT_ASSETS_DIR
    from parse_resources import parse_all_resources
    resources, _ = parse_all_resources()
    out = build_resource_index(resources, OUTPUT_ASSETS_DIR)
    s = out['stats']
    print(f"  modules: {s['modules_loaded']}")
    print(f"  producer links: {s['producer_links']}")
    print(f"  consumer links: {s['consumer_links']}")
    print(f"  modifier links: {s['modifier_links']}")
    print(f"  unparsed modifier names: {s['unparsed_modifiers']}")
    if s['unparsed_samples']:
        print('  unparsed samples:')
        for k in s['unparsed_samples'][:10]:
            print(f'    - {k}')
