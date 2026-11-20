---
title: "Benchmark run configuration"
---

# Benchmark run configuration

`roller collect --bench` takes every setting of a benchmark run as a command-line flag.
`roller bench run` reads the same settings from layered YAML or JSON files and starts the
identical `collect --bench` run, so a run can be reviewed, versioned and repeated as a file.

```bash
roller bench run \
  --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/wildclawbench.yaml \
  --dry-run
```

Remove `--dry-run` after checking the plan. The run directory, `tasks.jsonl`, `score.json` and
`bench-report.json` are the same as those of `collect --bench`. `info.json` additionally records
the configuration sources under `bench_run_config`.

`roller init` copies the example configurations to `examples/benchmarks/` in the working
directory. In a source checkout, `scripts/run-benchmark.sh` locates the `roller` executable and
passes its arguments to `roller bench run`.

## Configuration layers

`--config` accepts a YAML or JSON file. `--extra-config` accepts a file or an inline JSON object
and can be repeated; later layers override earlier ones. Objects merge recursively, while lists
and scalar values are replaced. Setting an optional object to `null` discards it, for example
to clear the previous layer's `harness.extra` when changing Harnesses.

The examples keep the model connection and execution settings in `base.yaml` and the benchmark,
its grading environment and its Harness in one file per benchmark:

```yaml
schema_version: roller.bench-run/v1

benchmark:
  id: wildclawbench
  root: ${WILDCLAWBENCH_ROOT}
  variant: null
  categories: []
  task_ids: []
  timeout_multiplier: 1
  extra: {}
  environment:
    JUDGE_MODEL: ${ROLLER_JUDGE_MODEL}

model:
  id: ${ROLLER_MODEL_ID}
  provider: roller              # OpenClaw namespace; other Harnesses ignore it
  base_url: ${ROLLER_MODEL_BASE_URL}
  api_key_env: ROLLER_MODEL_API_KEY
  api_protocol: openai-completions  # optional; inferred from the Harness when omitted
  thinking: high

harness:
  id: openclaw
  image: wildclawbench-ubuntu:v1.3
  extra:
    max_tokens: 32768

execution:
  output: ${ROLLER_BENCH_OUTPUT}
  run_name: wildclawbench
  parallel: 4
  grader_parallel: 2
  samples: 1
  retries: 0
  timeout: 600
  wire_trace: actf
  keep_thinking: true
  pass_env: []
```

An environment reference must occupy the whole value, as in `${ROLLER_MODEL_BASE_URL}`. Roller
rejects forms such as `https://${HOST}/v1` and references to unset variables.
`model.api_key_env` names the host variable that holds the model key; the key itself is not
written to the file. `model.base_url` must not contain user information, a query string or a
fragment, because the endpoint is passed to the Harness as an argument.

Roller checks the merged configuration before it starts any container, and unknown fields are
errors. [`schemas/bench-run.schema.json`](https://github.com/Valen-Team/Roller/blob/main/schemas/bench-run.schema.json) describes one
layer for editors and CI, so a layer may omit fields that another layer supplies.

## Fields

| Field | `collect` flag | Purpose |
| --- | --- | --- |
| `benchmark.id` | `--bench` | Adapter listed by `roller bench list` |
| `benchmark.root` | `--bench-root` | Prepared upstream checkout or data directory |
| `benchmark.variant` | `--bench-variant` | Evaluation condition, such as SkillsBench `with-skill` |
| `benchmark.categories` / `task_ids` | `--bench-category` / `--bench-task-id` | Filters; an empty list selects everything |
| `benchmark.timeout_multiplier` | `--bench-timeout-multiplier` | Scales each task timeout |
| `benchmark.environment` | none | Variables set for this process only and restored afterwards, for judges and benchmark tools |
| `benchmark.extra` | see below | Options of the selected benchmark |
| `model.id` | `--model` | Model under test |
| `model.label` | `--model-label` | Local label for sample directories and container names |
| `model.provider` | none | OpenClaw provider namespace, `roller` by default; other Harnesses receive `model.id` unchanged |
| `model.base_url` | `--api-base` | Model API endpoint |
| `model.api_key_env` | `--api-key-env` | Host environment variable that holds the model key |
| `model.api_protocol` | none | API protocol; written to the generated OpenClaw provider and checked against the native protocol of other Harnesses |
| `model.params` | none | Extra fields of the generated OpenClaw model entry |
| `model.thinking` | `--thinking` | Thinking level, validated and mapped by each Harness |
| `harness.id` / `image` | `--harness` / `--docker-image` | Harness and container image |
| `harness.extra` | see below | Options of the selected Harness |

For OpenClaw, Roller generates a temporary models file from `model.id`, `base_url`,
`api_key_env`, `api_protocol` and `params`, and removes it after the command. When
`model.provider` is omitted, an ID of the form `provider/model` is split at the first slash. To
supply a complete models file instead, set `harness.extra.model_config` and set the inherited
`model.base_url`, `model.api_key_env` and `model.api_protocol` to `null` in that layer; the two
forms cannot be combined.

Codex uses `openai-responses`, Claude Code uses `anthropic-messages`, and Hermes, OpenCode,
DeepSeek and Pi use `openai-completions`. Roller rejects a conflicting `api_protocol`.

`benchmark.environment` maps shared variables to the names a benchmark expects:

```yaml
benchmark:
  environment:
    PINCHBENCH_JUDGE_BASE_URL: ${ROLLER_JUDGE_BASE_URL}
    PINCHBENCH_JUDGE_API_KEY: ${ROLLER_JUDGE_API_KEY}
    PINCHBENCH_JUDGE_MODEL: ${ROLLER_JUDGE_MODEL}
```

These values do not appear on the command line. The dry-run output and `info.json` record the
effective settings, the configuration paths, a digest of the redacted configuration and the
names of the environment variables, without secret values.

`benchmark.extra` currently has one field, QwenClawBench's `runs_per_task`
(`--bench-runs-per-task`). It duplicates each selected task and keeps the upstream run index in
the bench metadata. `execution.samples` is the ordinary repeated sampling; setting both
multiplies the number of trajectories.

### Execution

| Field | `collect` flag |
| --- | --- |
| `output`, `run_name` | `--output`, `--run-name` |
| `parallel`, `launch_interval`, `grader_parallel`, `grader_retries` | `--parallel`, `--launch-interval`, `--grader-parallel`, `--grader-retries` |
| `samples`, `retries`, `retry_backoff`, `timeout` | `--samples`, `--retries`, `--retry-backoff`, `--timeout` |
| `max_consecutive_errors` | `--max-consecutive-errors` |
| `start_index`, `limit`, `resume`, `resume_verify_outputs`, `resume_unscored` | `--start-index`, `--limit`, `--resume`, `--resume-verify-outputs`, `--resume-unscored` |
| `wire_trace`, `keep_thinking` | `--wire-trace`, `--keep-thinking` / `--no-keep-thinking` |
| `capture_calls`, `capture_debug`, `token_ids` | `--capture-calls`, `--capture-debug`, `--token-ids` |
| `sandbox_provider`, `sandbox_template` | `--sandbox-provider`, `--sandbox-template` |
| `thinking_capabilities` | `--thinking-capabilities` |
| `pass_env` | `--pass-env`, once per name |
| `container_user`, `network`, `docker_binary` | `--container-user`, `--network`, `--docker-binary` |
| `keep_container_on_error`, `rebuild_task_images` | `--keep-container-on-error`, `--rebuild-task-images` |
| `max_input_file_bytes`, `max_task_input_bytes` | `--max-input-file-bytes`, `--max-task-input-bytes` |

### Harness options

`harness.extra` uses names without the Harness prefix:

| Harness | `extra` fields |
| --- | --- |
| OpenClaw | `model_config`, `gateway_port`, `gateway_port_step`, `gateway_startup_timeout`, `model_request_timeout`, `max_tokens`, `session_id`, `search_provider`, `collect_paths`, `set_image_model`, `cache_trace`, `config_set` |
| Codex | `config`, `config_set`, `reasoning_summary`, `web_search`, `websockets`, `image_detail` |
| Claude Code | `settings`, `max_turns`, `max_thinking_tokens`, `permission_mode`, `capture_calls`, `unique_tool_ids` |
| Hermes | `max_iterations`, `context_length`, `vision`, `toolsets` |
| OpenCode | `max_steps`, `context_length`, `output_tokens`, `vision`, `native_tools`, `deny_tools` |
| DeepSeek | `max_steps`, `context_length`, `output_tokens`, `profile`, `permission_mode`, `input_modalities` |
| Pi | `max_steps`, `context_length`, `output_tokens`, `input_modalities` |

`config_set` is a list of `KEY=VALUE` strings, one `--openclaw-config-set` or
`--codex-config-set` each. `model_request_timeout` requires an OpenClaw release whose provider
schema accepts `timeoutSeconds`; `wildclawbench-ubuntu:v1.3` does not, so the WildClawBench
example leaves it unset.

When a layer changes the Harness that a benchmark example selects, it overrides the image and
clears the options together:

```yaml
harness:
  id: codex
  image: wildclawbench-codex-ubuntu:v0.0
  extra: null
```

### Flags without a field

A configuration describes one benchmark on one Harness. `--tasks`, `--prompt-key`, `--id-key`
and `--workspace` belong to task-file runs. The per-Harness `--<harness>-image`,
`--<harness>-api-base` and `--<harness>-api-key-env` overrides belong to mixed-Harness task
files; `harness.image`, `model.base_url` and `model.api_key_env` set the same values here.
`--task-timeouts` is always on with a benchmark, and `--log-level` keeps its default.

## Prepare, run, report

Each benchmark with an example configuration has `scripts/prepare-<id>.sh [ROOT]`, and
`scripts/prepare-benchmark.sh` dispatches to it by ID:

```bash
scripts/prepare-benchmark.sh wildclawbench "$WILDCLAWBENCH_ROOT"
scripts/prepare-benchmark.sh pinchbench "$PINCHBENCH_ROOT"
scripts/prepare-benchmark.sh qwenclawbench "$QWENCLAWBENCH_ROOT"
scripts/prepare-benchmark.sh skillsbench "$SKILLSBENCH_ROOT"
```

A preparation script fetches the pinned upstream revision and the Harness image. It reports an
error when an existing checkout is at another revision and leaves that checkout unchanged. It
does not read or write model or judge keys.

```bash
export ROLLER_MODEL_ID=example-model
export ROLLER_MODEL_BASE_URL=https://api.example.com/v1
export ROLLER_MODEL_API_KEY=replace-with-your-api-key
export ROLLER_BENCH_OUTPUT="$PWD/runs"

roller bench run \
  --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/wildclawbench.yaml \
  --dry-run

roller bench run \
  --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/wildclawbench.yaml
```

`--dry-run` loads the adapter, selects the tasks and validates the endpoint, key variable,
thinking level and Harness options. It prints the effective configuration, the task and
trajectory counts, the image and the per-task timeouts without starting a container or creating
a run directory.

The run writes `bench-report.json`. To rebuild it after auditing or repairing samples:

```bash
roller bench report runs/<run-name> --output runs/<run-name>/bench-report.json
```

## Example configurations

| Benchmark | Layer after `base.yaml` | Preparation script |
| --- | --- | --- |
| [WildClawBench](/roller/benches/wildclawbench/) | `examples/benchmarks/wildclawbench.yaml` | `scripts/prepare-wildclawbench.sh` |
| [PinchBench](/roller/benches/pinchbench/) | `examples/benchmarks/pinchbench.yaml` | `scripts/prepare-pinchbench.sh` |
| [QwenClawBench](/roller/benches/qwenclawbench/) | `examples/benchmarks/qwenclawbench.yaml` | `scripts/prepare-qwenclawbench.sh` |
| [SkillsBench](/roller/benches/skillsbench/), with skill | `examples/benchmarks/skillsbench.yaml` | `scripts/prepare-skillsbench.sh` |
| SkillsBench, no skill | `skillsbench.yaml`, then `examples/benchmarks/skillsbench-no-skill.yaml` | Same as above |

Each bench guide lists the settings that must match upstream and the environment variables its
graders read. An example for another bench is named `examples/benchmarks/<id>.yaml` after the
adapter ID, with `scripts/prepare-<id>.sh` beside it, and contains only public defaults and
environment references. [Adding a new bench](/roller/benches/bench-format/#6-adding-a-new-bench) covers the
adapter itself.
