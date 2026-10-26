---
title: Training checkpoint inference
---

This page covers per-question inference and evaluation in the `valen` package. Full-game Sokoban evaluation uses the separate `evaluation.sokoban` command; see the [task evaluation guide](https://github.com/Valen-Team/Valen/blob/main/evaluation/sokoban/README.md) for data generation, policy comparison and trajectory replay.

Both inference and evaluation rebuild the model from the checkpoint's `config.json` and then load the parameters in `checkpoint.pt`. The base model must still be present at the configured `model_path`. The two commands produce different outputs: inference returns one response per record, while evaluation writes one line per labeled question.

## Inference command

Run from the repository root, in a terminal with the project environment activated:

```bash
mkdir -p output/predictions
python -m valen.inference \
  --checkpoint output/sft_warmup/latest \
  --data data/smoke/train.jsonl \
  --output output/predictions/smoke.jsonl
```

All three path arguments are required. `--output` is a file path, and an existing file is overwritten. `--device` defaults to `cuda` and accepts values such as `cuda:1`. This CLI runs single-process inference, with no per-rank sharding.

Inference processes every question, and the input may omit `targets`; `group_id` is still required. Output lines follow the input record order and do not carry `group_id` or `meta`; match them to the input by line order and by the question IDs in `answers`.

The response structure for a single Noul question is shown below. The probability and token counts only illustrate the fields; they are not measurements from a trained model.

```json
{
  "model": "Valen",
  "answers": {
    "go": {"type": "noul", "noul": 0.8}
  },
  "usage": {"input_tokens": 64, "output_tokens": 0},
  "internal_usage": {"compute_tokens": 64}
}
```

`output_tokens` is always 0. Shared-state counts the complete sequence once for both input_tokens and compute_tokens; question mode repeats state computation per branch. See [architecture](./architecture.md).


[Response fields](./api/systemone.md) · [probability semantics](./probabilities.md)
