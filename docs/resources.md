---
title: Models, datasets, and demos
sidebar_label: Resources
---

# Models, datasets, and demos

## Model weights

| Release | Download |
| --- | --- |
| Valen-Decision-1.5 0.8B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B) |
| Valen-Decision-1.5 2B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B) |
| Valen-Decision-1.5 4B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B) |
| Valen-Decision-1.5 9B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B) |
| Valen-Decision-1.5 27B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B) |
| Valen-Decision-1.0 0.8B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-0.8B) |
| Valen-Decision-1.0 2B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-2B) |
| Valen-Decision-1.0 4B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-4B) |
| Valen Preview 0923 | [Earlier checkpoint](https://huggingface.co/Valen-Team/Valen-Preview-0923) |

Explore the [organization's model collection](https://huggingface.co/Valen-Team) for available export formats.

## ONNX models and SDKs

Use the [ONNX inference guide](/docs/valen/onnx/) to choose a variant. The Valen-Decision-1.5 bundles provide `fp32` and `q8-mlp` for CPU and run with Python SDK 0.5.0 and JavaScript SDK 0.4.0; the Valen-Decision-1.0 repos also provide CUDA and browser variants. Model cards include download sizes and comparisons with the native model.

Valen-Decision-1.5 ONNX: [0.8B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-ONNX) · [2B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-ONNX) · [4B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-ONNX) · [9B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-ONNX) · [27B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-ONNX)

Valen-Decision-1.0 ONNX: [0.8B](https://huggingface.co/Valen-Team/Valen-0.8B-ONNX) · [2B](https://huggingface.co/Valen-Team/Valen-2B-ONNX) · [4B](https://huggingface.co/Valen-Team/Valen-4B-ONNX)

[Python SDK](https://github.com/Valen-Team/valen-sdk-python) · [JavaScript / TypeScript SDK](https://github.com/Valen-Team/valen-sdk-js) · [C++ text integration](https://github.com/Valen-Team/valen-sdk-cpp)

## Datasets

| Dataset | Purpose |
| --- | --- |
| [VisualDecisionBench](https://huggingface.co/datasets/Valen-Team/VisualDecisionBench) | Image and video decision evaluation |
| [JevalKit Datasets](https://huggingface.co/datasets/Valen-Team/JevalKit_Datasets) | Ready-to-use TSV views of eight benchmark families |
| [General 100k](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) | Earlier general training release |
| [Valen Eval Game](https://huggingface.co/datasets/Valen-Team/Valen-Eval-Game) | Game training and evaluation data |

## Interactive resources

- [Valen demo](https://huggingface.co/spaces/yuhangzang/Valen-Preview-0923)
- [JevalKit Leaderboard](https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard)
- [API cookbook](https://valen-team.github.io/cookbook/api-quickstart/)
- [Local inference cookbook](https://valen-team.github.io/cookbook/local-inference/)

## Source repositories

[Valen](https://github.com/Valen-Team/Valen) · [JevalKit](https://github.com/Valen-Team/JevalKit)

