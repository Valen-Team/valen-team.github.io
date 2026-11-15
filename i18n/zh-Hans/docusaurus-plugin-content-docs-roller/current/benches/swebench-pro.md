---
title: "SWE-Bench Pro"
---

# SWE-Bench Pro

Roller 运行 SWE-Bench Pro 公开 test split 中 11 个仓库的 731 个任务，并复用官方实例镜像、
`run_script.sh`、`parser.py`、fail-to-pass 与 pass-to-pass 测试集合以及 resolved 判定。
上游仓库为 <https://github.com/scaleapi/SWE-bench_Pro-os>。

## 准备环境

```bash
git clone https://github.com/scaleapi/SWE-bench_Pro-os.git "$PWD/.benchmarks/swebench-pro"
export SWEBENCH_PRO_ROOT="$PWD/.benchmarks/swebench-pro"

export MODEL_API_BASE_URL=https://api.example.com/v1
export MODEL_API_KEY=replace-with-your-api-key
export ROLLER_RUN_ROOT="$PWD/runs/swebench-pro"
mkdir -p "$ROLLER_RUN_ROOT"
```

bench 根目录需要包含上游的 `run_scripts/` 目录，以及
[`ScaleAI/SWE-bench_Pro`](https://huggingface.co/datasets/ScaleAI/SWE-bench_Pro) 数据集的
test split，文件名为 `test.jsonl`、`data.jsonl`、`test.parquet` 或 `data/test.parquet`。
Roller 按此顺序读取第一个存在的文件。读取 Parquet 需要安装可选依赖：

```bash
pip install 'roller-agent[swebench-pro]'
```

实例镜像以 `jefzda/sweap-images:<dockerhub_tag>` 发布，架构为 `linux/amd64`。Harness 镜像的
架构须与实例镜像一致；两者不一致时，Roller 在构建前报错退出。OpenClaw 请使用官方
`linux/amd64` 镜像，该镜像在 `/usr/local/bin/node` 提供 Node，在 `/app` 提供 OpenClaw。

开始较大规模的运行前，先运行一个实例：

```bash
roller collect --bench swebench-pro --bench-root "$SWEBENCH_PRO_ROOT" \
  --bench-task-id instance_flipt-io__flipt-a0cbc0cb65ae601270bdbe3f5313e2dfd49c80e4 \
  --model example/example-model --model-config example.models.json \
  --parallel 1 --grader-parallel 1 \
  --output "$ROLLER_RUN_ROOT" --run-name smoke
```

该命令会生成 `smoke/tasks.jsonl` 和 `smoke/bench-report.json`。`--bench-category` 使用仓库名，
例如 `flipt-io/flipt`。模型配置的格式与 [PinchBench 指南](/roller/benches/pinchbench/#准备环境)相同。

某个实例首次运行时，Roller 会拉取其镜像并构建派生镜像，需要较多的网络流量和磁盘空间；
之后的运行复用本地镜像。完整运行会为每个实例拉取一个镜像，请关注 Docker 的磁盘占用。

## 运行脚本

`scripts/run-swebench-pro.sh` 会导出任务、采集轨迹并生成
`<OUTPUT_ROOT>/<RUN_NAME>/report.json`：

```bash
SWEBENCH_PRO_ROOT="$PWD/.benchmarks/swebench-pro" \
MODEL=example/example-model \
MODEL_CONFIG=example.models.json \
TASK_IDS=instance_flipt-io__flipt-a0cbc0cb65ae601270bdbe3f5313e2dfd49c80e4 \
./scripts/run-swebench-pro.sh
```

`HARNESS` 默认为 `openclaw`。`TASK_IDS` 和 `CATEGORIES` 接受逗号分隔的列表。`PARALLEL`、
`RETRIES`、`OUTPUT_ROOT` 和 `RUN_NAME` 可覆盖默认值。使用其他 Harness 时，请设置 `HARNESS`、
`API_BASE` 和 `API_KEY_ENV`，其中 `API_KEY_ENV` 是保存模型 API Key 的变量名。`MAX_STEPS`
会映射到 Claude Code、Hermes、OpenCode、DeepSeek 和 Pi 对应的步数参数。脚本后的参数会追加到
`roller collect`，例如 `--resume`。

## Harness 与镜像

导出的 task 默认写入 `harness: openclaw`，可用 `--harness` 覆盖。Roller 支持 OpenClaw、Codex、
Claude Code、Hermes、OpenCode、DeepSeek 和 Pi。

Roller 为每个实例将实例镜像与所选 Harness 镜像组合：

| Harness | 派生镜像 |
| --- | --- |
| OpenClaw | 在实例镜像中加入 OpenClaw 运行时。Node 安装在 `/opt/roller-node/bin/node`，项目自身的 Node 保持不变 |
| 其他 Harness | 在 Harness 镜像中加入从实例镜像复制的 `/app` 仓库。系统依赖来自 Harness 镜像，可能与实例镜像不同 |

派生镜像的 tag 为 `roller-swebench-pro-<harness>:<digest>`，按实例镜像、Harness 镜像和 Harness
名称缓存。由于任务初始化需要改写 `/app` 下的仓库，任务容器始终以 root 运行，不受
`--container-user` 影响。

## 执行和评分

Agent 在 `/app` 中工作。Agent 启动前，Roller 将仓库重置到 `base_commit`，删除上游的 `.git`
历史，并将 tracked 文件提交到一个新仓库。因此 Git 中不存在 gold commit，导出的 task 也不包含
gold patch。

最后一轮结束后，Roller 将 Agent 的 tracked、untracked 和已提交的改动提取为 `model.patch`，
并从实例镜像启动一个新容器。只有该容器会收到模型补丁、隐藏的 `test.patch` 以及官方 runner
和 parser。grader 在基线上应用模型补丁，恢复测试文件的隐藏版本，然后运行官方脚本。评分结束后，
评分容器会被删除。

fail-to-pass 和 pass-to-pass 的全部测试都在 parser 的 `PASSED` 集合中时，任务为 resolved。
resolved 任务的 `overall_score` 为 1，否则为 0。

二进制文件的改动不进入评分补丁。Roller 会将其路径写入 `score.json` 的
`scores.dropped_binary_files` 并输出一条 warning，便于识别依赖二进制改动的分数。

每个 sample 的 `results/` 目录包含 `model.patch`、`test_stdout.log`、`test_stderr.log` 和
`test_output.json`。分数位于 `score.json`。

## 评分选项

以下三个环境变量会改变任务初始化和评分，默认全部关闭。Roller 在转换任务时读取这些变量，即在
`collect --bench` 或 `bench export` 期间，并将取值记录在
`bench.metadata.evaluation_protocol` 和 `bench.metadata.go_proxy` 中。

| 变量 | 作用 |
| --- | --- |
| `SWEBENCH_PRO_REPAIR_TEST_FIXTURES=1` | 补齐上游 `test.patch` 遗漏的文本测试数据。Roller 从 gold patch 的测试数据目录中提取这些文件，且只在评分容器中应用 |
| `SWEBENCH_PRO_EXCLUDE_AGENT_TESTS=1` | 评分补丁不包含 Agent 对 Go、Python 和 JavaScript 测试源码的改动，以免与隐藏测试冲突。`model.patch` 保留全部改动，评分补丁另存为 `graded.patch` |
| `SWEBENCH_PRO_GO_PROXY=<url>` | 在任务容器和评分容器中设置 `GOPROXY`，例如 `https://goproxy.cn,direct`。测试报告缺少 `go.sum` 条目时，grader 会下载依赖，并在同一时间预算内重新运行一次测试。首次运行的日志和依赖改动保存在 `results/` 中 |

布尔变量接受 `1`、`true`、`yes`、`on`、`0`、`false`、`no` 和 `off`。`SWEBENCH_PRO_CACHE_DIR`
用于设置测试补丁的提取目录，默认为 `~/.cache/roller/benches/swebench-pro`。

启用这些选项后，分数与上游协议不同。报告分数时请注明所用选项。

## 上游参数对应

| SWE-Bench Pro | Roller |
| --- | --- |
| 数据集和 `run_scripts/` | `--bench-root` |
| 实例选择 | `--bench-task-id`、`--bench-category` |
| Docker 或 Modal 后端 | 仅本地 Docker |
| `--block_network` | 不提供。容器网络保持开启，用于访问模型 API |
| worker 数量 | `--parallel`、`--grader-parallel` |

任务超时为 3600 秒，评分另有 3600 秒的上限。`collect --bench` 会自动使用任务超时；从导出的
task 文件采集时，须添加 `--task-timeouts`。
