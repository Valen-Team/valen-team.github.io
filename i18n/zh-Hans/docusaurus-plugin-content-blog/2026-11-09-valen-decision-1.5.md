---
slug: valen-decision-1.5
title: "Valen-Decision-1.5：五个尺寸，支持画框，一次前向完成"
description: "0.8B 到 27B 的开放决策模型，采用块结构注意力和定位头，提供原生权重、ONNX 和 GGUF 三种格式。"
authors: [valen]
tags: [models, release]
---

Valen-Decision-1.5 发布，覆盖 0.8B 到 27B 五个尺寸。它回答关于文本、图片和视频的判断、选择和打分问题，现在还能在图片中框出你描述的目标。

每个尺寸都提供原生权重、ONNX 和 GGUF。0.8B、2B 和 4B 已上线[在线体验](https://huggingface.co/spaces/Valen-Team/Valen-API)和[免费 API](/zh-Hans/docs/valen/api/)，无需密钥，无需下载。

<!-- truncate -->

## 新增能力

**画框。** `bbox` 问题返回目标框、中心点和置信度。它可以和判断、选择、打分问题放在同一个请求里，一次前向全部回答。详见 [bbox 问题](/zh-Hans/docs/valen/bbox/)。

![bbox 问题在台面上框出蓝色马克杯](/img/bbox-mug-counter.jpg)

**块结构注意力。** 承载文本和媒体的共享前缀内部双向可见，所有问题共用一次计算。决策类问题通过同一个双向块读取前缀，每个 bbox 问题各有一个块。详见[架构说明](/zh-Hans/docs/valen/architecture/#valen-decision-15)。

**五个尺寸。** 0.8B、2B、4B、9B 和 27B。可以先用 0.8B 在笔记本 CPU 上试，任务需要时再换更大的。[如何选择版本？](/zh-Hans/docs/valen/choosing/)

## Jev Decision Index 成绩

在 [Jev Decision Index](https://huggingface.co/spaces/multimodalart/jev-decision-index) 0.4.1 上，Valen-Decision-1.5-27B 的公开视觉榜得分 82.9，在 83 个参评模型中排第一；公开文本榜得分 74.7，在 298 个模型中排第三。计入私有测试集的视觉总分为 73.3，排第五。名次取自 2026 年 11 月 11 日的榜单。

| 模型 | 公开文本榜 | 公开视觉榜 |
| --- | ---: | ---: |
| Valen-Decision-1.5-0.8B | 54.71 | 58.84 |
| Valen-Decision-1.5-2B | 61.89 | 70.54 |
| Valen-Decision-1.5-4B | 69.01 | 77.85 |
| Valen-Decision-1.5-9B | 70.61 | 79.93 |
| Valen-Decision-1.5-27B | 74.66 | 82.91 |

分数为 0 到 100 的归一化指数。[各尺寸完整结果](/zh-Hans/docs/valen/decision-index/)

## 选择运行方式

| 你想要 | 从这里开始 |
| --- | --- |
| 在浏览器里试 | [在线体验](https://huggingface.co/spaces/Valen-Team/Valen-API) |
| 从代码调用 | [免费 API](/zh-Hans/docs/valen/api/) |
| Python 或 JavaScript，CPU、CUDA 或 WebGPU | [ONNX 与 SDK](/zh-Hans/docs/valen/onnx/) |
| 在 CPU 上起本地 HTTP 服务 | [GGUF runtime 0.2.0](/zh-Hans/docs/valen/gguf/) |
| GPU 部署 | [vLLM](/zh-Hans/docs/valen/vllm/) · [SGLang](/zh-Hans/docs/valen/sglang/) |
| 用自己的数据微调 | [训练指南](/zh-Hans/docs/valen/training/) |

## 获取模型

- [Valen-Decision-1.5 合集](https://huggingface.co/collections/Valen-Team/valen-decision-15)
- [源码仓库](https://github.com/Valen-Team/Valen)
- [Cookbook](/zh-Hans/cookbook/)

来源：[Valen 发布记录](https://github.com/Valen-Team/Valen#news)。
