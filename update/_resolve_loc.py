import json, re, os

VAR_REF_RE = re.compile(r'\$([^\$]+)\$')
OUT_DIR = r'D:\GIT\stnh_wiki\assets\localisation'

def resolve(loc_data):
    def _resolve(text, seen):
        def replacer(m):
            k = m.group(1)
            if k in seen or k not in loc_data: return m.group(0)
            seen.add(k)
            return _resolve(loc_data[k], seen)
        return VAR_REF_RE.sub(replacer, text)
    for key in list(loc_data.keys()):
        if chr(36) in loc_data[key]:
            loc_data[key] = _resolve(loc_data[key], {key})
    return loc_data

for fn in os.listdir(OUT_DIR):
    if not fn.endswith('.json'): continue
    fp = os.path.join(OUT_DIR, fn)
    with open(fp, encoding='utf-8') as f:
        data = json.load(f)
    before = sum(1 for v in data.values() if chr(36) in v)
    resolve(data)
    after = sum(1 for v in data.values() if chr(36) in v)
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    print(fn + ': resolved ' + str(before - after) + ' (' + str(after) + ' unresolvable remain)')
