---
title: "Codex Harness guide"
---

# Codex Harness guide

The Codex Harness runs tasks through the Codex CLI when they require terminal, file, or image tools. It connects to a model service that supports the Responses API. This guide follows the order needed for a first run: image, API, Harness-specific flags, sessions, and outputs.

Roller currently pins Codex 0.172.0. For Task fields, see [Task format reference](/roller/tasks/task-format/). For shared outputs, see [Trajectory output file guide](/roller/traces/trajectory-outputs/).

For a first run, complete sections 1 through 3 and run the example command. Read the later sections on Harness-specific flags, thinking, and trajectories when those features are needed.

## 1. Scope

Use the Codex Harness when a task needs:

- a model service that implements the Responses API.
- shell commands, file editing, or local-image inspection through `view_image`.
- single-turn, multi-turn, Task Agent, or User Simulator execution.
- the native Codex session plus ACTF, SFT, and token-usage export.

An endpoint that only supports Chat Completions cannot be used directly. Task messages also cannot contain image blocks directly. Roller can preserve only the visible reasoning or summaries returned by the API; hidden reasoning cannot be recovered.

## 2. Image preparation

Pull the prebuilt image and give it the name Roller uses by default:

```bash
docker pull ghcr.io/valen-team/roller-codex:0.172.0
docker tag ghcr.io/valen-team/roller-codex:0.172.0 roller-codex:0.172.0
```

The prebuilt image is `linux/amd64`. The rest of this section describes building it yourself.

Roller uses [`docker/codex/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/codex/Dockerfile). The base image is
`node:22-bookworm-slim`, and the default pinned install is `@openai/codex@0.172.0`. The image also includes Git, ripgrep,
Python, curl, jq, an SSH client, and other common task tools.

Online environment:

```bash
docker pull --platform linux/amd64 node:22-bookworm-slim
docker build \
  --platform linux/amd64 \
  --build-arg CODEX_VERSION=0.172.0 \
  -f docker/codex/Dockerfile \
  -t roller-codex:0.172.0 \
  .
```

Offline base image:

```bash
docker load -i node-22-bookworm-slim-linux-amd64.tar.gz
docker build \
  --platform linux/amd64 \
  --build-arg CODEX_VERSION=0.172.0 \
  -f docker/codex/Dockerfile \
  -t roller-codex:0.172.0 \
  .
```

For `DEBIAN_MIRROR` and `DEBIAN_SECURITY_MIRROR`, see [Docker builds and package mirrors](/roller/start/docker-builds/). Set `NPM_REGISTRY` to override npm downloads, or leave it unset to keep the existing npm configuration.

If the default Debian mirrors are slow on the current network, override the mirror URLs at build time instead of
editing the Dockerfile:

```bash
docker build \
  --platform linux/amd64 \
  --build-arg CODEX_VERSION=0.172.0 \
  --build-arg DEBIAN_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian \
  --build-arg DEBIAN_SECURITY_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian-security \
  -f docker/codex/Dockerfile \
  -t roller-codex:0.172.0 \
  .
```

Verify the result:

```bash
docker run --rm roller-codex:0.172.0 codex --version
```

If the build machine and the collection machine do not share the same Docker daemon, export the image and load it on the target worker:

```bash
docker save -o roller-codex-0.172.0-linux-amd64.tar roller-codex:0.172.0
docker load -i roller-codex-0.172.0-linux-amd64.tar
```

Another already-built image can be selected through a command-line option or environment variable:

```bash
export ROLLER_CODEX_IMAGE=roller-codex:0.172.0
# Or: roller collect ... --docker-image roller-codex:0.172.0
```

Do not use the automatically changing `@openai/codex@latest` for a production collection. Roller writes the
actual `codex_version`, image tag, and image ID to the run and sample `info.json` files, so the environment can be verified later.

## 3. Environment variables and API

The Codex Harness requires a model service that implements the Responses API. A first run requires an API address, an API key, and a model ID. A working `/v1/chat/completions` route alone does not mean that Codex can run.

| Setting | Default source | CLI override |
| --- | --- | --- |
| API address | `OPENAI_BASE_URL` | `--codex-api-base`, or `--api-base` for a single-Harness run |
| API key | `OPENAI_API_KEY` | `--codex-api-key-env`, or `--api-key-env` for a single-Harness run |
| Model ID | The task `model` or `--model` | Sent to Codex unchanged |

Store the key in a host environment variable and pass its name to Roller:

```bash
export ROLLER_CODEX_KEY='...'

roller collect \
  --harness codex \
  --tasks examples/tasks/tasks.jsonl \
  --model model-id \
  --api-base https://api.example.com/v1 \
  --api-key-env ROLLER_CODEX_KEY \
  --docker-image roller-codex:0.172.0 \
  --limit 1 \
  --output runs \
  --run-name codex-demo
```

`--api-key-env` accepts an environment-variable name, not the key itself. With a custom API address, Roller uses Responses HTTP streaming by default. Keep the default `--no-codex-websockets` unless the service explicitly supports Responses WebSocket.

Keep the default `--wire-trace actf` and `--network host` in the example command so that Roller can record the tool definitions required for ACTF/SFT. If request recording is disabled, Roller still produces the native Codex trace and ACTF, but it does not export SFT without complete tool definitions.

## 4. Codex-specific flags {#codex-cli-flags}

This table lists Codex-specific runtime flags only. API addresses and keys are described in section 3. For the flags shared by all Harnesses, see the [CLI reference](/roller/start/cli-reference/).

| Flag | Default | Purpose |
| --- | --- | --- |
| `--docker-image` / `--codex-image` | `ROLLER_CODEX_IMAGE` or `roller-codex:0.172.0` | Override the Codex image |
| `--codex-config` | None | Inject a native `config.toml` into the isolated container |
| `--codex-config-set KEY=VALUE` | None | Append `-c KEY=VALUE` to every `codex exec`. Repeatable |
| `--reasoning-summary` | Codex default | `auto`, `concise`, `detailed`, or `none` |
| `--codex-web-search` | `disabled` | `disabled`, `cached`, or `live` |
| `--codex-websockets` / `--no-codex-websockets` | Off | Whether a custom provider uses Responses WebSocket |
| `--codex-image-detail` | None | `auto`, `low`, `high`, or `original`. Sets this `detail` on Responses image inputs that Codex sends without one |
| `--codex-tool-images-as-user` | Off | Attach tool-returned images as user image messages for backends that ignore images in tool outputs |
| `--codex-chat-completions` | Off | Translate the Responses requests of Codex to Chat Completions at the request recording proxy, for endpoints that serve only that API. Needed for [`--token-ids`](/roller/traces/token-ids/) |

A single Codex run can use the shared flag forms. In a mixed-Harness run, use the dedicated forms such as `--codex-image`, `--codex-api-base`, and `--codex-api-key-env` so that the settings apply only to the intended participant.

For a custom model provider, an MCP server, or another native Codex setting, provide a configuration file:

```bash
roller collect ... \
  --codex-config examples/config/codex/config.toml.example
```

Roller copies this file into the task container. Command-line values for the API address, model, thinking effort, reasoning summary, and Web Search take priority over the matching file settings. The example also contains `model_verbosity` and a disabled MCP server template. Use a new `--run-name` after changing the file, and do not store API keys in it.

To change individual settings without a file, use `--codex-config-set`:

```bash
roller collect ... \
  --codex-config-set 'model_verbosity="low"' \
  --codex-config-set model_providers.roller_api.stream_idle_timeout_ms=1800000
```

- Each setting is appended as `-c KEY=VALUE` after Roller's own overrides, on every turn. Values are parsed as TOML and fall back to a plain string; therefore, string values must be quoted.
- Codex silently ignores keys it does not recognize. Verify the spelling: a misspelled key has no effect, and only a value of the wrong type is reported as an error.
- With `--api-base` or `--codex-api-base`, the model provider that Roller defines is named `roller_api`. Its `stream_idle_timeout_ms` (300000 ms by default), `stream_max_retries` (5 by default), `request_max_retries` (4 by default), and similar keys can be changed. Without either flag, `model_providers.roller_api.*` keys are rejected. Keys that Roller manages, such as `base_url`, `wire_api`, and `env_key`, are rejected with a reference to the Roller flag to use instead, and settings must not overlap each other.
- Settings are recorded in `lock.json` and `info.json`. A value is redacted only when its own key name resembles a credential (`token`, `api_key`, `password`, `secret`, ...); inline TOML table values are recorded verbatim. Use a new `--run-name` after changing them, and do not pass secrets this way.

## 5. Multimodal capabilities

The Codex Harness supports both text-only models and vision-capable Responses models. Images enter the workspace through `files.inputs`, and Codex can open local images with its native `view_image` tool. Image tool results are preserved in the native trace, ACTF, and multimodal SFT, where SFT uses `<image>` placeholders and the top-level `images` field.

Vision tasks also require the Codex version, the selected model, and the Responses API service to support image input. Task `messages[].content` currently accepts strings only and cannot contain image blocks directly. To send an input image with the first user message, list it in [`files.attach_images`](/roller/tasks/task-format/). Text-only models can continue to process text and ordinary files, but they cannot complete tasks that require understanding image content.

Codex sends Responses `input_image` blocks without a `detail` field. For an endpoint that requires the field, set `--codex-image-detail` to `auto`, `low`, `high`, or `original`:

```bash
roller collect ... --harness codex --api-base https://example.test/v1 --codex-image-detail high
```

- The request recording proxy adds the value to every image input that has no `detail`, in user messages and in tool outputs. Blocks that already carry a `detail` and requests without such an image are forwarded unchanged.
- The flag requires the proxy: `--api-base`, the default `--network host`, `--no-codex-websockets`, and `--wire-trace actf` or `full`.
- The value is recorded in `lock.json` and `info.json` when it is set. Use a new `--run-name` after changing it.

For a Responses backend that accepts user images but ignores images returned by
`view_image`, enable `--codex-tool-images-as-user`:

```bash
roller collect ... --harness codex --api-base http://localhost:8000/v1 \
  --codex-tool-images-as-user \
  --codex-config-set features.enable_request_compression=false
```

The proxy keeps tool text in its original output and attaches the same image
bytes in a following user message. This setting was needed by the Kimi K3.1 Pro
backend in the [WildClawBench example](/roller/cookbook/wildclawbench-open-models/).
Leave it off for backends with native multimodal tool output support. Like image
detail, it requires the HTTP request proxy and is recorded when enabled.

## 6. Thinking configuration

`--thinking` sets Codex reasoning effort. If it is omitted, Codex, the model, and the service use their defaults.

Example:

```bash
roller collect ... \
  --harness codex \
  --thinking high \
  --reasoning-summary detailed
```

The Codex Harness passes `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, and `ultra` to Codex as reasoning effort. Actual support depends on the model and the API service. `off`, `none`, and the OpenClaw-specific `adaptive` value are not supported. For a new model, omit `--thinking` or begin with a level explicitly supported by the service.

`--reasoning-summary` controls visible reasoning summaries and accepts `auto`, `concise`, `detailed`, or `none`. If the service returns plaintext reasoning, Roller gives priority to that content. Encrypted-only reasoning does not appear in ACTF/SFT.

`--no-keep-thinking` clears ACTF/SFT `reasoning_content` only. It does not change the native Codex session or the continuation context.

## 7. Web Search

Codex disables Web Search by default. Change this setting only for tasks that require online information:

| Value | Behavior |
| --- | --- |
| `disabled` | Do not use Web Search. This is the default |
| `cached` | Prefer existing search results |
| `live` | Allow live web queries |

Example:

```text
--codex-web-search live
```

Searches are stored as tool calls in the trajectory; therefore, the query and the returned results can be inspected in Viewer.

## 8. Sessions and workspace

Each Agent or Simulator runs in an isolated disposable container and does not read host Codex accounts, configuration, or session history.

- Inputs are read-only and keep their Task Bundle relative paths.
- Context files are copied to their declared task paths. `AGENTS.md` follows the normal Codex discovery rules.
- `runtime.setup` runs before the first turn.
- The output directory remains writable and is collected into the sample `results/` directory.

Predefined multi-turn messages continue one Codex session, so conversation history and workspace files remain available in later turns.

### 8.1 User Simulator

Codex can act as either the Task Agent or the User Simulator. Configure the Harness and model separately at the task top level and under `user_simulator`. Each role keeps its own session in an isolated container.

## 9. Trajectories and request recording

A run produces the following main files:

| File | Purpose |
| --- | --- |
| `trace.jsonl` | Records native Codex session events for troubleshooting |
| `trace_ACTF.json` | Normalizes reasoning, replies, tool calls, and results |
| `tools_capture.jsonl` | Preserves the tool definitions used in actual model requests |
| `trace_SFT.json` | Converts a successful trajectory into training-data format |

### 9.1 `trace.jsonl`

This file preserves native Codex events, context, and token usage for troubleshooting. It is not the complete HTTP request sent to the model service, and its format may change with Codex versions.

### 9.2 `trace_ACTF.json`

ACTF groups reasoning, text, and tool calls from one response and pairs each result with its call. The system prompt and tool definitions come from the actual run.

### 9.3 `trace_SFT.json` and `sft.jsonl`

SFT keeps the Responses tool format used by Codex. Image samples add an `images` field. If tool definitions are missing, corrupt, or change across requests, Roller keeps the native trajectory but does not generate a potentially inaccurate SFT record.

### 9.4 Complete request records

The default `--wire-trace actf` keeps only the tool information required for ACTF/SFT. To inspect the complete request received by the model, use the following setting temporarily:

```text
--wire-trace full
```

The sample then retains complete request records. They can contain message text, tool arguments, and reasoning settings; therefore, they should be used only for troubleshooting or auditing. `--wire-trace off` records no request tool definitions. Codex still produces its native trace and ACTF, but it does not generate SFT without complete tool definitions.

## 10. First-run check

Keep `--limit 1` in the example command for the first run. After it finishes, check the following:

1. `info.json` in the run directory has `state` set to `finished`.
2. The sample `info.json` has `status` set to `ok`.
3. The sample contains `trace.jsonl`, `trace_ACTF.json`, and `trace_SFT.json`.
4. If the task creates files, the expected files exist under `results/`.

## 11. Common issues

**(1) `Codex requires a non-empty API key`**

The host variable referenced by `--api-key-env` is missing or empty. Verify the variable name. Do not put the key directly in the task.

**(2) `/responses` returns 404 or a protocol error**

The API service only has Chat Completions, or its Responses streaming/tool protocol is incompatible. Switch to a
Responses-capable service. For model services that support only Chat Completions, the OpenClaw Harness remains available.

**(3) `Codex native trace produced no assistant steps`**

Codex exited before producing a valid reply. Inspect the sample `info.json` and `trace.jsonl` first. For further troubleshooting, use `--keep-container-on-error` to retain the failed container and verify the `codex_version` recorded in `info.json`.

**(4) `invalid_encrypted_content` / `Encrypted content could not be decrypted or parsed`**

Codex always sends Responses requests with `store: false` and replays earlier `reasoning.encrypted_content` items, and Codex does not expose a setting to turn this off. Some relayed endpoints intermittently fail to verify reasoning they issued themselves. When the request recording proxy is active (the default `--wire-trace actf` with `--no-codex-websockets`), Roller resends the identical request up to 3 times when a 400 response has JSON `error.code` equal to `invalid_encrypted_content`, including gzip/deflate responses. Each retry is recorded as an `upstream_retry` entry in `--wire-trace full` records. Stopping the proxy cancels pending retries. If every attempt fails, the error still ends the rollout. Persistent failures require a fix on the endpoint side.

**(5) `apply_patch: command not found`**

Codex adds its `apply_patch` alias to `PATH` at runtime, but Debian's `/etc/profile` resets `PATH` in the login shells that Codex uses to run commands. The current `docker/codex/Dockerfile` installs a fixed `/usr/local/bin/apply_patch` alias; images built before this change must be rebuilt.

**(6) `idle timeout waiting for SSE` or `stream disconnected before completion`**

Codex drops a streaming response after 5 minutes without data (`stream_idle_timeout_ms`, 300000 ms by default) and retries up to 5 times, each retry making the model generate again. Services that do not stream tool-call arguments trip this timeout when the model writes long arguments. With `--api-base` or `--codex-api-base`, raise the idle timeout of Roller's provider:

```bash
roller collect ... \
  --codex-config-set model_providers.roller_api.stream_idle_timeout_ms=1800000
```
