---
title: "Configuration"
sidebar_label: "Configuration"
---

`python -m valen.train --config <file.json>` reads a single JSON object. `--method`, `--output` and `--attn-implementation` override the matching fields (the last one overrides Qwen's `attn_implementation`); all other training parameters are changed in the JSON. Relative paths in a config are resolved against the **process working directory**; all commands below run from the repository root.

The 12 Qwen-base example configs directly under `configs/train/qwen/` use Qwen3.5-2B and the synthetic dataset, with `max_steps` set to 100. The eight original per-stage configs (`sft_*` and `rlcd_*` for `warmup`, `text`, `joint` and `vision_top`) run for 3 epochs, and the four `*_shared_state_*` configs for 1 epoch; training stops at whichever limit is reached first. The two `sft_finetune_*` configs use a released complete Valen-2B model and the text smoke dataset, with 1 epoch and a 100-step limit. The `valen1/` subdirectory holds the Valen v1 training configs; see its [README](https://github.com/Valen-Team/Valen/blob/main/configs/train/qwen/valen1/README.md). Configs are split into `model`, `data`, `training` and `objective` sections with `config_version` 2; `data.path` is the JSONL path, and all other fields keep the names in the tables below.

The CLI expands the config before applying `--attn-implementation`, `--method` and `--output`, and the checkpoint stores the expanded fields. The old flat config layout and its paths still work; if the same field appears with conflicting values, an error is raised. Old and new configs that normalize to the same result can resume the same training run across layouts. Dual-encoder backbone-combination configs are in `configs/train/dual_encoder/modernbert_dinov3b16/`.

## Data, model and training budget

The defaults below are the values the source code uses when a field is omitted; the example JSON files may override them.

| Field | Default | Meaning |
| --- | --- | --- |
| `architecture` | `"qwen"` | `qwen` or `dual_encoder`; the Qwen parameters in this table apply to the Qwen path only |
| `model_path` | required | Local Qwen3.5 base or released complete Valen model and processor directory |
| `data` | required | JSONL file path; each GPU reads the whole file, then shards it by record |
| `output` | required | Output directory for logs and the `latest/` checkpoint |
| `method` | `"sft"` | `sft` or `rlcd` |
| `stage` | `"joint"` | `warmup`, `text`, `joint`, `vision_top` |
| `finetuning_type` | `"lora"` | Qwen uses `lora` or `full`; `full` supports `warmup` and `joint`, and its joint stage updates the whole backbone and the decision head |
| `device` | `"cuda"` | Device; multi-GPU CUDA training binds devices by `LOCAL_RANK` |
| `dtype` | `"bf16"` | Backbone compute precision, `bf16` or `fp32`; full joint training keeps parameters in FP32 and uses BF16 autocast with `bf16`; the decision head stays in FP32 |
| `attn_implementation` | `"eager"` | Qwen attention backend: `eager`, `sdpa`, `flash_attention_2` |
| `qwen_execution` | `"question"`; complete Valen inherits its saved value | Qwen execution mode; `shared_state` lets all questions in a record share one forward pass; the alias `share_state` is accepted |
| `seed` | `42` | Seed for initialization, record ordering and sampling |
| `epochs` | `1` | Maximum number of passes over the data |
| `max_steps` | `2**63-1` | Maximum number of batches |
| `max_length` | `8192`; complete Valen inherits its saved value | Token limit for a single complete branch; exceeding it raises an error |
| `tokens_per_step` | `16384` | Per-rank, per-batch limit on `compute_tokens`; must be positive |
| `microbatch_size` | `1` | Number of QAs per parallel Qwen forward/backward; in shared_state mode, the number of states; supports SFT and RLCD |
| `microbatch_max_tokens` | `32768` | Limit on the total padded tokens of each backbone forward |
| `data_prefetch` | `false` | Qwen SFT or shared_state RLCD preprocesses the next batch on the CPU while the GPU computes the current one |
| `sft_iterations` | `1` | Number of optimization passes over the same SFT batch, a positive integer; can be matched to RLCD's `num_iterations` for controlled comparisons |
| `loss_reduction` | `"state_mean"` | Average over questions within each state, then over states; `question_mean` averages over all labeled QAs |
| `media_kwargs` | `{}`; complete Valen inherits its saved value | Arguments passed to the official processor; saved with the checkpoint |
| `save_every` | `100` | Overwrite `latest/` every this many batches; should be a positive integer; a checkpoint is also saved on normal completion |

`tokens_per_step` controls how many complete states are accumulated per update. All branches of all labeled questions in a state must fit into the budget together; a single state that exceeds it raises an error and is never split or truncated.

`max_length` and `tokens_per_step` are two separate limits. For example, a record with five branches of 2000 tokens each satisfies `max_length=8192` for every branch, but its 10000-token total does not fit into `tokens_per_step=8000`.

## Qwen shared-state training

When using released complete Valen weights, the loader detects `model_type="valen_qwen"` and retains the trained backbone and Mixer. Omitted head architecture, execution mode, `max_length` and `media_kwargs` settings are inherited from the model's `config.json`; explicitly incompatible head settings raise an error before weights are loaded. See [`sft_finetune_lora.json`](https://github.com/Valen-Team/Valen/blob/main/configs/train/qwen/sft_finetune_lora.json) and [`sft_finetune_full.json`](https://github.com/Valen-Team/Valen/blob/main/configs/train/qwen/sft_finetune_full.json) for LoRA and full fine-tuning recipes. Both start a new SFT run from `model_path`; `--initialize` and `--resume` continue to use this repository's `checkpoint.pt` format.

`qwen_execution="shared_state"` scores all questions of a record with one backbone forward pass; a single question is a special case of the same implementation. In this mode `microbatch_size` caps the number of parallel states, and the image/video inputs of a state are not repeated per question. `loss_reduction="question_mean"` preserves a data mixture specified by QA counts when records hold different numbers of questions. The mode and loss reduction are saved with the checkpoint; changing either requires starting a new experiment with `--initialize`.

See the [shared-state guide](/docs/valen/qwen-shared-state/) for the model structure, data grouping, the two-stage Mixer recipe and validation commands.

## Parallel multi-QA training in Qwen

`microbatch_size > 1` turns the language inputs of multiple QAs into a real batch and concatenates the image and video patches and grids. Text is right-padded, so the original candidate positions and role-pooling spans stay valid. Within each update, items are grouped by length to reduce padding; the branches of a Score question are merged in their original order before the loss is computed. The per-state question weights and the optimizer update budget set by `tokens_per_step` are unchanged.

For example, in the `training` section:

```json
{
  "tokens_per_step": 32768,
  "microbatch_size": 16,
  "microbatch_max_tokens": 65536,
  "data_prefetch": true
}
```

`microbatch_size` is an upper bound on QAs; the actual number is also limited by sequence lengths and Score branch counts. `microbatch_max_tokens` caps the total padded branch tokens of a single forward pass. A single branch that exceeds this budget still runs on its own, and the existing `max_length` check still applies. The branches of a Score question may share one forward pass or be split across several; their computation graphs are kept until the question completes one backward pass.

`data_prefetch` uses one CPU worker thread per GPU. The checkpoint stores only the cursor of consumed batches and the candidate-permutation RNG; data that was still being prefetched is prepared again after resuming. In the training metrics, each GPU's `prepare_wait_seconds` records time spent waiting on preprocessing, and `cpu_prepare_seconds` records preprocessing time. Parallel QAs and prefetching currently support Qwen SFT.

## Qwen FlashAttention-2

Add `"attn_implementation": "flash_attention_2"` to the `model` section of the config, or override it with `--attn-implementation`. Flat configs accept the same field. The default is still `eager`; old checkpoints can switch backends for inference or standalone evaluation without converting weights.

FlashAttention-2 requires a CUDA GPU of the Ampere architecture or newer, `dtype="bf16"`, and a `flash-attn` extension that matches the installed PyTorch/CUDA. Install the project dependencies first, then install the extension in the GPU environment; building from source needs the CUDA toolkit and a compiler toolchain. The verified extension version is 2.7.4.post1, and the framework requires at least 2.3.3. Qwen3.5-2B has passed checks on a single H200 covering image-text/video forward passes, SFT/RLCD backward passes, checkpoint save/restore and optimizer restore, with FlashAttention-2 as the actual backend for both text and vision.

```bash
python -m pip install packaging ninja psutil
MAX_JOBS=4 python -m pip install 'flash-attn==2.7.4.post1' --no-build-isolation

python -m valen.train --config configs/train/qwen/sft_joint.json \
  --attn-implementation flash_attention_2 --output output/qwen-flash-joint

python -m valen.inference --checkpoint output/qwen-flash-joint/latest \
  --data data/smoke/train.jsonl --output output/predictions.jsonl \
  --attn-implementation flash_attention_2

python -m valen.evaluate --checkpoint output/qwen-flash-joint/latest \
  --data data/smoke/train.jsonl --output output/flash-evaluation \
  --attn-implementation flash_attention_2
```

`sdpa` uses PyTorch's scaled dot-product attention and needs no separate `flash-attn` install. On CUDA, PyTorch picks the fused kernel based on the inputs and device; it also works on CPU and in FP32. When FlashAttention-2 is selected explicitly, an incompatible device, precision or extension raises an error.

Qwen3.5's language full-attention layers and the vision attention use the selected backend. The Gated DeltaNet linear-attention layers keep their own implementation, whose optimized kernels depend on `flash-linear-attention` and `causal-conv1d`. All four decision heads stay in FP32. `adaptation.attention_backends` in the training manifest and `attention_backends` in regular evaluation results record the actual text and vision backends. Different backends may produce floating-point rounding differences; record the backend explicitly when comparing speed.

CLI overrides for inference and evaluation never modify the checkpoint. When resuming Qwen training, you can switch the attention backend, the number of parallel QAs, the parallel token budget, activation checkpointing and prefetch settings, and the optimizer and RNG state are still restored. `resume_runtime_changes` in the manifest records changes to these runtime settings. The model, data, loss and learning rates remain subject to the config consistency check; the backend and batched computation may introduce floating-point rounding differences.

For GPU integration checks, reuse the existing smoke script, which covers image-text/video, joint backward passes, save/restore and RLCD:

```bash
python scripts/smoke/qwen/gpu_smoke.py --attn-implementation flash_attention_2 \
  --output artifacts/qwen-flash-smoke
```

References: [Transformers 5.4 attention backends](https://huggingface.co/docs/transformers/v5.4.0/en/attention_interface),
[FlashAttention installation requirements](https://github.com/Dao-AILab/flash-attention/tree/v2.7.4.post1).

## Trainable parameters and optimizer

| Field | Default | Meaning |
| --- | --- | --- |
| `head_type` | `"bilinear"` | Qwen scoring head: `bilinear`, `mlp`, `role_mlp` or `mixer` |
| `projection_dim` | `256` | Dimension of the two `bilinear` projections |
| `head_hidden_dim` | `512` / `1024` | Hidden dimension of `mlp` / `role_mlp` |
| `head_bottleneck_dim` | `128` | Second hidden-layer dimension of `mlp` |
| `head_width` | `256` | Role projection dimension of `role_mlp` / `mixer` |
| `head_layers` | `2` | Number of `mixer` blocks |
| `head_token_hidden_dim` | `16` | Hidden dimension of the `mixer` role-mixing MLP |
| `head_channel_hidden_dim` | `1024` | Hidden dimension of the `mixer` channel-mixing MLP |
| `lora_rank` | `32` | LLM LoRA rank; `warmup` creates no LoRA |
| `lora_alpha` | `64` | LoRA alpha; dropout is fixed at 0 |
| `gradient_checkpointing` | `true` | Enables non-reentrant gradient checkpointing for all stages except `warmup` |
| `head_lr` | `2e-4` | Decision-head learning rate |
| `lora_lr` | `5e-5` | LLM LoRA learning rate |
| `language_lr` | `1e-5` | Language-backbone learning rate for full joint training |
| `merger_lr` | `1e-5` | ViT merger learning rate |
| `vision_lr` | `2e-6` | The last four vision blocks in `vision_top`; the whole vision backbone in full joint training (the merger is set separately) |
| `weight_decay` | `0.01` | AdamW weight decay, applied to parameters with gradients |
| `max_grad_norm` | `1.0` | Gradient-clipping threshold over all trainable parameters after synchronization |
| `rps_weight` | `0.0` | RPS weight for Score in SFT; must be 0 for RLCD |
| `brier_weight` | `0.0` | Brier weight over the full candidate distribution in SFT; RLCD uses `rlcd.brier_weight` |
| `cache_frozen_features` | `false` | RLCD only; requires a fully frozen backbone |

The `head_*` model parameters can go inside the `model` section of a sectioned config. The related dimensions must be positive integers, and the head type and dimensions must stay consistent when initializing from another checkpoint. See [Qwen decision heads](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/HEADS.md) for input pooling and each network's structure.

Optimizer groups are created only for the trainable parts of the current stage, and learning rates stay constant during a run. The Qwen RLCD examples set `head_lr` to `1e-5`, and the SFT examples to `2e-4`. Architecture adaptation details are written to `adaptation` in `run_manifest.json`; the Qwen LoRA targets are in `adaptation.lora_targets`, and per-group parameter counts remain in `optimizer_groups`.

Each architecture's builder interprets the stage. Qwen's `text` requires text-only data; the dual encoder's `text`/`joint` allow image-text data, unfreezing the last layer of the text tower while keeping the vision tower frozen. Switching architectures cannot carry over the other architecture's stage meanings or checkpoints.

`warmup` is the frozen-encoder stage: Qwen trains only the decision head, and the dual encoder trains the projections, the fusion and the full decision readout. It does not mean learning-rate warmup, nor image + caption vision-language pretraining.

## RLCD parameters

After setting `method="rlcd"`, configure the following fields inside the `rlcd` object. Missing entries are filled in automatically; unknown RLCD fields raise an error.

| Field | Default | Meaning and constraints |
| --- | --- | --- |
| `group_size` | `16` | Number of actions sampled with replacement per question, integer ≥ 2 |
| `num_iterations` | `2` | Optimization passes per rollout batch, integer ≥ 1 |
| `correctness_weight` | `1.0` | Weight of the label-correctness reward |
| `confidence_weight` | `1.0` | Penalty weight on the probability error of the chosen action |
| `brier_weight` | `1.0` | Weight of the auxiliary Brier loss over the full candidate distribution |
| `beta` | `0.02` | KL weight toward the fixed reference policy; no reference model is created when 0 |
| `clip_epsilon` | `0.2` | Clipping radius of the policy probability ratio, strictly within `(0, 1)` |
| `advantage_epsilon` | `1e-6` | Stabilizing term in the denominator of the within-group advantage normalization; must be positive |

All floating-point parameters must be finite and non-negative, and the two reward weights cannot both be 0. See the [training guide](https://github.com/Valen-Team/Valen/blob/main/valen/training/README.md) for the reward, the KL direction and the loss formulas.

Qwen `shared_state` RLCD supports `microbatch_size > 1` and `data_prefetch`. The policy, the fixed reference policy and the gradient updates are all batched by complete state, and each question's sampled actions stay matched to that question rather than being misaligned by length sorting. `cache_frozen_features=true` still requires a microbatch of one. See [rlcd_shared_state_joint.json](https://github.com/Valen-Team/Valen/blob/main/configs/train/qwen/rlcd_shared_state_joint.json) for an example, and launch it with `--initialize` pointing at an SFT checkpoint.

`step`, `max_steps` and `save_every` all count rollout batches; `optimizer_steps` counts actual updates. Default RLCD updates twice per batch, and SFT once. Comparisons should look at `optimizer_steps` and wall-clock time, not only at step.

## Setting up an experiment from an example

The following creates a copy of a config and leaves the repository example untouched. Prepare `data/train.jsonl` first, then train.

```bash
mkdir -p output/experiment-configs
python - <<'PY'
import json
from pathlib import Path

config = json.loads(Path("configs/train/qwen/sft_joint.json").read_text())
config["data"]["path"] = "data/train.jsonl"
config["training"].update(output="output/traffic-joint", epochs=5, max_steps=1000)
Path("output/experiment-configs/traffic-joint.json").write_text(
    json.dumps(config, indent=2) + "\n", encoding="utf-8"
)
PY

python -m valen.train --config output/experiment-configs/traffic-joint.json
```

Use a new output directory for each independent experiment. A regular new training run overwrites the logs and `latest/` in its output directory.

## Config validation and resuming

On resume, the config stored in the checkpoint is compared with the current config, including the data file digest. Only `output`, `epochs`, `max_steps`, `device` and `save_every` may change, plus the runtime settings `microbatch_size`, `microbatch_max_tokens` and `data_prefetch`; Qwen also allows switching `attn_implementation` and `gradient_checkpointing`. Changes to runtime settings are recorded in `resume_runtime_changes` in the manifest. To change the data, stage, learning rates or RLCD parameters, start a new experiment with `--initialize`.

Regular configs have no unified field schema, so a misspelled top-level field does not necessarily raise an error. `normalize_config` checks the architecture identifier, the training objective and removed distillation options: a non-zero `kd_weight` or a valid `teacher_checkpoint` is rejected, and disabled distillation fields in old checkpoints are cleaned up. Fields in the `rlcd` sub-object are validated strictly. See [runner.py](https://github.com/Valen-Team/Valen/blob/main/valen/training/runner.py), [factory.py](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/factory.py) and [rlcd.py](https://github.com/Valen-Team/Valen/blob/main/valen/training/rlcd.py) for the implementations.

---

Synchronized from [Valen / docs/configuration.md](https://github.com/Valen-Team/Valen/blob/main/docs/configuration.md) · Source blob `c8c0ccd` · 2026-10-19.
