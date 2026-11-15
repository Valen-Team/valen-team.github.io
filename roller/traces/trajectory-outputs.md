---
title: "Trajectory output file guide"
---

# Trajectory output file guide

`roller collect` saves traces, training data, run information, and task outputs.
This guide describes their contents, when they are created and retained, and how
to use them for training, analysis, and debugging.

## 1. Quick reference

| Need | Preferred file | Why |
| --- | --- | --- |
| Train a Task Agent directly | Run-level `sft.jsonl` | One minimal SFT record per line, ready for streaming reads |
| Inspect a legacy training record | Sample-level `trace_SFT.json` | Identical to the matching record in `sft.jsonl` |
| Inspect compacted context | Sample-level `sft_segments/*.json` | Separate opt-in records with an explicit target mask |
| Read all compacted records in a run | Run-level `sft_segments.jsonl` | Aggregates the same masked segment records in request order |
| Trajectory analysis, scoring, token stats | `trace_ACTF.json` | Has step, reasoning, observation, metric, and timing |
| Trace Harness session raw events | `trace.jsonl` | OpenClaw, Codex, Claude Code, Hermes, OpenCode, DeepSeek, or Pi native session; Roller does not clean it for training |
| Inspect the first system prompt captured into ACTF | Top level of `trace_ACTF.json` | Taken from whichever native/cache/wire source each Harness can obtain, frozen once |
| Check whether the OpenClaw system prompt changes per call | `cache_trace.jsonl` from `--wire-trace full` | Keeps a diagnostic record of every OpenClaw LLM call |
| Check the request history and tools received by the model | `wire_trace.jsonl` from `--wire-trace full` | Saves each JSON request body forwarded by the proxy |
| Inspect Task Agent delivered files | `results/` | Recovers only the output directories the task declared plus extra collect paths |
| Inspect the dialogue both sides can see | `conversation.json` | Does not include hidden reasoning, tool calls, or tool results |
| Use a trajectory in Harbor or another ATIF tool | `trajectory.json` from `roller export` | ATIF document converted from ACTF, with images stored as files |

Use SFT for training and ACTF for analysis. When troubleshooting Harness execution, context assembly, or model-service behavior, inspect the native session in `trace.jsonl` and complete request records in `wire_trace.jsonl`.
Complete request records repeat conversation history across turns and grow quickly, so they are unsuitable for direct use as training data.

## 2. Directory layout

### 2.1 Default ordinary rollout

OpenClaw defaults are `--cache-trace --wire-trace actf --keep-thinking`; Codex
disables web search by default and keeps the reasoning content or summary that
is visible in the native session; Claude Code keeps plaintext thinking
blocks from the native session. The main layout of a successful run is the same
for all seven Harnesses:

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
            └── results/                 # present when the task output contains files or directories
```

OpenClaw's default `actf` wire mode temporarily captures the tools schema, writes
it into ACTF/SFT, then deletes the intermediate `wire_trace.jsonl` and
`cache_trace.jsonl`, reducing the final sample size. Codex's default `actf`
captures original Responses tools through an HTTP proxy when `--api-base` is configured,
and retains `tools_capture.jsonl` after conversion. Claude Code temporarily captures the Anthropic system and full
`input_schema` when `--api-base` is set explicitly; with no API base or with
`--wire-trace off`, it derives a permissive schema from actual `tool_use`.

### 2.2 `--wire-trace full`

`full` mode also keeps the diagnostic layer:

```text
<index>_<task>/
├── trace.jsonl
├── trace_ACTF.json
├── trace_SFT.json
├── cache_trace.jsonl              # OpenClaw only
├── wire_trace.jsonl
├── info.json
└── results/                       # optional
```

### 2.3 User Simulator rollout

A dynamic task stores the Task Agent in the root sample and the Simulator in a
subdirectory:

```text
<index>_<task>/
├── trace.jsonl                    # Task Agent raw
├── trace_ACTF.json                # Task Agent ACTF
├── trace_SFT.json                 # Task Agent SFT
├── conversation.json              # clean alternating dialogue visible to both participants
├── info.json                      # total usage and index of both participants
├── user_simulator/
│   ├── trace.jsonl                # Simulator raw
│   ├── trace_ACTF.json            # Simulator ACTF
│   ├── trace_SFT.json             # Simulator SFT
│   └── info.json                  # Simulator status and usage
└── results/                       # Task Agent only; optional
```

Run-level `sft.jsonl` aggregates only the Task Agent in the root directory. It
does not include User Simulator SFT.

## 3. Data path from a run to a training set

A trajectory is produced in this order:

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
trace.jsonl + system/tools available to the Harness ──> trace_ACTF.json
trace_ACTF.json ── linear ───────────────────────> trace_SFT.json ──> run/sft.jsonl
captured Calls ──── compaction ──────────────────> sft_segments/ (opt-in)
```

The following figure shows the same data path, including the files that are enabled by flags (dashed).

![Trace data pipeline: the Harness session is copied to trace.jsonl and converted to trace_ACTF.json, which yields trace_SFT.json and sft.jsonl; --capture-calls enables compaction segments and --wire-trace full keeps request bodies in wire_trace.jsonl](/img/roller/pipeline-en.png)

`trace.jsonl` records events from the current Harness session. ACTF converts
those events into an analysis format; SFT removes fields that training does not
need. SFT is not used to generate ACTF or raw.

### 3.1 The three files answer three different questions

| File | Capture point | Can answer | Cannot be used to claim |
| --- | --- | --- | --- |
| `trace.jsonl` | Harness session export layer | Which user/assistant/tool events the Agent recorded, in what order, with what usage | Which full history a given request carried; verbatim upstream HTTP request/response |
| `cache_trace.jsonl` | OpenClaw context-assembly diagnostic point | The assembled system prompt and related diagnostic stages for each LLM call | Full messages/input and final provider request parameters |
| `wire_trace.jsonl` (`full`) | After the Harness provider adapter, before the real model API | The JSON body forwarded by Roller's proxy, including messages/input, tools, and sampling parameters | How the model service tokenizes, truncates, or routes the request internally |

### 3.2 Session history is not the model request context

The presence of a message in `trace.jsonl` means only that it entered the Harness
session record. It does not mean that it was sent verbatim on every later model call. OpenClaw
builds a runtime context from the session, bounded by the context window. Its
official docs distinguish the persisted transcript from the model context:
compaction replaces older history with a summary and keeps recent messages;
pruning can remove old tool results from the in-memory prompt without rewriting
the on-disk transcript. A plugin context engine and runtime hooks can also take
part in context assembly. See
[OpenClaw Context](https://docs.openclaw.ai/concepts/context) and
[Session Management and Compaction](https://docs.openclaw.ai/reference/session-management-compaction).
The exact compaction, pruning, and persistence behavior depends on the OpenClaw
version in the image, the model profile, and the chosen context engine. Roller
does not infer those transforms from session files; it captures full wire at the
final API request boundary. Codex likewise inserts base/developer instructions,
environment context, a tool namespace, resume history, and compaction results
between the native session and the Responses input; that final shape can only be
confirmed from full wire. Claude Code's native session is also not an Anthropic
Messages request: the CLI adds system blocks, a tools schema, project/context
instructions, cache markers, and conversation-management results. To inspect
the model request, use Claude Code `--wire-trace full`.

Session records and requests can differ in these ways:

- Present in the session, absent from the model request: old tool results were
  pruned, history was compacted into a summary, or messages were filtered by
  window or provider rules;
- No matching per-event record in the session, but present in the model request:
  the assembled system prompt, tools schema, workspace/bootstrap injection, or
  per-turn runtime context / hook additions;
- Still present, but represented differently: the Harness/provider adapter can
  turn internal messages/blocks into the final Chat Completions `messages` or
  Responses `input` protocol shape.

Use `trace.jsonl` to review the Agent's logical trajectory and `wire_trace full`
to inspect the JSON context sent in each HTTP model request. ACTF/SFT are
converted from session raw and cannot reconstruct each request
after compaction, pruning, or temporary context injection.

## 4. How the core trace files differ

### 4.1 `trace.jsonl`: Harness-native raw trace

OpenClaw content includes raw message events from the transcript: user,
assistant, thinking, tool call, tool result, usage, and so on. In the default
image, Roller reads events by exact session identity through the public
`openclaw/plugin-sdk/session-transcript-runtime`, then serializes them one by
one as JSONL. It does not delete, merge, or reorder valid events for training.
In this context, "raw" is relative to Roller's ACTF/SFT conversion. It is not a byte copy of
the underlying SQLite/JSONL file, and it is not a network-level raw request or
response. The SDK returns only transcript events that OpenClaw recognizes, so
corrupt lines or non-event records in the underlying store do not appear in the
export. Roller copies the session JSONL directly only when a legacy OpenClaw
build does not provide that SDK.

Codex content comes from the native JSONL under `$CODEX_HOME/sessions` in the
rollout container, including `session_meta`, `turn_context`, `response_item`,
`event_msg`, compaction events, and token usage. Codex raw is likewise a
Harness-private schema. It is not the `codex exec --json` terminal display
stream, and it is not an HTTP wire trace.

Claude Code content comes from this rollout's main session under
`$CLAUDE_CONFIG_DIR/projects` plus its `subagents/*.jsonl`. Roller merges by
timestamp, deduplicates by native `uuid`, and keeps user, assistant, thinking,
signature, `tool_use`, `tool_result`, usage, and sidechain fields. It is not the
`claude --output-format=stream-json` terminal stream, and it is not a
byte-for-byte concatenation of the source files.

Sample `info.json.trajectory.raw_schema` is marked `openclaw-session-jsonl`,
`codex-session-jsonl`, or `claude-code-session-jsonl` respectively.

Generation conditions:

- The Harness container has started and the finish phase can export a non-empty
  native session. The OpenClaw legacy path requires the specified session JSONL
  or the latest fallback; the Codex path requires the latest native rollout
  JSONL; the Claude Code path requires the latest main session in this
  container;
- If the Harness returns success but a non-empty raw trace cannot be obtained,
  the sample becomes `error`;
- If the Harness itself is `error` or `timeout`, raw is still kept whenever a
  transcript can still be exported.

Uses and limits:

- Suitable for tracing upstream fields, event order, and conversion issues;
- The structure belongs to the Harness and is not a stable training schema;
- It cannot by itself verify context compaction, tool-result pruning, or the
  real request after provider adaptation. All seven Harnesses should use
  `--wire-trace full`;
- Chat Completions `reasoning` / `reasoning_text` may be normalized to
  `reasoning_content` before they enter OpenClaw, so later turns can be replayed.
  The thinking text is unchanged, but the field signature and the upstream HTTP
  response are no longer a verbatim match;
- `--no-keep-thinking` does not modify raw, so raw can still contain thinking
  produced in the current turn. That flag affects ACTF/SFT; it is not a raw
  redaction switch. OpenClaw can also strip later request history at the wire
  layer; Codex and Claude Code only control the export and do not rewrite
  `resume` / `--continue` context.

### 4.2 `trace_ACTF.json`: unified analysis trace

The ACTF top level stores `schema_version`, `system_prompt`, the full `tools`,
`steps`, and trajectory timing. Each assistant message becomes one step. A step
contains:

- `user_content`: user input for this turn;
- `assistant_content.reasoning_content`: visible reasoning/thinking;
- `assistant_content.content`: visible reply;
- `assistant_content.tool_calls`: tool calls;
- `observation`: tool results after those calls;
- `metric`, start/end time, and stop reason.

Generation conditions:

- The Harness has obtained `trace.jsonl`, and the matching adapter can produce
  canonical ACTF;
- OpenClaw system/tools come from cache/wire capture. When missing, system is
  `""` and tools is `null`;
- Codex system comes from native base instructions, developer/system messages,
  and `<environment_context>` before the first turn. The task user message is
  matched to the corresponding turn by content. Original tools come from Responses request capture, including unused tools.
  ACTF retains the native definitions and per-request snapshots in `tools_capture`;
  missing, changing, or unsupported definitions make SFT unavailable.
- Claude Code merges streamed native events that share the same `message.id`,
  writes plaintext `thinking/reasoning/analysis` into `reasoning_content`, and
  associates `tool_use_id` with a later `tool_result`. Ciphertext
  `redacted_thinking` stays in raw and is not converted to plaintext.
  When wire is present, system/tools come from the Anthropic request; otherwise
  system is `""` and a permissive schema is derived from actual `tool_use`.

OpenClaw ACTF freezes only the first valid assembled system prompt from the
cache trace and the first non-empty tools schema from the wire trace at the top
level. Codex ACTF uses native system events and original request tool definitions. Claude Code ACTF uses the first captured Anthropic system/tools, and
falls back to native derivation when there is no wire. None of them store the
full messages/input of every request per step. Codex additionally retains
per-request tool snapshots and rejects changing tools in SFT. Use full wire to inspect those changes;
OpenClaw can also combine it with the full cache trace.

As long as raw exists, Roller attempts conversion, including samples whose
Harness already failed or timed out. A failed sample may therefore still have
ACTF. Explicitly recorded conversion unavailability is stored in
`runtime.trajectory_conversion`, separately from the Harness collection status.

### 4.3 Sample-level SFT records

Linear SFT is generated from ACTF as `trace_SFT.json`. For main-agent
compaction, Roller reconstructs windows from captured Calls and writes
`sft_segments/0001.json`, `0002.json`, etc., only when root Calls correspond
one-to-one with ACTF main steps, apart from summary Calls recorded by native
compaction rows. Otherwise SFT is marked unavailable while
the raw trace and capture remain. Text-only linear records contain
these top-level fields;
image records also contain `images`:

```json
{"messages": [], "tools": []}
```

It removes schema version, task/model, usage, metric, step ID, stop reason,
timestamps, run paths, and observation metadata. An assistant always stores
`role`, `reasoning_content`, `content`, and `tool_calls`. A tool message stores
only `role`, `tool_call_id`, and string `content`.

SFT expresses the logical conversation reconstructed from session events. It is
not a snapshot of each provider request. It is suitable for training, but not
for per-request replay or for proving that an earlier tool result was still
visible in a later model call.

Compaction segments instead start with the actual captured request context.
Their extra `target_start_index` marks the first supervised assistant message;
subsequent assistant messages are targets, while intervening user/tool messages
remain context. Segment metadata in `info.json` records paths, order, boundary
source, and Call IDs. If captured input cannot be represented faithfully,
Roller records SFT as unavailable and retains raw/ACTF evidence.
With `--no-keep-thinking`, reasoning is cleared from segment prompts as well as
targets, matching linear SFT.
These segments require an opt-in reader that honors the target mask. The
legacy run-level `sft.jsonl` remains linear-only.
When valid segments exist, the run root also contains `sft_segments.jsonl`
with those records in request order. Its reader must honor `target_start_index`.


Generation conditions:

- ACTF conversion succeeded;
- There is at least one user message and one non-empty assistant message;
- Every tool call has a non-empty, globally unique ID;
- Every tool call has exactly one tool result in the same step;
- The called tool exists in the top-level tools schema;
- Function arguments can be encoded as a JSON object; Codex custom input remains a string;
- User content and tool results are strings, text blocks, or image blocks with
  embedded base64 bytes.

Codex preserves native Responses tool definitions, namespaces, and custom grammars.
Other harnesses normalize flat/nested functions to nested function schemas. An image in a user message or tool result is exported as an `<image>`
placeholder plus a top-level `images` data-URI list; see
[SFT data format](/roller/traces/sft-format/) for the alignment contract. Content that
cannot be exported losslessly still fails conversion: audio or other unknown block types,
unsupported media types, malformed base64, or an image block that only
references a path. The Collector records
`target: "sft"`, `status: "unavailable"`, and the reason in
`runtime.trajectory_conversion`, retaining the collection status and raw/ACTF.
Aggregation skips that sample; Resume does not call the model again for an
export failure. Roller never silently discards content.

See [SFT data format](/roller/traces/sft-format/) for the full field definition.

### 4.4 `sft.jsonl`: run-level training set

After the Collector finishes every request, it reads eligible linear
`trace_SFT.json` records in request-index order and writes the run root
atomically as a stream. It validates compaction segments and writes them to
`sft_segments.jsonl` separately, keeping this legacy dataset linear-only.

The run summary counts such a sample as `sft_segmented`, not `sft_included`
or `sft_excluded`.

- Samples with `status=ok` are included;
- `--resume` reused samples with `status=skipped` were originally `ok`, and are
  included as well;
- `error` and `timeout` are not included, even if they kept partial
  raw/ACTF/SFT;
- An empty file is still created when there are no successful samples;
- User Simulator sub-trajectories are not included.

Each line is the same JSON object as its matching sample-level SFT record. No task ID
or other metadata is added. Sample provenance must be recovered from the
adjacent run/sample `info.json` and from directory location.

### 4.5 ATIF export: `trajectory.json` {#atif-export}

`roller export RUN_DIR` converts the ACTF of every sample to
[ATIF](https://github.com/harbor-framework/harbor/blob/main/rfcs/0001-trajectory-format.md),
the Agent Trajectory Interchange Format that
[Harbor](https://github.com/harbor-framework/harbor) reads. It runs on an
existing run, reads `trace_ACTF.json` and the sample `info.json`, and does not
modify the run.

```text
<run>/atif/                          # or the directory given with --output
└── <model>/
    └── <index>_<task>/
        ├── trajectory.json
        └── images/                  # present when the trajectory contains images
```

Every sample that has `trace_ACTF.json` is exported, including failed and
timed-out samples, and the document records the sample status. Samples without
ACTF are reported as skipped. Like `sft.jsonl`, the export covers the Task
Agent and does not include User Simulator sub-trajectories.

The documents declare `ATIF-v1.7`. Their fields come from these sources:

| ATIF field | Source |
| --- | --- |
| `session_id` | `<run-name>/<model>/<index>_<task>` |
| `agent.name`, `agent.version`, `agent.model_name` | Harness name, Harness version, and model in the sample `info.json` |
| `agent.tool_definitions` | ACTF top-level `tools` |
| `system` step | ACTF top-level `system_prompt` |
| `user` step | `user_content` of an ACTF step, when it is not empty |
| `agent` step | `assistant_content` of the same ACTF step, as `message`, `reasoning_content`, and `tool_calls` |
| `observation.results` | ACTF `observation`, with `source_call_id` linking each result to its call |
| `metrics` | `prompt_tokens_len`, `completion_tokens_len`, and the cache-read count of the ACTF `metric`; the remaining metric fields go to `metrics.extra` |
| `final_metrics` | Sums of the step metrics, and `cost_usd` from the sample `info.json` |
| `extra.roller` | Task ID, sample index, status, error, and bench scores |

One ACTF step becomes one or two ATIF steps, so `step_id` values differ between
the two files. Images are written to `images/`, named by content hash, and
referenced by relative path. A content block that is neither text nor an image
is kept as its JSON text.

ACTF fields without an ATIF counterpart are kept in the `extra` object of the
same tool call, result, or step, under their ACTF names. Examples are `isError`
and `details` of a tool result and `finished_at` of a step. ATIF only lets a
result refer to a call of its own step; a result whose call is in another step
has no `source_call_id` and keeps `toolCallId` in `extra`.

Harbor can validate an exported file and load it into a Claude Code or Codex
session:

```bash
python -m harbor.utils.trajectory_validator runs/demo/atif/MODEL/0000_TASK/trajectory.json
harbor run -p TASK_DIR -a claude-code -m MODEL --load-trajectory runs/demo/atif/MODEL/0000_TASK/trajectory.json
```

## 5. Diagnostic and auxiliary files

### 5.1 Run `lock.json`

`lock.json` is written before collection so one run cannot mix samples that were
parsed under different configurations. It freezes request order, the Task Bundle
digest, model/Harness configuration, the image ID, and options that change
trajectory meaning, such as thinking and wire/cache trace. Resume compares field
by field. A mismatch prints a limited set of differing paths and stops before
the Harness starts.

The lock does not store credentials: sensitive key values are replaced with
`<redacted>`; URL userinfo and fragment are removed; sensitive query values are
replaced; non-sensitive query keys such as `api-version` are kept for
comparison. Changing a credential or pass-through env value does not make the
lock mismatch. If those values would change actual model behavior, start a new
run. Configuration objects are compared directly; task/input/context reuse the
digests the Task Bundle already has.

### 5.2 Run `info.json`

The CLI writes initial run information before collection starts. The Collector
updates it on the first result, then after every additional 25 results, and also
immediately when two completion events are at least 30 seconds apart. It forces a
checkpoint on interrupt and during finalization. It stores:

- Roller version and collection configuration;
- Current `state`: `initializing`, `running`, `finalizing`, `finished`,
  `interrupted`, or `finalization_error`;
- Live `total/processed/pending` progress;
- Task/model request counts;
- `ok`, `error`, `timeout`, `skipped` totals;
- Token, cache, cost, and request-count totals;
- Per-sample status, error, path, and usage.

A catchable interrupt such as `Ctrl-C` immediately cancels samples that are
still queued and only waits for running samples to finish normally (collecting
traces and removing containers). It then writes `state=interrupted` and attempts
to build a partial `sft.jsonl` from already completed samples. `SIGKILL`, power loss, or host
failure cannot perform that last write, but atomic writes and periodic
checkpoints keep `info.json` as the previous complete snapshot. The Viewer also
scans already finalized samples.

### 5.3 Sample `info.json`

This file is written when a sample is finalized, including failed samples.
It stores task/model, Harness, final status, error, attempt history, usage,
elapsed time, relative paths to raw/ACTF/SFT, output recovery information,
runtime, and input provenance. Metadata excluded from training data is
kept here.

OpenClaw sessions sometimes record an already delivered reply again with
`api=cli`; genuine CLI-backend replies use that marker too. Roller does not
remove messages based on the marker alone. It deduplicates tokens and request
counts only when usage matches within the same turn and the CLI source matches
the latest provider reply's provider/model. A message is omitted only when its
final text matches the delivered text. Matched gap fills keep new text without
repeating step tokens and update the delivered text, so repeated delivery adds
neither another message nor usage.

Independent, structured, failed, or cross-source CLI replies keep their content
and usage and suspend delivery matching until another provider reply arrives.
They do not clear the provider accounting history. Only user, session, and
compaction events clear the turn history; late delivery from an older source is
not inferred. Token parsing also accepts `input_tokens/output_tokens`. Explicit
native `input/output` fields take precedence, including malformed values, so
aliases cannot hide invalid native counters.

OpenClaw 2026.7.1 CLI aggregates can combine cumulative input/output/cache
counts with the last call's `totalTokens` (context usage). Aggregate matching
requires all four components to match individually, and the total must equal
either the recorded cumulative total or the last call's positive total. Roller keeps
the provider-call accounting without adding that context total again. When
the latest same-source call failed, a CLI fallback is still counted separately.
After a provider retry succeeds, aggregate matching includes valid usage and
cost reported by earlier failed calls as well.

`cost_usd` credits only the missing amount for the matched call or the turn's
calls so far. If a provider omits cost and two CLI mirrors each report `$0.05`
for that call, the total remains `$0.05`. Per-call costs and later turn totals
covering those calls do not add up twice. A cost-only CLI mirror without token
fields is credited to the latest call only when final text and source match.
Conflicting cost reports retain the higher known amount rather than applying
refunds; these are session-reported costs, not reconciliation with a provider's
billing records.

This processing does not modify raw. Re-parsing retained raw after upgrading can produce updated
statistics, but resume does not recompute usage cached in existing `info.json`.

### 5.4 `cache_trace.jsonl`

OpenClaw `diagnostics.cacheTrace` records the assembled system prompt of every
LLM call. It is enabled by default. Roller copies it, recursively redacts
sensitive keys, then uses it to fill the ACTF top-level `system_prompt`.

- Default `--wire-trace actf`: used for conversion, then deleted;
- `--wire-trace full`: kept in the final sample;
- `--no-cache-trace`: not created; ACTF/SFT system content is `""`.

The ACTF top level uses only the first `stream:context.system`, falling back to
the first `session:loaded.system` when that stage is missing. If the system
prompt changes across calls, only the original cache trace kept in full mode can
show each difference. The ACTF top-level value does not represent every step.

Redaction is based on JSON keys. It does not scan secrets in the free text of
the system prompt. This file and the downstream ACTF/SFT should still be treated
as sensitive data.

### 5.5 `wire_trace.jsonl` {#wire-trace-jsonl}

A local reverse proxy records wire data before the request is sent to the model
service:

- OpenClaw `actf` records only the model, non-message parameters, message count,
  and the first non-empty tools schema. It does not record full messages/input.
  That temporary file is deleted after conversion;
- Codex `actf` captures original tool definitions over HTTP when an API base is configured;
  `tools_capture.jsonl` is retained while the temporary wire file is deleted;
- Claude Code `actf` temporarily records the first Anthropic system/tools and
  non-message parameters when an API base is set explicitly, then deletes the
  file after conversion;
- `full` saves every complete request body and keeps it in the final sample;
- HTTP Authorization and other headers are not written to the file, but a
  complete request body may contain the system prompt, user data, tool results,
  and historical reasoning. `full` does not automatically redact that free
  content.

For a parseable JSON request, the proxy first applies the semantic rewrites the
current rollout needs, then records and forwards the same body. OpenClaw
`--no-keep-thinking` strips historical reasoning first. Codex full wire may include
`input[].type="additional_tools"`, the programmatic tool namespace, which Roller leaves unchanged.
Full wire shows the semantic JSON forwarded to the model API, not the Harness request before processing.

Claude Code full wire saves the Anthropic `/v1/messages` request `system`,
`messages`, `tools`, thinking/output config, and sampling parameters. Roller
does not rewrite Claude Code message history. The transport-only `beta=true`
query and `anthropic-beta` header added by Claude Code 2.1.222 are removed
before forwarding. Full wire keeps the original target in `path`, records the
actual target in `upstream_path`, and records only the removed header names in
`dropped_request_headers`.

Limits:

- This is a request-side JSON record, not a TCP/HTTP byte-level capture.
  Serialization details such as JSON whitespace and field order are not part of
  the audit semantics;
- It does not record request headers, upstream response bodies, or streamed
  chunks. Response content should still be read from session raw/ACTF, which is
  already the event stream after Harness parsing;
- It can only prove what Roller's proxy forwarded, not whether the model service
  later truncated, tokenized, rewrote, or routed the request again;
- Wire writes are best effort: a single record failure does not block the model
  call. For a strong audit, check that `seq` is contiguous and confirm
  completeness against sample usage/request count and run logs;
- Multi-turn requests repeat history, so file size is close to O(N²). Use it
  only for audit and debugging.

### 5.6 How to audit context compaction or rewriting

1. Run a minimal reproducible task with `--wire-trace full`. For OpenClaw, also
   keep the default `--cache-trace`. Do not use default `actf` as a substitute
   for full: it does not save messages/input.
2. Compare each `body.messages` (Chat Completions or Anthropic Messages) or
   `body.input` (Responses) in `wire_trace.jsonl` `seq` order. Also check
   `body.system`, `body.tools`, and sampling parameters.
3. Compare the differences against session events in `trace.jsonl`. Do not
   expect a one-to-one line mapping: one Agent turn can contain multiple model
   requests, and each wire body repeats the history retained at that time.
4. For OpenClaw, inspect the system prompt of each `stream:context` in
   `cache_trace.jsonl`. For Codex, compare `instructions`, developer input, and
   environment context across full-wire requests. For Claude Code, compare
   `system/messages/tools` and thinking/output config.
5. If OpenClaw used `--no-keep-thinking`, treat full wire as the evidence of
   model-visible history. Reasoning kept in session raw is diagnostic only and
   does not mean it was sent on later requests. For Codex and Claude Code, that
   flag only controls the export.

After the audit, protect or delete cache/wire files separately. They may contain
repeated user input, system prompts, tool results, reasoning, file contents, and
runtime injections.

### 5.7 `results/`

Created only when the task output directory contains ordinary files or
directories. Roller:

- Copies every safe ordinary file and keeps the relative path;
- Records path, size, MIME, and SHA-256 in sample `info.json`;
- Rejects symbolic links and special files;
- Still copies safe files even when unsafe files are present, but the sample's
  final status becomes `error`;
- Places compatible `--collect-path` output in `results/legacy/`.

`results/` is Agent deliverable output. It is not conversation training data and
is not written into `sft.jsonl`.

### 5.8 `conversation.json`

Created only for User Simulator tasks. It stores the user/assistant turns both
sides can see, the termination reason, instructions that were pending but not
delivered, participating models, and timing. It does not copy hidden reasoning,
tool calls, or tool results from either side. To train or analyze either
participant, use that participant's own raw/ACTF/SFT.

## 6. How flag combinations change traces

### 6.1 Wire trace

| Harness / mode | Proxy requirement | ACTF tools | Final auxiliary files | When to use |
| --- | --- | --- | --- | --- |
| OpenClaw `actf` (default) | Enabled when a proxyable `baseUrl` exists; degrades when missing | Full schema when capture succeeds, otherwise `null` | cache/wire not kept | Regular batch collection |
| Codex `actf` (default) | Configured API base, HTTP, host network | Original Responses definitions; no inference | `tools_capture.jsonl` | Regular batch collection |
| Claude Code `actf` (default) | Starts when `--api-base` is set explicitly | Captures Anthropic `input_schema`; derives from native when there is no proxy | wire not kept | Regular batch collection |
| OpenClaw `full` | Provider must have an absolute `baseUrl` | Full schema | `wire_trace`, plus `cache_trace` when cache is enabled | Request-level audit |
| Codex `full` | API base, HTTP, host network required | Original Responses definitions | `wire_trace`, `tools_capture.jsonl` | Request-level audit |
| Claude Code `full` | Must set `--api-base --network host` explicitly | Captures Anthropic `input_schema` | `wire_trace` | Request-level audit |
| `off` | Does not start a proxy for recording | OpenClaw/Codex are `null`; Claude Code derives from native | none kept | Minimal diagnostics-off mode |

After OpenClaw `off` or a degraded `actf`, SFT validation fails for missing tool
schema if the trajectory contains tool calls. When there are no tool calls,
SFT `tools` is `[]`. Claude Code retains its native schema fallback. Codex never
infers schemas: absent capture (including `off`, WebSockets, or no API base),
changing definitions, and programmatic `additional_tools` make SFT unavailable.
See [Codex tool capture](/roller/harnesses/codex-configuration/#9-trajectories-and-request-recording).

### 6.2 Thinking

| Flag | Current reply | Later request history | ACTF | SFT | raw |
| --- | --- | --- | --- | --- | --- |
| `--keep-thinking` (default) | Accept the backend output as returned | Keep normal Harness history | Save visible reasoning | Save from ACTF | Keep original events |
| `--no-keep-thinking` | The current turn can still produce reasoning | OpenClaw strips later wire history; Codex/Claude Code do not rewrite resume/continue | Reasoning emptied | Reasoning emptied | Original events still kept |

`--thinking LEVEL` sets the reasoning level in the Harness/model request.
Whether reasoning text can be saved depends on the service response. See
[Thinking configuration](/roller/harnesses/openclaw-configuration/#6-thinking-configuration)
for GPT native effort, open-model profiles, and OpenClaw image limits, and
[Thinking configuration](/roller/harnesses/claude-code-configuration/#6-thinking-configuration)
for the Claude Code mapping. When the backend reports only reasoning tokens and
does not return a reasoning summary/content, ACTF/SFT have no
`reasoning_content` to save. A GPT compacted summary enters that field as-is;
encrypted reasoning does not enter SFT.

The default `--keep-thinking` retains visible reasoning returned by the service. This includes GPT summaries, Claude visible thinking, and plaintext reasoning returned by open models.

When a reasoning effort was explicitly requested, sample `info.json` records
`runtime.thinking_audit`. This audit counts only visible reasoning retained in
ACTF. If `off` was requested but visible reasoning is still present, its status
is `mismatch` and Roller records a runtime warning without deleting or changing
the returned text. With `--no-keep-thinking`, the status is `not_observable`:
an empty exported field is not evidence that the model performed no hidden
reasoning.

Samples with a `mismatch` keep their execution status and per-sample SFT for
inspection, but record `runtime.sft_eligibility = {"eligible": false,
"reason": "thinking_effort_mismatch"}` and are excluded from `sft.jsonl`,
including on resume. `no_visible_reasoning` is not proof that reasoning was
disabled. Failed or timed-out samples retain available raw/ACTF evidence but
do not export per-sample SFT.

Before pruning auxiliary traces, both agent and user-simulator archives record:

- `runtime.wire_effort_audit`: checks each outgoing request, including retries.
  Explicit conflicts are `mismatch`; omitted controls, budgets alone, and unknown
  encodings are `unverified`; missing readable requests are `not_observable`.
  Default `actf` mode also reads native request snapshots for Pi, DeepSeek,
  Hermes, and OpenCode when no wire requests were captured. `source` identifies
  the evidence used. The audit survives pruning.
  `matched` describes client parameters, not provider compliance.
- `runtime.completion_audit`: flags a final `length`, `max_tokens`, or
  `max_output_tokens` stop, or an empty text answer without tool calls, as
  `incomplete`. Unknown/missing stop reasons are not inferred. `not_flagged`
  does not mean the task passed. A final observed response with `incomplete` or
  a token-limit finish reason also flags truncation, even if ACTF says `stop`;
  an earlier truncated request followed by a completed request does not.
  `actf_completion_audit` retains the original ACTF finding when overridden.
- Explicit wire mismatches and these incomplete trajectories set
  `sft_eligibility.eligible=false`, excluding them from the agent aggregate.
  Omitted controls alone do not trigger exclusion. Convertible per-sample SFT
  remains diagnostic evidence. Failed/timed-out simulator archives also omit SFT;
  successful simulator artifacts retain diagnostics and never enter the agent
  aggregate. Resume does not backfill new audits on previously collected samples.

When strict conversion produces no ACTF, Pi/OpenClaw can record
`completion_audit.source=native` from completed native assistant messages,
ignoring context history and partial deltas. Unknown schemas remain unobservable;
conversion is not relaxed and failed SFT is not exported.

The proxy extracts model names and finish reasons from JSON/SSE responses into
wire `response_metadata` events linked by `request_seq`, without retaining
additional response text. Archived `runtime.model_identity_audit` records each
wire `requested_model`, `response_models`, and `finish_reasons`. A `name_mismatch`
produces a warning but no automatic training exclusion: aliases can be legitimate.
These are server-declared names, not proof of actual backend routing. Compressed
or unknown protocols, missing fields, and capture limits do not imply a match.
The runtime audit survives default actf-mode wire pruning.

The terminal completion message and run `summary.training` report SFT inclusion/
exclusion, thinking mismatches, and unverified/not-observable wire audits. Counts
refer to processed primary-agent samples, including resumed ones, not HTTP
requests or simulators. Categories can overlap; missing legacy audits do not
imply a match. Reporting shares the export exclusion policy; it adds no strict
switch and changes neither execution status nor CLI exit codes. Inclusion does
not imply that a task grader passed.

Even with `--wire-trace off`, `--no-keep-thinking` must still start a proxy to
strip request history, so OpenClaw still requires a proxyable `baseUrl` in
`--model-config`. Codex and Claude Code do not perform that history stripping.

### 6.3 Cache trace (OpenClaw)

| Flag | ACTF/SFT system | `cache_trace.jsonl` |
| --- | --- | --- |
| `--cache-trace` (default) | Use the first captured assembled system prompt | Kept in the final sample only in full mode |
| `--no-cache-trace` | `""` | Not created |

If training needs the first assembled system prompt the Agent captured, do not
turn cache trace off. To reproduce the context of every model call,
ACTF/SFT alone is not sufficient; full cache/wire must also be kept.

## 7. Success, failure, retry, and Resume

### 7.1 Success guarantees

An ordinary sample with status `ok` normally has:

- `trace.jsonl`;
- `trace_ACTF.json`;
- `trace_SFT.json`;
- `info.json`.

A User Simulator sample also guarantees a root `conversation.json` and the
Simulator's own raw/ACTF/SFT. `results/`, cache trace, and wire trace are always
conditional artifacts. They are not required for success. A lossless projection
may also be impossible for some native attachment or multimodal events. In that
case the sample remains a valid evaluation result, `runtime.trajectory_conversion`
records whether ACTF or SFT is unavailable, and run-level `sft.jsonl` skips it.

### 7.2 Failed samples

For an `error` or `timeout` sample, finalization still attempts to recover raw,
the system prompt, tools, and safe outputs, then convert ACTF/SFT. Any retained
complete or partial trajectory can be used for diagnosis, but is excluded from
run-level `sft.jsonl`.

These cases turn an otherwise successful Harness result into `error`:

- No raw session trace found;
- A required trajectory is missing without an explicit conversion downgrade;
- Copying the task output directory failed;
- A symbolic link or special file was found in the output;
- Either User Simulator participant failed, or its trajectory conversion
  failed.

### 7.3 Retry

`--retries N` runs at most N extra complete rollouts. Before each attempt
starts, runtime raw/cache/wire files from the previous attempt are cleaned so
attempts are not mixed. Sample `info.json.attempts` keeps each status and
elapsed time. Canonical raw/ACTF/SFT correspond to the final attempt. When the
final status is not `ok`, the sample also keeps every attempt's process logs as
`rollout/*.attempt-<N>.log` (for example OpenClaw's `gateway.attempt-1.log` and
`agent.attempt-1.log`) for troubleshooting.

### 7.4 Resume

Resume first requires the current run lock to match the old `lock.json`. Changes
to task/model order, the Task Bundle, model configuration, Docker image ID,
timeout, or trajectory-semantic options stop immediately so different collection
conditions are not mixed in one batch. If the old run has no lock, the current
lock is written and every old sample is rerun once. A durable migration marker
keeps reuse forbidden until the full recapture and run-level SFT aggregation
succeed, so leftover samples are not trusted even if the process is killed
before completion.

After the lock matches, `--resume` reuses only old samples whose status was `ok`
and that satisfy all of the following:

- Sample identity matches the current request;
- raw contains a valid message, and the ACTF schema / contiguous steps are
  valid;
- SFT is identical to the canonical projection regenerated from ACTF;
- `full` mode requires the wire trace to exist, and also requires the cache
  trace when cache trace is enabled;
- The current Task Bundle digest matches the old provenance;
- Context did not use `capture=none`;
- Output file paths are safe, the files exist, and their sizes are unchanged;
- A User Simulator task also has a valid `conversation.json`, participant info,
  and Simulator raw/ACTF/SFT.

A reused result is marked `skipped` in this run and is still written into the
new `sft.jsonl`. If any required file is missing or trajectory validation fails,
the entire sample is rerun. SHA-256 values stored in the output manifest are
not recomputed on Resume, so a routine checkpoint restart does not reread large
artifacts. For a content-level audit, verify that hash separately.

## 8. Recommended configurations

### 8.1 Batch-generate text/tool SFT

```bash
roller collect \
  --tasks tasks.jsonl \
  --model provider/model \
  --model-config models.json \
  --thinking high \
  --wire-trace actf \
  --output runs
```

Keep the default `--cache-trace` and `--keep-thinking`. This configuration
produces complete ACTF/SFT and deletes the larger diagnostic intermediate layer.

### 8.2 Debug reasoning, compaction, or request history

```bash
roller collect \
  --tasks tasks.jsonl \
  --model provider/model \
  --model-config models.json \
  --thinking high \
  --wire-trace full \
  --output debug-runs
```

Use this configuration to confirm the messages/input that OpenClaw passes
to the model API after context assembly, compaction, pruning, and provider
adaptation. After debugging, prefer to keep raw/ACTF/SFT. Delete full cache/wire
once request-level audit is no longer needed, to reduce duplicated data and
sensitive-information exposure.

## 9. Checks before publishing a training set

Check at least the following:

1. Run `info.json.summary.failed` is 0, or failed tasks have been explicitly
   excluded;
2. The number of lines in `sft.jsonl` equals the number of eligible linear
   records; compaction segments are checked separately;
3. Each line has `messages` and `tools`; image records add `images`.
   Only separate compaction segments add `target_start_index`;
4. Every assistant has `reasoning_content`, `content`, and `tool_calls`;
5. Tool call IDs and tool messages correspond one to one;
6. The tools schema is compatible with the tool format of the chat template used
   at training time;
7. System prompts, user content, tool results, reasoning, and Agent outputs have
   been reviewed for privacy;
8. If `--no-keep-thinking` was used, confirm that the raw/full diagnostic layer
   will not be mistaken for thinking-stripped published data;
9. If the dataset claims to reproduce model-visible context, confirm collection
   used `--wire-trace full`, wire `seq` is contiguous, and the request count
   matches expectations. Do not substitute ACTF/SFT for per-request evidence;

Hermes raw uses `roller.hermes-events/v1`: full request snapshots, model responses/usage, and tool messages recorded before context compression. It produces no `cache_trace.jsonl`. See [Hermes traces](/roller/harnesses/hermes-configuration/).

OpenCode raw uses `roller.opencode-events/v1`: serialized provider requests, native message/part updates, and session exports. Updates are merged by native IDs for ACTF/SFT. It produces no `cache_trace.jsonl`. See [OpenCode traces](/roller/harnesses/opencode-configuration/).

DeepSeek raw uses `roller.deepseek-events/v1`: native SDK notifications and serialized requests. It produces no OpenClaw cache trace. See [DeepSeek Harness](/roller/harnesses/deepseek-configuration/).

Pi raw uses `roller.pi-events/v1`: native events, contexts, actual requests, and turn boundaries. No OpenClaw cache trace is required. See [Pi Agent](/roller/harnesses/pi-configuration/).
