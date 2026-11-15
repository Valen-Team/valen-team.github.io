---
title: "Claude Code Harness 指南"
---

# Claude Code Harness 指南

Claude Code Harness 用于通过 Claude Code 执行需要终端、文件或图片工具的 task。该 Harness 连接 Anthropic Messages 兼容服务。本页按照镜像、API、专属参数、session 和轨迹的顺序介绍首次使用所需内容。

Roller 当前固定使用 Claude Code 2.1.222。Task 字段见 [Task 格式参考](/roller/tasks/task-format/)，通用产物见 [轨迹产出文件指南](/roller/traces/trajectory-outputs/)。

首次使用时，请先完成第 1 至第 3 节并运行示例命令。后续章节介绍专属参数、Thinking 和轨迹，可在需要相应功能时查阅。

## 1. 适用范围

Claude Code Harness 适合以下场景：

- 使用实现 Anthropic `/v1/messages` 的模型服务。
- 让 Agent 运行命令、读写文件或通过 `Read` 工具查看图片。
- 运行单轮、多轮、Task Agent 或 User Simulator task。
- 需要保留 Claude Code 原生 session，并导出 ACTF、SFT 和 token 使用量。

仅支持 OpenAI Chat Completions 或 Responses 的服务无法直接用于本 Harness。Task 消息目前也不能直接包含图片内容块。Roller 只能保存 API 实际返回的可见 thinking 或 summary，无法恢复隐藏的推理内容。

## 2. 镜像准备

Claude Code 的许可不允许再分发，因此不提供预构建镜像，需要在本地构建。

Roller 使用 [`docker/claude-code/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/claude-code/Dockerfile)，基础镜像为
`node:22-bookworm-slim`，默认固定安装 `@anthropic-ai/claude-code@2.1.222`。Codex 已使用的
Node 22 离线归档可直接复用，无需重新下载基础镜像。

在线基础镜像：

```bash
docker pull --platform linux/amd64 node:22-bookworm-slim
docker build \
  --platform linux/amd64 \
  --build-arg CLAUDE_CODE_VERSION=2.1.222 \
  -f docker/claude-code/Dockerfile \
  -t roller-claude-code:2.1.222 \
  .
```

离线基础镜像：

```bash
docker load -i node-22-bookworm-slim-linux-amd64.tar.gz
docker build \
  --platform linux/amd64 \
  --build-arg CLAUDE_CODE_VERSION=2.1.222 \
  -f docker/claude-code/Dockerfile \
  -t roller-claude-code:2.1.222 \
  .
```

Debian 软件源参数 `DEBIAN_MIRROR`、`DEBIAN_SECURITY_MIRROR` 的用法见 [Docker 构建与镜像源](/roller/start/docker-builds/)。npm 下载可通过 `NPM_REGISTRY` 指定软件源；未设置时沿用 npm 原有配置。

默认 Debian 软件源不可达时，可传入软件源地址：

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

验证并设置默认镜像：

```bash
docker run --rm roller-claude-code:2.1.222 claude --version
export ROLLER_CLAUDE_CODE_IMAGE=roller-claude-code:2.1.222
```

正式数据集应固定 Claude Code 版本。原生 session 字段、permission mode 和 effort 列表会随
CLI 版本变化。Roller 将实际的 `claude_code_version`、镜像 tag 和镜像 ID 写入 run/sample 信息。

## 3. 环境变量与 API

Claude Code Harness 需要实现 Anthropic Messages API 的模型服务。首次运行需要准备 API 地址、API Key 和模型 ID。

| 配置项 | 默认读取 | CLI 覆盖 |
| --- | --- | --- |
| API 地址 | `ANTHROPIC_BASE_URL` | `--claude-api-base`，单一 Harness 运行也可用 `--api-base` |
| API Key | `ANTHROPIC_API_KEY` | `--claude-api-key-env`，单一 Harness 运行也可用 `--api-key-env` |
| 模型 ID | task 的 `model` 或 `--model` | 原样交给 Claude Code |

建议将 Key 保存在宿主机环境变量中，并将变量名传给 Roller：

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

`--api-key-env` 接收环境变量名，而不是 Key 本身。API 地址可以是服务域名、`/v1` 或完整的 `/v1/messages` 路径，Roller 会规范化地址，避免重复追加 `/v1/messages`。

若模型出现在列表中但运行仍然失败，可向 `/v1/messages` 发送一个最小请求，确认当前账号能够调用该模型。只有 `/v1/messages` 请求成功，才能确认该服务可供 Claude Code 使用。

## 4. Claude Code 专属参数 {#claude-code-cli-flags}

下表仅列出 Claude Code 专属运行参数。API 地址和 Key 的配置方式见第 3 节。所有 Harness 共用的参数见 [CLI 参数参考](/roller/start/cli-reference/)。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--docker-image` / `--claude-code-image` | `ROLLER_CLAUDE_CODE_IMAGE` 或 `roller-claude-code:2.1.222` | 覆盖 Claude Code 镜像 |
| `--claude-settings` | 无 | 向隔离容器注入原生 `settings.json`。运行锁保存其 SHA-256，含旧 BLAKE2b 指纹的 lock 仍可 Resume |
| `--claude-max-turns` | 无 | 每条预定义用户消息的 Agent 执行轮数上限 |
| `--claude-max-thinking-tokens` | 无 | 设置传给 Claude Code 的 `MAX_THINKING_TOKENS` |
| `--claude-permission-mode` | `bypassPermissions` | 选择 Claude Code permission mode |
| `--claude-unique-tool-ids` | 关闭 | API 服务重复签发工具调用 ID 时，在 Claude Code 收到响应前替换重复的 ID，见 9.5 节 |

单一 Claude Code 运行可使用通用参数形式。混合 Harness 运行应使用 `--claude-code-image`、`--claude-api-base` 和 `--claude-api-key-env` 等专属形式，以免设置作用于其他参与者。

## 5. 多模态能力

Claude Code Harness 同时支持纯文本模型和具备视觉能力的模型。图片通过 `files.inputs` 进入工作区，Claude Code 可使用原生 `Read` 工具打开本地图片。图片工具结果保留在原始轨迹、ACTF 和多模态 SFT 中，其中 SFT 使用 `<image>` 占位符和顶层 `images` 字段保存图片。

视觉任务还要求所选模型和 Anthropic-compatible API 服务支持图片内容块。Task 的 `messages[].content` 当前只支持字符串，不能直接写入图片内容块。如需随首条用户消息发送输入图片，请在 [`files.attach_images`](/roller/tasks/task-format/) 中列出。纯文本模型仍可处理文本和普通文件，但无法完成需要理解图片内容的任务。

## 6. Thinking 配置

`--thinking` 用于设置 Claude Code 的推理强度。省略时使用 Claude Code 和模型的默认值。

| Roller 输入 | Claude Code 参数 | 说明 |
| --- | --- | --- |
| 省略 | 不传 `--effort` | 使用默认行为 |
| `low` | `low` | 较低推理强度 |
| `medium` | `medium` | 中等推理强度 |
| `high` | `high` | 较高推理强度 |
| `xhigh` | `xhigh` | 仅在模型支持时使用 |
| `max` | `max` | 仅在模型支持时使用 |
| `ultra` | `ultracode` | Roller 名称到 Claude Code 名称的映射 |

`off`、`none`、`minimal` 和 `adaptive` 没有对应的 Claude Code 档位，因此会在启动前报错。首次使用某个模型时，建议省略 `--thinking` 或先选择服务明确支持的档位。

如需限制 thinking token 数，可额外使用：

```text
--claude-max-thinking-tokens 4096
```

不同模型对 token 上限的支持方式不同。若服务拒绝该设置，应移除此参数，仅保留 `--thinking`。

Claude Code 返回的可见 thinking、reasoning 或 analysis 写入 ACTF/SFT 的 `reasoning_content`。服务只返回 token 数或加密内容时，该字段可能为空。`--no-keep-thinking` 只清除 ACTF/SFT 中的推理文本，不修改原生 session。

## 7. Claude settings 与权限

如需使用 Claude Code 原生设置，可提供 settings 文件：

```bash
roller collect ... \
  --claude-settings examples/config/claude-code/settings.json.example
```

Roller 将该文件复制到当前容器并显式加载。修改 settings 后，不应复用旧的 run 目录。示例文件不包含 API Key、hook 或额外权限，可按需复制后修改。

自动化采集默认使用 `bypassPermissions`，以免执行在交互确认界面阻塞。也可通过 `--claude-permission-mode` 选择所固定的 Claude Code 版本支持的其他模式。`--claude-max-turns` 限制每条用户消息内的 Agent 执行轮数，而非 task 的消息数量。

## 8. Session 与工作区

每个 Agent 或 Simulator 均在独立的一次性容器中运行，不读取宿主机的 Claude 登录信息、settings 或历史 session。

- 输入文件只读，并保持 Task Bundle 中的相对路径。
- Context 文件复制到 task 声明的位置。如需 Claude Code 自动读取项目说明，可将目标文件命名为 `CLAUDE.md`。
- `runtime.setup` 在第一轮开始前执行。
- 输出目录保持可写，结束后回收至 sample 的 `results/`。

预定义多轮消息沿用同一个 Claude Code session，因此对话历史和工作区文件在后续轮次中仍可使用。

## 9. 轨迹与请求记录

一次运行生成以下主要文件：

| 文件 | 用途 |
| --- | --- |
| `trace.jsonl` | 合并 Claude Code 主 session 和 subagent 的原生事件，主要用于排错 |
| `trace_ACTF.json` | 将文本、thinking、工具调用和结果整理成统一结构 |
| `trace_SFT.json` | 将一条成功轨迹转换为训练数据格式 |
| `sft.jsonl` | 汇总当前 run 中可用于训练的成功 sample |

### 9.1 `trace.jsonl`

该文件保留 Claude Code 原生 session 事件，包括可见 thinking、工具信息和 token 使用量。该文件既不是终端输出，也不是模型服务收到的完整 HTTP 请求，其格式可能随 Claude Code 版本变化。

### 9.2 `trace_ACTF.json`

ACTF 将同一次回复中的文本、推理和多个工具调用归为一组，并将每个工具结果与对应调用配对。主 session 和 subagent 事件按时间顺序保存，usage 会去除流式更新造成的重复计数。

### 9.3 `trace_SFT.json` 与 `sft.jsonl`

SFT 使用统一的 `messages` 和 `tools` 结构。Claude 原生工具调用转换为可训练的 function call，图片 sample 额外包含 `images` 字段。

### 9.4 Wire trace

默认 `--wire-trace actf` 只为 ACTF/SFT 捕获 system prompt 和工具定义，不保留完整请求。如需核对模型实际收到的内容，可临时使用：

```text
--wire-trace full
```

此时 sample 会额外保留 `wire_trace.jsonl`。该文件可能包含完整消息、工具参数和 thinking 配置，仅适用于排错或审计。`--wire-trace off` 不记录这些请求信息，但仍保留 Claude Code 原生 session。

### 9.5 重复的工具调用 ID

部分 Anthropic 兼容服务会在多个响应中签发相同的 `tool_use` ID，例如每个响应都使用 `call_0`。此时 Claude Code 中有两个调用共用一个 ID，后续请求可能被拒绝，或与错误的结果配对。

如果前一个调用已经收到结果，ACTF 转换会将这类调用区分开：后一个调用改为 `<id>__occurrence_<n>`，其结果随之改名，调用中以 `original_tool_call_id` 记录原始 ID。如果 ID 在前一个结果到达之前被再次使用，配对存在歧义，转换失败。

如需在运行过程中修复 ID，请添加 `--claude-unique-tool-ids`：

```bash
roller collect ... --harness claude-code --api-base https://example.test --claude-unique-tool-ids
```

- 请求记录代理将流式和非流式 Messages 响应中重复的 ID 替换为新的 `toolu_roller_...` ID。Claude Code、`trace.jsonl`、ACTF 和记录的请求均使用替换后的 ID。
- 每次替换写入 sample 目录下的 `tool_id_mappings.jsonl`，包含 `native_id` 和 `delivered_id`。
- 启用该参数后，代理要求服务返回未压缩的响应，因为压缩的响应无法改写。
- 该参数依赖请求记录代理，要求同时使用 `--api-base`，以及 `--wire-trace actf` 或 `full`。
- 设置后，该参数写入 `lock.json` 和 `info.json`。修改后请使用新的 `--run-name`。

## 10. 首次运行检查

首次运行建议只使用一个简单 task。完成后依次检查：

1. run 目录的 `info.json` 中 `state` 为 `finished`。
2. sample 的 `info.json` 中 `status` 为 `ok`。
3. sample 中存在 `trace.jsonl`、`trace_ACTF.json` 和 `trace_SFT.json`。
4. 多轮 task 的轨迹中保留了全部用户消息和对应回复。
5. task 要求生成文件时，`results/` 中存在对应文件。

## 11. 常见问题

**(1) `Invalid token`**

检查 `--api-key-env` 指向的宿主机变量。

**(2) `No available channel for model`**

模型虽然出现在列表中，但当前账号或分组没有可用路由。

**(3) URL 出现 `/v1/v1/messages`**

请勿手动将 `ANTHROPIC_BASE_URL` 传入容器。请改用 Roller 的 `--api-base`，由 Roller 规范化地址。

**(4) `invalid beta flag`**

使用显式 `--api-base`，并保留默认的 `--wire-trace actf`。Roller 会在转发请求时移除不兼容的 beta 参数。

**(5) 模型拒绝 `budget_tokens` 或要求 adaptive thinking**

移除 `--claude-max-thinking-tokens`，只使用该模型支持的 `--thinking` effort。

**(6) ACTF 有 thinking token 但 `reasoning_content` 为空**

服务未返回明文，该字段为空并非由转换器造成。

**(7) 生成长工具参数时请求被中断或反复重试**

部分服务不以流式方式返回工具调用参数。模型生成较长参数时，连接可能连续数分钟没有数据。Claude Code 的流空闲超时由 `CLAUDE_STREAM_IDLE_TIMEOUT_MS` 控制（默认 300000 毫秒，小于默认值的设置不生效），请求超时由 `API_TIMEOUT_MS` 控制（默认 600000 毫秒）。两者均为 Claude Code 直接读取的环境变量，可写入 `--claude-settings` 文件的 `env` 块：

```json
{
  "env": {
    "CLAUDE_STREAM_IDLE_TIMEOUT_MS": "1800000",
    "API_TIMEOUT_MS": "3000000"
  }
}
```

也可在宿主机上设置后，通过 `--pass-env` 传入：

```bash
export CLAUDE_STREAM_IDLE_TIMEOUT_MS=1800000 API_TIMEOUT_MS=3000000
roller collect ... \
  --pass-env CLAUDE_STREAM_IDLE_TIMEOUT_MS \
  --pass-env API_TIMEOUT_MS
```
