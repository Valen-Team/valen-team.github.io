---
title: "Thinking 回归检查矩阵"
---

# Thinking 回归检查矩阵

本矩阵用于复核 [issue #51](https://github.com/Valen-Team/Roller/issues/51)
与 PR #64 的能力预检、请求审计、轨迹保存和训练过滤。每个检查项保存
输入配置、实际出站证据、响应证据、ACTF/SFT、过滤原因和判定。
真实服务的结果仅适用于当次 Roller、Harness、网关和模型路由的组合。

## A. 确定性边界检查（无需模型 API）

| 编号 | 输入变化 | 必须断言 | 回归测试 |
|---|---|---|---|
| A1 | Claude Code 同一 base 的根地址、`/v1`、`/v1/messages`，profile 仅支持 low，请求 high | 三种 URL 的 dry-run 均在预检阶段被拒绝 | `test_cli.py` |
| A2 | simulator 选择 off，ACTF 保留可见 reasoning | simulator 归档包含 `thinking_audit=mismatch` 和排除原因；不计入主 Agent 汇总 | `test_conversation.py` |
| A3 | 最终 response 为 incomplete/max_output_tokens，但 ACTF 为 stop；再增加后续成功 response | 首例被排除，恢复例不因先前截断而被排除 | `test_trajectory_audit.py` |
| A4 | Pi、DeepSeek、Hermes、OpenCode 的原生请求指定 high，metadata 请求 low，无 wire trace | 默认 actf 的审计从 native 读取并判为 mismatch，从训练中排除 | `test_trajectory_audit.py` |
| A5 | Codex off、adaptive | dry-run 和运行时使用同一 validator，均拒绝 | `test_cli.py`、`test_codex.py` |
| A6 | Claude Code 逻辑 ultra 映射为传输值 ultracode | metadata 保留两者，审计按逻辑 ultra 判定匹配 | `test_trajectory_audit.py` |
| A7 | wire 记录异常与 response 关联同时出现 | 工具捕获错误仍被记录；正常请求保留 request_seq | `test_wire_trace.py`、`test_codex_tools.py` |

## B. 真实服务矩阵

| 阶段 | Harness | 模型 | Effort | Trace 模式 | sample 数 |
|---|---:|---:|---:|---|---:|
| 连通 smoke | 7 | 1（Qwen） | low | actf | 7 |
| 主矩阵 | 7 | 7 | off、low、high、max | actf（默认路径） | 196 |
| 采集对照 | 7 | 1（Qwen） | off、low、high、max | full | 28 |

每格运行一个确定性工具任务：写入 `outputs/answer.txt` 并读取核验，
最后仅输出约定标记。每格一次，超时 180 秒，Roller retries=0。
四个批次并发、每批次两个 worker。参数门禁拒绝的格子仍计入 196，
但不会发出模型请求。上游 Harness 自身仍可能重试。

逐格记录：

1. Runner 状态、目标文件和最终回答是否都符合标记。
2. 工具调用与结果数量、`toolCallId` 关联是否完整。
3. 请求 effort 的 `matched/mismatch/unverified/not_observable` 和证据来源
   `wire/native`；“没有观测到”不得计为匹配。
4. 可见 reasoning、最终响应完成状态、ACTF 完成状态是否冲突。
5. 单 sample SFT、汇总 `sft.jsonl`、资格排除原因是否一致。
6. 请求与响应模型名是否一致；名称差异仅作记录，不推断真实后端路由。
7. 产物中是否含本轮 API token 明文；报告只记录命中路径，不输出 token。

`PASS` 要求任务、工具、保存、显式请求档位和资格判定同时通过；
`S` 为明确 thinking 冲突，`U` 为参数未验证，`T` 为任务不符，
`D` 为工具或保存缺失，`R` 为不支持的 SFT 表示导致无法转换，
`C` 为完成状态导致排除，`I` 为超时，
`H` 为明确的能力门禁拒绝，`X` 为执行错误。门禁格子保留在报告中，
但不会产生 sample 或模型请求。
严格通过只表示本次可观察链路通过，不能证明模型内部推理档位。

## 执行

将 token 放入权限为 0600 的**仓库外**临时文件；命令行仅引用文件路径：

```bash
python scripts/verify_thinking_matrix.py smoke --api-base <base-url>/v1 --token-file <token-file>
python scripts/verify_thinking_matrix.py full --api-base <base-url>/v1 --token-file <token-file>
python scripts/verify_thinking_matrix.py control --api-base <base-url>/v1 --token-file <token-file>
```

每阶段写入被 Git 忽略的 `runs/issue51-review-matrix-20260928/`：
`*-manifest.json`、逐批日志、`*-results.json` 和 Roller 原始产物。
驱动日志会将 token 替换为 `[REDACTED]`；最终报告额外扫描产物。
复测完成后删除临时凭据文件。若 smoke 未形成可审计的 sample，
先诊断配置或服务故障，再运行 196 格主矩阵。
