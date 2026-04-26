"""
Recursive-descent parser for Paradox script files (Stellaris).

Much more robust than PLY for the messy event files:
- Handles all PDX constructs (blocks, lists, comparisons, variables)
- Graceful error recovery per-block
- Supports colons in identifiers (event_target:name)
- Handles @variables, >=, <=, >, < operators

Output format: list of dicts. Blocks become nested lists of dicts.
Duplicate keys are preserved (important for multiple 'option' blocks).
"""

import re


class PdxLexer:
    """Simple tokenizer for PDX script files."""

    TOKEN_PATTERN = re.compile(r"""
        (?P<COMMENT>\#[^\r\n]*)             |
        (?P<STRING>"(?:[^"\\]|\\.)*")        |
        (?P<GTEQ>>=)                         |
        (?P<LTEQ><=)                         |
        (?P<GTHAN>>)                         |
        (?P<LTHAN><)                         |
        (?P<EQUALS>=)                        |
        (?P<LBRACE>\{)                       |
        (?P<RBRACE>\})                       |
        (?P<VARIABLE>@[a-zA-Z_]\w*)          |
        (?P<NUMBER>-?\d+(?:\.\d+)?)          |
        (?P<BAREWORD>[a-zA-Z_][-\w.:']*)     |
        (?P<NEWLINE>\r?\n)                   |
        (?P<WS>[ \t]+)                       |
        (?P<OTHER>.)
    """, re.VERBOSE)

    def __init__(self, text):
        self.tokens = []
        self.pos = 0
        self._tokenize(text)

    def _tokenize(self, text):
        for m in self.TOKEN_PATTERN.finditer(text):
            kind = m.lastgroup
            value = m.group()
            if kind in ('COMMENT', 'NEWLINE', 'WS', 'OTHER'):
                continue
            if kind == 'STRING':
                # Strip quotes and unescape
                value = self._unescape(value[1:-1])
            self.tokens.append((kind, value))

    @staticmethod
    def _unescape(s):
        result = []
        escaped = False
        for c in s:
            if escaped:
                if c == 'n':
                    result.append('\n')
                elif c == 't':
                    result.append('\t')
                else:
                    result.append(c)
                escaped = False
            elif c == '\\':
                escaped = True
            else:
                result.append(c)
        return ''.join(result)

    def peek(self):
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def advance(self):
        tok = self.tokens[self.pos] if self.pos < len(self.tokens) else None
        self.pos += 1
        return tok

    def expect(self, kind):
        tok = self.peek()
        if tok and tok[0] == kind:
            return self.advance()
        return None

    def at_end(self):
        return self.pos >= len(self.tokens)


class PdxParser:
    """Recursive descent parser for PDX scripts."""

    def __init__(self):
        pass

    def parse(self, text, globals_table=None):
        """Parse a PDX script string. Returns list of dicts.

        globals_table: optional dict of {@var: value} resolved from
        common/scripted_variables/. File-local @var = value definitions
        take precedence over globals (Stellaris semantics).
        """
        lexer = PdxLexer(text)
        statements = self._parse_statements(lexer)
        # Build file-local variable table from top-level @var = value
        var_table = {}
        for stmt in statements:
            if isinstance(stmt, dict):
                for k, v in stmt.items():
                    if isinstance(k, str) and k.startswith('@') and not isinstance(v, (list, dict)):
                        var_table[k] = v
        # Merge globals as fallback (file-local wins)
        if globals_table:
            merged = dict(globals_table)
            merged.update(var_table)
            var_table = merged
        # Resolve @variable references in all statements
        if var_table:
            statements = _resolve_variables(statements, var_table)
        return statements

    def _parse_statements(self, lexer):
        statements = []
        while not lexer.at_end():
            tok = lexer.peek()
            if tok is None:
                break
            if tok[0] == 'RBRACE':
                break  # End of block
            stmt = self._parse_statement(lexer)
            if stmt is not None:
                statements.append(stmt)
        return statements

    def _parse_statement(self, lexer):
        tok = lexer.peek()
        if tok is None:
            return None

        # Skip stray braces
        if tok[0] == 'RBRACE':
            return None

        # Variable, key, or number (numbers can be keys in random_list blocks: 25 = { ... })
        if tok[0] in ('BAREWORD', 'STRING', 'VARIABLE', 'NUMBER'):
            key_tok = lexer.advance()
            key = key_tok[1]
            if key_tok[0] == 'NUMBER':
                key = _coerce_number(key)

            # Check for operator
            op_tok = lexer.peek()
            if op_tok and op_tok[0] in ('EQUALS', 'GTHAN', 'LTHAN', 'GTEQ', 'LTEQ'):
                op = lexer.advance()[1]
                value = self._parse_value(lexer)

                if op == '=':
                    return {key: value}
                else:
                    return {key: {op: value}}

            # Bare key without operator (shouldn't happen at top level but handle gracefully)
            return {key: True}

        else:
            # Skip unknown tokens
            lexer.advance()
            return None

    def _parse_value(self, lexer):
        tok = lexer.peek()
        if tok is None:
            return None

        if tok[0] == 'LBRACE':
            return self._parse_block_or_list(lexer)
        elif tok[0] == 'STRING':
            lexer.advance()
            return tok[1]
        elif tok[0] == 'NUMBER':
            lexer.advance()
            return _coerce_number(tok[1])
        elif tok[0] in ('BAREWORD', 'VARIABLE'):
            lexer.advance()
            return tok[1]
        else:
            # Unexpected - skip
            lexer.advance()
            return None

    def _parse_block_or_list(self, lexer):
        """Parse { ... } - could be a block of key=value or a list of values."""
        lexer.expect('LBRACE')  # consume {

        # Peek ahead to determine if this is a key=value block or a value list
        # Look at first two tokens
        items = []
        is_list = None

        while not lexer.at_end():
            tok = lexer.peek()
            if tok is None:
                break
            if tok[0] == 'RBRACE':
                lexer.advance()
                break

            if is_list is None:
                # Determine: if next-next is an operator, it's a block
                # Otherwise it could be a list
                if tok[0] in ('BAREWORD', 'STRING', 'VARIABLE', 'NUMBER'):
                    # Look ahead for operator
                    saved_pos = lexer.pos
                    lexer.advance()
                    next_tok = lexer.peek()
                    lexer.pos = saved_pos  # restore

                    if next_tok and next_tok[0] in ('EQUALS', 'GTHAN', 'LTHAN', 'GTEQ', 'LTEQ'):
                        is_list = False
                    elif next_tok and next_tok[0] == 'RBRACE':
                        # Single value in braces
                        is_list = True
                    elif tok[0] != 'NUMBER' and next_tok and next_tok[0] in ('BAREWORD', 'STRING', 'NUMBER'):
                        # Two non-numeric values in a row = list
                        is_list = True
                    elif tok[0] == 'NUMBER' and next_tok and next_tok[0] == 'NUMBER':
                        # Two numbers in a row = list
                        is_list = True
                    elif tok[0] == 'NUMBER' and next_tok and next_tok[0] in ('BAREWORD', 'STRING'):
                        # Number followed by word = list (rare)
                        is_list = True
                    else:
                        is_list = False
                elif tok[0] == 'LBRACE':
                    # Bare block inside block = list of blocks (very rare)
                    is_list = False
                else:
                    is_list = False

            if is_list:
                val_tok = lexer.advance()
                if val_tok[0] == 'NUMBER':
                    items.append(_coerce_number(val_tok[1]))
                else:
                    items.append(val_tok[1])
            else:
                stmt = self._parse_statement(lexer)
                if stmt is not None:
                    items.append(stmt)

        return items


def _resolve_variables(obj, var_table):
    """Recursively resolve @variable references in parsed data."""
    if isinstance(obj, list):
        return [_resolve_variables(item, var_table) for item in obj]
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            result[k] = _resolve_variables(v, var_table)
        return result
    if isinstance(obj, str) and obj.startswith('@') and obj in var_table:
        return var_table[obj]
    return obj


def _coerce_number(val):
    if isinstance(val, str):
        try:
            if '.' in val:
                return float(val)
            return int(val)
        except (ValueError, TypeError):
            pass
    return val


# Singleton parser
_parser = PdxParser()

# Globally-scoped @variables resolved across all common/scripted_variables/*
# files (mod overrides vanilla). Lazily populated on the first parse_file call
# unless callers reset it via load_global_scripted_variables().
_GLOBAL_VARS = None
_GLOBAL_VARS_LOADED = False


def load_global_scripted_variables(dirs):
    """Walk the given list of scripted_variables directories, parse every .txt
    file, and harvest every top-level @var = value assignment into a single
    dict. Later dirs override earlier ones (mod after vanilla).

    Files in this directory may also contain non-@ statements (e.g. @-style
    constants used as map values) — those are ignored, only @-keys are kept.
    """
    import os
    table = {}
    for d in dirs or []:
        if not d or not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith('.txt'):
                continue
            path = os.path.join(d, fn)
            try:
                with open(path, 'r', encoding='utf-8-sig') as f:
                    contents = f.read()
            except Exception:
                continue
            try:
                # parse without globals — these files only ever define new vars,
                # never reference other ones in practice (verified via grep).
                statements = _parser.parse(contents)
            except Exception:
                continue
            for stmt in statements:
                if not isinstance(stmt, dict):
                    continue
                for k, v in stmt.items():
                    if isinstance(k, str) and k.startswith('@') and not isinstance(v, (list, dict)):
                        table[k] = v
    return table


def _ensure_globals_loaded():
    """Lazy-load globals using config-defined scripted-variables dirs.
    Idempotent — only does work the first call."""
    global _GLOBAL_VARS, _GLOBAL_VARS_LOADED
    if _GLOBAL_VARS_LOADED:
        return
    _GLOBAL_VARS_LOADED = True  # set first to avoid re-entry on import errors
    try:
        import os
        from config import STNH_MOD_ROOT, VANILLA_ROOT
        dirs = [
            os.path.join(VANILLA_ROOT,   'common', 'scripted_variables'),
            os.path.join(STNH_MOD_ROOT, 'common', 'scripted_variables'),
        ]
        _GLOBAL_VARS = load_global_scripted_variables(dirs)
    except Exception:
        _GLOBAL_VARS = {}


def parse_file(file_path):
    """
    Parse a single Paradox script file.
    Returns (parsed_data, error_message).
    """
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            contents = f.read()
    except Exception as e:
        return None, f"Read error: {e}"

    try:
        _ensure_globals_loaded()
        result = _parser.parse(contents, globals_table=_GLOBAL_VARS)
        return result, None
    except Exception as e:
        return None, f"Parse error: {e}"


def parse_string(text):
    """Parse a PDX script string. Returns list of dicts."""
    _ensure_globals_loaded()
    return _parser.parse(text, globals_table=_GLOBAL_VARS)


def get_value(block, key):
    """Get first value for a key in a parsed block (list of dicts)."""
    if not isinstance(block, list):
        return None
    for item in block:
        if isinstance(item, dict) and key in item:
            return item[key]
    return None


def get_all_values(block, key):
    """Get all values for a key in a parsed block."""
    results = []
    if not isinstance(block, list):
        return results
    for item in block:
        if isinstance(item, dict) and key in item:
            results.append(item[key])
    return results


def get_blocks(block, key):
    """Get all sub-blocks for a key (where value is a list)."""
    results = []
    if not isinstance(block, list):
        return results
    for item in block:
        if isinstance(item, dict) and key in item:
            val = item[key]
            if isinstance(val, list):
                results.append(val)
    return results
