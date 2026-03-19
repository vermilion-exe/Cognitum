"""LaTeX/math span protection and restoration."""

import re
from typing import Dict, List, Tuple

MATH_PATTERNS = [
    r"\$\$.*?\$\$",
    r"\\\[.*?\\\]",
    r"\\\(.*?\\\)",
    r"\\begin\{.*?\}.*?\\end\{.*?\}",
    r"\$.*?\$",
]
_MATH_RE = re.compile(
    "|".join(f"({p})" for p in MATH_PATTERNS), flags=re.DOTALL
)

MATH_TOKEN_RE = re.compile(r"<MATH_\d{4}>")

MATH_INLINE_OR_BLOCK_RE = re.compile(
    r"(\$\$.*?\$\$|\\\[.*?\\\]|\\\(.*?\\\)|\$.*?\$)",
    flags=re.DOTALL,
)


def protect_math_spans(
    text: str, max_placeholders: int
) -> Tuple[str, Dict[str, str]]:
    mapping: Dict[str, str] = {}

    def _repl(m: re.Match) -> str:
        if len(mapping) >= max_placeholders:
            return m.group(0)
        token = f"<MATH_{len(mapping):04d}>"
        mapping[token] = m.group(0)
        return token

    protected = _MATH_RE.sub(_repl, text)
    return protected, mapping


def restore_math_spans(text: str, mapping: Dict[str, str]) -> str:
    for k in sorted(mapping.keys(), reverse=True):
        text = text.replace(k, mapping[k])

    leftovers = MATH_TOKEN_RE.findall(text)
    if leftovers and mapping:
        keys_sorted = sorted(mapping.keys())
        k = len(keys_sorted)

        def repl(m: re.Match) -> str:
            tok = m.group(0)
            if tok in mapping:
                return mapping[tok]
            idx = int(tok[len("<MATH_") : len("<MATH_") + 4])
            return mapping[keys_sorted[idx % k]]

        text = MATH_TOKEN_RE.sub(repl, text)

    return text


def build_math_bad_words_ids(
    tokenizer,
    mapping: Dict[str, str],
    num_math_placeholders: int,
) -> List[List[int]]:
    allowed = set(mapping.keys())
    bad_words_ids: List[List[int]] = []

    for i in range(num_math_placeholders):
        tok = f"<MATH_{i:04d}>"
        if tok in allowed:
            continue
        seq = tokenizer.encode(tok, add_special_tokens=False)
        if seq:
            bad_words_ids.append(seq)

    return bad_words_ids


def fix_balance_factor_formula(
    text: str, mapping: Dict[str, str]
) -> str:
    if not mapping:
        return text

    candidates = list(mapping.values())

    def score_balance_candidate(s: str) -> int:
        s_low = s.lower()
        score = 0
        if "h(" in s_low:
            score += 3
        if "left" in s_low:
            score += 6
        if "right" in s_low:
            score += 6
        if "balance" in s_low:
            score += 6
        if "-" in s:
            score += 2
        if "t(" in s_low or "o(" in s_low or r"\log" in s_low:
            score -= 2
        return score

    best = max(candidates, key=score_balance_candidate)
    if score_balance_candidate(best) <= 0:
        return text

    cue_re = re.compile(
        r"(balance factor.*?(?:formula|calculated).*?:\s*)",
        flags=re.IGNORECASE | re.DOTALL,
    )

    m = cue_re.search(text)
    if not m:
        return text

    def repl(m_inner: re.Match) -> str:
        start = m_inner.end()
        tail = text[start:]
        mm = MATH_INLINE_OR_BLOCK_RE.search(tail)
        if not mm:
            return m_inner.group(0)
        found_math = mm.group(0)
        if score_balance_candidate(found_math) >= 8:
            return m_inner.group(0)
        new_tail = tail[: mm.start()] + best + tail[mm.end() :]
        return m_inner.group(0) + new_tail

    return text[: m.start()] + repl(m)