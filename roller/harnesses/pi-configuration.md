---
title: "Pi Agent Harness guide"
---

# Pi Agent Harness guide

The Pi Agent Harness runs tasks through Pi Coding Agent when they need shell commands, file editing, or local-image inspection. It connects to an OpenAI Chat Completions service with streaming and tool-call support. This guide follows the order needed for a first run: image, API, Harness-specific flags, sessions, and outputs.

Roller currently pins the official [Pi Coding Agent SDK](https://pi.dev/docs/latest/sdk) 0.85.1. For Task fields, see [Task format reference](/roller/tasks/task-format/). For shared outputs, see [Trajectory output file guide](/roller/traces/trajectory-outputs/).

For a first run, complete sections 1 through 3 and run the example command. Read the later sections on Harness-specific flags, sessions, and trajectories when those features are needed.

## 1. Scope

Use the Pi Agent Harness when a task needs:

- an OpenAI Chat Completions endpoint with streaming and tool calls.
- shell commands, content search, or file editing.
- local-image inspection with a vision-capable model.
- single-turn, multi-turn, Task Agent, or User Simulator execution.

The Pi Agent Harness does not accept images or video directly in task messages. Account login, other Pi providers, custom plugins, and automatic compaction are also disabled.

## 2. Image preparation

Pull the prebuilt image and give it the name Roller uses by default:

```bash
docker pull ghcr.io/valen-team/roller-pi:0.85.1
docker tag ghcr.io/valen-team/roller-pi:0.85.1 roller-pi:0.85.1
```

The prebuilt image is `linux/amd64`. To build the image yourself instead, run this from the Roller repository root:

```bash
docker build -t roller-pi:0.85.1 docker/pi
```

The image contains Node.js, the Pi SDK, and runtime tools. The host does not need those dependencies installed separately. After the build, configure the API address, API key, and model ID in section 3.

The default base image is `node:22.22.0-bookworm-slim`. For another base image, npm registry, or Debian mirror, see [Docker builds and package mirrors](/roller/start/docker-builds/).

## 3. Environment variables and API

The Pi Harness connects to an OpenAI Chat Completions service with streaming and tool-call support. A first run requires an API address, an API key, and a model ID.

| Setting | Default source | CLI override |
| --- | --- | --- |
| API address | `OPENAI_BASE_URL`, then `https://api.openai.com/v1` | `--pi-api-base`, or `--api-base` for a single-Harness run |
| API key | `OPENAI_API_KEY` | `--pi-api-key-env`, or `--api-key-env` for a single-Harness run |
| Model ID | The task `model` or `--model` | Sent to the service unchanged |

The value of `--pi-api-key-env` or `--api-key-env` is the name of a host environment variable, not the key itself. The key is read at execution time and is not written to public configuration.

Replace `...`, the API address, and `model-id` with values from the model service. The following command runs a single task so that the configuration can be checked before a larger run:

```bash
export ROLLER_PI_KEY='...'

roller collect \
  --harness pi \
  --tasks examples/tasks/tasks.jsonl \
  --model model-id \
  --api-base https://api.example.com/v1 \
  --api-key-env ROLLER_PI_KEY \
  --docker-image roller-pi:0.85.1 \
  --limit 1 \
  --output runs \
  --run-name pi-demo
```

## 4. Pi-specific flags {#pi-cli-flags}

This table lists Pi-specific runtime flags only. See section 3 for API addresses and keys. See the [CLI reference](/roller/start/cli-reference/) for flags shared by all Harnesses.

| Flag | Default and behavior |
| --- | --- |
| `--pi-image` | Takes precedence over `--docker-image`. If neither is set, `ROLLER_PI_IMAGE` is used, with `roller-pi:0.85.1` as the fallback |
| `--pi-max-steps` | At most 12 model requests per user message, also bounded by task and turn deadlines |
| `--pi-context-length` | 128000 by default, minimum 1024. Set it to match the actual model service |
| `--pi-output-tokens` | 8192 by default. Must be positive and smaller than the context window. Sent as `max_tokens` |
| `--pi-input-modalities` | `text,image` by default. Use `text` for a text-only model. It declares what the model accepts and does not add vision to the model service. Recorded in the run lock and checked on resume |
| `--thinking` / `runtime.thinking` | `off/minimal/low/medium/high/xhigh/max`. Defaults to `off`, with `none` as an alias |
| `--wire-trace` | Every mode records native requests. `full` additionally captures HTTP requests and requires an explicit API address with `--network host` |
| `--no-keep-thinking` | Removes reasoning only from ACTF/SFT. Native events and continuation history retain it |

Thinking is sent as `reasoning_effort`: `off` becomes `none`, and other levels retain their names. The endpoint must support the selected value. Vendor-specific thinking protocols are not translated automatically.

The same settings apply when Pi is the Task Agent or User Simulator. After changing the image, API address, or execution limits, use a new `--run-name` to avoid a conflict with the previous run configuration.

## 5. Multimodal capabilities

Pi enables seven native tools: `read`, `bash`, `edit`, `write`, `grep`, `find`, and `ls`. Vision-capable models and OpenAI-compatible services can open local images through `read`. Image results are preserved in the native trace, ACTF, and multimodal SFT.

Images enter the workspace through `files.inputs`. Task `messages[].content` currently accepts strings only and cannot contain image blocks directly. To send an input image with the first user message, list it in [`files.attach_images`](/roller/tasks/task-format/). It requires `--pi-input-modalities text,image`, the default. Text-only models can still process text and ordinary files, but they cannot complete tasks that require understanding image content. Video, other Pi provider protocols, and custom extensions or plugins are not currently supported.

## 6. Sessions and workspace

Each Agent or Simulator runs in an isolated container. Inputs are read-only, Context files are copied to their declared task paths, and output files are collected into the sample `results/` directory.

Multi-turn messages for the same participant reuse one Pi session, so conversation history and workspace files remain available. Pi starts a new Shell for every Bash call, so `export` and `cd` do not carry over automatically. Write persistent information to files or combine related work in one Bash command.

Collection does not enable automatic compaction, remote model updates, or custom extensions. Context and skill files remain readable by path.

## 7. Trajectories and request recording

A run produces three main trajectory files:

| File | Purpose |
| --- | --- |
| `trace.jsonl` | Records native Pi events and actual model requests for troubleshooting |
| `trace_ACTF.json` | Normalizes the conversation, reasoning, tool calls, and results |
| `trace_SFT.json` | Converts a successful trajectory into training-data format |

Empty replies, truncation, API errors, step-limit failures, or unmatched tool calls are not marked successful. A timeout stops the container and preserves available trajectories and result files when possible.

## 8. First-run check

For a first run, use one simple task and then check:

1. `info.json` in the run directory has `state` set to `finished`.
2. The sample `info.json` has `status` set to `ok`.
3. The sample contains `trace.jsonl`, `trace_ACTF.json`, and `trace_SFT.json`.
4. If the task creates files, the expected files exist under `results/`.

## 9. Common issues

**(1) A trajectory is not counted as successful**

Empty replies, truncation, API errors, step limits, and unmatched tool calls all fail. Inspect `trace.jsonl` to locate the cause.

**(2) Trajectory files were not generated**

Inspect the sample `info.json` and `trace.jsonl` first. If the reply was truncated or a tool call did not finish, raise `--pi-max-steps` or `--timeout` and retry.

**(3) Bash state disappears**

Pi starts a separate Shell per Bash call, so `export`/`cd` do not persist. Store persistent state in files or complete the work in a single command.

**(4) Long tasks exceed the context window**

Automatic compaction is disabled. Raise `--pi-context-length` to match the actual model service.

**(5) Task execution times out**

The container is stopped and the existing output files are recovered. Adjust `--timeout` or `--pi-max-steps` as needed.

**(6) `--wire-trace full` fails to start**

Set an explicit API address and keep `--network host` enabled.
