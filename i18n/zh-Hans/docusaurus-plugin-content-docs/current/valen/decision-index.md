---
title: Jev Decision Index
---

# Valen 在 Jev Decision Index 上的成绩

Jev Decision Index 用统一测试比较模型的决策能力。在 Decision Index 0.4.1 上，Valen-Decision-1.5-27B 的公开 Text 得分为 **74.66**，公开 Vision 得分为 **82.91**；五个尺寸的结果如下。

| 模型 | 公开 Text ↑ | 公开 Vision ↑ |
| --- | ---: | ---: |
| Valen-Decision-1.5-0.8B | 54.71 | 58.84 |
| Valen-Decision-1.5-2B | 61.89 | 70.54 |
| Valen-Decision-1.5-4B | 69.01 | 77.85 |
| Valen-Decision-1.5-9B | 70.61 | 79.93 |
| Valen-Decision-1.5-27B | **74.66** | **82.91** |

Decision Index 0.4.1 公开 Text 与 Vision 赛道，使用 [JevalKit](/zh-Hans/docs/jevalkit/) 评测。分数范围为 0–100，越高越好，不是准确率百分比。

[查看榜单](https://huggingface.co/spaces/multimodalart/jev-decision-index) · [各尺寸指标、评分输出与运行清单](https://huggingface.co/datasets/Valen-Team/Valen-Decision-Index-Results/blob/main/Valen-Decision-1.5-main16k/RESULTS.md)

## Valen-Decision-1.0

| 模型 | 综合得分 Full ↑ | 公开得分 Public ↑ |
| --- | ---: | ---: |
| Valen-0.8B | 16.55 | 20.71 |
| Valen-2B | 22.20 | 27.20 |
| Valen-4B | 37.57 | 38.54 |

榜单快照：2026-10-22。Full 包含私有测试，Public 仅含公开测试。[数据来源](https://huggingface.co/spaces/multimodalart/jev-decision-index/blob/0b5ecaf2396891e76c13a19aa17b874b59abcc37/data/index.json)
