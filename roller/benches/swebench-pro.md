---
title: "SWE-Bench Pro"
---

# SWE-Bench Pro

Roller runs the 731 tasks from 11 repositories in the public SWE-Bench Pro test split. It reuses
the official instance images, `run_script.sh`, `parser.py`, the fail-to-pass and pass-to-pass
test sets, and the resolved criterion. The upstream repository is
<https://github.com/scaleapi/SWE-bench_Pro-os>.

## Prepare the environment

```bash
git clone https://github.com/scaleapi/SWE-bench_Pro-os.git "$PWD/.benchmarks/swebench-pro"
export SWEBENCH_PRO_ROOT="$PWD/.benchmarks/swebench-pro"

export MODEL_API_BASE_URL=https://api.example.com/v1
export MODEL_API_KEY=replace-with-your-api-key
export ROLLER_RUN_ROOT="$PWD/runs/swebench-pro"
mkdir -p "$ROLLER_RUN_ROOT"
```

The bench root needs the upstream `run_scripts/` directory and the test split of the
[`ScaleAI/SWE-bench_Pro`](https://huggingface.co/datasets/ScaleAI/SWE-bench_Pro) dataset, saved
as `test.jsonl`, `data.jsonl`, `test.parquet`, or `data/test.parquet`. Roller reads the first of
these that exists. Reading Parquet requires the optional extra:

```bash
pip install 'roller-agent[swebench-pro]'
```

The instance images are published for `linux/amd64` as `jefzda/sweap-images:<dockerhub_tag>`.
The Harness image must have the same architecture as the instance image; Roller stops before
building when they differ. For OpenClaw, use the official `linux/amd64` image, which provides
Node at `/usr/local/bin/node` and OpenClaw under `/app`.

Before starting a larger job, run one instance:

```bash
roller collect --bench swebench-pro --bench-root "$SWEBENCH_PRO_ROOT" \
  --bench-task-id instance_flipt-io__flipt-a0cbc0cb65ae601270bdbe3f5313e2dfd49c80e4 \
  --model example/example-model --model-config example.models.json \
  --parallel 1 --grader-parallel 1 \
  --output "$ROLLER_RUN_ROOT" --run-name smoke
```

The command writes `smoke/tasks.jsonl` and `smoke/bench-report.json`. `--bench-category` takes a
repository name such as `flipt-io/flipt`. The model configuration has the same format as in the
[PinchBench guide](/roller/benches/pinchbench/#prepare-the-environment).

The first run of an instance pulls its image and builds a derived image, which takes
considerable network traffic and disk space. Later runs reuse the local images. A full run
pulls one image per instance, so monitor Docker disk usage.

## Runner script

`scripts/run-swebench-pro.sh` exports the tasks, collects trajectories, and writes
`<OUTPUT_ROOT>/<RUN_NAME>/report.json`:

```bash
SWEBENCH_PRO_ROOT="$PWD/.benchmarks/swebench-pro" \
MODEL=example/example-model \
MODEL_CONFIG=example.models.json \
TASK_IDS=instance_flipt-io__flipt-a0cbc0cb65ae601270bdbe3f5313e2dfd49c80e4 \
./scripts/run-swebench-pro.sh
```

`HARNESS` defaults to `openclaw`. `TASK_IDS` and `CATEGORIES` accept comma-separated lists.
`PARALLEL`, `RETRIES`, `OUTPUT_ROOT`, and `RUN_NAME` override their defaults. For another
Harness, set `HARNESS`, `API_BASE`, and `API_KEY_ENV`; `API_KEY_ENV` is the name of the variable
that holds the model API key. `MAX_STEPS` maps to the corresponding Claude Code, Hermes,
OpenCode, DeepSeek, or Pi option. Arguments after the script are appended to `roller collect`,
for example `--resume`.

## Harnesses and images

Exported tasks default to `harness: openclaw`, which `--harness` can override. Roller supports
OpenClaw, Codex, Claude Code, Hermes, OpenCode, DeepSeek, and Pi.

For each instance, Roller combines the instance image with the selected Harness image:

| Harness | Derived image |
| --- | --- |
| OpenClaw | The instance image with the OpenClaw runtime added. Node is installed at `/opt/roller-node/bin/node`, so the Node of the project is unchanged |
| Other Harnesses | The Harness image with the `/app` repository copied from the instance image. System dependencies come from the Harness image and can differ from the instance image |

Derived images are tagged `roller-swebench-pro-<harness>:<digest>` and cached by instance image,
Harness image, and Harness name. The task container runs as root, regardless of
`--container-user`, because task setup rewrites the repository under `/app`.

## Execution and scoring

The Agent works in `/app`. Before the Agent starts, Roller resets the repository to
`base_commit`, removes the upstream `.git` history, and commits the tracked files to a new
repository. The gold commit is therefore not available in Git, and the exported tasks do not
contain the gold patch.

After the last turn, Roller extracts the tracked, untracked, and committed changes of the Agent
as `model.patch` and starts a new container from the instance image. Only this container
receives the model patch, the hidden `test.patch`, and the official runner and parser. The
grader applies the model patch to the baseline, restores the hidden versions of the test files,
and runs the official script. The grading container is removed afterwards.

A task is resolved when every fail-to-pass and pass-to-pass test is in the `PASSED` set of the
parser. `overall_score` is 1 for a resolved task and 0 otherwise.

Binary file changes are not part of the graded patch. Roller lists their paths in
`scores.dropped_binary_files` in `score.json` and logs a warning, so a score that depends on a
binary change can be identified.

The `results/` directory of each sample contains `model.patch`, `test_stdout.log`,
`test_stderr.log`, and `test_output.json`. The score is in `score.json`.

## Grading options

Three environment variables change the task setup and grading. All are off by default. Roller
reads them when it converts the tasks, that is, during `collect --bench` or `bench export`, and
records the values in `bench.metadata.evaluation_protocol` and `bench.metadata.go_proxy`.

| Variable | Effect |
| --- | --- |
| `SWEBENCH_PRO_REPAIR_TEST_FIXTURES=1` | Adds text test data that the upstream `test.patch` omits. Roller takes it from test-data directories in the gold patch and applies it only in the grading container |
| `SWEBENCH_PRO_EXCLUDE_AGENT_TESTS=1` | Leaves changes that the Agent made to Go, Python, and JavaScript test sources out of the graded patch, so that they do not collide with the hidden tests. `model.patch` keeps all changes; the graded patch is saved as `graded.patch` |
| `SWEBENCH_PRO_GO_PROXY=<url>` | Sets `GOPROXY` in the task and grading containers, for example `https://goproxy.cn,direct`. When the tests report missing `go.sum` entries, the grader downloads the dependencies and runs the tests once more within the same time budget. The first logs and the dependency changes are saved in `results/` |

The boolean variables accept `1`, `true`, `yes`, `on`, `0`, `false`, `no`, and `off`.
`SWEBENCH_PRO_CACHE_DIR` sets the directory for the extracted test patches, which defaults to
`~/.cache/roller/benches/swebench-pro`.

Scores obtained with these options differ from the upstream protocol. State the options when
reporting them.

## Upstream option mapping

| SWE-Bench Pro | Roller |
| --- | --- |
| Dataset and `run_scripts/` | `--bench-root` |
| Instance selection | `--bench-task-id`, `--bench-category` |
| Docker or Modal backend | Local Docker only |
| `--block_network` | Not available. The container network stays enabled for the model API |
| Worker count | `--parallel`, `--grader-parallel` |

The task timeout is 3600 seconds, and grading has a separate limit of 3600 seconds.
`collect --bench` applies the task timeout automatically; add `--task-timeouts` when collecting
from an exported task file.
