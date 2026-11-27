---
title: "Stirrup Harness guide"
---

# Stirrup Harness guide

The Stirrup Harness runs Stirrup 0.2.2 in the Roller process while a Docker container or remote sandbox executes the agent's commands and holds the task workspace. The container receives no model API key and needs no network egress for model calls.

For Task fields, see [Task format reference](/roller/tasks/task-format/). For shared outputs, see [Trajectory output file guide](/roller/traces/trajectory-outputs/).

## 1. Requirements and installation

Stirrup requires Python 3.12 or later and the `stirrup` extra:

```bash
pip install 'roller-agent[stirrup]'
```

The `stirrup` extra cannot be installed together with the `pdf` extra in the same Python environment because of Pillow version constraints.

## 2. Container image or remote sandbox

The default Docker image is `python:3.13-slim`. Any image that includes `bash`, GNU coreutils and the packages required by the task works; no Stirrup runtime needs to be installed inside the container.

To run commands in a remote sandbox instead of Docker, install a provider package registered under the `roller.sandbox_providers` entry point and pass `--sandbox-provider NAME --sandbox-template NAME`. The Stirrup agent loop stays in the Roller host process while the sandbox executes commands and stores task files.

## 3. Environment variables and API

Stirrup speaks OpenAI Chat Completions and forwards requests through Roller's local request recording proxy.

| Setting | Default source | CLI override |
| --- | --- | --- |
| API address | `OPENAI_BASE_URL` | `--stirrup-api-base`, or `--api-base` for a single-Harness run |
| API key | `OPENAI_API_KEY` | `--stirrup-api-key-env`, or `--api-key-env` for a single-Harness run |
| Model ID | Task `model` or `--model` | Sent to the endpoint unchanged |

```bash
export OPENAI_API_KEY='...'

roller collect \
  --harness stirrup \
  --tasks examples/tasks/tasks.jsonl \
  --model my-model \
  --api-base http://localhost:8000/v1 \
  --api-key-env OPENAI_API_KEY \
  --capture-calls \
  --output runs \
  --run-name stirrup-demo
```

## 4. Stirrup-specific flags {#stirrup-cli-flags}

| Flag | Default | Purpose |
| --- | --- | --- |
| `--docker-image` / `--stirrup-image` | `ROLLER_STIRRUP_IMAGE` or `python:3.13-slim` | Container image that executes `code_exec` commands |
| `--stirrup-max-steps` | `30` | Maximum agent turns per prompt |
| `--stirrup-context-length` | `128000` | Model context window; Stirrup summarizes history at 70% of this limit |
| `--stirrup-output-tokens` | `8192` | `max_tokens` sent per model request |
| `--stirrup-command-timeout` | `180` | Per-command timeout in seconds inside the container or sandbox |
| `--stirrup-temperature` | None | Sampling temperature |
| `--stirrup-top-p` | None | Nucleus sampling `top_p` |
| `--stirrup-seed` | None | Base seed; each sample derives its deterministic seed from this value, the task ID and the sample index |
| `--stirrup-request-set KEY=JSON` | None | Repeatable extra JSON fields merged into each Chat Completions request |
| `--thinking` | None | Sent as `chat_template_kwargs.reasoning_effort` |

## 5. Tools, outputs and scope

- **Built-in tools**: `code_exec`, `view_image`, and `finish`.
- **Single prompt per task**: Stirrup runs one prompt per task and does not serve as a User Simulator.
- **No proxy forwarding into the container**: Because model requests start in the Roller host process, Stirrup passes no proxy variables into the task container.
- **Compaction and token IDs**: `--wire-trace full`, `--capture-calls`, and `--token-ids` work in both Docker and remote sandboxes. When Stirrup summarizes conversation history, captured Calls split SFT into separate context windows under `sft_segments/`, including the summary request as its own window.
- **No output directory mode**: Tasks may set `files.output_dir: null` so Roller collects nothing from the workspace (used by [VIALS](/roller/benches/vials/)).
