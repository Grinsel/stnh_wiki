"""
Economy (Jobs & Deposits) JSON generator.
Orchestrates parse_jobs + parse_deposits -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_jobs import parse_all_jobs
from parse_deposits import parse_all_deposits


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate jobs.json and deposits.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/2] Parsing pop jobs...")
    jobs, j_stats = parse_all_jobs()
    print(f"    {j_stats['items']} jobs from {j_stats['files']} files ({j_stats['errors']} errors)")

    print("  [2/2] Parsing deposits...")
    deposits, d_stats = parse_all_deposits()
    print(f"    {d_stats['items']} deposits from {d_stats['files']} files ({d_stats['errors']} errors)")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'jobs.json'), jobs)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'deposits.json'), deposits)

    elapsed = time.time() - start
    print(f"  Economy module: {elapsed:.1f}s")

    return {
        'jobs': j_stats['items'],
        'deposits': d_stats['items'],
        'files': j_stats['files'] + d_stats['files'],
        'errors': j_stats['errors'] + d_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
