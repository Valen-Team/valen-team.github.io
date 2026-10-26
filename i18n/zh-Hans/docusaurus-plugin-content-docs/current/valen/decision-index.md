---
title: "Jev Decision Index"
---

# Jev Decision Index

Decision Index 是按 edition 定义的基准，与 JevBench 任务集、通用平均准确率不同。JevalKit 固定的 edition 0.3 公开套件保留上游问题 ID、候选顺序、结构化 state、标签、排除规则和权重。其 43 个组成数据集按该准备协议得到 140,178 个公开请求，公开分数不包含私有榜单部分。

使用基准自身的机会校正加权 scorer，不应替换成无权重准确率平均。记录 edition、准备数据哈希、模型 revision、engine、失败与不支持的情况。子集 smoke 或协议检查不能作为完整 Decision Index 结果。

[JevalKit 环境与评分依赖](/zh-Hans/docs/jevalkit/quickstart/) · [基准协议及来源](/zh-Hans/docs/jevalkit/benchmarks/) · [模型接入](/zh-Hans/docs/jevalkit/models/)。数据集实现继续在 [JevalKit](https://github.com/Valen-Team/JevalKit/tree/main/jevalkit/datasets)维护。
