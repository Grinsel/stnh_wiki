"""Merge vanilla + mod localisation. Vanilla is base, mod overrides. Resolves $key$ refs."""
import os, re, json, codecs

VANILLA_LOC = r"E:\SteamLibrary\steamapps\common\Stellaris\localisation"
MOD_LOC     = r"D:\GIT\New-Horizons-Development\localisation"
OUT_DIR     = r"D:\GIT\stnh_wiki\assets\localisation"

FORMAT_CODES_RE = re.compile(r"§[A-Za-z!]|£\w+\s*")
LOC_LINE_RE     = re.compile(r'^\s*([\w\._-]+):\d*\s*"(.*)"\s*$')
VAR_REF_RE      = re.compile(r'\$([^\$]+)\$')

LANGUAGES = ["english", "german", "french", "spanish", "russian", "polish", "braz_por"]

def parse_file(fp):
    result = {}
    try:
        try:
            lines = codecs.open(fp, "r", "utf-8-sig").readlines()
        except UnicodeDecodeError:
            lines = codecs.open(fp, "r", "latin-1").readlines()
        for line in lines:
            line = line.rstrip()
            if not line.strip() or line.strip().startswith("#"):
                continue
            if line.strip().startswith("l_") and line.strip().endswith(":"):
                continue
            m = LOC_LINE_RE.match(line)
            if m:
                key = m.group(1)
                val = FORMAT_CODES_RE.sub("", m.group(2))
                result[key] = val
    except Exception as e:
        print("  WARN " + fp + ": " + str(e))
    return result

def parse_dir(d):
    data = {}
    if not os.path.isdir(d):
        return data
    for fn in sorted(os.listdir(d)):
        if fn.endswith(".yml"):
            data.update(parse_file(os.path.join(d, fn)))
    return data

def resolve_variable_refs(loc_data):
    def _resolve(text, seen):
        def replacer(m):
            k = m.group(1)
            if k in seen or k not in loc_data:
                return m.group(0)
            seen.add(k)
            return _resolve(loc_data[k], seen)
        return VAR_REF_RE.sub(replacer, text)
    for key in list(loc_data.keys()):
        if "$" in loc_data[key]:
            loc_data[key] = _resolve(loc_data[key], {key})
        loc_data[key] = loc_data[key].replace("\\n", "\n")
    return loc_data

os.makedirs(OUT_DIR, exist_ok=True)
for lang in LANGUAGES:
    data = parse_dir(os.path.join(VANILLA_LOC, lang))
    v_count = len(data)
    mod_data = parse_dir(os.path.join(MOD_LOC, lang))
    data.update(mod_data)
    before = sum(1 for v in data.values() if "$" in v)
    resolve_variable_refs(data)
    after = sum(1 for v in data.values() if "$" in v)
    out = os.path.join(OUT_DIR, lang + ".json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(lang + ": vanilla=" + str(v_count) + " mod=" + str(len(mod_data)) + " total=" + str(len(data)) + " resolved=" + str(before-after) + " unresolvable=" + str(after))
