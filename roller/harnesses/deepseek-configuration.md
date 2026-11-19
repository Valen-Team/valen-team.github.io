---
title: "DeepSeek Harness guide"
---

# DeepSeek Harness guide

The DeepSeek Harness runs text and file tasks through the official DeepSeek Harness. It connects to a Chat Completions service with streaming, tool calls, and DeepSeek thinking fields. This guide follows the order needed for a first run: image, API, Harness-specific flags, sessions, and outputs.

Roller currently pins the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 0.1.5rc1 and uses the `sdk-minimal` tool configuration, which provides Bash only. For Task fields, see [Task format reference](/roller/tasks/task-format/). For shared outputs, see [Trajectory output file guide](/roller/traces/trajectory-outputs/).

For a first run, complete sections 1 through 3 and run the example command. Read the later sections on Harness-specific flags, tool limits, and trajectories when those features are needed.

## 1. Scope

Use the DeepSeek Harness when a task needs:

- a Chat Completions endpoint compatible with DeepSeek thinking fields.
- one persistent Bash environment for text and ordinary file work.
- single-turn, multi-turn, Task Agent, or User Simulator execution.
- ACTF, SFT, token usage, and result-file export.

This tool configuration has no image viewer, so it is not suitable for tasks that require visual understanding. Interactive login, custom plugins, and memory across tasks are also not supported.

## 2. Image preparation

Pull the prebuilt image and give it the name Roller uses by default:

```bash
docker pull ghcr.io/valen-team/roller-deepseek:0.1.5rc1
docker tag ghcr.io/valen-team/roller-deepseek:0.1.5rc1 roller-deepseek:0.1.5rc1
```

The prebuilt image is `linux/amd64`. To build the image yourself instead, run this from the Roller repository root:

```bash
docker build -t roller-deepseek:0.1.5rc1 docker/deepseek
```

The image contains the official SDK and runtime. The host does not need a separate DeepSeek Harness installation. After the build, configure the API address, API key, and model ID in section 3.

The default base image is `python:3.12-slim`, with Linux x86_64 and aarch64 support. For another base image or Debian mirror, see [Docker builds and package mirrors](/roller/start/docker-builds/).


### E2B for WildClawBench

Use Python 3.11 or later on the collector and install the `e2b` extra from the
Roller checkout. The [template recipe](https://github.com/Valen-Team/Roller/tree/main/docker/wildclawbench#e2b-template)
uses the same pinned Harness runtime. With the template built, set `E2B_API_KEY`
on the collector and pass `--sandbox-provider e2b --sandbox-template "$E2B_TEMPLATE"`
to a single-agent WildClawBench collection. Configure actor and judge endpoints
that the sandbox can reach. Roller records the template build in the run and
releases the instance after collecting the outputs and grader result.

## 3. Environment variables and API

The DeepSeek Harness connects to a Chat Completions service that supports streaming, tool calls, and DeepSeek thinking fields. A first run requires an API address, an API key, and a model ID.

| Setting | Default source | CLI override |
| --- | --- | --- |
| API address | `DEEPSEEK_BASE_URL`, then `https://api.deepseek.com` | `--deepseek-api-base`, or `--api-base` for a single-Harness run |
| API key | `DEEPSEEK_API_KEY` | `--deepseek-api-key-env`, or `--api-key-env` for a single-Harness run |
| Model ID | The task `model` or `--model` | Sent to the service unchanged |

The value of `--deepseek-api-key-env` or `--api-key-env` is the name of a host environment variable, not the key itself. The key is read at execution time and is not written to the task, run configuration, or public outputs.

Replace `...`, the API address, and `model-id` with values from the model service. The following command runs a single task so that the configuration can be checked before a larger run:

```bash
export ROLLER_DEEPSEEK_KEY='...'

roller collect \
  --harness deepseek \
  --tasks examples/tasks/tasks.jsonl \
  --model model-id \
  --api-base https://api.example.com/v1 \
  --api-key-env ROLLER_DEEPSEEK_KEY \
  --docker-image roller-deepseek:0.1.5rc1 \
  --limit 1 \
  --output runs \
  --run-name deepseek-demo
```

## 4. DeepSeek-specific flags {#deepseek-cli-flags}

This table lists DeepSeek-specific runtime flags only. See section 3 for API addresses and keys. See the [CLI reference](/roller/start/cli-reference/) for flags shared by all Harnesses.

| Option | Default / behavior |
| --- | --- |
| `--deepseek-image` | Takes precedence over `--docker-image`. If neither is set, `ROLLER_DEEPSEEK_IMAGE` is used, with `roller-deepseek:0.1.5rc1` as the fallback |
| `--deepseek-profile NAME` | `sdk-minimal` by default, which provides Bash only. `sdk` selects the full native profile with its file, search, and shell tools |
| `--deepseek-permission-mode MODE` | Accepts `read-only`, `workspace-write`, or `danger-full-access`, and applies inside the task container only. When unset, `sdk-minimal` keeps its own mode and every other profile runs with `danger-full-access`, because the file sandbox those profiles default to has no backend in the container |
| `--deepseek-input-modalities` | `text` by default. `text,image` declares that the model accepts images, which lets the `read_image` tool of the `sdk` profile send them. It does not add vision to the model service |
| `--deepseek-max-steps` | 12 model requests per user turn. Task and conversation deadlines also apply |
| `--deepseek-context-length` | 128000 tokens by default, minimum 1024. Set it to match the endpoint |
| `--deepseek-output-tokens` | 8192 by default. Must be positive and smaller than the context window |
| `--thinking` / `runtime.thinking` | Natively supports `off/low/high/max`. `none` is an alias of `off`. If omitted, the DeepSeek Harness default applies |
| `--wire-trace` | Controls request recording. `full` also saves complete HTTP requests and requires an explicit API address with `--network host` |
| `--no-keep-thinking` | Removes reasoning from ACTF/SFT only. Native history is retained |

The same settings apply when DeepSeek is the Task Agent or User Simulator. After changing the image, API address, profile, permission mode, step limit, or token limits, use a new `--run-name` to avoid a conflict with the previous run configuration.

## 5. Multimodal capabilities

The default `sdk-minimal` configuration provides one persistent `bash` tool and no image viewer, so it supports text and ordinary file tasks only.

To let the model see images, select `--deepseek-profile sdk` and add `--deepseek-input-modalities text,image`. Image files enter the workspace through `files.inputs`, and the model opens them with the `read_image` tool. The images it reads are kept in ACTF and SFT with the tool result that returned them. Task `messages[].content` accepts strings only, and `files.attach_images` is not supported.

## 6. Sessions and workspace

Each Agent or Simulator runs in an isolated container. Inputs are read-only, Context files are copied to their declared task paths, and output files are collected into the sample `results/` directory.

Multi-turn messages for the same participant reuse one DeepSeek session and Bash environment. Conversation history, workspace files, shell variables, and the current working directory persist, so later turns can continue from earlier state.

## 7. Tools and capability limits

The current `sdk-minimal` configuration provides one persistent `bash` tool. File operations and content search also use Bash commands. Separate image, Web, MCP, and subagent tools are not available.

`--deepseek-profile sdk` selects the full native profile instead. Its tools come from the SDK, and its Bash tool starts a separate process for each call, so shell variables do not persist between calls while files and the session do. The delegation tools of that profile (`subagent`, `subagent_fork`, `list_agents`, `interrupt_agent`, `send_message`, `workflow`, and `ralph`) are not offered to the model. See [Harness tool availability](/roller/harnesses/tool-availability/).

Automatic compaction is disabled. Long tasks need a sufficiently large `--deepseek-context-length`, and the selected endpoint must support the DeepSeek request format and thinking fields.

## 8. Trajectories and request recording

A run produces three main trajectory files:

| File | Purpose |
| --- | --- |
| `trace.jsonl` | Records native DeepSeek SDK events and actual model requests for troubleshooting |
| `trace_ACTF.json` | Normalizes the conversation, reasoning, Bash calls, and results |
| `trace_SFT.json` | Converts a successful trajectory into training-data format |

Errors, truncation, empty replies, incomplete tool calls, or content that cannot be preserved completely are not marked successful. A timeout stops the container and preserves available trajectories and result files when possible.

## 9. First-run check

For a first run, use one simple task and then check:

1. `info.json` in the run directory has `state` set to `finished`.
2. The sample `info.json` has `status` set to `ok`.
3. The sample contains `trace.jsonl`, `trace_ACTF.json`, and `trace_SFT.json`.
4. If the task creates files, the expected files exist under `results/`.

## 10. Common issues

**(1) A trajectory is rejected**

Errors, truncated or empty replies, incomplete tool calls, and content that cannot be represented losslessly as text are all rejected. Inspect `trace.jsonl` to locate the cause.

**(2) Long tasks exceed the context window**

Automatic compaction is disabled. Raise `--deepseek-context-length` to match the actual service.

**(3) Task execution times out**

The container is stopped and the available artifacts are recovered. Adjust `--timeout` or `--deepseek-max-steps` as needed.

**(4) An existing run cannot be resumed**

An old run cannot be resumed safely after the image, API address, or runtime settings change. Use a new `--run-name`.

**(5) `--wire-trace full` fails to start**

Set an explicit API address and keep `--network host` enabled.
