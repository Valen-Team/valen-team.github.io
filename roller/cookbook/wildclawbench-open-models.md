---
title: "WildClawBench with four models and two Harnesses"
description: "Collect, grade and browse WildClawBench trajectories with OpenClaw and Codex, using four self-hosted models."
---

# WildClawBench with four models and two Harnesses

This example collects real agent trajectories with DeepSeek-V4.1-Flash-1017,
GLM-5.3-Flash, Kimi K3 and Kimi K3.1 Pro. Each published model–Harness collection runs the same 28 tasks
three times. The dataset contains four OpenClaw collections and two Codex
collections, for DeepSeek and GLM. Roller starts the task container, collects
the session, grades the work and exports a dataset that opens in the HF trace viewer.

[Browse the trajectories](https://huggingface.co/datasets/Valen-Team/Roller-WildClawBench-Trajectories)
or use the [runnable example](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/wildclawbench-open-models)
to collect your own model.

| Item | Setting |
| --- | --- |
| Tasks | 28 WildClawBench tasks using local assets and the task's mock services |
| Repetitions | 3 per task and model: 84 attempts per collection; 336 OpenClaw and 168 Codex attempts |
| Models | DeepSeek-V4.1-Flash-1017, GLM-5.3-Flash, Kimi K3, Kimi K3.1 Pro |
| Harnesses | OpenClaw 2026.3.11; Codex CLI 0.149.0 |
| Judge | GLM-5.3-Flash, the same model for both batches |
| Limits | Original task timeouts; 120-second grader timeout; no Roller retries |
| Collection | 8 rollout workers per model; concurrent jobs shared 2 grader slots |

## Batches

The dataset retains 336 OpenClaw attempts and adds 168 Codex attempts from
DeepSeek and GLM. Each model–Harness collection contains 84 attempts. Batch
notes record the versions and settings, and the HF tables include scores,
execution status and grader errors for every attempt.

## 1. Requirements

The new options in this example are not in PyPI 0.4.0. Install Roller from a
Git checkout and have Docker running:

```bash
git clone https://github.com/Valen-Team/Roller.git
cd Roller
pip install -e .
```

Download [WildClawBench](https://github.com/InternLM/WildClawBench) and its task
assets, then open the example directory:

```bash
cd examples/cookbook/wildclawbench-open-models
export WILDCLAWBENCH_ROOT=~/WildClawBench
```

The two public task images keep the benchmark environment:

```bash
docker pull ghcr.io/valen-team/roller-wildclaw-base:1.3-clean.1
docker pull ghcr.io/valen-team/roller-wildclaw-codex:1.3-codex0.149.0
```

The base removes personal builder credentials and identity state from the
original image; its old layers are not part of the published image. The
Codex derivative adds the CLI, Node.js and ripgrep. Task inputs and deliberate
test keys are staged separately from the benchmark checkout and stay unchanged.
See the [build instructions](https://github.com/Valen-Team/Roller/tree/main/docker/wildclawbench).

## 2. Configure a judge

Point the graders at an OpenAI-compatible Chat Completions service:

```bash
export OPENROUTER_BASE_URL=http://localhost:8001/v1
export OPENROUTER_API_KEY=not-required
export JUDGE_MODEL=glm-5.3-flash
```

Replace the addresses and keys with your own services. If a proxy is configured,
add internal service hostnames to `NO_PROXY`. Roller expands matching CIDR
entries for grader endpoints so HTTPX can also bypass those services.

## 3. Collect with Codex

The model endpoint must support Responses, including streaming, tool calls and
images. Set the model ID exactly as your service exposes it:

```bash
export MODEL=glm-5.3-flash
export OPENAI_BASE_URL=http://localhost:8000/v1
export OPENAI_API_KEY=not-required
export MODEL_CONTEXT_WINDOW=98304
export RUN_NAME=wildclawbench-codex-glm
./collect-codex.sh --dry-run
./collect-codex.sh
```

Set the context window to your serving configuration. For another model, change
`MODEL`, its endpoint and `RUN_NAME`. Separate invocations can run concurrently.
Each invocation has its own worker and grader limits.

For Kimi K3.1 Pro backends that accept user images but lose
images in tool outputs, set `TOOL_IMAGES_AS_USER=1` before
running the script. Roller retains the tool text and attaches the original
image bytes in a following user message. Other backends leave the setting off.
See [Codex configuration](/roller/harnesses/codex-configuration/).

For a single real task before a full collection, select a one-task list and
one repetition:

```bash
printf '%s\n' 05_Creative_Synthesis_task_10_social_poster_multi_crop > one-task.txt
TASK_IDS_FILE="$PWD/one-task.txt" RUNS_PER_TASK=1 PARALLEL=1 \
  RUN_NAME=wildclawbench-codex-check ./collect-codex.sh
```

## 4. Collect with OpenClaw

Edit `models.json` so its model IDs and context windows match your service.
It lists four example models behind one Chat Completions endpoint:

```bash
export ROLLER_INFER_BASE_URL=http://localhost:8000/v1
export ROLLER_INFER_API_KEY=not-required
./collect.sh --dry-run
./collect.sh
```

For models on different endpoints, give each its own provider in `models.json`.
The example uses a 32,768-token response budget and leaves reasoning effort
at the configured server defaults. The published settings were:

| Model | Serving configuration |
| --- | --- |
| DeepSeek-V4.1-Flash-1017 | vLLM, DSpark=5, Engram CPU offload; thinking enabled, effort 100 |
| GLM-5.3-Flash | vLLM, MTP=5; reasoning effort max |
| Kimi K3 | vLLM, DSpark=8; thinking effort max |
| Kimi K3.1 Pro | SGLang, DFLASH width 5; reasoning effort max |

The Codex collection retained those backend defaults and used a 32,768-token
response cap. New runs can use the settings supported by their own endpoint.

## 5. Inspect and export

```bash
roller view runs/wildclawbench-codex-glm
roller bench report runs/wildclawbench-codex-glm
roller export runs/wildclawbench-codex-glm --format hf --output dataset \
  --preserve-task-keys --redact-rules redact.json
```

The export contains a table row and a browsable session for each available
trajectory. Successful runs also have chat-format fields when conversion is
available; failed runs can have partial sessions. The raw run stays unchanged.

`--preserve-task-keys` keeps deliberately planted benchmark keys while still
replacing known environment credentials, collection endpoints and host paths.
Adjust the example `redact.json` for environment-specific values and review the
exported content before publishing. See [trajectory outputs](/roller/traces/trajectory-outputs/#hugging-face-export).

## 6. Append to an HF dataset

```bash
hf upload <owner>/<dataset> dataset . --repo-type dataset
```

Export additional models into the same dataset folder to add their parts.
For another batch of a Harness and model already published, give the new files
separate batch names so earlier trajectories remain available. Keep a short
batch note with the date, models, versions, task selection and compatibility
settings. Update the dataset card and results from the same exported tables.

This example publishes all attempts and scores, with no separately filtered SFT
subset. HF holds the browsable data, GitHub holds the code and usage example,
and GHCR holds the task environments.
