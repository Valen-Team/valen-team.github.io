---
title: "OpenClaw Harness 指南"
---

# OpenClaw Harness 指南

OpenClaw Harness 用于通过 OpenClaw Agent 执行文本、文件、图片或 Web Search task。它可以连接 OpenAI Responses 或 Chat Completions 兼容服务。本页按照镜像、模型 API、专属参数、Thinking、轨迹和搜索的顺序介绍首次使用所需内容。

首次采集请参照[快速上手](/roller/start/getting-started/)。本页介绍自定义模型和 OpenClaw 专属功能的配置。Task 字段见 [Task 格式参考](/roller/tasks/task-format/)，通用产物见 [轨迹产出文件指南](/roller/traces/trajectory-outputs/)。

## 1. 适用范围

OpenClaw Harness 适用于以下场景：

- 使用 OpenAI Responses 或 Chat Completions 兼容模型服务。
- 处理文本、普通文件和图片。
- 运行单轮或多轮 task。
- 按需使用 Thinking 和 Web Search。

Task 消息目前不能直接包含图片内容块。图片须先通过 `files.inputs` 放入工作区，再由 OpenClaw 的图片工具读取。

## 2. 镜像准备

采集前需要准备：

- Python 3.10+。
- 可用的 Docker daemon。
- OpenClaw Docker 镜像。
- 模型服务所需的 API 地址与凭证。

Roller 默认使用固定版本的官方稳定镜像 `ghcr.io/openclaw/openclaw:2026.11.10`，其中包含
OpenClaw、Node.js 与 Python 3。Roller 直接运行该镜像，无需修改 OpenClaw 源码或构建
派生镜像。

可以在线拉取固定版本镜像：

```bash
docker pull --platform linux/amd64 ghcr.io/openclaw/openclaw:2026.11.10
```

也可以加载已有归档：

```bash
docker load -i openclaw-2026.11.10-linux-amd64.tar.gz
```

其他镜像仍可通过参数或环境变量指定：

```bash
roller collect ... --docker-image custom-openclaw-image:tag

# 或作为默认值
export ROLLER_OPENCLAW_IMAGE=custom-openclaw-image:tag
```

若 Docker daemon 位于另一台机器，可使用 Docker CLI 自带的 `DOCKER_HOST` 等配置。Roller 调用本机的 `docker` 命令，因此 `docker version` 能够连接时，Roller 通常也能使用同一个 daemon。

```bash
docker version
docker image inspect custom-openclaw-image:tag
```

使用官方 OpenClaw 镜像时，无需额外设置容器用户。Roller 会在一次性容器中自动准备可写工作区和本地 Gateway 配置，这些设置不会改变宿主机权限。task 工作区位于 `/tmp_workspace`；OpenClaw 在 `/root/.openclaw/workspace` 中运行，这是 OpenClaw 安装后的默认工作区路径，Roller 把它链接到 task 工作区，会话文件记录的工作目录即为该路径。仅当自定义镜像已为默认用户准备好可写工作区，且应以该用户运行时，才需传入 `--container-user image`。

## 3. 环境变量与 API

OpenClaw 通过模型配置文件读取模型名称、API 协议、服务地址和凭证。配置文件中的敏感值使用环境变量占位，运行前再从当前 shell 加载。

### 3.1 模型配置

`--model-config` 接受一份 OpenClaw models JSON。基础文本模板是
[`examples/config/openclaw/models.json`](https://github.com/Valen-Team/Roller/blob/main/examples/config/openclaw/models.json)，GPT 与
Chat Completions reasoning 模板是
[`examples/config/openclaw/models-reasoning.json`](https://github.com/Valen-Team/Roller/blob/main/examples/config/openclaw/models-reasoning.json)：

```json
{
  "mode": "merge",
  "providers": {
    "my-openai-proxy": {
      "baseUrl": "${MY_PROXY_BASE_URL}",
      "apiKey": "${MY_PROXY_API_KEY}",
      "api": "openai-responses",
      "models": [
        {"id": "my-model", "name": "My model"}
      ]
    }
  }
}
```

命令中的 `--model` 使用 `provider/model-id` 格式。`provider` 对应 `providers` 下的名称，`model-id` 对应 `models[].id`。上例应使用：

```text
my-openai-proxy/my-model
```

配置中的模型 ID 应改为模型服务实际使用的名称，命令中的值必须与配置完全一致。`${ENV_NAME}` 从当前 shell 读取，引用的环境变量缺失或为空时，Roller 会在启动 task 前报错。

### 3.2 API 协议

`api` 用于选择模型服务支持的协议：

| `api` | 适用服务 |
| --- | --- |
| `openai-responses` | 实现 OpenAI Responses API 的服务 |
| `openai-completions` | 只实现 Chat Completions 兼容接口的服务 |

`apiKey` 必须为非空值。若服务无需鉴权，可填写 `"apiKey":"not-required"`。

### 3.3 加载环境变量

模型配置中的 API 地址和凭证通过 `${ENV_NAME}` 从当前 shell 读取。从示例创建本地文件，并将其中的 `MY_PROXY_BASE_URL` 和 `MY_PROXY_API_KEY` 设置为模型服务提供的实际值：

```bash
cp examples/env/api.env.example examples/env/api.env

# 保存后加载到当前 shell
set -a
source examples/env/api.env
set +a
```

完成模型配置并加载环境变量后，先运行一个 task 检查配置：

```bash
roller collect \
  --harness openclaw \
  --tasks examples/tasks/tasks.jsonl \
  --model my-openai-proxy/my-model \
  --model-config examples/config/openclaw/models.json \
  --limit 1 \
  --output runs \
  --run-name openclaw-demo
```

命令中的 `my-openai-proxy/my-model` 必须与第 3.1 节的模型配置一致。该命令仅执行一个 task，以便在更大规模的运行前确认配置是否正确。

以下常用变量会在宿主机存在且非空时自动传入 OpenClaw 容器：

```text
OPENROUTER_API_KEY        OPENROUTER_BASE_URL
BRAVE_API_KEY             TAVILY_API_KEY
HTTP_PROXY                HTTPS_PROXY               NO_PROXY
http_proxy                https_proxy               no_proxy
```

## 4. OpenClaw 专属参数 {#openclaw-cli-flags}

本节仅列出运行 OpenClaw 时需重点关注的参数。所有 Harness 共用的 task、并行、重试和输出参数见 [CLI 参数参考](/roller/start/cli-reference/)。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--docker-image` / `--openclaw-image` | `ROLLER_OPENCLAW_IMAGE` 或内置值 | 覆盖 OpenClaw 镜像。混合 Harness 运行时使用专属形式 |
| `--container-user` | `0` | 一次性 task 容器用户。`image` 使用镜像默认用户 |
| `--docker-binary` | `docker` | Docker CLI 名称或路径 |
| `--model-config` | 无 | 自定义模型服务和模型 JSON |
| `--openclaw-model-request-timeout` | OpenClaw 默认值 | 模型请求超时（秒），同时作为流式响应的空闲超时，需要 `--model-config` |
| `--openclaw-config-set KEY=VALUE` | 无 | 在每个 OpenClaw 容器中执行 `openclaw config set KEY VALUE`，可重复 |
| `--network` | `host` | 容器网络模式 |
| `--gateway-port` | 自动 | gateway 起始端口。省略时从 `18789` 起选择第一段空闲范围；显式指定时范围宜低于 `32768`，见第 10 节 (4) |
| `--gateway-port-step` | `10` | worker 之间的端口间隔 |
| `--gateway-startup-timeout` | `240` | 等待 gateway 就绪的秒数 |
| `--session-id` | `roller` | OpenClaw session ID 前缀 |
| `--thinking` | 无 | 设置模型的 reasoning 强度，常用档位和保存规则见第 6 节 |
| `--keep-thinking` / `--no-keep-thinking` | 开启 | 是否保留轨迹和请求历史中的 thinking |
| `--cache-trace` / `--no-cache-trace` | 开启 | 是否记录每次组装的 system prompt。ACTF 固化首个有效值 |
| `--wire-trace` | `actf` | 工具定义或完整请求的记录模式 |
| `--search-provider` | 无 | OpenClaw Web Search provider |
| `--pass-env NAME` | 无 | 增加一个环境变量名，可重复 |
| `--set-image-model` / `--no-set-image-model` | 开启 | 是否设置 OpenClaw image model |
| `--keep-container-on-error` | 关闭 | 出错后保留容器以便排查 |
| `--collect-path` | 无 | Legacy：额外回收容器绝对路径 |

如需调整 Roller 未提供专用参数的 OpenClaw 设置，请使用 `--openclaw-config-set`：

```bash
roller collect ... \
  --openclaw-config-set diagnostics.stuckSessionAbortMs=2700000
```

- 设置在 Roller 的配置步骤之后执行，作用于本次 run 的每个 OpenClaw 容器，包括 OpenClaw User Simulator。随后 Roller 写入本次 rollout 的 gateway token 并启动 gateway。
- 值按 OpenClaw 的规则解析：可解析为 JSON/JSON5 的值按对应类型写入，其余值作为字符串写入。OpenClaw 无法识别的路径会导致 rollout 在启动阶段报错。
- 由 Roller 管理的路径会被拒绝，并提示应使用的 Roller 参数，例如 `gateway.port`（`--gateway-port`）、`models`（`--model-config`）、`agents.defaults.thinkingDefault`（`--thinking`）。各项设置之间也不得重叠，例如不得同时设置 `agents.defaults.compaction` 和 `agents.defaults.compaction.reserveTokens`。
- Agent 每轮的时限由 Roller 的 `--timeout` 决定：Roller 将剩余时间传给 `openclaw agent --timeout`，该值会覆盖 `agents.defaults.timeoutSeconds`。
- 设置会写入 `lock.json` 和 `info.json`。仅当键名本身类似凭证（`token`、`apiKey`、`password`、`secret` 等）时，对应的值才会被脱敏；JSON 对象形式的值按原样记录。修改设置后请使用新的 `--run-name`，`--resume` 会拒绝设置不一致的 run。
- 请勿通过此方式传递密钥：这些值也会出现在 `docker exec` 的命令行中。

全部参数以当前安装版本为准：

```bash
roller collect --help
```

## 5. 多模态能力

普通文本模型使用：

```json
{"id":"my-model","name":"My model"}
```

视觉输入模型须声明 image 能力：

```json
{
  "id": "my-multimodal-model",
  "name": "My Multimodal Model",
  "input": ["text", "image"]
}
```

完整模板见 [`examples/config/openclaw/models-multimodal.json`](https://github.com/Valen-Team/Roller/blob/main/examples/config/openclaw/models-multimodal.json)。`input` 仅用于告知 OpenClaw 如何使用模型。实际 API 后端仍须在所选 API 协议下支持图像输入。

图片通过 `files.inputs` 进入 task 工作区，再由 OpenClaw 的图像查看工具打开。Task 的 `messages[].content` 当前只支持字符串，不能直接写入图片内容块。如需随首条用户消息发送输入图片，请在 [`files.attach_images`](/roller/tasks/task-format/) 中列出。纯文本模型仍可处理文本和普通文件，但不能完成需要理解图片内容的 task。

默认情况下，Roller 还会尝试将 task model 设置为 OpenClaw 的 image model。旧版 OpenClaw 不支持该设置时仅记录 warning。如需关闭，请使用 `--no-set-image-model`。

User message 中的原生 image block 会保留在 ACTF，并在 SFT 中转为按顺序对齐的 `<image>` 占位符和顶层 `images`。OpenClaw 的 `image` 工具通过独立的模型请求发送图片，session 中只记录文字答案。使用 `--wire-trace actf` 或 `full` 时，Roller 从 wire trace 读取该请求的图片输入，并补到对应的 tool result；`actf` 模式下每张图片只保存一次，不保留其他请求正文。使用 `--wire-trace off` 时，tool result 只保留文字答案。

## 6. Thinking 配置

Thinking 是模型在给出最终答案前的推理过程。`--thinking` 设置 OpenClaw 请求的推理强度。该参数仅影响模型生成回答的方式，不会修改 task 的内容。

### 6.1 设置时机

首次运行时可省略 `--thinking`，由 OpenClaw 和模型使用默认设置。如需指定推理强度，请在命令中添加该参数：

```bash
roller collect ... --thinking high
```

同一设置也可以写在 task 的 `runtime.thinking` 中。两处同时存在时，task 中的设置优先。两处都没有设置时，使用 OpenClaw 或模型的默认值。

### 6.2 如何选择档位

常用档位如下：

| 档位 | 含义 |
| --- | --- |
| `off` | 请求关闭额外推理。部分模型或 API 服务可能不支持，也可能仍使用自己的默认推理方式 |
| `low` | 使用较少的推理，通常响应更快、消耗更少 |
| `medium` | 在响应速度和推理强度之间取得平衡 |
| `high` | 使用更多推理，适用于较复杂的 task，但通常需要更多时间和 token |

Roller 还可识别 `minimal`、`xhigh`、`adaptive`、`max` 和 `ultra`。这些属于扩展档位，仅当 OpenClaw、模型和 API 服务均支持时才能使用。`none` 视为 `off`。

Roller 能识别某个档位，不代表当前模型一定支持该档位。运行时该值依次经过 Roller、OpenClaw 和模型 API，任意一层不支持都会报错。因此，首次使用某个模型时，应优先选择模型服务明确支持的档位，并先用一个 task 验证。

> [!NOTE]
> `wildclawbench-ubuntu:v1.3` 中的旧版 OpenClaw 仅能可靠支持到 `high`。请勿在该镜像中使用 `xhigh`、`adaptive`、`max` 和 `ultra`。

### 6.3 运行检查

以下命令仅运行一个 task，适用于在较大规模采集前检查 thinking 配置是否可用：

```bash
roller collect \
  --harness openclaw \
  --tasks examples/tasks/tasks.jsonl \
  --model my-provider/my-model \
  --model-config examples/config/openclaw/models.json \
  --thinking high \
  --limit 1 \
  --output runs \
  --run-name thinking-check
```

`my-provider` 必须与模型配置中的 provider 名一致，`my-model` 必须与该 provider 下的 model `id` 一致。示例中的名称须替换为实际使用的配置。

将 thinking 设置为 `off` 以外的档位时，若 model 配置未声明 `reasoning`，Roller 会在本次运行使用的配置副本中补充 `reasoning: true`。若配置已显式设置 `reasoning: false`，Roller 会保留该设置，此时应确认模型是否支持 thinking。

部分 API 服务只接受特定档位，或使用自身的 reasoning 字段。此类服务须按照其接口说明设置 `compat`。请勿直接复制其他模型的 `compat` 配置。完整的通用参数规则见 [CLI 参数参考](/roller/start/cli-reference/)。

### 6.4 推理内容如何保存

`--thinking` 与 `--keep-thinking` 作用不同：`--thinking` 控制模型使用的推理强度，`--keep-thinking` 控制可见推理内容是否写入轨迹。

`--keep-thinking` 默认开启。若模型服务返回了可见的 reasoning，Roller 会将其保存到 ACTF 和 SFT，并保留在后续多轮请求的历史中。`--no-keep-thinking` 可移除这部分内容，但不会关闭模型推理。

部分服务只返回 reasoning token 数量，不返回具体文本。此时即使模型执行了推理，`reasoning_content` 也可能为空。Roller 不会根据 token 数量生成或补写推理文本。

### 6.5 检查 Thinking 是否生效

建议先使用 `--limit 1` 运行一个短 task，再开始批量采集。依次检查：

1. 命令是否正常结束，以及 run `info.json` 中是否记录错误。
2. sample `info.json` 中的 `status` 是否为 `ok`。
3. ACTF 和 SFT 文件是否正常生成。

如需确认模型实际收到的 thinking 参数，可临时添加 `--wire-trace full`，然后查看 sample 目录中的 `wire_trace.jsonl`。该文件可能包含请求内容，仅应在排错时使用。

若 OpenClaw 提示档位不受支持，请改用模型服务明确支持的档位。若仍无法确定，可暂时删除 `--thinking`，确认默认配置能够正常运行后再继续调整。

## 7. 轨迹与请求记录

本节说明 Roller 会记录哪些 OpenClaw 运行信息，以及如何在需要排错时保存完整模型请求。

一次运行会生成以下主要轨迹文件：

| 文件 | 用途 |
| --- | --- |
| `trace.jsonl` | 保存 OpenClaw 原生 session 事件，主要用于排错 |
| `trace_ACTF.json` | 将回复、thinking、工具调用和结果整理成统一结构 |
| `trace_SFT.json` | 将成功轨迹整理成训练数据格式 |


默认开启的 `--cache-trace` 会将 OpenClaw 组装的 system prompt 写入 `trace_ACTF.json`。`--wire-trace` 决定是否额外记录工具定义或完整请求：

| `--wire-trace` | 记录内容 | 适用场景 |
| --- | --- | --- |
| `actf`（默认） | 将工具定义写入 `trace_ACTF.json`，不保存完整请求 | 日常采集 |
| `full` | 额外保存完整请求到 `wire_trace.jsonl`，并生成脱敏后的 `cache_trace.jsonl` | 排错或审计模型实际收到的内容 |
| `off` | 不记录请求数据，ACTF 中的 `tools` 为 `null` | 不需要请求信息时 |

OpenClaw 写 session 记录时，默认会把形似凭据的文本缩写（例如 `RV_9fc89bb7400a1812` 变成 `RV_9fc…1812`），后续轮次又从这份记录重建上下文，导致模型和最终产物都拿不到原文。Roller 因此在启动时设置 `logging.redactSensitive=off`，让 `trace.jsonl`、ACTF 和 SFT 保留任务原文；这些文件本身就应按敏感数据处理。已移除该配置项的 OpenClaw 版本会拒绝这条设置，Roller 只记一条 warning 并继续运行。

OpenClaw 还会向主 session 发送心跳消息，定时触发，子 agent 结束时也会触发。每次心跳都是一次与 task 无关的模型请求，开启 `--capture-calls` 时它所在的 session 会被记为第二个 root 参与者。Roller 在启动时设置 `agents.defaults.heartbeat.every=0m` 关闭心跳；不接受该配置项的版本会保留心跳，Roller 记一条 warning。

`trace.jsonl` 记录的是 OpenClaw session 事件，不一定等于实际发送给模型的完整请求。需要检查模型实际收到的 messages、tools 和参数时，使用 `--wire-trace full`。

`full` 会产生更大的文件，其中可能包含 prompt、reasoning、工具参数和结果等敏感内容，不宜在大批量采集中长期开启。使用 `actf` 或 `full` 时建议保留默认的 `--network host`，并确保模型配置提供可访问的绝对 `baseUrl`。详细文件说明见[轨迹产出文件指南](/roller/traces/trajectory-outputs/#32-session-历史不等于模型请求-context)。

## 8. Web Search

Web Search 使 OpenClaw Agent 能够在执行 task 时查询网页信息。仅当 task 需要联网搜索时才需配置。处理本地文件、已有上下文或不依赖网页信息的 task 无需此项配置。

使用 Web Search 时，须同时选择搜索服务并提供对应的 API Key。以下以 Brave Search 为例。

先在 `examples/env/api.env` 中填写：

```bash
BRAVE_API_KEY=实际的-Brave-API-Key
```

保存后，将环境变量加载到当前 shell：

```bash
set -a
source examples/env/api.env
set +a
```

运行 task 时指定 Brave：

```bash
roller collect \
  ... \
  --search-provider brave
```

## 9. 首次运行检查

首次运行建议使用 `--limit 1`，确认配置正确后再开始批量采集。命令结束后依次检查：

1. run 目录的 `info.json` 中 `state` 为 `finished`。
2. sample 的 `info.json` 中 `status` 为 `ok`。
3. sample 中存在 `trace.jsonl`、`trace_ACTF.json` 和 `trace_SFT.json`。
4. task 要求生成文件时，`results/` 中存在对应文件。

## 10. 常见问题

**(1) Docker preflight 失败**

首先运行 `docker version`。若 Docker 使用远程 daemon，请确认当前 shell 的 Docker context、`DOCKER_HOST` 和证书配置能够正常连接。

**(2) `model config references missing environment variable`**

模型 JSON 中的 `${ENV_NAME}` 未在当前 shell 中设置，或值为空。加载本地 env 文件后重新运行。

**(3) 模型请求返回 404 或协议错误**

通常原因是 `baseUrl` 末尾路径或 `api` 协议不匹配。请确认服务端实现的是 Responses API 还是 Chat Completions API。

**(4) gateway 端口冲突**

使用默认的 `--network host` 时，每个 rollout 的 OpenClaw gateway 均监听在宿主机的 `起始端口 + slot × --gateway-port-step` 上（启用 OpenClaw User Simulator 时，slot 数为 `--parallel` 的两倍）。同一台机器上同时运行多个 run 时，端口范围不得重叠。

- 省略 `--gateway-port` 时，Roller 从 `18789` 起选择第一段既未被其他 Roller run 预留、也未被占用的范围，并在整个 run 期间持有该预留。预留通过 `/tmp/roller-gateway-ports/` 下的锁文件实现，进程退出（包括崩溃）时自动释放。该路径固定，不随 `$TMPDIR` 变化，因此同一台机器上的所有 run 均能看到彼此的预留。实际使用的起始端口记录在 `info.json` 中。
- 若显式指定的 `--gateway-port` 与其他 run 的预留重叠，或其中有端口已被占用，run 会在写入任何文件之前报错。显式指定的范围宜低于内核的临时端口范围（Linux 默认从 `32768` 起），因为 Roller 的本地代理监听在临时端口上，可能在 run 期间占用该范围内的某个端口。
- 若 run 期间有其他程序占用了某个 rollout 的端口，该 rollout 会在启动 gateway 之前报错 `OpenClaw gateway port ... is already in use`，而不会连接到其他程序的 gateway。
- 起始端口和 `--gateway-port-step` 均不参与 `lock.json` 比对，因此 `--resume` 时可能得到不同的范围。

不使用锁文件的程序（包括更早版本 Roller）只能通过其正在监听的端口被发现。与此类程序同时运行时，宜显式分开端口范围：

```bash
roller collect ... --gateway-port 22000
```

**(5) task 成功回复但 sample 失败**

先查看 sample 的 `info.json` 和 `trace.jsonl`。常见原因包括轨迹转换失败，或输出目录中包含无法安全回收的符号链接和特殊文件。详细规则见 [轨迹产出文件指南](/roller/traces/trajectory-outputs/)和[结果存储](/roller/tasks/task-bundle-and-storage/#5-输出回收)。

**(6) 生成长工具参数时被中断：`LLM idle timeout (120s)` 或 `OPENCLAW_DIRECT_ABORT`**

部分 OpenAI 兼容服务不流式返回工具调用参数，在参数全部生成后才一次性下发。Agent 在一次调用中写入大文件时，连接可能连续数分钟没有数据，从而触发 OpenClaw 的两个看门狗：

- 模型空闲超时，默认 120 秒，报错为 `LLM idle timeout (120s): no response from model`；
- session 停滞恢复，流连续 6 分钟无进展时中止 run，报错为 `AbortError: agent run aborted: code=OPENCLAW_DIRECT_ABORT`，gateway 日志中包含 `stalled session ... reason=active_work_without_progress`。

须同时放宽这两项限制：

```bash
roller collect ... \
  --timeout 3600 \
  --openclaw-model-request-timeout 3000 \
  --openclaw-config-set diagnostics.stuckSessionAbortMs=2700000
```

`--openclaw-model-request-timeout` 同时也是单次模型请求的总时长上限，因此不得小于模型最长一次调用（包括推理和写出工具参数）所需的时间。
