---
title: "ZeroBench"
---

# ZeroBench

The ZeroBench bench adapter runs [ZeroBench](https://huggingface.co/datasets/jonathan-roberts1/zerobench) with images provided as files under `/task` so the agent can crop, enhance, and inspect them with tools. Answers are graded deterministically using the official strict `{final answer}` extraction rule with no judge model and no extra environment variables.

The runnable cookbook recipe is in [`examples/cookbook/zerobench-claude-code`](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/zerobench-claude-code).

## 1. Setup

Install Roller with the `zerobench` extra:

```bash
pip install 'roller-agent[zerobench]'
```

Roller loads the dataset through `datasets` at a pinned Hugging Face revision recorded in each task (`ZEROBENCH_REVISION` overrides it) and writes question images under `--bench-root`. On an offline host, pre-populate `HF_HOME` and export `HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1`.

## 2. Variants and execution

- **`--bench-variant zerobench`**: the 100 main questions.
- **`--bench-variant zerobench_subquestions`**: the 334 visual sub-questions.
- **Default Harness**: `claude-code` (works in Docker or in a remote sandbox via `--sandbox-provider` / `--sandbox-template`).

```bash
export ANTHROPIC_API_KEY='...'

mkdir -p ./zerobench-data

roller collect \
  --bench zerobench \
  --bench-variant zerobench \
  --bench-root ./zerobench-data \
  --harness claude-code \
  --model my-model \
  --api-base http://localhost:8000 \
  --samples 5 \
  --output runs \
  --run-name zerobench-main

roller bench report runs/zerobench-main
```

When collecting in a remote sandbox without egress, pair `--sandbox-provider` with a provider implementing `route_http` so Claude Code reaches Roller's host request recording proxy; `--wire-trace full`, `--capture-calls`, and `--token-ids` work identically to Docker. See [Claude Code Harness guide](/roller/harnesses/claude-code-configuration/) for `--claude-sandbox-binary`, `--claude-context-window`, and `--claude-tool-images-inline`.

## 3. Grading and metrics

The grader extracts the last `{...}` group from the agent's final message and applies ZeroBench's official strict matching rule. No external judge service is needed.

Over `k` samples per question (5 in the benchmark paper), `roller bench report` reports `avg@k` and `pass@k`.
