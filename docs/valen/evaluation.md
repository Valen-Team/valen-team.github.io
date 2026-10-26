---
title: Evaluation
---

# Evaluate on your data

Use the same independent test before and after fine-tuning. Keep candidates, order, temperature, media budgets and backend fixed. Select settings on validation before inspecting test results.

```bash
python -m valen.evaluate --checkpoint output/domain/run/latest \
  --data test.jsonl --output output/evaluation
```

Outputs are per-question predictions.jsonl and aggregate metrics.json. Report sample counts, failures and per-class results; training loss cannot replace test performance. See the complete [Cookbook comparison](/cookbook/domain-finetuning/).

## Metrics
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

See [probabilities and thresholds](./probabilities.md) and [backend measurements](/cookbook/validation/). The CLI uses T=1; exact timing and aggregation are defined in [evaluate.py](https://github.com/Valen-Team/Valen/blob/main/valen/evaluation/evaluate.py).

<a id="inference-command"></a>
<a id="answer-fields-for-the-three-types"></a>
<a id="temperature"></a>
<a id="evaluation-commands-and-outputs"></a>
<a id="reading-the-timings"></a>
<a id="metric-definitions"></a>

<a id="the-synthetic-set-only-checks-the-pipeline-use-a-held-out-test-set-for-real-evaluation"></a>
<a id="split-the-same-data-across-four-processes-by-record-without-padding-with-duplicate-samples"></a>
