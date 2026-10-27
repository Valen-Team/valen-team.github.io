---
title: "如何使用概率"
---

# 从概率到应用决策

**Choice** 对给定互斥候选分配概率，选择最大者。**Predicate / Noul** 返回一个陈述的 `P(true)`；多个 predicate 并不互斥。**Score** 对有序等级描述分配概率，返回从零开始的 `sum(i*p[i])`。等级标签不天然对应等距业务价值：“低/中/高”不必具有等距成本。需要时显式定义业务效用，再计算 `sum(utility[i]*p[i])`，并独立验证映射。

候选集合、措辞、描述、键和顺序会改变任务。Shared-state 的其他题目及顺序也进入因果上下文。“其他”选项必须有明确含义并经过测试，增加它会改变整个分布。单候选 Choice 的概率和 confidence 永远是 **1**，不能证明判断准确，也无法检测候选集外输入；应使用 predicate 或经过验证的拒绝策略。

## confidence 的实际定义

设候选数 K，`p=softmax(logits/T)`，T 必须有限且大于零。最大概率并列时，选择当前顺序中的第一个候选。

```text
Choice:
  K=1: confidence=1
  K>1: confidence=max(0, (max(p)-1/K)/(1-1/K))
Score:
  mode=argmax(p)
  distance=sum(p[i]*abs(i-mode))
  uniform_mad=sum(abs(i-(K-1)/2))/K
  confidence=max(0, 1-distance/uniform_mad)
```

Score 是等级均值而非众数；`[0.1,0.3,0.6]` 得到 score 1.5、confidence 0.25。Noul 返回 `noul`，Decisions predicate 返回 `probability`，没有上述单独 confidence。Confidence 按这些定义描述分布集中度，**不是实际正确率**。高概率可能未校准，更不是事实保证；不要跨无关候选集或任务比较 confidence。

## 用独立数据选择阈值

1. 在增强前，按来源实体、会话/客户、媒体身份及必要的时间划分 train、阈值/校准 validation、最终 test。去除完全重复和近重复，同源改写必须留在同一划分。
2. 固定模型 revision、后端/精度、温度、提示、候选集合及顺序、媒体预算和标签规则。标注数据要代表部署分布，包含模糊、负例、稀有及范围外情况。
3. 仅在 validation 上扫描 predicate 阈值，或 Choice 的最大概率/差距与拒绝规则。记录 TP/FP/TN/FN、精确率、召回率、误报率、漏报率、自动处理覆盖率和人工复核量。根据业务代价和复核容量选择规则，必要时按类别选择，不能在最终 test 上调参。
4. 固定规则后，在独立 test 上报告样本量、错误、覆盖率及适用的置信区间。少量合成样本只检查流程；本文不声称通用最优阈值或校准收益。

Predicate 可设双阈值：低于下阈值拒绝，高于上阈值接受，中间人工复核。这是应用规则，不是新增模型类别。多个问题冲突时（例如互不兼容的批准结论），使用明确一致性约束并转人工，不要平均无关概率。保存输入、模型/配置、完整分布、规则版本及人工结论便于审计。

## 温度、校准与重新验证

正标量温度在 softmax 前缩放固定 logits，在精确算术下保持排序和 argmax。它改变集中度和 Score 期望值，不能保证提高排序准确率。只有在独立标注校准集上按合适目标拟合，并独立测试后，才能讨论温度校准。原生预测支持按题型温度；其他后端须核对支持。请求体中的温度优先于 Python 关键字。训练 checkpoint 推理 CLI 保留 `{"temperature":1.0}` 文件兼容；推理与评测均支持版本化 `--calibration`，配合 `--protocol` 校验身份，评测默认 T=1。

模型、adapter、精度/后端、提示、候选集合/顺序、问题分组、媒体预算、标签定义、类别比例或输入领域改变后，重新验证阈值。监测线上漂移和人工工作量，不能默认旧阈值持续有效。

完整应用见[工单分流](/zh-Hans/cookbook/ticket-routing/)与[商品筛选](/zh-Hans/cookbook/product-screening/)，示例阈值不是经过校准的推荐值。[评测与指标](./evaluation.md) · [协议参考](./api.md)。公式实现：[inference.py](https://github.com/Valen-Team/Valen/blob/main/valen/evaluation/inference.py)。


## 可复现的校准与分流

推理 CLI 保留旧版 `{"temperature":1.0}` 文件支持。推理和评测均可加载版本化 `--calibration`，并用 `--protocol` 校验身份；评测默认 T=1。参见[完整校准流程](./calibration.md)，拟合与保存参数、冻结人工复核规则并查看独立测试证据。

候选集合可能不完整时，见 [候选项都不对: 未知类别处理](/zh-Hans/cookbook/unknown-categories/)，对比显式 none 与人工复核规则。
