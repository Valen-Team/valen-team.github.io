---
title: "OpenCode Harness 指南"
---

# OpenCode Harness 指南

OpenCode Harness 用于通过 OpenCode Agent 执行需要读写文件、运行命令或查看图片的 task。该 Harness 连接支持流式响应和工具调用的 OpenAI Chat Completions 服务。本页按照镜像、API、专属参数、session 和轨迹的顺序介绍首次使用所需内容。

Roller 当前固定使用 [OpenCode](https://opencode.ai/docs/cli/) 1.19.6。Task 字段见 [Task 格式参考](/roller/tasks/task-format/)，通用产物见 [轨迹产出文件指南](/roller/traces/trajectory-outputs/)。

首次使用时，请先完成第 1 至第 3 节并运行示例命令。后续章节介绍专属参数、session和轨迹，可在需要相应功能时查阅。

## 1. 适用范围

OpenCode Harness 适合以下场景：

- 使用支持流式响应和工具调用的 OpenAI Chat Completions 服务。
- 让 Agent 运行命令、搜索内容和读写文件。
- 使用具备视觉能力的模型查看本地图片。
- 运行单轮、多轮、Task Agent 或 User Simulator task。

通过 `files.attach_images` 发送首轮图片。启用原生工具和调用捕获后可以使用子 Agent。由于自动压缩已关闭，长任务需要配置足够大的上下文窗口。

## 2. 镜像准备

拉取预构建镜像，并标记为 Roller 默认使用的名称：

```bash
docker pull ghcr.io/valen-team/roller-opencode:1.19.6
docker tag ghcr.io/valen-team/roller-opencode:1.19.6 roller-opencode:1.19.6
```

预构建镜像的平台为 `linux/amd64`。如需自行构建，在 Roller 仓库根目录执行：

```bash
docker build -t roller-opencode:1.19.6 docker/opencode
```

镜像包含固定版本的 OpenCode 及其运行依赖。宿主机无需安装 Node.js、Bun 或 OpenCode。构建完成后，在第 3 节配置 API 地址、API Key 和模型 ID。

默认基础镜像为 `python:3.12-slim-bookworm`，支持 Linux x86_64 和 aarch64。如需更换基础镜像、npm 下载源或 Debian 软件源，请参见 [Docker 构建与镜像源](/roller/start/docker-builds/)。

## 3. 环境变量与 API

OpenCode Harness 连接支持流式响应和工具调用的 OpenAI Chat Completions 服务。首次运行需要准备 API 地址、API Key 和模型 ID。

| 配置项 | 默认读取 | CLI 覆盖 |
| --- | --- | --- |
| API 地址 | `OPENAI_BASE_URL`，未设置时使用 `https://api.openai.com/v1` | `--opencode-api-base`，单一 Harness 运行也可用 `--api-base` |
| API Key | `OPENAI_API_KEY` | `--opencode-api-key-env`，单一 Harness 运行也可用 `--api-key-env` |
| 模型 ID | task 的 `model` 或 `--model` | 原样发送给 API，OpenCode 内部会添加 `roller/` 名称前缀 |

`--opencode-api-key-env` 和 `--api-key-env` 的值是宿主机环境变量名，不是 Key 本身。Key 仅在执行时读取，不写入公开配置。

将以下命令中的 `...`、API 地址和 `model-id` 替换为模型服务提供的实际值。首次运行仅执行一个 task，以便在大规模运行前确认配置是否正确：

```bash
export ROLLER_OPENCODE_KEY='...'

roller collect \
  --harness opencode \
  --tasks examples/tasks/tasks.jsonl \
  --model model-id \
  --api-base https://api.example.com/v1 \
  --api-key-env ROLLER_OPENCODE_KEY \
  --docker-image roller-opencode:1.19.6 \
  --limit 1 \
  --output runs \
  --run-name opencode-demo
```

## 4. OpenCode 专属参数 {#opencode-cli-flags}

下表仅列出 OpenCode 专属运行参数。API 地址和 Key 的配置方式见第 3 节。所有 Harness 共用的参数见 [CLI 参数参考](/roller/start/cli-reference/)。

| 参数 | 默认值与行为 |
| --- | --- |
| `--opencode-image` | 优先于 `--docker-image`。两者均未设置时使用 `ROLLER_OPENCODE_IMAGE`，该变量也未设置时使用 `roller-opencode:1.19.6` |
| `--opencode-max-steps` | SkillsBench 默认为 100，其他任务默认为 12，同时受整个 task 的超时限制 |
| `--opencode-context-length` | 模型上下文窗口，默认 128000，至少 1024，按服务实际能力设置 |
| `--opencode-output-tokens` | 每次模型请求的输出 token 上限。SkillsBench 默认为 32768，其他任务默认为 8192。设置小于上下文窗口的正数 |
| `--opencode-vision` / `--no-opencode-vision` | 是否向 OpenCode 声明模型支持图片输入。默认开启，纯文本模型可显式关闭 |
| `--opencode-native-tools` | 默认关闭。开启后允许 OpenCode 原生注册表中的全部工具，不再限于固定的 `bash/read/write/edit/apply_patch/glob/grep/skill`。`task` 工具仅在开启 `--capture-calls` 时允许 |
| `--opencode-deny-tool NAME` | 在 `--opencode-native-tools` 下禁用一个原生工具或权限，可重复指定 |
| `--thinking` / `runtime.thinking` | 支持 `off/minimal/low/medium/high/xhigh`。传给兼容服务的 reasoning effort，`off` 映射为 `none`，仍需服务支持 |
| `--wire-trace` | 默认 `actf`。各模式均通过插件保留原生请求和工具定义。`full` 额外保存 HTTP 记录，要求显式 API 地址和 `--network host` |
| `--no-keep-thinking` | 仅移除 ACTF/SFT 中的 reasoning。原生日志和续聊历史保持完整 |

OpenCode 作为 Task Agent 或 User Simulator 时均使用这些参数。修改镜像、API 地址、上下文窗口、步骤上限或工具选择后，建议使用新的 `--run-name`，以免与原有运行配置冲突。

## 5. 多模态能力

OpenCode 可使用 `bash`、`read`、`write`、`edit`、`apply_patch`、`glob` 和 `grep`。具备视觉能力的模型和服务可通过 `read` 打开本地图片。使用纯文本模型时，可通过 `--no-opencode-vision` 关闭图片输入声明。

图片通过 `files.inputs` 进入工作区，并由 `read` 生成图片附件。图片结果保留在原始轨迹、ACTF 和多模态 SFT 中。Task 的 `messages[].content` 当前只支持字符串，不能直接写入图片内容块。如需随首条用户消息发送输入图片，请在 [`files.attach_images`](/roller/tasks/task-format/) 中列出。该字段要求启用 `--opencode-vision`（默认启用）。

## 6. Session 与工作区

每个 Agent 或 Simulator 均在独立容器中运行，不读取宿主机的 OpenCode 配置。输入文件只读，Context 文件复制到 task 声明的位置，输出文件在结束后回收至 sample 的 `results/`。

同一参与者的多轮消息恢复同一个 OpenCode session，因此对话历史和工作区文件仍可使用。每一轮均启动新的 CLI 进程，因此后台进程句柄不会保留。

采集时不会自动分享 session、更新 OpenCode，也不启用 MCP、子 Agent 和联网工具。Context 和 skill 文件仍可按路径读取。

`--opencode-native-tools` 允许原生注册表中的其余工具，包括联网工具。子 Agent 仍只随 `--capture-calls` 开启，Explore 子 Agent 保持 `bash/read/glob/grep` 工具配置。详见 [Harness 工具开放情况](/roller/harnesses/tool-availability/)。

## 7. 轨迹与请求记录

一次运行生成三类主要轨迹文件：

| 文件 | 用途 |
| --- | --- |
| `trace.jsonl` | 保存 OpenCode 原生 session 和实际模型请求，主要用于排错 |
| `trace_ACTF.json` | 将对话、reasoning、工具调用和结果整理成统一结构 |
| `trace_SFT.json` | 将成功轨迹整理成训练数据格式 |

图片附件保留在 ACTF 和多模态 SFT 中。工具定义取自实际模型请求，不根据调用参数推断。

不完整 session、空回复、API 错误、截断回复、损坏的轨迹或前后不一致的工具定义不会被标记为成功。超时后停止容器，并回收已有的轨迹和文件。原始记录显示上下文溢出或工具仍在运行时，ACTF 保留已记录的对话轮次，并将该轨迹标为不可用于 SFT。

## 8. 首次运行检查

首次运行建议只使用一个简单 task。完成后依次检查：

1. run 目录的 `info.json` 中 `state` 为 `finished`。
2. sample 的 `info.json` 中 `status` 为 `ok`。
3. sample 中存在 `trace.jsonl`、`trace_ACTF.json` 和 `trace_SFT.json`。
4. task 要求生成文件时，`results/` 中存在对应文件。

## 9. 常见问题

**(1) 服务不支持流式或工具调用**

OpenCode Harness 要求模型服务支持流式 Chat Completions 和工具调用。请换用满足要求的模型服务。

**(2) 轨迹失败**

不完整 session、空回复、API 错误、截断回复、缺失或变化的工具定义，以及损坏的 JSONL 均判定为失败。请检查 `trace.jsonl` 定位原因。

**(3) 长任务超出上下文窗口**

自动压缩已关闭。请按服务实际能力调大 `--opencode-context-length`。

**(4) task 执行超时**

容器将被停止，并尽量回收已有轨迹和文件。可按需调整 `--timeout` 或 `--opencode-max-steps`。

**(5) `--wire-trace full` 无法启动**

请设置显式 API 地址，并保持启用 `--network host`。
