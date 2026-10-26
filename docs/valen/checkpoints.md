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

Use the existing [export tool](https://github.com/Valen-Team/Valen/blob/main/scripts/export/qwen/merge_checkpoint.py). It requires completed-epoch records and a verified base manifest; a short smoke does not satisfy the release pipeline. Check native predictions after export, then deploy through [ONNX](./onnx.md) or [GGUF](./gguf.md).
