"""
Anomalies & Archaeology JSON generator.
Orchestrates parse_anomalies + parse_archaeology -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_anomalies import parse_all_anomalies
from parse_archaeology import parse_all_archaeology


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate anomalies.json and archaeology.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/2] Parsing anomalies...")
    anomalies, a_stats = parse_all_anomalies()
    print(f"    {a_stats['items']} anomalies from {a_stats['files']} files ({a_stats['errors']} errors)")

    print("  [2/2] Parsing archaeological sites...")
    sites, s_stats = parse_all_archaeology()
    print(f"    {s_stats['items']} archaeological sites from {s_stats['files']} files ({s_stats['errors']} errors)")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'anomalies.json'), anomalies)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'archaeology.json'), sites)

    elapsed = time.time() - start
    print(f"  Anomalies module: {elapsed:.1f}s")

    return {
        'anomalies': a_stats['items'],
        'archaeology': s_stats['items'],
        'files': a_stats['files'] + s_stats['files'],
        'errors': a_stats['errors'] + s_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
