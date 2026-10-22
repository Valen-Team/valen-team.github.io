---
title: SGLang 部署
sidebar_label: SGLang 部署
---

# SGLang 部署

选择一种部署方式，然后按对应教程完成安装、启动和请求验证。

| 方式 | 适合的环境 | 从哪里开始 |
| --- | --- | --- |
| Valen-Team 镜像 | 使用 Docker，希望直接拉取预构建运行环境 | [镜像部署](./sglang-image.md) |
| 原版 SGLang 插件 | 已有指定版本的官方 SGLang 环境，希望安装 Valen wheel | [插件部署](./sglang-plugin.md) |

两种方式都提供 `/v1/systemone` 本地接口，支持单 GPU 的文本/图片 choice、noul、score 决策。直接视频推理请使用 [Transformers](./quickstart.md)。
