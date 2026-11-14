---
title: Save, resume and export
---

# Save and resume

Training writes logs and configuration to the output directory and overwrites `latest/` on each checkpoint save. Copy the complete directory after saving finishes to retain a step. Frozen weights still depend on the original `model_path`.

```bash
python -m valen.train --config finetune.json --resume output/domain/run/latest
```

`--resume` restores optimizer, random state and data cursor; keep the process count, data and learning rates unchanged. Use `--initialize` to start a new experiment with different data or stages.

## Load

```bash
python -m valen.inference --checkpoint output/domain/run/latest \
  --data test.jsonl --output predictions.jsonl
```

## Export

A training checkpoint is not a standalone deployment model. Adapter exports need the matching base; complete exports merge adapters into it, while full SFT exports all trained weights.

Use the existing [export tool](https://github.com/Valen-Team/Valen/blob/main/scripts/export/qwen/merge_checkpoint.py). Export a checkpoint whose last step completes an epoch; the tool reads this from the `metrics.jsonl` that training writes next to `latest/`.

```bash
python scripts/export/qwen/merge_checkpoint.py \
  --checkpoint output/valen-finetune/lora/latest --output export/my-model --work export/work \
  --runtime-source . --validation-data /path/to/validation --attn-implementation sdpa
```

`--validation-data` is a folder with `general.jsonl` (image records covering Choice, Noul and Score) and `video.jsonl` (a first record with all three); the VisualDecisionBench `visualdecisionbench_image.jsonl` and `visualdecisionbench_video.jsonl` fit, with relative media paths resolved from the working directory. The tool records the base model by the hashes of its weight files, compares predictions before the merge, after it and after reloading, and writes `validation.json`. A fine-tuned Valen-Decision-1.5 model keeps its `bbox_blocks` attention and grounding head in the export. Check native predictions after export, then deploy through [ONNX](./onnx.md) or [GGUF](./gguf.md).
