---
title: "DeepSeek Harness 指南"
---

# DeepSeek Harness 指南

DeepSeek Harness 用于通过官方 DeepSeek Harness 运行文本和文件类 task。该 Harness 连接支持流式响应、工具调用和 DeepSeek thinking 字段的 Chat Completions 服务。本页按照镜像、API、专属参数、session 和轨迹的顺序介绍首次使用所需内容。

Roller 当前固定使用官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 0.1.5rc1，并使用只提供 Bash 的 `sdk-minimal` 工具配置。Task 字段见 [Task 格式参考](/roller/tasks/task-format/)，通用产物见 [轨迹产出文件指南](/roller/traces/trajectory-outputs/)。

首次使用时，请先完成第 1 至第 3 节并运行示例命令。后续章节介绍专属参数、工具限制和轨迹，可在需要相应功能时查阅。

## 1. 适用范围

DeepSeek Harness 适合以下场景：

- 使用兼容 DeepSeek thinking 字段的 Chat Completions 服务。
- 通过一个持续可用的 Bash 环境处理文本和普通文件。
- 运行单轮、多轮、Task Agent 或 User Simulator task。
- 需要导出 ACTF、SFT、token 使用量和结果文件。

当前工具配置没有图片查看工具，因此不适合需要理解图片内容的 task。交互登录、自定义插件和跨 task 长期记忆也暂不支持。

## 2. 镜像准备

拉取预构建镜像，并标记为 Roller 默认使用的名称：

```bash
docker pull ghcr.io/valen-team/roller-deepseek:0.1.5rc1
docker tag ghcr.io/valen-team/roller-deepseek:0.1.5rc1 roller-deepseek:0.1.5rc1
```

预构建镜像的平台为 `linux/amd64`。如需自行构建，在 Roller 仓库根目录执行：

```bash
docker build -t roller-deepseek:0.1.5rc1 docker/deepseek
```

镜像包含官方 SDK 和运行时。宿主机无需另外安装 DeepSeek Harness。构建完成后，在第 3 节配置 API 地址、API Key 和模型 ID。

默认基础镜像为 `python:3.12-slim`，支持 Linux x86_64 和 aarch64。如需更换基础镜像或 Debian 软件源，请参见 [Docker 构建与镜像源](/roller/start/docker-builds/)。

## 3. 环境变量与 API

DeepSeek Harness 连接支持流式响应、工具调用和 DeepSeek thinking 字段的 Chat Completions 服务。首次运行需要准备 API 地址、API Key 和模型 ID。

| 配置项 | 默认读取 | CLI 覆盖 |
| --- | --- | --- |
| API 地址 | `DEEPSEEK_BASE_URL`，未设置时使用 `https://api.deepseek.com` | `--deepseek-api-base`，单一 Harness 运行也可用 `--api-base` |
| API Key | `DEEPSEEK_API_KEY` | `--deepseek-api-key-env`，单一 Harness 运行也可用 `--api-key-env` |
| 模型 ID | task 的 `model` 或 `--model` | 原样发送给服务 |

`--deepseek-api-key-env` 和 `--api-key-env` 的值是宿主机环境变量名，不是 Key 本身。Key 仅在执行时读取，不写入 task、run 配置或公开产物。

将以下命令中的 `...`、API 地址和 `model-id` 替换为模型服务提供的实际值。首次运行仅执行一个 task，以便在大规模运行前确认配置是否正确：

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

## 4. DeepSeek 专属参数 {#deepseek-cli-flags}

下表仅列出 DeepSeek 专属运行参数。API 地址和 Key 的配置方式见第 3 节。所有 Harness 共用的参数见 [CLI 参数参考](/roller/start/cli-reference/)。

| 参数 | 默认值与行为 |
| --- | --- |
| `--deepseek-image` | 优先于 `--docker-image`。两者均未设置时使用 `ROLLER_DEEPSEEK_IMAGE`，该变量也未设置时使用 `roller-deepseek:0.1.5rc1` |
| `--deepseek-profile NAME` | 默认 `sdk-minimal`，仅提供 Bash。`sdk` 选择完整的原生 profile，提供文件、搜索和 shell 工具 |
| `--deepseek-permission-mode MODE` | 可选 `read-only`、`workspace-write` 或 `danger-full-access`，仅作用于 task 容器内部。不设置时，`sdk-minimal` 使用自身的权限模式，其他 profile 使用 `danger-full-access`，因为这些 profile 默认的文件沙箱在容器内没有可用后端 |
| `--deepseek-input-modalities` | 默认 `text`。`text,image` 声明模型接受图片，`sdk` profile 的 `read_image` 工具由此可以把图片发给模型。该参数不会让模型服务获得视觉能力 |
| `--deepseek-max-steps` | 每条用户消息最多 12 次模型请求，同时受 task 和对话轮次超时的限制 |
| `--deepseek-context-length` | 默认 128000，至少 1024，按实际服务设置 |
| `--deepseek-output-tokens` | 默认 8192，必须为正且小于上下文窗口 |
| `--thinking` / `runtime.thinking` | 原生支持 `off/low/high/max`。`none` 是 `off` 的别名。省略时使用 DeepSeek Harness 的默认行为 |
| `--wire-trace` | 控制请求记录方式。`full` 额外保存完整 HTTP 请求，需要显式 API 地址和 `--network host` |
| `--no-keep-thinking` | 仅移除 ACTF/SFT 中的 reasoning，保留原始事件和续聊历史 |

DeepSeek 作为 Task Agent 或 User Simulator 时均使用这些参数。修改镜像、API 地址、profile、权限模式、步数或 token 上限后，建议使用新的 `--run-name`，以免与原有运行配置冲突。

## 5. 多模态能力

默认的 `sdk-minimal` 配置仅向模型提供持久化 `bash`，不提供图片查看工具，因此只适用于文本和普通文件任务。

需要模型看图时，选择 `--deepseek-profile sdk` 并加上 `--deepseek-input-modalities text,image`。图片文件通过 `files.inputs` 放入工作区，模型用 `read_image` 工具打开。读到的图片随对应的工具结果保留在 ACTF 和 SFT 中。Task 的 `messages[].content` 只支持字符串，不支持 `files.attach_images`。

## 6. Session 与工作区

每个 Agent 或 Simulator 均在独立容器中运行。输入文件只读，Context 文件复制到 task 声明的位置，输出文件在结束后回收至 sample 的 `results/`。

同一参与者的多轮消息复用同一个 DeepSeek session 和 Bash 环境。对话历史、工作区文件、shell 变量和当前工作目录均会保留，因此后续轮次可沿用此前的状态。

## 7. 工具与能力限制

当前 `sdk-minimal` 工具配置只提供一个持续可用的 `bash` 工具。读写文件和搜索内容也通过 Bash 命令完成，不提供单独的图片、Web、MCP 或子 Agent 工具。

`--deepseek-profile sdk` 改用完整的原生 profile，工具由 SDK 提供。其 Bash 工具每次调用启动独立进程，因此 shell 变量不会跨调用保留，文件和 session 仍然保留。该 profile 的委派类工具（`subagent`、`subagent_fork`、`list_agents`、`interrupt_agent`、`send_message`、`workflow` 和 `ralph`）不会提供给模型。详见 [Harness 工具开放情况](/roller/harnesses/tool-availability/)。

自动压缩已关闭。长 task 需要通过 `--deepseek-context-length` 设置足够大的上下文窗口；所选模型服务须支持 DeepSeek 的请求格式和 thinking 字段。

## 8. 轨迹与请求记录

一次运行生成三类主要轨迹文件：

| 文件 | 用途 |
| --- | --- |
| `trace.jsonl` | 保存 DeepSeek SDK 的原生事件和实际模型请求，主要用于排错 |
| `trace_ACTF.json` | 将对话、reasoning、Bash 调用和结果整理成统一结构 |
| `trace_SFT.json` | 将成功轨迹整理成训练数据格式 |

错误、截断、空回复、未完成的工具调用或无法完整保存的内容不会被标记为成功。超时后停止容器，并尽量回收已生成的轨迹和结果文件。

## 9. 首次运行检查

首次运行建议只使用一个简单 task。完成后依次检查：

1. run 目录的 `info.json` 中 `state` 为 `finished`。
2. sample 的 `info.json` 中 `status` 为 `ok`。
3. sample 中存在 `trace.jsonl`、`trace_ACTF.json` 和 `trace_SFT.json`。
4. task 要求生成文件时，`results/` 中存在对应文件。

## 10. 常见问题

**(1) 轨迹被拒绝**

错误、截断或空回复、未完成的工具调用，以及无法无损表示为文本的内容均会被拒绝。请检查 `trace.jsonl` 定位原因。

**(2) 长任务超出上下文窗口**

自动压缩已关闭。请按实际服务能力调大 `--deepseek-context-length`。

**(3) task 执行超时**

整个容器将被停止，已有文件会被回收。可按需调整 `--timeout` 或 `--deepseek-max-steps`。

**(4) 无法继续旧的 run**

镜像、API 地址或运行参数发生变化后，旧 run 无法安全地继续执行。请使用新的 `--run-name`。

**(5) `--wire-trace full` 无法启动**

请设置显式 API 地址，并保持启用 `--network host`。
