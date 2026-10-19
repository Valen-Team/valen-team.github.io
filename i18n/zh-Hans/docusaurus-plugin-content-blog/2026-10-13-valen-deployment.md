---
slug: valen-deployment
title: "通过 API、ONNX 和 GGUF 使用 Valen"
description: "新增部署格式与 API Cookbook，更方便地将 Valen 决策能力接入应用。"
authors: [valen]
tags: [release, models]
---

Valen 新增部署格式，并提供 API 调用文档。

ONNX 与 GGUF 版本已发布到 Valen Team 的 Hugging Face 组织。API Cookbook 包含预览版本以及 0.8B、2B、4B 模型的调用示例。

<!-- truncate -->

## 调用托管模型

[API Cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart_zh.ipynb) 包含可执行示例、输入预览和保存结果。可以先通过 [API 入门](/zh-Hans/docs/valen/api/)了解请求结构。

## 运行导出模型

已发布的导出模型包含 `FORMAT_USAGE.md` 说明和专用的 `valen_formats.py` 推理入口。

ONNX 使用 ONNX Runtime 执行视觉主干、语言主干与 Mixer。GGUF 保留原始张量精度，采用自定义 `valen_qwen` 架构，因此需要使用随附的 Valen 推理入口。

[浏览模型与导出格式](https://huggingface.co/Valen-Team)

## 从源码导出

仓库提供导出、格式核验和一致性检查工具，可检查文本、图像和视频在不同执行模式下的输出一致性。

[阅读导出指南](https://github.com/Valen-Team/Valen/blob/main/scripts/README.md)

来源：[Valen 发布记录](https://github.com/Valen-Team/Valen#news)。

