---
title: 版本选择
---

# 应该选择哪个版本

先按你的设备和用途选择一条路径，再决定模型大小。首次体验可以直接使用[网页](https://valen-team.github.io/zh-Hans/)或[免费 API](/zh-Hans/docs/valen/api/)，无需下载模型。

| 你的需求 | 从这里开始 |
| --- | --- |
| 不安装模型，先试效果 | [网页体验](https://valen-team.github.io/zh-Hans/)或[免费 API](/zh-Hans/docs/valen/api/) |
| Python 本地运行，使用 CPU 或 NVIDIA GPU | [ONNX Python SDK](/zh-Hans/docs/valen/onnx/)，先试 0.8B；支持文本、图片和视频 |
| JavaScript 本地运行 | [ONNX JavaScript SDK](/zh-Hans/docs/valen/onnx/)，使用 Node.js CPU 或浏览器 WebGPU；支持文本、图片和视频 |
| Linux x86-64 CPU 上运行本地 HTTP 服务 | [GGUF Q8_0 和 Valen 定制运行包](/zh-Hans/docs/valen/gguf/)；先试文本，图片和视频的验证范围见运行指南 |
| 已有 NVIDIA GPU 服务环境 | 根据环境选择 [vLLM](/zh-Hans/docs/valen/vllm-plugin/) 或 [SGLang](/zh-Hans/docs/valen/sglang-plugin/)；支持文本和图片，视频可提取帧作为图片输入 |
| 微调模型 | 使用原生完整权重，参照[训练指南](/zh-Hans/docs/valen/training/) |

离线运行需要提前准备对应模型文件或缓存。Python ONNX 0.8B FP32 首次下载约 3.505 GB；GGUF 0.8B Q8_0 文本文件约 0.761 GiB。更多变体及下载体积见 [ONNX](/zh-Hans/docs/valen/onnx/) 和 [GGUF](/zh-Hans/docs/valen/gguf/) 指南。

## 0.8B、2B 还是 4B？

这些数字表示模型大小。首次本地尝试可从 0.8B 开始；如果需要更好的任务效果，再用自己的数据比较 2B 和 4B，同时考虑下载体积和设备资源。[查看模型评测](/zh-Hans/docs/valen/evaluation/) · [比较概率可靠性](/zh-Hans/docs/valen/reliability/)

## 比较运行成本

[查看 0.8B 同机 CPU 延迟与内存实测](/zh-Hans/cookbook/validation/)。结果来自特定机器和输入，可帮助比较已测路径；实际部署的速度和内存取决于设备与负载。ONNX 模型卡也提供各变体的测量和质量对比。

想在自己的样本上比较 Valen 和通用大模型，可以用 Python SDK 的 [`Valen.llm`](./onnx.md#与大模型对比) 把两者跑在同一套问题上：返回同样的类型化答案，并分别记录 token 和延迟。

原生权重、ONNX 和 GGUF 是不同的模型格式；Transformers、ONNX Runtime、定制 llama.cpp/Ollama、SGLang 和 vLLM 是运行后端。SDK 的 `Valen.local` 加载 ONNX；GGUF 服务通过 HTTP 调用。GGUF 需使用 Valen 定制运行时，未修改的 llama.cpp/Ollama 不在支持范围内。
