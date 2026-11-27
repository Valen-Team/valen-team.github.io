---
title: "快速上手：从安装到第一条轨迹"
---

# 快速上手：从安装到第一条轨迹

本页以 OpenClaw 为例，介绍一条示例 Task 从安装到生成轨迹的完整流程。其他 Harness 可沿用相同的主流程：准备配置、dry-run、正式采集、验收结果和打开 Viewer。各 Harness 的镜像、API 配置和专属参数不完全相同，实际使用时请同时参考对应的 Harness 指南。

本页依次完成 dry-run、正式采集、输出文件定位和 Viewer 查看。若不熟悉 Task、Harness、rollout、run 或 trace 等术语，可先阅读 [Roller 简介](/roller/start/introduction/)。

## 1. 准备运行环境

环境要求：

- Python 3.10+。
- Docker（需自行安装）。
- OpenClaw 镜像。
- 支持 OpenAI Responses 或 Chat Completions 的模型 API。

建议使用独立的 Python 环境。以下以 [uv](https://docs.astral.sh/uv/) 和 Python 3.11 为例：

```bash
uv venv --python 3.11
source .venv/bin/activate

uv pip install roller-agent
roller --version
docker version
```

使用 pip 时，先创建并激活虚拟环境，再执行 `python -m pip install roller-agent`。

将示例 task 和配置模板写入工作目录，本指南后续步骤均在该目录下执行：

```bash
roller init
```

`roller init` 创建 `examples/tasks`、`examples/config`、`examples/benchmarks` 和 `examples/env`，已存在的文件保持不变。

如需使用最新改动或参与开发，请从源码安装。克隆的仓库已包含 `examples/`，无需执行 `roller init`：

```bash
git clone https://github.com/Valen-Team/Roller.git
cd Roller
uv venv && source .venv/bin/activate
uv pip install -e ".[test]"
```

安装并启动 Docker 后，`docker version` 会显示 Client 和 Server 信息。

在 macOS 上使用 Docker Desktop 时，还需在 **Settings → Resources → Network** 中启用 **Enable host networking**，然后重启 Docker Desktop。Roller 默认通过 host network 使 OpenClaw 能够访问本地请求代理。

## 2. 准备 OpenClaw 镜像

OpenClaw 同时支持 OpenAI Responses 和 Chat Completions。

在线拉取固定版本镜像：

```bash
docker pull ghcr.io/openclaw/openclaw:2026.11.10
```

也可加载已有归档：

```bash
docker load -i /path/to/openclaw-2026.11.10-linux-amd64.tar.gz
```

如需使用自定义镜像 tag，请通过 `--docker-image` 传入，或设置 `ROLLER_OPENCLAW_IMAGE`。

首次运行可保留默认 reasoning 配置。Roller 保存模型服务返回的可见 reasoning 文本。若服务仅返回 reasoning token 数，则没有可保存的 reasoning 文本。

## 3. 准备 OpenClaw API 配置

复制本地环境变量模板：

```bash
cp examples/env/api.env.example examples/env/api.env
```

在 `examples/env/api.env` 中，将 `MY_PROXY_BASE_URL` 和 `MY_PROXY_API_KEY` 设置为实际模型服务的地址和 Key。本页不使用其他 Harness 或 Web Search，其余变量保持为空。

保存后，将变量加载到当前 shell：

```bash
set -a
source examples/env/api.env
set +a
```


打开仓库提供的 [`examples/config/openclaw/models.json`](https://github.com/Valen-Team/Roller/blob/main/examples/config/openclaw/models.json)，将其中的 model `id` 设置为实际使用的模型名。后续命令中 provider 之后的 model ID 必须与该 `id` 完全一致。例如，若将 `id` 设置为 `qwen3.8-flash`，后续命令须使用 `--model my-openai-proxy/qwen3.8-flash`。

## 4. 示例 Task

[`examples/tasks/tasks.jsonl`](https://github.com/Valen-Team/Roller/blob/main/examples/tasks/tasks.jsonl) 包含四条由简到繁排列的 task：

| ID | 展示内容 |
| --- | --- |
| `01_text_only` | 单轮纯文本 |
| `02_local_markdown` | 读取输入文件并写入 `outputs/` |
| `03_user_memory_context` | 注入 `USER.md` 与 `MEMORY.md` |
| `04_multi_turn` | 两条预定义 user message 共用一个 session |

## 5. Dry-run

以 OpenClaw 为例：

```bash
roller collect \
  --tasks examples/tasks/tasks.jsonl \
  --model my-openai-proxy/my-model \
  --model-config examples/config/openclaw/models.json \
  --parallel 4 \
  --dry-run
```

Dry-run 在正式采集前检查 Roller 能否正确读取 task 和参数，并预览即将执行的 rollout。Dry-run 不启动容器、不调用模型 API，也不写入任何文件；它只读取一遍输入完成校验，并列出正式运行将记录的 bundle digest。确认无报错后，再执行正式采集。

## 6. 正式采集

```bash
roller collect \
  --tasks examples/tasks/tasks.jsonl \
  --model my-openai-proxy/my-model \
  --model-config examples/config/openclaw/models.json \
  --parallel 4 \
  --retries 1 \
  --timeout 600 \
  --output runs \
  --run-name quickstart
```

参数含义：

| 参数 | 含义 |
| --- | --- |
| `--parallel 4` | 最多同时运行 4 个 rollout |
| `--retries 1` | 首次失败后最多再尝试 1 次 |
| `--timeout 600` | 每个 rollout 的总超时为 600 秒 |
| `--output runs` | 所有 run 的宿主机根目录 |
| `--run-name quickstart` | 本次 run 保存为 `runs/quickstart` |

同名目录已存在时，Roller 默认拒绝覆盖。如需按原配置继续运行，请添加 `--resume`。如需开始新实验，请使用新的 `--run-name`。

## 7. 验收结果

采集成功后，首先检查 run 根目录：

```text
runs/quickstart/
├── info.json
├── lock.json
├── sft.jsonl
└── samples/
    └── <model>/
        └── <index>_<task-id>/
```

多数成功的 sample 至少包含以下文件：

```text
trace.jsonl
trace_ACTF.json
info.json
```

线性 sample 还包含 `trace_SFT.json`。主 Agent 发生上下文压缩时，`info.json` 的
`trajectory.sft_segments` 列出 `sft_segments/0001.json`、`0002.json` 等分段记录。
无法安全表示上下文的 sample 会将 SFT 标记为不可用。

按以下顺序验收：

1. 本次运行目录下的 `info.json` 中，`state` 是否为 `finished`，`summary.failed` 是否为 `0`，`summary.completed` 是否等于预期执行数量。
2. 每个 sample `info.json` 中的 `status` 是否为 `ok`，`usage.request_count` 是否大于 `0`。
3. `trace_ACTF.json` 是否包含完整的用户输入和模型输出。若存在工具调用，调用与结果是否正确配对。
4. 每条可用 SFT 是否包含 `messages` 和 `tools`；图片记录还包含 `images`，
   压缩分段还包含 `target_start_index`。
5. 需要文件交付的 task，其 sample `results/` 中是否包含预期文件。
6. run `sft.jsonl` 中是否每条符合条件的线性 sample 各占一行。压缩 sample 保留在
   `sft_segments/`，仅供支持 `target_start_index` 的训练读取器显式使用，
   不进入原有的 run 级训练集。

各文件的生成时机及失败时保留的内容见[轨迹产出文件指南](/roller/traces/trajectory-outputs/)。

## 8. 打开 Viewer

```bash
roller view runs/quickstart
```

Viewer 默认监听 `127.0.0.1:17865`，该端口被占用时自动改用空闲端口。命令启动后，在浏览器中打开终端输出的 URL。

Viewer 展示 ACTF 时间线。Inspector 用于查看 system prompt、tools schema、运行信息和原始内容。详见 [Viewer 指南](/roller/traces/viewer/)。

## 9. 下一步

- 编写自定义 task 数据：[Task 格式参考](/roller/tasks/task-format/)
- 配置 reasoning：[OpenClaw Harness 指南](/roller/harnesses/openclaw-configuration/#6-thinking-配置)
- 理解训练格式：[SFT 数据格式](/roller/traces/sft-format/)
- 查询全部命令行选项：[CLI 参数参考](/roller/start/cli-reference/)

## 10. 常见问题

**(1) Docker preflight 失败**

检查 `docker version` 是否能连接 Server，以及镜像是否已拉取或加载。

**(2) OpenClaw 找不到模型**

检查 `--model` 是否与 JSON 的 `provider/models[].id` 完全对应。

**(3) 配置提示环境变量缺失**

检查是否已执行 `source examples/env/api.env`，以及占位符名称是否一致。

**(4) `/responses` 返回 404**

服务可能只支持 Chat Completions。将 OpenClaw provider 的 `api` 设置为 `openai-completions`。

**(5) 同名 run 已存在**

继续原实验时使用 `--resume`；开始新实验时更换 `--run-name`。

**(6) Viewer 未显示新 task**

确认传入的是 run 根目录，然后刷新页面并检查 run 的 `info.json`。

OpenClaw Harness 指南列出了更多 OpenClaw 相关错误。
