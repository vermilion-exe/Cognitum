#!/usr/bin/env python3
"""LitServe API server for the summarizer model."""

import litserve as ls
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from lib.math_protection import (
    protect_math_spans,
    restore_math_spans,
    build_math_bad_words_ids,
    fix_balance_factor_formula,
)
from lib.structure import add_structure_markers, split_by_headings
from lib.generation import hierarchical_summarize

# Default generation parameters (override via request body)
DEFAULTS = {
    "max_input_len": 4096,
    "overlap_ratio": 0.15,
    "max_new_tokens": 256,
    "num_beams": 4,
    "length_penalty": 1.2,
    "recursive": True,
    "num_math_placeholders": 512,
    "no_repeat_ngram_size": 4,
    "repetition_penalty": 1.15,
    "encoder_repetition_penalty": 1.05,
}

MODEL_DIR = "C:\\Users\\Farhad\\Documents\\GitHub\\Cognitum\\AI\\models\\summ-allenai-led-base-16384\\final_model"

class SummarizerAPI(ls.LitAPI):
    def setup(self, device):
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_DIR)
        self.model.to(device).eval()
        self.device = device

    def decode_request(self, request: dict, **kwargs) -> dict:
        text = request["markdown"]
        # Allow clients to override generation params per request
        params = {}
        for key, default in DEFAULTS.items():
            params[key] = request.get(key, default)
        return {"text": text, "params": params}

    def predict(self, decoded: dict, **kwargs) -> str:
        text = decoded["text"]
        p = decoded["params"]

        # Protect math
        protected, mapping = protect_math_spans(
            text, p["num_math_placeholders"]
        )
        math_bad_words_ids = build_math_bad_words_ids(
            self.tokenizer, mapping, p["num_math_placeholders"]
        )

        # Add structure markers
        structured = add_structure_markers(protected)

        # Build common kwargs
        common_kwargs = dict(
            max_input_len=p["max_input_len"],
            overlap_ratio=p["overlap_ratio"],
            max_new_tokens=p["max_new_tokens"],
            num_beams=p["num_beams"],
            length_penalty=p["length_penalty"],
            recursive=p["recursive"],
            num_math_placeholders=p["num_math_placeholders"],
            no_repeat_ngram_size=p["no_repeat_ngram_size"],
            repetition_penalty=p["repetition_penalty"],
            encoder_repetition_penalty=p["encoder_repetition_penalty"],
            bad_words_ids=math_bad_words_ids,
        )

        # Section-based or hierarchical summarization
        sections = split_by_headings(structured)
        if sections:
            outputs = []
            for heading, body in sections:
                if not body.strip():
                    continue
                section_text = f"{heading}\n{body}"
                summ = hierarchical_summarize(
                    self.model,
                    self.tokenizer,
                    section_text,
                    **common_kwargs,
                )
                outputs.append(summ.strip())
            merged_summary = "\n\n".join(outputs).strip()
        else:
            merged_summary = hierarchical_summarize(
                self.model,
                self.tokenizer,
                structured,
                **common_kwargs,
            )

        # Restore math
        final = restore_math_spans(merged_summary, mapping)
        final = fix_balance_factor_formula(final, mapping)
        return final

    def encode_response(self, output: str, **kwargs) -> dict:
        return {"summary": output}


if __name__ == "__main__":
    server = ls.LitServer(
        SummarizerAPI(),
        accelerator="auto",
        devices="auto",
        timeout=120
    )
    server.run(port=8000)