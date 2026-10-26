---
title: "发布模型架构"
---

# 先理解实际发布模型

发布的原生 Valen-0.8B、Valen-2B、Valen-4B 使用 Qwen3.5 多模态骨干、**Mixer** 候选评分头和 **shared_state** 执行。发布配置为 `model_type="valen_qwen"`、`qwen_execution="shared_state"`、`valen_head.head_type="mixer"`。Mixer 宽度 256、两层 block、角色混合隐藏宽度 16、通道混合隐藏宽度 1024。`valen_max_length=32768` 限制完整序列，不代表每种后端都接受这一预算。

这些是发布配置，不能用通用构建器的 `bilinear` / `question` fallback 替代。加载完整模型时继承已保存架构，拒绝不兼容的评分头尺寸，并保留训练后的评分头。

## 候选评分

骨干输出 hidden states，而不是词表答案。每个候选构造四个角色：上下文均值池化、指令均值池化、候选区间均值池化、该题最后的 Decision token。经 LayerNorm、共享投影映射至 256 维，并加可学习角色嵌入。

每个 Mixer block 先以带残差的 MLP 混合四个角色（4 → 16 → 4），再混合通道（256 → 1024 → 256），均使用归一化和 GELU。两层后，对更新后的**候选角色**归一化并线性读出一个 FP32 logit。不同候选共用评分器，Mixer 不跨候选行混合；骨干特征仍会受候选顺序及其他因果上下文影响。

`softmax(logits / temperature)` 得到候选概率。模型不调用 `generate()`，也不解码词表 token；`output_tokens=0` 不代表没有计算成本。[概率指南](./probabilities.md)解释三种输出与 confidence。

## 公共上下文与计算量

<a id="公共上下文与计算量"></a>

Shared-state 将 state/媒体放入一次，再放所有题目及候选，最后放各题 Decision 读出。Choice、Noul 和 Score 的全部等级共用一次骨干前向；批处理的不同 state 位于不同 padding 行。有标签训练和评测保留全部题目上下文，仅有标签的读出参与损失/指标。标签和外部题目 ID 不进入提示，Choice 键会进入。

此模式中 `logical_tokens = compute_tokens = 完整共享序列长度`。包含视觉 token，不含反向、padding 批次开销或 RLCD/参考策略的重复前向，不能视为 FLOPs。`max_length` 限制完整序列，超长直接报错。`tokens_per_step` 按每卡预算打包完整 state；`microbatch_size` 计算 state 数，padding token 上限可能缩小批次，单个超预算行仍单独执行但必须满足 state 限制。一次前向不保证恒定内存或线性成本。

## 历史与可选实现

`question` 模式在每个分支重复 state：Choice/Noul 一题一个分支，Score 每等级一个分支。state 长度 B、后缀长度 Sᵢ 时，逻辑 token 为 `B + sum(Sᵢ)`，计算 token 为 `sum(B + Sᵢ)`，没有跨分支骨干 KV 缓存复用。这与发布版 shared-state 输入不同。

Bilinear 使用两投影的缩放点积；MLP、role-MLP、dual-encoder 仍是研究选项。旧点积公式**不适用于 Mixer**。改变执行模式或评分头需要匹配训练及独立验证。

实现：[heads.py](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/heads.py)、[编译器](https://github.com/Valen-Team/Valen/blob/main/valen/data/compilers/qwen.py)、[完整模型加载](https://github.com/Valen-Team/Valen/blob/main/valen/modeling/qwen/pretrained.py)。[Shared-state 参考](./qwen-shared-state.md) · [训练](./training.md)

<a id="从-jsonl-到决策"></a>
<a id="编译器做了什么"></a>
<a id="backbone与decision-head"></a>
<a id="参数开放与优化"></a>
<a id="分布式训练"></a>
<a id="冻结特征复用"></a>
<a id="保存加载和输出"></a>
