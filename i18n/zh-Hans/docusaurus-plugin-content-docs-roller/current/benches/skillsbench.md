---
title: "SkillsBench"
---

# SkillsBench

Roller 支持运行 SkillsBench 的 `with-skill` 和 `no-skill` 两组实验。上游数据位于
<https://github.com/benchflow-ai/skillsbench>。

v1.1 共 87 题，每题均由仓库内的 `verifier/test.sh` 评分，不调用 LLM judge。上游
README 中的 GPT-5.5 指被测 Agent。仅当 `collect --model` 指向 GPT-5.5 服务时，结果才能与
该条目比较；使用其他模型时，verifier 虽然相同，模型分数并不等价。

## 准备并运行

```bash
# 下载并校验 SkillsBench v1.1，然后构建 Roller OpenCode 基础镜像。
scripts/prepare-skillsbench.sh "$PWD/.benchmarks/skillsbench-v1.1"
export SKILLSBENCH_ROOT="$PWD/.benchmarks/skillsbench-v1.1"

export MODEL_API_BASE_URL=https://api.example.com/v1
export MODEL_API_KEY=replace-with-your-api-key
export ROLLER_RUN_ROOT="$PWD/runs/skillsbench"
mkdir -p "$ROLLER_RUN_ROOT"

roller collect --bench skillsbench --bench-root "$SKILLSBENCH_ROOT" \
  --bench-variant with-skill --model example-model \
  --opencode-api-base "$MODEL_API_BASE_URL" \
  --opencode-api-key-env MODEL_API_KEY --parallel 1 --grader-parallel 1 \
  --output "$ROLLER_RUN_ROOT" --run-name with-skill

roller collect --bench skillsbench --bench-root "$SKILLSBENCH_ROOT" \
  --bench-variant no-skill --model example-model \
  --opencode-api-base "$MODEL_API_BASE_URL" \
  --opencode-api-key-env MODEL_API_KEY --parallel 1 --grader-parallel 1 \
  --output "$ROLLER_RUN_ROOT" --run-name no-skill
```

`prepare-skillsbench.sh` 接受任意持久化目录。目录不存在时，脚本下载 v1.1；目录已存在时，
脚本仅校验 commit，不改动数据。脚本还会构建 `roller-opencode:1.18.30`，且不会读取或写入
API key。如需手工准备，请检出 SkillsBench 的 `v1.1` tag，再构建
`docker/opencode`。

运行前，请将示例 API 地址、key 和模型 ID 替换为模型服务商提供的值。

两条 `collect` 命令会在各自的 run 目录写入 `tasks.jsonl` 和 `bench-report.json`。
SkillsBench 默认每题运行 3 次，每个 OpenCode turn 最多 100 步，单次模型响应最多
32768 tokens。可用 `--samples`、`--opencode-max-steps` 和
`--opencode-output-tokens` 修改这些值。

正式对比请固定在 `v1.1` tag，对应 commit
`b63b7b2850226b6aa4fb5929a8c1ac7bc4d9a6af`。建议先添加
`--bench-task-id 3d-scan-calc` 运行一题，确认模型、镜像和输出目录均正常。
`--bench-category` 与 `--bench-task-id` 可以重复传入。对于较慢的模型，可用
`--bench-timeout-multiplier 2` 同时延长 Agent 和 verifier 的时间上限。

这两次运行也可以写成 YAML 文件，并通过 `roller bench run` 启动，见
[Benchmark 运行配置](/roller/benches/benchmark-standard/)。第二层配置选择 no-skill 运行：

```bash
roller bench run --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/skillsbench.yaml

roller bench run --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/skillsbench.yaml \
  --extra-config examples/benchmarks/skillsbench-no-skill.yaml
```

## Roller 如何执行任务

Roller 先读取 `integrations/agentbeats/task_sets/skillsbench-v1.1.json` 中的任务顺序。
该文件不存在时，才扫描 `tasks/`。

每个任务都有自己的 `environment/Dockerfile`。Roller 先构建该环境，再叠加固定版本的
OpenCode harness。镜像 tag 包含环境内容摘要，因此相同环境可以复用；
`--rebuild-task-images` 会强制重建。Agent 的工作目录为 Dockerfile 中最后一个
`WORKDIR`。

基础环境中的 skill 副本会在构建时移除。运行 `with-skill` 时，Roller 注入
`environment/skills/`；运行 `no-skill` 时，Roller 清理各 harness 支持的 skill 目录。
两组实验使用同一个任务环境，仅在 skill 是否可用上存在差异。

Agent 退出后，Roller 才将 `verifier/` 复制到容器中，执行 `/verifier/test.sh`，再读取
`/logs/verifier/reward.txt`。Agent 在作答期间无法查看 verifier 文件。Agent timeout、
Agent error、verifier error 和基础设施错误均记录在报告中，但不计入 pass rate 和 mean reward。

## 网络、缓存和已知限制

首次运行某题时，可能需要下载大量依赖。Docker build、任务容器和 verifier 会继承当前
shell 的 `HTTP_PROXY`、`HTTPS_PROXY` 和 `NO_PROXY`，这些值不会写入导出的 task
JSONL。不经过代理的模型地址应加入 `NO_PROXY`。Verifier 会重试测试开始前出现的临时下载或 DNS
错误；重试后仍失败的样本标为不可计分。正式输出应写入持久化共享存储。

当前 adapter 只读取上游默认的 `tasks/`，不会自动加入 `tasks-extra/`。任务声明的
taxonomy、CPU、内存、存储、GPU、网络和 OS 会保存在 bench metadata 中，但 Roller 不会将
这些值自动转换为 Docker resource limit。如需严格控制资源，请在运行环境外层统一设置。
少量任务包含 compose 文件；这些任务的 verifier 可以在主容器内启动所需服务，因此 Roller 仍按
主 Dockerfile 构建。
