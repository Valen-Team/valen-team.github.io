---
title: "Task format reference"
---

# Task format reference

Roller uses `roller.task/v1` to describe the conversation, files, Context, and runtime settings needed for one rollout. A Task list can be JSONL or JSON:

- `.jsonl`: each non-empty line is one task.
- `.json`: the top level is a task array, or `{"tasks": [...]}`.

The machine-readable constraints are defined in the [Task JSON Schema](https://github.com/Valen-Team/Roller/blob/main/schemas/task.schema.json).

## 1. Complete single-turn example

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

If the task list is located at `examples/tasks/tasks.jsonl`, `file_root` resolves to:

```text
examples/tasks/files/product_summary/
├── inputs/
│   └── product-brief.md
├── context/
│   ├── USER.md
│   └── MEMORY.md
└── outputs/                   # logical output directory; it need not exist in advance
```

During the task, the input remains at `inputs/product-brief.md`. A file that the Agent writes to `outputs/summary.md` is stored in the sample as `results/summary.md`.

## 2. Top-level fields

| Field | Required | Description |
| --- | --- | --- |
| `schema_version` | yes | Current version is `roller.task/v1` |
| `id` | yes | Unique string or integer identifier within the Task list |
| `prompt` / `question` / `messages` / `user_simulator` | choose one | Single-turn, compatibility single-turn, predefined multi-turn, or dynamic multi-turn |
| `file_root` | no | Root of the file pack; defaults to the directory that contains the task list |
| `harness` (or `agent_harness` / `task_agent.harness`) | no | Harness used by the Task Agent: `openclaw`, `codex`, `claude-code`, `hermes`, `opencode`, `deepseek`, or `pi`; default `openclaw`. CLI `--harness` overrides all of them |
| `model` | conditionally required | The Task's own model; if the CLI provides `--model`, the CLI model is used |
| `files` | no | Declarations for inputs, Context, and the output directory |
| `runtime` | no | Required environment variables, setup commands, and thinking settings |

Minimal task:

```json
{"schema_version":"roller.task/v1","id":"hello","prompt":"计算 2+3，只回复数字。"}
```

Task Agent settings can also be grouped in one object:
`"task_agent": {"harness": "codex", "model": "provider/model"}`. This object is equivalent to the top-level
`harness`/`model`; values declared in both places must be consistent. `agent` is a compatibility alias.

If a task has no `model`, the run must provide at least one `--model`. When `--model` is repeated, each task runs once per model. When the CLI provides models, the task's own `model` is not part of the combinations of that run.

## 3. Conversation modes

### 3.1 Single-turn input

```json
{
  "schema_version": "roller.task/v1",
  "id": "single_turn",
  "prompt": "总结当前目录中的项目说明。"
}
```

`question` behaves the same as `prompt` and exists mainly for older data. New tasks should use `prompt`.

### 3.2 Predefined multi-turn

Each element in `messages` is one user-message turn. Roller sends the elements in order to the same Agent session:

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

An element may also be a plain string. The object form currently accepts only `role: "user"`.
Starting with the second message, `"new_session": true` clears conversation history before
that message while preserving the same container and workspace.

Roller does not infer turns from Markdown headings, separators, or other text markers. A message that contains `## Round 1` or `---` is still a single turn.

### 3.3 User Simulator dynamic multi-turn

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

In this mode, the task does not predefine user messages. In each turn, the Conversation Manager passes the fixed instruction and the full conversation to the User Simulator, which decides whether to send the next instruction or to finish.

`user_simulator` cannot appear together with `prompt`, `question`, or `messages`. Fields and scheduling details are described in [User Simulator and dynamic conversation](/roller/tasks/user-simulator/).

## 4. `file_root`

`file_root` is the file-pack root for the current task. Relative paths are resolved from the directory that contains the task list. `file_root` can also be an absolute path, but portable datasets should use relative paths.

For example:

```text
dataset/
├── tasks.jsonl
└── files/
    └── task_001/
        ├── inputs/
        └── context/
```

Corresponding declaration:

```json
{"file_root": "files/task_001"}
```

`files.inputs[].source` and `files.output_dir` are both logical paths relative to this root. Roller does not write Agent output back to the host `file_root`, so parallel models cannot overwrite each other's output. Output files are saved under the `results/` directory of each sample.

## 5. Input files

`files.inputs` accepts files or directories:

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

| Field | Default | Description |
| --- | --- | --- |
| `source` | none | Relative file or directory path under `file_root` |
| `target` / `path` | same as `source` | Relative destination in the Agent workspace; required for inline content |
| `content` | none | Inline UTF-8 text; mutually exclusive with `source` |
| `required` | `true` | Whether a missing path fails the task before start |
| `sha256` | none | Optional checksum of the file or directory contents |

Inputs are read-only by default. For example, `inputs/data.csv` is available at the following paths:

```text
/tmp_workspace/inputs/data.csv
/roller/task/inputs/inputs/data.csv
```

The first path can be referenced directly in a prompt; the second path is a stable entry point to the full input snapshot.
If the Agent must modify seed files in place, set `"input_mode": "copy"` in `files`. In this mode, Roller first
copies the complete input tree into a private writable workspace. The default value, `mount`, uses read-only mounts.

An input file reaches the model only when the Agent opens it with a tool. To send images with the first user message instead, list their workspace paths in `files.attach_images`:

```json
{
  "files": {
    "inputs": [{"source": "inputs/chart.png", "target": "inputs/chart.png"}],
    "attach_images": ["inputs/chart.png"]
  }
}
```

- Each path must be a `.png`, `.jpg`, `.jpeg`, `.webp`, or `.gif` file that is declared in `files.inputs`, either directly or inside a declared directory. The images are sent in the listed order.
- The images accompany the first message of the task only. Later messages, including messages after a `new_session` boundary, are sent as text.
- OpenClaw, Codex, Claude Code, OpenCode, and Pi support this field. A task that uses it with Hermes or DeepSeek is rejected before the run starts. The selected model and API service must accept image input.
- ACTF keeps the images on the first user message, and SFT exports them as `<image>` placeholders with top-level `images` entries.
- The list is part of the Task Bundle identity; therefore changing it makes `--resume` rerun the task.

## 6. Context and system files

`files.context` declares Context files for the Harness to load:

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

| Field | Required | Description |
| --- | --- | --- |
| `role` | yes | Semantic role of the Context |
| `source` | yes | Path relative to `file_root`, or an absolute path |
| `target` | no | Relative path after injection; derived from the role when omitted |
| `capture` | no | `full` persists source content in the run, `hash` records only its digest, and `none` records neither |
| `required` | no | Default `true` |

Default targets:

| role | target |
| --- | --- |
| `user` | `USER.md` |
| `memory` | `MEMORY.md` |
| `system` | `SYSTEM.md` |
| `soul` | `SOUL.md` |
| `agents` | `AGENTS.md` |
| `skill` / `skills` | `skills/<source-name>` |

The OpenClaw adapter injects Context into `/root/<target>` and `/tmp_workspace/<target>`. Capture policy and content retention rules are described in [Files, Task Bundles, and result storage](/roller/tasks/task-bundle-and-storage/#3-context-injection-and-capture).

## 7. Output directory

```json
{
  "files": {
    "output_dir": "outputs"
  }
}
```

`output_dir` defaults to `outputs` and may be a nested relative path such as `deliverables/final`. Roller creates a writable directory at `/tmp_workspace/<output_dir>/` and links `/roller/task/outputs` to the same location.

After the task finishes, every safe file and empty directory in this directory is copied into the sample's `results/`. Output filenames do not need to be listed in advance; the legacy `files.outputs` field, which declared them, is no longer supported.

`files.output_dir` specifies the directory collected from the Agent workspace. The CLI option `--output` specifies the host root directory where the entire run is saved. For example, with `files.output_dir=outputs` and `--output /data/roller-runs --run-name demo`, the Agent's `outputs/report.md` is saved as `/data/roller-runs/demo/samples/.../results/report.md`.

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

| Field | Description |
| --- | --- |
| `env` | Host environment variable names the Task requires; the task fails if any is missing or empty |
| `setup` | Shell commands run in `/tmp_workspace` before the Agent starts |
| `thinking` | Overrides this task's Harness reasoning/thinking setting; for OpenClaw see [Thinking configuration](/roller/harnesses/openclaw-configuration/#6-thinking-configuration), for Codex see [Thinking configuration](/roller/harnesses/codex-configuration/#6-thinking-configuration), for Claude Code see [Thinking configuration](/roller/harnesses/claude-code-configuration/#6-thinking-configuration) |
| `image` | Overrides the container image for this task; primarily generated by bench adapters |
| `workspace_path` | Overrides this task's absolute workspace path inside the container |
| `image_build` | Reproducible task-image build definition; Roller builds a missing image before collection |

`env` and `setup` both accept a single string or an array of strings. Task authors should treat setup as executable code and run only commands from trusted datasets.

The Roller schema for `thinking` accepts `off/minimal/low/medium/high/xhigh/adaptive/max/ultra`;
`none` is normalized to `off`. The value in the task takes precedence over CLI `--thinking`. Newer OpenClaw releases
validate levels against the selected provider/model profile; Roller only rejects advanced levels on the legacy
`2026.3.11` runtime that is known to silently downgrade them. Codex maps valid levels to `model_reasoning_effort` and rejects
the OpenClaw-only `adaptive` and `off`, which has no shared equivalent; other effort levels are forwarded to Codex
and validated by the selected model and endpoint. Claude Code 2.1.332 accepts
`low/medium/high/xhigh/max/ultracode`; Roller maps `ultra` to `ultracode` and rejects
`off/minimal/adaptive`. The available levels depend on the Harness version, model, and provider; each of them validates the value.
The Task Agent can use OpenClaw, Codex, Claude Code, Hermes, OpenCode, DeepSeek, Pi, or Stirrup; the User Simulator can also select any of these eight Harnesses in its own `harness` field. Task Agent harnesses may differ between tasks; an explicit `--harness` overrides all of them. The Simulator Harness is selected independently.

## 9. Path and format validation

Roller performs the following checks before starting Docker:

- Task IDs must be unique within the list.
- Input paths must be POSIX-style paths relative to `file_root`.
- Inputs and `output_dir` must not use absolute paths, `..`, or globs.
- `output_dir` must not be located under `inputs/` or `context/`, and must not overlap an input or Context target.
- A Context target must not use the reserved top-level directories `inputs`, `outputs`, or `context`.
- `sha256` must be a 64-character hexadecimal string.
- `files.attach_images` paths must be image files declared in `files.inputs`, without duplicates.
- User Simulator `max_turns` must be in `1–100`.

The Task Bundle stage then also checks that files exist and validates type, size, symlinks, and the actual hash.

## 10. Legacy compatibility

Roller can still read some older Interns2_data-style fields:

- `question`
- `workspace` / `workspace_path`
- `persona`
- `warmup`

New data should use `prompt`, `file_root`, `files.inputs`, `files.context`, `files.output_dir`, and `runtime.setup`, so that paths, snapshots, and Resume behavior remain explicit.
