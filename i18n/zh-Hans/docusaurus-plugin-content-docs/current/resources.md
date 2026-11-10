---
title: 模型、数据与 Demo
sidebar_label: 资源
---

# 模型、数据与 Demo

## 模型权重

| 版本 | 下载 |
| --- | --- |
| Valen-Decision-1.5 0.8B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B) |
| Valen-Decision-1.5 2B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B) |
| Valen-Decision-1.5 4B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B) |
| Valen-Decision-1.5 9B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B) |
| Valen-Decision-1.5 27B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B) |
| Valen-Decision-1.0 0.8B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-0.8B) |
| Valen-Decision-1.0 2B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-2B) |
| Valen-Decision-1.0 4B | [Hugging Face](https://huggingface.co/Valen-Team/Valen-4B) |
| Valen Preview 0923 | [早期检查点](https://huggingface.co/Valen-Team/Valen-Preview-0923) |

可用导出格式见 [Hugging Face 组织](https://huggingface.co/Valen-Team)。

## ONNX 模型与 SDK

通过 [ONNX 推理指南](/zh-Hans/docs/valen/onnx/) 选择变体。Valen-Decision-1.5 模型包提供 CPU 的 `fp32` 与 `q8-mlp`、NVIDIA GPU 的 `cuda-fp16`，0.8B 另有浏览器 WebGPU 的 `web-portable`，由 Python SDK 0.5.1 和 JavaScript SDK 0.4.0 运行。下载体积及与原生模型的对比见各模型卡片。

Valen-Decision-1.5 ONNX：[0.8B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-ONNX) · [2B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-ONNX) · [4B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-ONNX) · [9B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-ONNX) · [27B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-ONNX)

Valen-Decision-1.0 ONNX：[0.8B](https://huggingface.co/Valen-Team/Valen-0.8B-ONNX) · [2B](https://huggingface.co/Valen-Team/Valen-2B-ONNX) · [4B](https://huggingface.co/Valen-Team/Valen-4B-ONNX)

[Python SDK](https://github.com/Valen-Team/valen-sdk-python) · [JavaScript / TypeScript SDK](https://github.com/Valen-Team/valen-sdk-js) · [C++ 文本集成](https://github.com/Valen-Team/valen-sdk-cpp)

## 数据集

| 数据集 | 用途 |
| --- | --- |
| [VisualDecisionBench](https://huggingface.co/datasets/Valen-Team/VisualDecisionBench) | 图像与视频决策评测 |
| [JevalKit Datasets](https://huggingface.co/datasets/Valen-Team/JevalKit_Datasets) | 8 类 Benchmark 的即用 TSV 视图 |
| [General 100k](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) | 早期通用训练数据 |
| [Valen Eval Game](https://huggingface.co/datasets/Valen-Team/Valen-Eval-Game) | 游戏训练与评测数据 |

## 交互资源

- [Valen Demo](https://huggingface.co/spaces/yuhangzang/Valen-Preview-0923)
- [JevalKit Leaderboard](https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard)
- [API Cookbook](https://valen-team.github.io/zh-Hans/cookbook/api-quickstart/)
- [本地推理 Cookbook](https://valen-team.github.io/zh-Hans/cookbook/local-inference/)

## 源码仓库

[Valen](https://github.com/Valen-Team/Valen) · [JevalKit](https://github.com/Valen-Team/JevalKit)

