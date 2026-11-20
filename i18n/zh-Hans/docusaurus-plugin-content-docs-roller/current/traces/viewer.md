---
title: "轨迹可视化 Viewer"
---

# 轨迹可视化 Viewer

Roller 内置只读 Web Viewer，无需安装额外依赖。Viewer 按 task 分组展示一个 run 中的
模型 rollout、reasoning、工具调用、工具结果和最终回复。Viewer 直接读取现有 Roller
产物，不生成新的轨迹副本，也不会修改 `trace_SFT.json` 或 `sft.jsonl`。

## 1. 启动

将命令参数指向包含 `info.json` 或 `samples/` 的 Roller run 根目录：

```bash
roller view /path/to/runs/my-run
```

Viewer 默认监听 `127.0.0.1:17865`。终端会输出实际 URL 和被锁定的 run 路径：

```text
Roller Viewer: http://127.0.0.1:17865
Run directory: /path/to/runs/my-run
```

未指定 `--port` 时，若 17865 已被占用（例如采集过程中 Agent 在共享的宿主机网络上启动了服务），
Viewer 会先输出一行提示，再改用一个空闲端口，访问时以终端输出的 URL 为准。

也可显式指定端口。显式指定的端口被占用时，Viewer 直接报错，不会自动更换端口：

```bash
roller view /path/to/runs/my-run --port 9000
```

Viewer 进程只负责读取文件并提供页面，不会启动 Docker、OpenClaw 或模型服务。按
`Ctrl-C` 停止。

## 2. 远程机器访问

远程访问时，应保持 Viewer 监听本地回环地址，并从本地机器建立 SSH 隧道：

```bash
ssh -L 17865:127.0.0.1:17865 user@remote-host
```

若 Viewer 已改用其他端口，将两处 17865 替换为终端输出的端口。

若必须直接暴露服务，可执行：

```bash
roller view /path/to/run --host 0.0.0.0 --port 17865
```

Viewer 当前不提供认证。对外监听会暴露 system prompt、用户输入、reasoning、工具
参数、工具结果和运行 metadata，必须在已有访问控制的可信网络中使用。

## 3. 页面结构

页面分为三列：

1. 左栏按 `task_id` 列出 task。同一 task 的多个模型 rollout 显示在同一组中；可按
   task/model/error 文本搜索，并按状态或模型筛选。
2. 中栏显示所选 rollout 的 ACTF 时间线。step 标题先展示 token、耗时、stop reason、
   reasoning/tool 数量；点击 step 后才加载完整内容。
3. 右栏 Inspector 显示 sample 信息、ACTF 顶层保存的首个 system prompt、完整 tools schema、原始
   `info.json`；User Simulator task 还会显示 `conversation.json`。

拖动栏间分隔条可调整左右两栏的宽度，中间时间线至少保留 360px；分隔条获得焦点后，也可使用
←/→ 调整（按住 Shift 时步长更大）。双击分隔条可恢复默认比例。调整后的宽度保存在当前浏览器中，
窗口宽度不足时按比例收缩。窗口宽度不超过 1180px 时，Inspector 改为浮层，此时仅可调整左栏。

顶部 Run 概览卡片下方也有一条分隔条。向上拖动可降低卡片高度，下方三栏随之变高；拖至顶部可完全收起卡片。
向下拖回或双击分隔条可恢复原高度。分隔条获得焦点后也可使用 ↑/↓ 调整。高度同样保存在当前浏览器中。

Reasoning 使用独立区域并默认折叠。工具调用按 `tool_call_id` 和对应结果配对，
`isError=true` 的结果以错误样式显示。页面内容全部作为文本渲染，不执行轨迹中的
HTML 或脚本。

页面 hash 保存 rollout ID，因此当前 URL 可作为同一 Viewer 进程中该 task 的深链接。

## 4. 数据来源

| 内容 | 文件 | 加载时机 |
| --- | --- | --- |
| Run 名称、state、processed/total、总 usage、采集配置 | Run `info.json` | 首页加载/刷新 |
| Task/model/status/error/path | Run 与 sample `info.json` | 首页加载 |
| Step 摘要与 system/tools | `trace_ACTF.json` | 选中 rollout |
| Step reasoning/content/tool/result | `trace_ACTF.json` | 展开 step |
| 双方可见动态对话 | `conversation.json` | 选中 User Simulator rollout |

Viewer 不以 `trace_SFT.json` 为展示数据源，因为 SFT 不包含 step ID、时间、metric、
stop reason 和 observation metadata。`trace.jsonl`、`cache_trace.jsonl` 和
`wire_trace.jsonl` 也不会默认传给浏览器。

Viewer 展示的内容是 ACTF 对 session 事件的分析投影，不包含每次模型请求的完整 context。
OpenClaw 在 session 与 provider 调用之间发生 compaction、pruning、runtime/hook 注入或
协议适配时，中间时间线不能证明模型逐字看到了哪些历史。此类审计应在采集时启用
`--wire-trace full`，离线检查 sample 中的 `wire_trace.jsonl` 和 `cache_trace.jsonl`；
详细边界见 [轨迹产出文件指南](/roller/traces/trajectory-outputs/#32-session-历史不等于模型请求-context)。

采集过程中，首页的 Run 卡片显示 `state` 和最近 checkpoint 的 `processed / total`。Roller 在
首条结果、之后每累计 25 条结果时更新；若完成事件间隔至少 30 秒，也会立即更新；在
中断/收尾时强制更新。
Resume 后，sample 在磁盘上的 `info.json` 仍保留原始 `status=ok`，Viewer 会用本次 run 索引中的
`status=skipped` 覆盖显示，以便 Completed 卡片准确标出复用数量。Thinking 卡片显示保留策略（kept/stripped）和配置的原生 thinking 档位。

run `info.json` 尚未完成收尾时，Viewer 还会扫描 `samples/<model>/<task>/info.json`，因此
checkpoint 之后完成 finalize 的 sample 仍会显示。没有 sample `info.json` 的运行中临时目录
不进入列表；点击页面右上角“刷新”可重新读取状态与 sample。

## 5. 懒加载和大内容

首页不会读取所有 ACTF。服务端只在用户选择 rollout 时解析对应
`trace_ACTF.json`，并在内存中保留有限数量的最近轨迹。

展开 step 时，每个 user/reasoning/content/arguments/tool result 字段默认最多返回
40,000 字符。被截断的区域会显示原始长度和“加载更多”按钮；再次加载的上限为
1,000,000 字符。该限制仅影响浏览器响应，不修改磁盘文件。

## 6. 缺失与失败轨迹

- `status=error/timeout` 的 sample 仍会出现在列表中；若已有 ACTF，可浏览失败前
  的部分轨迹。
- 没有 ACTF 时仍展示 sample 状态、错误和 metadata，中栏显示 `NO ACTF`。
- 未捕获 cache trace 时 system prompt 显示为空。
- 未捕获 wire tools 时 tools 面板显示为空；这不影响现有 step 中 tool call/result 的
  展示。
- `--no-keep-thinking` 产生的 ACTF reasoning 为空，页面不会伪造或从 SFT 反推内容。

## 7. 只读与路径安全

`roller view` 启动时将一个 run 目录固定为唯一允许读取的根路径。API 使用内部 rollout
ID，不接受浏览器提交任意宿主机目录；run `info.json` 中逃逸根目录的 sample/ACTF 路径
会被拒绝。静态服务器不提供目录列表、文件写入、命令执行或任意 artifact 下载接口。

浏览器响应使用禁止跨源读取、禁止 MIME 猜测和禁止执行内联/外部脚本的安全 header。
这些限制不能替代网络认证，因此敏感 run 仍应只通过 loopback/SSH 隧道访问。

## 8. 常见问题

**(1) 页面中没有新完成的 task**

点击右上角“刷新”。Viewer 不持续轮询磁盘，以免大规模 run 产生额外 I/O。

**(2) 端口已占用**

仅当显式指定的 `--port` 被占用时才会出现该错误；未指定 `--port` 时，Viewer 会自动改用空闲端口。
请更换端口，或移除 `--port`：

```bash
roller view /path/to/run --port 17866
```

**(3) Viewer 报告不是 Roller run**

输入路径必须是 run 根目录，而不是 `samples/`、单个 sample 或
`trace_ACTF.json`。合法根目录包含 run `info.json` 或 `samples/`。

## 语言与 benchmark 得分

浏览器语言为中文时 Viewer 显示中文，其他情况显示英文，可用页头 **EN / 中文** 切换，浏览器会记住选择。Benchmark run 在样本概览显示得分和评分器错误，支持按分数排序，以及 **大于零 / 零 / 未评分** 筛选；这些分组不是通过阈值。用户消息中的图片块与工具结果图片都可直接显示。
