---
title: "Roller"
slug: /
description: "在一次性 Docker 容器中运行可调用工具的 Agent，采集轨迹、完成 Benchmark 评分并导出 SFT 数据。"
---

# Roller 文档

Roller 在一次性 Docker 容器中运行能够调用工具的 AI Agent，并记录完整过程，包括 prompt、reasoning、工具调用、工具结果、生成文件和运行信息。Roller 适用于在不同模型和 Agent 运行时之间重复采集与评测的场景。

初次使用 Roller 时，建议先阅读 [Roller 简介](/roller/start/introduction/)。该页解释核心概念，无需配置环境。然后按照[快速上手](/roller/start/getting-started/)生成第一条轨迹。

## Roller 的功能

Roller 的输入包括一组 Task、一个或多个模型，以及一个 Harness。Roller 为每个 Task 与模型的组合创建独立的 rollout，并将结果写入结构化的 run 目录。

~~~text
tasks.jsonl × 模型
        │
        ▼
Docker 中的 Agent Harness
        │
        ├─ trace.jsonl       Harness 原生事件
        ├─ trace_ACTF.json   统一分析轨迹
        ├─ trace_SFT.json    标准训练样本
        ├─ results/          Agent 生成的文件
        └─ info.json         状态、usage 与运行来源
~~~

常见用途包括：

- 采集单轮、多轮和工具型 Agent 轨迹。
- 在同一批 Task 上比较模型或 Harness。
- 检查 reasoning、工具调用、工具结果和生成文件。
- 制作统一结构的轨迹或 SFT JSONL。
- 继续中断的采集，并在内置 Viewer 中检查结果。

Roller 需要 Python 3.10+。项目目前使用 Task schema <code>roller.task/v1</code>，处于 Beta 阶段，采用 Apache 2.0 许可证。源码见 [GitHub](https://github.com/Valen-Team/Roller)。

## 选择 Harness

首次运行教程使用 OpenClaw。成功生成第一条轨迹之前，可一直沿用该流程。需要特定 Agent 运行时或 API 协议时，再选择其他 Harness。

| Harness | 模型服务协议 | 常见用途 |
| --- | --- | --- |
| OpenClaw（默认） | OpenAI Responses 或 Chat Completions | 自定义/开源模型、多模态输入和动态 User Simulator |
| Codex | Responses | Codex CLI 工具轨迹 |
| Claude Code | Anthropic <code>/v1/messages</code> | Claude Code 工具、native thinking 和远程沙箱 |
| Hermes | OpenAI Chat Completions | 原生请求与工具消息轨迹 |
| OpenCode | OpenAI Chat Completions | 原生 CLI session 和文件工具 |
| DeepSeek Harness | DeepSeek Chat Completions | 原生 SDK session、持久 Bash 和 E2B 沙箱 |
| Pi Agent | OpenAI Chat Completions | 原生 AgentSession 和编程工具 |
| Stirrup | OpenAI Chat Completions | 宿主机 Agent 循环（`code_exec`、`view_image`、`finish`），配合离线容器或远程沙箱 |

八种 Harness 使用相同的 Task、Sample、轨迹和 SFT 格式，也共用 Viewer、重试和 Resume 流程。它们的镜像、API、工具和 reasoning 参数不同。

### 能力矩阵

| Harness | Docker | 远程沙箱 | User Simulator | `--capture-calls` 与 `--token-ids` | `roller import` | 预构建镜像 |
| --- | --- | --- | --- | --- | --- | --- |
| OpenClaw | 支持 | — | 支持 | 支持 | — | 上游（`ghcr.io/openclaw/openclaw:2026.11.10`） |
| Codex | 支持 | — | 支持 | 支持（`--token-ids` 需 `--codex-chat-completions`） | 支持（`~/.codex`） | `ghcr.io/valen-team/roller-codex:0.172.0` |
| Claude Code | 支持 | 支持（`--sandbox-provider`） | 支持 | 支持（`--token-ids` 需 `--claude-chat-completions`） | 支持（`~/.claude`） | 本地构建（`docker/claude-code`） |
| Hermes | 支持 | — | 支持 | 支持 | — | `ghcr.io/valen-team/roller-hermes:8fc037444731` |
| OpenCode | 支持 | — | 支持 | 支持 | — | `ghcr.io/valen-team/roller-opencode:1.19.6` |
| DeepSeek Harness | 支持 | 仅 WildClawBench（`e2b` / `roller.sandbox_providers`） | 支持 | 支持 | — | `ghcr.io/valen-team/roller-deepseek:0.2.2rc2` |
| Pi Agent | 支持 | — | 支持 | 支持 | — | `ghcr.io/valen-team/roller-pi:1.6.1` |
| Stirrup | 支持 | 支持（`roller.sandbox_providers`） | — | 支持 | — | 基础镜像（`python:3.13-slim`） |

## 入门步骤

1. 阅读 [Roller 简介](/roller/start/introduction/)，理解 Task、Harness、rollout、run 和 trace。
2. 按照[快速上手](/roller/start/getting-started/)安装 Roller、执行 dry-run、完成一次采集并打开 Viewer。
3. 编写自定义 Task 时，阅读 [Task 格式](/roller/tasks/task-format/)。
4. 需要使用 OpenClaw 以外的运行时时，再阅读对应的 Harness 指南。
5. 需要确认轨迹、SFT、wire trace 或失败保留规则时，阅读[轨迹产出文件](/roller/traces/trajectory-outputs/)。
