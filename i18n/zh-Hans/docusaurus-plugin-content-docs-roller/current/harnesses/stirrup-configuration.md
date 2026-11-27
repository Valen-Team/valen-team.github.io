---
title: "Stirrup Harness 指南"
---

# Stirrup Harness 指南

Stirrup Harness 在 Roller 宿主机进程中运行 Stirrup 0.2.2 的 Agent 循环，由 Docker 容器或远程沙箱执行命令并存放任务工作区。容器内不持有模型 API Key，也不需要访问模型服务的出网权限。

Task 字段见 [Task 格式参考](/roller/tasks/task-format/)，通用产物说明见[轨迹产出文件指南](/roller/traces/trajectory-outputs/)。

## 1. 环境要求与安装

Stirrup 需要 Python 3.12 及以上版本和 `stirrup` extra：

```bash
pip install 'roller-agent[stirrup]'
```

由于 Pillow 版本约束，`stirrup` extra 不能与 `pdf` extra 安装在同一个 Python 环境中。

## 2. 容器镜像与远程沙箱

默认 Docker 镜像为 `python:3.13-slim`。任何包含 `bash`、GNU coreutils 及任务所需软件的镜像均可使用，容器内无需安装 Stirrup 运行时。

若改用远程沙箱执行命令，安装已在 `roller.sandbox_providers` entry point 下注册的 provider 包，并传入 `--sandbox-provider NAME --sandbox-template NAME`。Agent 循环仍留在 Roller 宿主机进程中，由沙箱执行命令并保存任务文件。

## 3. 环境变量与 API

Stirrup 使用 OpenAI Chat Completions 协议，请求均经由 Roller 本地请求记录代理发出。

| 配置项 | 默认来源 | CLI 覆盖参数 |
| --- | --- | --- |
| API 地址 | `OPENAI_BASE_URL` | `--stirrup-api-base`，单 Harness 运行也可用 `--api-base` |
| API 密钥 | `OPENAI_API_KEY` | `--stirrup-api-key-env`，单 Harness 运行也可用 `--api-key-env` |
| 模型 ID | Task 的 `model` 或 `--model` | 原样发送给服务端 |

```bash
export OPENAI_API_KEY='...'

roller collect \
  --harness stirrup \
  --tasks examples/tasks/tasks.jsonl \
  --model my-model \
  --api-base http://localhost:8000/v1 \
  --api-key-env OPENAI_API_KEY \
  --capture-calls \
  --output runs \
  --run-name stirrup-demo
```

## 4. Stirrup 专用参数 {#stirrup-cli-flags}

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--docker-image` / `--stirrup-image` | `ROLLER_STIRRUP_IMAGE` 或 `python:3.13-slim` | 执行 `code_exec` 命令的容器镜像 |
| `--stirrup-max-steps` | `30` | 单条 prompt 的最大 Agent 步数 |
| `--stirrup-context-length` | `128000` | 上下文长度上限；用到 70% 时由 Stirrup 摘要历史 |
| `--stirrup-output-tokens` | `8192` | 每次模型请求的 `max_tokens` |
| `--stirrup-command-timeout` | `180` | 容器或沙箱内单条命令的超时时间（秒） |
| `--stirrup-temperature` | 无 | 采样温度 |
| `--stirrup-top-p` | 无 | 核采样 `top_p` |
| `--stirrup-seed` | 无 | 基础随机种子；每个 sample 按该值、task ID 和 sample 序号派生确定性 seed |
| `--stirrup-request-set KEY=JSON` | 无 | 可重复指定，合并到每次 Chat Completions 请求中的额外 JSON 字段 |
| `--thinking` | 无 | 写入 `chat_template_kwargs.reasoning_effort` |

## 5. 工具、产物与适用范围

- **内置工具**：`code_exec`、`view_image` 和 `finish`。
- **单 prompt 执行**：每个 task 运行一条 prompt，Stirrup 不作为 User Simulator 使用。
- **不向容器注入代理变量**：模型请求从 Roller 进程发起，Stirrup 不将宿主机代理环境变量透传进任务容器。
- **上下文摘要与 token id**：`--wire-trace full`、`--capture-calls` 和 `--token-ids` 在 Docker 和远程沙箱下均可用。历史发生摘要时，系统从捕获的 Calls 切分 `sft_segments/`，摘要请求本身也会作为独立窗口导出。
- **无输出目录模式**：Task 可设置 `files.output_dir: null`，不从工作区回收额外输出文件（[VIALS](/roller/benches/vials/) 采用该模式）。
