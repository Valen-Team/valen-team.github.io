---
title: "Files, Task Bundles, and result storage"
---

# Files, Task Bundles, and result storage

This guide describes how task files move from the host into the Agent workspace and into the saved run/sample, and specifies the rules for snapshots, Context capture, result collection, retry, and Resume. For Task fields, see the [Task format reference](/roller/tasks/task-format/).

## 1. File lifecycle

Files pass through four stages:

1. **Host file pack**: inputs and Context under `file_root`, maintained by the user.
2. **Task Bundle**: an immutable snapshot built before the run and shared by every model of the same task.
3. **Agent workspace**: exclusive to each rollout. OpenClaw uses `/tmp_workspace`; Codex, Claude Code, Hermes, OpenCode, DeepSeek, and Pi use `/roller/workspace`.
4. **Sample**: the saved directory containing raw, ACTF, SFT, info, and optional `results/`.

Typical paths:

| Purpose | Example path |
| --- | --- |
| Task list | `dataset/tasks.jsonl` |
| `file_root` | `dataset/files/task_001/` |
| Host input | `dataset/files/task_001/inputs/brief.md` |
| Agent read | `<workspace>/inputs/brief.md` |
| Agent write | `<workspace>/outputs/report.md` |
| Final result | `samples/<model>/00000000_task_001/results/report.md` |

`file_root` defines the logical workspace relationship, but Roller does not write Agent-generated files back into it. Each task/model rollout has its own container and sample, so parallel models do not overwrite each other's output.

## 2. Input snapshots

Files and directories in `files.inputs` are scanned before Docker starts. Roller:

- Rejects symlinks, special files, and path escapes.
- Recursively records the directory tree.
- Computes SHA-256, size, and permissions for each file.
- Validates any declared optional `sha256`.
- Copies each source directly into a content-addressed input tree and hashes the bytes during the copy to detect changes since the scan. No intermediate blobs are stored.

Default limits:

| Limit | Default | CLI |
| --- | ---: | --- |
| Single input or Context file | 10 GiB | `--max-input-file-bytes` |
| Total input per task | 50 GiB | `--max-task-input-bytes` |

Identical input trees within the same run can be reused. Task Bundle manifests are computed in memory (not written to disk) and record declarations, file hashes, the input-tree digest, and the Context digest. The final sample keeps only these digests and does not copy the full set of input dependencies.

OpenClaw provides two entry points:

```text
/tmp_workspace/<source>          # each declared input keeps its relative path
/roller/task/inputs/<source>     # read-only entry point to the full input snapshot
```

The Task Bundle is stored in a temporary runtime directory and is deleted after collection finishes. With `--resume`, Roller rereads the current task and files, rebuilds the digest, and then decides whether an old sample can be reused.

## 3. Context injection and capture

Ordinary inputs are provided by path. Context also declares a `role` and `target`, which the Harness uses to place it where the Agent can discover it.

Each Harness places Context where that Harness discovers it automatically:

| Harness | Project workspace | Extra location |
| --- | --- | --- |
| OpenClaw | `/tmp_workspace/<target>` | `/root/<target>` |
| Codex | `/roller/workspace/<target>` | `role=skill` is also copied into the isolated `$HOME/.agents/skills/` |
| Claude Code | `/roller/workspace/<target>` | `role=skill` is also copied into the isolated `$CLAUDE_CONFIG_DIR/skills/` |

The OpenClaw paths are:

```text
/root/<target>
/tmp_workspace/<target>
```

Therefore, the default `USER.md` for `role: "user"`, the default `MEMORY.md` for `role: "memory"`, and the skills directory can all be found through OpenClaw's standard conventions.

`capture` controls how the Task Bundle records Context content:

| Strategy | Record hash | Keep source in the run | Allow safe Resume |
| --- | --- | --- | --- |
| `full` | yes | yes | yes |
| `hash` | yes | no | yes |
| `none` | no | no | no |

All three strategies copy Context directly into the runtime context directory, validating its bytes against the scan digest while copying. No strategy writes an extra blob or rereads the destination for hashing. For `full`, Roller also keeps one copy of each file in the run directory at `context/sha256/<sha256>`, shared by every task and model that uses the same content, and writes `context/manifests/<context_manifest_digest>.json`, which maps each Context target to its content. A sample records `context_manifest_digest` in `info.json`, so the Context an Agent saw can be read back from the run. Resume restores missing copies without rerunning samples. The `blobs/sha256/...` identifiers in input and `full` Context digest payloads are kept only for compatibility with existing run locks and do not refer to stored files.

By default, `user` and `memory` use `hash`, and other roles use `full`. Use `hash` for private content that still requires reliable change detection. Use `none` when not even a content hash should be recorded; in that case, the task cannot safely Resume.

## 4. Agent workspace

Each rollout uses its own container and an isolated Harness home/session; it does not read the host's Agent login state or history. The working directories are:

| Harness | Working directory | Auto-discovered project instructions |
| --- | --- | --- |
| OpenClaw | `/tmp_workspace` | `AGENTS.md` and OpenClaw Context files |
| Codex | `/roller/workspace` | `AGENTS.md` |
| Claude Code | `/roller/workspace` | Set the project-instruction target to `CLAUDE.md` |

OpenClaw example:

```text
/tmp_workspace/
├── inputs/                    # declared inputs, mounted read-only
├── USER.md                    # optional Context
├── MEMORY.md                  # optional Context
├── skills/                    # optional Context
└── outputs/                   # default writable output directory
```

Input files are mounted read-only at their source paths, and Context is injected before the run. `runtime.setup` then runs in the working directory listed in the table above, and the Agent conversation starts only after that.

`/roller/task/outputs` is a stable alias for the task `output_dir`. Even if the task uses `deliverables/final`, the alias still points to the current collectable directory.

Legacy workspace mode copies an entire old workspace snapshot into the working directory; new data should declare inputs and Context explicitly, to avoid including unrelated files in snapshots and digest calculations.

## 5. Output collection

A Task needs to declare only one directory:

```json
{
  "files": {
    "output_dir": "outputs"
  }
}
```

After the task finishes, Roller walks the entire `output_dir`, copies every regular file and empty directory into the sample's `results/`, and preserves the relative tree:

```text
/tmp_workspace/outputs/
├── report.md
└── assets/chart.png

results/
├── report.md
└── assets/chart.png
```

Generated `node_modules/` directories are excluded at any depth. Package
manifests and lockfiles remain collectable, while dependency trees and their
normal `.bin` symlinks do not inflate artifacts or fail the symlink check.

Each result file is recorded in the sample `info.json` with:

- Relative path
- SHA-256
- Byte count
- MIME type

If the output is empty, `results/` is not created. If a symlink or special file is found, safe regular files can still be saved, but the sample status is set to `error` so that incomplete or dangerous output is not treated as a successful result.

`--collect-path` can still copy extra container paths specified by older tasks into `results/legacy/`. In new tasks, the Agent should write files that must be kept into `output_dir`.

## 6. Run and Sample

Final layout of an ordinary rollout:

```text
<output>/<run-name>/
├── info.json
├── lock.json
├── sft.jsonl
├── context/                 # capture=full Context source, by content
└── samples/
    └── <model>/
        └── <index>_<task>/
            ├── trace.jsonl
            ├── trace_ACTF.json
            ├── trace_SFT.json
            ├── info.json
            └── results/                 # optional
```

Run `info.json` stores:

- Important configuration from this command
- Run phase: `initializing/running/finalizing/finished/interrupted/finalization_error`
- Counts of processed, pending, succeeded, failed, timed-out, and skipped items; periodic checkpoints during collection
- Task, model, and trajectory counts
- Success, failure, timeout, and skip counts
- Aggregated usage across all samples
- An index of sample relative paths

Run `lock.json` stores the redacted settings that Resume compares. It stores configuration as structured data without hashing it again
and reuses the content digests already computed by the Task Bundle.
The lock covers:

- request order, task/model, timeout, and Task Bundle/input/context digests;
- the selected Harness image reference and the image ID resolved on this machine;
- the matching Harness model/API configuration, plus semantic options such as thinking, wire trace, container, and output.

API keys, tokens, and other credentials are replaced with `<redacted>`; userinfo and fragments are
removed from URLs, and sensitive query values are replaced, while non-sensitive query keys such as `api-version` are kept for consistency checks.
The lock prevents samples from different configurations from entering the same run. It does not store secrets and does not verify that credentials are still valid.

Sample `info.json` stores:

- Task ID, model, Harness, and status
- Error and attempt history
- Tokens, cache, cost, and request counts
- Start time, end time, and duration
- OpenClaw version, image digest, and redacted API base
- Task Bundle, input, and Context digests
- Output file inventory
- raw/ACTF/SFT paths

Runtime gateway/agent logs, temporary model config, the Task Bundle, intermediate retry traces, and uncollected workspace files are not kept in the final sample.

A User Simulator sample also contains:

```text
<index>_<task>/
├── conversation.json
└── user_simulator/
    ├── trace.jsonl
    ├── trace_ACTF.json
    ├── trace_SFT.json
    └── info.json
```

The root sample still represents the Task Agent; `user_simulator/` represents the simulated user. The combined usage of both participants is written to the root `info.json`, and the per-participant breakdown is written to `conversation.participants` in the same file. Details are described in [User Simulator and dynamic conversation](/roller/tasks/user-simulator/#8-saving-and-using-traces).

## 7. Raw Trace, ACTF, and SFT

### 7.1 `trace.jsonl`

This file records the original events from the OpenClaw transcript. With the default image, Roller exports
the transcript by session identity through the official public transcript SDK and then serializes each event to JSONL; only legacy OpenClaw falls back
to copying the session JSONL directly. Roller does not drop tool calls for training, rewrite message text, or merge multiple
events into a custom text format. However, this file is not a byte-for-byte copy of the underlying store or of upstream HTTP responses.
OpenClaw may assemble, compact, or trim context before a call, so a saved session message may not be sent verbatim
in every model request. To inspect the messages/input that the model received, use `--wire-trace full`; see
[Trajectory output file guide](/roller/traces/trajectory-outputs/#32-session-history-is-not-the-model-request-context).

### 7.2 `trace_ACTF.json`

The ACTF file stores an `ACTF_v1.0` trajectory object directly:

```json
{
  "schema_version": "ACTF_v1.0",
  "steps": [],
  "started_at": "2026-08-20 10:00:00.000000",
  "finished_at": "2026-08-20 10:00:01.000000"
}
```

Conversion rules:

- Each assistant message becomes one step.
- Visible replies go into `assistant_content.content`.
- reasoning/thinking goes into `assistant_content.reasoning_content`.
- Tool calls are written to both `assistant_content.tool_calls` and `tools`.
- The following tool result goes into that step's `observation`.
- The current user message is written to `user_content`.
- OpenClaw usage is mapped to the step `metric`.

If the Harness finishes successfully but no usable raw trace is available, the sample is marked `error`. If a trusted OpenClaw/OpenCode converter cannot represent an otherwise valid raw trace as ACTF, or ACTF contains non-text content that cannot be represented losslessly as SFT, the evaluation status remains `ok`. `runtime.trajectory_conversion` records the unavailable target and error; unavailable files are omitted and are not fabricated.

### 7.3 `trace_SFT.json` and `sft.jsonl`

For linear samples, `trace_SFT.json` is projected from ACTF. Its text-only top level is `messages` and `tools`; it does not include
task/model, usage, timestamps, or other run metadata. The run-root `sft.jsonl` aggregates eligible linear Task Agent records in request
order, one record of the same shape per line. Compacted samples instead export `sft_segments/` files, which are listed in `info.json`, and are excluded from the legacy run dataset. Samples with an explicit `runtime.trajectory_conversion` downgrade are also omitted. Full fields and validation rules are described in
[SFT data format](/roller/traces/sft-format/).

Conditions for every trace layer, auxiliary file, parameter combination, and failure/Resume output are described in the
[Trajectory output file guide](/roller/traces/trajectory-outputs/).

## 8. Security and privacy boundaries

### 8.1 Files

- Inputs and Context reject symlinks and special files.
- Paths must not escape the declared scope with `..`.
- Only `output_dir` is collected; other files in the workspace are not saved.
- Symlinks and special files in the output are not copied.

### 8.2 API Key

- `${ENV_NAME}` is expanded only at runtime.
- Temporary OpenClaw model config is created in the system temp directory, injected into the container, and then deleted.
- Run metadata records environment variable names, not values.
- The API base is saved only after auth info, query, and fragment are removed.

Do not put real keys in tasks, JSON examples, or READMEs in the repository. Prefer a local `.env` that Git ignores, or an external secret manager.

### 8.3 Context

`capture=full` keeps Context source in the run directory under `context/`, so treat the run as holding that content. `capture=hash` still stores an irreversible content hash; if the hash must not be kept either, use `capture=none`. This disables safe Resume for the task because Roller cannot confirm whether Context changed.

## 9. Retry and Resume

`--retries N` runs at most N extra attempts in the same sample. The final `info.json` records each attempt's status, error, and duration; the canonical raw/ACTF/SFT files represent the last attempt, and intermediate runtime files are removed.

`--resume` performs checks at two levels. First, the currently resolved `lock.json` must match the old lock exactly; otherwise, the command
reports the difference and stops without mixing samples from different configurations into the same run. The lock covers task/model
order, timeout, Task Bundle digest, model configuration, image ID, thinking, and trajectory policy, all of which affect the collected sample. `--parallel`, `--retries`, gateway port/startup timeout, path locations, and bundle size
limits are scheduling or constraint settings and do not change the semantics of already-successful samples, so they may be adjusted on Resume.

Each rollout inspects the image ID again and starts its container from that ID, so the ID in the sample provenance is the image that ran even if the tag moves meanwhile. If the tag resolves to a different ID than it did during preflight, Roller logs a warning.

Credential and pass-through environment values are not stored in the lock and do not trigger a mismatch. If these
values are used for more than authentication and change the model or service behavior, use a new `--run-name`.

After the run lock matches, only samples that meet all of the following conditions are reused:

1. The old status is `ok`.
2. The sample's request/task/model identity matches the current request.
3. `trace.jsonl` contains a valid message. Normally, the ACTF schema is also correct and step IDs are consecutive from 1.
4. Normally, `trace_SFT.json` matches the current ACTF's canonical SFT projection exactly. A structured `trajectory_conversion` downgrade may instead omit ACTF/SFT or only SFT; Resume validates every retained layer and the explicit marker.
5. The current Task Bundle digest matches the old sample, and Context did not use `capture=none`.
6. Recorded output files are still under `results/`, exist, and have the same size. The stored SHA-256 is computed while
   the bytes are copied into `results/` and can be used for deep audit; Resume checks only path, existence, and size so that large files are not reread; `--resume-verify-outputs` rereads them and compares the digest as well.
7. A User Simulator task must also have a valid `conversation.json`, participant info, and Simulator
   raw/ACTF/SFT.
8. `--wire-trace full` also requires the `wire_trace.jsonl` of both participants to exist. When cache trace is enabled,
   each Agent or Simulator participant that ran on OpenClaw must also have `cache_trace.jsonl`.
   Codex and Claude Code do not produce this file and are not required to provide it.

Under the same run lock, only a sample that fails the integrity checks is rerun. The following changes make the run lock
inconsistent and require a new run name, rather than a silent rerun mixed into the old run:

- Changes to prompt, messages, or User Simulator configuration
- Changes to input content, directory structure, or declarations
- Changes to Context content, target, or capture
- Changes to `output_dir`
- Changes to runtime env, setup, model configuration, image, or thinking/trajectory policy

Multiple models in the same new run are stored in separate sample model directories. After a lock has been created, models cannot be added, removed, or reordered
through Resume. Use a new run name for a new model combination.

Runs created by older versions that have no `lock.json` can be migrated with `--resume`. Roller writes the current lock, but because
it cannot prove that the old execution configuration was the same, the first migration reruns every existing sample; only later resumes may safely reuse samples.
During migration, a temporary `.legacy-resume-untrusted.json` marker exists; it is deleted only after every request finishes and the run-level
SFT is generated. Even if the process is killed, the next run does not reuse old samples that have not been recollected.
