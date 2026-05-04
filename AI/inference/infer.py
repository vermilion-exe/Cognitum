#!/usr/bin/env python3
"""CLI inference — summarize a file from the command line."""

import argparse

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from lib.math_protection import (
    protect_math_spans,
    restore_math_spans,
    build_math_bad_words_ids,
    fix_balance_factor_formula,
)
from lib.structure import add_structure_markers, split_by_headings
from lib.generation import hierarchical_summarize


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model_dir", default="./models/final_model")
    ap.add_argument("--input_file", required=True)
    ap.add_argument("--max_input_len", type=int, default=4096)
    ap.add_argument("--overlap_ratio", type=float, default=0.15)
    ap.add_argument("--max_new_tokens", type=int, default=256)
    ap.add_argument("--num_beams", type=int, default=4)
    ap.add_argument("--length_penalty", type=float, default=1.2)
    ap.add_argument("--recursive", action="store_true")
    ap.add_argument("--no_repeat_ngram_size", type=int, default=4)
    ap.add_argument("--repetition_penalty", type=float, default=1.15)
    ap.add_argument(
        "--encoder_repetition_penalty", type=float, default=1.05
    )
    ap.add_argument("--num_math_placeholders", type=int, default=512)
    args = ap.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForSeq2SeqLM.from_pretrained(args.model_dir)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device).eval()

    raw = open(args.input_file, "r", encoding="utf-8").read()
    print(_summarize_text(raw, model, tokenizer, args))


def _summarize_text(raw: str, model, tokenizer, args) -> str:
    protected, mapping = protect_math_spans(
        raw, args.num_math_placeholders
    )
    math_bad_words_ids = build_math_bad_words_ids(
        tokenizer, mapping, args.num_math_placeholders
    )
    structured = add_structure_markers(protected)

    common_kwargs = dict(
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

    sections = split_by_headings(structured)
    if sections:
        outputs = []
        for heading, body in sections:
            if not body.strip():
                continue
            section_text = f"{heading}\n{body}"
            summ = hierarchical_summarize(
                model, tokenizer, section_text, **common_kwargs
            )
            outputs.append(summ.strip())
        merged_summary = "\n\n".join(outputs).strip()
    else:
        merged_summary = hierarchical_summarize(
            model, tokenizer, structured, **common_kwargs
        )

    final = restore_math_spans(merged_summary, mapping)
    final = fix_balance_factor_formula(final, mapping)
    return final


if __name__ == "__main__":
    main()