---
title: "Released model architecture"
---

# How the model makes decisions

Valen uses Qwen3.5 to understand the input text, images or video. Mixer scores each candidate answer, and softmax converts those scores to probabilities. Several questions about the same input can share one backbone computation.

## Candidate scoring

The backbone produces hidden states rather than vocabulary answers. For each candidate the head constructs four roles: mean-pooled context, mean-pooled instruction, mean-pooled candidate span, and the question's final Decision token. Layer normalization and a shared projection map each role to width 256, with learned role embeddings.

Each Mixer block applies a residual MLP across the four roles (4 → 16 → 4), then a residual channel MLP (256 → 1024 → 256), both with normalization and GELU. After two blocks a normalized linear readout of the updated **candidate role** produces one FP32 logit. Candidates share the scorer; Mixer does not mix different candidate rows. Their backbone features can still depend on candidate order and the rest of the causal sequence.

`softmax(logits / temperature)` yields candidate probabilities. The model does not call `generate()` or decode vocabulary tokens; `output_tokens=0` does not imply zero computation. [Probability guide](./probabilities.md) explains the three output kinds and confidence.

## Shared context and compute

<a id="shared-context-and-compute"></a>

Shared-state packs the state/media once, all question schemas/candidates, then each Decision readout into one causal sequence. Choice, Noul and all Score grades share one backbone forward per state; batching puts separate states in separate padded rows. All questions remain in context during labeled training/evaluation, but only labeled readouts contribute to losses/metrics. Labels and external question IDs are excluded from prompts; Choice keys are included.

In this mode `logical_tokens = compute_tokens = complete shared sequence length`. These counts include visual tokens but exclude backward passes, padded batch overhead and repeated RLCD/reference forwards; they are not FLOPs. `max_length` applies to the entire sequence; overlong input raises an error. Per-rank `tokens_per_step` packs complete states. `microbatch_size` counts states; padded-token limits can force smaller batches, and an oversized single row still runs alone subject to state limits. One forward is not a constant-memory or linear-cost guarantee.

## Valen-Decision-1.5

Valen-Decision-1.5 adds block-structured attention and a grounding head to the same architecture. The 27B model is built on Qwen3.8-27B; the other sizes use Qwen3.5.

**Block-structured attention.** In the full-attention layers the shared prefix, which holds the state and media, is bidirectional internally and does not attend to the question region, so its computation is still shared by every question. Decision questions share one bidirectional block that sees the whole prefix; each `bbox` question has its own block. The linear attention layers stay causal.

**Grounding head.** A `bbox` question is a decision over image tokens. Its Decision readout scores every visual token of the referenced image, and each token regresses the distances from its cell centre to the four box edges. The box is the regression of the most probable token; `confidence` is the probability mass of the tokens whose centres fall inside that box. Coordinates are normalized to `[0, 1]` against the original image size. See [Bbox questions](./bbox.md).

Released Valen-Decision-1.5 configs set `valen_decision_version="1.5"`, `valen_full_attention_mask="bbox_blocks"` and `valen_grounding={"width": 512, "hidden": 1024}`, with the same Mixer settings and `valen_max_length=16384`. `model_type` stays `valen_qwen`. Implementation: [block_attention.py](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/block_attention.py), [grounding.py](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/grounding.py), [architecture contract](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/DECISION_1_5.md).

## Historical and optional implementations

The `question` path repeats the state for each branch: Choice/Noul use one branch; Score uses one branch per grade. If state length is B and suffix lengths are Sᵢ, logical tokens are `B + sum(Sᵢ)` and compute tokens are `sum(B + Sᵢ)`; no cross-branch backbone KV reuse is provided. This differs from the released shared-state format.

Bilinear uses two projections and a scaled dot product; MLP, role-MLP and dual-encoder implementations remain research options. The bilinear formula does **not** describe Mixer. Switching execution/head changes inputs or architecture and requires suitable training and held-out validation.

Implementation: [heads.py](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/heads.py), [compiler](https://github.com/Valen-Team/Valen/blob/main/valen/data/compilers/qwen.py), [published loader](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/pretrained.py). [Shared-state reference](./qwen-shared-state.md) · [training](./training.md)

<a id="from-jsonl-to-a-decision"></a>
<a id="what-the-compiler-does"></a>
<a id="backbone-and-decision-head"></a>
<a id="trainable-parameters-and-optimization"></a>
<a id="distributed-training"></a>
<a id="frozen-feature-reuse"></a>
<a id="saving-loading-and-output"></a>

<details>
<summary>Valen-Decision-1.0 release configuration</summary>

The released native Valen-Decision-1.0 models (Valen-0.8B, Valen-2B and Valen-4B) use a Qwen3.5 multimodal backbone, **Mixer** candidate scorer and **shared_state** execution. Release config fields are `model_type="valen_qwen"`, `qwen_execution="shared_state"`, and `valen_head.head_type="mixer"`. The published Mixer uses width 256, two blocks, role-MLP hidden width 16 and channel-MLP hidden width 1024. `valen_max_length=32768` is a complete-sequence limit, not a guarantee that every backend accepts that budget.

These are release settings, not the generic builder's fallback `bilinear` / `question` settings. Complete-model loading inherits the saved architecture and rejects incompatible head dimensions; it must preserve the trained head.

</details>
