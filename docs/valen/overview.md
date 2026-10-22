---
title: Valen
slug: /valen/
description: An open multimodal System One decision model.
---

# Valen

**Text, images, and video in. Decision probabilities out.**

Valen (万澜) brings visual perception to System One decision-making. Inspired by [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), it evaluates a shared state against task instructions and returns probabilities over supplied candidates.

The repository includes the model implementation, data processing, SFT and experimental RLCD training, inference, and evaluation tools.

## Choose a model

| Model | Weights |
| --- | --- |
| Valen 0.8B | [Valen-0.8B](https://huggingface.co/Valen-Team/Valen-0.8B) |
| Valen 2B | [Valen-2B](https://huggingface.co/Valen-Team/Valen-2B) |
| Valen 4B | [Valen-4B](https://huggingface.co/Valen-Team/Valen-4B) |

Released formats and earlier checkpoints are listed in the [Hugging Face organization](https://huggingface.co/Valen-Team).

## Three decision types

- **Choice:** distribute probability across named options.
- **Noul:** estimate whether a statement is true or false.
- **Score:** assign probability to ordered grades.

The same state can be shared by multiple questions. Read the [data format](/docs/valen/data-format/) and [shared-state execution guide](/docs/valen/qwen-shared-state/) for the full semantics.

## Get started

1. Serve with [SGLang](/docs/valen/sglang/) or [vLLM](/docs/valen/vllm/), use [Transformers locally](/docs/valen/quickstart/), or follow the [hosted API quickstart](/docs/valen/api/).
2. Explore [image and video inputs](/docs/valen/data-format/#images-and-video).
3. Read the [architecture](/docs/valen/architecture/) and [configuration reference](/docs/valen/configuration/).
4. [Evaluate a checkpoint](/docs/valen/evaluation/) or compare models with [JevalKit](/docs/jevalkit/).

[Source repository](https://github.com/Valen-Team/Valen) · [Cookbook](https://github.com/Valen-Team/Valen/tree/main/cookbook) · [Try the demo](https://huggingface.co/spaces/yuhangzang/Valen-Preview-0923)


The hosted API names true/false questions `predicate` and returns `probability`; local inference and evaluation retain the `noul` naming. Use the [API reference](/docs/valen/api/) for hosted request and response fields.
