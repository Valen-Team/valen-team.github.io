---
title: "Task 格式参考"
---

# Task 格式参考

Roller 使用 `roller.task/v1` 描述一次 rollout 所需的对话、文件、Context 和运行设置。Task 清单可以是 JSONL 或 JSON：

- `.jsonl`：每个非空行是一条 task。
- `.json`：顶层是 task 数组，或 `{"tasks": [...]}`。

机器可读约束见 [Task JSON Schema](https://github.com/Valen-Team/Roller/blob/main/schemas/task.schema.json)。

## 1. 完整单轮示例

```json
{
  "schema_version": "roller.task/v1",
  "id": "product_summary",
  "file_root": "files/product_summary",
  "model": "my-openai-proxy/my-model",
  "prompt": "阅读 inputs/product-brief.md，根据用户偏好写一份摘要，并保存到 outputs/summary.md。",
  "files": {
    "inputs": [
      "inputs/product-brief.md"
    ],
    "context": [
      {
        "role": "user",
        "source": "context/USER.md",
        "capture": "hash"
      },
      {
        "role": "memory",
        "source": "context/MEMORY.md",
        "capture": "hash"
      }
    ],
    "output_dir": "outputs"
  },
  "runtime": {
    "env": ["OPTIONAL_SERVICE_KEY"],
    "setup": ["test -f inputs/product-brief.md"],
    "thinking": "high"
  }
}
```

若 task 清单位于 `examples/tasks/tasks.jsonl`，则 `file_root` 解析为：

```text
examples/tasks/files/product_summary/
├── inputs/
│   └── product-brief.md
├── context/
│   ├── USER.md
│   └── MEMORY.md
└── outputs/                   # 逻辑输出目录，可不预先创建
```

task 运行时，输入仍位于 `inputs/product-brief.md`。Agent 写入 `outputs/summary.md` 的文件在 sample 中保存为 `results/summary.md`。

## 2. 顶层字段

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `schema_version` | 是 | 当前版本为 `roller.task/v1` |
| `id` | 是 | Task 清单内唯一的字符串或整数标识 |
| `prompt` / `question` / `messages` / `user_simulator` | 选择一种 | 单轮、兼容单轮、预定义多轮或动态多轮 |
| `file_root` | 否 | 文件包根目录；默认为 task 清单所在目录 |
| `harness`（或 `agent_harness` / `task_agent.harness`） | 否 | Task Agent 使用的 Harness：`openclaw`、`codex`、`claude-code`、`hermes`、`opencode`、`deepseek` 或 `pi`；默认 `openclaw`。命令行 `--harness` 可统一覆盖 |
| `model` | 条件必需 | Task 自身的模型；若命令行提供 `--model`，则使用命令行模型 |
| `files` | 否 | 输入、Context 和输出目录声明 |
| `runtime` | 否 | 必需环境变量、setup 命令和 thinking 设置 |

最小 task：

```json
{"schema_version":"roller.task/v1","id":"hello","prompt":"计算 2+3，只回复数字。"}
```

Task Agent 的设置也可集中写在一个对象中：
`"task_agent": {"harness": "codex", "model": "provider/model"}`。该对象与顶层
`harness`/`model` 等价，两处重复声明时须保持一致。`agent` 是兼容别名。

若 task 未指定 `model`，运行时须提供至少一个 `--model`。重复指定 `--model` 时，每条 task 对每个模型各执行一次。命令行提供模型后，task 自身的 `model` 不参与本次组合。

## 3. 对话模式

### 3.1 单轮输入

```json
{
  "schema_version": "roller.task/v1",
  "id": "single_turn",
  "prompt": "总结当前目录中的项目说明。"
}
```

`question` 与 `prompt` 行为相同，主要用于兼容旧数据。新 task 建议使用 `prompt`。

### 3.2 预定义多轮

`messages` 中的每个元素是一轮 user message。Roller 按顺序将这些元素发送到同一个 Agent session：

```json
{
  "schema_version": "roller.task/v1",
  "id": "two_turn_review",
  "messages": [
    {
      "role": "user",
      "content": "阅读 inputs/brief.md，先概括主要需求。"
    },
    {
      "role": "user",
      "content": "根据刚才的概括生成最终报告，并保存到 outputs/report.md。"
    }
  ],
  "file_root": "files/two_turn_review",
  "files": {
    "inputs": ["inputs/brief.md"],
    "output_dir": "outputs"
  }
}
```

元素也可以是字符串。对象形式目前仅接受 `role: "user"`。从第二条 message
起可添加 `"new_session": true`：Roller 保留同一容器和工作区，在发送该条消息前清空会话历史。

Roller 不从 Markdown 标题、分隔线或其他文本标记中推断轮次。包含 `## Round 1` 或 `---` 的 message 仍视为一轮。

### 3.3 User Simulator 动态多轮

```json
{
  "schema_version": "roller.task/v1",
  "id": "hr_recruitment_ad",
  "harness": "codex",
  "model": "my-openai-proxy/task-agent-model",
  "user_simulator": {
    "harness": "claude-code",
    "model": "my-openai-proxy/simulator-model",
    "max_turns": 6,
    "instruction": "你是一名 HR。通过多轮交流让任务 Agent 完成招聘广告；检查每版草稿并逐步补充要求，确认最终文件已经保存后结束。"
  },
  "files": {
    "output_dir": "outputs"
  }
}
```

此模式下，task 不预定义 user messages。Conversation Manager 每轮将固定 instruction 与完整对话传给 User Simulator，由 Simulator 决定发送下一条指令或结束对话。

`user_simulator` 不能与 `prompt`、`question`、`messages` 同时出现。字段和调度细节见 [User Simulator 与动态对话](/roller/tasks/user-simulator/)。

## 4. `file_root`

`file_root` 是当前 task 的文件包根目录。相对路径以 task 清单所在目录为基准；绝对路径也可用于 `file_root`，但可移植数据集建议使用相对路径。

例如：

```text
dataset/
├── tasks.jsonl
└── files/
    └── task_001/
        ├── inputs/
        └── context/
```

对应声明：

```json
{"file_root": "files/task_001"}
```

`files.inputs[].source` 和 `files.output_dir` 都是该根目录下的逻辑相对路径。Roller 不会将 Agent 输出直接写回宿主机 `file_root`，以免并行模型互相覆盖；输出文件统一保存到各 sample 的 `results/`。

## 5. 输入文件

`files.inputs` 接受文件或目录：

```json
{
  "files": {
    "inputs": [
      "inputs/brief.md",
      {
        "source": "inputs/documents",
        "target": "reference/documents",
        "required": true
      },
      {
        "path": "config/settings.yaml",
        "content": "enabled: true\n"
      },
      {
        "source": "inputs/data.csv",
        "required": true,
        "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      }
    ]
  }
}
```

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `source` | 无 | `file_root` 下的相对文件或目录路径 |
| `target` / `path` | 与 `source` 相同 | Agent 工作区中的相对目标路径；内联内容必须提供 |
| `content` | 无 | 直接内嵌的 UTF-8 文本；与 `source` 二选一 |
| `required` | `true` | 缺失时是否在启动前报错 |
| `sha256` | 无 | 可选的文件或目录内容校验值 |

默认情况下，输入以只读方式提供。例如，`inputs/data.csv` 位于以下路径：

```text
/tmp_workspace/inputs/data.csv
/roller/task/inputs/inputs/data.csv
```

第一条路径可在 prompt 中直接引用；第二条路径是完整输入快照的稳定入口。
如需让 Agent 原地修改 seed 文件，请在 `files` 中设置 `"input_mode": "copy"`；此时 Roller 先将
完整输入树复制为工作区私有的可写副本。默认值 `mount` 使用只读挂载。

输入文件只有在 Agent 用工具打开后才会进入模型。如需随首条用户消息直接发送图片，请在 `files.attach_images` 中列出图片的工作区路径：

```json
{
  "files": {
    "inputs": [{"source": "inputs/chart.png", "target": "inputs/chart.png"}],
    "attach_images": ["inputs/chart.png"]
  }
}
```

- 每个路径必须是 `files.inputs` 中声明的 `.png`、`.jpg`、`.jpeg`、`.webp` 或 `.gif` 文件，可以直接声明，也可以位于已声明的目录内。图片按列出的顺序发送。
- 图片只随 task 的首条消息发送；后续消息（包括 `new_session` 边界之后的消息）只发送文本。
- OpenClaw、Codex、Claude Code、OpenCode 和 Pi 支持该字段。task 在 Hermes 或 DeepSeek 上使用该字段时，会在 run 启动前报错。所选模型和 API 服务须支持图片输入。
- ACTF 在首条用户消息中保留这些图片，SFT 将其导出为 `<image>` 占位符和顶层 `images` 条目。
- 该列表属于 Task Bundle 身份的一部分，因此修改后 `--resume` 会重新运行该 task。

## 6. Context 与系统文件

`files.context` 声明由 Harness 加载的 Context 文件：

```json
{
  "files": {
    "context": [
      {"role": "system", "source": "context/SYSTEM.md", "capture": "full"},
      {"role": "user", "source": "context/USER.md", "capture": "hash"},
      {"role": "memory", "source": "context/MEMORY.md", "capture": "hash"},
      {
        "role": "skill",
        "source": "context/skills/web-research",
        "target": "skills/web-research",
        "capture": "full"
      }
    ]
  }
}
```

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `role` | 是 | Context 的语义角色 |
| `source` | 是 | 相对于 `file_root` 的路径，也可以是绝对路径 |
| `target` | 否 | 注入后的相对路径；省略时根据 role 推导 |
| `capture` | 否 | `full` 在 run 中持久化原文，`hash` 只记录摘要，`none` 两者均不记录 |
| `required` | 否 | 默认 `true` |

默认 target：

| role | target |
| --- | --- |
| `user` | `USER.md` |
| `memory` | `MEMORY.md` |
| `system` | `SYSTEM.md` |
| `soul` | `SOUL.md` |
| `agents` | `AGENTS.md` |
| `skill` / `skills` | `skills/<source-name>` |

OpenClaw adapter 将 Context 注入 `/root/<target>` 与 `/tmp_workspace/<target>`。Capture 策略和内容留存规则见 [文件、Task Bundle 与结果存储](/roller/tasks/task-bundle-and-storage/#3-context-注入与-capture)。

## 7. 输出目录

```json
{
  "files": {
    "output_dir": "outputs"
  }
}
```

`output_dir` 默认为 `outputs`，也可以是多级相对路径，例如 `deliverables/final`。Roller 在 `/tmp_workspace/<output_dir>/` 创建可写目录，并将 `/roller/task/outputs` 链接到同一位置。

task 结束后，该目录内的全部安全文件与空目录将复制到 sample 的 `results/`。无需预先列出输出文件名；用于声明输出文件名的旧字段 `files.outputs` 已不再支持。

`files.output_dir` 指定 Agent 工作区中需要回收的目录；CLI `--output` 指定宿主机上保存整个 run 的根目录。例如，设置 `files.output_dir=outputs` 并使用 `--output /data/roller-runs --run-name demo` 时，Agent 的 `outputs/report.md` 将保存为 `/data/roller-runs/demo/samples/.../results/report.md`。

## 8. Runtime

```json
{
  "runtime": {
    "env": ["EXTRA_API_KEY"],
    "setup": [
      "python3 -m pip install -r inputs/requirements.txt"
    ],
    "thinking": "high",
    "image": "my-task-image:latest",
    "workspace_path": "/work"
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `env` | Task 强制依赖的宿主机环境变量名；缺失或为空时 task 失败 |
| `setup` | Agent 启动前在 `/tmp_workspace` 执行的 shell 命令 |
| `thinking` | 覆盖本 task 的 Harness reasoning/thinking 设置；OpenClaw 见 [Thinking 配置](/roller/harnesses/openclaw-configuration/#6-thinking-配置)，Codex 见 [Thinking 配置](/roller/harnesses/codex-configuration/#6-thinking-配置)，Claude Code 见 [Thinking 配置](/roller/harnesses/claude-code-configuration/#6-thinking-配置) |
| `image` | 覆盖该 task 使用的容器镜像；主要由 bench adapter 生成 |
| `workspace_path` | 覆盖该 task 在容器内的绝对工作目录 |
| `image_build` | 可复现的 task 镜像构建定义；Roller 在 collect 前构建缺失镜像 |

`env` 和 `setup` 都接受单个字符串或字符串数组。Task 作者应将 setup 视为可执行代码，只运行可信数据集中的命令。

`thinking` 的 Roller schema 接受 `off/minimal/low/medium/high/xhigh/adaptive/max/ultra`；
`none` 会规范化为 `off`。task 中的值优先于 CLI `--thinking`。新版 OpenClaw 会按所选
provider/model profile 校验档位；Roller 仅拒绝已知会静默降级的旧版 `2026.3.11` 高级档位。
Codex 将有效档位映射到 `model_reasoning_effort`，拒绝
OpenClaw 专用 `adaptive` 和没有通用等价语义的 `off`；其他档位会透传给 Codex，
再由所选模型与服务端点验证。Claude Code 2.1.332 接受
`low/medium/high/xhigh/max/ultracode`，Roller 将 `ultra` 映射为 `ultracode`，拒绝
`off/minimal/adaptive`。最终可用档位仍由 Harness 版本、model 和 provider 共同校验。
Task Agent 可以使用 OpenClaw、Codex、Claude Code、Hermes、OpenCode、DeepSeek 或 Pi；User Simulator 也可在其自身的 `harness` 字段中选择这七种 Harness。Task Agent harness 可按 task 混用，显式 `--harness` 会统一覆盖；Simulator 的 Harness 可独立选择。

## 9. 路径与格式校验

Roller 在启动 Docker 前执行以下检查：

- Task ID 在清单内不得重复。
- 输入路径必须是相对于 `file_root` 的 POSIX 风格路径。
- 输入和 `output_dir` 不得使用绝对路径、`..` 或 glob。
- `output_dir` 不得位于 `inputs/`、`context/` 下，也不得与输入或 Context target 重叠。
- Context target 不得使用保留的顶层目录 `inputs`、`outputs`、`context`。
- `sha256` 必须是 64 位十六进制字符串。
- `files.attach_images` 中的路径必须是 `files.inputs` 中声明的图片文件，且不得重复。
- User Simulator 的 `max_turns` 必须在 `1–100` 之间。

随后 Task Bundle 阶段还会检查文件是否存在、类型、大小、符号链接和实际 hash。

## 10. Legacy 兼容

Roller 仍可读取 Interns2_data 风格的部分旧字段：

- `question`
- `workspace` / `workspace_path`
- `persona`
- `warmup`

新数据建议使用 `prompt`、`file_root`、`files.inputs`、`files.context`、`files.output_dir` 和 `runtime.setup`，以便明确指定文件路径、生成输入快照并检查 Resume 条件。
