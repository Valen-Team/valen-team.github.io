---
title: 模型微调
---

# 用自己的数据微调 Valen

微调就是用自己的标注数据继续训练已有模型。例如，让 Valen 学习你公司的客服分类规则。建议从 Valen-0.8B 的 LoRA 微调开始，只更新少量参数，先做小规模尝试。

[领域微调 Cookbook](/zh-Hans/cookbook/domain-finetuning/)包含数据模板和可直接运行的完整步骤。

## 开始训练

1. 按来源或会话划分 train、validation、test；重复内容及其改写留在同一划分。格式见[数据准备](./data-format.md)。
2. 复制 `configs/train/qwen/sft_finetune_lora.json`，填写本地完整模型、训练数据和新的输出目录。见[训练配置](./configuration.md)。
3. 训练后，用同一独立 test 比较原模型与微调模型；用 validation 选择参数和阈值。

```bash
python -m valen.train --config finetune.json
```

需要更新整个骨干且有足够显存时，使用 `sft_finetune_full.json`。LoRA 仍需加载完整骨干，不是 4-bit 训练。

## 从 Qwen 基座训练

Qwen 基座需要新建决策头：先做 Mixer warmup，再做 joint SFT。具体见 [Shared-state](./qwen-shared-state.md)。这是监督训练，不是语言模型预训练；RLCD 为实验性方法。

[保存、恢复与导出](./checkpoints.md)
