---
title: "文件、Task Bundle 与结果存储"
---

# 文件、Task Bundle 与结果存储

本页介绍 task 文件如何从宿主机进入 Agent 工作区、如何保存到 run/sample，以及快照、Context capture、结果回收、retry 与 Resume 的规则。Task 字段见 [Task 格式参考](/roller/tasks/task-format/)。

## 1. 文件生命周期

文件在运行过程中经过四个阶段：

1. **宿主机文件包**：`file_root` 下由用户维护的输入与 Context。
2. **Task Bundle**：运行前构建的不可变快照，供同一 task 的所有模型使用。
3. **Agent 工作区**：每个 rollout 独享；OpenClaw 使用 `/tmp_workspace`，Codex、Claude Code、Hermes、OpenCode、DeepSeek 与 Pi 使用 `/roller/workspace`。
4. **Sample**：最终保存的目录，包含 raw、ACTF、SFT、info 和可选的 `results/`。

一组典型路径如下：

| 用途 | 路径示例 |
| --- | --- |
| Task 清单 | `dataset/tasks.jsonl` |
| `file_root` | `dataset/files/task_001/` |
| 宿主机输入 | `dataset/files/task_001/inputs/brief.md` |
| Agent 读取 | `<workspace>/inputs/brief.md` |
| Agent 写入 | `<workspace>/outputs/report.md` |
| 最终结果 | `samples/<model>/00000000_task_001/results/report.md` |

`file_root` 定义逻辑工作区关系，但 Roller 不会将 Agent 生成的文件直接写回该目录。每个 task/model rollout 都有自己的容器和 sample，因此并行模型不会覆盖彼此的输出。

## 2. 输入快照

`files.inputs` 中的文件和目录在 Docker 启动前扫描。Roller 执行以下操作：

- 拒绝符号链接、特殊文件和路径逃逸。
- 递归记录目录结构。
- 计算每个文件的 SHA-256、大小和权限。
- 校验声明的可选 `sha256`。
- 将源文件直接复制到内容寻址的输入树，复制时同步计算 hash，与扫描结果对比以检测源文件变化；不再保存中间 blob。

默认限制：

| 限制 | 默认值 | CLI |
| --- | ---: | --- |
| 单个输入或 Context 文件 | 10 GiB | `--max-input-file-bytes` |
| 单条 task 输入总量 | 50 GiB | `--max-task-input-bytes` |

同一 run 中内容相同的输入树可以复用。Task Bundle manifest 仅在内存中计算，不写入磁盘，记录声明、文件 hash、输入树 digest 和 Context digest；最终 sample 只保存这些 digest，不复制整套输入依赖。

OpenClaw 提供两个入口：

```text
/tmp_workspace/<source>          # 每个声明输入保持自己的相对路径
/roller/task/inputs/<source>     # 完整输入快照的只读入口
```

Task Bundle 位于运行期临时目录，采集结束后删除。使用 `--resume` 时，Roller 重新读取当前 task 和文件，重建 digest 后再判断能否复用旧 sample。

## 3. Context 注入与 capture

普通输入按路径提供。Context 还声明 `role` 与 `target`，Harness 据此将其放置到 Agent 能识别的位置。

各 Harness 将 Context 放置到各自能够自动发现的位置：

| Harness | 项目工作区 | 额外位置 |
| --- | --- | --- |
| OpenClaw | `/tmp_workspace/<target>` | `/root/<target>` |
| Codex | `/roller/workspace/<target>` | `role=skill` 还会复制到隔离的 `$HOME/.agents/skills/` |
| Claude Code | `/roller/workspace/<target>` | `role=skill` 还会复制到隔离的 `$CLAUDE_CONFIG_DIR/skills/` |

OpenClaw 的具体路径为：

```text
/root/<target>
/tmp_workspace/<target>
```

因此 `role: "user"` 的默认 `USER.md`、`role: "memory"` 的默认 `MEMORY.md`，以及 skills 目录均可按 OpenClaw 的常规约定被发现。

`capture` 决定 Task Bundle 如何记录 Context 内容：

| 策略 | 记录 hash | 在 run 中保存原文 | 允许安全 Resume |
| --- | --- | --- | --- |
| `full` | 是 | 是 | 是 |
| `hash` | 是 | 否 | 是 |
| `none` | 否 | 否 | 否 |

三种策略都会将 Context 直接复制到运行期 context 目录，复制时同步计算 hash 并与扫描结果对比，不再额外保存 blob 或重新读取目标文件计算 hash。`full` 还会在 run 目录的 `context/sha256/<sha256>` 为每个文件保存一份原文，内容相同的 task 和模型共用同一份，并写入 `context/manifests/<context_manifest_digest>.json`，记录每个 Context target 对应的内容。sample 的 `info.json` 记录了 `context_manifest_digest`，因此可以从 run 中读回 Agent 实际看到的 Context。Resume 会补回缺失的副本，不会重跑 sample。输入和 `full` Context 的 digest 数据中的 `blobs/sha256/...` 标识仅用于兼容已有 run lock，不代表磁盘上存在对应文件。

默认情况下，`user` 和 `memory` 使用 `hash`，其他 role 使用 `full`。若内容涉及隐私但仍需可靠检测变化，可使用 `hash`；若不希望记录任何内容 hash，则使用 `none`，此时该 task 无法安全 Resume。

## 4. Agent 工作区

每个 rollout 都使用独立容器和隔离的 Harness home/session，不会读取宿主机的 Agent 登录态或历史。工作目录如下：

| Harness | 工作目录 | 自动发现的项目指令 |
| --- | --- | --- |
| OpenClaw | `/tmp_workspace` | `AGENTS.md` 及 OpenClaw Context 文件 |
| Codex | `/roller/workspace` | `AGENTS.md` |
| Claude Code | `/roller/workspace` | 建议把项目指令 target 设为 `CLAUDE.md` |

以 OpenClaw 为例：

```text
/tmp_workspace/
├── inputs/                    # 只读挂载的声明输入
├── USER.md                    # 可选 Context
├── MEMORY.md                  # 可选 Context
├── skills/                    # 可选 Context
└── outputs/                   # 默认可写输出目录
```

输入文件按各自 source 路径只读挂载，Context 在运行前注入。`runtime.setup` 随后在上表对应的工作目录执行，之后才开始 Agent 对话。

`/roller/task/outputs` 是 task `output_dir` 的稳定别名。即使 task 使用 `deliverables/final`，该别名仍指向当前可回收目录。

Legacy workspace 模式会把整个旧 workspace 快照复制到工作区；新数据应显式声明输入和 Context，避免把无关文件纳入快照和 digest 计算。

## 5. 输出回收

Task 只需声明一个目录：

```json
{
  "files": {
    "output_dir": "outputs"
  }
}
```

task 结束后，Roller 遍历整个 `output_dir`，将所有普通文件和空目录复制到 sample 的 `results/`，并保持相对结构：

```text
/tmp_workspace/outputs/
├── report.md
└── assets/chart.png

results/
├── report.md
└── assets/chart.png
```

任意层级的生成型 `node_modules/` 目录都会被排除。包清单和 lockfile 仍会被回收，
依赖树及其常规 `.bin` 符号链接不会放大产物或触发符号链接安全校验。

sample 的 `info.json` 为每个结果文件记录：

- 相对路径
- SHA-256
- 字节数
- MIME type

输出为空时不创建 `results/`。发现符号链接或特殊文件时，安全的普通文件仍可被保存，但 sample 状态会变为 `error`，以免不完整或危险的输出被当作成功结果。

`--collect-path` 仍可将旧 task 指定的额外容器路径复制到 `results/legacy/`。新 task 应让 Agent 将需要保留的文件写入 `output_dir`。

## 6. Run 与 Sample

普通 rollout 的最终目录：

```text
<output>/<run-name>/
├── info.json
├── lock.json
├── sft.jsonl
├── context/                 # capture=full 的 Context 原文，按内容寻址
└── samples/
    └── <model>/
        └── <index>_<task>/
            ├── trace.jsonl
            ├── trace_ACTF.json
            ├── trace_SFT.json
            ├── info.json
            └── results/                 # 可选
```

Run `info.json` 保存：

- 本次命令的重要配置
- `initializing/running/finalizing/finished/interrupted/finalization_error` 运行阶段
- 已处理、待处理、成功、失败、超时和跳过数量；采集过程中的周期性 checkpoint
- task、模型与 trajectory 数量
- 成功、失败、超时和跳过数量
- 全部 sample 的 usage 汇总
- sample 相对路径索引

Run `lock.json` 保存脱敏后的运行配置，供 Resume 比较。配置以结构化数据保存，
不另行计算 hash；内容摘要复用 Task Bundle 已有的 digest。锁定内容包括：

- request 顺序、task/model、timeout 和 Task Bundle/input/context digest；
- 所选 Harness 的镜像引用与本机解析出的 image ID；
- 对应 Harness 的模型/API 配置，以及 thinking、wire trace、容器与输出等语义选项。

API Key、token 等 credential 被替换为 `<redacted>`；URL 中的 userinfo 和 fragment 被
移除，敏感 query value 被替换，但 `api-version` 等非敏感 query 会保留用于一致性比较。
锁用于防止不同配置的数据混入同一 run。它不保存密钥，也不验证 credential 是否仍可用。

Sample `info.json` 保存：

- task ID、模型、Harness 和状态
- 错误与 attempt 历史
- token、cache、cost 和请求数
- 开始时间、结束时间和耗时
- OpenClaw 版本、镜像 digest、脱敏 API base
- Task Bundle、输入与 Context digest
- 输出文件清单
- raw/ACTF/SFT 路径

运行期 gateway/agent 日志、临时模型配置、Task Bundle、retry 中间 trace 和未回收的工作区文件不会留在最终 sample。

User Simulator sample 还包含：

```text
<index>_<task>/
├── conversation.json
└── user_simulator/
    ├── trace.jsonl
    ├── trace_ACTF.json
    ├── trace_SFT.json
    └── info.json
```

根 sample 仍代表 Task Agent；`user_simulator/` 代表模拟用户。双方 usage 的总和写入根 `info.json`，分项写入该文件的 `conversation.participants`。详情见 [User Simulator 与动态对话](/roller/tasks/user-simulator/#8-保存与使用轨迹)。

## 7. Raw Trace、ACTF 与 SFT

### 7.1 `trace.jsonl`

该文件记录 OpenClaw transcript 中的原始事件。默认镜像下，Roller 通过官方公开
transcript SDK 按 session identity 导出，再逐事件序列化为 JSONL；仅 legacy OpenClaw 回退
到直接复制 session JSONL。Roller 不为训练删除 tool call、不改写消息文本，也不把多个
事件合并成自定义文本格式，但该文件不是底层存储的字节副本或上游 HTTP 响应副本。
OpenClaw 可以在调用前组装、压缩或裁剪 context，因此 session 中保存的消息未必会
逐字进入每次模型请求。如需核对模型实际收到的 messages/input，请使用 `--wire-trace full`；详见
[轨迹产出文件指南](/roller/traces/trajectory-outputs/#32-session-历史不等于模型请求-context)。

### 7.2 `trace_ACTF.json`

ACTF 文件直接保存 `ACTF_v1.0` trajectory object：

```json
{
  "schema_version": "ACTF_v1.0",
  "steps": [],
  "started_at": "2026-08-20 10:00:00.000000",
  "finished_at": "2026-08-20 10:00:01.000000"
}
```

转换规则：

- 每个 assistant message 形成一个 step。
- 可见回复进入 `assistant_content.content`。
- reasoning/thinking 进入 `assistant_content.reasoning_content`。
- Tool call 同时写入 `assistant_content.tool_calls` 和 `tools`。
- 随后的 tool result 进入该 step 的 `observation`。
- 当前 user message 写入 `user_content`。
- OpenClaw usage 映射到 step `metric`。

若 Harness 成功结束但没有可用 raw trace，sample 将标记为 `error`。若可信的 OpenClaw/OpenCode 转换器无法把有效 raw 无损表示为 ACTF，或 ACTF 含有无法无损表示为纯文本 SFT 的内容，评测状态仍保持 `ok`；`runtime.trajectory_conversion` 会记录缺失层和错误，不会伪造产物。

### 7.3 `trace_SFT.json` 与 `sft.jsonl`

线性 sample 的 `trace_SFT.json` 由 ACTF 投影得到；纯文本记录顶层为 `messages` 和 `tools`，不包含
task/model、usage、时间戳或其他运行 metadata。Run 根目录的 `sft.jsonl` 按 request
顺序汇总符合条件的线性 Task Agent 记录。压缩 sample 改为导出 `sft_segments/`，路径列在
`info.json` 中，不进入原有 run 级文件。带有明确 `runtime.trajectory_conversion`
降级标记的成功 sample 也不会写入该文件。完整字段和校验规则见
[SFT 数据格式](/roller/traces/sft-format/)。

所有轨迹层、辅助文件、参数组合及失败/Resume 下的产出条件见
[轨迹产出文件指南](/roller/traces/trajectory-outputs/)。

## 8. 安全与隐私边界

### 8.1 文件

- 输入和 Context 拒绝符号链接与特殊文件。
- 路径不允许使用 `..` 逃逸声明范围。
- 输出只回收 `output_dir`，不保存工作区中的其他文件。
- 输出中的符号链接和特殊文件不会被复制。

### 8.2 API Key

- `${ENV_NAME}` 只在运行时展开。
- OpenClaw 临时模型配置在系统临时目录创建，注入容器后删除。
- Run metadata 只记录环境变量名称，不记录值。
- API base 会移除认证信息、query 和 fragment 后再保存。

请勿将真实 Key 写入仓库中的 task、JSON 示例或 README。推荐使用被 Git 忽略的本地 `.env` 或外部 secret manager。

### 8.3 Context

`capture=full` 会在 run 目录的 `context/` 下保存 Context 原文，run 目录应按包含这些内容来管理。`capture=hash` 仍会保存不可逆的内容 hash；若 hash 也不得保留，应使用 `capture=none`。此设置将关闭该 task 的安全 Resume，因为 Roller 无法确认 Context 是否发生变化。

## 9. Retry 与 Resume

`--retries N` 在同一 sample 中最多额外执行 N 次。最终 `info.json` 保存每次 attempt 的状态、错误与耗时；canonical raw/ACTF/SFT 代表最后一次 attempt，运行期中间文件会被清理。

`--resume` 分两层检查。首先，当前解析出的 `lock.json` 必须与旧锁完全一致；否则命令
报告差异并停止，不会把不同配置产生的 sample 混入同一个 run。锁覆盖 task/model
顺序、timeout、Task Bundle digest、模型配置、镜像 ID、thinking 和轨迹策略等会影响 sample
语义的选项。`--parallel`、`--retries`、gateway 端口/启动超时、路径位置和 bundle 大小
上限属于执行调度或约束，不影响已成功 sample 的语义，因此可以在 Resume 时调整。

每个 rollout 会再次检查镜像 ID，并直接用这个 ID 启动容器，因此即使 tag 在此期间被移动，sample provenance 中记录的也是实际运行的镜像。tag 解析出的 ID 与 preflight 时不同时，Roller 记一条 warning。

credential 与 pass-through environment 的值不会保存到锁，也不会触发不一致。若这些
值除认证外还会改变模型或服务的实际行为，应使用新的 `--run-name`。

运行锁一致后，只复用满足全部条件的 sample：

1. 旧状态为 `ok`。
2. sample 的 request/task/model identity 与当前请求一致。
3. `trace.jsonl` 含有效 message；通常还要求 ACTF schema 正确且 step ID 从 1 连续。
4. 通常 `trace_SFT.json` 与当前 ACTF 的 canonical SFT 投影完全一致。存在结构化 `trajectory_conversion` 降级时可以缺少 ACTF/SFT 或仅缺少 SFT；Resume 会校验所有已保留层以及该显式标记。
5. 当前 Task Bundle digest 与旧 sample 一致，且 Context 没有使用 `capture=none`。
6. 已记录的输出文件仍位于 `results/` 内，文件存在且大小一致。保存的 SHA-256 在文件复制到
   `results/` 的同时计算，可用于深度审计；Resume 为避免重新读取大文件，只做路径、存在性和大小检查；加上 `--resume-verify-outputs` 会重新读取文件并比对摘要。
7. User Simulator task 还必须有有效的 `conversation.json`、participant info 和 Simulator
   raw/ACTF/SFT。
8. `--wire-trace full` 还要求双方的 `wire_trace.jsonl` 存在；同时启用 cache trace 时，
   根据 Agent 和 Simulator 各自实际使用的 Harness，要求 OpenClaw 一侧的
   `cache_trace.jsonl` 存在。Codex 和 Claude Code 不产生此文件，不要求提供。

同一运行锁下，任一 sample 不满足完整性条件时只重新执行该 sample。以下变化会导致运行锁
不一致，须使用新的 run name，不会以静默重新执行的方式混入旧 run：

- prompt、messages 或 User Simulator 配置变化
- 输入内容、目录结构或声明变化
- Context 内容、target 或 capture 变化
- `output_dir` 变化
- Runtime env、setup、模型配置、镜像或 thinking/轨迹策略变化

同一个新 run 中的多个模型分别保存在不同的 sample model 目录；锁创建后，不能通过 Resume
增删或重排模型。请为新的模型组合使用新的 run name。

由旧版本创建且没有 `lock.json` 的 run 可通过 `--resume` 迁移。Roller 写入当前锁，但由于
无法证明旧执行配置相同，首次迁移会将已有 sample 全部重新执行一次；此后的 Resume 才允许安全复用。
迁移期间存在临时 `.legacy-resume-untrusted.json` 标记，只有所有 request 完成并生成 run
级 SFT 后才删除。即使进程被强制终止，下一次运行也不会误用尚未重新采集的旧 sample。
