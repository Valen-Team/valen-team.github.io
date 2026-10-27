---
title: "Use probabilities in applications"
---

# From probabilities to an application decision

**Choice** distributes probability over the supplied mutually exclusive candidates and selects the maximum. **Predicate / Noul** gives `P(true)` for one statement; separate predicates are not mutually exclusive. **Score** distributes probability over ordered grade descriptions and returns `sum(i*p[i])`, with zero-based indices. Labels do not create numeric business values: low/medium/high need not mean equally spaced cost. Use your own explicit utility mapping `sum(utility[i]*p[i])` when appropriate; validate that mapping separately.

Candidate membership, wording, descriptions, keys and order affect the problem. Shared-state also exposes other questions and their order to the causal backbone. Adding an “other” option can change all probabilities; it must be meaningfully defined and tested. A single-candidate Choice always has probability **1** and confidence **1**; it cannot demonstrate correctness or detect an out-of-set input. Use a predicate or a validated rejection mechanism instead.

## What confidence actually measures

Let K be the candidate count and `p=softmax(logits/T)`, with finite `T>0`. Ties select the first candidate in current order.

```text
Choice:
  K=1: confidence=1
  K>1: confidence=max(0, (max(p)-1/K)/(1-1/K))
Score:
  mode=argmax(p)
  distance=sum(p[i]*abs(i-mode))
  uniform_mad=sum(abs(i-(K-1)/2))/K
  confidence=max(0, 1-distance/uniform_mad)
```

Score is the mean index, not the mode; `[0.1,0.3,0.6]` gives score 1.5 and confidence 0.25. Noul returns `noul`; Decisions predicate returns `probability`, without this separate confidence field. Confidence measures concentration relative to these definitions, **not empirical accuracy**. High probabilities may be miscalibrated and do not guarantee truth. Compare distributions, not confidence across unrelated candidate sets or tasks.

## Select thresholds using held-out data

1. Split by source entity, conversation/customer, media identity and time as appropriate before augmentation. Keep train, threshold/calibration validation, and final test independent. Remove exact and near duplicates; paraphrases of one source must stay in one split.
2. Freeze model revision, backend/precision, temperature, prompts, candidate set/order, media budget and label policy. Collect labeled examples representative of deployment, including ambiguous, negative, rare and out-of-scope cases.
3. On validation only, sweep predicate thresholds (or Choice maximum/gap and rejection rules). Record TP/FP/TN/FN, precision, recall, false-positive and false-negative rates, automated coverage and manual-review volume. Choose a rule against actual business costs and available review capacity, per class where needed. Do not optimize on the final test.
4. Freeze the rule and report independent test counts, errors, coverage and uncertainty intervals where meaningful. A tiny synthetic sample checks code paths only. No universal optimal threshold or calibration improvement is claimed here.

Use two thresholds for predicates when appropriate: below the lower threshold reject, above the upper threshold accept, and review the middle. This is an application policy, not an extra model class. For conflicting questions (for example mutually incompatible approvals), apply explicit consistency rules and escalate to review rather than averaging unrelated probabilities. Preserve input, model/config identity, distributions, rule version and reviewer outcomes for auditing.

## Temperature, calibration and revalidation

A positive scalar temperature rescales fixed logits before softmax; it preserves their ranking/argmax in exact arithmetic. It changes concentration and Score's expected index, but provides no guarantee of improved ranking accuracy. Temperature is calibration only when fitted against an independent labeled calibration set with a proper objective, then tested independently. Per-kind temperatures are supported in native prediction; confirm backend-specific support. An explicit request-body temperature overrides the Python keyword. The training-checkpoint inference CLI retains support for legacy `{"temperature":1.0}` files. Both inference and evaluation accept versioned `--calibration` artifacts with `--protocol` identity checks; evaluation defaults to T=1. Use the [calibration workflow](./calibration.md) to fit/save parameters, freeze review rules and inspect held-out evidence.

Revalidate thresholds after changing model, adapter, precision/backend, prompts, candidate set/order, question grouping, sampling/media budgets, label definition, class prevalence or input domain. Monitor production drift and review workload; do not assume last month's threshold transfers.

Complete policy examples: [ticket routing](/cookbook/ticket-routing/) and [product screening](/cookbook/product-screening/). Their illustrative thresholds are not calibrated recommendations. [Evaluation and metrics](./evaluation.md) · [protocol reference](./api.md). Formula source: [inference.py](https://github.com/Valen-Team/Valen/blob/main/valen/evaluation/inference.py).

For incomplete candidate sets, see [handling unknown categories](/cookbook/unknown-categories/) for explicit none choices and measured review policies.
