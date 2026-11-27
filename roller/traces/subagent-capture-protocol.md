---
title: "Subagent capture protocol v1"
---

# Subagent capture protocol v1

The goal of this protocol is for different Harnesses to use one set of rules for
calls, participants, relations, and integrity. Roller records execution facts;
this protocol does not define training loss or reward.

## Enabling

`roller collect ... --capture-calls` currently supports eight Harnesses: Claude Code,
OpenCode, Codex, Hermes, OpenClaw, Pi, DeepSeek, and Stirrup. The original
`--claude-capture-calls` is still kept. The option requires an explicitly specified API base, host networking, and wire trace enabled.
It is off by default; OpenCode permits the native `task` subtask tool only when this option is on.
The capture mode is written to the run configuration, and Resume cannot mix samples collected before and after it was enabled.

## Three objects

| Object | Protocol | Meaning |
|---|---|---|
| Participant | `participants` in the manifest | One native executor; one executor can have multiple calls |
| Call | `roller.call/v1` | One actual HTTP model request and its response |
| Relation | `roller.relation/v1` | Evidence-backed launch, result delivery, and context association |

`participant_id` is an opaque reference identifier. Consumers determine root/child
from `role` and must not interpret the role from the identifier prefix. A participant
identity is valid within one capture attempt; a reference across samples or
attempts must carry the sample/manifest path. `call_id` and a newly generated
`relation_id` include a random scope for the capture instance, to avoid ID collisions between different samples or different retries.

A Call's `context` keeps the complete request body that was actually sent; `output` is the reassembled provider
response. `protocol` distinguishes `anthropic-messages`, `openai-chat-completions`,
and `openai-responses`; the protocol is identified from the actual HTTP request endpoint, and each protocol keeps its own message format. The raw response file is also kept, and requests do not depend on native logs for reconstruction.
Roller does not store HTTP authentication headers and does not overwrite a child Agent's model and tool configuration with the parent Agent's configuration.

| Status | Question it answers |
|---|---|
| `execution_status` | Did the call/task finish executing? |
| `response_capture_status` | Was the response written to disk completely? |
| `identity_status` | Can the owning participant be determined? |
| `capture_status` | Is the current record complete? |
| `export_status` | Can this call enter per-call export? |

A Call is exportable only when the model response ended normally, the input and response are complete, the identity is unambiguous, the model matches, and there are no capture errors.
An abnormal Chat Completions response that has only the tool_calls finish marker and no actual tool-call
ID/name is also marked partial and barred from export. Unattributed, failed, and interrupted requests remain in the attempt's calls and raw
evidence. The overall capture status can be partial while still containing complete, exportable calls.

## Relation semantics

| type | Required evidence |
|---|---|
| `spawn` | The native tool call and the subtask identity |
| `result_delivered` | The parent task received the subtask's final tool result |
| `child_completed` / `child_failed` | Native evidence of subtask completion/failure |
| `result_in_context` | The actual input of a later parent model contains a result with the same tool-call ID |
| `launch_acknowledged` | The launch acknowledgement of a background subtask |
| `launch_ack_in_context` | The launch acknowledgement entered the parent model's actual input |

Each relation keeps references to the native file and the event/part ID. A parent model call is associated through the response message ID
or a tool-call ID in its output; when it cannot be associated uniquely, it is marked unknown. OpenClaw's
Responses SDK uses `call_id|item_id` as the native tool ID; the relation keeps the native ID and uses
`model_tool_ref` to check both the call_id and the item_id in the HTTP output; matching only one of them is not allowed. When a result enters several
later calls, each association is recorded separately. A background launch acknowledgement must not be treated as task completion.
A result delivered by notification must also be bound to the native announcement run ID (OpenClaw) or the later response ID
(Claude Code), and the notification text in the actual request must be checked; the same text appearing alone is not sufficient proof of receipt.
A Call's optional `native_identity.run_id` stores the local native call identifier; the correlation header is removed before forwarding.

## Common layer and adapter layer

The adapter layer returns only `capture_protocol.NativeCapture`: participants, identity mapping, native relations,
observable output IDs/counts, and capability declarations. The common `finalize_capture` associates HTTP calls,
determines statuses, generates context relations, and writes the files and the manifest. `model_protocols` handles
Anthropic/Chat Completions/Responses response decoding and tool-reference extraction.

| Harness | Identity evidence | Native output coverage check |
|---|---|---|
| Claude Code | The provider response ID matches the native log message ID | Per message ID |
| OpenCode | The session ID provided by `chat.headers` matches the native log | Number of completed assistants in each session |
| Codex | The native `thread-id` of each HTTP request matches the rollout session_meta | Number of token_usage updates; not per response ID |
| Hermes | The executing instance's own session ID matches the native log | Provider response ID |
| OpenClaw | The session ID of the native stream wrapper matches the session file | Number of stream contexts |
| Pi | SDK session ID | Number of completed assistants |
| DeepSeek | runner session ID | Number of completed assistants |

OpenCode's correlation header is used only in the local proxy, and the proxy removes it before forwarding to the model service. Each request carries
its own session ID, so parallel requests do not depend on a "current session" global variable. Codex's native
`thread-id` is still forwarded to the model service; only the `x-roller-*` identity headers added by Roller are removed. A native count
check is weaker than a per-ID check, and the manifest's `capabilities.native_output_coverage` records
this difference explicitly; Roller does not infer identity from time, text, or request order.

The main ACTF/SFT converts only the main participant's messages and request configuration; a subtask's internal messages stay in its own
Calls. `calls.jsonl` is per-call protocol data and cannot be used directly as main-trajectory SFT.

Older Claude Code samples may have subagent steps mixed into the main ACTF/SFT. The new Resume detects such a sample before running the model,
refuses to reuse it, and reports an explicit error, to avoid silently re-executing or carrying over an incorrect main SFT.
You can collect again with a new run directory; to keep the old execution results, first re-project and validate offline on a copy of the raw trajectory,
and do not edit the old SFT directly and then continue with Resume.

## Files and boundaries

By default each `capture/attempt-NNNN/` contains only `manifest.json`, `calls.jsonl`, and
`relations.jsonl`. `--capture-debug on-error` (the default) keeps `raw/` only when execution failed, capture is incomplete,
a model call failed, or a subtask failed; `full` always keeps it, and `off` always removes it. Native logs, raw responses, capture events, and the source mapping are stored together in
`raw/`; an event's `body_ref` references the `context` of the corresponding call in `calls.jsonl`, and the request body
is not stored a second time. Participants are associated through the manifest's `call_ids` and the Call's `participant_id`;
separate `participants/*/calls.jsonl` copies are no longer stored.

The manifest uses `roller.capture/v1`; the new layout is identified by `storage_layout: compact/v2`,
and the manifest records `debug_retention` and `raw_retained`. The optional `lifecycle` contains `status`
(complete/pending/unknown/unsupported) and `pending_participant_ids`: the end of subtask execution
and result delivery are confirmed separately, and when the status is unknown or unfinished, the whole must not be marked complete. Validation is compatible with old records that have no lifecycle.
Integrity checks finish before cleanup;
after cleanup a call's `response_path` is null, and the source of relation evidence names the original source but has
retained=false, to avoid leaving invalid file references. The capture status is not downgraded because debug material was cleaned up.
In compact mode, Resume validates the hashes of the formal files, call attribution, and relation references, and cannot re-parse the raw responses.
Reading and integrity validation are compatible with the old layout and compact/v1; working files are still used until capture closes, and they are arranged into the new layout at publication.
Use `PYTHONPATH=src python scripts/view_capture.py /path/to/attempt-0001`
to view the call tree expanded by agent; the script does not generate additional copies of the data.
Roller publishes the file hashes after closing the recorder; a missing file, a modified file, or a wrong reference prevents Resume
reuse. Even when auxiliary log retention is turned off, the formal capture evidence is not cleaned up.

## Execution boundaries of the eight Harnesses

- Claude Code: the native `-p` loop of the pinned version keeps processing background completion notifications; Roller does not append user messages to drive execution.
  Completion and the result entering context are confirmed through the notification's task/tool ID and the later response ID. An automatic notification is still user input in the main ACTF/SFT;
  it keeps the system notification wrapper from the actual request and is not treated as a real person's message or as subagent assistant output.
  One root → child → grandchild foreground delegation has been verified; when a nested return lacks toolUseResult,
  the native metadata ID, the launch event UUID, and the captured child identity must be cross-checked. A new delegation that resumes the same child
  is judged finished by its new tool ID and cannot reuse the earlier completion status.
- OpenCode: native subtask adaptation already exists; the task schema of the pinned bundled version has no background parameter.
  A background-call scenario that does not exist is not counted as passed. The native subagent_depth currently defaults to 1;
  a subagent can see task, but creating a grandchild agent is rejected by the native depth limit. The rejected trajectory is kept, and no grandchild agent identity is fabricated.
  If other native evidence shows that background execution exists, capture stays partial because no drain has been added so far.
- Codex: the native Responses output (including encrypted reasoning) and the rollouts of all threads are kept;
  spawn returns a launch acknowledgement, and wait returns the completed result. Multi-turn execution resumes through the confirmed root thread ID,
  to prevent `resume --last` from selecting the most recent child thread by mistake. The root ACTF's tool snapshot is taken only from the root thread; the complete snapshot is still stored as evidence.
  Definitions loaded dynamically by `tool_search_output` are stored in the actual Call.context and in the tool snapshot; the main SFT of such trajectories
  is not exported for now, to avoid losing the load order or fabricating a static tool list. Per-call export is not affected by this boundary.
- Hermes: when the native delegate_task creates a child instance, the parent session ID and the delegation tool ID are recorded;
  one batched tool call can correspond to multiple child instances. The native finite-query session setting is used to wait for child instances to return.
- OpenClaw: the native stream wrapper inside the pinned image records the actual context of each session;
  Roller waits until the subtasks in the native registry and the cleanup of completion notifications have finished, and then collects the files. Launch acknowledgements and completion notifications are handled separately;
  a completion notification must match both the native run ID and the parent model's actual input before result_in_context is established.
  A missing registry or an identity mismatch is recorded as unknown; a subtask that has ended while its notification is still pending is recorded as partial.
  When drain fails, a capture error is recorded and the status of the main turn that already succeeded is kept. The native session may not store the complete notification input;
  ACTF uses the stream:context, session:after, and provider response ID of the same announcement run
  to complete the actual input, and when they cannot be bound, linear SFT export is barred. The tool-ID normalization mapping comes from
  the actual output of the native resolver. Chat Completions, Responses, or Messages are decoded according to the actual request endpoint,
  and measured results state the model and protocol for each. A mismatch with the pinned image's hook raises an error.
- Pi / DeepSeek / Stirrup: actual model I/O, the root participant, and integrity are recorded uniformly. Roller's built-in Pi configuration disables
  extensions, DeepSeek uses the sdk-minimal profile, and the bundled Stirrup tool set is `code_exec`, `view_image`, and `finish`;
  none of them has a native delegation tool. The manifest explicitly declares
  `not_available_in_bundled_profile`; subtask tests are not_applicable and are not counted as passed.

Common acceptance covers a single subtask, parallelism, identical prompts, file sharing, tool errors, different tool configurations, and ordinary conversation.
Cross-process resume, all nested/background combinations of the eight Harnesses, and compaction segment reconstruction have not yet been fully verified.

Shared acceptance entry point: `scripts/test_subagents_e2e.py --harness HARNESS ...` (Claude Code, OpenCode, Codex,
Hermes, OpenClaw, Pi, and DeepSeek can be selected; Stirrup has no delegation tool to exercise).
Test credentials are read only from the specified environment variables.

Basis for the OpenCode native interface: [plugin hook definitions of the pinned version](https://github.com/anomalyco/opencode/blob/v1.19.6/packages/plugin/src/index.ts),
[task tool metadata](https://github.com/anomalyco/opencode/blob/v1.19.6/packages/opencode/src/tool/task.ts).
