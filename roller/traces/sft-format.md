---
title: "SFT data format"
---

# SFT data format

Roller writes `trace_SFT.json` for a linear trajectory. When the main agent
compacts its context, Roller writes one record per verified context window under
`sft_segments/` and lists them in `info.json` as `trajectory.sft_segments`.
Run-root `sft.jsonl` keeps the original linear-record format and contains one
line per eligible linear sample. Compaction segments are separate, opt-in
records; they are never mixed into the legacy run dataset.

## 1. Top-level structure

A text-only linear SFT record has exactly `messages` and `tools` at the top level:

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

An SFT record does not include schema version, task/model, usage, timestamps,
step ID, stop reason, run path, or other metadata. That information remains in
the adjacent `info.json` and `trace_ACTF.json`.

### Compaction segments

Each segment has `messages`, `tools`, and `target_start_index`. The first
`target_start_index` messages are the actual model prompt at the start of that
window. Assistant messages at or after that index are training targets;
intervening user and tool messages provide context and are excluded from loss.
Do not train these files with a reader that treats every assistant message as
a target. The legacy `sft.jsonl` deliberately excludes them.
The next segment starts with the actual prompt observed after a context change,
which can include a summary and recent history.
Native events and request rows are used only to detect possible context changes;
captured root Calls supply the prompt and response used to build and verify each
record. The two sources can differ; therefore a native hint alone never supplies
SFT content.
`info.json` records each segment path, sequential `window_index`,
`boundary_source` (`initial`,
`native_boundary`, or `observed_context_change`), optional native
`boundary_event_id`, and first/last Call IDs.
Root Calls are bound to ACTF main steps in order. Codex and OpenClaw send
compaction summary requests under the main identity; such a Call is skipped only
when it does not match the next main step and the following native compaction
row records its text verbatim. Any other extra root Call, or a synthetic
assistant step without a Call, makes SFT export unavailable; raw trace and
Calls remain. Tool-call IDs that a Harness rewrites when replaying history do not
start a new segment; a segment keeps the IDs from its latest prompt.
Opaque prompt content, such as encrypted reasoning, makes SFT export for the
compacted sample unavailable rather than silently changing the model input.

### 1.1 Multimodal records

When a user message or tool result carries an image that the ACTF layer captured
losslessly as base64 bytes, that message uses a standard OpenAI multimodal content
list containing `text` and `image_url` blocks (with canonical `data:<mime>;base64,…`
URIs). Text-only messages keep a plain string `content`, and no top-level `images`
field is written:

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Describe chart.png"},
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
    {"role": "assistant", "reasoning_content": "", "content": "The chart…", "tool_calls": []}
  ],
  "tools": []
}
```

The following rules apply:

- Messages without images keep plain string `content`, so existing text-only data
  and consumers remain backward compatible.
- Image blocks store complete `data:image/png|jpeg|webp|gif;base64,…` URIs; raw
  base64 is never stored.
- Literal `<image>` text in prompts, reasoning, or tool outputs is preserved
  without blocking SFT export.
- `roller export --format sft` and `--format xtuner` still upgrade legacy on-disk
  runs written with `<image>` placeholders and a top-level `images` list.

## 2. Message rules

- The first message is always `system`. When no system prompt was captured,
  `content` is `""`.
- `user` contains only `role` and string `content`.
- `assistant` always contains `role`, `reasoning_content`, `content`, and
  `tool_calls`. When there is no reasoning, visible text, or tool call, the
  values are `""`, `""`, and `[]` respectively.
- `tool_calls[*]` uses the function-call structure. `function.arguments` is a
  compact JSON string.
- `tool` contains only `role`, `tool_call_id`, and string `content`.
- The assistant message after a tool call directly follows the matching tool
  message. No empty user message is inserted.
- `tools` keeps captured tool definitions. Codex preserves the native Responses list (flat functions, namespaces, custom grammars, and built-in tools), including unused tools and all original schema fields; consumers must support this format. Other Harnesses keep the existing nested function representation. Codex requires captured definitions even when no tools were called; a missing capture is never replaced with an empty list.
- Codex custom calls use `{"id":"...","type":"custom","custom":{"name":"...","input":"original string"}}`. Function/custom call namespace fields are preserved. Changing schemas or programmatic `additional_tools` items retain their exact snapshots in ACTF and make SFT explicitly unavailable.

## 3. ACTF mapping

| ACTF | SFT |
| --- | --- |
| `system_prompt` | First system message |
| `steps[*].user_content` | user message (when non-empty); image blocks become `<image>` plus top-level `images` entries |
| `steps[*].assistant_content` | assistant message |
| `steps[*].observation` | tool message |
| `steps[*].observation[*].content[*]` image block | `<image>` placeholder in the tool message plus one top-level `images` entry |
| Top-level `tools` | Top-level `tools` |

`metric`, `started_at`, `finished_at`, and observation `toolName`, `isError`,
and `details` do not enter SFT. The text of a tool error is retained unchanged.
GPT Responses encrypted reasoning does not enter the training data. Only the
visible reasoning summary in ACTF enters `reasoning_content`.

## 4. Data integrity

The exporter requires:

- Every assistant tool call has a non-empty, globally unique ID;
- Every call has exactly one matching tool result in the same step;
- The call's tool name exists in the top-level tools schema;
- Function arguments can be encoded as a JSON object; Codex custom input remains a string;
- User content and tool results contain only strings, text blocks, or image
  blocks with embedded base64 bytes.

Image blocks are accepted in the base64 `source` form (Claude Code), the flat
`data` + `mimeType` form (OpenClaw/Pi native), and the inline data-URI form.
The media type must be `image/png`, `image/jpeg`, `image/webp`, or
`image/gif`, and the payload must decode as strict base64. It is then re-encoded
canonically, removing decodable redundant padding without changing the image
bytes. Export, aggregation, and Resume share the same parser; saved `images`
must use the canonical representation. Strict decoding follows the current Python
standard library: some releases reject excess padding, so its acceptance is not
guaranteed across versions. Rejected samples retain raw/ACTF, are marked as
conversion failures, and are excluded from SFT aggregation without preventing
valid samples from being aggregated. Roller does not relax decoding to accept
invalid padding. All other content still fails conversion: audio or other
unknown block types, unsupported media types, malformed base64, and image
blocks that only reference a file path without bytes. The Collector records `target: "sft"`,
`status: "unavailable"`, and the reason in `runtime.trajectory_conversion`,
retains raw/ACTF, and omits SFT and its aggregate entry. This does not turn a
completed collection into a failure; Resume reuses the collected sample without
calling the model again. Roller never silently drops content. The converter itself never reads files
or accesses the network: a Harness whose image tool only leaves a path must
materialize the bytes into the ACTF layer while the file is still accessible.

These are the block shapes that SFT accepts; they do not imply that every
Harness can invoke vision at runtime. Image inputs are handled as follows:

| Harness | Runtime image path | ACTF/SFT image preservation |
| --- | --- | --- |
| OpenClaw | `files.attach_images`, prompt attachment, `read`, or `image` auxiliary model call | Preserved; `--wire-trace off` cannot recover `image` tool inputs |
| Codex | `files.attach_images` or `view_image` through Responses | Preserved |
| Claude Code | `files.attach_images` or `Read` image result | Preserved |
| OpenCode | `files.attach_images` or `read` attachment with an inline data URL | Preserved; non-image attachments retain bounded audit metadata |
| Hermes | Roller enables the pinned profile's `vision_analyze` toolset | Preserved |
| DeepSeek | Text-oriented Bash profile | Image content is rejected explicitly |
| Pi | `files.attach_images` or native `read` image result with image-capable model registration | Preserved |
| Stirrup | `view_image` tool result | Preserved |

An OpenCode image attachment that only carries a remote URL or path remains in
ACTF but cannot form multimodal SFT, because export never reads files or
accesses the network. The sample therefore retains raw/ACTF and records SFT as
unavailable.

## 5. File locations

```text
<run>/
├── lock.json
├── sft.jsonl
└── samples/<model>/<index>_<task>/
    ├── trace.jsonl
    ├── trace_ACTF.json
    ├── trace_SFT.json          # linear samples
    └── sft_segments/          # compacted samples
        ├── 0001.json
        └── 0002.json
```

For a User Simulator rollout, the Task Agent SFT is in the root sample. The
simulated user's own SFT is at `user_simulator/trace_SFT.json`. Run-level
`sft.jsonl` aggregates only the Task Agent.

## 6. Parallel tool result ordering

Tools called in one assistant message may finish in any order. SFT export pairs results by `tool_call_id` and emits tool messages in that assistant message's `tool_calls` array order. It does not sort by tool name or lexicographic ID, or move results across steps. Duplicate, missing, unmatched and name-mismatched results still fail conversion.

Images are appended to the top-level `images` list after ordering results, so the Nth `<image>` still maps to `images[N-1]`. Raw traces and ACTF observation order remain unchanged, so the actual completion order can still be inspected. This rule makes the order of training output canonical; results in reversed order were not necessarily mispaired when consumed by ID. Existing SFT files are not rewritten automatically; re-export them to apply this ordering.

## Scores and record indexes

Collection writes `sft_index.jsonl` beside `sft.jsonl`, and `sft_segments_index.jsonl` beside `sft_segments.jsonl`. Each index has one line per training record in the same order, with task ID, model, Harness, sample path, benchmark, category and score. Training records retain their original schema.

```bash
roller export RUN_DIR --format sft --min-score 0.5 --output training
```

This rebuilds the datasets and indexes from samples, retaining scores at least 0.5 and excluding unscored samples. Without `--min-score`, collection and export retain successful, training-eligible samples even at zero score. Scores use the same benchmark adapter as `roller bench report`.

## XTuner export

`roller export RUN_DIR --format xtuner --output DIR` writes a single merged `xtuner.jsonl` (combining unsegmented rollouts and compaction segments) alongside a line-for-line `xtuner_index.jsonl`, and supports `--min-score`:

```bash
roller export runs/my-run --format xtuner --min-score 0.5 --output training-xtuner
```

Key transformations applied during XTuner export:

- Images are extracted to `<output>/media/` with EXIF-oriented `image_wh` metadata (`--inline-images` keeps base64 data URIs inline).
- `tool_calls[].function.arguments` JSON strings are parsed into JSON objects.
- For compaction segments, `target_start_index` is translated into per-message `"loss": false` on earlier assistant turns.
