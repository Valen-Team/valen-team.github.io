---
title: "Hermes Harness guide"
---

# Hermes Harness guide

The Hermes Harness runs tasks through Hermes Agent with terminal, file, and optional image tools. It connects to an OpenAI Chat Completions service with tool-call support and does not require a separate Hermes gateway. This guide follows the order needed for a first run: image, API, Harness-specific flags, sessions, and outputs.

Roller uses the Python interface from [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent), currently pinned to 0.21.1. For Task fields, see [Task format reference](/roller/tasks/task-format/). For shared outputs, see [Trajectory output file guide](/roller/traces/trajectory-outputs/).

For a first run, complete sections 1 through 3 and run the example command. Read the later sections on Harness-specific flags, sessions, and trajectories when those features are needed.

## 1. Scope

Use the Hermes Harness when a task needs:

- an OpenAI Chat Completions endpoint with tool-call support.
- terminal and file tools, or `vision_analyze` for local images.
- single-turn, multi-turn, Task Agent, or User Simulator execution.
- ACTF, SFT, token usage, and result-file export.

The Hermes Harness does not currently accept images or video directly in task messages. Remote terminals, persistent memory, and automatic skill learning are also outside its scope.

## 2. Image preparation

Pull the prebuilt image and give it the name Roller uses by default:

```bash
docker pull ghcr.io/valen-team/roller-hermes:d15ed4445207
docker tag ghcr.io/valen-team/roller-hermes:d15ed4445207 roller-hermes:d15ed4445207
```

The prebuilt image is `linux/amd64`. To build the image yourself instead, run this from the Roller repository root:

```bash
docker build -t roller-hermes:d15ed4445207 docker/hermes
```

The image contains Hermes and its Python dependencies. The host does not need a separate Hermes installation or gateway. After the build, configure the API address, API key, and model ID in section 3.

This version requires a model context window of at least 64,000 tokens. If the service reports the wrong size, set `--hermes-context-length` to the actual supported value.

The default base image uses Python 3.11. For another base image or package mirror, see [Docker builds and package mirrors](/roller/start/docker-builds/). `PIP_INDEX_URL` and `PYPI_DOWNLOAD_BASE` are only needed when the normal dependency sources are unavailable.

## 3. Environment variables and API

The Hermes Harness connects to an OpenAI Chat Completions service with tool-call support. It does not require a separate Hermes gateway. A first run requires an API address, an API key, and a model ID.

| Setting | Default source | CLI override |
| --- | --- | --- |
| API address | `OPENAI_BASE_URL`, then `https://api.openai.com/v1` | `--hermes-api-base`, or `--api-base` for a single-Harness run |
| API key | `OPENAI_API_KEY` | `--hermes-api-key-env`, or `--api-key-env` for a single-Harness run |
| Model ID | The task `model` or `--model` | Sent to the service unchanged |

The value of `--hermes-api-key-env` or `--api-key-env` is the name of a host environment variable, not the key itself. The key is read at execution time and is not written to public examples or run configuration.

Replace `...`, the API address, and `model-id` with values from the model service. The following command runs a single task so that the configuration can be checked before a larger run:

```bash
export ROLLER_HERMES_KEY='...'

roller collect \
  --harness hermes \
  --tasks examples/tasks/tasks.jsonl \
  --model model-id \
  --api-base https://api.example.com/v1 \
  --api-key-env ROLLER_HERMES_KEY \
  --docker-image roller-hermes:d15ed4445207 \
  --limit 1 \
  --output runs \
  --run-name hermes-demo
```

## 4. Hermes-specific flags {#hermes-cli-flags}

This table lists Hermes-specific runtime flags only. See section 3 for API addresses and keys. See the [CLI reference](/roller/start/cli-reference/) for flags shared by all Harnesses.

| Option | Default / behavior |
| --- | --- |
| `--hermes-image` | Takes precedence over the shared `--docker-image`. If neither is set, `ROLLER_HERMES_IMAGE` is used, with `roller-hermes:d15ed4445207` as the fallback |
| `--hermes-context-length` | Optional context window override, at least 64000 tokens |
| `--hermes-max-iterations` | `12` model iterations per user turn. The total task timeout also applies |
| `--hermes-vision` / `--no-hermes-vision` | Enables `vision_analyze` and declares that the selected model accepts image input. Enabled by default |
| `--hermes-toolset NAME` | Replaces the default `terminal`, `file`, and optional `vision` toolsets with the named Hermes toolsets. Repeat it to select several. `native` leaves the selection to Hermes' own toolset discovery. The `delegation` toolset is available only with `--capture-calls` |
| `--thinking` / `runtime.thinking` | Optional native reasoning hint: `off/minimal/low/medium/high/xhigh`. Actual support and normalization depend on Hermes and the provider/model |
| `--wire-trace` | Native request records always preserve tool definitions and assembled prompts. `full` also records HTTP traffic and requires an explicit API address with `--network host` |
| `--no-keep-thinking` | Removes reasoning from ACTF/SFT export. The native history remains available |

The same settings apply when Hermes is the Task Agent or User Simulator. After changing the image, API address, iteration limit, or toolsets, use a new `--run-name` to avoid a conflict with the previous run configuration.

## 5. Multimodal capabilities

Hermes provides terminal, file, and optional image tools. When both the model and API service accept image input, `vision_analyze` can open a local image. For a text-only model, disable the image tool with `--no-hermes-vision`.

Images enter the workspace through `files.inputs`, and image-tool results are preserved in the native trace, ACTF, and multimodal SFT. Task `messages[].content` accepts strings only and cannot contain image blocks directly. `files.attach_images` is not supported. Video and remote terminals are not supported.

## 6. Sessions and workspace

Each Agent or Simulator runs in an isolated disposable container. Inputs are read-only, Context files are copied to their declared task paths, and output files are collected into the sample `results/` directory.

Conversation history and workspace files persist across turns for the same participant. Each turn starts a new Python agent process, so in-memory state such as background process handles does not persist. Store information that a later turn needs in workspace files.

Persistent Hermes memory and automatic skill learning are disabled during collection. Tasks can still read Context and skill files by path.

Toolsets selected with `--hermes-toolset` run inside the same container. Toolsets that call external services need their dependencies in the image and their credentials passed through `--pass-env` or the task's `runtime.env`. See [Harness tool availability](/roller/harnesses/tool-availability/).

## 7. Trajectories and request recording

A run produces three main trajectory files:

| File | Purpose |
| --- | --- |
| `trace.jsonl` | Records the actual Hermes requests, model replies, tool calls, and usage for troubleshooting |
| `trace_ACTF.json` | Normalizes events across Harnesses for inspection and comparison |
| `trace_SFT.json` | Converts a successful trajectory into training-data format |

Image-tool results remain in the trajectory. Some compatible services reject images on a `tool` message. In that case Roller adjusts the message sent to the service while preserving the original tool result in `trace.jsonl`.

Incomplete turns, empty replies, malformed tool arguments, or invalid JSONL are not marked successful. A timeout stops execution and preserves available trajectories and result files when possible.

## 8. First-run check

For a first run, use one simple task and then check:

1. `info.json` in the run directory has `state` set to `finished`.
2. The sample `info.json` has `status` set to `ok`.
3. The sample contains `trace.jsonl`, `trace_ACTF.json`, and `trace_SFT.json`.
4. If the task creates files, the expected files exist under `results/`.

## 9. Common issues

**(1) The endpoint reports a context window error**

This revision requires at least 64,000 tokens. Set `--hermes-context-length` to the context size supported by the model.

**(2) A trajectory is not counted as successful**

Incomplete turns, empty final replies, malformed tool arguments or definitions, and corrupt JSONL all fail. Inspect `trace.jsonl` to locate the cause.

**(3) Task execution times out**

Execution is stopped and the available artifacts are retained. Adjust `--timeout` or `--hermes-max-iterations` as needed.

**(4) An existing run cannot be resumed**

An old run cannot be resumed safely after the image, API address, or runtime settings change. Use a new `--run-name`.

**(5) `--wire-trace full` fails to start**

Set an explicit API address and keep `--network host` enabled.
