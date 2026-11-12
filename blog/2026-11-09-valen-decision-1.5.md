---
slug: valen-decision-1.5
title: "Valen-Decision-1.5: five sizes, bounding boxes, one forward pass"
description: "Open decision models from 0.8B to 27B with block-structured attention and a grounding head, in native, ONNX and GGUF formats."
authors: [valen]
tags: [models, release]
---

Valen-Decision-1.5 is available in five sizes, from 0.8B to 27B. It answers predicate, choice and score questions about text, images and video, and it now locates what you describe in an image.

Every size ships as native weights, ONNX and GGUF. The 0.8B, 2B and 4B models are live in the [playground](https://huggingface.co/spaces/Valen-Team/Valen-API) and the [free API](/docs/valen/api/), with no key and no download.

<!-- truncate -->

## What is new

**Bounding boxes.** A `bbox` question returns a box, its centre point and a confidence. It sits in the same request as your predicate, choice and score questions, and all of them are answered in one forward pass. See [bbox questions](/docs/valen/bbox/).

![The blue mug located on a counter by a bbox question](/img/bbox-mug-counter.jpg)

**Block-structured attention.** The shared prefix holding your text and media is bidirectional and is computed once for every question. Decision questions read it through one bidirectional block; each bbox question has its own. Read the [architecture notes](/docs/valen/architecture/#valen-decision-15).

**Five sizes.** 0.8B, 2B, 4B, 9B and 27B. Start with 0.8B on a laptop CPU and move up when your task needs it. [Which version should I choose?](/docs/valen/choosing/)

## Results on Jev Decision Index

On [Jev Decision Index](https://huggingface.co/spaces/multimodalart/jev-decision-index) 0.4.1, Valen-Decision-1.5-27B scores 82.9 on the public Vision track, the highest of the 83 entrants, and 74.7 on the public Text track, third of 298. Its full Vision score, which adds private test sets, is 73.3, fifth on the board. Rankings are from the 11 November 2026 snapshot.

| Model | Public Text | Public Vision |
| --- | ---: | ---: |
| Valen-Decision-1.5-0.8B | 54.71 | 58.84 |
| Valen-Decision-1.5-2B | 61.89 | 70.54 |
| Valen-Decision-1.5-4B | 69.01 | 77.85 |
| Valen-Decision-1.5-9B | 70.61 | 79.93 |
| Valen-Decision-1.5-27B | 74.66 | 82.91 |

Scores are normalized index scores from 0 to 100. [Per-size results](/docs/valen/decision-index/)

## Run it your way

| You want | Start here |
| --- | --- |
| Try it in the browser | [Playground](https://huggingface.co/spaces/Valen-Team/Valen-API) |
| Call it from code | [Free API](/docs/valen/api/) |
| Python or JavaScript, CPU, CUDA or WebGPU | [ONNX & SDKs](/docs/valen/onnx/) |
| A local HTTP service on CPU | [GGUF runtime 0.2.0](/docs/valen/gguf/) |
| GPU serving | [vLLM](/docs/valen/vllm/) · [SGLang](/docs/valen/sglang/) |
| Fine-tune on your data | [Training guide](/docs/valen/training/) |

## Get the models

- [Valen-Decision-1.5 collection](https://huggingface.co/collections/Valen-Team/valen-decision-15)
- [Source repository](https://github.com/Valen-Team/Valen)
- [Cookbook](/cookbook/)

Source: [Valen release notes](https://github.com/Valen-Team/Valen#news).
