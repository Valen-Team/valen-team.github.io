---
title: "SkillsBench"
---

# SkillsBench

Roller runs both SkillsBench conditions, `with-skill` and `no-skill`. The upstream data is at
<https://github.com/benchflow-ai/skillsbench>.

All 87 tasks in v1.1 use their repository's `verifier/test.sh`; SkillsBench does not use an LLM
judge. GPT-5.5 in the upstream README is the agent under test. To compare against that result,
`collect --model` must point to a real GPT-5.5 service. A run with another model uses the same
verifiers but produces a score for that model.

## Set up and run

```bash
# Fetch and verify SkillsBench v1.1, then build Roller's OpenCode base image.
scripts/prepare-skillsbench.sh "$PWD/.benchmarks/skillsbench-v1.1"
export SKILLSBENCH_ROOT="$PWD/.benchmarks/skillsbench-v1.1"

export MODEL_API_BASE_URL=https://api.example.com/v1
export MODEL_API_KEY=replace-with-your-api-key
export ROLLER_RUN_ROOT="$PWD/runs/skillsbench"
mkdir -p "$ROLLER_RUN_ROOT"

roller collect --bench skillsbench --bench-root "$SKILLSBENCH_ROOT" \
  --bench-variant with-skill --model example-model \
  --opencode-api-base "$MODEL_API_BASE_URL" \
  --opencode-api-key-env MODEL_API_KEY --parallel 1 --grader-parallel 1 \
  --output "$ROLLER_RUN_ROOT" --run-name with-skill

roller collect --bench skillsbench --bench-root "$SKILLSBENCH_ROOT" \
  --bench-variant no-skill --model example-model \
  --opencode-api-base "$MODEL_API_BASE_URL" \
  --opencode-api-key-env MODEL_API_KEY --parallel 1 --grader-parallel 1 \
  --output "$ROLLER_RUN_ROOT" --run-name no-skill
```

`prepare-skillsbench.sh` accepts any persistent directory. It clones v1.1 when the directory is
missing. For an existing checkout, it verifies the commit without changing the data. It also builds
`roller-opencode:1.19.6` and does not read or write an API key. To prepare the environment manually,
check out the `v1.1` tag and build `docker/opencode`.

Before running the commands, replace the example API URL, key, and model ID with the values from
the model provider.

Each `collect` command writes `tasks.jsonl` and `bench-report.json` to its run directory.
SkillsBench defaults to three samples per task, 100 OpenCode steps per turn, and 32768 output tokens
per model response. These values can be changed with `--samples`, `--opencode-max-steps`, and
`--opencode-output-tokens`.

For comparable runs, use the `v1.1` tag at commit
`b63b7b2850226b6aa4fb5929a8c1ac7bc4d9a6af`. Start with
`--bench-task-id 3d-scan-calc` to check the model endpoint, image, and output directory.
`--bench-category` and `--bench-task-id` may be repeated. For a slow model,
`--bench-timeout-multiplier 2` increases both the agent and verifier time limits.

The same runs can be described in YAML files and started with `roller bench run`; see
[Benchmark run configuration](/roller/benches/benchmark-standard/). The second layer selects the no-skill run:

```bash
roller bench run --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/skillsbench.yaml

roller bench run --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/skillsbench.yaml \
  --extra-config examples/benchmarks/skillsbench-no-skill.yaml
```

## How Roller runs a task

Roller first reads the ordered task set from
`integrations/agentbeats/task_sets/skillsbench-v1.1.json`. If that file is missing, it scans
`tasks/`.

Each task has an `environment/Dockerfile`. Roller builds that environment and adds the pinned
OpenCode harness. The image tag includes a digest of the environment, so an unchanged image can be
reused. Pass `--rebuild-task-images` to rebuild it. The last `WORKDIR` in the Dockerfile becomes
the agent's working directory.

Roller removes skill copies while building the base environment. For `with-skill`, it injects
`environment/skills/` when the task starts. For `no-skill`, it clears the supported harness skill
directories. Both conditions therefore use the same task environment and differ only in whether
the skill is available.

After the agent exits, Roller copies `verifier/` into the container, runs
`/verifier/test.sh`, and reads `/logs/verifier/reward.txt`. The agent cannot inspect verifier
files while solving the task. Agent timeouts, agent errors, verifier errors, and infrastructure
errors remain in the report but do not count toward the pass rate or mean reward.

## Network, cache, and current limits

The first run of a task may download a large set of dependencies. Docker builds, task containers,
and verifiers inherit `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` from the shell. Roller does
not store those values in the exported task JSONL. Add model endpoints that should bypass the proxy
to `NO_PROXY`.
The verifier retries temporary download and DNS failures that happen before tests begin. A sample
that still fails is marked score-ineligible. Write formal run output to persistent shared storage.

The adapter reads the default upstream `tasks/` set and does not include `tasks-extra/`
automatically. It keeps declared taxonomy, CPU, memory, storage, GPU, network, and OS values in
bench metadata, but it does not turn them into Docker resource limits. Apply resource limits
outside Roller when a comparison requires them. A few tasks include compose files; their verifiers
can start the required services inside the main container, so Roller builds the main Dockerfile.
