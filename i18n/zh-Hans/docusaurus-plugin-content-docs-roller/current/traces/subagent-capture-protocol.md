---
title: "Subagent 采集协议 v1"
---

# Subagent 采集协议 v1

本协议的目标是使不同 Harness 使用同一套调用、参与者、关系和完整性规则。Roller
记录执行事实，本协议不定义训练损失或奖励。

## 开启

`roller collect ... --capture-calls` 目前支持七个 Harness：Claude Code、
OpenCode、Codex、Hermes、OpenClaw、Pi 和 DeepSeek。原有的
`--claude-capture-calls` 仍保留。该选项要求显式指定 API base、使用 host 网络并开启 wire trace。
默认不开启；OpenCode 仅在开启此选项时允许原生 `task` 子任务工具。
采集模式写入 run 配置，Resume 时不能混用开启前后采集的 sample。

## 三个对象

| 对象 | 协议 | 含义 |
|---|---|---|
| Participant | manifest 的 `participants` | 一个原生执行者；一个执行者可以有多次调用 |
| Call | `roller.call/v1` | 一次实际 HTTP 模型请求及响应 |
| Relation | `roller.relation/v1` | 有证据支持的启动、结果交付和上下文关联 |

`participant_id` 是不透明的引用标识。消费者通过 `role` 判断 root/child，
不得通过标识前缀解释角色。参与者身份在一次采集 attempt 内有效；跨 sample 或
attempt 引用时必须附带 sample/manifest 路径。`call_id` 和新生成的
`relation_id` 包含采集实例的随机作用域，以避免不同 sample 或不同重试之间的编号冲突。

Call 的 `context` 保留实际发送的完整请求体；`output` 是重组后的 provider
响应。`protocol` 区分 `anthropic-messages`、`openai-chat-completions`
以及 `openai-responses`，协议按实际 HTTP 请求端点识别，各协议保持各自的消息格式。原始响应文件同样保留，请求不依赖原生日志重建。
Roller 不保存 HTTP 认证头，也不使用父 Agent 的配置覆盖子 Agent 的模型和工具配置。

| 状态 | 回答的问题 |
|---|---|
| `execution_status` | 调用/任务是否执行完成？ |
| `response_capture_status` | 响应是否完整落盘？ |
| `identity_status` | 能否确定属于哪个参与者？ |
| `capture_status` | 当前记录是否完整？ |
| `export_status` | 这次调用是否能进入逐调用导出？ |

仅当模型响应正常结束、输入响应完整、身份明确、模型匹配且没有采集错误时，
Call 才可导出。Chat Completions 仅有 tool_calls 结束标记、没有实际工具调用
ID/name 的异常响应也会标记为 partial 并禁止导出。未归属、失败、中断的请求仍保留在 attempt 的调用和原始
证据中。整体采集状态可以是 partial，同时仍包含可导出的完整调用。

## 关系语义

| type | 需要的证据 |
|---|---|
| `spawn` | 原生工具调用及子任务身份 |
| `result_delivered` | 父任务收到了子任务的最终工具结果 |
| `child_completed` / `child_failed` | 原生子任务完成/失败证据 |
| `result_in_context` | 后续父模型的实际输入里存在相同工具调用 ID 的结果 |
| `launch_acknowledged` | 后台子任务启动回执 |
| `launch_ack_in_context` | 启动回执进入父模型实际输入 |

每条关系保留原生文件及事件/part ID 引用。父模型调用通过响应 message ID
或其输出中的工具调用 ID 关联；无法唯一关联时标记为 unknown。OpenClaw 的
Responses SDK 使用 `call_id|item_id` 作为原生工具 ID；关系保留原生 ID，并用
`model_tool_ref` 同时核对 HTTP 输出中的 call_id 和 item_id，不能只匹配其中一个。结果进入多个
后续调用时，分别记录关联。后台启动回执不得视为任务完成。
通知方式的结果还必须绑定原生 announcement run ID（OpenClaw）或后续响应 ID
（Claude Code），并核对实际请求中的通知文本；仅出现相同文本不足以证明接收。
Call 可选的 `native_identity.run_id` 保存本地原生调用标识；关联头在转发前移除。

## 公共层与适配层

适配层只返回 `capture_protocol.NativeCapture`：参与者、身份映射、原生关系、
可观测输出 ID/数量和能力声明。公共 `finalize_capture` 负责关联 HTTP 调用、
判断状态、生成上下文关系、写文件和 manifest。`model_protocols` 负责
Anthropic/Chat Completions/Responses 响应解码和工具引用提取。

| Harness | 身份证据 | 原生输出覆盖检查 |
|---|---|---|
| Claude Code | provider 响应 ID 与原生日志 message ID 匹配 | 逐 message ID |
| OpenCode | `chat.headers` 提供的 session ID 与原生日志匹配 | 各 session 完成的 assistant 数量 |
| Codex | 每次 HTTP 请求原生 `thread-id` 与 rollout session_meta 匹配 | token_usage 更新数量；不是逐响应 ID |
| Hermes | 执行实例自己的 session ID 与原生日志匹配 | provider 响应 ID |
| OpenClaw | 原生 stream wrapper 的 session ID 与 session 文件匹配 | stream context 数量 |
| Pi | SDK session ID | 完成的 assistant 数量 |
| DeepSeek | runner session ID | 完成的 assistant 数量 |

OpenCode 的关联头仅在本地代理中使用，代理在向模型服务转发前将其移除。各请求携带
自己的 session ID，因此并行请求不依赖“当前 session”全局变量。Codex 的原生
`thread-id` 仍转发给模型服务，仅移除 Roller 新增的 `x-roller-*` 身份头。原生数量
检查比逐 ID 检查弱，manifest 的 `capabilities.native_output_coverage` 明确
记录这一差别；Roller 不根据时间、文本或请求次序推测身份。

主 ACTF/SFT 只转换主参与者的消息和请求配置；子任务内部消息留在自己的
Call 中。`calls.jsonl` 是逐调用的协议数据，不能直接用作主轨迹 SFT。

旧版 Claude Code sample 可能将子代理步骤混入主 ACTF/SFT。新版 Resume 会在执行模型前
识别并拒绝复用这类 sample，并给出明确错误，以避免静默重新执行或沿用错误的主 SFT。
可使用新的 run 目录重新采集；若需保留旧执行结果，应先在原始轨迹的副本上
离线重新投影并校验，不得直接修改旧 SFT 后继续 Resume。

## 文件与边界

每个 `capture/attempt-NNNN/` 默认仅包含 `manifest.json`、`calls.jsonl` 和
`relations.jsonl`。`--capture-debug on-error`（默认）仅在执行失败、采集不完整、
模型调用失败或子任务失败时保留 `raw/`；`full` 始终保留，`off` 始终清理。原生日志、原始响应、采集事件及来源映射集中保存在
`raw/`；事件的 `body_ref` 引用 `calls.jsonl` 中对应调用的 `context`，不重复保存
请求正文。参与者通过 manifest 的 `call_ids` 和 Call 的 `participant_id` 关联，
不再另存 `participants/*/calls.jsonl` 副本。

manifest 使用 `roller.capture/v1`，新布局以 `storage_layout: compact/v2` 标识，
并记录 `debug_retention` 与 `raw_retained`。可选 `lifecycle` 包含 `status`
（complete/pending/unknown/unsupported）和 `pending_participant_ids`：子任务执行结束
与结果交付分别确认，状态为未知或未完成时，不得将整体标记为 complete。校验兼容没有 lifecycle 的旧记录。
完整性检查在清理前完成；
清理后调用的 `response_path` 为 null，关系证据的 source 标明原始来源但
retained=false，以避免留下失效的文件引用。采集状态不因调试材料清理而降级。
精简模式下，Resume 校验正式文件哈希、调用归属和关系引用，无法重新解析原始响应。
读取和完整性校验兼容旧布局及 compact/v1；采集关闭前仍使用工作文件，发布时整理为新布局。
可使用 `PYTHONPATH=src python scripts/view_capture.py /path/to/attempt-0001`
查看按代理展开的调用树，该脚本不生成额外的数据副本。
Roller 在关闭 recorder 后发布文件哈希；文件缺失、被修改或引用错误将阻止 Resume
复用。即使关闭辅助日志保留，也不会清理 capture 正式证据。

## 七个 Harness 的执行边界

- Claude Code：固定版本 `-p` 原生循环会继续处理后台完成通知；Roller 不追加用户消息驱动执行。
  通过通知的 task/tool ID 和后续响应 ID 确认完成与结果进入上下文。自动通知在主 ACTF/SFT
  中仍是 user 输入，保留实际请求中的系统通知包装，不视为真人发言或子代理 assistant 输出。
  已验证一次 root → child → grandchild 前台委派；嵌套返回缺失 toolUseResult 时，
  必须核对原生元数据 ID、启动事件 UUID 与已采集的 child 身份。恢复同一 child 的新委派
  按新工具 ID 判断是否结束，不能复用此前完成状态。
- OpenCode：已有原生子任务适配；固定 bundled 版本的 task schema 没有 background 参数。
  不存在的后台调用场景不计为通过。当前原生 subagent_depth 默认为 1；
  子代理可以看到 task，但创建孙代理会被原生深度限制拒绝。被拒绝的轨迹予以保留，不虚构孙代理身份。
  若其他原生证据显示存在后台执行，由于目前没有新增 drain，采集将保持 partial。
- Codex：保留 Responses 原生 output（包括加密 reasoning）及所有线程 rollout；
  spawn 返回的是启动回执，wait 返回完成结果。多轮执行通过已确认的根线程 ID resume，
  以防止 `resume --last` 误选最近的子线程。根 ACTF 的工具快照仅取自根线程，完整快照仍作为证据保存。
  `tool_search_output` 动态加载的定义保存在实际 Call.context 和工具快照中；此类轨迹的
  主 SFT 暂不导出，以避免丢失加载顺序或虚构静态工具列表。逐调用导出不受此边界影响。
- Hermes：在原生 delegate_task 创建子实例时记录父 session ID 和委派工具 ID；
  一个批量工具调用可以对应多个子实例。使用原生的有限查询 session 设置等待子实例返回。
- OpenClaw：固定镜像内的原生 stream wrapper 记录各 session 的实际上下文；
  Roller 等待原生 registry 中的子任务及完成通知清理结束后，再收集文件。启动回执与完成通知分开处理；
  完成通知须同时匹配原生 run ID 和父模型实际输入，才会建立 result_in_context。
  registry 缺失或身份不匹配时记为 unknown；子任务已结束但通知仍为 pending 时记为 partial。
  drain 失败时记录采集错误，并保留已成功的主 turn 状态。原生 session 可能不保存完整通知输入；
  ACTF 使用同一 announcement run 的 stream:context、session:after 和 provider 响应 ID
  补全实际输入，无法绑定时禁止导出线性 SFT。工具 ID 规范化映射来自
  原生 resolver 的实际输出。支持按实际请求端点解码 Chat Completions、Responses 或 Messages，
  实测结果分别注明模型与协议。固定镜像的 hook 不匹配时会报错。
- Pi / DeepSeek：统一记录实际模型 I/O、根参与者和完整性。Roller 内置的 Pi 配置禁用
  扩展，DeepSeek 使用 sdk-minimal profile；二者没有原生委派工具。manifest 明确声明
  `not_available_in_bundled_profile`，子任务测试为 not_applicable，不计为通过。

共同验收覆盖单子任务、并行、相同 prompt、文件共享、工具错误、不同工具配置和普通对话。
跨进程恢复、七个 Harness 的全部嵌套/后台组合和 compaction 分段重建仍未完成完整验证。

共享验收入口：`scripts/test_subagents_e2e.py --harness HARNESS ...`（七个 Harness 均可选择）。
测试凭据仅从指定环境变量读取。

OpenCode 原生接口依据：[固定版本的插件 hook 定义](https://github.com/anomalyco/opencode/blob/v1.18.30/packages/plugin/src/index.ts)、
[task 工具元数据](https://github.com/anomalyco/opencode/blob/v1.18.30/packages/opencode/src/tool/task.ts)。
