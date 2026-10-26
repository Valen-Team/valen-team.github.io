---
title: Valen
slug: /valen/
description: An open multimodal System One decision model.
---

# What is Valen?

Valen is a multimodal model for classification, yes/no decisions and ratings. Give it text, images or video, a question and possible answers; it returns a probability for each answer.

For example, classify a customer message as an address change or cancellation, or check whether a product image meets your requirements.

[Try your first call](./getting-started.md) without downloading a model, or build from a complete [Cookbook example](/cookbook/).

## Choose a model

| Model | Native weights / Transformers | ONNX Runtime | GGUF / custom runtime |
| --- | --- | --- | --- |
| Valen 0.8B | [Valen-0.8B](https://huggingface.co/Valen-Team/Valen-0.8B) | [Valen-0.8B-ONNX](https://huggingface.co/Valen-Team/Valen-0.8B-ONNX) | [Valen-0.8B-GGUF](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF) |
| Valen 2B | [Valen-2B](https://huggingface.co/Valen-Team/Valen-2B) | [Valen-2B-ONNX](https://huggingface.co/Valen-Team/Valen-2B-ONNX) | [Valen-2B-GGUF](https://huggingface.co/Valen-Team/Valen-2B-GGUF) |
| Valen 4B | [Valen-4B](https://huggingface.co/Valen-Team/Valen-4B) | [Valen-4B-ONNX](https://huggingface.co/Valen-Team/Valen-4B-ONNX) | [Valen-4B-GGUF](https://huggingface.co/Valen-Team/Valen-4B-GGUF) |

Released formats and earlier checkpoints are listed in the [Hugging Face organization](https://huggingface.co/Valen-Team).

## Three decision types

- **Choice:** distribute probability across named options.
- **Noul:** estimate whether a statement is true or false.
- **Score:** assign probability to ordered grades.

The same state can be shared by multiple questions. Read the [data format](/docs/valen/data-format/) and [shared-state execution guide](/docs/valen/qwen-shared-state/) for the full semantics.

## Choose a runtime

| Goal | Integration |
| --- | --- |
| C++ Linux CPU HTTP / GGUF | [Valen custom llama-server](/docs/valen/gguf/) |
| Native PyTorch model and CUDA inference | [Transformers](/docs/valen/quickstart/) |
| In-app CPU / CUDA, Node.js or browser inference | [ONNX and Python / JavaScript SDKs](/docs/valen/onnx/) |
| Native C++ text integration | [C++ example](https://github.com/Valen-Team/valen-sdk-cpp) |
| Serve a GPU HTTP API | [SGLang](/docs/valen/sglang/) · [vLLM](/docs/valen/vllm/) |
| Call an existing service without local weights | [HTTP API](/docs/valen/api/) |

## Get started

1. Serve with [SGLang](/docs/valen/sglang/) or [vLLM](/docs/valen/vllm/), use [Transformers locally](/docs/valen/quickstart/) or the [ONNX SDKs](/docs/valen/onnx/), or follow the [hosted API quickstart](/docs/valen/api/).
2. Explore [image and video inputs](/docs/valen/data-format/#images-and-video).
3. Read the [architecture](/docs/valen/architecture/) and [configuration reference](/docs/valen/configuration/).
4. [Evaluate a checkpoint](/docs/valen/evaluation/) or compare models with [JevalKit](/docs/jevalkit/).

[Source repository](https://github.com/Valen-Team/Valen) · [Cookbook](https://valen-team.github.io/cookbook/) · [Try the demo](https://huggingface.co/spaces/yuhangzang/Valen-Preview-0923)


SystemOne names true/false questions `noul` and returns the same field; Decisions uses `predicate` and returns `probability`. Both Transformers and ONNX SDKs support these protocols. See the [API reference](/docs/valen/api/) for HTTP endpoint schemas.

## Choose a version

[版本选择 / Version selection](/docs/valen/choosing/) · [GGUF](/docs/valen/gguf/)

[First call](./getting-started.md) · [Cookbook](/cookbook/)

<a id="news"></a>
