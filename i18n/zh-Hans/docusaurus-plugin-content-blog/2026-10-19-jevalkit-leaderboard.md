---
slug: jevalkit-leaderboard
title: "JevalKit Leaderboard 正式发布"
description: "跨 Benchmark 比较决策模型，查看概率指标并下载评测结果。"
authors: [valen]
tags: [tooling, release]
---

JevalKit 上线公开排行榜，支持浏览和比较决策模型。

此次发布提供 Benchmark 和模型规模筛选、模型比较、概率指标展示，以及评测结果下载。

<!-- truncate -->

## 统一评测流程

JevalKit 为 8 类 Jev 相关 Benchmark 提供统一模型接口与预处理数据。发布的数据集包含 10 份 TSV 视图，其中图像和视频视图是 VisualDecisionBench 的子集。

目前已注册 20 个模型家族。模型注册与完整实测覆盖分别记录：排行榜区分**完整评测**、**冒烟检查**和**导入预测**。

## 浏览结果

- 按 Benchmark 与模型规模筛选。
- 比较模型结果和概率指标。
- 下载导出的评测结果。
- 比较分数前，查看覆盖范围和结果来源。

[打开排行榜](https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard)

## 运行评测

通过 [JevalKit 入门指南](/zh-Hans/docs/jevalkit/quickstart/)安装依赖，下载模型和数据，运行首次评测。[Benchmark 评分协议](/zh-Hans/docs/jevalkit/benchmarks/)介绍各测试集的评分方式。

[GitHub](https://github.com/Valen-Team/JevalKit) · [数据集](https://huggingface.co/datasets/Valen-Team/JevalKit_Datasets)

来源：[JevalKit 发布记录](https://github.com/Valen-Team/JevalKit#latest-updates)。

