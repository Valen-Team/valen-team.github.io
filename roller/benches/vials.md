---
title: "VIALS"
---

# VIALS

The VIALS bench adapter runs the 161 scientific image questions of the `tasks` test split of [VIALS](https://huggingface.co/datasets/handshake-ai-research/VIALS) with tool-assisted code execution, grades each sample in the collecting process with an LLM judge, and reports `pass^k`, `avg@k`, and `pass@k`.

The runnable cookbook recipe is in [`examples/cookbook/vials-stirrup`](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/vials-stirrup).

## 1. Setup

Install Roller with the `vials` extra (and `stirrup` when running with the default Stirrup Harness, Python 3.12+):

```bash
pip install 'roller-agent[stirrup,vials]'
```

Build the tools container image from `docker/vials` in the Roller repository (Python 3.13, the eleven scientific Python libraries referenced by the prompt, and Tesseract OCR). If you installed `roller-agent` from PyPI without a local checkout, clone the repository first to get `docker/vials`:

```bash
git clone https://github.com/Valen-Team/Roller.git
cd Roller
docker build -t roller-vials docker/vials
```

Roller downloads the dataset at a pinned Hugging Face revision into `--bench-root` and records the revision in each task. Set `VIALS_REVISION` to select another revision.

## 2. Protocol and execution

- **Default Harness**: `stirrup`.
- **Workspace**: Each question's images are placed under `/task`. The agent writes its final answer to `/task/answer.txt` with an `ANSWER:` line.
- **Offline execution**: Task containers run with `--network none`. Because Stirrup runs the agent loop and model calls in the Roller host process, model requests and judge calls stay on the collector while code execution runs offline inside the container.
- **Collector-side grading**: VIALS uses `bench.grade.collector_files` to copy `/task/answer.txt` back to the host and call the judge from the Roller process, keeping the judge API key out of the container.

```bash
export OPENAI_API_KEY='...'
export JUDGE_BASE_URL='https://api.openai.com/v1'
export JUDGE_API_KEY='...'

mkdir -p ./vials-data

roller collect \
  --bench vials \
  --bench-root ./vials-data \
  --harness stirrup \
  --stirrup-image roller-vials \
  --network none \
  --model my-model \
  --api-base http://localhost:8000/v1 \
  --samples 3 \
  --output runs \
  --run-name vials-run

roller bench report runs/vials-run
```

## 3. Grading and metrics

The judge compares the extracted answer against the reference answer (and the acceptable numeric range on counting questions). If the judge starts its reasoning with `UNVERIFIABLE:`, Roller asks the judge again with the question images attached. A missing `answer.txt` or a file without an `ANSWER:` line scores `0` without calling the judge.

Judge defaults can be overridden with `JUDGE_MODEL`, `JUDGE_REASONING_EFFORT`, and `JUDGE_MAX_TOKENS` (or `VIALS_`-prefixed equivalents). Samples whose judge call fails stay unscored and are retried by `roller collect --resume`.

Over `k` samples per question (3 by default in the cookbook), `roller bench report` prints:

- `pass^k`: share of questions answered correctly in all `k` samples
- `avg@k`: share of correct samples
- `pass@k`: share of questions answered correctly in at least one sample
