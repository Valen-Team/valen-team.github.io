---
title: "QwenClawBench"
---

# QwenClawBench

QwenClawBench v1.1 包含 100 个真实用户分布的 OpenClaw 任务，覆盖 8 个领域。
上游：<https://github.com/SKYLENAGE-AI/QwenClawBench>。

Roller 复用上游任务、资产、自动 grader、LLM rubric、评分权重和 0.75 惩罚阈值。
支持 OpenClaw、Codex、Claude Code、Hermes、OpenCode、DeepSeek 和 Pi。adapter
默认写入 `harness: openclaw`，可用 `--harness` 覆盖。其他 Harness 可用于探索，但
排行榜可比实验应优先使用 OpenClaw，并固定镜像、Agent 模型、judge 模型和运行次数。

## 1. 数据与导出

```bash
git clone https://github.com/SKYLENAGE-AI/QwenClawBench.git \
  ~/QwenClawBench

# 官方设置为每题运行 3 次，共生成 300 行 task
roller bench export qwenclawbench ~/QwenClawBench \
  --runs-per-task 3 --output /tmp/qwenclawbench.jsonl
```

`ROOT` 可以是上游仓库，也可以直接是包含 `tasks/` 和 `assets/` 的 dataset 目录。
`--category` 和 `--task-id` 可重复。导出时，workspace 按上游
`workspace_files.source/content -> dest` 规则物化到
`QWENCLAW_CACHE_DIR`；默认缓存目录为
`~/.cache/roller/benches/qwenclawbench`。
部分上游任务在 prompt 和资产目标中使用 `workspace/...`，而 grader 将已配置的
workspace 本身视为该前缀。Agent 启动前，Roller 会将初始 `workspace/` 子树合并到
workspace 根，并创建 `workspace -> .` 兼容别名；因此模型和 grader 使用两种写法时
看到的是同一文件。最终输出快照不会包含该别名。

重复运行的 id 为 `<task_id>__run_01`、`__run_02`、`__run_03`。
原始 id、当前序号和总运行数分别保存在
`bench.metadata.upstream_task_id`、`run_index` 和 `runs_per_task`。

## 2. 一键运行脚本

`scripts/run-qwenclawbench.sh` 会自动导出任务、采集轨迹并生成
`<OUTPUT_ROOT>/<RUN_NAME>/report.json`。完整 hybrid 运行前，需先将模型和 judge
凭证设置为环境变量：

```bash
export LOCAL_VLLM_API_KEY=local
export QWENCLAW_JUDGE_BASE_URL=http://127.0.0.1:8000/v1
export QWENCLAW_JUDGE_API_KEY=local
export QWENCLAW_JUDGE_MODEL=qwen3-30b-a3b-local

QWENCLAW_ROOT=/path/to/QwenClawBench \
MODEL=local-vllm/qwen3-30b-a3b-local \
MODEL_CONFIG=examples/config/openclaw/models-local-vllm.json \
./scripts/run-qwenclawbench.sh
```

脚本默认使用 OpenClaw、每题运行 3 次。`TASK_IDS` 和 `CATEGORIES` 接受逗号分隔
列表；`PARALLEL`、`RETRIES`、`RUNS_PER_TASK`、`OUTPUT_ROOT` 和 `RUN_NAME`
可覆盖默认值。仅运行纯 automated task 时，可设置
`QWENCLAW_REQUIRE_JUDGE=0`。OpenClaw 的
`OPENCLAW_MODEL_REQUEST_TIMEOUT_SECONDS` 默认为 `300`，用于避免慢速或缓冲式
provider 触发运行时默认的 120 秒流式空闲上限。当 `MODEL` 包含 `glm` 时，runner
还会将 `RETRIES` 的默认值设为 `1`、将 `OPENCLAW_MAX_TOKENS` 的默认值设为 `32768`；其他模型
默认不重试，并保留模型配置中的 `maxTokens`。显式设置的 `RETRIES` 与
`OPENCLAW_MAX_TOKENS` 始终优先。使用其他 Harness 时，请设置 `HARNESS`、`API_BASE`
和 `API_KEY_ENV`，其中 `API_KEY_ENV` 是保存模型 API Key 的变量名：

```bash
export ROLLER_MODEL_API_KEY=replace-me

QWENCLAW_ROOT=/path/to/QwenClawBench \
MODEL=your-model-id \
HARNESS=opencode \
API_BASE=https://api.example.com/v1 \
API_KEY_ENV=ROLLER_MODEL_API_KEY \
TASK_IDS=task_00036_find_largest_file_in_downloads_directory \
RUNS_PER_TASK=1 \
QWENCLAW_REQUIRE_JUDGE=0 \
./scripts/run-qwenclawbench.sh
```

脚本后的参数会追加到 `roller collect`，例如 `--resume` 或 `--thinking high`。
`MAX_STEPS` 会映射到 Claude Code、Hermes、OpenCode、DeepSeek 和 Pi 对应的步数
参数；OpenClaw 与 Codex 当前没有用于该上限的通用 CLI 参数。

同一次运行也可以写成 YAML 文件，并通过 `roller bench run` 启动，见
[Benchmark 运行配置](/roller/benches/benchmark-standard/)：

```bash
roller bench run --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/qwenclawbench.yaml
```

## 3. 本地 Qwen

仓库提供了 vLLM/OpenClaw 模型配置
`examples/config/openclaw/models-local-vllm.json`，默认访问宿主机
`http://127.0.0.1:8000/v1`。`collect` 默认使用 host network。

```bash
export LOCAL_VLLM_API_KEY=local

# 先运行唯一的纯 automated 任务，该任务不需要 judge
roller bench export qwenclawbench ~/QwenClawBench \
  --task-id task_00036_find_largest_file_in_downloads_directory \
  --output /tmp/qcb.jsonl

roller collect --tasks /tmp/qcb.jsonl \
  --model local-vllm/qwen3-30b-a3b-local \
  --harness openclaw \
  --model-config examples/config/openclaw/models-local-vllm.json \
  --task-timeouts --output /tmp/qcb-runs --run-name local-qwen
```

运行前，先用以下命令确认 vLLM 暴露的 model id 与 JSON 一致：

```bash
curl http://127.0.0.1:8000/v1/models
```

外部 API 测试中，Codex 使用 Responses API，Claude Code 使用 Anthropic Messages
API，Hermes、OpenCode、DeepSeek 和 Pi 使用 OpenAI-compatible Chat Completions
API。具体 endpoint、key 和各 Harness 步数参数见
[CLI 参数参考](/roller/start/cli-reference/)。

## 4. Judge API

其余 99 个任务为 hybrid，需要 OpenAI-compatible
`POST /v1/chat/completions` judge。grader 在容器内执行，以下变量由
`bench.grade.env` 自动注入，无需额外添加 `--pass-env`：

| 变量 | 说明 |
| --- | --- |
| `QWENCLAW_JUDGE_BASE_URL` | API base 或完整的 `/chat/completions` URL |
| `QWENCLAW_JUDGE_API_KEY` | Bearer token；本地无鉴权服务也须设置非空占位值 |
| `QWENCLAW_JUDGE_MODEL` | judge model；带 `provider/` 前缀时，请求前会去除第一段 |
| `QWENCLAW_JUDGE_MAX_RETRIES` | 请求次数，默认 3，范围 1 到 100 |

`JUDGE_BASE_URL`、`JUDGE_API_KEY`、`JUDGE_MODEL` 是前三项的兼容别名。
专用的 `QWENCLAW_*` 变量优先。

使用同一个本地 Qwen 同时执行任务和判分：

```bash
export QWENCLAW_JUDGE_BASE_URL=http://127.0.0.1:8000/v1
export QWENCLAW_JUDGE_API_KEY=local
export QWENCLAW_JUDGE_MODEL=qwen3-30b-a3b-local

roller collect --tasks /tmp/qwenclawbench.jsonl \
  --model local-vllm/qwen3-30b-a3b-local \
  --harness openclaw \
  --model-config examples/config/openclaw/models-local-vllm.json \
  --task-timeouts --parallel 1 \
  --output /tmp/qcb-runs --run-name local-qwen
```

后续如需测试外部 API，仅替换这三个 judge 变量。不同的 judge endpoint、模型或 prompt
会改变分数，比较实验时须固定并记录这些配置。

## 5. 评分与聚合

Automated 分数是上游各数值检查项的平均值。LLM judge 按 rubric 返回 0 到 1 的分数。
Hybrid 先计算简单加权分数：

```text
score_simple = (w_auto * s_auto + w_llm * s_llm) / (w_auto + w_llm)
```

默认 `overall_score` 使用上游惩罚规则：当 `s_auto < 0.75` 时，
LLM 项按 0 计算；否则使用原 LLM 分数。Roller 始终保留
`automated_score`、`llm_judge_score`、`score_simple` 和 `overall_score`。

grader 在退出前将完整的最终 workspace 快照保存到 `.roller_outputs/`，随后 Roller 将其收集到
sample 的 `results/`。分数位于 `score.json`，运行元数据位于 `info.json`。
评分前，Roller 会将各 Harness 的原生 journal 转换为同一 ACTF 结构，并将消息、推理、
工具调用参数和工具结果规范化给上游 grader；这不会改变最终导出的 Harness 原生轨迹。

```bash
roller bench report /tmp/qcb-runs/local-qwen
roller bench report /tmp/qcb-runs/local-qwen --output /tmp/qcb-report.json
```

同一上游任务的多次 rollout 先取平均，再计算 `strict_accuracy`：
任务均分为 1.0 才算严格通过。报告还包含每题实际完成的 `runs_per_task`。

## 6. 可比性边界

- 官方配置为 OpenClaw、每题 3 次；修改 Harness 或次数时应单独标注。
- 必须使用 `--task-timeouts`，否则每题的 1800 秒上游预算不会生效。
- judge 是评分协议的一部分；外部 API 测试应固定 base URL、model 和服务版本。
- 导出 workspace 会拒绝绝对路径、`..`、符号链接和目标路径冲突，避免资产逃逸。
- 当前 Adapter 固定使用惩罚式 `overall_score`，不提供上游 `--simple-scoring` 开关；
  `score_simple` 仅作为诊断值保留。

## 7. 评测报告

- [DeepSeek V4 Flash 与 GLM-5.2 审计评测（2026-09-17 至 2026-09-18，英文）](/roller/benches/qwenclawbench-evaluation-2026-09-17/)
