---
title: "OpenCode Harness guide"
---

# OpenCode Harness guide

The OpenCode Harness runs tasks through OpenCode Agent when they need file editing, shell commands, or local-image inspection. It connects to an OpenAI Chat Completions service with streaming and tool-call support. This guide follows the order needed for a first run: image, API, Harness-specific flags, sessions, and outputs.

Roller currently pins [OpenCode](https://opencode.ai/docs/cli/) 1.18.30. For Task fields, see [Task format reference](/roller/tasks/task-format/). For shared outputs, see [Trajectory output file guide](/roller/traces/trajectory-outputs/).

For a first run, complete sections 1 through 3 and run the example command. Read the later sections on Harness-specific flags, sessions, and trajectories when those features are needed.

## 1. Scope

Use the OpenCode Harness when a task needs:

- an OpenAI Chat Completions endpoint with streaming and tool calls.
- shell commands, content search, or file editing.
- local-image inspection with a vision-capable model.
- single-turn, multi-turn, Task Agent, or User Simulator execution.

Pass first-turn images through `files.attach_images`. Subagents are available with native tools and call capture. Long tasks need a sufficiently large context window because automatic compaction is disabled.

## 2. Image preparation

Pull the prebuilt image and give it the name Roller uses by default:

```bash
docker pull ghcr.io/valen-team/roller-opencode:1.18.30
docker tag ghcr.io/valen-team/roller-opencode:1.18.30 roller-opencode:1.18.30
```

The prebuilt image is `linux/amd64`. To build the image yourself instead, run this from the Roller repository root:

```bash
docker build -t roller-opencode:1.18.30 docker/opencode
```

The image contains the pinned OpenCode release and its runtime dependencies. The host does not need Node.js, Bun, or OpenCode. After the build, configure the API address, API key, and model ID in section 3.

The default base image is `python:3.12-slim-bookworm`, with Linux x86_64 and aarch64 support. For another base image, npm registry, or Debian mirror, see [Docker builds and package mirrors](/roller/start/docker-builds/).

## 3. Environment variables and API

The OpenCode Harness connects to an OpenAI Chat Completions service with streaming and tool-call support. A first run requires an API address, an API key, and a model ID.

| Setting | Default source | CLI override |
| --- | --- | --- |
| API address | `OPENAI_BASE_URL`, then `https://api.openai.com/v1` | `--opencode-api-base`, or `--api-base` for a single-Harness run |
| API key | `OPENAI_API_KEY` | `--opencode-api-key-env`, or `--api-key-env` for a single-Harness run |
| Model ID | The task `model` or `--model` | Sent to the API unchanged, with the internal `roller/` provider prefix added by OpenCode |

The value of `--opencode-api-key-env` or `--api-key-env` is the name of a host environment variable, not the key itself. The key is read at execution time and is not written to public configuration.

Replace `...`, the API address, and `model-id` with values from the model service. The following command runs a single task so that the configuration can be checked before a larger run:

```bash
export ROLLER_OPENCODE_KEY='...'

roller collect \
  --harness opencode \
  --tasks examples/tasks/tasks.jsonl \
  --model model-id \
  --api-base https://api.example.com/v1 \
  --api-key-env ROLLER_OPENCODE_KEY \
  --docker-image roller-opencode:1.18.30 \
  --limit 1 \
  --output runs \
  --run-name opencode-demo
```

## 4. OpenCode-specific flags {#opencode-cli-flags}

This table lists OpenCode-specific runtime flags only. See section 3 for API addresses and keys. See the [CLI reference](/roller/start/cli-reference/) for flags shared by all Harnesses.

| Option | Default / behavior |
| --- | --- |
| `--opencode-image` | Takes precedence over `--docker-image`. If neither is set, `ROLLER_OPENCODE_IMAGE` is used, with `roller-opencode:1.18.30` as the fallback |
| `--opencode-max-steps` | 100 for SkillsBench and 12 otherwise, also bounded by the task timeout |
| `--opencode-context-length` | 128000 tokens by default, minimum 1024. Set it to match the actual model |
| `--opencode-output-tokens` | Maximum output tokens requested per model call. Defaults to 32768 for SkillsBench and 8192 otherwise. Set a positive value below the context window |
| `--opencode-vision` / `--no-opencode-vision` | Declares image-input support to OpenCode. Enabled by default; can be disabled explicitly for text-only models |
| `--opencode-native-tools` | Off. Permits every tool in the native OpenCode registry instead of the fixed `bash/read/write/edit/apply_patch/glob/grep/skill` list. The `task` tool is permitted only with `--capture-calls` |
| `--opencode-deny-tool NAME` | Denies one native tool or permission under `--opencode-native-tools`. Repeat it as needed |
| `--thinking` / `runtime.thinking` | `off/minimal/low/medium/high/xhigh`. `off` maps to `none`. Provider support is required |
| `--wire-trace` | Native requests and tool definitions are captured in every mode. `full` adds HTTP records and requires an explicit API address with `--network host` |
| `--no-keep-thinking` | Removes reasoning from ACTF/SFT only. Native logs and continuation history are retained |

The same settings apply when OpenCode is the Task Agent or User Simulator. After changing the image, API address, context window, step limit, or tool selection, use a new `--run-name` to avoid a conflict with the previous run configuration.

## 5. Multimodal capabilities

OpenCode can use `bash`, `read`, `write`, `edit`, `apply_patch`, `glob`, and `grep`. Vision-capable models and services can open local images through `read`. For a text-only model, disable the image-input declaration with `--no-opencode-vision`.

Images enter the workspace through `files.inputs`, and `read` produces image attachments. Image results are preserved in the native trace, ACTF, and multimodal SFT. Task `messages[].content` currently accepts strings only and cannot contain image blocks directly. To send an input image with the first user message, list it in [`files.attach_images`](/roller/tasks/task-format/). It requires `--opencode-vision`, which is on by default.

## 6. Sessions and workspace

Each Agent or Simulator runs in an isolated container and does not read the host OpenCode configuration. Inputs are read-only, Context files are copied to their declared task paths, and output files are collected into the sample `results/` directory.

Multi-turn messages for the same participant resume one OpenCode session, so conversation history and workspace files remain available. Each turn starts a new CLI process, so background process handles do not persist.

Collection does not automatically share sessions, update OpenCode, or enable MCP, subagents, and network tools. Context and skill files remain readable by path.

`--opencode-native-tools` permits the remaining tools of the native registry, including network tools. Subagents stay tied to `--capture-calls`, and the Explore subagent keeps its `bash/read/glob/grep` profile. See [Harness tool availability](/roller/harnesses/tool-availability/).

## 7. Trajectories and request recording

A run produces three main trajectory files:

| File | Purpose |
| --- | --- |
| `trace.jsonl` | Records the native OpenCode session and actual model requests for troubleshooting |
| `trace_ACTF.json` | Normalizes the conversation, reasoning, tool calls, and results |
| `trace_SFT.json` | Converts a successful trajectory into training-data format |

Image attachments are preserved in ACTF and multimodal SFT. Tool definitions are taken from the actual model request and are not inferred from call arguments.

Incomplete sessions, empty replies, API errors, truncated replies, corrupt traces, or tool definitions that change unexpectedly are not marked successful. A timeout stops the container and recovers available trajectories and files. When the journal records a context overflow or a tool that is still running, ACTF keeps the observed turns and marks the trajectory unavailable for SFT.

## 8. First-run check

For a first run, use one simple task and then check:

1. `info.json` in the run directory has `state` set to `finished`.
2. The sample `info.json` has `status` set to `ok`.
3. The sample contains `trace.jsonl`, `trace_ACTF.json`, and `trace_SFT.json`.
4. If the task creates files, the expected files exist under `results/`.

## 9. Common issues

**(1) The endpoint does not support streaming or tool calls**

The OpenCode Harness requires streaming Chat Completions with tool calls. Use a compatible model service.

**(2) A trajectory fails**

Incomplete sessions, empty replies, API errors, truncated replies, missing or changed tool definitions, and corrupt JSONL all fail. Inspect `trace.jsonl` to locate the cause.

**(3) Long tasks exceed the context window**

Automatic compaction is disabled. Raise `--opencode-context-length` to match the actual capability of the service.

**(4) Task execution times out**

The container is stopped and the available artifacts are recovered. Adjust `--timeout` or `--opencode-max-steps` as needed.

**(5) `--wire-trace full` fails to start**

Set an explicit API address and keep `--network host` enabled.
