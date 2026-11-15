---
title: "PinchBench"
---

# PinchBench

Roller 从 PinchBench 的 `tasks/manifest.yaml` 读取任务。目前支持 automated、LLM judge、
hybrid grader 和多 session。上游仓库为 <https://github.com/pinchbench/skill>。

## 准备环境

```bash
scripts/prepare-pinchbench.sh "$PWD/.benchmarks/pinchbench"
export PINCHBENCH_ROOT="$PWD/.benchmarks/pinchbench"

export MODEL_API_BASE_URL=https://api.example.com/v1
export MODEL_API_KEY=replace-with-your-api-key
export ROLLER_RUN_ROOT="$PWD/runs/pinchbench"
mkdir -p "$ROLLER_RUN_ROOT"
```

`prepare-pinchbench.sh` 会在目录不存在时获取固定 commit 的上游数据，并拉取固定的
`linux/amd64` OpenClaw 镜像。目录已存在时，脚本仅校验 commit，不改动数据。脚本会打印实际
commit，便于将数据版本记入实验记录。脚本不读取或写入 key。如需手工准备，请 clone
<https://github.com/pinchbench/skill>，再拉取
`ghcr.io/openclaw/openclaw:2026.7.1-2`。

OpenClaw 还需要一份模型配置。将以下内容保存为 `example.models.json`，再将 API 地址、
key 和模型 ID 替换为模型服务商提供的值：

```json
{
  "mode": "merge",
  "providers": {
    "example": {
      "baseUrl": "${MODEL_API_BASE_URL}",
      "apiKey": "${MODEL_API_KEY}",
      "api": "openai-completions",
      "timeoutSeconds": 600,
      "models": [{"id": "example-model", "name": "Example model"}]
    }
  }
}
```

先运行两道自动评分题。这一步不需要 judge：

```bash
roller collect --bench pinchbench --bench-root "$PINCHBENCH_ROOT" \
  --bench-variant automated-only \
  --bench-task-id task_sanity --bench-task-id task_files \
  --model example/example-model --model-config example.models.json \
  --parallel 1 --grader-parallel 1 \
  --output "$ROLLER_RUN_ROOT" --run-name smoke
```

命令完成后，结果写入 `smoke/tasks.jsonl` 和
`smoke/bench-report.json`。

`all` 和 `core` 包含 LLM/hybrid 评分任务。如需与 PinchBench 官方设置比较，请使用默认 judge
`anthropic/claude-haiku-4.5`。Roller 默认请求
`https://openrouter.ai/api/v1`，因此只需设置 OpenRouter key：

```bash
export OPENROUTER_API_KEY=...

roller collect --bench pinchbench --bench-root "$PINCHBENCH_ROOT" \
  --bench-variant core --bench-timeout-multiplier 2 \
  --model example/example-model --model-config example.models.json \
  --samples 1 --parallel 1 --grader-parallel 1 \
  --output "$ROLLER_RUN_ROOT" --run-name core
```

同一次运行也可以写成 YAML 文件，并通过 `roller bench run` 启动，见
[Benchmark 运行配置](/roller/benches/benchmark-standard/)：

```bash
roller bench run --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/pinchbench.yaml
```

## Variant

| Variant | 内容 |
| --- | --- |
| `all` | manifest 中的全部任务，也是默认值 |
| `automated-only` | 仅运行使用自动 grader 的任务，适合先检查环境 |
| `core` | manifest 声明的 core 子集 |

## 执行和评分

Roller 先为 `workspace_files` 生成内容寻址快照，再复制到每个 sample 的可写工作区。Roller 不会修改
上游 checkout。`sessions[].new_session: true` 会在同一容器中新建 OpenClaw session，
文件系统保持不变；评分时会合并这些 session 的 transcript。图片分类题的私有答案在 Agent
结束后才放入容器。

默认 judge 请求与当前上游 PinchBench 一致：模型为
`anthropic/claude-haiku-4.5`，`temperature=0`，
`max_completion_tokens=2048`，非流式，超时 300 秒，仅请求一次。grader 外层另有
3600 秒墙钟限制，用于终止无响应的 grader 进程，不改变 judge 请求。

如需使用自定义 OpenAI-compatible judge，请设置 `PINCHBENCH_JUDGE_BASE_URL`、
`PINCHBENCH_JUDGE_API_KEY` 和 `PINCHBENCH_JUDGE_MODEL`。仅在服务要求时设置
`PINCHBENCH_JUDGE_MAX_TOKENS_FIELD=max_tokens` 或
`PINCHBENCH_JUDGE_STREAM=true`。judge 模型发生变化后，分数不能与官方结果直接比较。

推理模型可能在输出 JSON 前耗尽默认的 2048 tokens。可用
`PINCHBENCH_JUDGE_MAX_TOKENS=8192` 提高上限。`PINCHBENCH_JUDGE_RETRIES` 大于 0
时，Roller 会重试网络错误和没有可解析分数的成功响应。流式响应的 `content` 为空时，
grader 也会尝试读取 `reasoning_content`。

Roller 会保留 frontmatter 中的 `prerequisites`。对于四个 FWS/GWS/GitHub integration 任务，Roller 在
临时任务容器中安装固定版本的 `fws`、`gws` 和 `gh`，然后启动上游 FWS mock service。
这些下载使用 shell 中的 HTTP(S) 代理设置。

## 上游参数对应

| PinchBench | Roller |
| --- | --- |
| `--model`、`--base-url`、`--thinking` | `collect --model`、模型配置/`--api-base`、`--thinking` |
| `--judge` | 默认使用官方 judge；也可通过 judge model、base URL 和 key 环境变量覆盖 |
| `--suite all/automated-only`、task ID、core/category | `collect --bench-variant`、`--bench-task-id`、`--bench-category` |
| `--runs N` | `collect --samples N` |
| `--timeout-multiplier N` | `collect --bench-timeout-multiplier N` |
| parallel judge 开关 | `collect --grader-parallel N`；设为 1 时串行评分 |
| `--no-fail-fast` | Roller 默认记录失败并继续运行 |
| upload/register/trend/judge cache | Roller 未实现这些 leaderboard 和后处理功能 |

Roller 仅将报告写入本地，不上传至 PinchBench leaderboard。依赖搜索、邮件、日历、第三方
integration 或 skill registry 的任务仍需要相应的网络和凭据。四个上游 FWS mock 任务由
Roller 自动准备。
