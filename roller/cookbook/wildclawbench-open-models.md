---
title: "WildClawBench with two self-hosted models"
description: "One Roller run from model serving to a published Hugging Face dataset: GLM-5.3-Flash and DeepSeek-V4.1-Flash on WildClawBench, collected, graded, and exported."
---

# WildClawBench with two self-hosted models

This page follows one Roller run from model serving to a published dataset. Two
open-weight models, GLM-5.3-Flash and DeepSeek-V4.1-Flash, run 28 WildClawBench
tasks three times each in the OpenClaw Harness, and Roller collects and grades
every trajectory in a single run. The trajectories are published as the dataset
[Valen-Team/Roller-WildClawBench-Trajectories](https://huggingface.co/datasets/Valen-Team/Roller-WildClawBench-Trajectories),
which holds the 44 trajectories of the first 8 tasks.

| Item | Value |
| --- | --- |
| Tasks | 28 of the 60 WildClawBench tasks: the ones that run on the model, local files, and the mock services shipped with the task |
| Models | `glm-5.3-flash` and `deepseek-v4.1-flash-1017`, each served with vLLM |
| Rollouts | 28 tasks × 3 runs × 2 models = 168 |
| Harness | OpenClaw 2026.3.11, image `wildclawbench-ubuntu:v1.3` |
| Grading | In the task container before teardown; GLM-5.3-Flash is the judge |
| Roller | Commit `58331a757578f98258376b93040b4b28125e86d6` |
| Throughput | The 44 published trajectories are 7.2 hours of agent time, collected in 77 minutes |

The configuration files and the commands of this page are in
[`examples/cookbook/wildclawbench-open-models`](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/wildclawbench-open-models).
To run the same pipeline on other models, change `models.json`; section 9 lists
what else can change.

## 1. Requirements

- Roller from the `main` branch, which has `roller export --format hf`, and a running Docker daemon:

  ```bash
  pip install git+https://github.com/Valen-Team/Roller.git
  ```

- A WildClawBench checkout and its image `wildclawbench-ubuntu:v1.3`. See [WildClawBench](/roller/benches/wildclawbench/). This run uses revision `41bfe78a4d04369887687397708504882a80c17a`.
- An OpenAI Chat Completions endpoint with tool calling that serves both models. This run serves each model with vLLM:

| Setting | GLM-5.3-Flash | DeepSeek-V4.1-Flash |
| --- | --- | --- |
| Served model name | `glm-5.3-flash` | `deepseek-v4.1-flash-1017` |
| Weights | [zai-org/GLM-5.3-Flash](https://huggingface.co/zai-org/GLM-5.3-Flash), FP8 | [deepseek-ai/DeepSeek-V4.1-Flash-1017](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017), FP8/FP4 mixed quantization |
| Acceleration | MTP=5 | DSpark=5, engram CPU offload |
| Reasoning | `reasoning_effort=max` | `thinking=true`, `reasoning_effort=100` |
| Sampling | vLLM server defaults | vLLM server defaults |

The reasoning settings are vLLM server defaults, set with
`--default-chat-template-kwargs`. Roller sends no reasoning effort, temperature,
or `top_p` in this run, so the request bodies in `wire_trace.jsonl` contain none
of these settings.

## 2. Describe the models

Both models go in one `models.json`, so one `roller collect` command runs them
side by side. The address and the key come from environment variables:

```json
{
  "mode": "merge",
  "providers": {
    "vllm": {
      "baseUrl": "${ROLLER_INFER_BASE_URL}",
      "apiKey": "${ROLLER_INFER_API_KEY}",
      "api": "openai-completions",
      "models": [
        {
          "id": "glm-5.3-flash",
          "name": "glm-5.3-flash",
          "input": ["text", "image"],
          "reasoning": true,
          "maxTokens": 32768,
          "contextWindow": 98304,
          "compat": {"supportsReasoningEffort": false}
        },
        {
          "id": "deepseek-v4.1-flash-1017",
          "name": "deepseek-v4.1-flash-1017",
          "input": ["text", "image"],
          "reasoning": true,
          "maxTokens": 32768,
          "contextWindow": 1048576,
          "compat": {"supportsReasoningEffort": false}
        }
      ]
    }
  }
}
```

| Field | Purpose in this run |
| --- | --- |
| `input` | Declares image input, so OpenClaw sends the images of a task to the model |
| `reasoning` | Declares a reasoning model |
| `contextWindow` | The context length the model is served with; OpenClaw keeps the conversation within it |
| `compat.supportsReasoningEffort` | `false` keeps OpenClaw from sending its own effort level, which would replace the server default |

The model reference on the command line is `<provider>/<id>`:
`vllm/glm-5.3-flash` and `vllm/deepseek-v4.1-flash-1017`. When the two models
have separate addresses, give each its own provider. See
[OpenClaw configuration](/roller/harnesses/openclaw-configuration/) for the
other fields.

## 3. Choose the tasks

WildClawBench has 60 tasks in 6 categories. Some of them need web search, web
pages, or another model API. This run keeps the tasks that need none of these:

| Category | Kept | Tasks |
| --- | ---: | --- |
| Productivity Flow | 3 | Calendar scheduling, PDF digest, image categorization |
| Code Intelligence | 11 | Homepages, puzzles, and SAM 3 inference and debugging, on local code, weights, and images |
| Social Interaction | 6 | Meeting negotiation and chat tasks; mail, chat, and calendar are mock services inside the container |
| Search Retrieval | 0 | Every task needs web search |
| Creative Synthesis | 4 | Posters and an outfit image, from local material |
| Safety Alignment | 4 | Malicious skill, authority, risky OS operation, prompt injection |
| Total | 28 | |

The kept task IDs are in `task-ids.txt`, one per line. To inspect the tasks of a
checkout before choosing, export them without running anything:

```bash
roller bench export wildclawbench ~/WildClawBench --output /tmp/wildclawbench.jsonl
```

## 4. Use a self-hosted judge

The graders of 46 of the 60 tasks call a judge model. They read the endpoint
from three environment variables, and the OpenClaw Harness passes these to the
container by default. This run points them at the endpoint of the two models
and names GLM-5.3-Flash as the judge:

```bash
export OPENROUTER_BASE_URL="$ROLLER_INFER_BASE_URL"
export OPENROUTER_API_KEY="$ROLLER_INFER_API_KEY"
export JUDGE_MODEL=glm-5.3-flash
```

The remaining graders check files and tool calls without a judge. Both models
are graded by the same judge with the same prompts, so their scores compare
with each other. The WildClawBench leaderboard uses a different judge model.

## 5. Collect

Check the plan first. A dry run resolves the tasks and validates the inputs
without starting a container or calling a model:

```bash
roller collect --bench wildclawbench --bench-root ~/WildClawBench \
  $(sed 's/^/--bench-task-id /' task-ids.txt) \
  --bench-runs-per-task 3 \
  --model vllm/glm-5.3-flash \
  --model vllm/deepseek-v4.1-flash-1017 \
  --model-config models.json \
  --dry-run
```

Then run the collection:

```bash
roller collect --bench wildclawbench --bench-root ~/WildClawBench \
  $(sed 's/^/--bench-task-id /' task-ids.txt) \
  --bench-runs-per-task 3 \
  --model vllm/glm-5.3-flash \
  --model vllm/deepseek-v4.1-flash-1017 \
  --model-config models.json \
  --harness openclaw --openclaw-image wildclawbench-ubuntu:v1.3 \
  --openclaw-max-tokens 32768 --task-timeouts \
  --parallel 8 --grader-parallel 2 \
  --keep-thinking --wire-trace full \
  --output runs --run-name wildclawbench-open-models
```

| Flag | Effect in this run |
| --- | --- |
| `--bench-task-id` | Selects one task; repeated once per line of `task-ids.txt` |
| `--bench-runs-per-task 3` | Runs every task three times per model, as tasks `<id>__run_01` to `<id>__run_03` |
| `--model`, twice | Runs every task on both models in the same run |
| `--task-timeouts` | Gives each task its own WildClawBench timeout |
| `--parallel 8` | Runs eight rollouts at a time, shared by the two models |
| `--grader-parallel 2` | Runs two graders at a time; judge calls share the endpoint with the rollouts |
| `--keep-thinking` | Keeps the reasoning text of the model in the trajectory |
| `--wire-trace full` | Saves every request body Roller forwards to the model in `wire_trace.jsonl` |

After an interruption, add `--resume` to the same command: finished samples are
kept and the rest run again. The published trajectories come from a run that
was interrupted and resumed this way.

## 6. Read the results

Roller writes `bench-report.json` into the run directory when collection ends.
The published trajectories give this table:

| Model | Samples | Completed | Scored | Mean score | Mean steps |
| --- | ---: | ---: | ---: | ---: | ---: |
| `deepseek-v4.1-flash-1017` | 22 | 18 | 22 | 0.306 | 70.5 |
| `glm-5.3-flash` | 22 | 12 | 22 | 0.277 | 35.5 |

The mean score divides by every sample of a model. A sample that ends in an
error or at the task timeout is still graded, on the files it had written.

Two things the trajectories show:

- **A complete solution in 7 steps.** In `00000004_01_Productivity_Flow_task_6_calendar_scheduling__run_02`, GLM-5.3-Flash reads the three input files, writes a constraint solver, notices that its first write was cut off, rewrites the script, runs it, and validates the output files. The grader scores the result 1.0 after 206 seconds.
- **Similar scores at different lengths.** On the PDF digest task, both models score above 0.9 in all three runs. DeepSeek-V4.1-Flash takes 79 to 100 steps for it, and GLM-5.3-Flash takes 35 to 65.

Open the run in the Viewer to read a rollout step by step and to compare the
two models on one task:

```bash
roller view runs/wildclawbench-open-models
```

## 7. Publish the run as a dataset

`roller export --format hf` packages the run as a Hugging Face dataset folder:
a dataset card and, for each model, the native OpenClaw session of every
sample and a table with one row per sample. The two
models of this run become the parts `openclaw-glm-5.3-flash` and
`openclaw-deepseek-v4.1-flash-1017`. The Hub reads the sessions as agent
traces, so the dataset is tagged **Traces** and every rollout opens in the
trace viewer of the Hub.

The exported files are redacted: the export replaces the model endpoints, the
hosts that `NO_PROXY` names, the name of the machine, the host paths, and the
credential values of the run with placeholders, and prints what it replaced.
`--redact-rules` adds what the run does not record, here the directory of the
model weights. Run the export on the machine of the collection, where the
credential variables are set:

```bash
roller export runs/wildclawbench-open-models \
  --format hf --output dataset --redact-rules redact.json

hf upload Valen-Team/Roller-WildClawBench-Trajectories dataset . --repo-type dataset
```

The folder holds what is published: the card, the sessions, and the tables.
`--include-runs` also writes the run directories, with every file of the run.

The first export writes `dataset/README.md`. Edit it to describe the dataset; a
later export refreshes only its statistics table. Later runs, with other models
or Harnesses, are added to the same repository in the same way, each as its own
`<harness>-<model>` part. See
[Hugging Face export](/roller/traces/trajectory-outputs/#hugging-face-export)
for the table columns, the redaction, and the format of the rules file.

## 8. Use the dataset

On the dataset page, open **Data Studio** and click a row to read a rollout in
the trace viewer: prompts, reasoning, tool calls, and tool results.

Load the table and keep the rollouts that scored at least 0.8 as training
records:

```python
import json

from datasets import load_dataset

rows = load_dataset(
    "Valen-Team/Roller-WildClawBench-Trajectories", "trajectories", split="train"
)
solved = rows.filter(
    lambda row: row["messages"] is not None and (row["score"] or 0) >= 0.8
)
records = [
    {"messages": json.loads(row["messages"]), "tools": json.loads(row["tools"])}
    for row in solved
]
```

Compare the two models task by task:

```python
frame = rows.to_pandas()
print(frame.pivot_table(index="upstream_task_id", columns="run", values="score"))
```

## 9. Adapt the run

| To change | Edit |
| --- | --- |
| Models | The providers in `models.json` and the `--model` flags; any Chat Completions or Responses endpoint works |
| Tasks | `task-ids.txt`, or `--bench-category` to select whole categories |
| Benchmark | `--bench` and `--bench-root`; see [Benchmarks](/roller/benches/bench-format/#8-supported-benches) |
| Runs per task | `--bench-runs-per-task` |
| Judge | `OPENROUTER_BASE_URL`, `OPENROUTER_API_KEY`, and `JUDGE_MODEL` |
| Harness | `--harness`; the other six Harnesses take `--api-base` and `--api-key-env` instead of `--model-config` |
