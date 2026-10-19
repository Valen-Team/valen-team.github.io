---
title: "Evaluation"
sidebar_label: "Evaluation"
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

`output_tokens` is always 0. `input_tokens` counts the shared state once, while `compute_tokens` includes the state repeated in every branch; see the [architecture notes](/docs/valen/architecture/#shared-context-and-compute) for how they are computed.

## Answer fields for the three types

Let `p = softmax(logits / temperature)`, with K candidates and grade indices starting at 0. The implementation is in [answer](https://github.com/Valen-Team/Valen/blob/main/valen/evaluation/inference.py).

| Type | Fields |
| --- | --- |
| Choice | `type`, `choice` (name of the highest-probability candidate), `probabilities` (candidate name → probability), `confidence` |
| Noul | `type`, `noul` (probability of `true`); no separate `probabilities` or `confidence` |
| Score | `type`, `score` (`sum(i * p[i])`), `probabilities` (grade index as a string → probability), `legend` (index → description), `confidence` |

Choice `confidence` rescales the maximum probability against the uniform baseline:

```text
K = 1: confidence = 1
K > 1: confidence = max(0, (max(p) - 1/K) / (1 - 1/K))
```

Score uses the mean absolute distance from the mode:

```text
mode = argmax(p)
distance = sum(p[i] * abs(i - mode))
uniform_mad = sum(abs(i - (K-1)/2)) / K
confidence = max(0, 1 - distance / uniform_mad)
```

Ties for the maximum go to the first candidate in the current order. Score's `score` is the expected value, not the mode, and is not rescaled to 0–1. For example, `[0.1, 0.3, 0.6]` gives `score=1.5` and `confidence=0.25`. `confidence` describes how concentrated the distribution is.

### Temperature

Inference supports `--calibration path/to/calibration.json`, where the file has the form `{"temperature": 1.0}`.

**The evaluation CLI has no `--calibration` argument and always uses temperature 1.**

## Evaluation commands and outputs

```bash
# The synthetic set only checks the pipeline; use a held-out test set for real evaluation.
python -m valen.evaluate \
  --checkpoint output/sft_warmup/latest \
  --data data/smoke/train.jsonl \
  --output output/sft_warmup/smoke_eval

# Split the same data across four processes by record, without padding with duplicate samples.
python -m torch.distributed.run --standalone --nnodes=1 --nproc_per_node=4 \
  -m valen.evaluate \
  --checkpoint output/sft_warmup/latest \
  --data data/smoke/train.jsonl \
  --output output/sft_warmup/smoke_eval_4gpu
```

Here `--output` is a directory, which is created automatically. The outputs are:

| File | Contents |
| --- | --- |
| `predictions.rank<N>.jsonl` | Per-question results of the current rank; a single process also produces `rank0` |
| `predictions.jsonl` | Results merged by rank 0, sorted by `record_index`, `qid` |
| `metrics.json` | Metrics, data and checkpoint provenance, counts, per-GPU timings and latency percentiles |

Each per-question record contains `record_index`, `record_id`, `group_id`, `qid`, task and grouping information, the label distribution, the predicted distribution, the structured answer, metrics and timings. Before merging, the program checks that every labeled question was processed exactly once. All processes in a multi-GPU run must be able to access the same output directory; reusing a directory overwrites artifacts with the same names.

Evaluation data needs at least one validly labeled question. Use the inference command for fully unlabeled data; the current evaluation implementation fails when computing percentiles over an empty set of latencies.

## Metric definitions

Let y be the label distribution and p the predicted distribution. The implementation is in [question_metrics / summarize](https://github.com/Valen-Team/Valen/blob/main/valen/evaluation/metrics.py).

| Metric | Applies to | Definition |
| --- | --- | --- |
| `nll` | All labeled questions | `-sum(y[k] * log(p[k]))`, using the natural log |
| `brier` | All labeled questions | `sum((p[k] - y[k])²)`, not divided by the number of candidates |
| `accuracy` | Strict one-hot labels | 1 when the predicted argmax equals the label argmax; Score is also judged on discrete grades |
| `expected_score_mae` | Score, including soft labels | `abs(sum(k*p[k]) - sum(k*y[k]))` |
| `rps` | Score, including soft labels | Mean of the squared differences between the first K−1 cumulative distributions |
| `macro_f1` | Noul hard labels | Arithmetic mean of the true and false F1 scores; a class's F1 is 0 when its denominator is 0 |

Aggregates are **equal-weight averages over questions**. `metric_counts` gives the number of valid questions for each metric; soft labels do not count toward accuracy, so its denominator usually differs from `questions`. The Noul confusion matrix and `macro_f1` only appear in the `task/noul` and `task_modality/noul/*` groups.

Group keys include `overall`, `task/*`, `modality/*`, `task_modality/*/*`, `language/*` and `domain/*`. Modality comes from `meta.modality` when present; otherwise there are only two categories, `text` and `media`, with no automatic distinction between images and video.

## Reading the timings

- `compile_seconds` is the compile time of the whole state; every question in that state records the same value.
- `forward_seconds` is the model forward time of all branches of the question, with CUDA synchronization before and after. It includes first-run overhead; there is no separate warmup.
- `compile_plus_forward_seconds` simply adds the two values above. It does not amortize the state compile cost across questions, and it does not include the full result serialization and disk-write path.
- `evaluation_wall_seconds` is the longest evaluation-loop time across GPUs; `load_and_evaluation_wall_seconds` also includes initialization and model loading.
- `questions_per_second` is the number of labeled questions divided by `evaluation_wall_seconds`.

Latency mean, p50 and p95 are computed over the per-question records. Because a state's compile time is counted once for each of its questions, summing per-question latencies does not give the time for the whole dataset.

---

Synchronized from [Valen / docs/evaluation.md](https://github.com/Valen-Team/Valen/blob/main/docs/evaluation.md) · Source blob `4bcf8c4` · 2026-10-19.
