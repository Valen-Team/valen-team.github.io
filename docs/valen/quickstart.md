---
title: Run Valen locally
sidebar_label: Local quickstart
description: Install Valen and run a first structured decision.
---

# Run Valen locally

Choose a local inference route:

| Route | Use it for |
| --- | --- |
| [SGLang container](/docs/valen/sglang/) | A local HTTP service for text and image decisions; no host Python setup |
| Transformers (below) | Direct Python inference, including video and `question` execution |

The SGLang image supports single-GPU `shared_state` execution. The steps below use the Hugging Face Transformers model interface.

## Prepare the environment

Use Python 3.10+ and a CUDA GPU. From a fresh checkout, use the repository's bootstrap script to install the project dependencies:

```bash
git clone https://github.com/Valen-Team/Valen.git
cd Valen
bash scripts/setup/bootstrap.sh
source .venv/bin/activate
```

For an existing environment or a different installation, follow the [upstream setup instructions](https://github.com/Valen-Team/Valen/blob/main/scripts/README.md#installation). Dependencies for the chosen checkpoint must be available in the active environment.

## Make a text decision

```python
import torch
from transformers import AutoModel

model = AutoModel.from_pretrained(
    "Valen-Team/Valen-0.8B",
    trust_remote_code=True,
    dtype="auto",
    attn_implementation="sdpa",
).to("cuda").eval()

torch.set_float32_matmul_precision("highest")
torch.backends.cudnn.allow_tf32 = False

answer = model.predict({
    "state": "A cat is sitting on the sofa.",
    "questions": {
        "animal": {
            "type": "choice",
            "instructions": "Which animal is present?",
            "criteria": {"cat": "A cat", "dog": "A dog"},
        },
        "on_sofa": {
            "type": "noul",
            "instructions": "The cat is on the sofa.",
        },
    },
}, execution="shared_state")

print(answer)
```

The model returns structured decisions for each question. Inspect the returned probabilities rather than expecting generated prose.

Use `Valen-Team/Valen-2B` or `Valen-Team/Valen-4B` to select another released size.

## Work with images and video

Replace the text state with a message object containing media. The [data format guide](/docs/valen/data-format/#images-and-video) defines the exact schema, media paths, and video conventions.

For complete executable examples with input previews and saved outputs, open the [local inference notebook](https://github.com/Valen-Team/Valen/blob/main/cookbook/local_inference.ipynb).

## Choose an execution mode

- `shared_state` puts all questions and candidates into a shared sequence.
- `question` uses separate questions or branches as defined by the architecture.

See [shared-state execution](/docs/valen/qwen-shared-state/) for the compute and data grouping details.

## Next steps

[Use the API](/docs/valen/api/) · [Configure training](/docs/valen/configuration/) · [Evaluate with JevalKit](/docs/jevalkit/quickstart/)

Source: [Valen README](https://github.com/Valen-Team/Valen#quick-start).

