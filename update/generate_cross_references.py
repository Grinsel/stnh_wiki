"""
Cross-reference generator for STNH Wiki.
Builds bidirectional links between modules.
Output: assets/cross_references.json

Structure:
{
    "tech_unlocks": { "tech_id": { "ships": [...], "buildings": [...], ... } },
    "empire_refs": { "empire_id": { "authority": "...", "civics": [...], ... } },
    "anomaly_events": { "anomaly_id": ["event_id", ...] },
    "archaeology_events": { "site_id": ["event_id", ...] },
    "upgrade_chains": { "mega_id": { "from": "...", "to": [...] } },
    "stats": { "module": count, ... }
}
"""

import os
import json
import time
from collections import defaultdict

from config import OUTPUT_ASSETS_DIR


def _load(name):
    path = os.path.join(OUTPUT_ASSETS_DIR, name)
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def generate_cross_references():
    """Build cross-reference maps between all modules."""
    start = time.time()

    # Load all data
    ships = _load('ships.json')
    components = _load('components.json')
    buildings = _load('buildings.json')
    districts = _load('districts.json')
    traits = _load('traits.json')
    traditions = _load('traditions.json')
    ascension_perks = _load('ascension_perks.json')
    edicts = _load('edicts.json')
    megastructures = _load('megastructures.json')
    empires = _load('empires.json')
    anomalies = _load('anomalies.json')
    archaeology = _load('archaeology.json')

    # ========================================
    # 1. Tech Unlocks: tech_id -> what it unlocks
    # ========================================
    tech_unlocks = defaultdict(lambda: defaultdict(list))

    for item in ships:
        for tech in (item.get('prerequisites') or []):
            tech_unlocks[tech]['ships'].append(item['id'])

    for item in components:
        for tech in (item.get('prerequisites') or []):
            tech_unlocks[tech]['components'].append(item['id'])

    for item in buildings:
        for tech in (item.get('prerequisites') or []):
            tech_unlocks[tech]['buildings'].append(item['id'])

    for item in districts:
        for tech in (item.get('prerequisites') or []):
            tech_unlocks[tech]['districts'].append(item['id'])

    for item in traits:
        for tech in (item.get('prerequisites') or []):
            tech_unlocks[tech]['traits'].append(item['id'])

    for item in edicts:
        for tech in (item.get('prerequisites') or []):
            tech_unlocks[tech]['edicts'].append(item['id'])

    for item in megastructures:
        for tech in (item.get('prerequisites') or []):
            tech_unlocks[tech]['megastructures'].append(item['id'])

    # ========================================
    # 2. Megastructure upgrade chains
    # ========================================
    upgrade_chains = {}
    mega_children = defaultdict(list)

    for item in megastructures:
        uf = item.get('upgrade_from')
        if uf:
            mega_children[uf].append(item['id'])

    for item in megastructures:
        mid = item['id']
        entry = {}
        if item.get('upgrade_from'):
            entry['from'] = item['upgrade_from']
        if mid in mega_children:
            entry['to'] = mega_children[mid]
        if entry:
            upgrade_chains[mid] = entry

    # ========================================
    # 3. Anomaly -> Events
    # ========================================
    anomaly_events = {}
    for item in anomalies:
        events = []
        for outcome in (item.get('on_success') or []):
            if isinstance(outcome, dict) and 'event' in outcome:
                events.append(outcome['event'])
        if events:
            anomaly_events[item['id']] = events

    # ========================================
    # 4. Archaeology -> Events
    # ========================================
    archaeology_events = {}
    for item in archaeology:
        events = []
        for stage in (item.get('stages') or []):
            if isinstance(stage, dict) and 'event' in stage:
                events.append(stage['event'])
        if events:
            archaeology_events[item['id']] = events

    # ========================================
    # 5. Empire references (authority, civics, ethics, origin)
    # ========================================
    empire_refs = {}
    for item in empires:
        refs = {}
        if item.get('authority'):
            refs['authority'] = item['authority']
        if item.get('civics'):
            refs['civics'] = item['civics']
        if item.get('ethics'):
            refs['ethics'] = item['ethics']
        if item.get('origin'):
            refs['origin'] = item['origin']
        if item.get('government'):
            refs['government'] = item['government']
        species = item.get('species')
        if isinstance(species, dict):
            if species.get('class'):
                refs['species_class'] = species['class']
            traits_list = species.get('traits', [])
            if traits_list:
                refs['species_traits'] = traits_list
        if refs:
            empire_refs[item['id']] = refs

    # ========================================
    # 6. Building upgrade chains
    # ========================================
    building_upgrades = {}
    for item in buildings:
        upgrades = item.get('upgrades')
        if upgrades:
            building_upgrades[item['id']] = upgrades

    # ========================================
    # 7. Stats
    # ========================================
    stats = {
        'tech_unlocks': len(tech_unlocks),
        'upgrade_chains': len(upgrade_chains),
        'anomaly_events': len(anomaly_events),
        'archaeology_events': len(archaeology_events),
        'empire_refs': len(empire_refs),
        'building_upgrades': len(building_upgrades),
    }

    # ========================================
    # Write output
    # ========================================
    result = {
        'tech_unlocks': dict(tech_unlocks),
        'upgrade_chains': upgrade_chains,
        'anomaly_events': anomaly_events,
        'archaeology_events': archaeology_events,
        'empire_refs': empire_refs,
        'building_upgrades': building_upgrades,
        'stats': stats,
    }

    out_path = os.path.join(OUTPUT_ASSETS_DIR, 'cross_references.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))

    elapsed = time.time() - start
    size_kb = os.path.getsize(out_path) / 1024

    print(f"\n  Cross-references: {size_kb:.0f} KB")
    for key, count in stats.items():
        print(f"    {key}: {count}")
    print(f"  Cross-references: {elapsed:.1f}s")

    return {
        'size_kb': round(size_kb),
        'stats': stats,
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    print("Generating cross-references...")
    result = generate_cross_references()
    print(f"\nDone: {result['stats']}")
