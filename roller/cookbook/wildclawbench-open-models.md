---
title: "WildClawBench with four models and five Harnesses"
description: "Collect, grade and browse WildClawBench trajectories with OpenClaw, Codex, Claude Code, DeepSeek Harness and OpenCode, using four self-hosted models."
---

# WildClawBench with four models and five Harnesses

This example collects real agent trajectories with DeepSeek-V4.1-Flash-1017,
GLM-5.3-Flash, Kimi K3 and Kimi K3.1 Pro. Each published model–Harness collection runs the same 28 tasks
three times. The dataset contains 1,680 attempts across OpenClaw, Codex, Claude Code,
DeepSeek Harness and OpenCode. Roller starts an isolated environment, collects
the session, grades the work and exports a dataset that opens in the HF trace viewer.

[Browse the trajectories](https://huggingface.co/datasets/Valen-Team/Roller-WildClawBench-Trajectories)
or use the [runnable example](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/wildclawbench-open-models)
to collect your own model.

| Item | Setting |
| --- | --- |
| Tasks | 28 WildClawBench tasks using local assets and the task's mock services |
| Repetitions | 3 per task and model, for 84 attempts per collection and 336 per Harness |
| Models | DeepSeek-V4.1-Flash-1017, GLM-5.3-Flash, Kimi K3, Kimi K3.1 Pro |
| Harnesses | OpenClaw 2026.3.11, Codex CLI 0.149.0, Claude Code 2.1.222, DeepSeek Harness 0.1.5rc1, OpenCode 1.18.30 |
| Judge | GLM-5.3-Flash, the same judge for all five Harnesses |
| Limits | Original task timeouts, 120-second grader timeout. The OpenCode batch allowed one grader retry |
| Collection | Worker counts varied by batch. See the dataset card for published settings |

## Batches

Each of the 20 model–Harness collections contains 84 attempts. The dataset
card records the versions and settings. The comparison uses all attempts
and counts missing scores as zero in the means. The trajectory table retains
missing scores as null and includes execution status and grader errors.

## 1. Requirements

Install Roller from a Git checkout. Use a running Docker daemon for Docker
collection, or Python 3.11 or later for E2B.

```bash
git clone https://github.com/Valen-Team/Roller.git
cd Roller
pip install -e .
```

Prepare the WildClawBench checkout and its `workspace/` task assets by following
the [upstream setup](https://github.com/InternLM/WildClawBench#download-task-data), then open
the example directory:

```bash
cd examples/cookbook/wildclawbench-open-models
export WILDCLAWBENCH_ROOT=~/WildClawBench
```

The public task images keep the benchmark environment:

```bash
docker pull ghcr.io/valen-team/roller-wildclaw-base:1.3-clean.1
docker pull ghcr.io/valen-team/roller-wildclaw-codex:1.3-codex0.149.0
docker pull ghcr.io/valen-team/roller-wildclaw-claude-code:1.3-claude2.1.222
```

The base removes personal builder credentials and identity state from the
original image; its old layers are not part of the published image. The
Codex derivative adds the CLI, Node.js and ripgrep. The Claude Code image
installs the pinned CLI from the npm registry on first use in a new container.
Roller stages task inputs and deliberate test keys from the benchmark checkout.
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

## 5. Collect with Claude Code

Use an Anthropic Messages endpoint that supports streaming, tool calls and
images returned by tools. Set the model ID exactly as the endpoint exposes it.

```bash
export MODEL=glm-5.3-flash
export ANTHROPIC_BASE_URL=http://localhost:8000
export ANTHROPIC_API_KEY=not-required
./collect-claude-code.sh --dry-run
./collect-claude-code.sh
```

For a one-task trial, use the same `one-task.txt` as above:

```bash
TASK_IDS_FILE="$PWD/one-task.txt" RUNS_PER_TASK=1 PARALLEL=1 \
  RUN_NAME=wildclawbench-claude-code-check ./collect-claude-code.sh
```

The published collection used a local image with the same CLI version installed
before the tasks started. Set `CLAUDE_CODE_IMAGE` to use that local build.
See the [task image recipe](https://github.com/Valen-Team/Roller/tree/main/docker/wildclawbench).

If your Messages gateway rejects PDF `document` blocks, install the PDF
dependencies with `pip install -e '.[pdf]'` from the Roller checkout. Pass
`--claude-pdf-as-images` to the script to send each page as extracted text and a
PNG. Roller records the forwarded request in the wire trace.

Claude Code compacts a conversation on its own only when an auto-compact window
is set. Set `CLAUDE_CODE_AUTO_COMPACT_WINDOW` and pass it to the container:

```bash
CLAUDE_CODE_AUTO_COMPACT_WINDOW=100000 ./collect-claude-code.sh \
  --pass-env CLAUDE_CODE_AUTO_COMPACT_WINDOW
```

Claude Code then compacts when a request reaches about 33,000 tokens less than
the window, about 67,000 tokens for 100000, the smallest window it accepts.
To compact earlier, also set `CLAUDE_CODE_MAX_CONTEXT_TOKENS`, which the script
already passes, to a smaller window: with 64000, Claude Code compacts at about
31,000 tokens. `CLAUDE_CODE_MAX_CONTEXT_TOKENS` alone does not start compaction.

For this collection, the four endpoints used Messages and Claude Code requested
up to 32,000 output tokens. Retries for rejected PDFs used the page conversion
option. GLM retries for context errors used the endpoint's 98,304-token window.
The dataset keeps one row for each task and repetition, including errors and
timeouts after those settings were applied.

## 6. Collect with DeepSeek Harness

Use a Chat Completions endpoint that streams tool calls. For image tasks, select
a model that accepts images.

For Docker, build the task image from the Roller repository root, then change
to the example directory.

```bash
docker build --build-arg BASE_IMAGE=ghcr.io/valen-team/roller-wildclaw-base:1.3-clean.1 \
  -t roller-wildclaw-deepseek:1.3-deepseek0.1.5rc1 docker/deepseek
cd examples/cookbook/wildclawbench-open-models
export DEEPSEEK_IMAGE=roller-wildclaw-deepseek:1.3-deepseek0.1.5rc1
export MODEL=your-model-id
export MODEL_BASE=https://model.example/v1
./collect-deepseek.sh --dry-run
./collect-deepseek.sh --deepseek-profile sdk --deepseek-input-modalities text,image
```

For E2B, follow the [public template recipe](https://github.com/Valen-Team/Roller/tree/main/docker/wildclawbench#e2b-template)
to install `.[e2b]` and build a template. Set `E2B_API_KEY`,
`SANDBOX_PROVIDER=e2b` and `SANDBOX_TEMPLATE` on the collector, then run the
same script. Use model and judge endpoints reachable from the E2B sandbox.
For a first run with a local grader, use the template recipe's single-task
command with the calendar scheduling task. It installs its warmup dependencies
from PyPI.

## 7. Collect with OpenCode

Use the Git checkout from step 1 and an OpenAI Chat Completions endpoint with
streaming, tool-call and image support. Set `OPENAI_API_KEY` for authentication
if required. From the example directory, build the WildClawBench task image
with OpenCode 1.18.30 and run one model at a time.

```bash
docker build --platform linux/amd64 \
  --build-arg BASE_IMAGE=ghcr.io/valen-team/roller-wildclaw-base:1.3-clean.1 \
  -t roller-wildclaw-opencode:1.3-opencode1.18.30 ../../../docker/opencode
export OPENCODE_IMAGE=roller-wildclaw-opencode:1.3-opencode1.18.30
export MODEL=your-model-id
export MODEL_BASE=https://model.example/v1
export MODEL_CONTEXT_WINDOW=98304
./collect-opencode.sh --dry-run
./collect-opencode.sh
```

Set the context window to match your endpoint. The script uses the standard
OpenCode tools, 256 steps, a 32,768-token response cap and high reasoning
effort. It saves the full requests, tool calls and reasoning. The published
batch used isolated sandboxes. This recipe uses Docker.

For a one-task check, set `TASK_IDS_FILE`, `RUNS_PER_TASK=1` and `PARALLEL=1`.
See [OpenCode configuration](/roller/harnesses/opencode-configuration/).

## 8. Inspect and export

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

## 9. Append to an HF dataset

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
