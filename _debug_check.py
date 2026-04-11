import json
traditions = json.load(open('assets/traditions.json', encoding='utf-8'))
loc = json.load(open('assets/localisation/en/traits.json', encoding='utf-8'))
count = 0
for t in traditions:
    if t.get('role') == 'adopt':
        tree = t.get('tree', '')
        nk = t.get('name_key') or t.get('id')
        loc_val = loc.get(nk, 'MISS')
        if count < 15:
            print(tree, '|', t['id'], '|', nk, '|', loc_val[:40] if loc_val != 'MISS' else 'MISS')
        count += 1
print(f'Total adopt nodes: {count}')
