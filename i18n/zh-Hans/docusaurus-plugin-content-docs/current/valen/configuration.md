---
title: 训练配置
---

# 训练配置

从已有配方复制，不用从空白 JSON 开始：

```bash
cp configs/train/qwen/sft_finetune_lora.json finetune.json
python -m valen.train --config finetune.json
```

运行前填写以下字段。相对路径以当前工作目录为准。

| 字段 | 填写内容 |
| --- | --- |
| `model.model_path` | 缓存的完整 Valen 模型目录 |
| `data.path` | 训练 JSONL |
| `training.output` | 本次实验的新输出目录 |
| `training.epochs`、`max_steps` | 轮数、步数上限，先达到者结束训练 |
| `training.tokens_per_step` | 每卡每次更新的 token 预算 |
| `data.max_length` | 单条完整共享序列的长度上限 |

完整模型会继承已保存的 Mixer、执行模式和媒体设置，续训时不要重新指定一套评分头。

## 显存与学习率

先沿用配方中的 SDPA、BF16 和 LoRA。`microbatch_size` 限制同时前向的 state 数，`microbatch_max_tokens` 限制 padding 后的前向 token 数；减小它们可降低峰值内存，而不改变更新预算。单条 state 仍须满足长度和更新预算。

`head_lr`、`lora_lr`、`merger_lr` 分别控制对应参数组；全量微调还使用 `language_lr`、`vision_lr`。用 validation 选择修改，保留 test 做最终比较。

完整参数以源码配方为准：[LoRA](https://github.com/Valen-Team/Valen/blob/main/configs/train/qwen/sft_finetune_lora.json)、[全量微调](https://github.com/Valen-Team/Valen/blob/main/configs/train/qwen/sft_finetune_full.json)、[Qwen 基座训练](https://github.com/Valen-Team/Valen/tree/main/configs/train/qwen)。[恢复训练](./checkpoints.md)

<a id="数据模型和训练budget"></a>
<a id="qwen-共享-state-训练"></a>
<a id="qwen-多-qa-并行训练"></a>
<a id="qwen-flashattention-2"></a>
<a id="可训练参数与优化器"></a>
<a id="rlcd-参数"></a>
<a id="从示例建立一个实验"></a>
<a id="配置校验与恢复"></a>
