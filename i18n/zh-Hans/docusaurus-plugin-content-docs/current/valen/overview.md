---
title: Valen
slug: /valen/
description: 开放的多模态 System One 决策模型。
---

# Valen

**输入文本、图片与视频，输出候选决策的概率。**

Valen（万澜）为 System One 决策引入视觉感知。受 [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) 启发，模型依据任务要求评估共享状态，对给定候选项输出概率。

仓库包含模型实现、数据处理、SFT 与实验性 RLCD 训练、推理和评测工具。

## 最新动态

- **2026-10-26**：三尺寸 F32/Q8_0 GGUF 已发布，新增[无需编译的 CPU 文本服务](/zh-Hans/docs/valen/gguf/)与[统一版本选择](/zh-Hans/docs/valen/choosing/)。[Python](https://github.com/Valen-Team/valen-sdk-python/releases/tag/v0.2.0)/[JavaScript](https://github.com/Valen-Team/valen-sdk-js/releases/tag/v0.2.0) SDK 0.2.0 提供 GitHub 稳定包，尚未发布到 PyPI/npm。

## 选择模型

| 模型 | 原生权重 / Transformers | ONNX Runtime | GGUF / 定制运行时 |
| --- | --- | --- | --- |
| Valen 0.8B | [Valen-0.8B](https://huggingface.co/Valen-Team/Valen-0.8B) | [Valen-0.8B-ONNX](https://huggingface.co/Valen-Team/Valen-0.8B-ONNX) | [Valen-0.8B-GGUF](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF) |
| Valen 2B | [Valen-2B](https://huggingface.co/Valen-Team/Valen-2B) | [Valen-2B-ONNX](https://huggingface.co/Valen-Team/Valen-2B-ONNX) | [Valen-2B-GGUF](https://huggingface.co/Valen-Team/Valen-2B-GGUF) |
| Valen 4B | [Valen-4B](https://huggingface.co/Valen-Team/Valen-4B) | [Valen-4B-ONNX](https://huggingface.co/Valen-Team/Valen-4B-ONNX) | [Valen-4B-GGUF](https://huggingface.co/Valen-Team/Valen-4B-GGUF) |

导出格式与历史版本见 [Hugging Face 组织](https://huggingface.co/Valen-Team)。

## 三类决策问题

- **Choice**：在命名候选项之间分配概率。
- **Noul**：估计命题为真或假的概率。
- **Score**：在有序等级上输出概率分布。

同一个状态可以由多个问题共享。完整语义见[数据格式](/zh-Hans/docs/valen/data-format/)与[共享状态执行](/zh-Hans/docs/valen/qwen-shared-state/)。

## 选择运行方式

| 需求 | 接入方式 |
| --- | --- |
| C++ Linux CPU HTTP / GGUF | [Valen custom llama-server](/zh-Hans/docs/valen/gguf/) |
| 原生 PyTorch 模型与 CUDA 推理 | [Transformers](/zh-Hans/docs/valen/quickstart/) |
| 应用内 CPU / CUDA、Node.js 或浏览器推理 | [ONNX 与 Python / JavaScript SDK](/zh-Hans/docs/valen/onnx/) |
| 原生 C++ 文本集成 | [C++ 示例](https://github.com/Valen-Team/valen-sdk-cpp) |
| 部署 GPU HTTP 服务 | [SGLang](/zh-Hans/docs/valen/sglang/) · [vLLM](/zh-Hans/docs/valen/vllm/) |
| 调用已有服务，无需本地权重 | [HTTP API](/zh-Hans/docs/valen/api/) |

## 开始使用

1. 通过 [SGLang](/zh-Hans/docs/valen/sglang/) 或 [vLLM](/zh-Hans/docs/valen/vllm/) 部署服务，使用 [本地 Transformers](/zh-Hans/docs/valen/quickstart/) 或 [ONNX SDK](/zh-Hans/docs/valen/onnx/)，或阅读[托管 API 入门](/zh-Hans/docs/valen/api/)。
2. 理解[图像与视频数据格式](/zh-Hans/docs/valen/data-format/)。
3. 阅读[模型架构](/zh-Hans/docs/valen/architecture/)与[配置参考](/zh-Hans/docs/valen/configuration/)。
4. [评测检查点](/zh-Hans/docs/valen/evaluation/)，或通过 [JevalKit](/zh-Hans/docs/jevalkit/) 比较模型。

[源码仓库](https://github.com/Valen-Team/Valen) · [Cookbook](https://github.com/Valen-Team/Valen/tree/main/cookbook) · [体验 Demo](https://huggingface.co/spaces/yuhangzang/Valen-Preview-0923)


SystemOne 使用 `noul` 表达是非判断并返回同名字段；Decisions 使用 `predicate` 并返回 `probability`。Transformers 与 ONNX SDK 均支持两种协议，HTTP 端点结构见 [API 文档](/zh-Hans/docs/valen/api/)。

## 版本选择

[版本选择 / Version selection](/zh-Hans/docs/valen/choosing/) · [GGUF](/zh-Hans/docs/valen/gguf/)
