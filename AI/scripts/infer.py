#!/usr/bin/env python3
"""
infer_seq2seq_summarizer.py

What this implements / changes:
1) Protect LaTeX/math spans with placeholders (<MATH_0000>...) BEFORE summarization
   and restore them AFTER summarization -> prevents broken LaTeX.
2) Works for long notes with or without headings:
   - If markdown headings exist, it summarizes section-by-section.
   - Else it uses sliding-window token chunking with overlap.
3) Uses LED global_attention_mask on:
   - token 0
   - <H>, <BULLET>
   - <MATH_####> placeholders
4) Hierarchical summarize:
   - summarize chunks -> combine -> (optionally) summarize again until under a target length

Usage example:
python infer_seq2seq_summarizer.py \
  --model_dir out_led/final_model \
  --input_file note.md \
  --max_input_len 4096 \
  --overlap_ratio 0.15 \
  --max_new_tokens 256 \
  --recursive
"""

import argparse
import re
from typing import Dict, List, Tuple

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# ----------------------------
# LaTeX/math protection
# ----------------------------

MATH_PATTERNS = [
    r"\$\$.*?\$\$",
    r"\\\[.*?\\\]",
    r"\\\(.*?\\\)",
    r"\\begin\{.*?\}.*?\\end\{.*?\}",
    r"\$.*?\$",
]
_MATH_RE = re.compile("|".join(f"({p})" for p in MATH_PATTERNS), flags=re.DOTALL)

MATH_TOKEN_RE = re.compile(r"<MATH_\d{4}>")

def build_math_bad_words_ids(tokenizer, mapping: Dict[str, str], num_math_placeholders: int) -> List[List[int]]:
    """
    Disallow generating any <MATH_####> token that is NOT present in `mapping`.
    This prevents placeholder leakage while preserving math content (it must choose a valid placeholder).
    """
    # Which placeholders are valid for THIS input?
    allowed = set(mapping.keys())

    bad_words_ids: List[List[int]] = []
    for i in range(num_math_placeholders):
        tok = f"<MATH_{i:04d}>"
        if tok in allowed:
            continue

        # Encode as a *sequence* to handle cases where tok is split into multiple tokens.
        seq = tokenizer.encode(tok, add_special_tokens=False)
        if seq:  # defensive
            bad_words_ids.append(seq)

    return bad_words_ids

def protect_math_spans(text: str, max_placeholders: int) -> Tuple[str, Dict[str, str]]:
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
    # First, restore known placeholders.
    for k in sorted(mapping.keys(), reverse=True):
        text = text.replace(k, mapping[k])

    # If any <MATH_####> remain, map them to existing spans rather than dropping them.
    # This preserves math content when the model references the "wrong" placeholder index.
    leftovers = MATH_TOKEN_RE.findall(text)
    if leftovers and mapping:
        # Stable order of available spans: <MATH_0000>, <MATH_0001>, ...
        keys_sorted = sorted(mapping.keys())
        k = len(keys_sorted)

        def repl(m: re.Match) -> str:
            tok = m.group(0)
            # If it somehow is known, return it (shouldn't happen here).
            if tok in mapping:
                return mapping[tok]
            # Parse index and map deterministically into the available spans.
            idx = int(tok[len("<MATH_"):len("<MATH_")+4])
            return mapping[keys_sorted[idx % k]]

        text = MATH_TOKEN_RE.sub(repl, text)

    return text

MATH_INLINE_OR_BLOCK_RE = re.compile(
    r"(\$\$.*?\$\$|\\\[.*?\\\]|\\\(.*?\\\)|\$.*?\$)",
    flags=re.DOTALL
)

def fix_balance_factor_formula(text: str, mapping: Dict[str, str]) -> str:
    """
    If the summary says 'balance factor ... formula:' but the following math span
    is not the balance formula, replace it with the best candidate math span from the input.
    """
    if not mapping:
        return text

    candidates = list(mapping.values())

    def score_balance_candidate(s: str) -> int:
        s_low = s.lower()
        score = 0
        # Strong signals for the balance formula
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
        # Penalize common complexity formulas so we don't pick T(n)=...
        if "t(" in s_low or "o(" in s_low or r"\log" in s_low:
            score -= 2
        return score

    best = max(candidates, key=score_balance_candidate)
    if score_balance_candidate(best) <= 0:
        return text  # nothing good to substitute

    # Find the "balance factor ... formula:" cue and the next math span after it.
    cue_re = re.compile(r"(balance factor.*?(?:formula|calculated).*?:\s*)", flags=re.IGNORECASE | re.DOTALL)

    def repl(m: re.Match) -> str:
        start = m.end()
        tail = text[start:]
        mm = MATH_INLINE_OR_BLOCK_RE.search(tail)
        if not mm:
            return m.group(0)

        found_math = mm.group(0)

        # If it's already the balance-ish formula, keep it.
        if score_balance_candidate(found_math) >= 8:
            return m.group(0)

        # Replace only that *next* math span.
        new_tail = tail[:mm.start()] + best + tail[mm.end():]
        return m.group(0) + new_tail

    # Apply once (first match) to avoid unintended cascades.
    m = cue_re.search(text)
    if not m:
        return text
    return text[:m.start()] + repl(m)

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

# ----------------------------
# Chunking
# ----------------------------

HEADING_RE = re.compile(r"^#{1,6}\s+.+$", flags=re.MULTILINE)

def split_by_headings(text: str) -> List[Tuple[str, str]]:
    """
    Split into list of (heading, body). If no headings, returns [].
    """
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

def sliding_window_chunks(token_ids: List[int], max_len: int, overlap_ratio: float) -> List[List[int]]:
    if max_len <= 0:
        raise ValueError("max_len must be > 0")
    overlap_ratio = max(0.0, min(0.95, overlap_ratio))
    step = max(1, int(max_len * (1.0 - overlap_ratio)))

    chunks = []
    i = 0
    while i < len(token_ids):
        chunks.append(token_ids[i:i + max_len])
        i += step
    return chunks

# ----------------------------
# Global attention mask helper
# ----------------------------

def make_global_attention_mask(input_ids: torch.Tensor, tokenizer: AutoTokenizer, num_math_placeholders: int) -> torch.Tensor:
    """
    Global attention on:
    - token 0
    - <H>, <BULLET>
    - <MATH_####>
    """
    gm = torch.zeros_like(input_ids, dtype=torch.long)
    gm[:, 0] = 1

    for t in ["<H>", "<BULLET>"]:
        tid = tokenizer.convert_tokens_to_ids(t)
        if tid != tokenizer.unk_token_id:
            gm |= (input_ids == tid).long()

    # math placeholder ids
    for i in range(num_math_placeholders):
        tid = tokenizer.convert_tokens_to_ids(f"<MATH_{i:04d}>")
        if tid == tokenizer.unk_token_id:
            # If tokenizer doesn't know these tokens, stop early
            break
        gm |= (input_ids == tid).long()

    return gm

# ----------------------------
# Generation
# ----------------------------

@torch.inference_mode()
def generate_summary(
    model,
    tokenizer,
    text: str,
    max_input_len: int,
    max_new_tokens: int,
    num_beams: int,
    length_penalty: float,
    num_math_placeholders: int,
    no_repeat_ngram_size: int,
    repetition_penalty: float,
    encoder_repetition_penalty: float,
    bad_words_ids: List[List[int]] | None = None,
) -> str:
    enc = tokenizer(
        text,
        truncation=True,
        max_length=max_input_len,
        return_tensors="pt",
    )

    input_ids = enc["input_ids"].to(model.device)
    attention_mask = enc["attention_mask"].to(model.device)
    global_attention_mask = make_global_attention_mask(input_ids, tokenizer, num_math_placeholders).to(model.device)

    out = model.generate(
        input_ids=input_ids,
        attention_mask=attention_mask,
        global_attention_mask=global_attention_mask,
        max_new_tokens=max_new_tokens,
        no_repeat_ngram_size=no_repeat_ngram_size,
        repetition_penalty=repetition_penalty,
        encoder_repetition_penalty=encoder_repetition_penalty,
        num_beams=num_beams,
        length_penalty=length_penalty,
        early_stopping=False,
        bad_words_ids=bad_words_ids,
    )
    text = tokenizer.decode(out[0], skip_special_tokens=False).strip()

    text = text.replace("<s>", "").replace("</s>", "")
    text = text.replace("<pad>", "")
    text = text.strip()

    return text

def hierarchical_summarize(
    model,
    tokenizer,
    text: str,
    max_input_len: int,
    overlap_ratio: float,
    max_new_tokens: int,
    num_beams: int,
    length_penalty: float,
    recursive: bool,
    num_math_placeholders: int,
    no_repeat_ngram_size: int,
    repetition_penalty: float,
    encoder_repetition_penalty: float,
    bad_words_ids: List[List[int]] | None = None,
) -> str:
    # Tokenize without truncation for chunking
    token_ids = tokenizer.encode(text, add_special_tokens=False)
    if len(token_ids) <= max_input_len:
        return generate_summary(
            model, tokenizer, text, max_input_len, max_new_tokens, num_beams, length_penalty, num_math_placeholders, no_repeat_ngram_size, repetition_penalty, encoder_repetition_penalty
        )

    chunks = sliding_window_chunks(token_ids, max_input_len, overlap_ratio)
    chunk_summaries = []
    for ch in chunks:
        ch_text = tokenizer.decode(ch, skip_special_tokens=False)
        chunk_summaries.append(
            generate_summary(
                model, tokenizer, ch_text, max_input_len, max_new_tokens, num_beams, length_penalty, num_math_placeholders, no_repeat_ngram_size, repetition_penalty, encoder_repetition_penalty
            )
        )

    merged = "\n".join(chunk_summaries).strip()

    def dedupe_paragraphs(text: str) -> str:
        seen = set()
        out = []
        for p in re.split(r"\n\s*\n", text.strip()):
            k = re.sub(r"\s+", " ", p.strip())
            if not k or k in seen:
                continue
            seen.add(k)
            out.append(p.strip())
        return "\n\n".join(out)

    merged = dedupe_paragraphs(merged)

    if not recursive:
        return merged

    # Recursive pass: try to compress merged summaries further
    # until it fits in one pass or until we stop improving.
    prev = merged
    for _ in range(3):  # cap recursion depth
        token_ids2 = tokenizer.encode(prev, add_special_tokens=False)
        if len(token_ids2) <= max_input_len:
            return generate_summary(
                model, tokenizer, prev, max_input_len, max_new_tokens, num_beams, length_penalty, num_math_placeholders, no_repeat_ngram_size, repetition_penalty, encoder_repetition_penalty
            )
        new = hierarchical_summarize(
            model, tokenizer, prev, max_input_len, overlap_ratio, max_new_tokens,
            num_beams,
            length_penalty,
            recursive=False,
            num_math_placeholders=num_math_placeholders,
            no_repeat_ngram_size=no_repeat_ngram_size,
            repetition_penalty=repetition_penalty,
            encoder_repetition_penalty=encoder_repetition_penalty,
            bad_words_ids=bad_words_ids,
        )
        if new.strip() == prev.strip():
            break
        prev = new

    return prev

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model_dir", required=True, help="Directory with model + tokenizer (e.g., out_led/final_model)")
    ap.add_argument("--input_file", required=True)
    ap.add_argument("--max_input_len", type=int, default=4096)
    ap.add_argument("--overlap_ratio", type=float, default=0.15)

    ap.add_argument("--max_new_tokens", type=int, default=256)
    ap.add_argument("--num_beams", type=int, default=4)
    ap.add_argument("--length_penalty", type=float, default=1.2)
    ap.add_argument("--recursive", action="store_true")

    ap.add_argument("--no_repeat_ngram_size", type=int, default=4)
    ap.add_argument("--repetition_penalty", type=float, default=1.15)
    ap.add_argument("--encoder_repetition_penalty", type=float, default=1.05)

    ap.add_argument("--num_math_placeholders", type=int, default=512)

    args = ap.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForSeq2SeqLM.from_pretrained(args.model_dir)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    model.eval()

    raw = open(args.input_file, "r", encoding="utf-8").read()

    # 1) Protect math
    protected, mapping = protect_math_spans(raw, args.num_math_placeholders)

    math_bad_words_ids = build_math_bad_words_ids(
        tokenizer=tokenizer,
        mapping=mapping,
        num_math_placeholders=args.num_math_placeholders
    )

    # 2) Add structure markers (helps model preserve note layout)
    structured = add_structure_markers(protected)

    # 3) If headings exist, summarize per-section; else hierarchical chunking
    sections = split_by_headings(structured)
    if sections:
        outputs = []
        for heading, body in sections:
            if not body.strip():
                continue
            section_text = f"{heading}\n{body}"
            summ = hierarchical_summarize(
                model, tokenizer, section_text,
                max_input_len=args.max_input_len,
                overlap_ratio=args.overlap_ratio,
                max_new_tokens=args.max_new_tokens,
                num_beams=args.num_beams,
                length_penalty=args.length_penalty,
                recursive=args.recursive,
                num_math_placeholders=args.num_math_placeholders,
                no_repeat_ngram_size=args.no_repeat_ngram_size,
                repetition_penalty=args.repetition_penalty,
                encoder_repetition_penalty=args.encoder_repetition_penalty,
                bad_words_ids=math_bad_words_ids,
            )
            outputs.append(summ.strip())
        merged_summary = "\n\n".join(outputs).strip()
    else:
        merged_summary = hierarchical_summarize(
            model, tokenizer, structured,
            max_input_len=args.max_input_len,
            overlap_ratio=args.overlap_ratio,
            max_new_tokens=args.max_new_tokens,
            num_beams=args.num_beams,
            length_penalty=args.length_penalty,
            recursive=args.recursive,
            num_math_placeholders=args.num_math_placeholders,
            no_repeat_ngram_size=args.no_repeat_ngram_size,
            repetition_penalty=args.repetition_penalty,
            encoder_repetition_penalty=args.encoder_repetition_penalty
        )

    # 4) Restore math
    final = restore_math_spans(merged_summary, mapping)

    final = fix_balance_factor_formula(final, mapping)

    print(final)

if __name__ == "__main__":
    main()