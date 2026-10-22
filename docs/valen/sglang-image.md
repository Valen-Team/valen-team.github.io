---
title: SGLang image deployment
sidebar_label: SGLang image
---

# Deploy with the SGLang image

Start a local HTTP service with the prebuilt Valen-Team image.

## Requirements

Linux x86-64, an NVIDIA GPU, a CUDA 13-compatible driver, and Docker configured with NVIDIA Container Toolkit.

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

Weights download on first launch and are retained in the mounted cache. Change `--model-path` to select another model.

## Send a request

Wait for model loading to finish, then run in another terminal:

```bash
curl http://localhost:30000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen","state":"A cat is on the sofa.","questions":{"on_sofa":{"type":"noul","instructions":"The cat is on the sofa."}}}'
```

`answers.on_sofa.noul` is the probability that the statement is true.

## Send an image request

Encode the image as a data URL. Install `requests` in the client environment:

```bash
python -m pip install requests
```

<details>
<summary>Python image request example</summary>

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

</details>
