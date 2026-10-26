---
title: Training configuration
---

# Training configuration

Copy an existing recipe instead of starting from an empty JSON:

```bash
cp configs/train/qwen/sft_finetune_lora.json finetune.json
python -m valen.train --config finetune.json
```

Set these fields before running; paths are relative to your working directory.

| Field | Set it to |
| --- | --- |
| `model.model_path` | Cached complete Valen model directory |
| `data.path` | Your training JSONL |
| `training.output` | A new directory for this experiment |
| `training.epochs`, `max_steps` | Stop when either budget is reached |
| `training.tokens_per_step` | Token budget per GPU update; lower it to reduce memory |
| `data.max_length` | Maximum complete shared-state sequence length |

The complete model supplies the saved Mixer architecture, execution mode and media settings. Leave these unchanged when continuing a released model.

## Memory and learning rate

Start with the recipe's SDPA, BF16 and LoRA settings. `microbatch_size` limits simultaneous states; `microbatch_max_tokens` limits padded forward tokens. Reducing either can lower peak memory without changing the update token budget. A single state must still fit its sequence and update limits.

`head_lr`, `lora_lr` and `merger_lr` control their corresponding parameter groups. Full fine-tuning uses `language_lr` and `vision_lr` too. Choose changes on validation data, then keep the test set untouched.

For exact fields and values, use the source recipes: [LoRA](https://github.com/Valen-Team/Valen/blob/main/configs/train/qwen/sft_finetune_lora.json), [full](https://github.com/Valen-Team/Valen/blob/main/configs/train/qwen/sft_finetune_full.json), [Qwen-base stages](https://github.com/Valen-Team/Valen/tree/main/configs/train/qwen). [Resume rules](./checkpoints.md)

<a id="data-model-and-training-budget"></a>
<a id="qwen-shared-state-training"></a>
<a id="parallel-multi-qa-training-in-qwen"></a>
<a id="qwen-flashattention-2"></a>
<a id="trainable-parameters-and-optimizer"></a>
<a id="rlcd-parameters"></a>
<a id="setting-up-an-experiment-from-an-example"></a>
<a id="config-validation-and-resuming"></a>
