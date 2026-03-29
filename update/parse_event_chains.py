"""
Parse event_chain definition files.
"""

import os
import json
from parse_pdx import parse_file, get_value
from config import MOD_EVENT_CHAINS_DIR, OUTPUT_ASSETS_DIR


def parse_event_chains():
    """Parse all event chain files. Returns dict of chain_name -> chain_data."""
    chains = {}

    if not os.path.isdir(MOD_EVENT_CHAINS_DIR):
        print(f"  [WARN] Event chains directory not found: {MOD_EVENT_CHAINS_DIR}")
        return chains

    for fn in sorted(os.listdir(MOD_EVENT_CHAINS_DIR)):
        if not fn.endswith('.txt'):
            continue
        fp = os.path.join(MOD_EVENT_CHAINS_DIR, fn)
        data, err = parse_file(fp)
        if err:
            print(f"  [WARN] {fn}: {err}")
            continue

        for item in data:
            if not isinstance(item, dict):
                continue
            for chain_name, block in item.items():
                if not isinstance(block, list):
                    continue

                picture = get_value(block, 'picture')
                icon = get_value(block, 'icon')
                # Only include entries that look like chains (have picture or icon)
                if not picture and not icon:
                    continue

                chain = {
                    'id': chain_name,
                    'title': get_value(block, 'title'),
                    'desc': get_value(block, 'desc'),
                    'picture': picture,
                    'icon': icon,
                    'is_priority': get_value(block, 'is_priority') == 'yes',
                    'source_file': fn,
                }

                # Extract counter definitions
                counters = []
                for sub in block:
                    if isinstance(sub, dict) and 'counter' in sub:
                        counter_block = sub['counter']
                        if isinstance(counter_block, list):
                            # counter block contains name = { max = N }
                            for csub in counter_block:
                                if isinstance(csub, dict):
                                    for cname, cval in csub.items():
                                        counter = {'id': cname}
                                        if isinstance(cval, list):
                                            counter['max'] = get_value(cval, 'max')
                                        counters.append(counter)
                chain['counters'] = counters

                chains[chain_name] = chain

    return chains


def main():
    print("=== Parsing Event Chains ===")
    chains = parse_event_chains()

    output_path = os.path.join(OUTPUT_ASSETS_DIR, 'event_chains.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(chains, f, indent=2)

    print(f"  Event chains: {len(chains)}")
    print(f"  Written: {output_path}")
    return chains


if __name__ == '__main__':
    main()
