---
title: 评测
---

# 在自己的数据上评测

微调前后使用同一个独立测试集，保持候选、顺序、温度、媒体预算与后端一致。用 validation 选参数，最后再看 test。

```bash
python -m valen.evaluate --checkpoint output/domain/run/latest \
  --data test.jsonl --output output/evaluation
```

结果包括逐题 `predictions.jsonl` 和汇总 `metrics.json`。报告样本量、失败数和每类结果；训练 loss 不能替代测试表现。完整前后比较见 [Cookbook](/zh-Hans/cookbook/domain-finetuning/)。

## 指标
记标签分布为 y，预测分布为 p。实现见 [question_metrics / summarize](https://github.com/Valen-Team/Valen/blob/main/valen/evaluation/metrics.py)。

| 指标 | 适用范围 | 定义 |
| --- | --- | --- |
| `nll` | 全部有标签题 | `-sum(y[k] * log(p[k]))`，使用自然对数 |
| `brier` | 全部有标签题 | `sum((p[k] - y[k])²)`，不除候选数 |
| `accuracy` | 严格 one-hot 标签 | 预测 argmax 与标签 argmax 相同记为 1；Score 也按离散等级判断 |
| `expected_score_mae` | Score，包括软标签 | `abs(sum(k*p[k]) - sum(k*y[k]))` |
| `rps` | Score，包括软标签 | 前 K−1 个累积分布差的平方平均 |
| `macro_f1` | Noul 硬标签 | true/false 两类 F1 的算术平均；某类分母为 0 时该类 F1 记为 0 |

汇总按**题目等权平均**。`metric_counts` 给出每项指标的有效题数；软标签不计 accuracy，因此该分母通常不同于 `questions`。Noul 的混淆矩阵与 `macro_f1` 只出现在 `task/noul` 和 `task_modality/noul/*` 分组。

分组key包括 `overall`、`task/*`、`modality/*`、`task_modality/*/*`、`language/*`、`domain/*`。模态优先读取 `meta.modality`；未提供时只有 `text` 和 `media` 两种分类，不自动区分图片与视频。

概率含义与阈值见[概率指南](./probabilities.md)，性能与后端测量见 [Cookbook 验证](/zh-Hans/cookbook/validation/)。命令默认 T=1，可通过 `--calibration` 与 `--protocol` 加载参数；完整计时和汇总实现见 [evaluate.py](https://github.com/Valen-Team/Valen/blob/main/valen/evaluation/evaluate.py)。

<a id="推理命令"></a>
<a id="三种答案的字段"></a>
<a id="temperature设置"></a>
<a id="评估命令与产物"></a>
<a id="如何读计时"></a>
<a id="指标口径"></a>

<a id="合成集只检查流程正式评估替换为独立测试集"></a>
<a id="同一数据按记录分到四个进程不填充重复样本"></a>


## 概率校准与自动处理

评测 CLI 默认 T=1，也支持 `--calibration` 与 `--protocol`，在同一次前向推理中报告原始和校准后指标。通过 `--cache-role`、`--group-namespace` 和协议文件可保存离线校准缓存。参见[校准、冻结规则与独立测试](./calibration.md)。
