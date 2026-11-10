---
title: Choose a version
---

# Which version should I choose?

Choose a path for your device and task first, then choose a model size. To try Valen without downloading a model, use the [web experience](https://valen-team.github.io/) or [free API](/docs/valen/api/).

| Your goal | Start here |
| --- | --- |
| Try it without installing a model | [Web experience](https://valen-team.github.io/) or [free API](/docs/valen/api/) |
| Run locally in Python on CPU or NVIDIA GPU | [ONNX Python SDK](/docs/valen/onnx/), starting with 0.8B; supports text, images and video |
| Run locally in JavaScript | [ONNX JavaScript SDK](/docs/valen/onnx/) on Node.js CPU or browser WebGPU; supports text, images and video |
| Run a local HTTP service on Linux x86-64 CPU | [GGUF Q8_0 and the Valen custom runtime](/docs/valen/gguf/); Valen-Decision-1.5 serves text, image and bbox requests |
| Use an existing NVIDIA GPU serving environment | Choose [vLLM](/docs/valen/vllm-plugin/) or [SGLang](/docs/valen/sglang-plugin/) to match your environment; supports text and images, with video frames supplied as images |
| Locate objects in an image | [Bbox questions](/docs/valen/bbox/) with Valen-Decision-1.5: native weights and Transformers, the [ONNX SDKs](/docs/valen/onnx/#bbox-questions), or the [GGUF runtime](/docs/valen/gguf/#bbox-request-with-an-image) |
| Fine-tune a model | Use complete native weights and the [training guide](/docs/valen/training/) |

Offline use requires model files or a cache prepared in advance. The initial Python ONNX 0.8B FP32 download for Valen-Decision-1.5 is about 3.518 GB; the Valen-Decision-1.5 GGUF 0.8B Q8_0 text file is about 0.77 GiB, plus about 0.37 GiB for its vision file. See the [ONNX](/docs/valen/onnx/) and [GGUF](/docs/valen/gguf/) guides for other variants and download sizes.

## Which size?

Valen-Decision-1.5 comes in 0.8B, 2B, 4B, 9B and 27B; the numbers describe model size. The web experience and free API serve 0.8B, 2B and 4B; 9B and 27B run from downloaded weights. Start a local trial with 0.8B, then compare larger sizes on your own task if you need better results, considering download size and device resources. Larger sizes score higher on [Jev Decision Index](/docs/valen/decision-index/). [See model evaluations](/docs/valen/evaluation/) · [Compare probability reliability](/docs/valen/reliability/)

## Compare running costs

[See measured 0.8B CPU latency and memory on the same machine](/cookbook/validation/). The results use a specific machine and inputs to compare the measured paths; actual speed and memory depend on your hardware and workload. ONNX model cards also provide variant measurements and quality comparisons.

To weigh Valen against a general LLM on your own cases, run both through the Python SDK with [`Valen.llm`](./onnx.md#compare-with-an-llm): same questions, same typed answers, with tokens and latency for each.

Native weights, ONNX and GGUF are model formats; Transformers, ONNX Runtime, custom llama.cpp/Ollama, SGLang and vLLM are execution backends. SDK `Valen.local` loads ONNX; access a GGUF server over HTTP. GGUF files run on the Valen custom runtime.
