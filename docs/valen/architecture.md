---
title: "Model architecture"
sidebar_label: "Model architecture"
---

Valen turns every question into a set of candidates and outputs a probability for each one. `modeling.factory` picks the Qwen or the dual-encoder implementation, which sit side by side, based on `architecture`. Both share the training objectives, output protocol and evaluation tools; each backend defines its own compiler and the granularity of forward and backward passes. The rest of this page covers the Qwen path in detail.

The Qwen path scores candidates from Qwen3.5 hidden states. The request decides how many candidates there are, and the decision head outputs one logit per candidate; it does not use the vocabulary output layer or call `generate()`. All three task types share the backbone and the decision head.

![Model architecture](/img/valen-architecture.png)

## From JSONL to a decision

![Model execution flowchart](/img/execution-flow-en.svg)

`request.state` is the context shared by all questions in a record; `request.questions` defines each question's task, instructions and candidates. `targets` provides the supervision labels. Question IDs, `group_id`, labels and `meta` never enter the prompt; Choice candidate names do.

| Entry point | Execution path | Scope |
| --- | --- | --- |
| `python -m valen.train` | `training.runner.main → run` | Computes SFT or RLCD loss on labeled questions only |
| `python -m valen.inference` | `evaluation.inference.main → predict → answer` | Compiles every question and returns one response per input record |
| `python -m valen.evaluate` | `evaluation.evaluate.main → run → question_metrics / summarize` | Evaluates labeled questions only, writing per-question results and aggregate metrics |

See the [code layout](https://github.com/Valen-Team/Valen/blob/main/valen/README.md) for the full directory structure and the matching tests. The top-level `evaluation/` directory is a separate package of task environments. Its Sokoban `ValenPolicy` reuses the compiler, model and `predict` described here to turn each step's screenshot and rules into the next action. See [task evaluation](https://github.com/Valen-Team/Valen/blob/main/evaluation/README.md) for the full game pipeline.

## What the compiler does

The branch flow below describes the default `qwen_execution="question"`. The newer `shared_state` mode puts all questions, candidates and Decision positions into a single Qwen sequence with one forward/backward pass; single- and multi-question records use the same shared implementation. During training, unlabeled questions stay in the shared context. See [shared-state architecture](/docs/valen/qwen-shared-state/) for the model, batched training and data grouping.

The implementation is in [data/compilers/qwen.py](https://github.com/Valen-Team/Valen/blob/main/valen/data/compilers/qwen.py); record-level validation is in [data/schema.py](https://github.com/Valen-Team/Valen/blob/main/valen/data/schema.py).

1. Select the questions to process. Training and evaluation use `labeled_only=True`; if a record has no labels at all, an empty result is returned before any media is read.
2. Convert a text state into a user message, or read an existing message list. Resolve local media paths and record media digests.
3. Call the processor's `apply_chat_template` to encode the shared state once, producing the tokens, multimodal tensors and vision grids. Video sampling metadata is kept.
4. For each branch, append the user-message prefix, task type, instructions, candidate descriptions and `Decision:`. During piecewise encoding, record the positions of each candidate's last token and of the decision's last token directly.
5. Collect the branches into a `Question`, with labels ordered to match the current candidate order. A branch longer than `max_length` raises an error.

| Task | Candidates | Branches per question | Candidate content in the branch |
| --- | --- | --- | --- |
| Choice | 1–255 named candidates | 1 | All candidate names and descriptions; shuffled during training |
| Noul | Fixed `true`, `false` | 1 | Fixed bilingual (English/Chinese) true/false descriptions |
| Score | 2–10 ordered grades | Number of grades K | Only that grade's description, without its grade index or the other grades' descriptions |

Each Score branch produces one logit; the K logits are concatenated into a vector and then passed through softmax. Grade order is used for the labels, RPS and the output expected value; a branch never sees its own grade index.

`CompiledState` holds the question list, token counts and media information. Each `Question` holds the candidate keys, descriptions, labels and branches; each `Branch` holds the backbone inputs and the positions the decision head reads.

### Shared context and compute

The shared state goes through **processor encoding** only once, but the backbone still runs a full forward pass for every branch. Branches do not share a backbone KV cache, and the model forward explicitly sets `use_cache=False`. A state with one Choice, one Noul and one three-grade Score question needs five backbone forward passes.

With a shared state of length B and branch suffixes of lengths S₁…Sₙ:

```text
logical_tokens = B + sum(Sᵢ)
compute_tokens = sum(B + Sᵢ)
```

`usage.input_tokens` in inference responses uses the former, and `internal_usage.compute_tokens` the latter. Training's `tokens_per_step` packs complete states according to the latter and is a per-rank budget. This count includes the vision tokens in each branch, but not the cost of backward passes or repeated RLCD forward passes, and it is not a FLOPs count.

## Backbone and decision head

The [Qwen builder](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/builder.py) first loads local weights with `Qwen3_5ForConditionalGeneration.from_pretrained`, then takes its `.model`. The vocabulary output layer is released along with the outer container. The attention backend can be `eager`, `sdpa` or `flash_attention_2`; configs support `bf16` and `fp32`, and FlashAttention-2 uses BF16.

`ValenQwen.forward(question)` runs the branches in order. `DecisionHead` reads `h_candidate[k]`, the hidden state of the last token of each candidate description, and `h_decision`, the hidden state of the last token of `Decision:`. Two bias-free linear projections output 256-dimensional vectors by default:

```text
logit[k] = dot(W_decision h_decision, W_candidate h_candidate[k]) / sqrt(projection_dim)
p = softmax(logits / temperature)
```

The decision head casts the hidden states it reads to FP32, and the loss is computed in FP32 as well. The head has `2 × hidden_size × projection_dim` parameters, independent of the number of candidates. `ValenQwen.forward` returns logits; softmax and the output fields are left to inference or to the training objective.

## Trainable parameters and optimization

After loading, the whole backbone is frozen, and parameters are then unfrozen according to `stage`:

| Stage | Trainable parts |
| --- | --- |
| `warmup` | The newly created decision head |
| `text` | Decision head and LoRA on every `nn.Linear` in the LLM; data must be text-only |
| `joint` | Everything in `text`, plus the vision merger; multimodal data allowed |
| `vision_top` | Everything in `joint`, plus the last four blocks of the vision encoder |

LoRA targets are enumerated one by one from `backbone.language_model.named_modules()` and never match the vision tower or the decision head. The defaults are rank 32, alpha 64 and dropout 0. The four parameter groups have separate learning rates, the optimizer is always AdamW, and there is currently no learning-rate scheduler. See the [configuration reference](/docs/valen/configuration/) for the settings and their defaults.

`method` is independent of `stage`. SFT uses cross-entropy over the candidate distribution and can add RPS for Score. RLCD samples discrete actions from the candidate distribution and uses clipped policy optimization, a KL term toward a fixed reference, and an auxiliary Brier term. Both need labels; see the [training guide](https://github.com/Valen-Team/Valen/blob/main/valen/training/README.md).

### Distributed training

[training/distributed.py](https://github.com/Valen-Team/Valen/blob/main/valen/training/distributed.py) implements data parallelism with explicit synchronization. Every GPU holds the full model, with no model or optimizer sharding. Each epoch shuffles the records, and each rank takes its own slice.

Each GPU first backpropagates question by question and accumulates gradients; the gradients are then summed across ranks. Each question's loss has already been divided by (global number of effective states × number of labeled questions in its state). Idle ranks still take part in synchronization.

### Frozen-feature reuse

`cache_frozen_features=true` is wired into **RLCD** only. It requires the entire backbone to be frozen. Within each rollout batch it keeps the features at the candidate and decision positions, so the old policy, the reference decision head and later updates can reuse them. On first use, each GPU runs one extra full forward pass to check that the logits match exactly.

When `beta>0`, default RLCD keeps an extra copy of the frozen reference model on each GPU. With the cache above enabled, only the reference decision head is copied. SFT still calls the full `model(question)`.

## Saving, loading and output

A checkpoint stores only the values of the currently trainable parameters, plus the optimizer, progress and RNG state; it cannot be used without the base model. RLCD also stores the initial reference parameters. `--initialize` starts a new experiment from existing parameters; `--resume` continues the original optimization and requires a compatible number of processes and training config. See [checkpoints and resuming](https://github.com/Valen-Team/Valen/blob/main/valen/training/README.md#checkpoint-与恢复) in the training guide for the files and constraints.

Choice returns the highest-probability candidate, Noul returns `P(true)`, and Score returns the expected grade index. The `confidence` of Choice and Score measures how concentrated the distribution is. See [inference and evaluation](/docs/valen/evaluation/) for the full fields, formulas and evaluation conventions.

The model class is `ValenQwen`, the response identifier is `Valen`, and the architecture identifier in configs is `qwen`. The Python package, command entry points and newly generated base-model manifests all use `valen`; checkpoints use the `backbone.*` and `head.*` parameter keys.

---

Synchronized from [Valen / docs/architecture.md](https://github.com/Valen-Team/Valen/blob/main/docs/architecture.md) · Source blob `5682c68` · 2026-10-19.
