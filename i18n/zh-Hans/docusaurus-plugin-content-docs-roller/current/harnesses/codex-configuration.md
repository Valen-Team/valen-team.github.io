---
title: "Codex Harness 指南"
---

# Codex Harness 指南

Codex Harness 用于通过 Codex CLI 执行需要终端、文件或图片工具的 task。它连接支持 Responses API 的模型服务。本页按照镜像、API、专属参数、session 和轨迹的顺序介绍首次使用所需内容。

Roller 当前固定使用 Codex 0.172.0。Task 字段见 [Task 格式参考](/roller/tasks/task-format/)，通用产物见 [轨迹产出文件指南](/roller/traces/trajectory-outputs/)。

首次使用时，先完成第 1 至第 3 节并运行示例命令。后续的专属参数、Thinking 和轨迹说明可在需要相应功能时查阅。

## 1. 适用范围

Codex Harness 适用于以下场景：

- 使用实现 Responses API 的模型服务。
- 由 Agent 运行命令、读写文件或通过 `view_image` 查看图片。
- 运行单轮、多轮、Task Agent 或 User Simulator task。
- 需保留 Codex 原生 session，并导出 ACTF、SFT 和 token 使用量。

仅支持 Chat Completions 的服务不能直接使用本 Harness。Task 消息目前也不能直接包含图片内容块。Roller 只能保存 API 返回的可见 reasoning 或 summary，无法恢复隐藏的推理内容。

## 2. 镜像准备

拉取预构建镜像，并标记为 Roller 默认使用的名称：

```bash
docker pull ghcr.io/valen-team/roller-codex:0.172.0
docker tag ghcr.io/valen-team/roller-codex:0.172.0 roller-codex:0.172.0
```

预构建镜像的平台为 `linux/amd64`。本节其余部分说明如何自行构建。

Roller 使用 [`docker/codex/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/codex/Dockerfile)，基础镜像为
`node:22-bookworm-slim`，默认固定安装 `@openai/codex@0.172.0`。镜像还包含 Git、ripgrep、
Python、curl、jq、SSH client 等常用 task 工具。

在线环境：

```bash
docker pull --platform linux/amd64 node:22-bookworm-slim
docker build \
  --platform linux/amd64 \
  --build-arg CODEX_VERSION=0.172.0 \
  -f docker/codex/Dockerfile \
  -t roller-codex:0.172.0 \
  .
```

离线基础镜像：

```bash
docker load -i node-22-bookworm-slim-linux-amd64.tar.gz
docker build \
  --platform linux/amd64 \
  --build-arg CODEX_VERSION=0.172.0 \
  -f docker/codex/Dockerfile \
  -t roller-codex:0.172.0 \
  .
```

Debian 软件源参数 `DEBIAN_MIRROR`、`DEBIAN_SECURITY_MIRROR` 的用法见 [Docker 构建与镜像源](/roller/start/docker-builds/)。npm 下载可通过 `NPM_REGISTRY` 指定软件源。未设置时沿用 npm 原有配置。

若默认 Debian 软件源在当前网络较慢，可在构建时覆盖软件源地址，无需修改
Dockerfile：

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

验证：

```bash
docker run --rm roller-codex:0.172.0 codex --version
```

若构建机与采集机不是同一个 Docker daemon，可导出镜像后在目标 worker 加载：

```bash
docker save -o roller-codex-0.172.0-linux-amd64.tar roller-codex:0.172.0
docker load -i roller-codex-0.172.0-linux-amd64.tar
```

可通过 CLI 参数或环境变量选择其他已构建的镜像：

```bash
export ROLLER_CODEX_IMAGE=roller-codex:0.172.0
# 或 roller collect ... --docker-image roller-codex:0.172.0
```

正式采集时不得使用会自动变化的 `@openai/codex@latest`。Roller 会将实际使用的
`codex_version`、镜像 tag 和镜像 ID 写入 run 和 sample 的 `info.json`，便于之后核对运行环境。

## 3. 环境变量与 API

Codex Harness 须使用实现 Responses API 的模型服务。首次运行须准备 API 地址、API Key 和模型 ID。仅 `/v1/chat/completions` 可用并不代表 Codex 能够运行。

| 配置项 | 默认读取 | CLI 覆盖 |
| --- | --- | --- |
| API 地址 | `OPENAI_BASE_URL` | `--codex-api-base`，单一 Harness 运行也可用 `--api-base` |
| API Key | `OPENAI_API_KEY` | `--codex-api-key-env`，单一 Harness 运行也可用 `--api-key-env` |
| 模型 ID | task 的 `model` 或 `--model` | 按原样交给 Codex |

建议将 Key 保存在宿主机环境变量中，并将变量名传给 Roller：

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

`--api-key-env` 接收的是环境变量名，而非 Key 本身。使用自定义 API 地址时，Roller 默认通过 Responses HTTP streaming 连接服务。除非服务明确支持 Responses WebSocket，否则应保持默认的 `--no-codex-websockets`。

示例命令保留默认的 `--wire-trace actf` 和 `--network host`，以便记录生成 ACTF/SFT 所需的工具定义。若关闭请求记录，Roller 仍会生成 Codex 原生轨迹和 ACTF，但不会导出缺少工具定义的 SFT。

## 4. Codex 专属参数 {#codex-cli-flags}

本节仅列出 Codex 专属的运行参数。API 地址和 Key 的配置方式见第 3 节。所有 Harness 共用的参数见 [CLI 参数参考](/roller/start/cli-reference/)。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--docker-image` / `--codex-image` | `ROLLER_CODEX_IMAGE` 或 `roller-codex:0.172.0` | 覆盖 Codex 镜像 |
| `--codex-config` | 无 | 注入隔离容器的原生 `config.toml` |
| `--codex-config-set KEY=VALUE` | 无 | 给每次 `codex exec` 追加 `-c KEY=VALUE`，可重复 |
| `--reasoning-summary` | Codex 默认值 | `auto`、`concise`、`detailed` 或 `none` |
| `--codex-web-search` | `disabled` | `disabled`、`cached` 或 `live` |
| `--codex-websockets` / `--no-codex-websockets` | 关闭 | 自定义 provider 是否使用 Responses WebSocket |
| `--codex-image-detail` | 无 | `auto`、`low`、`high` 或 `original`。Codex 发出的 Responses 图片输入未带 `detail` 时，补上该值 |
| `--codex-tool-images-as-user` | 关闭 | 将工具返回的图片附到后续用户图片消息，兼容忽略工具图片的服务 |
| `--codex-chat-completions` | 关闭 | 在请求记录代理上把 Codex 的 Responses 请求转换成 Chat Completions，用于只提供该 API 的端点。[`--token-ids`](/roller/traces/token-ids/) 需要它 |

单一 Codex 运行可使用通用参数形式。混合 Harness 运行应使用 `--codex-image`、`--codex-api-base` 和 `--codex-api-key-env` 等专属形式，以避免将设置应用到其他参与者。

如需配置特定的模型 provider、MCP 或其他 Codex 原生设置，可提供配置文件：

```bash
roller collect ... \
  --codex-config examples/config/codex/config.toml.example
```

Roller 会将该文件复制到 task 容器中。命令行中的 API 地址、模型、Thinking、推理摘要和 Web Search 设置优先于文件中的同名设置。示例文件还包含 `model_verbosity` 和一份默认关闭的 MCP server 模板。修改配置后请使用新的 `--run-name`，并且不得在文件中保存 API Key。

仅需修改个别设置时，可用 `--codex-config-set` 代替配置文件：

```bash
roller collect ... \
  --codex-config-set 'model_verbosity="low"' \
  --codex-config-set model_providers.roller_api.stream_idle_timeout_ms=1800000
```

- 每项设置以 `-c KEY=VALUE` 追加在 Roller 自身的覆盖之后，每个 turn 均会传入。值按 TOML 解析，解析失败时作为字符串处理，因此字符串值应带引号。
- Codex 会静默忽略无法识别的键，拼写错误的键不会生效，仅当值的类型不正确时才会报错，因此须仔细核对键名。
- 使用 `--api-base` 或 `--codex-api-base` 时，Roller 定义的 model provider 名为 `roller_api`。其 `stream_idle_timeout_ms`（默认 300000 毫秒）、`stream_max_retries`（默认 5）、`request_max_retries`（默认 4）等键可以调整；两个参数均未指定时，`model_providers.roller_api.*` 会被拒绝。`base_url`、`wire_api`、`env_key` 等由 Roller 管理的键会被拒绝，并提示应使用的 Roller 参数；各项设置之间也不得重叠。
- 设置会写入 `lock.json` 和 `info.json`。仅当键名本身类似凭证（`token`、`api_key`、`password`、`secret` 等）时，对应的值才会被脱敏；TOML 内联表形式的值按原样记录。修改设置后请使用新的 `--run-name`。请勿通过此方式传递密钥。

## 5. 多模态能力

Codex Harness 同时支持纯文本模型和具备视觉能力的 Responses 模型。图片通过 `files.inputs` 进入工作区，Codex 可使用原生 `view_image` 工具打开本地图片。图片工具结果会保留到原生轨迹、ACTF 和多模态 SFT，其中 SFT 使用 `<image>` 占位符和顶层 `images` 字段保存图片。

视觉 task 还要求 Codex 版本、所选模型和 Responses API 服务均支持图片输入。Task 的 `messages[].content` 当前只支持字符串，不能直接写入图片内容块。如需随首条用户消息发送输入图片，请在 [`files.attach_images`](/roller/tasks/task-format/) 中列出。纯文本模型仍可处理文本和普通文件，但不能完成需要理解图片内容的 task。

Codex 发出的 Responses `input_image` 内容块不带 `detail` 字段。如果端点要求该字段，可将 `--codex-image-detail` 设为 `auto`、`low`、`high` 或 `original`：

```bash
roller collect ... --harness codex --api-base https://example.test/v1 --codex-image-detail high
```

- 请求记录代理为每个没有 `detail` 的图片输入补上该值，包括用户消息和工具输出中的图片。已带 `detail` 的内容块和不含此类图片的请求原样转发。
- 该参数依赖请求记录代理，要求同时使用 `--api-base`、默认的 `--network host`、`--no-codex-websockets`，以及 `--wire-trace actf` 或 `full`。
- 设置后，该值写入 `lock.json` 和 `info.json`。修改后请使用新的 `--run-name`。

如果 Responses 服务能接收用户图片，却忽略 `view_image` 的图片返回值，可启用：

```bash
roller collect ... --harness codex --api-base http://localhost:8000/v1 \
  --codex-tool-images-as-user \
  --codex-config-set features.enable_request_compression=false
```

代理保留工具输出中的文本，将原样的图片字节附到紧随其后的用户消息。本次
[WildClawBench 案例](/roller/cookbook/wildclawbench-open-models/)使用的 Kimi K3.1 Pro
服务需要此设置；原生支持工具图片的服务保持关闭即可。该选项需要 HTTP 请求代理，
启用后会记录在运行配置中。

## 6. Thinking 配置

`--thinking` 用于设置 Codex 的推理强度。省略时使用 Codex、模型和服务的默认值。

示例：

```bash
roller collect ... \
  --harness codex \
  --thinking high \
  --reasoning-summary detailed
```

Codex Harness 会将 `minimal`、`low`、`medium`、`high`、`xhigh`、`max` 和 `ultra` 作为 reasoning effort 交给 Codex。实际可用的档位由模型和 API 服务决定。`off`、`none` 和 OpenClaw 专用的 `adaptive` 不受支持。首次使用某个模型时，建议省略 `--thinking` 或先选择服务明确支持的档位。

`--reasoning-summary` 控制是否保存可见的推理摘要，可选 `auto`、`concise`、`detailed` 或 `none`。服务直接返回明文 reasoning 时，Roller 优先保存明文。服务仅返回加密内容时，ACTF/SFT 中不会出现该内容。

`--no-keep-thinking` 仅清除 ACTF/SFT 中的 `reasoning_content`，不会修改 Codex 原生 session 或后续续聊所用的上下文。

## 7. Web Search

Codex 默认关闭 Web Search。仅当 task 须查询网页时才需修改：

| 设置 | 作用 |
| --- | --- |
| `disabled` | 不使用 Web Search，为默认值 |
| `cached` | 优先使用已有的搜索结果 |
| `live` | 允许实时查询网页 |

示例：

```text
--codex-web-search live
```

搜索过程会作为工具调用写入轨迹，因此可在 Viewer 中查看查询内容和返回结果。

## 8. Session 与工作区

每个 Agent 或 Simulator 均在独立的一次性容器中运行，不会读取宿主机的 Codex 账号、配置或历史 session。

- 输入文件为只读，并保持 Task Bundle 中的相对路径。
- Context 文件复制到 task 声明的位置，`AGENTS.md` 按 Codex 的正常发现规则生效。
- `runtime.setup` 在第一轮开始前执行。
- 输出目录保持可写，运行结束后回收到 sample 的 `results/`。

预定义的多轮消息沿用同一个 Codex session，因此对话历史和工作区文件在后续轮次中仍然可用。

### 8.1 User Simulator

Codex 可作为 Task Agent，也可作为 User Simulator。两者分别在 task 顶层和 `user_simulator` 中设置 Harness 与模型，并在各自的独立容器中保持 session。

## 9. 轨迹与请求记录

一次运行会生成以下主要文件：

| 文件 | 用途 |
| --- | --- |
| `trace.jsonl` | 保存 Codex 原生 session 事件，主要用于排错 |
| `trace_ACTF.json` | 将 reasoning、回复、工具调用和结果整理成统一结构 |
| `tools_capture.jsonl` | 保存模型请求中实际使用的工具定义 |
| `trace_SFT.json` | 将成功轨迹整理成训练数据格式 |

### 9.1 `trace.jsonl`

该文件保留 Codex 原生事件、上下文和 token 使用量，主要用于排查运行问题。它不是模型服务收到的完整 HTTP 请求，文件格式也可能随 Codex 版本变化。

### 9.2 `trace_ACTF.json`

ACTF 将同一次回复中的 reasoning、文本和工具调用整理到一起，并将每个工具结果与对应调用配对。system prompt 和工具定义来自本次实际运行。

### 9.3 `trace_SFT.json` 与 `sft.jsonl`

SFT 保留 Codex 实际使用的 Responses 工具格式。图片 sample 会额外包含 `images`。若工具定义缺失、损坏或在请求之间发生变化，Roller 会保留原生轨迹，但不会生成可能失真的 SFT。

### 9.4 完整请求记录

默认的 `--wire-trace actf` 仅保留生成 ACTF/SFT 所需的工具信息。如需核对模型实际收到的完整请求，可临时使用：

```text
--wire-trace full
```

此时 sample 会额外保留完整请求记录。该文件可能包含消息正文、工具参数和 reasoning 配置，仅适用于排错或审计。`--wire-trace off` 不记录请求中的工具定义，此时 Codex 仍会生成原生轨迹和 ACTF，但不会生成缺少工具定义的 SFT。

## 10. 首次运行检查

首次运行建议保留示例命令中的 `--limit 1`。命令结束后依次检查：

1. run 目录的 `info.json` 中 `state` 为 `finished`。
2. sample 的 `info.json` 中 `status` 为 `ok`。
3. sample 中存在 `trace.jsonl`、`trace_ACTF.json` 和 `trace_SFT.json`。
4. task 要求生成文件时，`results/` 中存在对应文件。

## 11. 常见问题

**(1) `Codex requires a non-empty API key`**

`--api-key-env` 指向的宿主机变量不存在或值为空。请检查变量名，不得将 Key 直接写入 task。

**(2) `/responses` 返回 404 或协议错误**

API 服务只有 Chat Completions，或 Responses streaming/tool protocol 不兼容。请换用支持
Responses 的服务。对于仅支持 Chat Completions 的模型服务，可继续使用 OpenClaw Harness。

**(3) `Codex native trace produced no assistant steps`**

Codex 在生成有效回复前退出。请先查看 sample 的 `info.json` 和 `trace.jsonl`。如需进一步排查，可使用 `--keep-container-on-error` 保留出错容器，并核对 `info.json` 中记录的 `codex_version`。

**(4) `invalid_encrypted_content` / `Encrypted content could not be decrypted or parsed`**

Codex 发出的 Responses 请求固定为 `store: false`，并回传之前的 `reasoning.encrypted_content`，Codex 没有提供关闭这一行为的配置。部分中转端点会间歇性地无法校验自己签发的加密 reasoning。请求记录代理生效时（默认的 `--wire-trace actf` 加 `--no-codex-websockets`），Roller 仅在 400 响应的 JSON `error.code` 等于 `invalid_encrypted_content` 时按原样重发同一请求，最多 3 次，并支持 gzip/deflate 压缩响应。每次重试都会作为 `upstream_retry` 条目写入 `--wire-trace full` 的请求记录；停止代理会取消等待中的重试。全部重试仍失败时，该错误按原有方式结束本次 rollout；持续失败须在端点侧解决。

**(5) `apply_patch: command not found`**

Codex 运行时会将 `apply_patch` 别名加入 `PATH`，但 Debian 的 `/etc/profile` 会在 Codex 执行命令所用的登录 shell 中重置 `PATH`。当前的 `docker/codex/Dockerfile` 会安装固定的 `/usr/local/bin/apply_patch` 别名，此前构建的镜像须重新构建。

**(6) `idle timeout waiting for SSE` 或 `stream disconnected before completion`**

Codex 在流式响应中连续 5 分钟（`stream_idle_timeout_ms` 默认 300000 毫秒）收不到数据即断开连接，随后最多重试 5 次，每次重试都会让模型重新生成。不流式返回工具调用参数的服务，在模型写出大段参数时容易触发该超时。使用 `--api-base` 或 `--codex-api-base` 时，可放宽 Roller provider 的空闲超时：

```bash
roller collect ... \
  --codex-config-set model_providers.roller_api.stream_idle_timeout_ms=1800000
```
