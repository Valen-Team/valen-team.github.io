---
title: "Bench integration and scoring"
---

# Bench integration and scoring

Roller destroys the container after a task finishes. The bench layer adds
task export and scoring before that teardown:

1. Convert a checked-out benchmark into a `roller.task/v1` task list
   (`roller bench export`);
2. After the Agent's last turn and before the container is destroyed, run that
   bench's own grader in the same container, and write the score to
   `score.json`.

`roller collect --bench NAME --bench-root ROOT` performs translation,
collection, grading, and aggregation in one command. The three-step `bench
export` / ordinary `collect` / `bench report` interface remains available for
inspecting or editing the intermediate task JSONL. Registered adapters
are listed by `roller bench list`.

## 1. Why the grader must run inside the container

Bench scoring almost always requires files written by the Agent during the task (generated scripts,
rendered figures, downloaded data), and `session.finish()` runs
`rm -f <container>`. Therefore the grader cannot run after `collect` returns. The grader
must run at this point:

```
session.start() → per-turn send() → [grader runs here] → session.finish() (destroy the container)
```

`GradedHarness` wraps an `InteractiveHarness` and reuses its run loop, inserting
the grader between the last turn and teardown without changing the wrapped harness.

Only `InteractiveHarness` can provide a live container. Running a bench on a
non-interactive harness therefore raises `TypeError` at startup. The error reports the
missing scoring support before a batch of tasks runs.

## 2. Three seams: why existing code requires few changes

The bench layer uses three existing interfaces:

| Interface | Behavior | Integration |
| --- | --- | --- |
| `load_tasks()` | Does not reject unknown top-level keys | Add a `bench` block to a task row without changing `tasks.py` |
| `_finalize_sample` | Copies everything in `HarnessResult.metadata` except three reserved keys into `info.json["runtime"]` | Scores are saved with metadata, without changing the result schema |
| `finish()` | Destroys the container and is memoized | Use `GradedHarness` to score before teardown without changing the harness |

These mechanisms are additive: ordinary `--tasks` collection retains its
semantics, while bench mode adds per-task timeouts, in-container grading, a
task snapshot, and an automatic report.

## 3. The `bench` block (`roller.bench/v1`)

Every task row produced by `bench export` has a `bench` block in addition to the
standard task fields:

```json
{
  "schema_version": "roller.task/v1",
  "id": "03_Social_Interaction_task_2_group_chat_zh",
  "harness": "openclaw",
  "prompt": "……",
  "timeout_seconds": 900,
  "workspace": "/abs/path/to/workspace/03_task2/exec",
  "files": {
    "context": [
      {"role": "skill", "source": "/abs/skills/03_task2", "target": "skills/03_task2"},
      {"role": "fixture", "source": "/abs/workspace/03_task2/tmp", "target": "tmp", "capture": "none"}
    ]
  },
  "runtime": {"env": ["OPENROUTER_API_KEY", "JUDGE_MODEL"], "setup": ["python3 mock_server.py &"]},
  "bench": {
    "schema_version": "roller.bench/v1",
    "name": "wildclawbench",
    "category": "03_Social_Interaction",
    "metadata": {"name": "群聊摘要", "modality": "pure-text", "source_path": "…"},
    "grade": {
      "code": "def grade(transcript, workspace_path):\n    ...",
      "env": ["OPENROUTER_API_KEY", "JUDGE_MODEL"],
      "timeout_seconds": 120,
      "workspace_path": "/tmp_workspace",
      "score_key": "overall_score",
      "stage": [{"source": "/abs/workspace/03_task2/gt", "target": "gt"}]
    }
  }
}
```

### 3.1 `bench.grade` fields

| Field | Default | Description |
| --- | --- | --- |
| `code` | required | Grader Python source. Must contain at least one entry function |
| `entrypoint` | `grade` | Entry function name. Must be a legal identifier |
| `kwargs` | `{}` | Extra arguments passed to the entry function |
| `env` | `[]` | Environment variable names to pass from the host into the grading container |
| `timeout_seconds` | `120` | Grading timeout, 1 to 3600 |
| `needs_transcript` | `true` | Whether the session record must be passed to the grader |
| `workspace_path` | harness default | Grader working directory (absolute path inside the container) |
| `transcript_path` | derived automatically | Set only when the harness cannot report the session file location itself |
| `score_key` | `overall_score` | Key in the grader return value that is used as the total score |
| `grade_on_agent_failure` | `false` | Grade the live workspace when the Agent timed out or exited with an error; by default such a sample is recorded as unscored |
| `stage` | `[]` | Host paths copied into the container only before grading; see §4 |

Grader calling convention:

```python
def grade(
    transcript, workspace_path
):  # transcript is passed only when needs_transcript is set
    ...
    return {"overall_score": 0.75, "detail": {...}}  # must return a dict
```

A non-dict return raises an error. Roller wraps the function in a runner, copies
it into the container with `docker cp`, and marks the score on stdout with a
`__ROLLER_SCORE__` prefix. The prefix separates the result from progress output
and judge request logs.

### 3.2 A grading failure is not a 0 score

Grading failures are recorded separately from valid zero scores:

- If the grader returns `overall_score: 0.0` normally, the score is a valid 0.
- If the grader crashes, times out or produces unparseable output, or a `stage`
  source is missing on the host, `score.json` still contains a 0 and an `error`
  field. Aggregation counts the sample in `unscored_count` and lists it separately in
  the report.

## 4. `stage`: do not put answers in the Agent workspace

Many benches keep ground truth and seed files in the same directory. If the
whole directory is mounted into the container, the Agent can read the answers.
This exposes ground truth to the model and invalidates the evaluation setup.

`stage` copies files from the host to the container after the Agent's last turn
and before grading. Files supplied through `stage` are therefore unavailable
to the model while it works on the task.

Constraints: `source` must be an absolute host path, and `target` must be a
relative path inside the workspace. A target that starts with `/` or contains
`..` is rejected immediately; otherwise a bench definition could write files
anywhere in the container.

A missing host `source` produces a grading error. This distinguishes missing
scoring files from a zero score caused by an incorrect answer.

## 5. Aggregation

`roller bench report <run_dir>` scans samples under the run, reads
`info.json["runtime"]["bench"]`, and aggregates with each bench's
`aggregate()` (default: `mean_aggregate`).

The default mean divides by the full sample count and counts grading failures as 0,
which matches the official reporting method of common benches. The report also lists separately:

- `scored_count` / `unscored_count`
- `scored_average` (mean over successfully scored samples only)
- Per-category mean and sample count
- A list of unscored samples and why

The full-sample mean includes the effect of grading failures; the scored-only
mean excludes those samples. Reporting both helps identify whether grader
failures contributed to a low score.

> `bench report` computes scores from `score.json`, without using `info.json`
> `status`. `status: "error"` is often only an SFT export failure (for example
> an image in an observation, where a text-only export would drop data). The
> score on that sample is still valid. Do not use `status` to measure "run
> failure rate."

## 6. Adding a new bench

Implement and register an adapter subclass. Its `load()` method converts task
definitions without executing tasks:

```python
# src/roller/benches/mybench.py
from roller.benches.base import BenchAdapter, BenchBinding, GradeSpec


class MyBenchAdapter(BenchAdapter):
    name = "mybench"
    description = "MyBench: one-line description"

    def load(self, root, *, categories=None, task_ids=None):
        rows = []
        for spec in _iter_upstream_tasks(root):
            binding = BenchBinding(
                name=self.name,
                category=spec.category,
                grade=GradeSpec(code=spec.grader_source, env_names=("JUDGE_MODEL",)),
            )
            rows.append(
                {
                    "schema_version": "roller.task/v1",
                    "id": spec.id,
                    "harness": "openclaw",
                    "prompt": spec.prompt,
                    "timeout_seconds": spec.timeout,
                    "bench": binding.as_dict(),
                }
            )
        return rows
```

Then add one line to the registry in `src/roller/benches/__init__.py`. Optionally,
override `categories()` and `aggregate()` (required only to match the
upstream reporting method).

Account for the following when implementing an adapter:

- Read `categories()` from the actual checkout. Some checkouts omit upstream
  categories, so a hard-coded list can make `--category` select an empty set.
- Report an error for an unknown `--task-id`, so an empty run is not mistaken
  for a completed evaluation.
- Let parsers accept strings instead of `Path`, so parsing can be tested
  without filesystem access.
- Preserve prompt prefixes and suffixes added by the upstream runner, including
  content absent from task files. For example, omitting WildClawBench's
  277-character prefix changes the task input.
- Report required external dependencies at export time. WildClawBench
  `web_search` uses a local shim rather than calling Brave directly. If the shim
  is not configured, searches return `fetch failed`, but the Agent continues
  and the run produces scores. Check for these errors before interpreting
  search behavior or evaluation results.

### 6.1 Every bench needs a README

When an adapter is added, add a page for the bench to this documentation in English and Chinese:
`roller/benches/<name>.md` and its counterpart under `i18n/zh-Hans/` in the [website repository](https://github.com/Valen-Team/valen-team.github.io).
The page describes the bench's configuration and links to this page for shared
behavior. It should include:

1. Commands from cloning upstream through `bench report`;
2. A table mapping upstream options to Roller settings, including CLI flags and
   environment variables;
3. Unsupported upstream options and why other flags cannot replace them (for example, WCB's timeout multiplier rewrites
   the task file and therefore also changes the budget stated to the Agent in the
   prompt; `--timeout` changes only the wall-clock time and is not equivalent);
4. Required environment variables and whether they need `--pass-env`;
5. Known issues, especially those that affect validity without raising errors,
   with commands to check for them after a run.

Mark unsupported settings in the mapping table so users can check whether
Roller and upstream runs use the same evaluation conditions.

## 7. CLI

```bash
# List adapters
roller bench list

# Recommended: translate, collect, grade, and report in one command
roller collect --bench wildclawbench --bench-root /path/to/WildClawBench \
    --bench-category 03_Social_Interaction --model <provider>/<model> \
    --harness openclaw --openclaw-image wildclawbench-ubuntu:v1.3 \
    --parallel 4 --pass-env JUDGE_MODEL --pass-env OPENROUTER_API_KEY

# Advanced three-step workflow: translate without executing
roller bench export wildclawbench /path/to/WildClawBench --output tasks/wcb.jsonl
roller bench export wildclawbench /path/to/WildClawBench -o /tmp/one.jsonl \
    --category 03_Social_Interaction --task-id 03_Social_Interaction_task_2_group_chat_zh
roller bench export qwenclawbench /path/to/QwenClawBench -o /tmp/qcb.jsonl \
    --runs-per-task 3

# Collect and grade; --task-timeouts honors each row's timeout_seconds
roller collect --tasks tasks/wcb.jsonl --model <provider>/<model> \
    --harness openclaw --openclaw-image wildclawbench-ubuntu:v1.3 \
    --task-timeouts --parallel 4 \
    --pass-env JUDGE_MODEL --pass-env OPENROUTER_API_KEY --pass-env OPENROUTER_BASE_URL

# Aggregate (run_dir is positional, not --run)
roller bench report runs/<run-name>
roller bench report runs/<run-name> --output report.json
```

`--category` and `--task-id` can both be repeated. `--task-timeouts` is the key
flag for a bench run: each bench task carries its own timeout (WildClawBench
has five measured values: 300/360/600/900/1200), while `build_requests`
normally uses only one global `--timeout`. Without this flag, short tasks
receive too much time and long tasks are cut off by the wall clock. A task that is cut off
closely resembles a task that the model cannot complete.
One-command `collect --bench` enables per-task timeouts automatically and saves
`tasks.jsonl` and `bench-report.json` in the run directory. It therefore requires neither
`--task-timeouts` nor a separate `bench report` invocation.

`roller bench run --config FILE` starts the same `collect --bench` run from a YAML description;
see [Benchmark run configuration](/roller/benches/benchmark-standard/).

Environment variables required by the grader must be passed with `--pass-env`; the
bench's task definition declares which variables are required. When a variable is
missing, Roller issues a warning and continues. Before a real run, confirm that the logs do not contain
`grading environment variable ... is unset`.

## 8. Supported benches

See each bench's README for its configuration (see §6.1):

| Bench | `--harness` | README | Summary |
| --- | --- | --- | --- |
| `wildclawbench` | `openclaw` | [WildClawBench](/roller/benches/wildclawbench/) | 60 real-scenario tasks in 6 categories; the grader runs in the container; `gt/` for 26 tasks is supplied through `stage` |
| `skillsbench` | `opencode` | [SkillsBench](/roller/benches/skillsbench/) | Builds each task environment; supports `with-skill` / `no-skill` and official verifiers |
| `pinchbench` | `openclaw` | [PinchBench](/roller/benches/pinchbench/) | Manifest-driven export with automated, LLM-judge, hybrid, and multi-session tasks |
| `qwenclawbench` | `openclaw` | [QwenClawBench](/roller/benches/qwenclawbench/) | 100 tasks in 8 domains; automated/hybrid grading, penalized scores, and repeated runs |
| `swebench-pro` | `openclaw` | [SWE-Bench Pro](/roller/benches/swebench-pro/) | 731 software-engineering tasks across 11 repositories; official instance images, hidden tests, and resolved scoring |

Before running, check the README's parameter mappings and unsupported options.
Missing configuration may change evaluation conditions without raising an
error, making scores unsuitable for direct comparison.

## Reports and failed grading

Reports group results by model (and Harness when needed). Multi-model reports contain no combined average. Every collected sample, including agent startup errors, remains in its model's denominator; category averages use the same rule. Reports show scored and unscored counts and reasons, plus an average over scored samples for diagnosis. Planned requests without any sample are listed separately.

A genuine score of zero is scored. A grader error is unscored and makes collection exit unsuccessfully. Fix its cause and use `--resume --resume-unscored` to rerun only affected samples; the agent is run again because its disposable workspace is gone. `--grader-retries` retries grading before the live container is removed.
