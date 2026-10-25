---
mdx:
  format: mdx
title: Transformers local inference
sidebar_label: Transformers inference
description: Install the dependencies and run Valen with either inference protocol.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Local inference with Transformers

Load Valen in Python and use SystemOne or Decisions for predicate, choice, and score questions over text, images, and video.

This page uses PyTorch and native Hugging Face weights; no Valen SDK installation is needed. For CPU, ONNX Runtime or browser inference, use [ONNX & SDKs](./onnx.md).

## Install dependencies

Use Python 3.10+ and a CUDA GPU supporting BF16:

```bash
python -m pip install torch torchvision transformers pillow av
```

## Load a model

```python
import torch
from transformers import AutoModel

model = (
    AutoModel.from_pretrained(
        "Valen-Team/Valen-0.8B",
        trust_remote_code=True,
        dtype="auto",
        attn_implementation="sdpa",
    )
    .to("cuda")
    .eval()
)
torch.set_float32_matmul_precision("highest")
torch.backends.cudnn.allow_tf32 = False
```

Replace the model ID with `Valen-Team/Valen-2B` or `Valen-Team/Valen-4B` to select another size. `dtype="auto"` preserves each model’s storage precision; the Mixer decision head uses FP32.

The first load downloads and caches native model weights. Once cached, add `local_files_only=True` to `AutoModel.from_pretrained(...)` to prevent downloads, or replace the model ID with a local model directory. Use native `Valen-*B` repositories here; load ONNX graphs through the [SDKs](./onnx.md).

## Text inference and results

Run the model-loading code above first, then choose one protocol tab below. Both tabs express the same task; use either one. The image and video examples reuse the same loaded `model`.

<Tabs groupId="hf-inference-protocol">
<TabItem value="systemone" label="SystemOne" default>

```python
answer = model.predict(
    {
        "state": "A cat is sitting on the sofa.",
        "questions": {
            "animal": {
                "type": "choice",
                "instructions": "Which animal is present?",
                "criteria": {"cat": "A cat", "dog": "A dog"},
            },
            "on_sofa": {"type": "noul", "instructions": "The cat is on the sofa."},
            "clarity": {
                "type": "score",
                "instructions": "How clear is the evidence?",
                "criteria": ["Unclear", "Partly clear", "Clear"],
            },
        },
    },
    execution="shared_state",
    temperature=1.0,
)
print(answer["answers"]["animal"]["choice"])
print(answer["answers"]["animal"]["probabilities"])
print(answer["answers"]["on_sofa"]["noul"])
print(answer["answers"]["clarity"]["score"])
```

</TabItem>
<TabItem value="decisions" label="Decisions">

```python
answer = model.predict(
    {
        "input": "A cat is sitting on the sofa.",
        "questions": [
            {
                "name": "animal",
                "type": "choice",
                "instructions": "Which animal is present?",
                "choices": [
                    {"value": "cat", "description": "A cat"},
                    {"value": "dog", "description": "A dog"},
                ],
            },
            {
                "name": "on_sofa",
                "type": "predicate",
                "instructions": "The cat is on the sofa.",
            },
            {
                "name": "clarity",
                "type": "score",
                "instructions": "How clear is the evidence?",
                "levels": [
                    {"label": "0", "description": "Unclear"},
                    {"label": "1", "description": "Partly clear"},
                    {"label": "2", "description": "Clear"},
                ],
            },
        ],
    },
    execution="shared_state",
    temperature=1.0,
)
print(answer["answers"][0]["choice"])
print(answer["answers"][0]["probabilities"])
print(answer["answers"][1]["probability"])
print(answer["answers"][2]["score"])
```

</TabItem>
</Tabs>

SystemOne returns `answers` keyed by question ID. Decisions returns answers in request order and retains each question name. `score` is the probability-weighted mean of zero-based level indices; the three levels above span 0–2.

## Image inference

Replace `cat.jpg` with a local PNG, JPEG, or WebP image. Relative paths resolve against `media_root`; absolute paths also work.

<Tabs groupId="hf-inference-protocol">
<TabItem value="systemone" label="SystemOne" default>

```python
answer = model.predict(
    {
        "state": {
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "image_url", "image_url": {"url": "cat.jpg"}}],
                }
            ]
        },
        "questions": {
            "animal": {
                "type": "choice",
                "instructions": "Which animal is present?",
                "criteria": {"cat": "A cat", "dog": "A dog"},
            }
        },
    },
    execution="shared_state",
    temperature=1.0,
    media_root=".",
)
print(answer["answers"])
```

</TabItem>
<TabItem value="decisions" label="Decisions">

```python
answer = model.predict(
    {
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_image", "image_url": "cat.jpg"}],
            }
        ],
        "questions": [
            {
                "name": "animal",
                "type": "choice",
                "instructions": "Which animal is present?",
                "choices": [
                    {"value": "cat", "description": "A cat"},
                    {"value": "dog", "description": "A dog"},
                ],
            }
        ],
    },
    execution="shared_state",
    temperature=1.0,
    media_root=".",
)
print(answer["answers"])
```

</TabItem>
</Tabs>

## Video inference

Replace `clip.mp4` with a local video. The model configuration samples 16 frames by default.

<Tabs groupId="hf-inference-protocol">
<TabItem value="systemone" label="SystemOne" default>

```python
answer = model.predict(
    {
        "state": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "video_url", "video_url": {"url": "clip.mp4"}}
                    ],
                }
            ]
        },
        "questions": {
            "walking": {"type": "noul", "instructions": "A person is walking."}
        },
    },
    execution="shared_state",
    temperature=1.0,
    media_root=".",
)
print(answer["answers"])
```

</TabItem>
<TabItem value="decisions" label="Decisions">

```python
answer = model.predict(
    {
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_video", "video_url": "clip.mp4"}],
            }
        ],
        "questions": [
            {
                "name": "walking",
                "type": "predicate",
                "instructions": "A person is walking.",
            }
        ],
    },
    execution="shared_state",
    temperature=1.0,
    media_root=".",
)
print(answer["answers"])
```

</TabItem>
</Tabs>

## Execution and temperature

- `shared_state`: questions and candidates share one sequence.
- `question`: execute separate questions or branches.
- `temperature`: defaults to `1.0`; a finite positive value scales candidate logits before computing probabilities.

For either protocol, use `model.predict(request, execution="question", temperature=0.5)` to adjust these settings. A request-body `temperature` takes precedence over the keyword argument.

For real input previews and complete examples, see the [local inference notebook](https://github.com/Valen-Team/Valen/blob/main/cookbook/local_inference.ipynb).

Local HTTP services: [SGLang](/docs/valen/sglang/) · [vLLM](/docs/valen/vllm/)
