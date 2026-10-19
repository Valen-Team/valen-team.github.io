---
title: JevalKit
slug: /jevalkit/
description: 用于 Jev 类决策模型的开放评测工具。
---

# JevalKit

**为决策模型提供共同的评测基础。**

JevalKit 为 Jev 类决策模型提供统一接口和预处理评测数据，无需在多个仓库中分别准备 Benchmark，即可运行评测。

## 包含哪些能力

- 统一评测命令，覆盖 **8 类 Benchmark**。
- 整理好的 **10 份 TSV 数据视图**。
- 已注册 **20 个模型家族**的适配器。
- 保存预测、来源清单、概率指标与排行榜导出。

模型注册不代表完成了完整实测。[排行榜](https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard)区分完整评测、冒烟检查和导入预测，具体覆盖与来源见各结果清单。

## 开始评测

1. [安装并运行首次评测](/zh-Hans/docs/jevalkit/quickstart/)。
2. [配置模型的原生依赖](/zh-Hans/docs/jevalkit/models/)。
3. [阅读 Benchmark 评分协议](/zh-Hans/docs/jevalkit/benchmarks/)。
4. [查看排行榜](https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard)。

## 添加集成

在 [Issue](https://github.com/Valen-Team/JevalKit/issues) 中提供模型或 Benchmark ID、作者发布链接，以及可用的最小使用示例。

[GitHub](https://github.com/Valen-Team/JevalKit) · [数据集](https://huggingface.co/datasets/Valen-Team/JevalKit_Datasets) · [排行榜](https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard)

