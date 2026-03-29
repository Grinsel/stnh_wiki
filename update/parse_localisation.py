"""
Localisation parser for all 7 STNH languages.
Reads .yml files from localisation/<language>/ directories.
Outputs per-language JSON files to assets/localisation/<language>.json
"""

import os
import re
import json
import codecs
from config import (
    MOD_LOCALISATION_DIR, OUTPUT_LOCALISATION_DIR,
    LANGUAGES, LANGUAGE_SUFFIXES
)

# Regex to strip Stellaris format codes: §R, §G, §!, £energy, etc.
FORMAT_CODES_RE = re.compile(r'§[A-Za-z!]|£\w+\s*')

# Regex to match localisation lines: key:0 "value"
LOC_LINE_RE = re.compile(r'^\s*([\w\._-]+):\d*\s*"(.*)"\s*$')


def parse_localisation_file(filepath):
    """Parse a single .yml localisation file. Returns dict of key -> text."""
    result = {}
    try:
        try:
            with codecs.open(filepath, 'r', 'utf-8-sig') as f:
                lines = f.readlines()
        except UnicodeDecodeError:
            with codecs.open(filepath, 'r', 'latin-1') as f:
                lines = f.readlines()
        for line in lines:
                line = line.rstrip('\r\n')
                if not line.strip() or line.strip().startswith('#'):
                    continue
                # Skip the language header line (e.g. l_english:)
                if line.strip().startswith('l_') and line.strip().endswith(':'):
                    continue

                match = LOC_LINE_RE.match(line)
                if match:
                    key = match.group(1)
                    value = match.group(2)
                    # Strip format codes
                    value = FORMAT_CODES_RE.sub('', value)
                    result[key] = value
    except Exception as e:
        print(f"  [WARN] Error reading {filepath}: {e}")
    return result


VAR_REF_RE = re.compile(r'\$([^$]+)\$')


def resolve_variable_refs(loc_data):
    """Recursively resolve $key$ variable references in localisation values.
    Also converts literal \\n to real newlines."""
    def _resolve(text, seen):
        def replacer(match):
            ref_key = match.group(1)
            if ref_key in seen:
                return match.group(0)  # prevent infinite loops
            if ref_key in loc_data:
                seen.add(ref_key)
                return _resolve(loc_data[ref_key], seen)
            return match.group(0)  # leave unresolved if key not found
        return VAR_REF_RE.sub(replacer, text)

    for key in loc_data:
        if '$' in loc_data[key]:
            loc_data[key] = _resolve(loc_data[key], {key})
        # Convert literal \n to real newlines
        loc_data[key] = loc_data[key].replace('\\n', '\n')

    return loc_data


def collect_referenced_keys(loc_data):
    """Collect all keys referenced via $key$ in localisation values."""
    refs = set()
    for value in loc_data.values():
        for match in VAR_REF_RE.finditer(value):
            ref_key = match.group(1)
            if ref_key in loc_data:
                refs.add(ref_key)
    return refs


def parse_all_languages():
    """Parse localisation files for all languages. Returns dict of lang -> {key: text}."""
    all_loc = {}
    stats = {}

    for lang in LANGUAGES:
        lang_dir = os.path.join(MOD_LOCALISATION_DIR, lang)
        suffix = LANGUAGE_SUFFIXES[lang]

        if not os.path.isdir(lang_dir):
            print(f"  [WARN] Language directory not found: {lang_dir}")
            all_loc[lang] = {}
            stats[lang] = 0
            continue

        lang_data = {}
        file_count = 0

        for fn in sorted(os.listdir(lang_dir)):
            if not fn.endswith('.yml'):
                continue
            fp = os.path.join(lang_dir, fn)
            file_data = parse_localisation_file(fp)
            lang_data.update(file_data)
            file_count += 1

        # Resolve $key$ variable references
        lang_data = resolve_variable_refs(lang_data)

        all_loc[lang] = lang_data
        stats[lang] = len(lang_data)
        print(f"  {lang}: {file_count} files, {len(lang_data)} keys")

    return all_loc, stats


def write_localisation_json(all_loc):
    """Write per-language JSON files."""
    os.makedirs(OUTPUT_LOCALISATION_DIR, exist_ok=True)

    for lang, data in all_loc.items():
        output_path = os.path.join(OUTPUT_LOCALISATION_DIR, f"{lang}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        print(f"  Written: {output_path} ({len(data)} keys)")


def main():
    print("=== Parsing Localisation (all 7 languages) ===")
    all_loc, stats = parse_all_languages()
    write_localisation_json(all_loc)
    print(f"\nTotal keys across all languages:")
    for lang, count in stats.items():
        print(f"  {lang}: {count}")
    return all_loc, stats


if __name__ == '__main__':
    main()
