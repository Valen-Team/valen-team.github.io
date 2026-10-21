---
title: SGLang local inference
sidebar_label: SGLang container
description: Serve Valen locally with the public SGLang image.
---

# Local inference with SGLang

Run Valen as a local HTTP service using the public image `ghcr.io/valen-team/sglang:valen-v0.1.0`. No Valen source checkout or host Python environment is needed for the server.

This image is maintained by Valen-Team and includes native Valen support. It is a separate distribution from the official SGLang images.

## Requirements

- Linux x86-64, an NVIDIA GPU with enough memory for your checkpoint, and a CUDA 13-compatible host driver.
- Docker with NVIDIA Container Toolkit configured so containers can access the GPU.
- Network access to GHCR for the image and Hugging Face for model files on first launch, or a downloaded model directory.

The image contains the inference runtime, not model weights. The cache mount below keeps downloaded weights across runs.

## Start the server

```bash
docker pull ghcr.io/valen-team/sglang:valen-v0.1.0
docker run --rm --gpus device=0 --ipc=host \
  -p 127.0.0.1:30000:30000 \
  -v "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  ghcr.io/valen-team/sglang:valen-v0.1.0 \
  --model-path Valen-Team/Valen-2B --served-model-name valen \
  --host 0.0.0.0 --port 30000
```

Wait for the server to finish loading the model before sending requests. The service is exposed on `localhost:30000`; `--host 0.0.0.0` listens inside the container. `--served-model-name valen` gives requests a stable model name.

Use `Valen-Team/Valen-0.8B` or `Valen-Team/Valen-4B` as `--model-path` to select another released size. Choose a GPU with sufficient memory; the native GPU comparison was performed with Valen-2B on H200.

## Send a text request

```bash
curl http://localhost:30000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "valen",
    "state": "A cat is sitting on the sofa.",
    "questions": {
      "animal": {
        "type": "choice",
        "instructions": "Which animal is present?",
        "criteria": {"cat": "A cat", "dog": "A dog"}
      },
      "on_sofa": {
        "type": "noul",
        "instructions": "The cat is on the sofa."
      },
      "clarity": {
        "type": "score",
        "instructions": "How clearly does the state identify the animal?",
        "criteria": ["Not identified", "Ambiguous", "Clearly identified"]
      }
    }
  }'
```

`/v1/systemone` accepts the local Valen `state` and `questions` mapping, plus the server's `model` name. All questions share the same state in one `shared_state` execution.

Read the response's `answers` mapping by question ID:

| Question type | Input | Answer fields |
| --- | --- | --- |
| `choice` | `criteria`: mapping of 1–255 option names to nonempty descriptions | `choice`, `probabilities`, `confidence` |
| `noul` | A statement in `instructions`; omit `criteria` | `noul`: probability that the statement is true |
| `score` | `criteria`: ordered list of 2–255 nonempty level descriptions | `score`: expected zero-based level, `probabilities`, `legend`, `confidence` |

Every question needs nonempty string `instructions`. Choice order and score level order follow the supplied criteria. Noul uses the checkpoint's fixed true/false candidates. Responses also include `usage.input_tokens`.

The hosted `/v1/decisions` API uses `input`, a question list, `choices` / `levels`, and `predicate`. Its payload is different from this local endpoint; do not copy the hosted request unchanged.

## Send an image request

The client can send a local image as a data URL, so the image file does not need to be mounted into the server container. Match the MIME type to the file format.

```bash
python -m pip install requests
```

```python
import base64
from pathlib import Path

import requests

# Replace cat.jpg with a local JPEG file.
image = base64.b64encode(Path("cat.jpg").read_bytes()).decode("ascii")
response = requests.post(
    "http://localhost:30000/v1/systemone",
    json={
        "model": "valen",
        "state": {"messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {
                    "url": f"data:image/jpeg;base64,{image}"
                }},
                {"type": "text", "text": "Inspect this image."},
            ],
        }]},
        "questions": {
            "animal": {
                "type": "choice",
                "instructions": "Which animal is visible?",
                "criteria": {"cat": "A cat", "dog": "A dog"},
            },
        },
    },
    timeout=120,
)
response.raise_for_status()
print(response.json()["answers"])
```

## Use downloaded weights

Mount the complete checkpoint directory, including configuration, tokenizer, processor, and weight files. Replace the host path below with your model directory; requests still use `"model": "valen"`.

```bash
docker run --rm --gpus device=0 --ipc=host \
  -p 127.0.0.1:30000:30000 \
  -v /absolute/path/to/Valen-2B:/models/Valen-2B:ro \
  ghcr.io/valen-team/sglang:valen-v0.1.0 \
  --model-path /models/Valen-2B --served-model-name valen \
  --host 0.0.0.0 --port 30000
```

## Supported scope

- Text and image inputs; `choice`, `noul`, and `score` decisions.
- `shared_state` execution on one GPU. Tensor and pipeline parallelism must both be 1.
- BF16 backbone with FP32 decision-head weights and pooling.
- Direct `video_url` input is not supported in this release. Use Transformers for video inference, or extract frames on the client and send them as images.

The native implementation was compared with the checkpoint's Transformers implementation on H200 using Valen-2B, including image inputs and concurrent requests. The release image passed build/import checks; an end-to-end GPU run of this packaged image has not yet been completed.

For release source and validation details, see the [image documentation](https://github.com/Valen-Team/sglang/tree/main/docker/valen).
