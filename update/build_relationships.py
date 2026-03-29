"""
Build event-to-event relationship graph.
Determines which events trigger which other events.
"""


def build_relationships(events):
    """
    Build relationship graph from events list.
    Returns dict of event_id -> { triggers: [ids], triggered_by: [ids] }
    """
    # Build index
    event_ids = set(ev['id'] for ev in events)
    relationships = {}

    for ev in events:
        eid = ev['id']
        if eid not in relationships:
            relationships[eid] = {'triggers': [], 'triggered_by': []}

        # From event's triggered_events list
        for target_id in ev.get('triggered_events', []):
            if target_id in event_ids:
                if target_id not in relationships:
                    relationships[target_id] = {'triggers': [], 'triggered_by': []}
                if target_id not in relationships[eid]['triggers']:
                    relationships[eid]['triggers'].append(target_id)
                if eid not in relationships[target_id]['triggered_by']:
                    relationships[target_id]['triggered_by'].append(eid)

        # From option triggered_events
        for opt in ev.get('options', []):
            for target_id in opt.get('triggered_events', []):
                if target_id in event_ids:
                    if target_id not in relationships:
                        relationships[target_id] = {'triggers': [], 'triggered_by': []}
                    if target_id not in relationships[eid]['triggers']:
                        relationships[eid]['triggers'].append(target_id)
                    if eid not in relationships[target_id]['triggered_by']:
                        relationships[target_id]['triggered_by'].append(eid)

    # Sort for deterministic output
    for eid in relationships:
        relationships[eid]['triggers'].sort()
        relationships[eid]['triggered_by'].sort()

    return relationships


def get_stats(relationships):
    """Get relationship statistics."""
    total_edges = sum(len(r['triggers']) for r in relationships.values())
    has_triggers = sum(1 for r in relationships.values() if r['triggers'])
    has_triggered_by = sum(1 for r in relationships.values() if r['triggered_by'])
    return {
        'total_events': len(relationships),
        'total_edges': total_edges,
        'events_with_triggers': has_triggers,
        'events_triggered_by_others': has_triggered_by,
    }
