---
title: "Bench 接入与评分"
---

# Bench 接入与评分

Roller 在 task 结束后销毁容器。Bench 层为采集流程增加任务导出和容器内评分：

1. 将已检出的 benchmark 转换为 `roller.task/v1` 任务清单（`roller bench export`）；
2. 在 Agent 最后一轮之后、容器销毁之前，在同一容器内执行该 bench 自带的 grader，并将分数写入 `score.json`。

`roller collect --bench NAME --bench-root ROOT` 通过一条命令完成转换、采集、评分和聚合。
如需检查或修改中间 task JSONL，仍可使用
`bench export` / 普通 `collect` / `bench report` 三步接口。已注册的 adapter 见 `roller bench list`。

## 1. 为什么 grader 必须在容器内运行

Bench 评分几乎总是需要读取 Agent 在任务中写入的文件（生成的脚本、渲染的图、下载的数据），
而 `session.finish()` 会执行 `rm -f <container>`。因此 grader 无法在 `collect` 返回之后运行，
grader 必须在以下时点执行：

```
session.start() → 逐轮 send() → [grader 在这里] → session.finish()（销毁容器）
```

`GradedHarness` 包装 `InteractiveHarness` 并复用其运行循环，在最后一轮和 teardown
之间执行 grader，无需修改被包装的 harness。

只有 `InteractiveHarness` 能在评分时提供仍在运行的容器。使用非交互 harness 运行 bench
会在启动时抛出 `TypeError`，避免完成整批任务后才发现无法评分。

## 2. 三个接缝：为何现有代码几乎无需修改

Bench 层复用以下三个接口：

| 接口 | 行为 | 接入方式 |
| --- | --- | --- |
| `load_tasks()` | 不拒绝未知顶层 key | 任务行可增加 `bench` 块，无需修改 `tasks.py` |
| `_finalize_sample` | 将 `HarnessResult.metadata` 中除三个保留 key 外的全部内容复制到 `info.json["runtime"]` | 评分结果随 metadata 写入文件，无需修改结果 schema |
| `finish()` | 销毁容器，且已做记忆化 | 用 `GradedHarness` 在销毁容器前执行评分，无需修改 harness |

这些机制是加法式扩展：普通 `--tasks` 采集仍保持原语义；bench 模式额外启用逐题 timeout、
容器内评分、任务快照和自动报告。

## 3. `bench` 块（`roller.bench/v1`）

`bench export` 生成的每一行任务，除标准 task 字段外还包含一个 `bench` 块：

```json
{
  "schema_version": "roller.task/v1",
  "id": "03_Social_Interaction_task_2_group_chat_zh",
  "harness": "openclaw",
  "prompt": "……",
  "timeout_seconds": 900,
  "workspace": "/abs/path/to/workspace/03_task2/exec",
  "files": {
    "context": [
      {"role": "skill", "source": "/abs/skills/03_task2", "target": "skills/03_task2"},
      {"role": "fixture", "source": "/abs/workspace/03_task2/tmp", "target": "tmp", "capture": "none"}
    ]
  },
  "runtime": {"env": ["OPENROUTER_API_KEY", "JUDGE_MODEL"], "setup": ["python3 mock_server.py &"]},
  "bench": {
    "schema_version": "roller.bench/v1",
    "name": "wildclawbench",
    "category": "03_Social_Interaction",
    "metadata": {"name": "群聊摘要", "modality": "pure-text", "source_path": "…"},
    "grade": {
      "code": "def grade(transcript, workspace_path):\n    ...",
      "env": ["OPENROUTER_API_KEY", "JUDGE_MODEL"],
      "timeout_seconds": 120,
      "workspace_path": "/tmp_workspace",
      "score_key": "overall_score",
      "stage": [{"source": "/abs/workspace/03_task2/gt", "target": "gt"}]
    }
  }
}
```

### 3.1 `bench.grade` 字段

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `code` | 必填 | grader 的 Python 源码，至少包含一个入口函数 |
| `entrypoint` | `grade` | 入口函数名，必须是合法标识符 |
| `kwargs` | `{}` | 额外传给入口函数的参数 |
| `env` | `[]` | 需从 host 透传到 grading 容器的环境变量名 |
| `timeout_seconds` | `120` | grading 超时，1~3600 |
| `needs_transcript` | `true` | 是否需要将会话记录传给 grader |
| `workspace_path` | harness 默认 | grader 的工作目录（容器内绝对路径） |
| `transcript_path` | 自动推导 | 仅在 harness 无法自行报告会话文件位置时需要显式指定 |
| `score_key` | `overall_score` | grader 返回值中用作总分的键 |
| `grade_on_agent_failure` | `false` | Agent 超时或报错退出后仍对存活的 workspace 评分；默认将此类样本记为未评分 |
| `stage` | `[]` | 仅在评分前复制到容器的 host 路径，见 §4 |

grader 的调用约定：

```python
def grade(transcript, workspace_path):  # transcript 仅在 needs_transcript 时传入
    ...
    return {"overall_score": 0.75, "detail": {...}}  # 必须返回 dict
```

返回值不是 dict 时将报错。Roller 通过自带的 runner 调用该函数，用 `docker cp` 将
runner 复制到容器内执行，并以 `__ROLLER_SCORE__` 前缀标记 stdout 中的分数。
该前缀用于将评分结果与 grader 输出的进度和 judge 请求日志区分开。

### 3.2 grading 失败 ≠ 0 分

评分失败和有效的 0 分分别记录：

- 若 grader 正常返回 `overall_score: 0.0`，则为有效的 0 分。
- 若 grader 崩溃、超时或输出无法解析，或 `stage` 的源在 host 上不存在，则 `score.json`
  中除 0 分外还包含 `error` 字段。聚合时该样本计入 `unscored_count`，并在报告中单独列出。

## 4. `stage`：答案不能放在 Agent 的工作目录里

很多 bench 将 ground truth 和种子文件放在同一目录。若将整个目录挂载到容器中，Agent 即可
读取答案，导致评测信息泄漏。

`stage` 将 host 文件复制到容器，仅在 Agent 最后一轮结束后、grader 启动前执行。
因此 Agent 执行任务时无法读取 `stage` 中的文件。

`source` 必须是 host 绝对路径，`target` 必须是 workspace 内的相对路径。
以 `/` 开头或包含 `..` 的 target 将被拒绝，以防止文件写入工作区之外。

若 `source` 在 host 上不存在，将报告 grading error，以区分缺少评分文件
和 Agent 答错导致的 0 分。

## 5. 聚合口径

`roller bench report <run_dir>` 扫描 run 下的样本，读取 `info.json["runtime"]["bench"]`，
按 bench 各自的 `aggregate()` 汇总（默认为 `mean_aggregate`）。

默认均值以全部样本数为分母，评分失败的样本计 0，与常见 bench 的官方口径一致。报告还单独列出：

- `scored_count` / `unscored_count`
- `scored_average`（仅对成功评分的样本取均值）
- 每个 category 的均值和样本数
- 未评分样本的清单及原因

全部样本均值包含评分失败的影响；成功评分均值排除了这些样本。报告同时提供两者，
便于判断低分是否与 grader 故障有关。

> `bench report` 根据 `score.json` 统计分数，不使用 `info.json` 的 `status`。
> `status: "error"` 常常仅表示 SFT 导出失败（例如观察中包含图片，纯文本导出会丢失数据），
> 这类样本的分数仍然有效，因此不能仅用 `status` 统计评测失败率。

## 6. 加一个新 bench

实现一个 adapter 子类并注册。`load()` 只转换任务定义，不执行任务：

```python
# src/roller/benches/mybench.py
from roller.benches.base import BenchAdapter, BenchBinding, GradeSpec


class MyBenchAdapter(BenchAdapter):
    name = "mybench"
    description = "MyBench — 一句话说明"

    def load(self, root, *, categories=None, task_ids=None):
        rows = []
        for spec in _iter_upstream_tasks(root):
            binding = BenchBinding(
                name=self.name,
                category=spec.category,
                grade=GradeSpec(code=spec.grader_source, env_names=("JUDGE_MODEL",)),
            )
            rows.append(
                {
                    "schema_version": "roller.task/v1",
                    "id": spec.id,
                    "harness": "openclaw",
                    "prompt": spec.prompt,
                    "timeout_seconds": spec.timeout,
                    "bench": binding.as_dict(),
                }
            )
        return rows
```

然后在 `src/roller/benches/__init__.py` 的注册表中添加一行。可选择覆盖 `categories()`
和 `aggregate()`（仅在需要与上游报告方式一致时）。

实现时需要处理以下情况：

- `categories()` 从 checkout 的实际内容读取类别。部分 checkout 缺少上游类别，硬编码
  类别列表可能使 `--category` 返回空集。
- `--task-id` 不存在时应报错，避免将空运行误认为成功。
- 解析器应接收字符串而非 `Path`，以便在不访问文件系统的情况下测试解析逻辑。
- 保留上游 runner 添加的 prompt 前缀和后缀，包括未写在任务文件中的内容。
  例如 WildClawBench 有一段 277 字符的前缀，遗漏后会改变任务输入。
- Export 时报告必需的外部依赖。WildClawBench 的 `web_search` 使用本地 shim，
  不直接访问 Brave。未配置时，搜索会返回 `fetch failed`，但 Agent 仍会继续执行并
  产生分数。检查这类错误后，才能判断搜索失败对评测结果的影响。

### 6.1 每个 bench 须附带 README

接入 adapter 时，须在本文档中新增该 bench 的中英文页面：位于[官网仓库](https://github.com/Valen-Team/valen-team.github.io)的 `roller/benches/<name>.md` 及其 `i18n/zh-Hans/` 下的对应页。该页说明此 bench 的配置，
通用机制引用本页即可。该页应包含：

1. 从 clone 上游到 `bench report` 的可复制命令；
2. 上游参数与 Roller 配置的对应表，包括 CLI 参数和环境变量；
3. 尚未支持的上游参数，以及其他参数无法替代它的原因
   （例如：WCB 的超时乘数会改写任务文件，因此也会改变 prompt 中告知 Agent 的预算；
   `--timeout` 仅改变墙钟时间，二者不等价）；
4. 必需的环境变量，以及是否需要 `--pass-env`；
5. 已知问题，尤其是不报错却影响结果有效性的情况，并附运行后的检查命令。

参数对应表应明确标出未支持的配置，以便使用者判断 Roller 与上游运行条件是否一致。

## 7. CLI

```bash
# 列出 adapter
roller bench list

# 推荐：转换、采集、评分、汇总一条命令完成
roller collect --bench wildclawbench --bench-root /path/to/WildClawBench \
    --bench-category 03_Social_Interaction --model <provider>/<model> \
    --harness openclaw --openclaw-image wildclawbench-ubuntu:v1.3 \
    --parallel 4 --pass-env JUDGE_MODEL --pass-env OPENROUTER_API_KEY

# 高级三步流程：仅转换为任务清单，不执行任务
roller bench export wildclawbench /path/to/WildClawBench --output tasks/wcb.jsonl
roller bench export wildclawbench /path/to/WildClawBench -o /tmp/one.jsonl \
    --category 03_Social_Interaction --task-id 03_Social_Interaction_task_2_group_chat_zh
roller bench export qwenclawbench /path/to/QwenClawBench -o /tmp/qcb.jsonl \
    --runs-per-task 3

# 采集并评分；--task-timeouts 使每行使用各自的 timeout_seconds
roller collect --tasks tasks/wcb.jsonl --model <provider>/<model> \
    --harness openclaw --openclaw-image wildclawbench-ubuntu:v1.3 \
    --task-timeouts --parallel 4 \
    --pass-env JUDGE_MODEL --pass-env OPENROUTER_API_KEY --pass-env OPENROUTER_BASE_URL

# 汇总（run_dir 为位置参数，而非 --run）
roller bench report runs/<run-name>
roller bench report runs/<run-name> --output report.json
```

`--category` 和 `--task-id` 均可重复指定。`--task-timeouts` 是 bench 运行的关键开关：
bench 的每个任务自带超时（WildClawBench 实测有 300/360/600/900/1200 五档），
而 `build_requests` 通常只使用一个全局 `--timeout`。不启用该开关时，
短任务会获得过多时间，长任务会被墙钟超时中断，而被中断的结果与模型无法完成任务的结果十分相似。
单条命令 `collect --bench` 会自动启用逐题 timeout，并在 run 目录保存 `tasks.jsonl` 和
`bench-report.json`，因此无需再传入 `--task-timeouts` 或单独执行 `bench report`。

`roller bench run --config FILE` 根据 YAML 描述启动同一个 `collect --bench` 运行，见
[Benchmark 运行配置](/roller/benches/benchmark-standard/)。

grader 所需的环境变量须通过 `--pass-env` 透传（所需变量由 bench 的任务定义声明）。
缺少变量时，Roller 发出警告并继续运行。正式采集前，请确认日志中没有
`grading environment variable ... is unset`。

## 8. 已支持的 bench

各 bench 的配置见对应 README（见 §6.1）：

| Bench | `--harness` | README | 概要 |
| --- | --- | --- | --- |
| `wildclawbench` | `openclaw` | [WildClawBench](/roller/benches/wildclawbench/) | 6 个类别的 60 个真实场景任务；grader 在容器内运行；26 个任务的 `gt/` 通过 `stage` 提供 |
| `skillsbench` | `opencode` | [SkillsBench](/roller/benches/skillsbench/) | 按 task 构建环境；支持 `with-skill` / `no-skill` 对照和官方 verifier |
| `pinchbench` | `openclaw` | [PinchBench](/roller/benches/pinchbench/) | 从 manifest 导出，支持自动、LLM judge、hybrid 与多 session |
| `qwenclawbench` | `openclaw` | [QwenClawBench](/roller/benches/qwenclawbench/) | 8 个领域的 100 个任务；支持 automated/hybrid、惩罚式评分和每题重复运行 |
| `swebench-pro` | `openclaw` | [SWE-Bench Pro](/roller/benches/swebench-pro/) | 11 个仓库的 731 个软件工程任务；使用官方实例镜像、隐藏测试和 resolved 评分 |

运行前请核对对应 README 中的参数映射和未支持项。配置缺失不一定触发错误，
却可能改变评测条件，使分数无法直接比较。

## 报告与评分失败

报告按模型分组，必要时进一步区分 Harness；多模型报告没有混合平均分。所有已采集样本（包括 agent 启动失败）计入对应模型的分母，分类平均也采用相同规则。报告列出已评分、未评分数量与原因，并额外给出仅已评分样本的平均值供诊断。尚未生成样本的计划请求单独列出。

真正的零分属于已评分；评分器报错属于未评分，并使采集以失败退出。修复原因后，用 `--resume --resume-unscored` 重跑受影响样本；由于一次性工作区已销毁，会再次运行 agent。`--grader-retries` 可在容器仍存活时先重试评分。
