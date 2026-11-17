---
title: "CLI 参数参考"
---

# CLI 参数参考

本页用于查询 Roller 命令行参数。首次使用 Roller 时，建议先完成[快速上手](/roller/start/getting-started/)。如需调整 task、并行数、输出目录或 Harness 行为，再回到本页查找对应参数。

首次查阅时，可先了解以下四点：

- `--tasks` 指定要运行的任务。
- `--model` 和 `--harness` 指定使用哪个模型和 Agent 运行环境。
- `--output` 和 `--run-name` 决定结果的保存位置。
- `--dry-run` 可在不启动容器的情况下检查配置。

当前使用的 Roller 版本支持的参数，始终以以下命令的输出为准：

```bash
roller --help
roller collect --help
roller view --help
```

## 1. 命令结构

先根据要完成的工作选择命令，再为该命令添加参数。

| 命令 | 用途 |
| --- | --- |
| `roller collect [OPTIONS]` | 读取 task，运行 Harness 并采集轨迹 |
| `roller init [DIRECTORY]` | 将示例 task、配置模板和 benchmark 运行配置写入 `DIRECTORY/examples`（默认当前目录），已存在的文件保持不变 |
| `roller view RUN_DIR` | 在 Viewer 中浏览已有 run |
| `roller export RUN_DIR` | 把已有 run 导出为 Harbor 读取的轨迹格式 ATIF，或导出为 Hugging Face 数据集目录，参数见第 9 节 |
| `roller bench ...` | 列出、运行、导出或汇总 benchmark，采集参数见第 8 节 |
| `roller --version` | 查看当前安装的 Roller 版本 |

最小的 collect 命令需要 task 清单。模型可通过 `--model` 指定，也可写在每条 task 的 `model` 字段中：

```bash
roller collect --tasks tasks.jsonl --model provider/model
```

## 2. 配置优先级

同一个设置可能同时出现在 task 和命令行中。Roller 按下表决定最终使用哪个值。

| 配置 | 最终取值 |
| --- | --- |
| 模型 | 命令行存在 `--model` 时使用命令行模型，否则使用每条 task 的 `model` |
| Thinking | task `runtime.thinking` 优先，其次是 `--thinking`，都省略时使用 Harness 或模型默认值 |
| Workspace | task `workspace` 优先，否则使用全局 `--workspace` |
| User Simulator 模型 | `user_simulator.model` 优先，否则跟随当前 task Agent 的模型 |

重复的 `--model` 会自动去重。指定多个模型时，每条选中的 task 都会分别使用这些模型运行。`--start-index` 和 `--limit` 会先筛选 task，再展开模型组合。

## 3. 通用采集参数

这些参数决定运行哪些 task、运行多少次，以及结果的保存位置。这些参数适用于所有 Harness。

### 3.1 输入与运行对象

这组参数指定 Roller 读取 task 的位置，以及执行 task 的模型和 Harness。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--tasks PATH` | 必填 | 指定 JSON 或 JSONL task 清单 |
| `--model MODEL` | task `model` | 指定模型，可重复传入多个模型 |
| `--model-label LABEL` | 实际服务模型 ID | 为 sample 目录和容器设置安全的本地名称，不改变发送给模型服务的 ID，只适用于最终只有一个模型的运行 |
| `--harness NAME` | task `harness` 或 `openclaw` | 选择 `openclaw`、`codex`、`claude-code`、`hermes`、`opencode`、`deepseek` 或 `pi` |

### 3.2 执行规模与任务范围

这组参数控制并行数、重复次数、重试和本次选取的 task 范围。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--parallel N` | `1` | 设置同时运行的最大 rollout 数 |
| `--launch-interval SECONDS` | `0` | 两次 rollout 启动之间的最小间隔，见下文 |
| `--grader-parallel N` | `--parallel` | 单独限制同时运行的 grader 数，避免 judge 服务过载 |
| `--samples N` | SkillsBench 为 `3`，其他为 `1` | 为每个 task/model 组合创建 N 个独立 sample |
| `--retries N` | `0` | 设置首次失败后的额外尝试次数 |
| `--retry-backoff SECONDS` | `0` | sample 首次重试前的等待时间，此后每次重试加倍，见下文 |
| `--timeout SECONDS` | `600` | 设置每条 rollout 的总超时 |
| `--task-timeouts` | 关闭 | 优先使用每条 task 的 `timeout_seconds`，缺失时使用 `--timeout` |
| `--start-index N` | `0` | 从规范化 task 列表的第 N 条开始 |
| `--limit N` | 不限制 | 最多选择 N 条 task |

默认情况下，run 开始时同时启动 `--parallel` 个 rollout。启动阶段的内存占用远高于稳定运行阶段（OpenClaw 容器约为两倍），同时启动的 rollout 会叠加内存峰值。`--launch-interval` 使每次启动（包括重试）与上一次启动至少间隔指定秒数：

```bash
roller collect ... --parallel 24 --launch-interval 8
```

- 该间隔对整个 run 生效，包括第一批之后的启动。N 次启动至少需要 (N − 1) × `--launch-interval` 秒；rollout 时长短于约 `--parallel × --launch-interval` 时，实际并发数低于 `--parallel`。
- `--resume` 跳过的 sample 不占用启动间隔。
- 中断时，仍在等待启动的 rollout 直接取消，不留下 sample 目录；无论间隔为何值，待执行的重试同样取消，sample 保留上次失败的结果，由 `--resume` 重新运行。
- 该值记录在 `info.json`，不写入 `lock.json`，因此 `--resume` 时可更改该值。

使用 `--retries` 时，失败的 sample 默认立即重试。`--retry-backoff` 在重试前加入等待：首次重试等待指定秒数，同一 sample 此后每次重试的等待时间加倍，使被限流或暂时不可用的模型服务有时间恢复：

```bash
roller collect ... --retries 3 --retry-backoff 30
```

- 上例的三次重试分别等待 30、60、120 秒。等待时间不计入 `--timeout`，每次尝试仍有完整的超时时间。
- 等待期间 sample 继续占用所在 worker，等待结束后再排队获取启动间隔。
- 中断时等待立即结束，待执行的重试取消。
- 该值记录在 `info.json`，不写入 `lock.json`，因此 `--resume` 时可更改该值。

### 3.3 输出、检查与续跑

这组参数控制结果目录，并决定是预检查、开始新 run 还是继续原 run。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--output DIR` | `runs` | 设置所有 run 根目录的父目录 |
| `--run-name NAME` | UTC 时间名 | 设置本次 run 的目录名 |
| `--dry-run` | 关闭 | 检查 task、文件和运行计划，不启动 Docker，也不写入任何文件。每条计划中的 rollout 会列出正式运行将记录的 bundle digest |
| `--resume` | 关闭 | 继续同一个 run，并跳过产物完整的成功 sample，详见第 6 节 |
| `--resume-verify-outputs` | 关闭 | 与 `--resume` 一起使用，重新读取每个已记录的输出文件，内容与 SHA-256 不一致的 sample 会重跑。不加时 Resume 只比较路径和大小 |

### 3.4 兼容与调试

这组参数主要用于旧数据格式或排查运行日志。新 task 通常不需要修改前三项。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--workspace DIR` | 无 | 为旧格式 task 指定全局工作区，新 task 使用 `file_root` 和 `files` |
| `--prompt-key NAME` | `prompt` | 指定旧数据中的 prompt 字段名 |
| `--id-key NAME` | `id` | 指定旧数据中的 ID 字段名 |
| `--log-level LEVEL` | `INFO` | 设置 `DEBUG`、`INFO`、`WARNING` 或 `ERROR` 日志级别 |

### 3.5 输入文件限制

这组参数限制 task 可以带入容器的文件大小，主要用于防止误传过大的输入。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--max-input-file-bytes` | 10 GiB | 限制单个 input 或 context 文件的大小 |
| `--max-task-input-bytes` | 50 GiB | 限制单条 task 全部输入文件的总大小 |

## 4. Harness 通用运行参数

这些参数控制 Harness 容器如何启动、如何连接模型服务，以及轨迹中保留哪些信息。具体支持范围仍由所选 Harness 决定。

### 4.1 容器与连接

这组参数用于选择镜像、Docker 运行方式和模型服务连接信息。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--docker-image IMAGE` | 对应 Harness 固定镜像 | 覆盖本次运行使用的 Harness 镜像 |
| `--container-user USER` | `0` | 设置一次性容器用户，`image` 表示沿用镜像默认用户 |
| `--docker-binary PATH` | `docker` | 指定 Docker CLI 的名称或路径 |
| `--network MODE` | `host` | 设置容器网络模式，部分 full wire trace 功能依赖 host network |
| `--api-base URL` | Harness 环境变量 | 为单一 Harness 运行指定 API 地址，OpenClaw 的地址写在 model config 中 |
| `--api-key-env NAME` | Harness 默认变量 | 指定保存模型 API Key 的宿主机环境变量名 |
| `--pass-env NAME` | 无 | 额外向 Harness 容器传入一个非空环境变量，可重复 |
| `--keep-container-on-error` | 关闭 | 失败后保留已停止的容器，便于检查现场 |

### 4.2 Reasoning 与轨迹

`--thinking` 用于设置模型的 reasoning 或 thinking 强度。同一设置也可以写在 task 的 `runtime.thinking` 中。Task 设置优先于命令行，两处都省略时使用 Harness 或模型的默认值。

Roller CLI 识别下列逻辑档位，但每个 Harness 仅支持其中一部分，并可能采用不同的默认值和映射方式。具体范围见对应的 Harness 指南。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--thinking LEVEL` | 未设置 | 设置 Harness 的 reasoning 或 thinking 档位 |
| `--thinking-capabilities PATH` | 未设置 | 加载带版本的模型/端点能力声明，在运行前校验档位 |
| `--keep-thinking` / `--no-keep-thinking` | 开启 | 决定 ACTF 和 SFT 是否导出可见 reasoning |
| `--wire-trace MODE` | `actf` | 选择 `off`、`actf` 或 `full` 请求记录模式 |

```text
off | minimal | low | medium | high | xhigh | adaptive | max | ultra
```

输入 `none` 会先规范化为 `off`。不受支持的值会在启动 rollout 前报错。

七种 Harness 均可通过配置声明 provider/model 能力，无需在
Roller 代码中添加模型名规则：

```json
{
  "schema_version": "roller.thinking-capabilities/v1",
  "profiles": [
    {
      "harness": "hermes",
      "model": "served-model-id",
      "api_base": "https://gateway.example/v1",
      "supported_efforts": ["low", "medium", "high"]
    }
  ]
}
```

使用 `--thinking-capabilities` 传入该文件。Harness 与实际请求的 model ID 必须精确
匹配；`api_base` 可省略，端点专用条目优先于通用条目。命中 profile 后，请求不受支持的
档位会在启动容器和模型请求前失败。未命中的模型仍由 provider 校验，Roller 不会静默替换
档位。文件 SHA-256 会写入 run lock。

profile 支持注册的七种 harness，并检查主 Agent 与 user simulator。未知 harness、JSON 字段
和 model/端点两侧的空白会报错。声明使用 Roller 的逻辑档位，而非协议转换后的字段值
（例如 Claude 的 `ultra` 不写成 `ultracode`）。OpenClaw 的 model 写完整 `provider/model`，
端点从该 provider 的 model-config `baseUrl` 解析。无法解析端点时只匹配不带端点的通用条目；
能力声明不覆盖原生不支持的档位，也不改写请求。

### 4.3 Wire trace 模式

Wire trace 用于决定是否记录模型服务的实际 HTTP 请求，常规采集使用默认的 `actf` 即可。

| 模式 | 产物与用途 |
| --- | --- |
| `off` | 不通过本地反向代理采集 HTTP 请求 |
| `actf` | 将实际 tools schema 写入 ACTF，不保留额外 wire 文件 |
| `full` | 额外保留 `wire_trace.jsonl`，用于审计实际 HTTP 请求 |

`full` 可能保存 prompt、reasoning、工具参数和结果等完整请求文本，因此文件更大，也更敏感。不同 Harness 的支持范围与网络要求见对应 Harness 指南，文件格式见 [轨迹产出文件指南](/roller/traces/trajectory-outputs/#wire-trace-jsonl)。

### 4.4 兼容性提示

`--external-thinking` 已移除。旧命令应改用 `--thinking`，不再需要的参数应直接删除。

## 5. Harness 专属参数索引

当参数只属于某个 Harness 时，请在对应指南中查询。镜像、API、Key、执行上限和原生配置都由各指南单独维护。

| Harness | 参数与配置指南 |
| --- | --- |
| OpenClaw | [OpenClaw Harness 指南](/roller/harnesses/openclaw-configuration/#openclaw-cli-flags) |
| Codex | [Codex Harness 指南](/roller/harnesses/codex-configuration/#codex-cli-flags) |
| Claude Code | [Claude Code Harness 指南](/roller/harnesses/claude-code-configuration/#claude-code-cli-flags) |
| Hermes | [Hermes Harness 指南](/roller/harnesses/hermes-configuration/#hermes-cli-flags) |
| OpenCode | [OpenCode Harness 指南](/roller/harnesses/opencode-configuration/#opencode-cli-flags) |
| DeepSeek | [DeepSeek Harness 指南](/roller/harnesses/deepseek-configuration/#deepseek-cli-flags) |
| Pi Agent | [Pi Agent Harness 指南](/roller/harnesses/pi-configuration/#pi-cli-flags) |

各 Harness 开放的工具及对应的选择参数见 [Harness 工具开放情况](/roller/harnesses/tool-availability/)。

如果端点需要调整请求或响应，`--codex-image-detail` 为 Responses 图片输入设置 `detail`（见 [Codex Harness 指南](/roller/harnesses/codex-configuration/#codex-cli-flags)），`--claude-unique-tool-ids` 替换服务重复签发的工具调用 ID（见 [Claude Code Harness 指南](/roller/harnesses/claude-code-configuration/#claude-code-cli-flags)）。

如需核对当前使用的 Roller 版本支持的完整参数列表，请运行：

```bash
roller collect --help
```

## 6. Resume 参数

`--resume` 用于在中断或部分失败后继续同一个 run，并复用已经完整成功的 sample。

```bash
roller collect [原命令] --resume
```

Resume 会先比较 `lock.json` 中影响运行行为的配置和输入摘要，再检查成功 sample 的必需产物。配置和输入一致且产物完整时，该 sample 会被跳过。产物损坏时会重新运行，配置或输入改变时会拒绝继续。

只有继续原实验时才使用 `--resume`。若改变现有模型的配置、镜像、thinking、wire 或其他影响运行语义的设置，应使用新的 `--run-name`；保留原有请求时可以增加模型和任务。

## 7. Viewer 参数

Viewer 参数用于选择要查看的 run，并设置本地网页的监听地址和端口。

```bash
roller view RUN_DIR [--host HOST] [--port PORT]
```

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `RUN_DIR` | 必填 | 指定包含 `info.json` 和 `samples/` 的 Roller run |
| `--host` | `127.0.0.1` | 设置监听地址 |
| `--port` | `17865` | 设置监听端口；未指定且默认端口被占用时改用空闲端口 |

监听 `0.0.0.0` 会向网络暴露轨迹内容。远程访问时应保留默认地址，并使用 SSH 端口转发。

## 8. Bench 参数

Bench 参数用于将外部 benchmark 转换为 Roller task、运行采集、执行评分并汇总结果。

| 命令 | 用途 |
| --- | --- |
| `roller bench list` | 查看当前可用的 benchmark adapter |
| `roller collect --bench ...` | 转换、运行、评分并汇总 benchmark，推荐大多数用户使用 |
| `roller bench run --config FILE` | 根据分层的 YAML 或 JSON 文件启动同一个 `collect --bench` 运行 |
| `roller bench export ...` | 仅将 benchmark 转换为 task JSONL，不运行 task |
| `roller bench report RUN_DIR` | 为已有 run 重新生成评分汇总 |

常用命令形式如下：

```bash
roller collect --bench NAME --bench-root ROOT [--bench-category CAT]... [--bench-task-id ID]... [--bench-variant NAME] [--bench-timeout-multiplier N] [--bench-runs-per-task N] ...
roller bench run --config FILE [--extra-config FILE_OR_JSON]... [--dry-run]
roller bench export NAME ROOT --output TASKS.jsonl [--category CAT]... [--task-id ID]... [--variant NAME] [--timeout-multiplier N] [--runs-per-task N]
roller bench report RUN_DIR [--output REPORT.json]
```

推荐使用 `collect --bench`。它会在一条命令中完成任务转换、容器执行、评分和聚合，并在 run 目录保存 `tasks.jsonl` 与 `bench-report.json`。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--bench NAME` / `NAME` | 必填 | 指定 `roller bench list` 中的 adapter |
| `--bench-root ROOT` / `ROOT` | 必填 | 指定已检出的 benchmark 目录 |
| `--bench-category CAT` / `--category CAT` | 不限制 | 只选择指定类别，可重复 |
| `--bench-task-id ID` / `--task-id ID` | 不限制 | 只选择指定 task，可重复，错误 ID 会直接报错 |
| `--bench-variant NAME` / `--variant NAME` | adapter 默认值 | 选择 benchmark 条件，例如 SkillsBench 的 `with-skill` 或 `no-skill` |
| `--bench-timeout-multiplier N` / `--timeout-multiplier N` | adapter 默认值 | 按有限正数倍数缩放每条 benchmark task 的超时 |
| `--bench-runs-per-task N` / `--runs-per-task N` | `1` | 将每个选中的 task 复制 N 份，并在 bench metadata 中记录运行序号 |
| `--output` / `-o` | export 时必填 | 设置 export 的 task JSONL 或 report 的报告 JSON |
| `RUN_DIR` | report 时必填 | 指定已完成的 run，属于位置参数 |
| `--rebuild-task-images` | 关闭 | 即使 task-specific benchmark 镜像已经存在也重新构建 |

`collect --bench` 会自动使用每条 benchmark task 的 timeout。采用先 export 再 collect 的手动流程时，须为 collect 添加 `--task-timeouts`。两种流程均可使用 `--pass-env` 传入 grader 所需的环境变量。

`bench run` 从文件而非命令行参数读取设置：

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `--config FILE` | 必填 | 指定 YAML 或 JSON 格式的基础运行配置 |
| `--extra-config FILE_OR_JSON` | 无 | 追加一层配置，可为文件或内联 JSON 对象，可重复，后面的层覆盖前面的层 |
| `--dry-run` | 关闭 | 校验合并后的配置并输出计划，不启动容器 |

各字段及其对应的 `collect` 参数见 [Benchmark 运行配置](/roller/benches/benchmark-standard/)。

字段语义、评分时序、`stage` 防泄漏规则和聚合口径见 [Bench 接入与评分](/roller/benches/bench-format/)。

## 9. Export 参数

Export 参数用于选择要转换的 run、目标格式和结果的写入目录。

```bash
roller export RUN_DIR [--format atif|hf|sft] [--output DIR] [--min-score X] [--no-redact] [--include-runs] [--redact-rules FILE]
```

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `RUN_DIR` | 必填 | 指定包含 `samples/` 的 Roller run |
| `--format` | `atif` | 选择目标格式：`atif` 是 Harbor 读取的 Agent Trajectory Interchange Format，`hf` 是 Hugging Face 数据集目录，`sft` 是带逐行索引的训练数据 |
| `--output` / `-o` | `RUN_DIR/<format>` | 设置写入目录 |
| `--redact` / `--no-redact` | 开启 | 与 `--format hf` 配合，在导出的文件中替换 run 的模型端点、`NO_PROXY` 主机、机器名、主机路径和凭据取值 |
| `--include-runs` | 关闭 | 与 `--format hf` 配合，额外写入 `runs/<harness>-<model>/`，即包含 sample 全部文件的 Roller run 目录 |
| `--redact-rules` | 无 | 与 `--format hf` 配合，指定一个 JSON 文件，追加 `replace`、`exclude` 和 `forbid` 规则；无论 `--redact` 是否开启都会应用 |

该命令不修改 run。`--format atif` 为每个 sample 写入一个 `trajectory.json`，文件布局和字段对应关系见 [ATIF 导出](/roller/traces/trajectory-outputs/#atif-export)。`--format hf` 写入数据集卡片、供 Hub 轨迹查看器展示的 Agent 会话（每个 sample 一个）、以及每个 sample 一行的表格，并按 Harness 和模型分组、命名为 `<harness>-<model>`，同一目录可容纳多个 run，见 [Hugging Face 导出](/roller/traces/trajectory-outputs/#hugging-face-export)。

## 采集恢复与诊断

采集在启动容器前预检任务环境变量、agent API key 和评分器环境变量，`--dry-run` 也执行检查。每个样本完成时输出进度和 ETA；60 秒没有完成样本则输出心跳及运行最久的样本。`<run>/collect.log` 保留 INFO 日志，不受控制台静默等级影响。

| 选项 | 默认 | 行为 |
| --- | --- | --- |
| `--max-consecutive-errors N` | `10` | 连续 N 个 rollout error 后停止派发，等待已运行样本完成；`0` 关闭熔断。超时不计入连续错误数，成功样本重置计数。 |
| `--retry-backoff SECONDS` | `0` | 样本重试等待时间，每次重试翻倍。 |
| `--grader-retries N` | `2` | 在同一容器重试失败评分器，依次等待 5 秒、10 秒；运行超过 600 秒的评分器不再重试。 |
| `--resume --resume-unscored` | 关闭 | 重跑 agent 成功但评分失败的样本，会再次调用 agent。 |

第一次 Ctrl-C 停止派发并等待运行中的样本；第二次 Ctrl-C、SIGTERM 或 SIGHUP 清理当前采集进程的容器并写中断检查点。调用方明确忽略的信号保持忽略。不可捕获的 kill 之后，先用 `roller clean RUN_DIR --dry-run` 检查残留，再执行 `roller clean RUN_DIR`。清理默认保留仍在运行或归属不明的容器；`--force` 可以强制移除。

Resume 允许增加任务和模型，但原有请求必须全部保留且不变。同一主版本、次版本内的补丁升级兼容；执行配置和输入仍受锁约束。有效主数据对应的派生 SFT 文件可原地重建，无需再次调用模型。
