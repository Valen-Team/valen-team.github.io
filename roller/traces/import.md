---
title: "Session import"
---

# Session import

`roller import` turns the Claude Code and Codex sessions already on this machine into a Roller run. Each session becomes one sample with its native session, its ACTF trajectory and, when one can be made, its SFT record. The Viewer and `roller export --format atif|sft|hf` then read the run like a collected one. No Docker, model endpoint or task list is needed.

The command arrives with the next release. Until then, install Roller from the repository:

```bash
uv tool install "git+https://github.com/Valen-Team/Roller"
```

## 1. Import

List what would be imported, by project, without writing anything:

```bash
roller import --dry-run
```

Import every session into `runs/my-sessions` and open it:

```bash
roller import --output runs --run-name my-sessions
roller view runs/my-sessions
```

The command ends with a summary: new, updated, unchanged, empty and failed sessions, the subagent sessions left out, and how many samples have an SFT record. A failed session is listed with its error, and the exit code is 1.

| Flag | Default | Purpose |
| --- | --- | --- |
| `PATH ...` | The session directories below | Imports these session files or directories instead |
| `--harness` | Both | Imports only `claude-code` or `codex` sessions |
| `--output` | `runs` | Sets the output root |
| `--run-name` | `imported` | Sets the run directory name |
| `--since YYYY-MM-DD` | All | Imports the sessions that started on or after this date |
| `--project GLOB` | All | Imports the sessions whose project, the last directory of their working directory, matches; can be repeated |
| `--parallel N` | `4` | Converts N sessions at once |
| `--dry-run` | Off | Prints sessions, size and dates by project without writing anything |

A run of a few thousand sessions takes a few minutes. Compressed Codex sessions are stored decompressed in the run, so leave room for about three times the size of the session directories.

## 2. What is imported

| Harness | Read | Left out |
| --- | --- | --- |
| Claude Code | `<projects>/<project>/<session>.jsonl` under `~/.claude/projects`, or `$CLAUDE_CONFIG_DIR/projects` | Subagent sessions in `<session>/subagents/` and `agent-*.jsonl` |
| Codex | `rollout-*.jsonl` and `rollout-*.jsonl.zst` under `~/.codex/sessions` and `~/.codex/archived_sessions`, or below `$CODEX_HOME` | Rollouts whose `session_meta` names a subagent source |

- A subagent's work reaches the parent session as the result of the tool call that started it, which stays in the parent's trajectory.
- A Codex session found more than once is imported from `sessions/` before `archived_sessions/`, and from `.jsonl` before `.jsonl.zst`. A Claude Code session that was continued in another project directory is imported from its longest file.
- A session without a model reply, for example one that holds only queued prompts, is counted as empty and has no sample.

Each sample lies in `samples/<model>/<index>_<session id>/`:

| File | Content |
| --- | --- |
| `trace.jsonl` | The native session, decompressed for `.jsonl.zst` files |
| `trace_ACTF.json` | The unified trajectory. User messages that the Harness injected, such as `<system-reminder>`, stay in it, because the model read them |
| `trace_SFT.json` | The SFT record, when the session can form one (section 5) |
| `info.json` | Model, usage, timing, `title`, `project`, and `provenance.import`: the source file, its size and modification time, the session id, working directory, CLI version, git branch, commit and remote, and the session it continues |

The model of a sample is the one that answered most often in the session; every model is listed in `provenance.import.models`.

## 3. Importing again

Running the same command again imports new sessions and re-imports a session whose file size or modification time changed, into the same sample directory. Unchanged sessions are skipped. A session still being written is imported as far as it goes and updated on the next run.

## 4. Titles in the Viewer

The Viewer lists an imported run newest first. Each session shows a title, with its project and start date below, and the search covers titles and projects.

The title is the Claude Code session name when one was set or generated, and otherwise the first user message that the user typed. Text the Harness injected into user messages, such as `<system-reminder>`, `<environment_context>`, command output and image placeholders, is skipped. The title does not change the trajectory.

## 5. SFT records

`roller export runs/my-sessions --format sft` writes the SFT records with an index; the index of an imported sample adds three fields:

| Field | Values |
| --- | --- |
| `tools_source` | `captured`: the tool definitions the session recorded. `captured_merged`: the session recorded several tool lists, for example after a tool search loaded more tools, and the record lists every tool with its last definition. `inferred`: the session recorded none, and the tools are built from the calls with the argument names they used |
| `system_prompt_source` | `captured` or `missing` |
| `parent_session_id` | The session this one continues or forks from; the record repeats its history, so use it to deduplicate |

Claude Code records the system prompt and tools of its requests in recent versions; older sessions have no system prompt and inferred tools. Codex records its system prompt in every version, and its tool definitions in recent versions.

A session has no SFT record when:

- the model context was compacted, since one record cannot represent the context before and after;
- a tool result holds a `document` block;
- the text already contains a literal `<image>`, which the multimodal record format reserves;
- the model called a tool whose definition the session never loaded.

The reason of each sample is in `runtime.trajectory_conversion` of its `info.json`, and `roller export --format sft` counts the samples it left out.

## 6. Uploading to Hugging Face

```bash
roller export runs/my-sessions --format hf --output my-sessions-hf
```

Besides what it replaces in every run, see [Hugging Face export](/roller/traces/trajectory-outputs/#hugging-face-export), the export of imported sessions replaces:

- the home directories of the sessions and of the exporting machine: `/Users/<name>` and `/home/<name>` become `/Users/user` and `/home/user`, also in the `-Users-<name>-` form of Claude Code project directories, with `user-2`, `user-3` for further names. A user name of four characters or more is also replaced where it stands alone;
- the account identifiers the sessions recorded;
- the global git user name and email of the exporting machine;
- the values of the credential variables in the exporting environment, those whose name ends in `key`, `token`, `secret`, `password` or `credential`.

Other email addresses, repository URLs, pull request links, internal host names and secrets without a known shape stay. Before uploading:

1. Read `my-sessions-hf.redaction-report.json`. It lists the lines that still hold an email address, home path, private IP address, credential shape or private key, without copying their values.
2. Add rules for what remains and export again. `replace` rewrites text, `exclude` leaves files out, and `forbid` stops the export when a pattern is still present:

   ```json
   {
     "replace": [
       {"pattern": "my-private-org", "with": "example-org"},
       {"pattern": "https://git\\.internal\\.example\\.com/[\\w./-]+", "with": "https://git.example.com/repo"}
     ],
     "forbid": ["internal\\.example\\.com"]
   }
   ```

   ```bash
   roller export runs/my-sessions --format hf --output my-sessions-hf --redact-rules rules.json
   ```

3. Scan the folder with a secret scanner:

   ```bash
   trufflehog filesystem my-sessions-hf
   gitleaks dir my-sessions-hf
   ```

The export writes a local folder only; uploading it is up to you.
