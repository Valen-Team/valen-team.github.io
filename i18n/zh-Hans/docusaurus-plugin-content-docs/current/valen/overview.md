---
title: Valen
slug: /valen/
description: 开放的多模态 System One 决策模型。
---

# Valen

**输入文本、图片与视频，输出候选决策的概率。**

Valen（万澜）为 System One 决策引入视觉感知。受 [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) 启发，模型依据任务要求评估共享状态，对给定候选项输出概率。

仓库包含模型实现、数据处理、SFT 与实验性 RLCD 训练、推理和评测工具。

## 选择模型

| 模型 | 权重 |
| --- | --- |
| Valen 0.8B | [Valen-0.8B](https://huggingface.co/Valen-Team/Valen-0.8B) |
| Valen 2B | [Valen-2B](https://huggingface.co/Valen-Team/Valen-2B) |
| Valen 4B | [Valen-4B](https://huggingface.co/Valen-Team/Valen-4B) |

导出格式与历史版本见 [Hugging Face 组织](https://huggingface.co/Valen-Team)。

## 三类决策问题

- **Choice：**在命名候选项之间分配概率。
- **Noul：**估计命题为真或假的概率。
- **Score：**在有序等级上输出概率分布。

同一个状态可以由多个问题共享。完整语义见[数据格式](/zh-Hans/docs/valen/data-format/)与[共享状态执行](/zh-Hans/docs/valen/qwen-shared-state/)。

## 开始使用

1. 使用 [SGLang 镜像](/zh-Hans/docs/valen/sglang/)、[本地 Transformers](/zh-Hans/docs/valen/quickstart/)，或阅读[托管 API 入门](/zh-Hans/docs/valen/api/)。
2. 理解[图像与视频数据格式](/zh-Hans/docs/valen/data-format/)。
3. 阅读[模型架构](/zh-Hans/docs/valen/architecture/)与[配置参考](/zh-Hans/docs/valen/configuration/)。
4. [评测检查点](/zh-Hans/docs/valen/evaluation/)，或通过 [JevalKit](/zh-Hans/docs/jevalkit/) 比较模型。

[源码仓库](https://github.com/Valen-Team/Valen) · [Cookbook](https://github.com/Valen-Team/Valen/tree/main/cookbook) · [体验 Demo](https://huggingface.co/spaces/yuhangzang/Valen-Preview-0923)


托管 API 使用 `predicate` 和返回字段 `probability` 表达是非判断；本地模型和评测文档沿用 `noul` 命名。调用托管服务时请以 [API 文档](/zh-Hans/docs/valen/api/) 的请求与响应结构为准。
