---
title: "Benchmark 运行配置"
---

# Benchmark 运行配置

`roller collect --bench` 通过命令行参数接收一次 benchmark 运行的全部设置。`roller bench run`
从分层的 YAML 或 JSON 文件读取相同的设置，并启动同一个 `collect --bench` 运行，因此一次运行
可以作为文件审阅、纳入版本管理并重复执行。

```bash
roller bench run \
  --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/wildclawbench.yaml \
  --dry-run
```

核对计划后，删除 `--dry-run` 即可开始运行。运行目录、`tasks.jsonl`、`score.json` 和
`bench-report.json` 与 `collect --bench` 的产物相同，`info.json` 另在 `bench_run_config` 中
记录配置来源。

`roller init` 会将示例配置复制到工作目录的 `examples/benchmarks/`。在源码仓库中，
`scripts/run-benchmark.sh` 负责定位 `roller` 可执行文件，并将参数传给 `roller bench run`。

## 配置分层

`--config` 接受 YAML 或 JSON 文件。`--extra-config` 接受文件或内联 JSON 对象，可重复指定，
后面的层覆盖前面的层。对象递归合并，列表和标量整体替换。将某个可选对象设为 `null` 即丢弃
该对象，例如切换 Harness 时清空上一层的 `harness.extra`。

示例将模型连接和执行设置放在 `base.yaml`，每个 benchmark 的任务选择、评分环境和 Harness
各放在一个文件中：

```yaml
schema_version: roller.bench-run/v1

benchmark:
  id: wildclawbench
  root: ${WILDCLAWBENCH_ROOT}
  variant: null
  categories: []
  task_ids: []
  timeout_multiplier: 1
  extra: {}
  environment:
    JUDGE_MODEL: ${ROLLER_JUDGE_MODEL}

model:
  id: ${ROLLER_MODEL_ID}
  provider: roller              # OpenClaw 命名空间，其他 Harness 忽略
  base_url: ${ROLLER_MODEL_BASE_URL}
  api_key_env: ROLLER_MODEL_API_KEY
  api_protocol: openai-completions  # 可选；省略时由 Harness 推断
  thinking: high

harness:
  id: openclaw
  image: wildclawbench-ubuntu:v1.3
  extra:
    max_tokens: 32768

execution:
  output: ${ROLLER_BENCH_OUTPUT}
  run_name: wildclawbench
  parallel: 4
  grader_parallel: 2
  samples: 1
  retries: 0
  timeout: 600
  wire_trace: actf
  keep_thinking: true
  pass_env: []
```

环境变量引用必须占据整个字段值，例如 `${ROLLER_MODEL_BASE_URL}`。`https://${HOST}/v1` 这类
写法以及引用未设置的变量都会报错。`model.api_key_env` 填写保存模型密钥的宿主机变量名，
密钥本身不写入文件。`model.base_url` 不得包含 userinfo、query 或 fragment，因为该地址会
作为参数传给 Harness。

Roller 在启动容器前检查合并后的配置，未知字段会报错。
[`schemas/bench-run.schema.json`](https://github.com/Valen-Team/Roller/blob/main/schemas/bench-run.schema.json) 描述单个配置层，
供编辑器和 CI 使用，因此单层可以省略由其他层提供的字段。

## 字段

| 字段 | `collect` 参数 | 用途 |
| --- | --- | --- |
| `benchmark.id` | `--bench` | `roller bench list` 列出的 adapter |
| `benchmark.root` | `--bench-root` | 已准备好的上游 checkout 或数据目录 |
| `benchmark.variant` | `--bench-variant` | 评测条件，例如 SkillsBench 的 `with-skill` |
| `benchmark.categories` / `task_ids` | `--bench-category` / `--bench-task-id` | 筛选项，空列表表示全选 |
| `benchmark.timeout_multiplier` | `--bench-timeout-multiplier` | 按倍数缩放每个任务的超时 |
| `benchmark.environment` | 无 | 仅在本次进程中设置、结束后恢复的环境变量，用于 judge 和 benchmark 工具 |
| `benchmark.extra` | 见下文 | 所选 benchmark 的专属参数 |
| `model.id` | `--model` | 被测模型 |
| `model.label` | `--model-label` | 用于 sample 目录和容器名称的本地标签 |
| `model.provider` | 无 | OpenClaw 的 provider 命名空间，默认为 `roller`；其他 Harness 原样使用 `model.id` |
| `model.base_url` | `--api-base` | 模型 API 地址 |
| `model.api_key_env` | `--api-key-env` | 保存模型密钥的宿主机环境变量名 |
| `model.api_protocol` | 无 | API 协议；写入生成的 OpenClaw provider，其他 Harness 则检查它是否与自身协议一致 |
| `model.params` | 无 | 生成的 OpenClaw 模型条目的附加字段 |
| `model.thinking` | `--thinking` | thinking 档位，由各 Harness 校验并映射 |
| `harness.id` / `image` | `--harness` / `--docker-image` | Harness 和容器镜像 |
| `harness.extra` | 见下文 | 所选 Harness 的专属参数 |

对于 OpenClaw，Roller 根据 `model.id`、`base_url`、`api_key_env`、`api_protocol` 和 `params`
生成临时 models 文件，命令结束后删除。未设置 `model.provider` 时，`provider/model` 形式的 ID
在第一个斜杠处拆分。如需提供完整的 models 文件，请设置 `harness.extra.model_config`，并在
该层将继承的 `model.base_url`、`model.api_key_env` 和 `model.api_protocol` 设为 `null`；两种
方式不能同时使用。

Codex 使用 `openai-responses`，Claude Code 使用 `anthropic-messages`，Hermes、OpenCode、
DeepSeek 和 Pi 使用 `openai-completions`。`api_protocol` 与 Harness 不一致时，Roller 报错。

`benchmark.environment` 将共用变量映射为 benchmark 所需的名称：

```yaml
benchmark:
  environment:
    PINCHBENCH_JUDGE_BASE_URL: ${ROLLER_JUDGE_BASE_URL}
    PINCHBENCH_JUDGE_API_KEY: ${ROLLER_JUDGE_API_KEY}
    PINCHBENCH_JUDGE_MODEL: ${ROLLER_JUDGE_MODEL}
```

这些值不会出现在命令行中。dry-run 输出和 `info.json` 记录生效的设置、配置文件路径、脱敏后
配置的摘要以及环境变量名称，不包含密钥值。

`benchmark.extra` 目前只有一个字段，即 QwenClawBench 的 `runs_per_task`
（`--bench-runs-per-task`）。它复制每个选中的任务，并在 bench metadata 中保留上游运行序号。
`execution.samples` 是普通的重复采样；同时设置两者时，轨迹数量为二者的乘积。

### 执行设置

| 字段 | `collect` 参数 |
| --- | --- |
| `output`、`run_name` | `--output`、`--run-name` |
| `parallel`、`launch_interval`、`grader_parallel`、`grader_retries` | `--parallel`、`--launch-interval`、`--grader-parallel`、`--grader-retries` |
| `samples`、`retries`、`retry_backoff`、`timeout` | `--samples`、`--retries`、`--retry-backoff`、`--timeout` |
| `max_consecutive_errors` | `--max-consecutive-errors` |
| `start_index`、`limit`、`resume`、`resume_verify_outputs`、`resume_unscored` | `--start-index`、`--limit`、`--resume`、`--resume-verify-outputs`、`--resume-unscored` |
| `wire_trace`、`keep_thinking` | `--wire-trace`、`--keep-thinking` / `--no-keep-thinking` |
| `capture_calls`、`capture_debug`、`token_ids` | `--capture-calls`、`--capture-debug`、`--token-ids` |
| `sandbox_provider`、`sandbox_template` | `--sandbox-provider`、`--sandbox-template` |
| `thinking_capabilities` | `--thinking-capabilities` |
| `pass_env` | `--pass-env`，每个变量名一次 |
| `container_user`、`network`、`docker_binary` | `--container-user`、`--network`、`--docker-binary` |
| `keep_container_on_error`、`rebuild_task_images` | `--keep-container-on-error`、`--rebuild-task-images` |
| `max_input_file_bytes`、`max_task_input_bytes` | `--max-input-file-bytes`、`--max-task-input-bytes` |

### Harness 专属参数

`harness.extra` 使用不带 Harness 前缀的字段名：

| Harness | `extra` 字段 |
| --- | --- |
| OpenClaw | `model_config`、`gateway_port`、`gateway_port_step`、`gateway_startup_timeout`、`model_request_timeout`、`max_tokens`、`session_id`、`search_provider`、`collect_paths`、`set_image_model`、`cache_trace`、`config_set` |
| Codex | `config`、`config_set`、`reasoning_summary`、`web_search`、`websockets`、`image_detail` |
| Claude Code | `settings`、`max_turns`、`max_thinking_tokens`、`permission_mode`、`capture_calls`、`unique_tool_ids` |
| Hermes | `max_iterations`、`context_length`、`vision`、`toolsets` |
| OpenCode | `max_steps`、`context_length`、`output_tokens`、`vision`、`native_tools`、`deny_tools` |
| DeepSeek | `max_steps`、`context_length`、`output_tokens`、`profile`、`permission_mode`、`input_modalities` |
| Pi | `max_steps`、`context_length`、`output_tokens`、`input_modalities` |

`config_set` 是 `KEY=VALUE` 字符串列表，每项对应一次 `--openclaw-config-set` 或
`--codex-config-set`。`model_request_timeout` 要求 OpenClaw 版本的 provider schema 支持
`timeoutSeconds`；`wildclawbench-ubuntu:v1.3` 不支持，因此 WildClawBench 示例未设置该字段。

某一层更换 benchmark 示例选定的 Harness 时，应同时覆盖镜像并清空专属参数：

```yaml
harness:
  id: codex
  image: wildclawbench-codex-ubuntu:v0.0
  extra: null
```

### 没有对应字段的参数

一份配置描述一个 benchmark 在一个 Harness 上的运行。`--tasks`、`--prompt-key`、`--id-key` 和
`--workspace` 属于 task 文件运行。各 Harness 的 `--<harness>-image`、`--<harness>-api-base` 和
`--<harness>-api-key-env` 用于混合 Harness 的 task 文件；此处由 `harness.image`、
`model.base_url` 和 `model.api_key_env` 设置相同的值。运行 benchmark 时 `--task-timeouts`
始终启用，`--log-level` 使用默认值。

## 准备、运行、汇总

提供示例配置的 benchmark 均有 `scripts/prepare-<id>.sh [ROOT]`，
`scripts/prepare-benchmark.sh` 按 ID 分发到对应脚本：

```bash
scripts/prepare-benchmark.sh wildclawbench "$WILDCLAWBENCH_ROOT"
scripts/prepare-benchmark.sh pinchbench "$PINCHBENCH_ROOT"
scripts/prepare-benchmark.sh qwenclawbench "$QWENCLAWBENCH_ROOT"
scripts/prepare-benchmark.sh skillsbench "$SKILLSBENCH_ROOT"
```

准备脚本获取固定 revision 的上游数据和 Harness 镜像。已有 checkout 位于其他 revision 时，
脚本报错并保持该 checkout 不变。脚本不读写模型或 judge 的密钥。

```bash
export ROLLER_MODEL_ID=example-model
export ROLLER_MODEL_BASE_URL=https://api.example.com/v1
export ROLLER_MODEL_API_KEY=replace-with-your-api-key
export ROLLER_BENCH_OUTPUT="$PWD/runs"

roller bench run \
  --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/wildclawbench.yaml \
  --dry-run

roller bench run \
  --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/wildclawbench.yaml
```

`--dry-run` 加载 adapter、筛选任务，并校验 endpoint、密钥变量、thinking 档位和 Harness 专属
参数。它输出生效的配置、任务数和轨迹数、镜像以及各任务的超时，不启动容器，也不创建运行目录。

运行结束时写入 `bench-report.json`。审查或修复 sample 后可重新生成：

```bash
roller bench report runs/<run-name> --output runs/<run-name>/bench-report.json
```

## 示例配置

| Benchmark | `base.yaml` 之后的层 | 准备脚本 |
| --- | --- | --- |
| [WildClawBench](/roller/benches/wildclawbench/) | `examples/benchmarks/wildclawbench.yaml` | `scripts/prepare-wildclawbench.sh` |
| [PinchBench](/roller/benches/pinchbench/) | `examples/benchmarks/pinchbench.yaml` | `scripts/prepare-pinchbench.sh` |
| [QwenClawBench](/roller/benches/qwenclawbench/) | `examples/benchmarks/qwenclawbench.yaml` | `scripts/prepare-qwenclawbench.sh` |
| [SkillsBench](/roller/benches/skillsbench/)（with skill） | `examples/benchmarks/skillsbench.yaml` | `scripts/prepare-skillsbench.sh` |
| SkillsBench（no skill） | `skillsbench.yaml`，再加 `examples/benchmarks/skillsbench-no-skill.yaml` | 同上 |

各 bench 指南列出须与上游保持一致的配置，以及评分程序读取的环境变量。为其他 bench 添加示例
时，文件按 adapter ID 命名为 `examples/benchmarks/<id>.yaml`，同时提供
`scripts/prepare-<id>.sh`，且只包含可公开的默认值和环境变量引用。adapter 本身的接入见
[加一个新 bench](/roller/benches/bench-format/#6-加一个新-bench)。
