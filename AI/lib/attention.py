"""Global attention mask helper for LED models."""

import torch
from transformers import AutoTokenizer


def make_global_attention_mask(
    input_ids: torch.Tensor,
    tokenizer: AutoTokenizer,
    num_math_placeholders: int,
) -> torch.Tensor:
    gm = torch.zeros_like(input_ids, dtype=torch.long)
    gm[:, 0] = 1

    for t in ["<H>", "<BULLET>"]:
        tid = tokenizer.convert_tokens_to_ids(t)
        if tid != tokenizer.unk_token_id:
            gm |= (input_ids == tid).long()

    for i in range(num_math_placeholders):
        tid = tokenizer.convert_tokens_to_ids(f"<MATH_{i:04d}>")
        if tid == tokenizer.unk_token_id:
            break
        gm |= (input_ids == tid).long()

    return gm