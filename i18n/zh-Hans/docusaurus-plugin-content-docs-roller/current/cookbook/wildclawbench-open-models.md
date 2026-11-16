---
title: "用两个自部署模型采集 WildClawBench"
description: "一次完整的 Roller 运行：部署 GLM-5.3-Flash 和 DeepSeek-V4.1-Flash，在 WildClawBench 上采集并评分，最后导出为 Hugging Face 数据集。"
---

# 用两个自部署模型采集 WildClawBench

本页完整记录一次 Roller 运行，从部署模型到发布数据集。两个开源权重模型
GLM-5.3-Flash 和 DeepSeek-V4.1-Flash 在 OpenClaw Harness 中各运行 28 个
WildClawBench 任务，每个任务三次，Roller 在同一次 run 中采集并评分全部轨迹。轨迹发布为数据集
[Valen-Team/Roller-WildClawBench-Trajectories](https://huggingface.co/datasets/Valen-Team/Roller-WildClawBench-Trajectories)，
目前包含前 8 个任务的 44 条轨迹。

| 项目 | 取值 |
| --- | --- |
| 任务 | WildClawBench 60 个任务中的 28 个：只依赖模型、本地文件和任务自带 mock 服务的任务 |
| 模型 | `glm-5.3-flash` 和 `deepseek-v4.1-flash-1017`，均由 vLLM 部署 |
| rollout 数 | 28 个任务 × 3 次 × 2 个模型 = 168 |
| Harness | OpenClaw 2026.3.11，镜像 `wildclawbench-ubuntu:v1.3` |
| 评分 | 容器销毁前在任务容器内完成；judge 为 GLM-5.3-Flash |
| Roller | Commit `58331a757578f98258376b93040b4b28125e86d6` |
| 吞吐 | 已发布的 44 条轨迹共 7.2 小时的 agent 运行时间，77 分钟采完 |

本页用到的配置文件和命令位于
[`examples/cookbook/wildclawbench-open-models`](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/wildclawbench-open-models)。
换用其他模型时修改 `models.json`；其余可调整的部分见第 9 节。

## 1. 准备

- `main` 分支的 Roller（包含 `roller export --format hf`），以及正在运行的 Docker daemon：

  ```bash
  pip install git+https://github.com/Valen-Team/Roller.git
  ```

- WildClawBench 检出目录及其镜像 `wildclawbench-ubuntu:v1.3`，见 [WildClawBench](/roller/benches/wildclawbench/)。本次运行使用的版本是 `41bfe78a4d04369887687397708504882a80c17a`。
- 一个支持工具调用、同时提供两个模型的 OpenAI Chat Completions 接口。本次运行用 vLLM 部署每个模型：

| 设置 | GLM-5.3-Flash | DeepSeek-V4.1-Flash |
| --- | --- | --- |
| 服务模型名 | `glm-5.3-flash` | `deepseek-v4.1-flash-1017` |
| 权重 | [zai-org/GLM-5.3-Flash](https://huggingface.co/zai-org/GLM-5.3-Flash)，FP8 | [deepseek-ai/DeepSeek-V4.1-Flash-1017](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017)，FP8/FP4 混合量化 |
| 加速 | MTP=5 | DSpark=5，engram CPU offload |
| 思考 | `reasoning_effort=max` | `thinking=true`，`reasoning_effort=100` |
| 采样 | vLLM 服务端默认值 | vLLM 服务端默认值 |

思考设置是 vLLM 服务端的默认值，通过 `--default-chat-template-kwargs` 设定。本次运行中 Roller
不发送思考强度、temperature 和 `top_p`，所以 `wire_trace.jsonl` 的请求体里没有这些设置。

## 2. 描述模型

两个模型写在同一个 `models.json` 里，一条 `roller collect` 命令就能同时运行它们。地址和 key
由环境变量提供：

```json
{
  "mode": "merge",
  "providers": {
    "vllm": {
      "baseUrl": "${ROLLER_INFER_BASE_URL}",
      "apiKey": "${ROLLER_INFER_API_KEY}",
      "api": "openai-completions",
      "models": [
        {
          "id": "glm-5.3-flash",
          "name": "glm-5.3-flash",
          "input": ["text", "image"],
          "reasoning": true,
          "maxTokens": 32768,
          "contextWindow": 98304,
          "compat": {"supportsReasoningEffort": false}
        },
        {
          "id": "deepseek-v4.1-flash-1017",
          "name": "deepseek-v4.1-flash-1017",
          "input": ["text", "image"],
          "reasoning": true,
          "maxTokens": 32768,
          "contextWindow": 1048576,
          "compat": {"supportsReasoningEffort": false}
        }
      ]
    }
  }
}
```

| 字段 | 在本次运行中的作用 |
| --- | --- |
| `input` | 声明支持图片输入，OpenClaw 会把任务中的图片发给模型 |
| `reasoning` | 声明这是思考模型 |
| `contextWindow` | 模型服务的上下文长度；OpenClaw 把对话控制在这个长度以内 |
| `compat.supportsReasoningEffort` | 设为 `false` 后 OpenClaw 不发送自己的思考强度，服务端默认值不会被覆盖 |

命令行上的模型引用是 `<provider>/<id>`：`vllm/glm-5.3-flash` 和
`vllm/deepseek-v4.1-flash-1017`。两个模型的地址不同时，给每个模型单独写一个 provider。其他字段见
[OpenClaw 配置](/roller/harnesses/openclaw-configuration/)。

## 3. 选择任务

WildClawBench 有 6 个类别共 60 个任务，其中一部分需要网页搜索、访问网页或调用其他模型 API。
本次运行保留不需要这些的任务：

| 类别 | 保留 | 任务 |
| --- | ---: | --- |
| Productivity Flow | 3 | 日程安排、PDF 摘要、图片分类 |
| Code Intelligence | 11 | 主页生成、拼图类题目、SAM 3 推理与调试，使用本地代码、权重和图片 |
| Social Interaction | 6 | 会议协商和聊天类任务；邮件、聊天和日历是容器内的 mock 服务 |
| Search Retrieval | 0 | 每个任务都需要网页搜索 |
| Creative Synthesis | 4 | 海报和穿搭图片，使用本地素材 |
| Safety Alignment | 4 | 恶意 skill、权威指令、高危系统操作、提示注入 |
| 合计 | 28 | |

保留的 Task ID 在 `task-ids.txt` 中，每行一个。选择之前想先查看任务，可以只导出不运行：

```bash
roller bench export wildclawbench ~/WildClawBench --output /tmp/wildclawbench.jsonl
```

## 4. 使用自部署的 judge

60 个任务中有 46 个的评分器会调用 judge 模型。评分器从三个环境变量读取接口，OpenClaw Harness
默认把它们传入容器。本次运行让它们指向两个模型所在的接口，并指定 GLM-5.3-Flash 为 judge：

```bash
export OPENROUTER_BASE_URL="$ROLLER_INFER_BASE_URL"
export OPENROUTER_API_KEY="$ROLLER_INFER_API_KEY"
export JUDGE_MODEL=glm-5.3-flash
```

其余评分器检查文件和工具调用，不需要 judge。两个模型由同一个 judge、同一套提示词评分，分数可以互相比较。
WildClawBench 排行榜使用的是另一个 judge 模型。

## 5. 采集

先检查运行计划。dry run 解析任务并校验输入，不启动容器，也不调用模型：

```bash
roller collect --bench wildclawbench --bench-root ~/WildClawBench \
  $(sed 's/^/--bench-task-id /' task-ids.txt) \
  --bench-runs-per-task 3 \
  --model vllm/glm-5.3-flash \
  --model vllm/deepseek-v4.1-flash-1017 \
  --model-config models.json \
  --dry-run
```

然后开始采集：

```bash
roller collect --bench wildclawbench --bench-root ~/WildClawBench \
  $(sed 's/^/--bench-task-id /' task-ids.txt) \
  --bench-runs-per-task 3 \
  --model vllm/glm-5.3-flash \
  --model vllm/deepseek-v4.1-flash-1017 \
  --model-config models.json \
  --harness openclaw --openclaw-image wildclawbench-ubuntu:v1.3 \
  --openclaw-max-tokens 32768 --task-timeouts \
  --parallel 8 --grader-parallel 2 \
  --keep-thinking --wire-trace full \
  --output runs --run-name wildclawbench-open-models
```

| 参数 | 在本次运行中的作用 |
| --- | --- |
| `--bench-task-id` | 选择一个任务；`task-ids.txt` 的每一行对应一次 |
| `--bench-runs-per-task 3` | 每个任务在每个模型上运行三次，任务名为 `<id>__run_01` 到 `<id>__run_03` |
| 两个 `--model` | 在同一次 run 中让两个模型运行全部任务 |
| `--task-timeouts` | 每个任务使用 WildClawBench 为它设定的超时 |
| `--parallel 8` | 同时运行 8 个 rollout，两个模型共用 |
| `--grader-parallel 2` | 同时运行 2 个评分器；judge 调用和 rollout 共用同一个接口 |
| `--keep-thinking` | 在轨迹中保留模型的思考内容 |
| `--wire-trace full` | 把 Roller 转发给模型的每个请求体保存到 `wire_trace.jsonl` |

运行中断后，在同一条命令后加 `--resume`：已完成的 sample 保留，其余重新运行。已发布的轨迹就来自一次中断后用
这种方式继续的 run。

## 6. 查看结果

采集结束后，Roller 在 run 目录中写入 `bench-report.json`。已发布轨迹的统计如下：

| 模型 | Sample 数 | 完成 | 已评分 | 平均分 | 平均步数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `deepseek-v4.1-flash-1017` | 22 | 18 | 22 | 0.306 | 70.5 |
| `glm-5.3-flash` | 22 | 12 | 22 | 0.277 | 35.5 |

平均分的分母是该模型的全部 sample。以错误或超时结束的 sample 同样会评分，评的是它当时已经写出的文件。

从轨迹里能看到的两点：

- **7 步完成一个完整解法。** 在 `00000004_01_Productivity_Flow_task_6_calendar_scheduling__run_02` 中，GLM-5.3-Flash 读入三个输入文件，写出一个约束求解脚本，发现第一次写入被截断后重写脚本，运行并校验输出文件。整个过程用时 206 秒，评分 1.0。
- **分数接近，步数差别很大。** 在 PDF 摘要任务上，两个模型三次运行的得分都高于 0.9。DeepSeek-V4.1-Flash 用了 79 到 100 步，GLM-5.3-Flash 用了 35 到 65 步。

用 Viewer 打开 run，可以逐步查看一次 rollout，也可以在同一个任务上对比两个模型：

```bash
roller view runs/wildclawbench-open-models
```

## 7. 把 run 发布为数据集

`roller export --format hf` 把 run 打包成 Hugging Face 数据集目录：一份数据集卡片，以及每个模型的三样内容：
每个 sample 的 OpenClaw 原生会话、每个 sample 一行的表格、一个 Roller run 目录。本次运行的两个模型分别成为
`openclaw-glm-5.3-flash` 和 `openclaw-deepseek-v4.1-flash-1017` 两个部分。Hub 把这些会话识别为
agent traces，所以数据集带有 **Traces** 标签，每次 rollout 都能在 Hub 的轨迹查看器中打开。

导出的文件是脱敏后的：导出会把这次 run 的模型端点、主机路径和凭据取值替换为占位符，并打印替换了哪些内容。
`--redact-rules` 用来追加某个环境特有的替换，例如主机名和模型权重所在的目录。请在采集所用的环境中执行导出，
凭据变量在那里有值：

```bash
roller export runs/wildclawbench-open-models \
  --format hf --output dataset --redact-rules redact.json

hf upload Valen-Team/Roller-WildClawBench-Trajectories dataset . \
  --repo-type dataset --exclude "runs/*"
```

这个数据集发布卡片、会话和表格。run 目录包含这次运行的全部文件，`--exclude` 让它留在采集机器上。

首次导出会写入 `dataset/README.md`，请编辑它来介绍数据集；之后的导出只刷新其中的统计表。后续的 run
（其他模型或其他 Harness）用同样的方式追加到同一个仓库，每个 run 成为各自的 `<harness>-<model>` 部分。
表格的字段、脱敏的内容和规则文件的格式见
[Hugging Face 导出](/roller/traces/trajectory-outputs/#hugging-face-export)。

## 8. 使用数据集

在数据集页面打开 **Data Studio**，点击任意一行，就能在轨迹查看器中阅读一次 rollout：提示词、思考、
工具调用和工具结果。

加载表格，把得分不低于 0.8 的 rollout 留作训练记录：

```python
import json

from datasets import load_dataset

rows = load_dataset(
    "Valen-Team/Roller-WildClawBench-Trajectories", "trajectories", split="train"
)
solved = rows.filter(
    lambda row: row["messages"] is not None and (row["score"] or 0) >= 0.8
)
records = [
    {"messages": json.loads(row["messages"]), "tools": json.loads(row["tools"])}
    for row in solved
]
```

逐个任务对比两个模型：

```python
frame = rows.to_pandas()
print(frame.pivot_table(index="upstream_task_id", columns="run", values="score"))
```

## 9. 调整运行

| 要调整的内容 | 修改位置 |
| --- | --- |
| 模型 | `models.json` 中的 provider 和 `--model` 参数；任何 Chat Completions 或 Responses 接口都可以 |
| 任务 | `task-ids.txt`，或用 `--bench-category` 选择整个类别 |
| Benchmark | `--bench` 和 `--bench-root`，见 [Benchmark](/roller/benches/bench-format/#8-已支持的-bench) |
| 每个任务的运行次数 | `--bench-runs-per-task` |
| Judge | `OPENROUTER_BASE_URL`、`OPENROUTER_API_KEY` 和 `JUDGE_MODEL` |
| Harness | `--harness`；其他六个 Harness 使用 `--api-base` 和 `--api-key-env`，不使用 `--model-config` |
