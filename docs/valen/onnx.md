---
title: ONNX inference and SDKs
sidebar_label: ONNX & SDKs
description: Run Valen with Python, Node.js, browser WebGPU or a native C++ text integration.
---

# ONNX inference and SDKs

Python SDK 0.5.1 is published on [PyPI](https://pypi.org/project/valen-sdk/0.5.1/). JavaScript SDK 0.4.0 is published on [npm as @valen-team/sdk](https://www.npmjs.com/package/@valen-team/sdk/v/0.4.0): `npm install @valen-team/sdk@0.4.0`. For a first trial and format selection, see [version selection](https://valen-team.github.io/docs/valen/choosing/).

The examples on this page run the Valen-Decision-1.5 ONNX bundles: [0.8B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-ONNX) · [2B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-ONNX) · [4B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-ONNX) · [9B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-ONNX) · [27B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-ONNX). `Valen.local(...)` in Python SDK 0.5.1 and JavaScript SDK 0.4.0 builds the block attention mask these models use, so local results match the native model. The same SDK versions run the Valen-Decision-1.0 ONNX bundles.

Run Valen decisions in your application with ONNX Runtime. The SDKs use the published Valen ONNX components, including the trained vision tower, the decision head and the Valen-Decision-1.5 grounding head. Local SDK inference does not require PyTorch or Transformers.

Use [Transformers](./quickstart.md) for the native Python model, or choose an SDK below for local ONNX inference. Both routes support SystemOne and Decisions; C++ currently provides a SystemOne text integration example.

For a first local run, start with the Python CPU example below: use 0.8B, `fp32` and the Decisions protocol. ONNX is the model runtime format; the SDK loads it, processes inputs and returns results. Published models are ready to use without exporting them yourself. Transformers and ONNX are independent inference routes; choose one for your environment.

| Integration | Local inference | Repository |
| --- | --- | --- |
| Python | Text, images and video on CPU or NVIDIA CUDA; local HTTP server and sync/async HTTP clients | [Python SDK](https://github.com/Valen-Team/valen-sdk-python) |
| JavaScript / TypeScript | Text, images and video in Node.js on CPU or a WebGPU browser; HTTP client | [JavaScript SDK](https://github.com/Valen-Team/valen-sdk-js) |
| C++ | SystemOne text, FP32 CPU, one request per process | [C++ text integration](https://github.com/Valen-Team/valen-sdk-cpp) |

## Python CPU quickstart

Use Python 3.11+ and Git.

First use downloads and caches the selected model components. The Python SDK downloads the full selected variant, including vision weights; 0.8B FP32 is about 3.518 GB. Node text requests download only their required components. Choose a local directory or an existing cache when working offline.

From a fresh terminal:

```bash
git clone --branch v0.5.1 --depth 1 https://github.com/Valen-Team/valen-sdk-python.git
cd valen-sdk-python
python -m pip install ".[onnx]"
python examples/local_decisions.py
```

A minimal path check with Valen-Decision-1.5 (the scripts in `examples/` use the same 0.8B bundle):

```python
from valen_sdk import Valen

with Valen.local("Valen-Team/Valen-Decision-1.5-0.8B-ONNX", variant="fp32") as client:
    result = client.decisions(input="A cat is on the sofa.", questions=[
        {"name": "cat", "type": "predicate", "instructions": "A cat is present."},
    ])
    print(result.by_name("cat").probability)
```

Complete ticket routing, image screening, video tagging and measured outputs are maintained in the [official Cookbook](https://valen-team.github.io/cookbook/). This page owns installation, backend options and minimal calls. `Valen.local` loads ONNX; use `Valen.remote` for a GGUF service.

## Models and variants

| Model | `fp32` · CPU | `q8-mlp` · CPU | `cuda-fp16` · Python CUDA | `web-portable` · browser |
| --- | --- | --- | --- | --- |
| [Valen-Decision-1.5 0.8B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-ONNX) | 3.518 GB | 2.758 GB | 2.013 GB | 2.456 GB |
| [Valen-Decision-1.5 2B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-ONNX) | 8.969 GB | 6.364 GB | 5.205 GB | — |
| [Valen-Decision-1.5 4B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-ONNX) | 18.278 GB | 11.766 GB | 9.866 GB | — |
| [Valen-Decision-1.5 9B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-ONNX) | 33.706 GB | 19.814 GB | 17.832 GB | — |
| [Valen-Decision-1.5 27B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-ONNX) | 104.487 GB | 55.288 GB | 53.237 GB | — |

These are decimal GB download sizes, including vision components. They are not runtime memory requirements.

Each bundle has a `valen_onnx.json` manifest and the graphs `embedding`, `vision`, `decision` and `grounding`: the layout of the Valen-Decision-1.0 bundles plus the grounding graph that answers [bbox questions](#bbox-questions). Start with `fp32` on CPU. `q8-mlp` quantizes the backbone MLP weights to 8 bits; the decision head, the grounding head and the vision graph stay FP32. `cuda-fp16` runs the backbone and embedding in FP16 on NVIDIA GPUs through the Python SDK, with the vision graph, decision head and grounding head in FP32. `web-portable` is the 0.8B graph for browser WebGPU with the JavaScript SDK, built from the same Valen weights. All four variants answer bbox questions.

Each bundle ships a `validation.json`. Compared with the native PyTorch model on CPU, for 0.8B over the 13 Cookbook recipes (216 compared values):

| Variant | Decision agreement | Mean absolute probability difference | Maximum |
| --- | --- | --- | --- |
| `fp32` | Identical | 4.5e-5 | 0.0032 |
| `q8-mlp` | 98.4% | 0.0020 | 0.028 |

On single requests, `fp32` agrees with the native model to about 1e-5 for 0.8B, 2B, 4B and 9B.

`cuda-fp16` and `web-portable` were compared with the native FP32 model on a text request (predicate, choice and score), an image request and a bbox request, 44 compared values per model, with identical decisions throughout:

| Variant | Device | Maximum probability difference | Maximum bbox coordinate difference |
| --- | --- | --- | --- |
| `cuda-fp16` 0.8B | NVIDIA H200 | 0.00032 | 0.0002 |
| `cuda-fp16` 2B | NVIDIA H200 | 0.0010 | 0.0002 |
| `cuda-fp16` 4B | NVIDIA H200 | 0.00023 | 0.0002 |
| `cuda-fp16` 9B | NVIDIA H200 | 0.00098 | 0.0002 |
| `cuda-fp16` 27B | NVIDIA H200 | 0.00016 | 0.0001 |
| `web-portable` 0.8B | CPU (ONNX Runtime) | 0.0010 | 0.0002 |

### Valen-Decision-1.0 variants

The Valen-Decision-1.0 ONNX repos provide `fp32`, `q8-mlp`, `cuda-fp16` and, for 0.8B, `web-portable`. Python SDK 0.4.0 and earlier and JavaScript SDK 0.3.0 and earlier run these repos.

| Model | `fp32` · CPU | `q8-mlp` · CPU | `cuda-fp16` · Python CUDA | `web-portable` · browser |
| --- | --- | --- | --- | --- |
| [Valen-Decision-1.0 0.8B](https://huggingface.co/Valen-Team/Valen-0.8B-ONNX) | 3.505 GB | 2.746 GB | 2.000 GB | 2.443 GB |
| [Valen-Decision-1.0 2B](https://huggingface.co/Valen-Team/Valen-2B-ONNX) | 8.948 GB | 6.343 GB | 5.184 GB | — |
| [Valen-Decision-1.0 4B](https://huggingface.co/Valen-Team/Valen-4B-ONNX) | 18.253 GB | 11.741 GB | 9.841 GB | — |

These are decimal GB download sizes from the published manifests, including vision components. The model cards include measured memory, latency and quality comparisons. In the Valen-Decision-1.0 CPU measurements, `q8-mlp` reduced MLP weight size and text memory and was slower than FP32. CPU/CUDA graphs contain ONNX Runtime contrib operators and cannot be substituted for the browser graph.

### CUDA

Every Valen-Decision-1.5 bundle includes the `cuda-fp16` variant. In a separate Python environment, install the GPU dependencies from the Python SDK repository root:

```bash
python -m pip install ".[cuda]"
```

```python
from valen_sdk import Valen

with Valen.local(
    "Valen-Team/Valen-Decision-1.5-0.8B-ONNX", variant="cuda-fp16",
    providers=[("CUDAExecutionProvider", {"use_tf32": "0"}), "CPUExecutionProvider"],
) as client:
    result = client.decisions(
        input="Please send my order to my new address.",
        questions=[{"name": "change_address", "type": "predicate",
                    "instructions": "Is the customer requesting a delivery address change?"}],
    )
    print(result.by_name("change_address").probability)
```

### Cache and offline use

After the selected variant has been cached, prevent network downloads:

```python
from valen_sdk import Valen

with Valen.local(
    "Valen-Team/Valen-Decision-1.5-0.8B-ONNX", variant="fp32", local_files_only=True,
) as client:
    result = client.decisions(
        input="Please send my order to my new address.",
        questions=[{"name": "change_address", "type": "predicate",
                    "instructions": "Is the customer requesting a delivery address change?"}],
    )
    print(result.by_name("change_address").probability)
```

A local model directory also works: `Valen.local("./models/Valen-Decision-1.5-0.8B-ONNX", variant="fp32", local_files_only=True)`. Keep the manifest, graphs and external weight files in their original directory structure. Node uses `cacheDir` and `localFilesOnly` for the corresponding options.

## Images and video

From the Python SDK repository root, use your own local media files:

```bash
python examples/media.py /path/to/photo.jpg
python -m pip install ".[onnx,video]"
python examples/media.py /path/to/clip.mp4 --video
```

The examples use Decisions messages with `input_image` / `input_video` and sample four video frames. See the [complete media example](https://github.com/Valen-Team/valen-sdk-python/blob/main/examples/media.py). The JavaScript SDK provides the same image/video example; Node video needs externally installed FFmpeg and ffprobe. Browser video uses WebCodecs and depends on the browser's codec support.

## Bbox questions

A `bbox` question returns a box, its centre point and a confidence for something in an image. The Python and JavaScript SDKs answer it locally with the grounding graph, which every Valen-Decision-1.5 bundle includes, in the same request as predicate, choice and score questions. Download the example image:

```bash
curl -fL https://valen-team.github.io/cookbook/code/media/mug-counter.jpg -o mug-counter.jpg
```

```python
from valen_sdk import Valen

with Valen.local("Valen-Team/Valen-Decision-1.5-0.8B-ONNX", variant="fp32") as client:
    result = client.decisions(
        input=[{"role": "user", "content": [{"type": "input_image", "image_url": "mug-counter.jpg"}]}],
        questions=[
            {"name": "mug", "type": "bbox", "instructions": "The blue mug.", "image": 0},
            {"name": "sponge", "type": "bbox", "instructions": "The sponge."},
            {"name": "box", "type": "bbox", "instructions": "The white box."},
            {"name": "rack", "type": "bbox", "instructions": "The dish rack."},
            {"name": "full", "type": "predicate", "instructions": "The mug has coffee in it."},
        ],
    )
    for name in ("mug", "sponge", "box", "rack"):
        answer = result.by_name(name)
        print(name, answer.bbox, answer.point, answer.confidence)
    print("full", result.by_name("full").probability)
```

Measured with Valen-Decision-1.5-0.8B `fp32` (749 input tokens):

| Question | `bbox` | `point` | `confidence` / `probability` |
| --- | --- | --- | --- |
| `mug` | `[0.2533, 0.3112, 0.8276, 0.8263]` | `[0.5404, 0.5687]` | 0.9467 |
| `sponge` | `[0.0, 0.5077, 0.1936, 0.7243]` | `[0.0968, 0.616]` | 0.9226 |
| `box` | `[0.6213, 0.0, 0.9816, 0.3704]` | `[0.8014, 0.1852]` | 0.8786 |
| `rack` | `[0.0, 0.075, 0.3272, 0.4854]` | `[0.1636, 0.2802]` | 0.8566 |
| `full` | | | 0.98471 |

`bbox` is `[x1, y1, x2, y2]` and `point` is `[x, y]`, normalized to 0–1 against the image width and height. Typed SystemOne requests use `Bbox(instructions=..., image=0)` from `valen_sdk`, and `result.bboxes` collects the answers. JavaScript provides `bbox(instructions, image = 0)` next to `predicate`, `choice` and `score`, with the types `BboxQuestion` and `BboxAnswer`:

```js
import { Valen, bbox, predicate } from '@valen-team/sdk';

const client = await Valen.local('Valen-Team/Valen-Decision-1.5-0.8B-ONNX', { variant: 'fp32' });
try {
  const result = await client.systemOne(
    { messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'mug-counter.jpg' } }] }] },
    { mug: bbox('The blue mug.'), full: predicate('The mug has coffee in it.') },
  );
  console.log(result.answers.mug.bbox, result.answers.mug.point, result.answers.mug.confidence);
} finally {
  await client.close();
}
```

Question fields, answer fields and the native Transformers route are in [bbox questions](./bbox.md).

## Compare with an LLM

`Valen.llm` answers the same request with an OpenAI-compatible, Anthropic or Gemini model and returns the same typed response, so one routing rule and one test set run against both. Use it to measure decisions, tokens and latency on your own data before choosing:

```python
from valen_sdk import Choice, Valen

questions = {"queue": Choice(instructions="Which team should handle this ticket?", criteria={
    "billing": "Payments, charges and refunds", "technical": "Bugs and crashes in the app"})}
for client in (Valen.remote("https://api.valen-team.workers.dev/v1", model="valen-2b"),
               Valen.llm("openai", "gpt-4o-mini")):  # reads OPENAI_API_KEY
    result = client.system_one("I was charged twice.", questions)
    print(result.model, result.choices["queue"].choice, result.usage.input_tokens)
```

`Valen.llm` is in the base package; video inputs need `valen-sdk[video]` and are sent as frames. `usage` adds retries and latency, and `debug["llm_attempts"]` keeps every provider request for replay. Options for structured output, discrete answers and retries are in the [Python README](https://github.com/Valen-Team/valen-sdk-python#compare-with-an-llm); a runnable comparison is [`examples/llm_compare.py`](https://github.com/Valen-Team/valen-sdk-python/blob/main/examples/llm_compare.py).

## Node.js and TypeScript

Use Node.js 22.12+ or 24 and Git:

```bash
git clone --branch npm-v0.4.0 --depth 1 https://github.com/Valen-Team/valen-sdk-js.git
cd valen-sdk-js
npm ci --ignore-scripts
node examples/local.mjs
```

The example runs the same three CPU decisions. TypeScript declarations are included. In your own application, load Valen-Decision-1.5 with `await Valen.local('Valen-Team/Valen-Decision-1.5-0.8B-ONNX', { variant: 'fp32' })`. See the [JavaScript README](https://github.com/Valen-Team/valen-sdk-js) for installing the SDK in your own application, local media inputs and `client.systemOne(...)`. For CUDA, run the Python server and call it over HTTP from Node.

## Browser WebGPU

The browser example can be used independently. In a fresh terminal, clone the JavaScript SDK and enter its example directory. If already cloned, go directly to `valen-sdk-js/examples/browser`:

```bash
git clone --branch npm-v0.4.0 --depth 1 https://github.com/Valen-Team/valen-sdk-js.git
cd valen-sdk-js/examples/browser
npm install
npm run dev
```

Open the localhost URL and click **Run locally**. The example loads the Valen-Decision-1.5 0.8B `web-portable` variant (about 2.456 GB) and includes runtime assets, loading feedback and error handling. In your own page, load it with `await Valen.local('Valen-Team/Valen-Decision-1.5-0.8B-ONNX', { variant: 'web-portable', device: 'webgpu' })`. First use downloads and caches model components.

From `examples/browser`, use `npm run build` and `npm run preview` for a production preview. Deployment needs HTTPS or localhost, a WebGPU-capable browser, and the example's COOP/COEP response headers. See the [browser example](https://github.com/Valen-Team/valen-sdk-js/tree/main/examples/browser).

## Protocols and local HTTP service

Decisions uses a question list and exposes predicate results as `probability`. SystemOne uses questions keyed by ID and exposes true/false results as `noul`. The Python methods are `client.decisions(...)` and `client.system_one(...)`; JavaScript uses `client.decisions(...)` and `client.systemOne(...)`. Both execute the same model. Complete independent SystemOne examples are included in each repository.

From the Python SDK repository root, start a local ONNX service:

```bash
python -m pip install ".[onnx,server]"
valen serve --model Valen-Team/Valen-Decision-1.5-0.8B-ONNX --model-name valen --port 8000
```

The service listens at `http://127.0.0.1:8000` and exposes `/v1/decisions` and `/v1/systemone`. In another terminal, run `python examples/http_client.py`. Use `Valen.remote("http://127.0.0.1:8000/v1", model="valen")` to connect; HTTP-only clients do not need local model weights or ONNX Runtime. Python HTTP clients support Python 3.10+.


HTTP images/video must use inline base64 data URLs; local paths from direct SDK examples cannot be used as HTTP media URLs. Video decoding additionally needs `python -m pip install ".[video]"`. Start with the text-only HTTP example above, then add media inputs.

`execution="shared_state"` is the SDK default and shares a forward pass within a request; `execution="question"` compiles questions separately. `temperature` defaults to 1. See the [API reference](./api.md) for endpoint schemas and the SDK READMEs for cache, threading, media and authentication options.

## Native C++ text integration

The [C++ repository](https://github.com/Valen-Team/valen-sdk-cpp) includes a model download script, Rust tokenizer/template components, CMake build instructions and a complete SystemOne JSON request. It runs FP32 CPU text inference directly in a C++ process, with one request per process, and loads both Valen-Decision-1.5 and Valen-Decision-1.0 bundles. Real-model validation covers Valen-Decision-1.5 0.8B on macOS ARM, matching the Python SDK. Use Python or JavaScript for images, video, Decisions or HTTP.

[Native Transformers inference](./quickstart.md) · [Model downloads](/docs/resources/) · [Valen source](https://github.com/Valen-Team/Valen)
