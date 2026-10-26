---
mdx:
  format: mdx
title: Transformers local inference
sidebar_label: Transformers inference
description: Install the dependencies and run Valen with either inference protocol.
---

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

## Minimal inference check

After loading the model, verify the path with one predicate question:

```python
result = model.predict({
    "input": "A cat is on the sofa.",
    "questions": [{"name": "cat", "type": "predicate", "instructions": "A cat is present."}],
}, execution="shared_state", temperature=1.0)
print(result["answers"][0]["probability"])
```

## Inputs and parameters

- `shared_state`: questions and candidates share one sequence.
- `question`: execute separate questions or branches.
- `temperature` defaults to `1.0`; a finite positive value scales candidate logits. A request-body value takes precedence over the keyword argument.
- Native Python inference reads local image/video paths; relative paths resolve against `media_root`, the working directory by default.
- The single-GPU HTTP plugins do not inherit every media capability of the native Python model; consult the backend capability table.

[Complete text, image, direct-video and dual-protocol tutorial](/cookbook/local-inference/) · [API](/docs/valen/api/) · [ONNX / SDK](/docs/valen/onnx/) · [SGLang](/docs/valen/sglang/) · [vLLM](/docs/valen/vllm/) · [Validation scope](/cookbook/validation/)
