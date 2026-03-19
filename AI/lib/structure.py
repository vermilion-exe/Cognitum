"""Structure markers and chunking utilities."""

import re
from typing import List, Tuple

HEADING_RE = re.compile(r"^#{1,6}\s+.+$", flags=re.MULTILINE)


def add_structure_markers(text: str) -> str:
    out_lines = []
    for ln in text.splitlines():
        stripped = ln.lstrip()
        if stripped.startswith("#"):
            out_lines.append("<H> " + ln)
        elif stripped.startswith(("-", "*")):
            out_lines.append("<BULLET> " + ln)
        else:
            out_lines.append(ln)
    return "\n".join(out_lines)


def split_by_headings(text: str) -> List[Tuple[str, str]]:
    matches = list(HEADING_RE.finditer(text))
    if not matches:
        return []

    sections: List[Tuple[str, str]] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end].strip("\n")
        first_line = chunk.splitlines()[0].strip()
        body = "\n".join(chunk.splitlines()[1:]).strip()
        sections.append((first_line, body))
    return sections


def sliding_window_chunks(
    token_ids: List[int], max_len: int, overlap_ratio: float
) -> List[List[int]]:
    if max_len <= 0:
        raise ValueError("max_len must be > 0")
    overlap_ratio = max(0.0, min(0.95, overlap_ratio))
    step = max(1, int(max_len * (1.0 - overlap_ratio)))

    chunks = []
    i = 0
    while i < len(token_ids):
        chunks.append(token_ids[i : i + max_len])
        i += step
    return chunks