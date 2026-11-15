---
title: "Claude Code Harness guide"
---

# Claude Code Harness guide

The Claude Code Harness runs tasks through Claude Code when they need terminal, file, or image tools. It connects to an Anthropic Messages-compatible service. This guide follows the order needed for a first run: image, API, Harness-specific flags, sessions, and outputs.

Roller currently pins Claude Code 2.1.222. For Task fields, see [Task format reference](/roller/tasks/task-format/). For shared outputs, see [Trajectory output file guide](/roller/traces/trajectory-outputs/).

For a first run, complete sections 1 through 3 and run the example command. Read the later sections on Harness-specific flags, thinking, and trajectories when those features are needed.

## 1. Scope

Use the Claude Code Harness when a task needs:

- a model service that implements Anthropic `/v1/messages`.
- shell commands, file editing, or local-image inspection through the `Read` tool.
- single-turn, multi-turn, Task Agent, or User Simulator execution.
- the native Claude Code session plus ACTF, SFT, and token-usage export.

An endpoint that only supports OpenAI Chat Completions or Responses cannot be used directly. Task messages also cannot contain image blocks directly. Roller can preserve only visible thinking or summaries returned by the API, not hidden reasoning.

## 2. Image preparation

No prebuilt image is published for Claude Code, because its licence does not allow redistribution. Build it locally.

Roller uses [`docker/claude-code/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/claude-code/Dockerfile). The base image is
`node:22-bookworm-slim`, and the default pinned install is `@anthropic-ai/claude-code@2.1.222`. The Node 22
offline archive already used by Codex can be reused, so the base image does not need to be downloaded again.

Online base image:

```bash
docker pull --platform linux/amd64 node:22-bookworm-slim
docker build \
  --platform linux/amd64 \
  --build-arg CLAUDE_CODE_VERSION=2.1.222 \
  -f docker/claude-code/Dockerfile \
  -t roller-claude-code:2.1.222 \
  .
```

Offline base image:

```bash
docker load -i node-22-bookworm-slim-linux-amd64.tar.gz
docker build \
  --platform linux/amd64 \
  --build-arg CLAUDE_CODE_VERSION=2.1.222 \
  -f docker/claude-code/Dockerfile \
  -t roller-claude-code:2.1.222 \
  .
```

For `DEBIAN_MIRROR` and `DEBIAN_SECURITY_MIRROR`, see [Docker builds and package mirrors](/roller/start/docker-builds/). Set `NPM_REGISTRY` to override npm downloads, or leave it unset to keep the existing npm configuration.

When the default Debian mirrors are unreachable, pass mirror URLs:

```bash
docker build \
  --platform linux/amd64 \
  --build-arg CLAUDE_CODE_VERSION=2.1.222 \
  --build-arg DEBIAN_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian \
  --build-arg DEBIAN_SECURITY_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian-security \
  -f docker/claude-code/Dockerfile \
  -t roller-claude-code:2.1.222 \
  .
```

Verify and set the default image:

```bash
docker run --rm roller-claude-code:2.1.222 claude --version
export ROLLER_CLAUDE_CODE_IMAGE=roller-claude-code:2.1.222
```

Production datasets should pin the Claude Code version. Native session fields, permission modes, and effort lists change
between CLI versions. Roller writes the actual `claude_code_version`, image tag, and image ID into run/sample info.

## 3. Environment variables and API

The Claude Code Harness needs a model service that implements the Anthropic Messages API. A first run requires an API address, an API key, and a model ID.

| Setting | Default source | CLI override |
| --- | --- | --- |
| API address | `ANTHROPIC_BASE_URL` | `--claude-api-base`, or `--api-base` for a single-Harness run |
| API key | `ANTHROPIC_API_KEY` | `--claude-api-key-env`, or `--api-key-env` for a single-Harness run |
| Model ID | The task `model` or `--model` | Sent to Claude Code unchanged |

Store the key in a host environment variable and pass its name to Roller:

```bash
export ROLLER_ANTHROPIC_KEY='...'

roller collect \
  --harness claude-code \
  --tasks examples/tasks/tasks.jsonl \
  --model model-id \
  --api-base https://api.example.com/v1/messages \
  --api-key-env ROLLER_ANTHROPIC_KEY \
  --docker-image roller-claude-code:2.1.222 \
  --limit 1 \
  --output runs \
  --run-name claude-code-demo
```

`--api-key-env` accepts an environment-variable name, not the key itself. The API address may end at the service host, at `/v1`, or at the full `/v1/messages` path. Roller normalizes the address so that `/v1/messages` is not appended twice.

If a model appears in the model list but execution still fails, send a minimal request to `/v1/messages` to confirm that the current account can call the model. Only a successful `/v1/messages` request confirms Claude Code compatibility.

## 4. Claude Code-specific flags {#claude-code-cli-flags}

This table lists Claude Code-specific runtime flags only. See section 3 for API addresses and keys. See the [CLI reference](/roller/start/cli-reference/) for flags shared by all Harnesses.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--docker-image` / `--claude-code-image` | `ROLLER_CLAUDE_CODE_IMAGE` or `roller-claude-code:2.1.222` | Override the Claude Code image |
| `--claude-settings` | None | Inject a native `settings.json` into the isolated container. The run lock stores its SHA-256, and locks that hold the earlier BLAKE2b fingerprint remain resumable |
| `--claude-max-turns` | None | Limit agent turns for each predefined user message |
| `--claude-max-thinking-tokens` | None | Set `MAX_THINKING_TOKENS` for Claude Code |
| `--claude-permission-mode` | `bypassPermissions` | Select the Claude Code permission mode |
| `--claude-unique-tool-ids` | Off | Replace tool-call IDs that the API service issues more than once before Claude Code receives them, see section 9.5 |

A single Claude Code run can use the shared flag forms. In a mixed-Harness run, use dedicated forms such as `--claude-code-image`, `--claude-api-base`, and `--claude-api-key-env` so that the settings apply only to the intended participant.

## 5. Multimodal capabilities

The Claude Code Harness supports both text-only and vision-capable models. Images enter the workspace through `files.inputs`, and Claude Code can open local images with its native `Read` tool. Image tool results are preserved in the native trace, ACTF, and multimodal SFT, where SFT uses `<image>` placeholders and the top-level `images` field.

Vision tasks also require the selected model and Anthropic-compatible API service to support image content blocks. Task `messages[].content` currently accepts strings only and cannot contain image blocks directly. To send an input image with the first user message, list it in [`files.attach_images`](/roller/tasks/task-format/). Text-only models can still process text and ordinary files, but they cannot complete tasks that require understanding image content.

## 6. Thinking configuration

`--thinking` sets Claude Code reasoning effort. If omitted, Claude Code and the model use their defaults.

| Roller value | Claude Code value | Meaning |
| --- | --- | --- |
| omitted | no `--effort` | Use the default behavior |
| `low` | `low` | Lower reasoning effort |
| `medium` | `medium` | Medium reasoning effort |
| `high` | `high` | Higher reasoning effort |
| `xhigh` | `xhigh` | Use only when the model supports it |
| `max` | `max` | Use only when the model supports it |
| `ultra` | `ultracode` | Roller name mapped to the Claude Code name |

`off`, `none`, `minimal`, and `adaptive` have no matching Claude Code level and fail before startup. For a new model, omit `--thinking` or start with a level that the service explicitly supports.

To limit thinking tokens, also use:

```text
--claude-max-thinking-tokens 4096
```

Models support token limits in different ways. If the service rejects this flag, remove it and keep only `--thinking`.

Visible thinking, reasoning, or analysis returned by Claude Code is written to ACTF/SFT `reasoning_content`. The field can be empty when the service returns only a token count or encrypted content. `--no-keep-thinking` clears exported ACTF/SFT reasoning without changing the native session.

## 7. Claude settings and permissions

To use native Claude Code settings, provide a settings file:

```bash
roller collect ... \
  --claude-settings examples/config/claude-code/settings.json.example
```

Roller copies the file into the current container and loads it explicitly. Do not reuse an old run directory after changing the settings. The example contains no API key, hooks, or additional permission grants.

Automated collection defaults to `bypassPermissions` so execution does not stop at an interactive prompt. `--claude-permission-mode` can select another mode supported by the pinned Claude Code version. `--claude-max-turns` limits agent turns within each user message, not the number of task messages.

## 8. Sessions and workspace

Each Agent or Simulator runs in an isolated disposable container and does not read host Claude login data, settings, or session history.

- Inputs are read-only and keep their Task Bundle relative paths.
- Context files are copied to their declared task paths. For Claude Code to discover project instructions automatically, name the target `CLAUDE.md`.
- `runtime.setup` runs before the first turn.
- The output directory remains writable and is collected into the sample `results/` directory.

Predefined multi-turn messages continue one Claude Code session, so conversation history and workspace files remain available in later turns.

## 9. Trajectories and request recording

A run produces the following main files:

| File | Purpose |
| --- | --- |
| `trace.jsonl` | Merges native events from the main Claude Code session and subagents for troubleshooting |
| `trace_ACTF.json` | Normalizes text, thinking, tool calls, and results |
| `trace_SFT.json` | Converts one successful trajectory into training-data format |
| `sft.jsonl` | Collects trainable successful samples from the run |

### 9.1 `trace.jsonl`

This file preserves native Claude Code session events, including visible thinking, tool information, and token usage. It is neither terminal output nor the complete HTTP request sent to the model service. Its format may change with Claude Code versions.

### 9.2 `trace_ACTF.json`

ACTF groups text, reasoning, and multiple tool calls from one response and pairs each result with its call. Main-session and subagent events remain in time order, and streaming usage updates are deduplicated.

### 9.3 `trace_SFT.json` and `sft.jsonl`

SFT uses shared `messages` and `tools` fields. Native Claude tool calls become trainable function calls, and image samples add an `images` field.

### 9.4 Wire trace

The default `--wire-trace actf` captures system prompts and tool definitions for ACTF/SFT without retaining full requests. To inspect exactly what the model received, temporarily use:

```text
--wire-trace full
```

The sample then also contains `wire_trace.jsonl`. This file can contain complete messages, tool arguments, and thinking settings; use it only for troubleshooting or auditing. `--wire-trace off` keeps the native Claude Code session but records no request details.

### 9.5 Repeated tool-call IDs

Some Anthropic-compatible services issue the same `tool_use` ID in more than one response, for example `call_0` in every response. Claude Code then holds two calls with one ID, and a later request can be rejected or paired with the wrong result.

ACTF conversion keeps such calls apart when the earlier call already has its result: the later call becomes `<id>__occurrence_<n>`, its result follows it, and the call records the native ID as `original_tool_call_id`. When an ID is reused before the earlier result arrives, the pairing is ambiguous and conversion fails.

To repair the IDs during the run, add `--claude-unique-tool-ids`:

```bash
roller collect ... --harness claude-code --api-base https://example.test --claude-unique-tool-ids
```

- The request recording proxy replaces a repeated ID with a new `toolu_roller_...` ID in streamed and non-streamed Messages responses. Claude Code, `trace.jsonl`, ACTF, and the recorded requests all use the delivered ID.
- Each replacement is written to `tool_id_mappings.jsonl` in the sample directory, with `native_id` and `delivered_id`.
- The proxy asks the service for uncompressed responses while the flag is set, because a compressed response cannot be rewritten.
- The flag requires the proxy: `--api-base` and `--wire-trace actf` or `full`.
- The flag is recorded in `lock.json` and `info.json` when it is set. Use a new `--run-name` after changing it.

## 10. First-run check

For a first run, use one simple task and then check:

1. `info.json` in the run directory has `state` set to `finished`.
2. The sample `info.json` has `status` set to `ok`.
3. The sample contains `trace.jsonl`, `trace_ACTF.json`, and `trace_SFT.json`.
4. A multi-turn trajectory contains every user message and corresponding reply.
5. If the task creates files, the expected files exist under `results/`.

## 11. Common issues

**(1) `Invalid token`**

Check the host environment variable named by `--api-key-env`.

**(2) `No available channel for model`**

The model appears in the list, but the current account or group has no available route.

**(3) URL shows `/v1/v1/messages`**

Do not pass `ANTHROPIC_BASE_URL` into the container manually. Use Roller's `--api-base` so that Roller can normalize the address.

**(4) `invalid beta flag`**

Use an explicit `--api-base` and keep the default `--wire-trace actf`. Roller removes incompatible beta parameters while forwarding the request.

**(5) The model rejects `budget_tokens` or requires adaptive thinking**

Remove `--claude-max-thinking-tokens` and use only a `--thinking` effort that the model supports.

**(6) ACTF has thinking tokens but `reasoning_content` is empty**

The service did not return plaintext. The empty field is not caused by the converter.

**(7) Requests are interrupted or retried while the model writes long tool arguments**

Some services do not stream tool-call arguments. While the model writes a long argument, the connection can remain idle for minutes. Claude Code's streaming idle timeout is `CLAUDE_STREAM_IDLE_TIMEOUT_MS` (300000 ms by default; smaller values have no effect) and its request timeout is `API_TIMEOUT_MS` (600000 ms by default). Both are environment variables that Claude Code reads directly. Set them in the `env` block of the `--claude-settings` file:

```json
{
  "env": {
    "CLAUDE_STREAM_IDLE_TIMEOUT_MS": "1800000",
    "API_TIMEOUT_MS": "3000000"
  }
}
```

Alternatively, set them on the host and pass them with `--pass-env`:

```bash
export CLAUDE_STREAM_IDLE_TIMEOUT_MS=1800000 API_TIMEOUT_MS=3000000
roller collect ... \
  --pass-env CLAUDE_STREAM_IDLE_TIMEOUT_MS \
  --pass-env API_TIMEOUT_MS
```
