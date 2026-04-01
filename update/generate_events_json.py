"""
Main JSON generator. Orchestrates all parsers and produces final assets:
- events_index.json (lightweight for initial page load)
- events_detail/<namespace>.json (full detail per namespace)
- namespaces.json (metadata)
- relationships.json (trigger graph)
"""

import os
import json
import re
import time

from config import OUTPUT_ASSETS_DIR, OUTPUT_EVENTS_DETAIL_DIR
from parse_events import parse_all_events
from parse_localisation import parse_all_languages
from parse_on_actions import parse_on_actions
from parse_event_chains import parse_event_chains
from parse_gfx_mappings import parse_gfx_mappings
from build_relationships import build_relationships, get_stats


# Faction detection from namespace/filename
FACTION_PATTERNS = {
    'federation': ['federation', 'fed_', 'starfleet', 'earth_', 'human_'],
    'klingon': ['klingon', 'klg_'],
    'romulan': ['romulan', 'rom_', 'reman'],
    'cardassian': ['cardassian', 'card_'],
    'dominion': ['dominion'],
    'borg': ['borg'],
    'ferengi': ['ferengi'],
    'bajoran': ['bajor'],
    'vulcan': ['vulcan'],
    'andorian': ['andorian', 'andor_'],
    'tholian': ['tholian'],
    'breen': ['breen'],
    'kazon': ['kazon'],
    'vidiian': ['vidiian'],
    'hirogen': ['hirogen'],
    'species_8472': ['species_8472', 'undine', 'fluidic'],
    'xindi': ['xindi'],
    'temporal': ['temporal', 'time_'],
    'mirror': ['mirror'],
    'qpedia': ['qpedia'],
    'generic': [],
}


def detect_faction(namespace):
    """Guess faction from namespace name."""
    if not namespace:
        return 'generic'
    ns_lower = namespace.lower()
    for faction, patterns in FACTION_PATTERNS.items():
        for pat in patterns:
            if pat in ns_lower:
                return faction
    return 'generic'


def detect_category(namespace, source_file):
    """Guess category from namespace/filename."""
    name = (namespace or '').lower() + ' ' + (source_file or '').lower()
    if 'story' in name:
        return 'story'
    if 'quest' in name or 'chain' in name:
        return 'quest'
    if 'diplo' in name:
        return 'diplomacy'
    if 'war' in name or 'combat' in name or 'battle' in name:
        return 'war'
    if 'anomal' in name:
        return 'anomaly'
    if 'colony' in name or 'planet' in name:
        return 'colony'
    if 'crisis' in name:
        return 'crisis'
    if 'tutorial' in name:
        return 'tutorial'
    return 'misc'


def build_index_entry(event, loc_english):
    """Create lightweight index entry for an event."""
    title = ''
    if event['title_key']:
        title = loc_english.get(event['title_key'], event['title_key'])

    desc_snippet = ''
    if event['desc_keys']:
        first_desc = event['desc_keys'][0]
        text_key = first_desc.get('text', '')
        if text_key:
            desc_snippet = loc_english.get(text_key, '')
            if len(desc_snippet) > 200:
                desc_snippet = desc_snippet[:200] + '...'

    return {
        'id': event['id'],
        'name': title,
        'type': event['type'],
        'ns': event['namespace'] or '',
        'pic': event['picture'] or '',
        'snip': desc_snippet,
        'trig': event['is_triggered_only'],
        'hide': event['hide_window'],
        'opts': len(event['options']),
    }


def generate_all():
    """Main generation function."""
    start = time.time()
    stats = {}

    # 1. Parse events
    print("\n[1/6] Parsing events...")
    events, namespaces, event_stats = parse_all_events()
    stats['events'] = event_stats['events']
    stats['namespaces'] = len(namespaces)
    stats['files'] = event_stats['files']
    print(f"  {event_stats['events']} events from {event_stats['files']} files")

    # 2. Parse localisation
    print("\n[2/6] Parsing localisation...")
    all_loc, loc_stats = parse_all_languages()
    loc_english = all_loc.get('english', {})
    stats['loc_keys'] = loc_stats.get('english', 0)
    print(f"  {stats['loc_keys']} English keys")

    # 3. Parse helpers
    print("\n[3/6] Parsing on-actions, chains, GFX...")
    on_actions = parse_on_actions()
    event_chains = parse_event_chains()
    gfx_mappings = parse_gfx_mappings()
    stats['on_actions'] = len(on_actions)
    stats['event_chains'] = len(event_chains)
    stats['gfx_sprites'] = len(gfx_mappings)

    # 4. Build relationships
    print("\n[4/6] Building relationships...")
    relationships = build_relationships(events)
    rel_stats = get_stats(relationships)
    stats['relationship_edges'] = rel_stats['total_edges']
    print(f"  {rel_stats['total_edges']} edges, {rel_stats['events_with_triggers']} events trigger others")

    # 5. Build on-action reverse index (event_id -> on_actions that trigger it)
    on_action_reverse = {}
    for action_name, event_ids in on_actions.items():
        for eid in event_ids:
            if eid not in on_action_reverse:
                on_action_reverse[eid] = []
            on_action_reverse[eid].append(action_name)

    # 6. Generate output files
    print("\n[5/6] Generating JSON files...")

    # Enrich namespace metadata
    ns_output = {}
    for ns_name, ns_data in namespaces.items():
        faction = detect_faction(ns_name)
        category = detect_category(ns_name, ns_data['source_files'][0] if ns_data['source_files'] else '')
        ns_output[ns_name] = {
            'name': ns_name,
            'event_count': ns_data['event_count'],
            'faction': faction,
            'category': category,
            'source_files': ns_data['source_files'],
        }

    # Write namespaces.json
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'namespaces.json'), ns_output)

    # Write relationships.json (only entries with actual relationships)
    rel_output = {k: v for k, v in relationships.items()
                  if v['triggers'] or v['triggered_by']}
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'relationships.json'), rel_output)

    # Write on_actions.json (already written by parser, but re-write for consistency)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'on_actions.json'), on_actions)

    # Write event_chains.json
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'event_chains.json'), event_chains)

    # Write pictures_map.json
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'pictures_map.json'), gfx_mappings)

    # Build index and detail files
    index_entries = []
    events_by_namespace = {}

    for ev in events:
        ns = ev['namespace'] or '_no_namespace'
        if ns not in events_by_namespace:
            events_by_namespace[ns] = []
        events_by_namespace[ns].append(ev)
        index_entries.append(build_index_entry(ev, loc_english))

    # Write events_index.json
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'events_index.json'), index_entries)
    index_size = os.path.getsize(os.path.join(OUTPUT_ASSETS_DIR, 'events_index.json'))

    # Write per-namespace detail files
    os.makedirs(OUTPUT_EVENTS_DETAIL_DIR, exist_ok=True)
    for ns, ns_events in events_by_namespace.items():
        safe_name = re.sub(r'[^\w.-]', '_', ns)
        detail_path = os.path.join(OUTPUT_EVENTS_DETAIL_DIR, f"{safe_name}.json")

        # Enrich events with on-action and relationship data
        for ev in ns_events:
            ev['on_actions'] = on_action_reverse.get(ev['id'], [])
            rel = relationships.get(ev['id'], {})
            ev['triggered_by'] = rel.get('triggered_by', [])
            ev['triggers_events'] = rel.get('triggers', [])

        _write_json(detail_path, ns_events)

    stats['detail_files'] = len(events_by_namespace)

    # NOTE: Localisation files are written by Phase 2 (parse_localisation)
    # with full ~200K keys per language. No filtered write needed here —
    # the wiki shares loc files across all modules.

    # Summary
    elapsed = time.time() - start
    print(f"\n[6/6] Summary:")
    print(f"  Events: {stats['events']}")
    print(f"  Namespaces: {stats['namespaces']}")
    print(f"  Detail files: {stats['detail_files']}")
    print(f"  Index size: {index_size / 1024:.0f} KB")
    print(f"  Relationships: {stats['relationship_edges']} edges")
    print(f"  On-actions: {stats['on_actions']}")
    print(f"  Event chains: {stats['event_chains']}")
    print(f"  GFX sprites: {stats['gfx_sprites']}")
    print(f"  Elapsed: {elapsed:.1f}s")

    return stats


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    generate_all()
