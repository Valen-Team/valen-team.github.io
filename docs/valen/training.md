---
title: Fine-tuning
---

# Fine-tune Valen on your data

Start with **complete Valen-0.8B and LoRA**. This keeps the trained Mixer and updates a small set of language adapters, the decision head and visual merger.

The [domain fine-tuning Cookbook](/cookbook/domain-finetuning/) provides a small licensed data template and runnable preparation, training, resume and before/after evaluation commands.

## Prepare your run

1. Split your data into train, validation and test by source or conversation. Keep duplicates and their rewrites in one split. See [data format](./data-format.md).
2. Copy `configs/train/qwen/sft_finetune_lora.json`. Set the cached complete model directory, training data and a new output directory. See [configuration](./configuration.md).
3. Train, then compare with the starting model on the same independent test. Use validation to choose settings and thresholds.

```bash
python -m valen.train --config finetune.json
```

Use full fine-tuning when you need to update the whole backbone and have the memory budget; start from `sft_finetune_full.json`. LoRA still loads the full frozen backbone—it is not 4-bit training.

## Training from a Qwen base

A Qwen base needs a new decision head: train Mixer warmup, then joint SFT. The [shared-state recipe](./qwen-shared-state.md) covers this path. These stages are supervised training, not language-model pretraining. RLCD remains experimental.

[Save, resume and export](./checkpoints.md)
