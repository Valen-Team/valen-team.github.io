---
title: "CLI reference"
---

# CLI reference

This page lists the Roller command-line flags. Before the first run, complete [Getting started](/roller/start/getting-started/). Return to this page to change tasks, concurrency, output paths, or Harness behavior.

On a first reading, note the following four points:

- `--tasks` selects what Roller will run.
- `--model` and `--harness` select the model and Agent runtime.
- `--output` and `--run-name` determine where results are saved.
- `--dry-run` checks the configuration without starting containers.

The command output from the Roller version currently in use is always authoritative:

```bash
roller --help
roller collect --help
roller view --help
```

## 1. Command structure

Choose the command for the job first, then add that command's flags.

| Command | Purpose |
| --- | --- |
| `roller collect [OPTIONS]` | Reads tasks, runs a Harness, and collects trajectories |
| `roller init [DIRECTORY]` | Writes the example tasks, configuration templates, and benchmark run configurations to `DIRECTORY/examples` (default: the current directory); existing files are kept |
| `roller view RUN_DIR` | Opens an existing run in the Viewer |
| `roller import [PATH ...]` | Imports the local Claude Code and Codex sessions as a run, with flags in section 10 |
| `roller export RUN_DIR` | Exports an existing run as ATIF, the trajectory format Harbor reads, or as a Hugging Face dataset folder, with flags in section 9 |
| `roller bench ...` | Lists, runs, exports, or summarizes benchmarks, with collection flags in section 8 |
| `roller --version` | Shows the installed Roller version |

A minimal collect command requires a task list. Set the model with `--model` or in each task's `model` field.

```bash
roller collect --tasks tasks.jsonl --model provider/model
```

## 2. Configuration precedence

The same setting can appear in both a task and the command line. Roller uses the following rules to choose the final value.

| Setting | Final value |
| --- | --- |
| Model | Command-line `--model` values take precedence when present, otherwise each task's `model` is used |
| Thinking | task `runtime.thinking` takes precedence, followed by `--thinking`, then the Harness or model default |
| Workspace | task `workspace` takes precedence, otherwise the global `--workspace` is used |
| User Simulator model | `user_simulator.model` takes precedence, otherwise the current task Agent model is used |

Roller removes duplicate `--model` values. When multiple models are specified, every selected task runs once for each model. `--start-index` and `--limit` select tasks before Roller expands those model combinations.

## 3. Shared collection flags

These flags determine which tasks run, how many runs are created, and where the results are saved. They apply to every Harness.

### 3.1 Inputs and runtime selection

These flags specify where Roller reads tasks and which model and Harness execute them.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--tasks PATH` | Required | Selects a JSON or JSONL task list |
| `--model MODEL` | task `model` | Selects a model and can be repeated for multiple models |
| `--model-label LABEL` | Actual service model ID | Sets a safe local name for sample directories and containers without changing the upstream model ID, only for runs with one final model |
| `--harness NAME` | task `harness` or `openclaw` | Selects `openclaw`, `codex`, `claude-code`, `hermes`, `opencode`, `deepseek`, or `pi` |

### 3.2 Execution scale and task range

These flags control concurrency, repetitions, retries, and which part of the task list runs.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--parallel N` | `1` | Sets the maximum number of concurrent rollouts |
| `--launch-interval SECONDS` | `0` | Sets the minimum gap between two rollout launches, see below |
| `--grader-parallel N` | `--parallel` | Limits concurrent graders separately to avoid overloading a judge service |
| `--samples N` | `3` for SkillsBench, otherwise `1` | Creates N independent samples for each task/model pair |
| `--retries N` | `0` | Sets additional attempts after the first failure |
| `--retry-backoff SECONDS` | `0` | Waits before the first retry of a sample and doubles the wait before each further retry, see below |
| `--timeout SECONDS` | `600` | Sets the total timeout for one rollout |
| `--task-timeouts` | Off | Prefers each task's `timeout_seconds` and falls back to `--timeout` |
| `--start-index N` | `0` | Starts at task N in the normalized task list |
| `--limit N` | Unlimited | Selects at most N tasks |

By default, a run starts `--parallel` rollouts at once. Start-up requires much more memory than steady-state operation (roughly twice as much for an OpenClaw container); therefore the memory peaks of rollouts that start together add up. `--launch-interval` separates consecutive launches, including retries, by at least the specified number of seconds:

```bash
roller collect ... --parallel 24 --launch-interval 8
```

- The interval applies to the whole run, including launches after the first wave. N launches take at least (N − 1) × `--launch-interval` seconds. When rollouts are shorter than about `--parallel × --launch-interval`, fewer than `--parallel` rollouts run at once.
- Samples skipped by `--resume` do not take a launch turn.
- On interruption, rollouts still waiting for their launch turn are cancelled and leave no sample directory. Pending retries are also cancelled, regardless of the interval; the sample keeps its last failure, and `--resume` reruns it.
- The value is recorded in `info.json` and not in `lock.json`; therefore it can be changed on `--resume`.

With `--retries`, a failed sample is retried immediately by default. `--retry-backoff` inserts a wait that starts at the specified number of seconds and doubles with each retry of the same sample, which gives a rate-limited or briefly unavailable model service time to recover:

```bash
roller collect ... --retries 3 --retry-backoff 30
```

- The retries above wait 30, 60, and 120 seconds. The wait is not part of `--timeout`: each attempt keeps the full timeout.
- A waiting sample keeps its worker, and its launch turn is taken after the wait ends.
- On interruption, the wait ends at once and the pending retry is cancelled.
- The value is recorded in `info.json` and not in `lock.json`; therefore it can be changed on `--resume`.

### 3.3 Output, validation, and continuation

These flags control the result directory and whether Roller validates, starts, or continues a run.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--output DIR` | `runs` | Sets the parent directory for all run roots |
| `--run-name NAME` | UTC timestamp | Sets the directory name for this run |
| `--dry-run` | Off | Checks tasks, files, and the run plan without starting Docker or writing files. Each planned rollout lists the bundle digests a real run would record |
| `--resume` | Off | Continues the same run and skips complete successful samples, see section 6 |
| `--resume-verify-outputs` | Off | With `--resume`, rereads every recorded output file and reruns a sample whose content no longer matches its SHA-256. Without it Resume compares path and size only |

### 3.4 Compatibility and debugging

These flags mainly support legacy data or logging. New task files usually do not need the first three.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--workspace DIR` | None | Sets a global workspace for legacy tasks, new tasks use `file_root` and `files` |
| `--prompt-key NAME` | `prompt` | Selects the prompt field in legacy data |
| `--id-key NAME` | `id` | Selects the ID field in legacy data |
| `--log-level LEVEL` | `INFO` | Sets `DEBUG`, `INFO`, `WARNING`, or `ERROR` logging |

### 3.5 Input file limits

These flags limit the files that one task can bring into a container and help prevent unexpectedly large inputs.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--max-input-file-bytes` | 10 GiB | Limits one input or context file |
| `--max-task-input-bytes` | 50 GiB | Limits the total input size for one task |

## 4. Common Harness runtime flags

These flags control how a Harness container starts, connects to a model service, and records trajectory data. The selected Harness still determines the supported values.

### 4.1 Container and connection

These flags select the image, Docker runtime settings, and model-service connection.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--docker-image IMAGE` | Pinned image for the Harness | Overrides the Harness image for this run |
| `--sandbox-provider NAME` | `docker` | Selects Docker, E2B, or an installed provider for single-agent DeepSeek WildClawBench runs |
| `--sandbox-template TEMPLATE` | — | Template to use when a remote provider is selected |
| `--container-user USER` | `0` | Sets the disposable container user, `image` keeps the image default |
| `--docker-binary PATH` | `docker` | Selects the Docker CLI name or path |
| `--network MODE` | `host` | Sets the container network mode, some full wire-trace paths require host networking |
| `--api-base URL` | Harness environment variable | Sets the API address for a single-Harness run, OpenClaw keeps this in its model config |
| `--api-key-env NAME` | Harness default variable | Selects the host environment variable that contains the model API key |
| `--pass-env NAME` | None | Passes one additional non-empty environment variable into the Harness container and can be repeated |
| `--keep-container-on-error` | Off | Keeps the stopped container after failure for inspection |

### 4.2 Reasoning and traces

`--thinking` sets the model's reasoning or thinking effort. The same setting can appear in a task as `runtime.thinking`. The task value takes precedence over the CLI. If both are omitted, Roller uses the Harness or model default.

The Roller CLI recognizes the logical levels below, but each Harness supports only a subset and may use different defaults or mappings. See the matching Harness guide for the exact behavior.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--thinking LEVEL` | Unset | Sets the Harness reasoning or thinking level |
| `--thinking-capabilities PATH` | Unset | Loads versioned model/endpoint capability declarations for preflight validation |
| `--keep-thinking` / `--no-keep-thinking` | On | Decides whether ACTF and SFT export visible reasoning |
| `--wire-trace MODE` | `actf` | Selects `off`, `actf`, or `full` request recording |
| `--capture-calls` | Off | Saves the full model calls and the subagent relations of every participant, see [Subagent capture protocol](/roller/traces/subagent-capture-protocol/) |
| `--token-ids` | Off | With `--capture-calls`, saves the prompt and completion token ids of every model call and the logprob of each generated token in `token_ids.jsonl`, see [Token ids and logprobs](/roller/traces/token-ids/) |

```text
off | minimal | low | medium | high | xhigh | adaptive | max | ultra
```

Input `none` is normalized to `off`. Unsupported values fail before the rollout starts.

For all seven Harnesses, provider/model support can be declared
without adding model-name rules to Roller:

```json
{
  "schema_version": "roller.thinking-capabilities/v1",
  "profiles": [
    {
      "harness": "hermes",
      "model": "served-model-id",
      "api_base": "https://gateway.example/v1",
      "supported_efforts": ["low", "medium", "high"]
    }
  ]
}
```

Pass this file with `--thinking-capabilities`. Matching is exact on Harness and
served model ID; `api_base` is optional, and an endpoint-specific entry takes
precedence over a generic entry. A matched unsupported effort fails before any
container or model request starts. Unmatched models retain provider-side
validation, and Roller never silently substitutes another effort. The file's
SHA-256 is included in the run lock.

Profiles support all seven registered harnesses and validate both agent and
simulator. Unknown harnesses/fields and surrounding whitespace are rejected.
Use logical Roller effort names (Claude `ultra`, not its wire value `ultracode`).
OpenClaw matches the full `provider/model` name and resolves the endpoint from
that provider's model-config `baseUrl`. If the endpoint is unavailable, only
generic profiles match. Declarations never override native effort restrictions
or rewrite requests.

### 4.3 Wire trace modes

Wire trace controls whether Roller records the actual HTTP requests sent to the model service. The default `actf` mode is sufficient for normal collection.

| Mode | Output and purpose |
| --- | --- |
| `off` | Does not capture HTTP requests through the local reverse proxy |
| `actf` | Writes the actual tools schema into ACTF and keeps no extra wire file |
| `full` | Also keeps `wire_trace.jsonl` for auditing actual HTTP requests |

`full` can retain complete request text including prompts, reasoning, tool arguments, and results. This makes the output larger and more sensitive. See the matching Harness guide for support and network requirements, and see [Trajectory outputs](/roller/traces/trajectory-outputs/#wire-trace-jsonl) for the file format.

### 4.4 Compatibility note

`--external-thinking` has been removed. Replace it with `--thinking` and delete obsolete arguments from old commands.

## 5. Harness-specific flag index

Flags that belong to one Harness are documented in that Harness guide. Each guide documents its image, API, key, execution limit, and native configuration flags.

| Harness | Flag and configuration guide |
| --- | --- |
| OpenClaw | [OpenClaw Harness guide](/roller/harnesses/openclaw-configuration/#openclaw-cli-flags) |
| Codex | [Codex Harness guide](/roller/harnesses/codex-configuration/#codex-cli-flags) |
| Claude Code | [Claude Code Harness guide](/roller/harnesses/claude-code-configuration/#claude-code-cli-flags) |
| Hermes | [Hermes Harness guide](/roller/harnesses/hermes-configuration/#hermes-cli-flags) |
| OpenCode | [OpenCode Harness guide](/roller/harnesses/opencode-configuration/#opencode-cli-flags) |
| DeepSeek | [DeepSeek Harness guide](/roller/harnesses/deepseek-configuration/#deepseek-cli-flags) |
| Pi Agent | [Pi Agent Harness guide](/roller/harnesses/pi-configuration/#pi-cli-flags) |

For the tools each Harness exposes and the flags that select them, see [Harness tool availability](/roller/harnesses/tool-availability/).

For endpoints that need adapted requests or responses, `--codex-image-detail` sets the `detail` of Responses image inputs ([Codex Harness guide](/roller/harnesses/codex-configuration/#codex-cli-flags)), and `--claude-unique-tool-ids` replaces tool-call IDs that the service issues more than once ([Claude Code Harness guide](/roller/harnesses/claude-code-configuration/#claude-code-cli-flags)). For an endpoint that serves only Chat Completions, `--claude-chat-completions` and `--codex-chat-completions` translate the Messages and Responses requests of these Harnesses.

To inspect the complete flag set supported by the Roller version currently in use, run:

```bash
roller collect --help
```

## 6. Resume flags

Use `--resume` to continue the same run after interruption or partial failure while reusing complete successful samples.

```bash
roller collect [original command] --resume
```

Resume first compares the execution settings and input digests in `lock.json`, then checks the required artifacts of successful samples. A sample is skipped when its settings and inputs match and its artifacts are complete. Damaged artifacts are rerun. Changed settings or inputs cause Resume to stop.

Use `--resume` only for the same experiment. Start a new `--run-name` after changing existing model settings, image, thinking, wire, or other execution settings. Adding new models and tasks is supported when existing requests remain unchanged.

## 7. Viewer flags

Viewer flags select the run to open and configure the local web server's listen address and port.

```bash
roller view RUN_DIR [--host HOST] [--port PORT]
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `RUN_DIR` | Required | Selects a Roller run containing `info.json` and `samples/` |
| `--host` | `127.0.0.1` | Sets the listen address |
| `--port` | `17865` | Sets the listen port; when omitted and the default is busy, a free port is used |

Listening on `0.0.0.0` exposes trajectory contents to the network. For remote access, keep the default address and use SSH port forwarding.

## 8. Bench flags

Bench flags convert an external benchmark into Roller tasks, run collection, grade the results, and produce a summary.

| Command | Purpose |
| --- | --- |
| `roller bench list` | Lists the available benchmark adapters |
| `roller collect --bench ...` | Converts, runs, grades, and summarizes a benchmark, recommended for most users |
| `roller bench run --config FILE` | Starts the same `collect --bench` run from layered YAML or JSON files |
| `roller bench export ...` | Converts a benchmark to task JSONL without running tasks |
| `roller bench report RUN_DIR` | Regenerates a grading summary for an existing run |

Common command forms:

```bash
roller collect --bench NAME --bench-root ROOT [--bench-category CAT]... [--bench-task-id ID]... [--bench-variant NAME] [--bench-timeout-multiplier N] [--bench-runs-per-task N] ...
roller bench run --config FILE [--extra-config FILE_OR_JSON]... [--dry-run]
roller bench export NAME ROOT --output TASKS.jsonl [--category CAT]... [--task-id ID]... [--variant NAME] [--timeout-multiplier N] [--runs-per-task N]
roller bench report RUN_DIR [--output REPORT.json]
```

Prefer `collect --bench`. It converts tasks, runs containers, grades results, and aggregates them in one command, then saves `tasks.jsonl` and `bench-report.json` in the run directory.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--bench NAME` / `NAME` | Required | Selects an adapter from `roller bench list` |
| `--bench-root ROOT` / `ROOT` | Required | Selects the checked-out benchmark directory |
| `--bench-category CAT` / `--category CAT` | Unlimited | Selects one category and can be repeated |
| `--bench-task-id ID` / `--task-id ID` | Unlimited | Selects one task and can be repeated, invalid IDs fail immediately |
| `--bench-variant NAME` / `--variant NAME` | Adapter default | Selects a benchmark condition such as SkillsBench `with-skill` or `no-skill` |
| `--bench-timeout-multiplier N` / `--timeout-multiplier N` | Adapter default | Scales each benchmark task timeout by a finite positive number |
| `--bench-runs-per-task N` / `--runs-per-task N` | `1` | Duplicates each selected task N times and records the run index in the bench metadata |
| `--output` / `-o` | Required for export | Sets the exported task JSONL or report JSON |
| `RUN_DIR` | Required for report | Selects a completed run and is a positional argument |
| `--rebuild-task-images` | Off | Rebuilds task-specific benchmark images even when they already exist |

`collect --bench` automatically uses each benchmark task's timeout. For a manual export followed by collect, add `--task-timeouts` to collect. Both workflows can use `--pass-env` for environment variables required by the grader.

`bench run` takes its settings from files instead of flags:

| Flag | Default | Purpose |
| --- | --- | --- |
| `--config FILE` | Required | Selects the base run configuration in YAML or JSON |
| `--extra-config FILE_OR_JSON` | None | Adds a layer from a file or an inline JSON object and can be repeated, later layers override earlier ones |
| `--dry-run` | Off | Validates the merged configuration and prints the plan without starting containers |

See [Benchmark run configuration](/roller/benches/benchmark-standard/) for the fields and the `collect` flag each one sets.

See [Bench integration and scoring](/roller/benches/bench-format/) for field semantics, scoring order, `stage` leak prevention, and aggregation rules.

## 9. Export flags

Export flags select the run to convert, the target format, and the directory that receives the result.

```bash
roller export RUN_DIR [--format atif|hf|sft|tokens] [--output DIR] [--min-score X] [--no-redact] [--include-runs] [--redact-rules FILE]
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `RUN_DIR` | Required | Selects a Roller run containing `samples/` |
| `--format` | `atif` | Selects the target format: `atif`, the Agent Trajectory Interchange Format that Harbor reads, `hf`, a Hugging Face dataset folder, `sft`, training records with aligned indexes, or `tokens`, the token sequences of a run collected with `--token-ids` |
| `--output` / `-o` | `RUN_DIR/<format>` | Sets the directory to write |
| `--redact` / `--no-redact` | On | With `--format hf`, replaces the model endpoints, `NO_PROXY` hosts, machine name, host paths, and credential values of the run in the exported files |
| `--include-runs` | Off | With `--format hf`, also writes `runs/<harness>-<model>/`, a Roller run directory with every file of the samples |
| `--redact-rules` | None | With `--format hf`, names a JSON file of further `replace`, `exclude`, and `forbid` rules, applied whether or not `--redact` is on |

The command does not modify the run. `--format atif` writes one `trajectory.json` per sample; see [ATIF export](/roller/traces/trajectory-outputs/#atif-export) for the file layout and the field mapping. `--format hf` writes a dataset card, the agent session of every sample for the trace viewer of the Hub, and a table with one row per sample, as one part per Harness and model named `<harness>-<model>`, so that one folder can hold several runs; see [Hugging Face export](/roller/traces/trajectory-outputs/#hugging-face-export). `--format tokens` writes `tokens.jsonl`; see [Token ids and logprobs](/roller/traces/token-ids/#export).

## 10. Import flags

Import flags select the local sessions to turn into a run and where to write it.

```bash
roller import [PATH ...] [--harness claude-code|codex] [--output DIR] [--run-name NAME] [--since YYYY-MM-DD] [--project GLOB]... [--parallel N] [--dry-run]
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `PATH ...` | `~/.claude/projects`, `~/.codex/sessions`, `~/.codex/archived_sessions` | Selects session files or directories; `CLAUDE_CONFIG_DIR` and `CODEX_HOME` move the defaults |
| `--harness` | Both | Imports only `claude-code` or `codex` sessions |
| `--output` | `runs` | Sets the output root |
| `--run-name` | `imported` | Sets the run directory name |
| `--since` | All | Imports the sessions that started on or after this date |
| `--project` | All | Imports the sessions whose project matches the glob; can be repeated |
| `--parallel` | `4` | Converts this many sessions at once |
| `--dry-run` | Off | Lists the sessions by project without writing anything |

Running the command again skips unchanged sessions. See [Session import](/roller/traces/import/) for the files read, the sample layout, SFT records and redaction before upload.

## Collection recovery and diagnostics

Collection checks required task variables, agent API keys and grader variables before launching containers, including with `--dry-run`. Every completed rollout logs progress and ETA; a 60-second heartbeat lists the longest running samples. `<run>/collect.log` retains INFO messages even with a quieter console.

| Option | Default | Behavior |
| --- | --- | --- |
| `--max-consecutive-errors N` | `10` | Stop dispatching after N consecutive rollout errors; `0` disables the breaker. Timeouts reset the streak. Running rollouts finish. |
| `--retry-backoff SECONDS` | `0` | Delay sample retries, doubling after each retry. |
| `--grader-retries N` | `2` | Retry a failed grader in the same container, with 5s then 10s backoff. Graders that took over 600s are not retried. |
| `--resume --resume-unscored` | Off | Rerun successful agents whose grading failed; this calls the agent again. |

The first Ctrl-C stops dispatch and waits for running samples. A second Ctrl-C, SIGTERM or SIGHUP removes this collector's containers and writes an interrupted checkpoint. An explicitly ignored signal remains ignored. After an uncatchable kill, inspect leftovers with `roller clean RUN_DIR --dry-run`, then run `roller clean RUN_DIR`. Cleanup keeps containers belonging to live or unknown collectors unless `--force` is supplied.

Resume accepts added tasks and models when every recorded request is still present and unchanged. Roller patch releases within the same major/minor version are compatible; changes to execution settings and inputs remain locked. Derived SFT files are rebuilt from valid primary evidence without calling the model again.
