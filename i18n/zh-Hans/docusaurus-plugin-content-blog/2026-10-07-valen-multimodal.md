---
slug: valen-multimodal
title: "Valen 0.8B、2B、4B：让决策看见世界"
description: "开放多模态决策模型，以及用于图像与视频评测的 VisualDecisionBench。"
authors: [valen]
tags: [models, data, release]
---

我们发布了 **0.8B、2B、4B** 三个规模的 Valen 模型，支持文本、图像与视频输入。

同时发布 **VisualDecisionBench**，用于评测基于图像和视频的决策能力。

<!-- truncate -->

## 结构化的决策接口

Valen 根据任务要求评估共享状态，对给定候选项输出概率。模型支持 Choice、Noul 和 Score 问题，为软件提供结构化决策接口。

仓库包含模型实现、数据处理、推理与评测命令，以及 SFT 与实验性 RLCD 训练支持。

## 模型

| 规模 | 下载 |
| --- | --- |
| 0.8B | [Valen-0.8B](https://huggingface.co/Valen-Team/Valen-0.8B) |
| 2B | [Valen-2B](https://huggingface.co/Valen-Team/Valen-2B) |
| 4B | [Valen-4B](https://huggingface.co/Valen-Team/Valen-4B) |

## VisualDecisionBench

完整发布评测集包含 1,696 个共享状态和 9,143 个问题，其中图像问题 2,000 个，视频问题 7,143 个。

[探索 Benchmark](/zh-Hans/benchmarks/) · [下载数据集](https://huggingface.co/datasets/Valen-Team/VisualDecisionBench)

## 开始构建

[在本地运行 Valen](/zh-Hans/docs/valen/quickstart/)，或浏览[源码仓库](https://github.com/Valen-Team/Valen)。

来源：[Valen 发布记录](https://github.com/Valen-Team/Valen#news)。

