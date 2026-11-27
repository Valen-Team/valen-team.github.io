---
title: "SFT 数据格式"
---

# SFT 数据格式

Roller 为线性轨迹生成 `trace_SFT.json`。主 Agent 压缩上下文时，Roller 按已验证的上下文窗口
在 `sft_segments/` 下保存多条记录，并在 `info.json` 的 `trajectory.sft_segments` 中
列出路径。Run 根目录的 `sft.jsonl` 保持原有线性 record 格式，每个符合条件的线性
sample 占一行；压缩分段独立保存，须由显式支持目标范围的读取器使用。

## 1. 顶层结构

纯文本线性 SFT record 的顶层有且仅有 `messages` 和 `tools`：

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "读取 input.txt"},
    {
      "role": "assistant",
      "reasoning_content": "需要先读取文件。",
      "content": "",
      "tool_calls": [
        {
          "id": "call-1",
          "type": "function",
          "function": {
            "name": "read",
            "arguments": "{\"path\":\"input.txt\"}"
          }
        }
      ]
    },
    {"role": "tool", "tool_call_id": "call-1", "content": "file contents"},
    {
      "role": "assistant",
      "reasoning_content": "根据结果回答。",
      "content": "文件内容是……",
      "tool_calls": []
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read",
        "description": "Read a file",
        "parameters": {
          "type": "object",
          "properties": {"path": {"type": "string"}},
          "required": ["path"]
        }
      }
    }
  ]
}
```

SFT record 不包含 schema version、task/model、usage、时间戳、step ID、stop reason、
运行路径或其他 metadata。这些信息仍保留在相邻的 `info.json` 和 `trace_ACTF.json`。

### 压缩分段

每条分段包含 `messages`、`tools` 和 `target_start_index`。该索引之前的消息是
窗口开始时模型实际收到的 prompt；从该索引起，只有 `role: "assistant"` 的消息
参与训练，其间的 user/tool 消息仅提供上下文。下一段从上下文变化后的实际请求
开始，可同时包含摘要和保留的近期历史。
原生事件和请求行仅用于发现可能的上下文变化；分段内容及其校验依据来自捕获的
主 Agent Calls。两种来源可能不一致，因此不能直接用原生事件填充 SFT 内容。
`info.json` 中每段记录路径、顺序
`window_index`、`boundary_source`（`initial`、`native_boundary` 或
`observed_context_change`）、可选的原生 `boundary_event_id` 及首尾 Call ID。
root Calls 按顺序绑定 ACTF 主干步骤。Codex 和 OpenClaw 以主 Agent 身份发送压缩摘要
请求；这类 Call 仅在与下一个主干步骤不匹配、且其文本原样记录在随后的原生压缩行中时
才会被跳过。其他多余的 root Call，或没有对应 Call 的合成 assistant step，均会使 SFT
不可导出，raw 和 Calls 仍保留。Harness 回放历史时改写的 tool-call ID 不会产生新分段；
分段使用最近一次 prompt 中的 ID。
加密 reasoning 等无法表示的 prompt 内容会使该压缩 sample 的 SFT 导出不可用，
Roller 不会静默改写模型输入。
原有 `sft.jsonl` 不收录这些分段，以免旧读取器将 prompt 中的 assistant 历史误作训练目标。

### 1.1 多模态 record

当 user message 或工具结果携带图片，且 ACTF 层已将其无损捕获为 base64 字节时，record 额外包含顶层
`images` 列表。图片不内联保留：其在消息文本中的位置替换为保留占位符 `<image>`，
归一化后的 data URI 追加至 `images`：

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "描述 chart.png"},
    {
      "role": "assistant",
      "reasoning_content": "",
      "content": "",
      "tool_calls": [
        {
          "id": "call-1",
          "type": "function",
          "function": {
            "name": "read",
            "arguments": "{\"path\":\"chart.png\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call-1",
      "content": [
        {"type": "text", "text": "Image size: 2x1"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgo…"}}
      ]
    },
    {"role": "assistant", "reasoning_content": "", "content": "图表内容是……", "tool_calls": []}
  ],
  "tools": []
}
```

约定如下：

- 纯文本消息保持字符串形式的 `content`，不写入顶层 `images` 键，现有纯文本消费方保持向后兼容。
- 含图片的消息使用标准 OpenAI 多模态内容列表（`text` 和 `image_url` 块），其中 `image_url.url` 为规范化的 `data:image/png|jpeg|webp|gif;base64,…` URI。
- 源文本、reasoning 或工具输出中出现的字面 `<image>` 会原样保留，不会阻断 SFT 导出。
- `roller export --format sft` 和 `--format xtuner` 仍兼容并自动升级旧版磁盘上的 `<image>` + 顶层 `images` 格式 run。

## 2. Message 规则

- 第一条消息固定为 `system`；未捕获 system prompt 时，`content` 为 `""`。
- `user` 只包含 `role` 和字符串 `content`。
- `assistant` 始终包含 `role`、`reasoning_content`、`content` 和 `tool_calls`；
  没有 reasoning、可见文本或工具调用时分别使用 `""`、`""`、`[]`。
- `tool_calls[*]` 使用 function-call 结构，`function.arguments` 是紧凑 JSON 字符串。
- `tool` 只包含 `role`、`tool_call_id` 和字符串 `content`。
- 工具调用之后的 assistant message 紧接在对应的 tool message 之后，不插入空 user message。
- `tools` 保留捕获的工具定义。Codex 使用原始 Responses 列表（扁平 function、namespace、custom grammar、内置工具），包含未调用工具及原始 schema 全部字段；训练端须支持该格式。其他 Harness 保持原有的嵌套 function 表示。Codex 即使未调用工具也必须捕获定义，缺失的捕获不会被替换为空列表。
- Codex custom call 使用 `{"id":"...","type":"custom","custom":{"name":"...","input":"原始字符串"}}`，function/custom call 的 namespace 字段保留。工具定义跨请求变化或存在 programmatic `additional_tools` item 时，ACTF 保留完整快照，SFT 明确不可用。

## 3. ACTF 映射

| ACTF | SFT |
| --- | --- |
| `system_prompt` | 第一条 system message |
| `steps[*].user_content` | user message（非空时）；image block 变为 `<image>` 并追加顶层 `images` |
| `steps[*].assistant_content` | assistant message |
| `steps[*].observation` | tool message |
| `steps[*].observation[*].content[*]` 的 image block | tool message 中的 `<image>` 占位符，外加一条顶层 `images` 记录 |
| 顶层 `tools` | 顶层 `tools` |

`metric`、`started_at`、`finished_at`、observation 的 `toolName`、`isError` 和
`details` 不进入 SFT。工具错误的文本内容仍原样保留。GPT Responses 的 encrypted
reasoning 不进入训练数据；只有 ACTF 中可见的 reasoning summary 会进入
`reasoning_content`。

## 4. 数据完整性

导出器要求：

- 每个 assistant tool call 都有非空且全局唯一的 ID；
- 每个 call 在同一 step 内恰好有一个匹配的 tool result；
- call 的工具名存在于顶层 tools schema；
- arguments 可以编码为 JSON object；
- user content 和工具结果只包含字符串、text blocks 或内嵌 base64 字节的 image blocks。

image block 接受三种形态：base64 `source` 结构（Claude Code）、扁平 `data` +
`mimeType` 结构（OpenClaw/Pi 原生）和内联 data URI。media type 必须是
`image/png`、`image/jpeg`、`image/webp` 或 `image/gif`，payload 必须能通过严格
base64 解码，随后重新编码为规范形式（消除可解码的冗余 padding，图片字节不变）。
导出、汇总与 Resume 使用同一套解析规则；保存的 `images` 必须采用规范形式。
严格解码沿用当前 Python 标准库的行为：部分版本会直接拒绝冗余 padding，
因此不保证跨版本均可接受。被拒绝的 sample 保留 raw/ACTF，标记为转换失败且不计入
SFT 汇总，不影响其他有效 sample 的汇总；Roller 不会为兼容异常 padding 放宽解码规则。
以下其余情况仍会导致转换失败：audio 等未知 block 类型、不支持的 media type、损坏的
base64，以及只引用文件路径而没有字节的 image block。
Collector 会在 `runtime.trajectory_conversion` 中记录 `target: "sft"`、
`status: "unavailable"` 和原因，保留 raw/ACTF，不生成 SFT，也不计入汇总。
这不会将已完成的采集改为失败；Resume 复用已有采集，不会为此重新调用模型。
Roller 不会静默删除内容。转换器本身不读取文件，也不访问
网络：若某 Harness 的读图工具只留下路径，须在文件仍可访问时由对应 ACTF 层将
字节物化为 image block。

上述是 SFT 层接受的内容块形态，不代表所有 Harness 的运行时都能调用视觉能力。
各 Harness 的图片输入处理如下：

| Harness | 运行时图片路径 | ACTF/SFT 图片保存 |
| --- | --- | --- |
| OpenClaw | `files.attach_images`、Prompt 附件、`read` 或 `image` 辅助模型调用 | 保留；`--wire-trace off` 无法恢复 `image` 工具的输入图片 |
| Codex | `files.attach_images`，或通过 Responses 调用 `view_image` | 保留 |
| Claude Code | `files.attach_images` 或 `Read` 图片结果 | 保留 |
| OpenCode | `files.attach_images`，或 `read` 返回内嵌 data URL 附件 | 保留；非图片附件只保留有界审计元数据 |
| Hermes | Roller 为固定 profile 启用 `vision_analyze` 工具集 | 保留 |
| DeepSeek | 面向文本的 Bash profile | 显式拒绝 image 内容 |
| Pi | `files.attach_images` 或 `read` 原生图片结果，并将所选模型注册为支持图片 | 保留 |
| Stirrup | `view_image` 工具返回的图片结果 | 保留 |

OpenCode 图片附件若只有远程 URL 或文件路径，仍会保留在 ACTF 中，但无法生成多模态
SFT，因为导出过程不读取文件，也不访问网络。该 sample 保留 raw/ACTF，并将 SFT 记录为不可用。

## 5. 文件位置

```text
<run>/
├── lock.json
├── sft.jsonl
└── samples/<model>/<index>_<task>/
    ├── trace.jsonl
    ├── trace_ACTF.json
    ├── trace_SFT.json          # 线性 sample
    └── sft_segments/          # 压缩 sample
        ├── 0001.json
        └── 0002.json
```

User Simulator rollout 的 Task Agent SFT 位于根 sample，模拟用户自身的 SFT 位于
`user_simulator/trace_SFT.json`；run 级 `sft.jsonl` 仅汇总 Task Agent。

## 6. 并行工具结果的顺序

同一条 assistant 消息中的多个工具调用可能按任意顺序完成。SFT 导出按 `tool_call_id` 配对，然后按该消息的 `tool_calls` 数组顺序输出 tool 消息；不会按工具名或 ID 字典序排序，也不会跨 step 移动结果。重复、缺失、无对应调用或工具名不匹配的结果仍会导致转换失败。

图片在结果重排后按消息顺序加入顶层 `images`，因此第 N 个 `<image>` 仍对应 `images[N-1]`。原始轨迹和 ACTF 的 observation 顺序保持不变，可用于检查实际完成顺序。此规则统一训练数据顺序，不表示原来的逆序结果在按 ID 配对时发生了内容错配。已生成的 SFT 文件不会自动重写，重新导出后才会应用此规则。

## 得分与记录索引

采集在 `sft.jsonl` 旁写入 `sft_index.jsonl`，在 `sft_segments.jsonl` 旁写入 `sft_segments_index.jsonl`。索引与训练记录逐行同序对应，包含 task ID、模型、Harness、样本路径、benchmark、分类和得分；训练记录自身格式保持不变。

```bash
roller export RUN_DIR --format sft --min-score 0.5 --output training
```

该命令从样本重建数据集及索引，仅保留得分至少 0.5 的样本，排除未评分样本。不指定 `--min-score` 时，采集和导出仍保留成功且符合训练条件的零分样本。得分由 `roller bench report` 使用的同一 benchmark adapter 计算。

## XTuner 导出

`roller export RUN_DIR --format xtuner --output DIR` 将未分段轨迹和上下文压缩分段合并导出为单个 `xtuner.jsonl`，并写出逐行对应的 `xtuner_index.jsonl`，支持 `--min-score`：

```bash
roller export runs/my-run --format xtuner --min-score 0.5 --output training-xtuner
```

XTuner 导出包含以下转换：

- 将图片提取到 `<output>/media/` 并记录按 EXIF 方向校正的 `image_wh` 元数据（传入 `--inline-images` 则保留内联 base64 data URI）。
- 将 `tool_calls[].function.arguments` 的 JSON 字符串解析为对象。
- 对上下文压缩分段，将 `target_start_index` 转换为前序 assistant 轮次上的 `"loss": false`。
