---
title: "轨迹产出文件指南"
---

# 轨迹产出文件指南

`roller collect` 会保存轨迹、训练数据、运行信息和任务输出。本页列出各文件的内容、
生成与保留条件，以及训练、分析和调试时的用途。

## 1. 速查

| 需求 | 首选文件 | 原因 |
| --- | --- | --- |
| 直接训练 Task Agent | Run 级 `sft.jsonl` | 每行一个最小 SFT record，可直接流式读取 |
| 查看原有训练记录 | Sample 级 `trace_SFT.json` | 与 `sft.jsonl` 中对应 record 完全相同 |
| 查看压缩后的上下文 | Sample 级 `sft_segments/*.json` | 独立记录，训练时须显式处理目标范围 |
| 顺序读取一个 run 的所有压缩分段 | Run 级 `sft_segments.jsonl` | 汇总相同的分段记录，读取时须处理目标范围 |
| 轨迹分析、打分、统计 token | `trace_ACTF.json` | 有 step、reasoning、observation、metric 和时间信息 |
| 追查 Harness session 原始事件 | `trace.jsonl` | OpenClaw、Codex、Claude Code、Hermes、OpenCode、DeepSeek 或 Pi native session，Roller 不做训练清洗 |
| 查看 ACTF 捕获的首个 system prompt | `trace_ACTF.json` 顶层 | 来自各 Harness 可取得的 native/cache/wire 来源，只固化一次 |
| 核对 OpenClaw 每次 system prompt 是否变化 | `--wire-trace full` 的 `cache_trace.jsonl` | 保留 OpenClaw 每次 LLM call 的诊断记录 |
| 核对模型实际收到的请求历史和 tools | `--wire-trace full` 的 `wire_trace.jsonl` | 保存代理实际转发的每次 JSON 请求体 |
| 查看 Task Agent 交付文件 | `results/` | 只回收 task 声明的输出目录和额外 collect path |
| 查看动态双方可见对话 | `conversation.json` | 不包含隐藏 reasoning、tool call 和 tool result |
| 在 Harbor 或其他 ATIF 工具中使用轨迹 | `roller export` 生成的 `trajectory.json` | 由 ACTF 转换的 ATIF 文档，图片存为文件 |

训练时使用 SFT，分析时使用 ACTF。排查 Harness 运行、上下文组装或模型服务行为时，查看原始会话 `trace.jsonl` 和完整请求记录 `wire_trace.jsonl`。
完整请求记录会在多轮运行中重复保存历史内容，文件会快速增大，不适合直接作为训练数据。

## 2. 目录结构

### 2.1 默认普通 rollout

OpenClaw 默认参数是 `--cache-trace --wire-trace actf --keep-thinking`；Codex 默认关闭 web
search，并保留 native session 中实际可见的 reasoning content 或 summary；Claude
Code 保留 native session 中的明文 thinking block。七种 Harness 成功 run 的主要结构相同：

```text
<output>/<run-name>/
├── info.json
├── lock.json
├── sft.jsonl
└── samples/
    └── <model>/
        └── <index>_<task>/
            ├── trace.jsonl
            ├── trace_ACTF.json
            ├── trace_SFT.json
            ├── info.json
            └── results/                 # Task 输出含文件或目录时存在
```

OpenClaw 默认的 `actf` wire 模式会临时捕获 tools schema，写入 ACTF/SFT 后删除中间
`wire_trace.jsonl` 和 `cache_trace.jsonl`，以减少最终 sample 的存储占用。Codex 的默认 `actf`
在配置 `--api-base` 时通过 HTTP 代理捕获原始 Responses 工具，转换后保留 `tools_capture.jsonl`。Claude Code 在显式
`--api-base` 时临时捕获 Anthropic system 和完整 `input_schema`；未设 API base 或
`--wire-trace off` 时则从实际 `tool_use` 推导 permissive schema。

### 2.2 `--wire-trace full`

`full` 模式额外保留诊断层：

```text
<index>_<task>/
├── trace.jsonl
├── trace_ACTF.json
├── trace_SFT.json
├── cache_trace.jsonl              # 仅 OpenClaw
├── wire_trace.jsonl
├── info.json
└── results/                       # 可选
```

### 2.3 User Simulator rollout

动态任务在根 sample 保存 Task Agent，在子目录保存 Simulator：

```text
<index>_<task>/
├── trace.jsonl                    # Task Agent raw
├── trace_ACTF.json                # Task Agent ACTF
├── trace_SFT.json                 # Task Agent SFT
├── conversation.json              # 双方可见的干净交替对话
├── info.json                      # 总 usage 与双方索引
├── user_simulator/
│   ├── trace.jsonl                # Simulator raw
│   ├── trace_ACTF.json            # Simulator ACTF
│   ├── trace_SFT.json             # Simulator SFT
│   └── info.json                  # Simulator 独立状态和 usage
└── results/                       # 只属于 Task Agent，可选
```

Run 级 `sft.jsonl` 只汇总根目录的 Task Agent，不混入 User Simulator 的 SFT。

## 3. 从运行到训练集的数据链路

一条轨迹按以下顺序生成：

```text
Harness session store ────────────────> trace.jsonl
  ├─ OpenClaw transcript SDK
  ├─ Codex $CODEX_HOME/sessions native rollout
  └─ Claude Code $CLAUDE_CONFIG_DIR/projects native session + subagents
                              │
                              ├─ Harness-native ACTF converter
                              └─ Harness request diagnostics
                                  ├─ OpenClaw cache + wire
                                  ├─ Codex wire
                                  └─ Claude Code Anthropic wire
                                                │
                                                v
trace.jsonl + Harness 可取得的 system/tools ──> trace_ACTF.json
trace_ACTF.json ── 线性 ─────────────────────────> trace_SFT.json ──> run/sft.jsonl
捕获的 Calls ──── 压缩 ─────────────────────────> sft_segments/（显式使用）
```

下图展示相同的数据链路，虚线部分为需通过参数开启的文件。

![轨迹数据流：Harness session 复制为 trace.jsonl 并转换为 trace_ACTF.json，再生成 trace_SFT.json 和 sft.jsonl；--capture-calls 开启压缩分段导出，--wire-trace full 将请求体保存到 wire_trace.jsonl](/img/roller/pipeline-zh-Hans.png)

`trace.jsonl` 记录当前 Harness session 的事件。ACTF 将这些事件转换为分析格式，
SFT 再去除训练不需要的字段。SFT 不参与 ACTF 或 raw 的生成。

### 3.1 三种文件回答的是三个不同问题

| 文件 | 捕获位置 | 能回答 | 不能据此断言 |
| --- | --- | --- | --- |
| `trace.jsonl` | Harness session 导出层 | Agent 记录了哪些 user/assistant/tool 事件、顺序与 usage | 某次请求完整携带了哪些历史消息；上游 HTTP 的逐字请求/响应 |
| `cache_trace.jsonl` | OpenClaw context 组装诊断点 | 每次 LLM call 组装出的 system prompt 及相关诊断阶段 | 完整 messages/input 和最终 provider 请求参数 |
| `wire_trace.jsonl`（full） | Harness provider adapter 之后、真实模型 API 之前 | Roller 代理实际转发的 JSON body，包括 messages/input、tools 和采样参数 | 模型服务收到请求后内部如何 tokenize、截断或路由 |

### 3.2 Session 历史不等于模型请求 context

`trace.jsonl` 中“存在某条消息”只说明它进入了 Harness 的 session 记录，不说明它在
后续每次模型调用中仍被逐字发送。OpenClaw 会从 session 构建受 context window 限制的
运行时 context；其官方说明明确区分持久化 transcript 与模型 context：compaction 会用
摘要替代较旧历史并保留近期消息，pruning 可以只从内存 prompt 中移除旧 tool result，
而不重写磁盘 transcript。插件 context engine 和运行时 hook 也可以参与 context 组装。
参见 [OpenClaw Context](https://docs.openclaw.ai/concepts/context) 与
[Session Management and Compaction](https://docs.openclaw.ai/reference/session-management-compaction)。
具体压缩、裁剪和持久化实现取决于镜像内的 OpenClaw 版本、模型 profile 与所选 context
engine；Roller 不从 session 文件猜测这些变换，而是在最终 API 请求边界采集 full wire。
Codex 同样会在 native session 与 Responses input 之间加入 base/developer instructions、
environment context、tool namespace、resume history 和压缩结果；这些最终形态也只能由 full
wire 确认。Claude Code 的 native session 也不等于 Anthropic Messages request：CLI 会添加
system blocks、tools schema、project/context instructions、缓存标记和对话管理结果。如需检查
模型请求，请使用 Claude Code `--wire-trace full`。

Session 和请求之间可能存在以下差异：

- session 中有、模型请求中没有：旧 tool result 被裁剪、历史被压缩成摘要、消息因窗口
  或 provider 规则被过滤；
- session 中没有逐条对应事件、模型请求中却有：组装后的 system prompt、tools schema、
  workspace/bootstrap 注入、每轮 runtime context 或 hook 增补内容；
- 内容仍在但表示不同：Harness/provider adapter 可以将内部 message/block 转换为
  Chat Completions `messages` 或 Responses `input` 的最终协议形态。

使用 `trace.jsonl` 回顾 Agent 的逻辑轨迹，使用 `wire_trace full` 检查每次 HTTP 模型请求
的 JSON context。ACTF/SFT 从 session raw 转换而来，无法恢复每次请求经过压缩、裁剪
或临时注入后的 context。

## 4. 核心轨迹文件的区别

### 4.1 `trace.jsonl`：Harness 原始轨迹

OpenClaw 内容包括 transcript 中的 user、assistant、thinking、tool call、tool result、usage
等原始 message event。默认镜像中，Roller 通过公开的
`openclaw/plugin-sdk/session-transcript-runtime` 按精确 session identity 读取事件，再逐条
序列化为 JSONL；它不为了训练而删除、合并或重排合法事件。此处的“原始”是相对 Roller
的 ACTF/SFT 转换而言，不是底层 SQLite/JSONL 文件的字节副本，也不是网络层原始请求或
响应。SDK 只返回 OpenClaw 认可的 transcript 事件，因此底层存储中的损坏行或非事件记录
不会出现在导出文件中。legacy OpenClaw 不提供该 SDK 时，Roller 才直接复制 session JSONL。

Codex 内容来自 rollout 容器 `$CODEX_HOME/sessions` 的 native JSONL，包括 `session_meta`、
`turn_context`、`response_item`、`event_msg`、压缩事件和 token usage。Codex raw 同样属于
Harness 私有 schema；它不是 `codex exec --json` 的终端展示流，也不是 HTTP wire trace。

Claude Code 内容来自 `$CLAUDE_CONFIG_DIR/projects` 的本 rollout 主 session 及其
`subagents/*.jsonl`。Roller 按 timestamp 合并、按原生 `uuid` 去重，保留 user、assistant、
thinking、signature、`tool_use`、`tool_result`、usage 和 sidechain 字段。它不是
`claude --output-format=stream-json` 的终端流，也不是源文件的逐字节拼接。

Sample `info.json.trajectory.raw_schema` 会分别标记 `openclaw-session-jsonl`、
`codex-session-jsonl` 或 `claude-code-session-jsonl`。

生成条件：

- Harness 容器已经启动，结束阶段能导出非空 native session；OpenClaw legacy 路径要求
  找到指定 session JSONL 或最新 fallback，Codex 路径要求找到最新 native rollout JSONL，
  Claude Code 路径要求找到本容器最新的主 session；
- Harness 成功返回但不能取得非空 raw trace 时，sample 会改为 `error`；
- Harness 本身为 `error` 或 `timeout` 时，若仍能导出 transcript，raw 仍会保留。

用途与边界：

- 适合追查上游字段、事件顺序和转换问题；
- 结构属于 Harness，不作为稳定训练 schema；
- 不能单独用于验证 context compaction、tool-result pruning 或 provider 适配后的真实
  请求；七种 Harness 都应使用 `--wire-trace full`；
- Chat Completions 返回的 `reasoning`/`reasoning_text` 在进入 OpenClaw 前可能被等价规范化
  为 `reasoning_content`，以保证后续轮次重放；thinking 文本不变，但字段签名和上游 HTTP
  响应不再是逐字对应关系；
- `--no-keep-thinking` 不修改 raw，因此 raw 仍可包含当前轮产生的 thinking；该参数影响
  ACTF/SFT，不是 raw 脱敏开关。OpenClaw 还可在 wire 层剥离后续请求历史；Codex 和
  Claude Code 只控制导出，不改写 `resume`/`--continue` 上下文。

### 4.2 `trace_ACTF.json`：统一分析轨迹

ACTF 顶层保存 `schema_version`、`system_prompt`、完整 `tools`、`steps` 和轨迹时间。
每个 assistant message 形成一个 step，step 内包含：

- `user_content`：本轮用户输入；
- `assistant_content.reasoning_content`：可见 reasoning/thinking；
- `assistant_content.content`：可见回复；
- `assistant_content.tool_calls`：工具调用；
- `observation`：该次调用之后的工具结果；
- `metric`、开始/结束时间和 stop reason。

生成条件：

- Harness 已取得 `trace.jsonl`，且对应 adapter 能生成 canonical ACTF；
- OpenClaw system/tools 分别来自 cache/wire 捕获；缺失时 system 为 `""`、tools 为 `null`；
- Codex system 来自 native base instructions、developer/system message 和首轮前的
  `<environment_context>`；task 用户消息按内容匹配到对应轮次。原始工具定义来自 Responses 请求捕获，
  包含未调用的工具，`tools_capture` 保留逐请求快照；捕获缺失、工具变化或定义形式不支持时 SFT 不可用。
- Claude Code 将同一 `message.id` 的流式 native 事件合并，把明文
  `thinking/reasoning/analysis` 写入 `reasoning_content`，把 `tool_use_id` 与后续
  `tool_result` 关联。`redacted_thinking` 密文保留在 raw，不转换为明文。
  Wire 存在时 system/tools 来自 Anthropic request；否则 system 为 `""` 并根据实际
  `tool_use` 推导 permissive schema。

OpenClaw ACTF 只把 cache trace 中首个有效的组装后 system prompt 和 wire trace 中首个
非空 tools schema 固化在顶层；Codex ACTF 使用 native system 事件和原始请求工具定义；Claude Code ACTF 使用首个捕获到的 Anthropic system/tools，无 wire 时回退到
native 推导。它们都没有逐 step 保存每次请求的完整 messages/input。Codex 额外保留逐请求工具
快照，工具变化时不导出 SFT；如需检查这些变化，请使用 full wire，OpenClaw
还可结合 full cache trace。

raw 存在时，Roller 均会尝试转换，包括 Harness 已经失败或超时的 sample。因此错误
sample 可能仍有 ACTF。已显式记录的转换不可用状态见
`runtime.trajectory_conversion`；它与 Harness 的采集状态分开保存。

### 4.3 Sample 级 SFT 记录

线性 SFT 从 ACTF 生成，存入 `trace_SFT.json`。主 Agent 压缩上下文时，Roller
仅在 root Calls 与 ACTF 主干步骤一一对应（原生压缩行记录的摘要 Call 除外）时根据捕获的 Calls 重建窗口，存入
`sft_segments/0001.json`、`0002.json` 等；否则标记 SFT 不可用，保留 raw 和 capture。
纯文本线性样本顶层只有以下字段，图片样本额外包含 `images`：

```json
{"messages": [], "tools": []}
```

它删除 schema version、task/model、usage、metric、step ID、stop reason、时间戳、运行
路径以及 observation metadata。Assistant 固定保存 `role`、`reasoning_content`、
`content` 和 `tool_calls`；tool message 只保存 `role`、`tool_call_id` 和字符串
`content`。

SFT 表达的是从 session 事件重建的逻辑对话，不是每次 provider 请求的快照。它适合
训练，但不能用于逐请求重放或证明某个较早 tool result 在后续模型调用中仍然可见。

压缩分段则从真实捕获的请求上下文开始。额外字段 `target_start_index` 标记首个
受监督的 assistant 消息；其后的 assistant 消息也参与训练，夹在中间的 user/tool
消息仅提供上下文。`info.json` 的分段元数据记录路径、顺序、边界来源和 Call ID。
无法无损表示捕获的输入时，Roller 标记 SFT 不可用并保留 raw/ACTF 证据。
使用 `--no-keep-thinking` 时，分段 prompt 和目标中的 reasoning 都会清空，与线性 SFT 一致。
压缩分段须由理解目标范围的读取器显式使用；原有 run 级 `sft.jsonl` 只含线性记录。
有有效分段时，run 根目录还会生成 `sft_segments.jsonl`，按 request 顺序汇总这些记录。

生成条件：

- ACTF 转换成功；
- 至少有一个 user message 和一个非空 assistant message；
- 每个 tool call 有非空且全局唯一的 ID；
- 每个 tool call 在同一 step 恰好对应一个 tool result；
- 被调用工具存在于顶层 tools schema；
- function arguments 可编码为 JSON object；Codex custom input 保持字符串；
- user content 与 tool result 是字符串、text blocks 或内嵌 base64 字节的 image blocks。

Codex 保留原始 Responses 工具定义、namespace 和 custom grammar。其他 harness 的 function
定义继续统一为嵌套 function schema。user message 或 tool result 中的 image 会导出为 `<image>` 占位符加顶层 `images` data-URI 列表，对齐
约定见 [SFT 数据格式](/roller/traces/sft-format/)。其余无法无损导出的内容仍会令 SFT 转换失败，包括 audio
等未知 block 类型、不支持的 media type、损坏的 base64，以及只引用路径而没有字节的
image block。Collector 在 `runtime.trajectory_conversion` 中记录
`target: "sft"`、`status: "unavailable"` 和原因，保留采集状态及 raw/ACTF；
汇总跳过该样本，Resume 不为导出失败重新调用模型。Roller 不会静默丢失内容。

完整字段定义见 [SFT 数据格式](/roller/traces/sft-format/)。

### 4.4 `sft.jsonl`：Run 级训练集

Collector 完成所有 request 后，按 request index 读取符合条件的线性
`trace_SFT.json`，并原子、流式写入 run 根目录。压缩分段仍会校验，
并单独写入 `sft_segments.jsonl`，不混入原有线性训练集。

run 汇总把这类样本计入 `sft_segmented`，不计入 `sft_included` 或 `sft_excluded`。

- `status=ok` 的 sample 会被纳入；
- `--resume` 复用的 `status=skipped` sample 原先必须是 `ok`，也会被纳入；
- `error` 和 `timeout` 不会被纳入，即使它们保留了部分 raw/ACTF/SFT；
- 没有成功样本时仍生成空文件；
- User Simulator 的子轨迹不会被纳入。

每行与对应的 sample 级 SFT record 相同，不增加 task ID 或其他 metadata。样本
来源须通过相邻 run/sample `info.json` 和目录位置追溯。

### 4.5 ATIF 导出：`trajectory.json` {#atif-export}

`roller export RUN_DIR` 把每个 sample 的 ACTF 转换为
[ATIF](https://github.com/harbor-framework/harbor/blob/main/rfcs/0001-trajectory-format.md)，
即 [Harbor](https://github.com/harbor-framework/harbor) 读取的 Agent Trajectory
Interchange Format。该命令在已有 run 上执行，读取 `trace_ACTF.json` 和 sample
`info.json`，不修改 run。

```text
<run>/atif/                          # 或 --output 指定的目录
└── <model>/
    └── <index>_<task>/
        ├── trajectory.json
        └── images/                  # 轨迹含图片时存在
```

凡是有 `trace_ACTF.json` 的 sample 都会导出，包括失败和超时的 sample，文档中
记录 sample 的状态。没有 ACTF 的 sample 会列为已跳过。与 `sft.jsonl` 相同，导出
只覆盖 Task Agent，不包含 User Simulator 的子轨迹。

导出的文档声明 `ATIF-v1.7`，各字段的来源如下：

| ATIF 字段 | 来源 |
| --- | --- |
| `session_id` | `<run-name>/<model>/<index>_<task>` |
| `agent.name`、`agent.version`、`agent.model_name` | sample `info.json` 中的 Harness 名称、Harness 版本和模型 |
| `agent.tool_definitions` | ACTF 顶层 `tools` |
| `system` step | ACTF 顶层 `system_prompt` |
| `user` step | ACTF step 的 `user_content`，非空时生成 |
| `agent` step | 同一 ACTF step 的 `assistant_content`，对应 `message`、`reasoning_content` 和 `tool_calls` |
| `observation.results` | ACTF `observation`，`source_call_id` 把每个结果关联到对应的调用 |
| `metrics` | ACTF `metric` 的 `prompt_tokens_len`、`completion_tokens_len` 和缓存读取数；其余 metric 字段写入 `metrics.extra` |
| `final_metrics` | 各 step metrics 的合计，以及 sample `info.json` 中的 `cost_usd` |
| `extra.roller` | task ID、sample index、状态、错误和 bench 得分 |

一个 ACTF step 对应一到两个 ATIF step，因此两份文件的 `step_id` 不同。图片写入
`images/`，以内容哈希命名，并用相对路径引用。既不是文本也不是图片的内容块以其
JSON 文本保留。

ATIF 中没有对应位置的 ACTF 字段，按 ACTF 的字段名保留在同一个工具调用、结果或
step 的 `extra` 对象中，例如工具结果的 `isError` 和 `details`、step 的
`finished_at`。ATIF 只允许结果引用本 step 内的调用；对应调用在其他 step 的结果
没有 `source_call_id`，其 `toolCallId` 保留在 `extra` 中。

Harbor 可以校验导出的文件，也可以把它加载进 Claude Code 或 Codex 会话：

```bash
python -m harbor.utils.trajectory_validator runs/demo/atif/MODEL/0000_TASK/trajectory.json
harbor run -p TASK_DIR -a claude-code -m MODEL --load-trajectory runs/demo/atif/MODEL/0000_TASK/trajectory.json
```

## 5. 诊断与辅助文件

### 5.1 Run `lock.json`

`lock.json` 在采集前生成，用于保证一个 run 内不会混合不同解析配置的样本。它固定 request
顺序、Task Bundle digest、模型/Harness 配置、镜像 ID，以及 thinking、wire/cache trace
等会影响轨迹含义的选项。Resume 时逐字段比较；不一致会打印有限的差异路径并在启动
Harness 前停止。

锁不会保存 credential：敏感 key 的值替换为 `<redacted>`；URL 的 userinfo 和 fragment
被移除，敏感 query value 被替换，`api-version` 等非敏感 query 则保留参与比较。
credential 或 pass-through env 的值变化不会导致锁失配；若它们会改变实际模型行为，应
另建 run。配置对象直接比较，task/input/context 则复用 Task Bundle 已有的 digest。

### 5.2 Run `info.json`

CLI 在正式采集前写入初始 run 信息；Collector 在首条结果、之后每累计 25 条结果时更新，
若两次完成事件相隔至少 30 秒，也会立即更新，并在中断和收尾阶段强制 checkpoint。它
保存：

- Roller 版本和采集配置；
- 当前 `state`：`initializing`、`running`、`finalizing`、`finished`、`interrupted` 或
  `finalization_error`；
- `total/processed/pending` 实时进度；
- task/model request 数量；
- `ok`、`error`、`timeout`、`skipped` 汇总；
- token、cache、cost、请求数汇总；
- 每个 sample 的状态、错误、路径与 usage。

可捕获的中断（如 `Ctrl-C`）会立即取消仍在排队的 sample，仅等待正在执行的 sample 正常收尾
（回收 trace、清理容器），然后写入 `state=interrupted`，并尝试用已完成 sample 生成一份部分
`sft.jsonl`。`SIGKILL`、断电或宿主机故障无法执行最后一次写入，但原子写和周期 checkpoint
可以保证 `info.json` 是上一个完整快照；Viewer 还会扫描已 finalize 的 sample。

### 5.3 Sample `info.json`

每个完成 finalize 的 sample 都会写入，包括失败 sample。它保存 task/model、Harness、
最终状态、错误、attempt 历史、usage、耗时、raw/ACTF/SFT 相对路径、输出回收信息、
runtime 和输入 provenance。训练文件不包含的 metadata 保存在此文件中。

OpenClaw session 有时会用 `api=cli` 再记录一次已交付的回复，但真正的 CLI backend 回复
也使用该标记。Roller 不会仅凭该标记删除消息：只有在同一轮、与最新 provider 回复
的 provider/model 相同，且匹配到已记录用量时，才去重 token 和 request count。
最终文本与已交付文本一致时省略重复消息；gap-fill 的新文本仍进入 ACTF/SFT，但不重复
计入 step metric。匹配到的 gap-fill 会更新已交付文本，重复投递不再增加消息或用量。

独立、结构化、失败或跨来源的 CLI 回复会保留原文和用量，并暂停投递匹配，
直到下一条 provider 回复。它们不清空 provider 记账历史。只有 user、session、compaction
事件清空整轮历史；不推断旧来源的迟到投递。计数同时兼容 `input_tokens/output_tokens`，
原生 `input/output` 字段存在时优先使用，非法原生值不会被别名掩盖。

OpenClaw 2026.7.1 的 CLI 累计报告可同时包含四项 token 分量的整轮累加值，以及最后一次
调用的 `totalTokens`（上下文用量）。匹配整轮报告时，四项分量必须逐项一致；total 只接受
已记录的整轮总和或最后一次调用的正值。Roller 保留 provider 调用的统计，不会重复累加
该上下文 total。最后一次同源调用失败时，CLI 兜底仍独立计数；若随后 provider 重试成功，整轮
匹配会包含先前失败调用已经报告的有效 usage 和费用。

`cost_usd` 按匹配的单次调用或截至当时的整轮调用补记差额，不把费用镜像当作新收费。
例如 provider 未报费用，CLI 连续两次报告同一调用花费 `$0.05`，最终仍只记 `$0.05`；
先收到单次费用、再收到包含它的整轮费用，也不会重复累加。没有 token 字段、只有费用的
CLI 镜像，只有在最终文本和来源匹配时才按最近一次调用补记。相互矛盾的费用报告保留已知
较高值，不执行退款；这是 session 中报告的费用，不是服务端账单核对结果。

这些处理不改写 raw。升级后重新解析保留的 raw 可以得到新统计，但 resume 不会重算已有
`info.json` 中缓存的 usage。

### 5.4 `cache_trace.jsonl`

OpenClaw 的 `diagnostics.cacheTrace` 记录每次 LLM call 组装后的 system prompt。默认启用，
Roller 复制后按敏感 key 递归脱敏，再用它填充 ACTF 顶层 `system_prompt`。

- 默认 `--wire-trace actf`：用于转换后删除；
- `--wire-trace full`：最终保留；
- `--no-cache-trace`：不创建，ACTF/SFT 的 system content 为 `""`。

ACTF 顶层只使用首个 `stream:context.system`，没有该阶段时回退到首个
`session:loaded.system`。若 system prompt 随调用变化，只有 full 模式保留的原始
cache trace 能展示每次差异；ACTF 顶层值不能代表所有 step。

脱敏基于 JSON key，不会扫描 system prompt 自由文本中的秘密；该文件和下游 ACTF/SFT
仍应按敏感数据管理。

### 5.5 `wire_trace.jsonl` {#wire-trace-jsonl}

本地反向代理在请求发往模型服务前记录 wire 数据：

- OpenClaw `actf` 只记录 model、非消息参数、消息数量以及首次非空 tools schema，不记录
  完整 messages/input；该临时文件在转换后删除；
- Codex `actf` 在配置 API 地址时通过 HTTP 捕获原始工具定义，保留 `tools_capture.jsonl`，删除临时 wire 文件；
- Claude Code `actf` 在显式 API base 时临时记录首个 Anthropic system/tools 及非消息
  参数，转换后删除；
- `full` 保存每次完整请求体并最终保留；
- HTTP Authorization 等 header 不写入文件，但完整 request body 可能包含 system prompt、
  用户数据、tool result 和历史 reasoning；`full` 不对这些自由内容做自动脱敏。

对可解析的 JSON 请求，代理先执行当前 rollout 需要的语义改写，再记录并转发同一个 body。
OpenClaw `--no-keep-thinking` 会先剥离历史 reasoning。Codex full wire 中的
`input[].type="additional_tools"` 表示 programmatic tool namespace，Roller 不改写它。
Full wire 展示实际转发给模型 API 的语义 JSON，而不是处理前的 Harness 请求。

Claude Code full wire 保存 Anthropic `/v1/messages` request 的 `system`、`messages`、
`tools`、thinking/output config 与 sampling 参数。Roller 不改写 Claude Code 的消息历史。
Claude Code 2.1.222 追加的 transport-only `beta=true` query 和 `anthropic-beta` header
会在转发前移除。Full wire 用 `path` 保留原始目标、用 `upstream_path` 记录实际目标，
`dropped_request_headers` 仅记录被移除的 header 名。

边界与限制：

- 这是请求侧 JSON 记录，不是 TCP/HTTP 字节级抓包；JSON 空白、字段顺序等序列化细节
  不属于审计语义；
- 不记录请求 headers、上游响应 body 或流式 chunk；响应内容仍应从 session raw/ACTF
  查看，但它已经是 Harness 解析后的事件；
- 只能证明 Roller 代理转发了什么，不能证明模型服务内部是否再次截断、tokenize、改写
  或路由；
- wire 写入是 best effort：单条记录失败不会阻断模型调用。强审计场景应检查 `seq` 是否
  连续，并结合 sample usage/request count 与运行日志确认完整性；
- 多轮请求会重复历史，文件体积接近 O(N²)，只适合审计和调试。

### 5.6 如何审计 context 压缩或改写

1. 使用 `--wire-trace full` 运行最小可复现 task；OpenClaw 同时保留默认
   `--cache-trace`。不得用默认 `actf` 代替 full，因为它不保存 messages/input。
2. 按 `wire_trace.jsonl` 的 `seq` 顺序比较各条 `body.messages`（Chat Completions 或
   Anthropic Messages）或 `body.input`（Responses），同时检查 `body.system`、
   `body.tools` 与采样参数。
3. 将差异与 `trace.jsonl` 的 session 事件对照。不应期望逐行一一对应：一次 Agent turn 可以
   包含多次模型请求，每次 wire body 又会重复当时保留的历史。
4. OpenClaw 可查看 `cache_trace.jsonl` 中每个 `stream:context` 的 system prompt；Codex 则
   比较 full wire 各请求的 `instructions`、developer input 和 environment context；
   Claude Code 比较 `system/messages/tools` 及 thinking/output config。
5. 若 OpenClaw 使用 `--no-keep-thinking`，以 full wire 为模型可见历史的依据；session raw
   保留的 reasoning 只用于诊断，不代表它被送入了后续请求。Codex 和 Claude Code
   的该参数只控制导出。

审计完成后应单独保护或删除 cache/wire 文件。它们可能包含重复的用户输入、system
prompt、tool result、reasoning、文件内容和运行时注入信息。

### 5.7 `results/`

只有 task 输出目录中存在普通文件或目录时才创建。Roller：

- 复制所有安全的普通文件并保留相对路径；
- 在 sample `info.json` 中记录 path、大小、MIME 和 SHA-256；
- 拒绝符号链接和特殊文件；
- 即使存在不安全文件，安全文件仍会复制，但 sample 最终状态变为 `error`；
- `--collect-path` 的兼容输出放入 `results/legacy/`。

`results/` 是 Agent 交付物，不属于对话训练数据，也不会写入 `sft.jsonl`。

### 5.8 `conversation.json`

仅 User Simulator task 生成。它保存双方可见的 user/assistant 轮次、终止原因、待发送但
未交付的 instruction、参与模型和时间，不复制双方隐藏 reasoning、tool call 或 tool
result。如需训练或分析任一参与方，应使用各自的 raw/ACTF/SFT。

## 6. 参数组合如何影响轨迹

### 6.1 Wire trace

| Harness / 模式 | 代理要求 | ACTF tools | 最终辅助文件 | 适用场景 |
| --- | --- | --- | --- | --- |
| OpenClaw `actf`（默认） | 有可代理 `baseUrl` 时启用；缺少时降级 | 捕获成功时为完整 schema，否则 `null` | 不保留 cache/wire | 常规批量采集 |
| Codex `actf`（默认） | 配置 API 地址、HTTP、host 网络 | 原始 Responses 定义，不推导 | `tools_capture.jsonl` | 常规批量采集 |
| Claude Code `actf`（默认） | 显式 `--api-base` 时启动 | 捕获 Anthropic `input_schema`；无代理时从 native 推导 | 不保留 wire | 常规批量采集 |
| OpenClaw `full` | provider 必须有绝对 `baseUrl` | 完整 schema | `wire_trace`，启用 cache 时还有 `cache_trace` | 请求级审计 |
| Codex `full` | API 地址、HTTP、host 网络 | 原始 Responses 定义 | `wire_trace`、`tools_capture.jsonl` | 请求级审计 |
| Claude Code `full` | 必须显式 `--api-base --network host` | 捕获 Anthropic `input_schema` | `wire_trace` | 请求级审计 |
| `off` | 不为记录启动代理 | OpenClaw/Codex 为 `null`；Claude Code 从 native 推导 | 不保留 | 最小诊断关闭模式 |

OpenClaw 的 `off` 或 `actf` 降级后，若轨迹包含工具调用，SFT 校验会因缺少工具 schema
失败；没有工具调用时，SFT 的 `tools` 为 `[]`。Claude Code 保留原有 native schema 回退。
Codex 不推导 schema：未捕获（包括 `off`、WebSocket、未配置 API 地址）、工具定义变化或
programmatic `additional_tools` 都会使 SFT 不可用，详见 [Codex 工具捕获](/roller/harnesses/codex-configuration/#9-轨迹与请求记录)。

### 6.2 Thinking

| 参数 | 当前回复 | 后续请求历史 | ACTF | SFT | raw |
| --- | --- | --- | --- | --- | --- |
| `--keep-thinking`（默认） | 按后端返回内容原样接收 | 保留 Harness 正常历史 | 保存可见 reasoning | 从 ACTF 保存 | 保留原始事件 |
| `--no-keep-thinking` | 当前轮仍可产生 reasoning | OpenClaw 剥离后续 wire history；Codex/Claude Code 不改写 resume/continue | reasoning 置空 | reasoning 置空 | 仍保留原始事件 |

`--thinking LEVEL` 设置 Harness/模型请求的推理档位；能否保存 reasoning 文本取决于服务的返回内容。GPT 原生
effort、开源模型 profile 和 OpenClaw 镜像限制见
[Thinking 配置](/roller/harnesses/openclaw-configuration/#6-thinking-配置)；Claude Code
映射见 [Thinking 配置](/roller/harnesses/claude-code-configuration/#6-thinking-配置)。
后端只报告 reasoning token、却不返回 reasoning summary/content 时，ACTF/SFT 没有可保存
的 `reasoning_content`。GPT 的压缩 summary 会原样进入该字段，encrypted reasoning
不会进入 SFT。

模型类别对应的推荐路径：

- GPT reasoning 系列：保存服务返回的可见 summary/content，不扩写 summary。
- Claude 系列：保存服务返回的可见 thinking 或 summary。
- 返回明文 reasoning 的 Qwen、GLM 等开源模型：保持默认 `--keep-thinking`，明文 reasoning 直接进入
  ACTF/SFT `reasoning_content`。

显式请求 reasoning 档位时，样本 `info.json` 会记录
`runtime.thinking_audit`。该审计只统计 ACTF 中实际保留的可见 reasoning。若请求 `off`
后仍返回可见 reasoning，状态为 `mismatch`，Roller 同时记录 runtime warning，但不会删除或
修改模型返回的文本。使用 `--no-keep-thinking` 时状态为 `not_observable`：导出字段为空不代表
模型未执行隐藏推理。

`mismatch` 样本保持实际执行状态和单样本 SFT，便于检查；同时记录
`runtime.sft_eligibility = {"eligible": false, "reason": "thinking_effort_mismatch"}`，
不纳入训练汇总 `sft.jsonl`，Resume 时同样排除。该规则不把 `no_visible_reasoning` 当作
关闭推理的证明。失败或超时的样本保留已有 raw/ACTF，但不导出单样本 SFT。

归档前还会记录以下审计（主 Agent 与 user simulator 均适用）：

- `runtime.wire_effort_audit`：逐条核对实际请求中的 effort/启停字段，包括重试。
  明确冲突为 `mismatch`；参数省略、只有预算或未知协议为 `unverified`；无可读请求为
  `not_observable`。默认 `actf` 模式若没有 wire 请求，可读取 Pi、DeepSeek、Hermes、
  OpenCode 的原生请求快照；`source` 标明证据来源。删除临时文件后审计仍保存在 info 中。
  `matched` 只证明客户端出站参数匹配，不证明服务实际遵从。
- `runtime.completion_audit`：最后一步明确以 `length`/`max_tokens`/`max_output_tokens`
  结束，或没有文本和工具调用时，记录 `incomplete`。未知结束原因不推断为截断；
  `not_flagged` 不等于任务通过。最后一次已捕获响应若明确为 `incomplete` 或达到 token
  上限，即使 ACTF 写为 `stop` 也判为截断；中途截断后请求成功恢复则不据此排除。
  覆盖 ACTF 判定时，原始结果保存在 `actf_completion_audit`。
- 明确 wire 冲突和上述不完整轨迹会记录 `sft_eligibility.eligible=false`，排除主 Agent
  的训练汇总。参数省略不会自动被当成匹配或据此过滤；可转换的单样本 SFT 保留用于诊断。
  user simulator 的失败/超时归档同样不生成 SFT；其成功轨迹保留审计及诊断 SFT，不混入
  主 Agent 的汇总。Resume 不会为旧样本自动补算此前未记录的新审计。

若严格转换没有生成 ACTF，Pi/OpenClaw 可从已完成的原生 assistant 消息中记录
`completion_audit.source=native`（忽略历史 context 和未完成 delta）；其他未知 schema
仍为不可观测，不强行放宽转换器或导出失败 SFT。

代理还从 JSON/SSE 响应中提取模型名和结束原因，记录为 wire `response_metadata` 事件，
通过 `request_seq` 与请求关联，不额外保存响应正文。归档后的 `runtime.model_identity_audit`
包含每次 wire 请求的 `requested_model`、`response_models` 和 `finish_reasons`。
名称不一致记为 `name_mismatch` 并告警，但可能是合法别名，故不会自动排除训练集。
这只能核对响应声明的名字，不能证明中转实际路由到哪个模型。压缩/未知协议、缺失字段、
超过采集大小限制等情况不声称匹配；默认 actf 模式清理 wire 后仍保留 runtime 审计。

终端完成提示与 run `info.json` 的 `summary.training` 会汇总：SFT 纳入/排除数量、
thinking 冲突样本数、wire 无法确认/不可观测样本数。统计单位是已处理的主 Agent 样本，
不是 HTTP 请求或 simulator；Resume 复用的样本也计入。一个样本可能同时属于 reasoning 冲突和
wire 无法确认，分类不可直接相加。旧样本缺少审计不表示匹配。该汇总与实际 SFT 导出
共用排除规则，不新增 strict 开关、不改变执行状态或 CLI 退出码，也不代表任务 grader 通过。

`--no-keep-thinking` 即使配合 `--wire-trace off`，也必须启动代理来剥离请求历史，因此
OpenClaw 仍要求 `--model-config` 中存在可代理 `baseUrl`；Codex 和 Claude Code 不做
该 history 剥离。

### 6.3 Cache trace（OpenClaw）

| 参数 | ACTF/SFT system | `cache_trace.jsonl` |
| --- | --- | --- |
| `--cache-trace`（默认） | 使用捕获到的首个组装后 system prompt | 仅 full 模式最终保留 |
| `--no-cache-trace` | `""` | 不创建 |

若训练需要保留 Agent 首次捕获到的组装后 system prompt，不应关闭 cache trace。如需
复现每一次模型调用的 context，仅有 ACTF/SFT 不足，须另外保存 full cache/wire。

## 7. 成功、失败、重试与 Resume

### 7.1 成功保证

状态为 `ok` 的普通 sample 通常存在：

- `trace.jsonl`；
- `trace_ACTF.json`；
- `trace_SFT.json`；
- `info.json`。

User Simulator sample 还保证根 `conversation.json` 和 Simulator 自己的 raw/ACTF/SFT。
`results/`、cache trace 和 wire trace 始终是条件产物，不属于成功必备文件。若原生附件或
多模态事件无法无损投影，评测结果仍可保持成功；`runtime.trajectory_conversion` 会记录
ACTF 或 SFT 哪一层不可用，run 级 `sft.jsonl` 会跳过该样本。

### 7.2 失败 sample

对于 `error` 或 `timeout` sample，结束阶段仍会尝试回收 raw、system prompt、tools 和
安全输出，并将其转换为 ACTF/SFT。保留下来的完整或部分轨迹可用于诊断，但不会进入
run 级 `sft.jsonl`。

以下情况会将原本成功的 Harness 结果改为 `error`：

- 找不到 raw session trace；
- 缺少必需轨迹且没有显式 conversion downgrade；
- task 输出目录复制失败；
- 输出中发现符号链接或特殊文件；
- User Simulator 任一参与方失败或其轨迹转换失败。

### 7.3 Retry

`--retries N` 最多额外执行 N 次完整 rollout。每次 attempt 开始前会清理上一次的运行期
raw/cache/wire 文件，避免混合不同 attempt。Sample `info.json.attempts` 保留每次状态和
耗时，canonical raw/ACTF/SFT 对应最终 attempt。最终状态不是 `ok` 时，sample 还会保留每次
attempt 的进程日志 `rollout/*.attempt-<N>.log`（例如 OpenClaw 的 `gateway.attempt-1.log`、
`agent.attempt-1.log`），供排查使用。

### 7.4 Resume

Resume 先要求当前 run lock 与旧 `lock.json` 一致；task/model 顺序、Task Bundle、模型配置、
Docker image ID、timeout 或轨迹语义选项变化时直接停止，避免不同采集条件混批。旧 run
没有锁时会写入当前锁并将旧 sample 全部重新执行一次；持久迁移标记会一直禁止复用，直到
整次重采和 run 级 SFT 汇总成功，即使进程中途被强制终止，遗留 sample 也不会被视为可信。

锁一致后，`--resume` 只复用旧状态为 `ok` 且满足以下条件的 sample：

- sample identity 与当前 request 一致；
- raw 含有效 message，ACTF schema/连续 step 合法；
- SFT 与 ACTF 重新生成的 canonical 投影完全一致；
- `full` 模式要求 wire trace 存在，启用 cache trace 时也要求 cache trace 存在；
- 当前 Task Bundle digest 与旧 provenance 一致；
- Context 没有使用 `capture=none`；
- 输出文件路径安全、文件存在且大小未改变；
- User Simulator task 还具有合法的 `conversation.json`、participant info 和 Simulator
  raw/ACTF/SFT。

复用结果在本次 run 中标为 `skipped`，仍会写入新的 `sft.jsonl`。缺失任一必需文件或
轨迹校验不通过时，会重新执行整个 sample。输出清单保存的 SHA-256 不会在 Resume 时
重新计算，以免常规断点恢复时再次读取大型产物；如需内容级审计，可单独核对该 hash。

## 8. 推荐配置

### 8.1 批量生成文本/工具 SFT

```bash
roller collect \
  --tasks tasks.jsonl \
  --model provider/model \
  --model-config models.json \
  --thinking high \
  --wire-trace actf \
  --output runs
```

保留默认 `--cache-trace` 和 `--keep-thinking`。该配置会产出完整 ACTF/SFT，同时删除体积
较大的诊断中间层。

### 8.2 调试 reasoning、compaction 或请求历史

```bash
roller collect \
  --tasks tasks.jsonl \
  --model provider/model \
  --model-config models.json \
  --thinking high \
  --wire-trace full \
  --output debug-runs
```

该配置用于确认 OpenClaw 经过 context 组装、压缩、裁剪和 provider 适配后，实际交给
模型 API 的 messages/input。调试结束后优先保留 raw/ACTF/SFT；确认不再需要请求级审计
时删除 full cache/wire，减少重复数据和敏感信息暴露。

## 9. 发布训练集前检查

建议至少检查：

1. Run `info.json.summary.failed` 为 0，或已明确排除失败任务；
2. `sft.jsonl` 行数等于符合条件的线性记录数；压缩分段单独核对；
3. 每行有 `messages` 和 `tools`；图片记录增加 `images`。
   只有独立的压缩分段增加 `target_start_index`；
4. assistant 都有 `reasoning_content`、`content`、`tool_calls`；
5. tool call ID 与 tool message 一一对应；
6. tools schema 与训练时 chat template 的工具格式兼容；
7. system prompt、用户内容、tool result、reasoning 和 Agent 输出已完成隐私审查；
8. 若使用了 `--no-keep-thinking`，确认 raw/full 诊断层不会被误当成已去除 thinking 的
   发布数据；
9. 若数据集声明可复现模型可见 context，确认采集使用 `--wire-trace full`、wire `seq`
   连续且请求数符合预期；不得用 ACTF/SFT 代替逐请求证据；

Hermes raw 使用 `roller.hermes-events/v1`：记录完整请求快照、模型响应/usage 和压缩前的工具消息，不生成 `cache_trace.jsonl`。详见 [Hermes 轨迹](/roller/harnesses/hermes-configuration/)。

OpenCode raw 使用 `roller.opencode-events/v1`：记录 provider 序列化请求、原生 message/part 更新及 session 导出，按原生 ID 合并为 ACTF/SFT，不生成 `cache_trace.jsonl`。详见 [OpenCode 轨迹](/roller/harnesses/opencode-configuration/)。

DeepSeek raw 使用 `roller.deepseek-events/v1`，保存 SDK 原生通知和序列化请求，不生成 OpenClaw cache trace。详见 [DeepSeek Harness](/roller/harnesses/deepseek-configuration/)。

Pi raw 使用 `roller.pi-events/v1`，记录原生事件、context、实际请求与轮次边界；不要求 OpenClaw cache trace。详见 [Pi Agent](/roller/harnesses/pi-configuration/)。
