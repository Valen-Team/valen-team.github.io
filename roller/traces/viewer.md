---
title: "Trajectory Viewer"
---

# Trajectory Viewer

Roller includes a read-only Web Viewer that requires no additional dependencies. It groups
a run by task and displays model rollouts, reasoning, tool calls, tool results,
and final replies. The Viewer reads existing Roller artifacts directly.
It does not generate a new trajectory copy, and it does not modify
`trace_SFT.json` or `sft.jsonl`.

## 1. Start

Pass the path of a Roller run root that contains `info.json` or `samples/`:

```bash
roller view /path/to/runs/my-run
```

The Viewer listens on `127.0.0.1:17865` by default. The terminal prints the actual URL
and the locked run path:

```text
Roller Viewer: http://127.0.0.1:17865
Run directory: /path/to/runs/my-run
```

Without `--port`, if 17865 is already in use (for example, by a server that an agent
started on the shared host network during collection), the Viewer prints a
notice and switches to a free port; use the URL printed in the terminal.

The port can also be set explicitly. If an explicitly set port is in use, the
Viewer reports an error and does not switch to another port:

```bash
roller view /path/to/runs/my-run --port 9000
```

The Viewer process only reads files and serves the page. It does not start
Docker, OpenClaw, or a model service. Stop it with `Ctrl-C`.

## 2. Access from a remote machine

For remote access, keep the Viewer on the loopback address and open an SSH tunnel
from the local machine:

```bash
ssh -L 17865:127.0.0.1:17865 user@remote-host
```

If the Viewer switched to another port, use the printed port in both places.

If the service must be exposed directly, run:

```bash
roller view /path/to/run --host 0.0.0.0 --port 17865
```

The Viewer currently has no authentication. Listening on a public interface
exposes system prompts, user input, reasoning, tool arguments, tool results, and
run metadata. Use it only on a trusted network that already has access control.

## 3. Page layout

The page has three columns:

1. The left column lists tasks by `task_id`. Multiple model rollouts of the same
   task appear in the same group. The list can be searched by task/model/error
   text and filtered by status or model.
2. The middle column shows the ACTF timeline of the selected rollout. The step
   title initially shows tokens, elapsed time, stop reason, and reasoning/tool counts.
   The full step is loaded only after the step is clicked.
3. The Inspector in the right column shows sample information, the first system prompt saved
   at the ACTF top level, the full tools schema, and the original `info.json`.
   A User Simulator task also shows `conversation.json`.

Drag the dividers between the columns to resize the side columns; the timeline
keeps at least 360px. A focused divider also responds to ←/→ (larger steps with
Shift), and double-clicking it restores the default proportions. The widths are
saved in the current browser and shrink proportionally when the window becomes too
narrow for them. At a window width of 1180px or less, the Inspector becomes an
overlay and only the left column can be resized.

A divider is also located below the Run summary cards at the top. Dragging it
up reduces the height of the summary and increases the height of the three
columns; dragging it to the top hides the summary. Drag it back down or
double-click it to restore the full height. A focused divider also responds to
↑/↓. The height is also saved in the browser.

Reasoning uses its own region and is collapsed by default. Tool calls are paired
with their results by `tool_call_id`. Results with `isError=true` use an error
style. Everything on the page is rendered as text. HTML or scripts inside the
trajectory are not executed.

The page hash stores the rollout ID; the current URL can therefore be copied
and used as a deep link to that task in the same Viewer process.

## 4. Data sources

| Content | File | When loaded |
| --- | --- | --- |
| Run name, state, processed/total, total usage, collection config | Run `info.json` | Home page load/refresh |
| Task/model/status/error/path | Run and sample `info.json` | Home page load |
| Step summaries and system/tools | `trace_ACTF.json` | Rollout selected |
| Step reasoning/content/tool/result | `trace_ACTF.json` | Step expanded |
| Dialogue both sides can see | `conversation.json` | User Simulator rollout selected |

The Viewer does not use `trace_SFT.json` as its display source, because SFT
does not contain step ID, timing, metric, stop reason, and observation
metadata. `trace.jsonl`, `cache_trace.jsonl`, and `wire_trace.jsonl` are also
not sent to the browser by default.

The Viewer shows the ACTF analysis projection of session events. It does not
show the full context of every model request. When OpenClaw applies compaction, pruning,
runtime/hook injection, or protocol adaptation between the session and the
provider call, the middle timeline cannot prove which history the model saw
verbatim. For that kind of audit, enable `--wire-trace full` at collection time
and inspect `wire_trace.jsonl` and `cache_trace.jsonl` in the sample offline.
See the limits in
[Trajectory output file guide](/roller/traces/trajectory-outputs/#32-session-history-is-not-the-model-request-context).

During collection, the Run card on the home page shows `state` and
`processed / total` from the latest checkpoint. Roller updates on the first
result, then after every additional 25 results, and also immediately when
completion events are at least 30 seconds apart. It forces an update on interrupt
and during finalization.
After Resume, the sample's on-disk `info.json` still contains the original
`status=ok`. The Viewer overlays `status=skipped` from this run's index so that the
Completed card shows the reuse count accurately. The Thinking card shows the retention policy (kept/stripped) and configured native thinking level.

Until the run has finalized `info.json`, the Viewer also scans
`samples/<model>/<task>/info.json`, so samples finalized after a checkpoint
still appear. In-progress temporary directories without a sample `info.json` are
not listed. Click **Refresh** in the upper-right corner to reload state and
samples.

## 5. Lazy loading and large content

The home page does not read every ACTF. The server parses the matching
`trace_ACTF.json` only when the user selects a rollout, and keeps a limited
number of recent trajectories in memory.

When a step is expanded, each user/reasoning/content/arguments/tool result
field returns at most 40,000 characters by default. A truncated region shows
the original length and a "Load more" button. A further load is capped at
1,000,000 characters. This limit applies only to the browser response and does
not modify files on disk.

## 6. Missing and failed traces

- Samples with `status=error/timeout` still appear in the list. If ACTF already
  exists, the partial trajectory up to the failure can be browsed.
- Without ACTF, the page still shows sample status, error, and metadata, and
  the middle column shows `NO ACTF`.
- When no cache trace was captured, the system prompt is shown as empty.
- When no wire tools were captured, the tools panel is shown as empty. This
  does not affect the display of tool call/result in existing steps.
- ACTF reasoning produced with `--no-keep-thinking` is empty. The page does not
  fabricate content or reconstruct it from SFT.

## 7. Read-only and path safety

`roller view` pins one run directory as the only root it is allowed to read.
The API uses an internal rollout ID and does not accept an arbitrary host
directory from the browser. Sample/ACTF paths in run `info.json` that escape
the root are rejected. The static server does not provide directory listing,
file writes, command execution, or an arbitrary artifact-download API.

Browser responses use security headers that block cross-origin reads, MIME
sniffing, and execution of inline/external scripts. These limits are not a
substitute for network authentication; therefore a sensitive run should still be
accessed only through loopback or an SSH tunnel.

## 8. Common questions

**(1) Newly finished tasks do not appear on the page**

Click **Refresh** in the upper-right corner. The Viewer does not continuously poll the
disk, so that a large run does not generate additional I/O.

**(2) Port already in use**

This error occurs only when the port is set with `--port`; without this option,
the Viewer switches to a free port automatically. Choose another port, or remove `--port`:

```bash
roller view /path/to/run --port 17866
```

**(3) The Viewer reports that the path is not a Roller run**

The input path must be the run root, not `samples/`, a single sample, or
`trace_ACTF.json`. A valid root contains run `info.json` or `samples/`.

## Language and benchmark scores

The Viewer defaults to English. Use **EN / 中文** in the header to switch languages; the browser remembers the choice. Benchmark runs show each sample's score and grader error in the overview, with score sorting and filters for **Above zero**, **Zero**, and **Unscored**. These groups are not pass/fail thresholds. User message image blocks are displayed inline as well as tool-result images.
