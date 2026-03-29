"""
Governments, Civics, Authorities, Policies & Edicts JSON generator.
Orchestrates all government-related parsers -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_governments import parse_all_governments, parse_all_civics, parse_all_authorities
from parse_policies import parse_all_policies
from parse_edicts import parse_all_edicts


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate governments.json, civics.json, authorities.json, policies.json, edicts.json."""
    start = time.time()

    print("\n  [1/5] Parsing governments...")
    governments, g_stats = parse_all_governments()
    print(f"    {g_stats['items']} governments from {g_stats['files']} files ({g_stats['errors']} errors)")

    print("  [2/5] Parsing civics...")
    civics, c_stats = parse_all_civics()
    print(f"    {c_stats['items']} civics from {c_stats['files']} files ({c_stats['errors']} errors)")

    print("  [3/5] Parsing authorities...")
    authorities, a_stats = parse_all_authorities()
    print(f"    {a_stats['items']} authorities from {a_stats['files']} files ({a_stats['errors']} errors)")

    print("  [4/5] Parsing policies...")
    policies, p_stats = parse_all_policies()
    print(f"    {p_stats['items']} policies from {p_stats['files']} files ({p_stats['errors']} errors)")

    print("  [5/5] Parsing edicts...")
    edicts, e_stats = parse_all_edicts()
    print(f"    {e_stats['items']} edicts from {e_stats['files']} files ({e_stats['errors']} errors)")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'governments.json'), governments)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'civics.json'), civics)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'authorities.json'), authorities)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'policies.json'), policies)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'edicts.json'), edicts)

    elapsed = time.time() - start
    print(f"  Governments module: {elapsed:.1f}s")

    total_files = g_stats['files'] + c_stats['files'] + a_stats['files'] + p_stats['files'] + e_stats['files']
    total_errors = g_stats['errors'] + c_stats['errors'] + a_stats['errors'] + p_stats['errors'] + e_stats['errors']

    return {
        'governments': g_stats['items'],
        'civics': c_stats['items'],
        'authorities': a_stats['items'],
        'policies': p_stats['items'],
        'edicts': e_stats['items'],
        'files': total_files,
        'errors': total_errors,
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
