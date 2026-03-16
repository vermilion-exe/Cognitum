#!/usr/bin/env python3
"""
generate_dataset.py (improved)

What changed vs your current generator:

NEW (coherence):
- Deduplicate consecutive identical headings (e.g., repeated "### AVL Trees")
- Deduplicate exact duplicate paragraphs in BOTH notes and summaries
- Reject summaries with high internal paragraph duplication ratio

NEW (abstraction):
- Reject/regenerate examples where summary is too extractive:
  - 4-gram overlap(note, summary) > --max_extractive_overlap (default 0.75)

NEW (faithfulness):
- Cheap keyword faithfulness check: most "content words" in summary should appear in note
  - ratio >= --min_keyword_faithfulness (default 0.65)

NEW (quality recovery):
- Optional "refine pass": if summary fails quality checks, ask Ollama to revise it
  - enabled by default; can be disabled with --no_refine

Keeps your existing:
- mixed structure constraints (headings, bullets, numbered list, definitions markers)
- LaTeX sanity checks
- min paragraphs, heading presence, anti-template checks
"""

import argparse
import json
import os
import random
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple, List

import requests


# ----------------------------
# Optional better token counting (if transformers is available)
# ----------------------------
def try_load_tokenizer(name: Optional[str]):
    if not name:
        return None
    try:
        from transformers import AutoTokenizer
        return AutoTokenizer.from_pretrained(name)
    except Exception:
        return None


def estimate_tokens(text: str, tokenizer=None) -> int:
    if tokenizer is not None:
        return len(tokenizer.encode(text))
    return max(1, len(text) // 4)


# ----------------------------
# Ollama client
# ----------------------------
@dataclass
class OllamaClient:
    base_url: str
    model: str
    timeout_s: int = 180

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        num_predict: int = 800,
        seed: Optional[int] = None,
    ) -> str:
        url = f"{self.base_url.rstrip('/')}/api/generate"
        payload: Dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": num_predict,
            },
        }
        if system:
            payload["system"] = system
        if seed is not None:
            payload["options"]["seed"] = seed

        r = requests.post(url, json=payload, timeout=self.timeout_s)
        r.raise_for_status()
        data = r.json()
        return data.get("response", "").strip()


# ----------------------------
# Content recipes
# ----------------------------
TOPICS = [
    "Data Structures: stacks, queues, linked lists, hash tables",
    "Trees: BST, AVL rotations, heaps, traversal",
    "Graph algorithms: BFS, DFS, Dijkstra, MST",
    "Discrete mathematics: induction, sets, relations, combinatorics",
    "Linear algebra: vector spaces, eigenvalues, projections",
    "Calculus: limits, derivatives, Taylor series",
    "Probability: Bayes, distributions, expectation, variance",
    "Machine learning: gradient descent, regularization, bias-variance",
    "Signals: Fourier series, convolution, sampling",
    "Algorithms: complexity, sorting, dynamic programming",
    "Operating systems: scheduling, paging, deadlocks",
    "Databases: normalization, indexing, transactions",
]

NOTE_STYLES = [
    "lecture notes",
    "revision notes",
    "tutorial handout",
    "whiteboard-style scratch notes cleaned up",
    "study guide with definitions and worked examples",
]

STRUCTURE_REQUIREMENTS = [
    "Use at least 4 headings (Markdown #, ##, ###).",
    "Include at least 2 bullet lists and at least 1 numbered list.",
    "Include a 'Definitions' section with 4–8 formal definitions.",
    "Include an 'Examples' section with 2–4 worked examples.",
    "Include at least 3 math formulas in LaTeX, mixing inline $...$ and display $$...$$.",
    "Where appropriate, include one short proof (e.g., by induction) using clear steps.",
]

SUMMARY_REQUIREMENTS = [
    "Write a multi-paragraph summary (at least 2 paragraphs).",
    "Include headings in the summary (Markdown #/##) to mirror structure.",
    "Include LaTeX math in the summary *only where it naturally fits*, reusing key formulas from the notes when helpful.",
    "Avoid generic templates like 'This section explains...' — be specific and content-rich.",
    "Mention key definitions, key algorithms/steps, and at least one example outcome.",
]

ANTI_TEMPLATE = (
    "Do NOT start every paragraph the same way. "
    "Do NOT use boilerplate like 'This section explains' or 'The section provides'. "
    "Be concrete: name the concepts, operations, invariants, or theorems."
)


def build_note_prompt(topic: str, style: str, size_hint: str) -> str:
    reqs = random.sample(STRUCTURE_REQUIREMENTS, k=random.randint(4, 6))
    req_block = "\n".join(f"- {r}" for r in reqs)

    size_guidance = {
        "small": "Aim for ~600–1200 words.",
        "medium": "Aim for ~1200–2500 words.",
        "large": "Aim for ~2500–4500 words.",
        "xlarge": "Aim for ~4500–8000 words (still coherent).",
    }.get(size_hint, "Aim for ~1200–2500 words.")

    return f"""You are generating {style} in Markdown that includes LaTeX math.

Topic: {topic}

Hard requirements:
{req_block}

Additional guidance:
- Mixed structure: prose + definitions + lists + math + examples.
- Use correct LaTeX delimiters. Avoid broken environments.
- Keep it coherent and like real course notes, not a generic article.
- {size_guidance}

Output ONLY the note content. No preface, no commentary.
"""


def build_summary_prompt(note_text: str) -> str:
    reqs = "\n".join(f"- {r}" for r in SUMMARY_REQUIREMENTS)
    return f"""Summarize the following notes. The summary must be longer than one paragraph and preserve key technical details.

Requirements:
{reqs}
- {ANTI_TEMPLATE}

NOTES TO SUMMARIZE (Markdown + LaTeX):
---BEGIN NOTES---
{note_text}
---END NOTES---

Output ONLY the summary content. No preface, no commentary.
"""


def build_refine_prompt(note_text: str, draft_summary: str) -> str:
    return f"""You are given NOTES and a DRAFT SUMMARY.

Revise the summary to improve quality:

1) Remove or rewrite statements not clearly supported by the NOTES.
2) Fix contradictions and incorrect definitions.
3) Reduce repetition (do not repeat headings/paragraphs).
4) Keep it multi-paragraph and structured with headings.
5) Preserve LaTeX and keep it valid. Do not invent new formulas.

NOTES:
---BEGIN---
{note_text}
---END---

DRAFT SUMMARY:
---BEGIN---
{draft_summary}
---END---

Output ONLY the revised summary. No preface, no commentary.
"""


# ----------------------------
# Quality checks (existing + new)
# ----------------------------
HEADING_RE = re.compile(r"^#{1,6}\s+.+$", re.MULTILINE)
DISPLAY_MATH_RE = re.compile(r"\$\$.*?\$\$", re.DOTALL)
INLINE_MATH_RE = re.compile(r"(?<!\$)\$(?!\$).*?(?<!\$)\$(?!\$)", re.DOTALL)
BULLET_RE = re.compile(r"^\s*[-*]\s+", re.MULTILINE)
NUMBERED_RE = re.compile(r"^\s*\d+\.\s+", re.MULTILINE)
DEFINITION_RE = re.compile(r"(?im)^\s*(?:\*\*Definition\*\*|Definition\s*[:\-]|###\s*Definitions|##\s*Definitions)")


def count_paragraphs(text: str) -> int:
    parts = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    return len(parts)


def is_too_templatey(summary: str) -> bool:
    s = summary.lower()
    bad_phrases = [
        "this section explains",
        "this section provides",
        "the section also provides",
        "in this section we",
        "this section discusses",
    ]
    return any(bp in s for bp in bad_phrases)


def latex_sanity_ok(text: str) -> bool:
    if text.count("$$") % 2 != 0:
        return False

    tmp = text.replace("$$", "")
    if tmp.count("$") % 2 != 0:
        return False

    begins = re.findall(r"\\begin\{([^\}]+)\}", text)
    ends = re.findall(r"\\end\{([^\}]+)\}", text)
    return sorted(begins) == sorted(ends)


def validate_note(note: str, min_headings: int = 3, min_bullets: int = 1, min_math: int = 2) -> Tuple[bool, str]:
    if len(HEADING_RE.findall(note)) < min_headings:
        return False, "not enough headings"
    if len(BULLET_RE.findall(note)) < min_bullets:
        return False, "not enough bullets"
    if len(NUMBERED_RE.findall(note)) < 1:
        return False, "no numbered list"
    math_count = len(DISPLAY_MATH_RE.findall(note)) + len(INLINE_MATH_RE.findall(note))
    if math_count < min_math:
        return False, "not enough math"
    if not DEFINITION_RE.search(note):
        return False, "no definitions section/markers"
    if not latex_sanity_ok(note):
        return False, "latex sanity failed"
    return True, "ok"


def validate_summary(summary: str, min_paragraphs: int = 2, require_heading: bool = True) -> Tuple[bool, str]:
    if count_paragraphs(summary) < min_paragraphs:
        return False, "summary too short (paragraphs)"
    if require_heading and len(HEADING_RE.findall(summary)) < 1:
        return False, "summary missing headings"
    if is_too_templatey(summary):
        return False, "summary too templatey"
    if not latex_sanity_ok(summary):
        return False, "summary latex sanity failed"
    has_math = (len(DISPLAY_MATH_RE.findall(summary)) + len(INLINE_MATH_RE.findall(summary))) > 0
    if not has_math and len(summary) < 900:
        return False, "summary lacks math and is short"
    return True, "ok"


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


# -------- NEW: dedupe + extractive/fidelity metrics --------
def dedupe_consecutive_headings(text: str) -> str:
    lines = text.splitlines()
    out = []
    prev_heading = None
    for ln in lines:
        s = ln.strip()
        if re.match(r"^#{1,6}\s+", s):
            if s == prev_heading:
                continue
            prev_heading = s
        out.append(ln)
    return "\n".join(out)


def dedupe_paragraphs(text: str) -> str:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    seen = set()
    out = []
    for p in paras:
        key = re.sub(r"\s+", " ", p)
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return "\n\n".join(out)


def paragraph_dup_ratio(text: str) -> float:
    paras = [re.sub(r"\s+", " ", p.strip()) for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    if not paras:
        return 0.0
    from collections import Counter
    c = Counter(paras)
    dups = sum(v - 1 for v in c.values() if v > 1)
    return dups / len(paras)


def ngram_set(text: str, n: int) -> set:
    toks = re.findall(r"\w+|\$+|\\[a-zA-Z]+|[^\s\w]", text.lower())
    return set(tuple(toks[i:i + n]) for i in range(max(0, len(toks) - n + 1)))


def extractive_overlap(note: str, summ: str, n: int = 4) -> float:
    a = ngram_set(note, n)
    b = ngram_set(summ, n)
    return 0.0 if not b else (len(a & b) / len(b))


_STOP = {
    "which", "their", "there", "these", "those", "about", "because", "would", "should", "could",
    "where", "while", "also", "into", "from", "that", "this", "have", "with", "will", "they",
    "them", "were", "been", "being", "than", "then", "when", "what", "your", "such"
}


def keyword_set(text: str) -> set:
    words = re.findall(r"[A-Za-z]{5,}", text.lower())
    return {w for w in words if w not in _STOP}


def keyword_faithfulness_ratio(note: str, summ: str) -> float:
    ks = keyword_set(summ)
    if len(ks) < 10:
        return 1.0
    note_l = note.lower()
    return sum(1 for w in ks if w in note_l) / len(ks)


# ----------------------------
# Generation loop
# ----------------------------
def pick_size_hint() -> str:
    r = random.random()
    if r < 0.15:
        return "small"
    if r < 0.45:
        return "medium"
    if r < 0.80:
        return "large"
    return "xlarge"


def clamp_text_to_budget(text: str, max_chars: Optional[int], max_tokens: Optional[int], tokenizer=None) -> str:
    if max_chars is not None and len(text) > max_chars:
        text = text[:max_chars]

    if max_tokens is not None:
        while estimate_tokens(text, tokenizer=tokenizer) > max_tokens and len(text) > 1000:
            text = text[: int(len(text) * 0.9)]
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--base_url", default="http://localhost:11434")
    ap.add_argument("--out", required=True)
    ap.add_argument("--n", type=int, default=1000)

    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--temperature_note", type=float, default=0.8)
    ap.add_argument("--temperature_summary", type=float, default=0.6)
    ap.add_argument("--top_p", type=float, default=0.9)

    ap.add_argument("--max_note_chars", type=int, default=24000)
    ap.add_argument("--max_note_tokens", type=int, default=0)
    ap.add_argument("--tokenizer_name", default="")

    ap.add_argument("--min_summary_paragraphs", type=int, default=2)
    ap.add_argument("--max_retries", type=int, default=6)
    ap.add_argument("--sleep_s", type=float, default=0.2)

    ap.add_argument("--note_num_predict", type=int, default=2600)
    ap.add_argument("--summary_num_predict", type=int, default=1200)

    # NEW quality knobs
    ap.add_argument("--max_extractive_overlap", type=float, default=0.75,
                    help="Reject examples where summary is too close to the note (4-gram overlap).")
    ap.add_argument("--max_summary_dup_ratio", type=float, default=0.10,
                    help="Reject summaries with too much exact paragraph repetition.")
    ap.add_argument("--min_keyword_faithfulness", type=float, default=0.65,
                    help="Reject summaries whose content-words aren't mostly present in the note.")
    ap.add_argument("--refine_retries", type=int, default=2,
                    help="How many refinement attempts to repair a failing summary.")
    ap.add_argument("--no_refine", action="store_true", help="Disable refinement pass.")

    args = ap.parse_args()

    random.seed(args.seed)

    tokenizer = try_load_tokenizer(args.tokenizer_name) if args.tokenizer_name else None
    max_note_tokens = args.max_note_tokens if args.max_note_tokens and args.max_note_tokens > 0 else None

    client = OllamaClient(base_url=args.base_url, model=args.model)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)

    wrote = 0
    with open(args.out, "w", encoding="utf-8") as f:
        idx = 0
        while wrote < args.n:
            ex_id = str(uuid.uuid4())

            topic = random.choice(TOPICS)
            style = random.choice(NOTE_STYLES)
            size_hint = pick_size_hint()

            # ---- Generate note ----
            note = ""
            note_ok = False
            note_reason = ""
            for attempt in range(args.max_retries):
                seed = args.seed + idx * 100 + attempt
                note_prompt = build_note_prompt(topic, style, size_hint)

                note = client.generate(
                    prompt=note_prompt,
                    system="You are a careful technical writer. Output must be valid Markdown and LaTeX.",
                    temperature=args.temperature_note,
                    top_p=args.top_p,
                    num_predict=args.note_num_predict,
                    seed=seed,
                ).strip()

                # NEW: clean repetition
                note = dedupe_consecutive_headings(note)
                note = dedupe_paragraphs(note)

                ok, reason = validate_note(note)
                note_ok, note_reason = ok, reason
                if note_ok:
                    break
                time.sleep(args.sleep_s)

            if not note_ok:
                idx += 1
                continue

            # ---- Prepare note for summary prompt (budget control) ----
            note_for_summary = clamp_text_to_budget(note, args.max_note_chars, max_note_tokens, tokenizer=tokenizer)
            note_for_summary = add_structure_markers(note_for_summary)

            # ---- Generate summary ----
            summary = ""
            summ_ok = False
            summ_reason = ""

            def summary_pass(prompt: str, seed: int, temp: float) -> str:
                s = client.generate(
                    prompt=prompt,
                    system="You are a precise summarizer. Preserve structure. Keep LaTeX valid. Avoid repetition.",
                    temperature=temp,
                    top_p=args.top_p,
                    num_predict=args.summary_num_predict,
                    seed=seed,
                ).strip()
                s = dedupe_consecutive_headings(s)
                s = dedupe_paragraphs(s)
                return s

            for attempt in range(args.max_retries):
                seed = args.seed + idx * 1000 + attempt
                summary_prompt = build_summary_prompt(note_for_summary)
                summary = summary_pass(summary_prompt, seed, args.temperature_summary)

                ok, reason = validate_summary(summary, min_paragraphs=args.min_summary_paragraphs)
                if not ok:
                    summ_ok, summ_reason = False, reason
                    time.sleep(args.sleep_s)
                    continue

                # NEW: enforce abstraction + coherence + cheap faithfulness
                ov = extractive_overlap(note, summary, n=4)
                dup = paragraph_dup_ratio(summary)
                kw = keyword_faithfulness_ratio(note, summary)

                if ov <= args.max_extractive_overlap and dup <= args.max_summary_dup_ratio and kw >= args.min_keyword_faithfulness:
                    summ_ok, summ_reason = True, "ok"
                    break

                # Try refinement pass to repair instead of discarding
                if not args.no_refine and args.refine_retries > 0:
                    refined = summary
                    for rtry in range(args.refine_retries):
                        rseed = args.seed + idx * 5000 + attempt * 10 + rtry
                        refine_prompt = build_refine_prompt(note_for_summary, refined)
                        refined = summary_pass(refine_prompt, rseed, temp=0.3)  # lower temp for edits

                        ok2, _ = validate_summary(refined, min_paragraphs=args.min_summary_paragraphs)
                        ov2 = extractive_overlap(note, refined, n=4)
                        dup2 = paragraph_dup_ratio(refined)
                        kw2 = keyword_faithfulness_ratio(note, refined)

                        if ok2 and ov2 <= args.max_extractive_overlap and dup2 <= args.max_summary_dup_ratio and kw2 >= args.min_keyword_faithfulness:
                            summary = refined
                            summ_ok, summ_reason = True, "ok_refined"
                            break
                    if summ_ok:
                        break

                summ_ok, summ_reason = False, f"quality_gate_failed(ov={ov:.2f},dup={dup:.2f},kw={kw:.2f})"
                time.sleep(args.sleep_s)

            if not summ_ok:
                idx += 1
                continue

            rec = {"id": ex_id, "note": note, "summary": summary}
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()

            wrote += 1
            idx += 1
            if wrote % 25 == 0:
                print(f"[{wrote}/{args.n}] wrote id={ex_id} (size_hint={size_hint}, {summ_reason})")

    print(f"Done. Wrote {wrote} examples to: {args.out}")


if __name__ == "__main__":
    main()
