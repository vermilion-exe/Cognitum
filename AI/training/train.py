#!/usr/bin/env python3
"""
train_summarizer_lightning_simple.py

What this implements / changes vs a typical "simple LED trainer":
1) FIX: Dynamic padding (no padding="max_length") to avoid wasting compute.
2) FIX: Protect LaTeX/math by replacing math spans with placeholders <MATH_0000>...
3) ADD: Structure markers (<H>, <BULLET>) so the model learns note structure.
4) IMPROVE: Better global attention mask:
   - token 0 always global
   - headings (<H>) global
   - bullets (<BULLET>) global
   - math placeholders (<MATH_####>) global
5) SAFETY: Cache key includes model+lengths to prevent stale processed dataset reuse.

Expected JSONL dataset format (train/val):
Each line: {"note": "...", "summary": "..."}.

Usage example:
python train_summarizer_lightning_simple.py \
  --train_file data/train.jsonl \
  --val_file data/val.jsonl \
  --output_dir out_led \
  --model_name allenai/led-base-16384 \
  --max_input_len 4096 \
  --max_target_len 512 \
  --batch_size 1 \
  --grad_accum 8 \
  --pad_to_multiple_of 8
"""

import argparse
import os
import re
from dataclasses import dataclass
from typing import Dict, List, Tuple, Any, Optional
import math

import torch
import pytorch_lightning as pl
from torch.utils.data import DataLoader
from collections import Counter

from datasets import load_dataset

from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    DataCollatorForSeq2Seq,
    get_linear_schedule_with_warmup,
)

# ----------------------------
# LaTeX/math protection
# ----------------------------

# NOTE: Ordered patterns matter; we prefer longer blocks first.
MATH_PATTERNS = [
    r"\$\$.*?\$\$",                 # $$ ... $$
    r"\\\[.*?\\\]",                 # \[ ... \]
    r"\\\(.*?\\\)",                 # \( ... \)
    r"\\begin\{.*?\}.*?\\end\{.*?\}",# \begin{...} ... \end{...}
    r"\$.*?\$",                      # $ ... $
]

_MATH_RE = re.compile("|".join(f"({p})" for p in MATH_PATTERNS), flags=re.DOTALL)

def protect_math_spans(text: str, max_placeholders: int) -> Tuple[str, List[str]]:
    """
    Replace math spans with placeholder tokens <MATH_0000>, <MATH_0001>, ...
    Returns (protected_text, spans_list).
    """
    spans: List[str] = []

    def _repl(m: re.Match) -> str:
        if len(spans) >= max_placeholders:
            return m.group(0)
        token = f"<MATH_{len(spans):04d}>"
        spans.append(m.group(0))
        return token

    protected = _MATH_RE.sub(_repl, text)
    return protected, spans

def add_structure_markers(text: str) -> str:
    """
    Add explicit marker tokens for headings and bullet lines (markdown-ish).
    """
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

def ngram_set(text: str, n: int) -> set:
    toks = re.findall(r"\w+|\$+|\\[a-zA-Z]+|[^\s\w]", text.lower())
    return set(tuple(toks[i:i+n]) for i in range(0, max(0, len(toks)-n+1)))

def extractive_overlap(note: str, summ: str, n: int = 4) -> float:
    a = ngram_set(note, n)
    b = ngram_set(summ, n)
    if not b:
        return 0.0
    return len(a & b) / len(b)

# ----------------------------
# Collator with LED global attention
# ----------------------------

@dataclass
class LEDSeq2SeqCollator:
    """
    Wrap DataCollatorForSeq2Seq, then add global_attention_mask for LED-style models.
    """
    tokenizer: Any
    base_collator: DataCollatorForSeq2Seq
    global_token_ids: List[int]

    def __call__(self, features: List[Dict[str, Any]]) -> Dict[str, torch.Tensor]:
        batch = self.base_collator(features)

        input_ids = batch["input_ids"]
        # Default: no global attention
        global_attention_mask = torch.zeros_like(input_ids, dtype=torch.long)
        # Always attend globally to the first token
        global_attention_mask[:, 0] = 1

        # Global attention for selected marker token IDs (headings/bullets/math placeholders)
        for tid in self.global_token_ids:
            global_attention_mask |= (input_ids == tid).long()

        batch["global_attention_mask"] = global_attention_mask
        return batch

# ----------------------------
# Lightning Module
# ----------------------------

class LEDLightningModule(pl.LightningModule):
    def __init__(
        self,
        model_name: str,
        tokenizer: Any,
        lr: float,
        warmup_steps: int,
        total_steps: int,
        weight_decay: float,
    ):
        super().__init__()
        self.save_hyperparameters(ignore=["tokenizer"])
        self.tokenizer = tokenizer
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

        # IMPORTANT: resize embeddings because we add special tokens
        self.model.resize_token_embeddings(len(self.tokenizer))

        self.lr = lr
        self.warmup_steps = warmup_steps
        self.total_steps = total_steps
        self.weight_decay = weight_decay

    def training_step(self, batch: Dict[str, torch.Tensor], batch_idx: int):
        out = self.model(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"],
            global_attention_mask=batch["global_attention_mask"],
            labels=batch["labels"],
        )
        self.log("train_loss", out.loss, prog_bar=True, on_step=True, on_epoch=True)
        return out.loss

    def validation_step(self, batch: Dict[str, torch.Tensor], batch_idx: int):
        out = self.model(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"],
            global_attention_mask=batch["global_attention_mask"],
            labels=batch["labels"],
        )
        self.log("val_loss", out.loss, prog_bar=True, on_step=False, on_epoch=True)
        return out.loss

    def configure_optimizers(self):
        # Weight decay on everything except bias/LayerNorm
        no_decay = ["bias", "LayerNorm.weight", "layer_norm.weight"]
        params = [
            {
                "params": [p for n, p in self.model.named_parameters() if not any(nd in n for nd in no_decay)],
                "weight_decay": self.weight_decay,
            },
            {
                "params": [p for n, p in self.model.named_parameters() if any(nd in n for nd in no_decay)],
                "weight_decay": 0.0,
            },
        ]
        opt = torch.optim.AdamW(params, lr=self.lr)

        sched = get_linear_schedule_with_warmup(
            opt, num_warmup_steps=self.warmup_steps, num_training_steps=self.total_steps
        )
        return {
            "optimizer": opt,
            "lr_scheduler": {"scheduler": sched, "interval": "step"},
        }

# ----------------------------
# Main
# ----------------------------

def build_cache_key(model_name: str, max_in: int, max_out: int, num_math: int) -> str:
    safe_model = model_name.replace("/", "_")
    return f"cache_{safe_model}_in{max_in}_out{max_out}_m{num_math}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train_file", required=True, help="Path to train.jsonl")
    ap.add_argument("--val_file", required=True, help="Path to val.jsonl")
    ap.add_argument("--output_dir", required=True)

    ap.add_argument("--model_name", default="allenai/led-base-16384")
    ap.add_argument("--max_input_len", type=int, default=4096)
    ap.add_argument("--max_target_len", type=int, default=512)

    ap.add_argument("--batch_size", type=int, default=1)
    ap.add_argument("--grad_accum", type=int, default=8)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--weight_decay", type=float, default=0.01)
    ap.add_argument("--warmup_ratio", type=float, default=0.03)

    ap.add_argument("--num_math_placeholders", type=int, default=512)
    ap.add_argument("--pad_to_multiple_of", type=int, default=8, help="Set 0 to disable (dynamic padding only).")

    ap.add_argument("--precision", default="16-mixed", choices=["16-mixed", "32-true"])
    ap.add_argument("--devices", default="auto")
    ap.add_argument("--accelerator", default="auto")

    args = ap.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.model_name)

    # Add special tokens for structure + math placeholders
    extra_tokens = ["<H>", "<BULLET>"] + [f"<MATH_{i:04d}>" for i in range(args.num_math_placeholders)]
    tokenizer.add_special_tokens({"additional_special_tokens": extra_tokens})

    # Determine which token IDs should get global attention
    global_token_ids = []
    for t in ["<H>", "<BULLET>"]:
        global_token_ids.append(tokenizer.convert_tokens_to_ids(t))
    # math placeholder IDs
    for i in range(args.num_math_placeholders):
        global_token_ids.append(tokenizer.convert_tokens_to_ids(f"<MATH_{i:04d}>"))

    # Load datasets
    ds = load_dataset("json", data_files={"train": args.train_file, "validation": args.val_file})

    def keep_example(ex):
        note = ex["note"]
        summ = ex["summary"]
        return extractive_overlap(note, summ, n=4) < 0.70

    ds["train"] = ds["train"].filter(keep_example)
    ds["validation"] = ds["validation"].filter(keep_example)

    # Preprocess with NO padding here (dynamic padding in collator)
    def preprocess(ex: Dict[str, Any]) -> Dict[str, Any]:
        note = ex["note"]
        summ = ex["summary"]

        note_protected, _ = protect_math_spans(note, args.num_math_placeholders)
        summ_protected, _ = protect_math_spans(summ, args.num_math_placeholders)

        note_structured = add_structure_markers(note_protected)

        model_in = tokenizer(
            note_structured,
            truncation=True,
            max_length=args.max_input_len,
            padding=False,  # IMPORTANT: dynamic padding later
        )

        labels = tokenizer(
            text_target=summ_protected,
            truncation=True,
            max_length=args.max_target_len,
            padding=False,
        )
        model_in["labels"] = labels["input_ids"]
        return model_in

    cache_dir = os.path.join(args.output_dir, build_cache_key(
        args.model_name, args.max_input_len, args.max_target_len, args.num_math_placeholders
    ))

    ds = ds.map(
        preprocess,
        remove_columns=ds["train"].column_names,
        load_from_cache_file=True,
        cache_file_names={
            "train": os.path.join(cache_dir, "train.arrow"),
            "validation": os.path.join(cache_dir, "validation.arrow"),
        },
    )

    num_train = len(ds["train"])
    steps_per_epoch = math.ceil(num_train / args.batch_size)
    steps_per_epoch = math.ceil(steps_per_epoch / args.grad_accum)

    total_steps = steps_per_epoch * args.epochs
    warmup_steps = int(total_steps * args.warmup_ratio)

    module = LEDLightningModule(
        model_name=args.model_name,
        tokenizer=tokenizer,
        lr=args.lr,
        warmup_steps=warmup_steps,
        total_steps=total_steps,
        weight_decay=args.weight_decay,
    )

    base_collator = DataCollatorForSeq2Seq(
        tokenizer=tokenizer,
        model=module.model,  # <-- fixed
        padding="longest",
        label_pad_token_id=-100,
        pad_to_multiple_of=(args.pad_to_multiple_of or None),
        return_tensors="pt",
    )

    collator = LEDSeq2SeqCollator(
        tokenizer=tokenizer,
        base_collator=base_collator,
        global_token_ids=global_token_ids,
    )

    train_loader = DataLoader(ds["train"], batch_size=args.batch_size, shuffle=True, collate_fn=collator)
    val_loader = DataLoader(ds["validation"], batch_size=args.batch_size, shuffle=False, collate_fn=collator)

    ckpt_dir = os.path.join(args.output_dir, "checkpoints")
    os.makedirs(ckpt_dir, exist_ok=True)

    # Save tokenizer config into output_dir so inference can load it
    tokenizer.save_pretrained(args.output_dir)

    trainer = pl.Trainer(
        default_root_dir=args.output_dir,
        max_epochs=args.epochs,
        accelerator=args.accelerator,
        devices=args.devices,
        precision=args.precision,
        accumulate_grad_batches=args.grad_accum,
        gradient_clip_val=1.0,
        log_every_n_steps=10,
        enable_checkpointing=True,
        callbacks=[
            pl.callbacks.ModelCheckpoint(
                dirpath=ckpt_dir,
                save_top_k=2,
                monitor="val_loss",
                mode="min",
                filename="led-{epoch:02d}-{val_loss:.4f}",
            )
        ],
    )

    trainer.fit(module, train_loader, val_loader)

    # Save final model (Lightning saves checkpoints; also export HuggingFace model)
    final_dir = os.path.join(args.output_dir, "final_model")
    os.makedirs(final_dir, exist_ok=True)
    module.model.save_pretrained(final_dir)
    tokenizer.save_pretrained(final_dir)
    print(f"Saved final model to: {final_dir}")

if __name__ == "__main__":
    main()
