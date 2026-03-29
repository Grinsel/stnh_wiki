"""
Traits, Traditions & Ascension Perks JSON generator.
Orchestrates parse_traits + parse_traditions + parse_ascension_perks -> JSON output.
"""

import os
import json
import time

from config import OUTPUT_ASSETS_DIR
from parse_traits import parse_all_traits
from parse_traditions import parse_all_traditions
from parse_ascension_perks import parse_all_ascension_perks


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def generate_all():
    """Generate traits.json, traditions.json, ascension_perks.json. Returns stats dict."""
    start = time.time()

    print("\n  [1/3] Parsing traits...")
    traits, t_stats = parse_all_traits()
    print(f"    {t_stats['items']} traits from {t_stats['files']} files ({t_stats['errors']} errors)")

    print("  [2/3] Parsing traditions...")
    traditions, tr_stats = parse_all_traditions()
    print(f"    {tr_stats['items']} traditions from {tr_stats['files']} files ({tr_stats['errors']} errors)")

    print("  [3/3] Parsing ascension perks...")
    perks, p_stats = parse_all_ascension_perks()
    print(f"    {p_stats['items']} perks from {p_stats['files']} files ({p_stats['errors']} errors)")

    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'traits.json'), traits)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'traditions.json'), traditions)
    _write_json(os.path.join(OUTPUT_ASSETS_DIR, 'ascension_perks.json'), perks)

    elapsed = time.time() - start
    print(f"  Traits module: {elapsed:.1f}s")

    return {
        'traits': t_stats['items'],
        'traditions': tr_stats['items'],
        'ascension_perks': p_stats['items'],
        'files': t_stats['files'] + tr_stats['files'] + p_stats['files'],
        'errors': t_stats['errors'] + tr_stats['errors'] + p_stats['errors'],
        'elapsed': round(elapsed, 1),
    }


if __name__ == '__main__':
    stats = generate_all()
    print(f"\nDone: {stats}")
