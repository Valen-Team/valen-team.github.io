---
title: 训练 checkpoint 推理
---

本文介绍 `valen` 包内的逐题推理与评估。Sokoban 的完整游戏评测使用独立的 `evaluation.sokoban` 命令，数据生成、策略比较和轨迹回放见[任务评测说明](https://github.com/Valen-Team/Valen/blob/main/evaluation/sokoban/README.md)。

推理和评估都从 checkpoint 的 `config.json` 重建模型，再加载 `checkpoint.pt` 中的参数。基础模型仍需保存在配置的 `model_path` 下。两种命令的输出格式不同：推理每条记录返回一个响应，评估每道有标签题目输出一行。

## 推理命令

在仓库根目录、已激活项目环境的终端中运行：

```bash
mkdir -p output/predictions
python -m valen.inference \
  --checkpoint output/sft_warmup/latest \
  --data data/smoke/train.jsonl \
  --output output/predictions/smoke.jsonl
```

三个路径参数均必填。`--output` 是文件路径，已有文件会被覆盖。`--device` 默认 `cuda`，可指定如 `cuda:1`。该 CLI 是单进程推理，没有按 rank 分片的逻辑。

推理处理全部问题，输入可省略 `targets`；仍需保留 `group_id`。输出行按输入记录顺序排列，不附带 `group_id` 或 `meta`，通过行序和 `answers` 中的问题 ID 对应输入。

下面展示一道 Noul 题的响应结构。概率和 token 数仅用于说明字段，不是已训练模型的实测结果。

```json
{
  "model": "Valen",
  "answers": {
    "go": {"type": "noul", "noul": 0.8}
  },
  "usage": {"input_tokens": 64, "output_tokens": 0},
  "internal_usage": {"compute_tokens": 64}
}
```

`output_tokens` 固定为 0。Shared-state 的 input_tokens 与 compute_tokens 都计完整共享序列一次；question 模式的计算量包含每个分支重复的 state。具体见[架构说明](/zh-Hans/docs/valen/architecture/#公共上下文与计算量)。


[输出字段](./api/systemone.md) · [概率语义](./probabilities.md)
