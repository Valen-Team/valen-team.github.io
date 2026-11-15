---
title: "Getting started: from install to the first trajectory"
---

# Getting started: from install to the first trajectory

This guide uses OpenClaw as the example and describes the complete procedure for one Task, from installation to a saved trajectory. Other Harnesses follow the same main workflow: prepare the configuration, run a dry-run, collect trajectories, check the results, and open the Viewer. Images, API configuration, and Harness-specific options differ; refer to the corresponding Harness guide when adapting this workflow.

The guide covers, in order, a dry-run check of the configuration, a real collection, locating the output files, and opening the result in the Viewer. If the terms Task, Harness, rollout, run, or trace are unfamiliar, read the [Introduction](/roller/start/introduction/) first.

## 1. Prepare the runtime environment

Requirements:

- Python 3.10+.
- Docker (install separately).
- the OpenClaw image.
- a model API that supports OpenAI Responses or Chat Completions.

Use an isolated Python environment. This example uses [uv](https://docs.astral.sh/uv/) and Python 3.11:

```bash
uv venv --python 3.11
source .venv/bin/activate

uv pip install roller-agent
roller --version
docker version
```

With pip, create and activate a virtual environment, then run `python -m pip install roller-agent`.

Write the example tasks and configuration templates into the working directory. The rest of this guide runs from this directory:

```bash
roller init
```

`roller init` creates `examples/tasks`, `examples/config`, `examples/benchmarks` and `examples/env`, and leaves files that already exist untouched.

Install Roller from source if you want the latest changes or plan to contribute. A clone already contains `examples/`, so `roller init` is not needed there:

```bash
git clone https://github.com/Valen-Team/Roller.git
cd Roller
uv venv && source .venv/bin/activate
uv pip install -e ".[test]"
```

After Docker is installed and started, `docker version` shows both Client and Server information.

On macOS, open **Docker Desktop → Settings → Resources → Network**, enable **Enable host networking**, and restart Docker Desktop. Roller uses host networking so that OpenClaw can reach its local request proxy.

## 2. Prepare the OpenClaw image

OpenClaw supports both OpenAI Responses and Chat Completions.

Pull the pinned image online:

```bash
docker pull ghcr.io/openclaw/openclaw:2026.7.1-2
```

Alternatively, load an existing archive:

```bash
docker load -i /path/to/openclaw-2026.7.1-2-linux-amd64.tar.gz
```

To use a custom image tag, pass it with `--docker-image` or set `ROLLER_OPENCLAW_IMAGE`.

Keep the default reasoning settings for the first run. Roller saves the visible reasoning text returned by the model service. If the service reports only reasoning token counts, no reasoning text is saved.

## 3. Prepare the OpenClaw API configuration

Copy the local environment template:

```bash
cp examples/env/api.env.example examples/env/api.env
```

In `examples/env/api.env`, set `MY_PROXY_BASE_URL` and `MY_PROXY_API_KEY` to the actual model service URL and API key. This guide does not use the other Harnesses or Web Search; leave the remaining variables empty.

Save the file, then load the variables into the current shell:

```bash
set -a
source examples/env/api.env
set +a
```


Open the repository template at [`examples/config/openclaw/models.json`](https://github.com/Valen-Team/Roller/blob/main/examples/config/openclaw/models.json) and set the model `id` to the name of the model in use. In subsequent commands, the model ID after the provider name must exactly match this `id`. For example, if `id` is set to `qwen3.8-flash`, use `--model my-openai-proxy/qwen3.8-flash` in subsequent commands.

## 4. Example Tasks

[`examples/tasks/tasks.jsonl`](https://github.com/Valen-Team/Roller/blob/main/examples/tasks/tasks.jsonl) contains four tasks, ordered from simple to complex:

| ID | Demonstrates |
| --- | --- |
| `01_text_only` | Single-turn plain text |
| `02_local_markdown` | Read an input file and write to `outputs/` |
| `03_user_memory_context` | Inject `USER.md` and `MEMORY.md` |
| `04_multi_turn` | Two predefined user messages share one session |

## 5. Dry-run

Using OpenClaw as the example:

```bash
roller collect \
  --tasks examples/tasks/tasks.jsonl \
  --model my-openai-proxy/my-model \
  --model-config examples/config/openclaw/models.json \
  --parallel 4 \
  --dry-run
```

Before real collection, a dry-run checks that Roller can read the tasks and options, then previews the rollouts it would run. A dry-run does not start containers, call the model API, or write any file; it reads each input once to validate it and lists the bundle digests a real run would record. Proceed to real collection after the dry-run completes without errors.

## 6. Real collection

```bash
roller collect \
  --tasks examples/tasks/tasks.jsonl \
  --model my-openai-proxy/my-model \
  --model-config examples/config/openclaw/models.json \
  --parallel 4 \
  --retries 1 \
  --timeout 600 \
  --output runs \
  --run-name quickstart
```

Flag descriptions:

| Flag | Meaning |
| --- | --- |
| `--parallel 4` | Run at most 4 rollouts at once |
| `--retries 1` | After the first failure, retry at most 1 additional time |
| `--timeout 600` | Total timeout per rollout is 600 seconds |
| `--output runs` | Host root directory for all runs |
| `--run-name quickstart` | This run is saved as `runs/quickstart` |

If a directory with the same name already exists, Roller refuses to overwrite it by default. To continue the original run, add `--resume`. To start a new experiment, use a new `--run-name`.

## 7. Check the results

After collection succeeds, inspect the run root:

```text
runs/quickstart/
├── info.json
├── lock.json
├── sft.jsonl
└── samples/
    └── <model>/
        └── <index>_<task-id>/
```

Most successful samples contain at least the following files:

```text
trace.jsonl
trace_ACTF.json
info.json
```

Linear samples also contain `trace_SFT.json`. If main-agent context was compacted,
`info.json` lists `trajectory.sft_segments`, and the SFT records are stored as
`sft_segments/0001.json`, `0002.json`, and so on. A successful sample can also
record SFT as unavailable when its context cannot be represented safely.

Check the following items in order:

1. Whether `state` in the top-level `info.json` for the run is `finished`, `summary.failed` is `0`, and `summary.completed` matches the expected number of executions.
2. Whether `status` in every sample `info.json` is `ok` and `usage.request_count` is greater than `0`.
3. Whether `trace_ACTF.json` contains the complete user input and model output. If tools were called, verify that each call is paired with its result.
4. Whether each available SFT record has `messages` and `tools`; image records
   also have `images`, and compaction segments have `target_start_index`.
5. For tasks that must deliver files, whether the sample `results/` contains the expected files.
6. Whether run `sft.jsonl` has one line per eligible linear SFT sample.
   Compacted samples stay in `sft_segments/` and require a training reader that
   honors `target_start_index`; they never enter the legacy run dataset.

[Trajectory outputs](/roller/traces/trajectory-outputs/) describes when each file is written and what is retained on failure.

## 8. Open the Viewer

```bash
roller view runs/quickstart
```

The Viewer listens on `127.0.0.1:17865` by default and switches to a free port if that port is in use. After the command starts, open the printed URL in a browser.

The Viewer shows the ACTF timeline. The Inspector shows the system prompt, tools schema, run info, and raw content. For details, see the [Viewer guide](/roller/traces/viewer/).

## 9. Next steps

- Write custom task data: [Task format](/roller/tasks/task-format/)
- Configure reasoning: [OpenClaw Harness guide](/roller/harnesses/openclaw-configuration/#6-thinking-configuration)
- Understand the training format: [SFT data format](/roller/traces/sft-format/)
- List all CLI options: [CLI reference](/roller/start/cli-reference/)

## 10. Common issues

**(1) Docker preflight failed**

Check whether `docker version` can reach the Server and whether the image has been pulled or loaded.

**(2) OpenClaw cannot find the model**

Check whether `--model` matches `provider/models[].id` in the JSON exactly.

**(3) Configuration reports a missing environment variable**

Check whether `source examples/env/api.env` has been run and whether the placeholder names match.

**(4) `/responses` returns 404**

The service may support only Chat Completions. Set the OpenClaw provider `api` to `openai-completions`.

**(5) A run with the same name already exists**

Use `--resume` for the original experiment. Change `--run-name` for a new one.

**(6) The Viewer does not show new tasks**

Confirm that the run root directory was passed, refresh the page, and check the run `info.json`.

The OpenClaw Harness guide lists additional OpenClaw-specific errors.
