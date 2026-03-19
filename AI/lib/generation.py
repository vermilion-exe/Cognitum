"""Core generation and hierarchical summarization logic."""

import re
from typing import Dict, List

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from lib.attention import make_global_attention_mask
from lib.structure import sliding_window_chunks


@torch.inference_mode()
def generate_summary(
    model: AutoModelForSeq2SeqLM,
    tokenizer: AutoTokenizer,
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
    global_attention_mask = make_global_attention_mask(
        input_ids, tokenizer, num_math_placeholders
    ).to(model.device)

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

    result = tokenizer.decode(out[0], skip_special_tokens=False).strip()
    result = result.replace("<s>", "").replace("</s>", "")
    result = result.replace("<pad>", "").strip()
    return result


def hierarchical_summarize(
    model: AutoModelForSeq2SeqLM,
    tokenizer: AutoTokenizer,
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
    gen_kwargs = dict(
        max_input_len=max_input_len,
        max_new_tokens=max_new_tokens,
        num_beams=num_beams,
        length_penalty=length_penalty,
        num_math_placeholders=num_math_placeholders,
        no_repeat_ngram_size=no_repeat_ngram_size,
        repetition_penalty=repetition_penalty,
        encoder_repetition_penalty=encoder_repetition_penalty,
        bad_words_ids=bad_words_ids,
    )

    token_ids = tokenizer.encode(text, add_special_tokens=False)
    if len(token_ids) <= max_input_len:
        return generate_summary(model, tokenizer, text, **gen_kwargs)

    chunks = sliding_window_chunks(
        token_ids, max_input_len, overlap_ratio
    )
    chunk_summaries = []
    for ch in chunks:
        ch_text = tokenizer.decode(ch, skip_special_tokens=False)
        chunk_summaries.append(
            generate_summary(model, tokenizer, ch_text, **gen_kwargs)
        )

    merged = "\n".join(chunk_summaries).strip()
    merged = _dedupe_paragraphs(merged)

    if not recursive:
        return merged

    prev = merged
    for _ in range(3):
        token_ids2 = tokenizer.encode(prev, add_special_tokens=False)
        if len(token_ids2) <= max_input_len:
            return generate_summary(
                model, tokenizer, prev, **gen_kwargs
            )
        new = hierarchical_summarize(
            model,
            tokenizer,
            prev,
            overlap_ratio=overlap_ratio,
            recursive=False,
            **gen_kwargs,
        )
        if new.strip() == prev.strip():
            break
        prev = new

    return prev


def _dedupe_paragraphs(text: str) -> str:
    seen: set[str] = set()
    out = []
    for p in re.split(r"\n\s*\n", text.strip()):
        k = re.sub(r"\s+", " ", p.strip())
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(p.strip())
    return "\n\n".join(out)