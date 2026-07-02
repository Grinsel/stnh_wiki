"""Fixture tests for parse_pdx.py edge cases.

Run manually (no CI): python -m tests.test_parse_pdx  (from update/)
or:                    python tests/test_parse_pdx.py

Covers the inline-math `@[ ... ]` and named-block color value handling added
to keep the tokenizer from desyncing on those constructs.
"""

import os
import sys

# Allow running both as a module and as a direct script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import parse_pdx  # noqa: E402


def _parse(text, globals_table=None):
    return parse_pdx._parser.parse(text, globals_table=globals_table)


def _flatten(statements):
    """Merge a list of single-key dicts into one dict for easy assertions."""
    out = {}
    for s in statements:
        if isinstance(s, dict):
            out.update(s)
    return out


def test_inline_math_does_not_desync():
    # The trigger following the inline-math must still parse correctly.
    text = """
    weight = {
        base = 10
        modifier = {
            factor = 2
            planet_stability < @[ stabilitylevel2 + 10 ]
        }
    }
    next_key = 5
    """
    st = _parse(text)
    d = _flatten(st)
    assert 'weight' in d, d
    assert d.get('next_key') == 5, ('inline math desynced the stream', d)


def test_inline_math_evaluates_with_vars():
    text = "value = @[ base_cd * 2 ]"
    globals_table = {'@base_cd': 360}
    st = _parse(text, globals_table=globals_table)
    d = _flatten(st)
    assert d.get('value') == 720, d


def test_inline_math_kept_literal_without_vars():
    # No variable table -> keep the literal string, never crash or drop it.
    text = "value = @[ unknown_var + 1 ]"
    st = _parse(text)
    d = _flatten(st)
    assert isinstance(d.get('value'), str) and d['value'].startswith('@['), d


def test_color_hsv_block_is_tagged_not_desynced():
    text = """
    color = hsv { 0.0 0.0 0.8 }
    name = "Test"
    """
    st = _parse(text)
    d = _flatten(st)
    assert d.get('name') == 'Test', ('color block desynced the stream', d)
    assert isinstance(d.get('color'), dict) and 'hsv' in d['color'], d
    assert d['color']['hsv'] == [0.0, 0.0, 0.8], d['color']


def test_rgb_block():
    st = _parse("c = rgb { 255 128 0 }")
    d = _flatten(st)
    assert d.get('c', {}).get('rgb') == [255, 128, 0], d


def test_ordinary_bareword_value_unchanged():
    # A non-color bareword followed by a block must NOT be swallowed as a tag.
    st = _parse("x = potential")
    d = _flatten(st)
    assert d.get('x') == 'potential', d


def test_plain_variable_still_resolves():
    st = _parse("@base = 5\nval = @base")
    d = _flatten(st)
    assert d.get('val') == 5, d


def _run():
    tests = [v for k, v in sorted(globals().items()) if k.startswith('test_') and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL  {t.__name__}: {e}")
        except Exception as e:
            failed += 1
            print(f"ERROR {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(_run())
