---
title: "共享状态执行"
sidebar_label: "共享状态执行"
---

`model.qwen_execution = "shared_state"` 让同一条记录中的全部问题共用一条 Qwen backbone 序列。
`share_state` 作为拼写别名同样可用，保存时统一记为 `shared_state`。单题记录走完全相同的执行路径。
发布的完整 Valen 默认保存 `shared_state`；通用基座构建器 fallback 的 `question` 保留旧模型的输入和 Score 分支。

## 模型与特征

![模型执行流程图](/img/shared-state-zh-Hans.svg)

输入序列如下（提示词本身为英文）：

```text
[state 消息与媒体，只出现一次]
user:
  Question 1: task, instruction, candidates
  Question 2: task, instruction, candidates
assistant:
  Question 1 Decision:
  Question 2 Decision:
```

每道题都有各自的指令区间、候选区间和 Decision 位置。Mixer 为每个候选读取四个角色：
均值池化的 state、指令、候选描述，以及最后的 Decision token。默认的两个 block 在这四个角色
之间以及各自的通道上做混合。该头在各题和各候选之间共享，为每个候选返回一个 FP32 logit。
Bilinear、MLP 和 role-MLP 头同样支持这种共享 backbone 的执行方式。

全部 Choice、Noul 和 Score 题共用一张计算图。Score 能看到全部有序等级描述，一次前向即输出全部
logits。schema 使用普通的因果注意力，因此题目顺序、选项顺序以及其他题目都可能影响结果。
这是一种新的输入格式，需要重新训练，并在独立验证集上检验。

标签和外部 ID 不进入序列。训练和评估**在输入中保留请求的全部问题**，包括无标签问题；
只有有标签的读出参与 loss / 指标计算。推理返回请求的全部读出。
训练时，完全没有标签的记录会在读取媒体之前被跳过。

## 批量与损失

同一个 state 内，全部问题共用一次 backbone 前向和一张反向计算图。
`microbatch_size > 1` 时，不同 state 在同一个 batch 中各占一行并补齐；图像/视频 patch 按 state
只拼接一次。各 state 的因果上下文彼此独立。共享模式下，`microbatch_size` 计的是 **state 数**，
而不是问题数。`microbatch_max_tokens` 限制 batch 补齐后的 token 总量；单行超限时单独执行，
仍受 `max_length` 和 `tokens_per_step` 约束。

SFT 和 RLCD 支持两种 reduction：

- `state_mean`（默认）：先在每个 state 内对有标签问题的 loss 求平均，再跨 rank 对全部 state
  求全局平均。这与此前的加权方式一致。
- `question_mean`：跨 rank 对全部有标签问题的 loss 求全局平均。各记录题目数不同时，
  它能保留按 QA 数量指定的数据配比。新的 Mixer 训练配方使用这种 reduction。

软标签、交叉熵、Brier 和 Score RPS 保持原有定义。支持 FlashAttention-2、语言 LoRA、
视觉 merger 更新、梯度检查点、CPU 预取和分布式 token 累积。RLCD 还支持共享的策略/参考前向
和冻结特征缓存。共享 state RLCD 可以对 rollout/参考推理和策略更新同时组批，并支持 CPU 预取。
冻结特征缓存仍只支持 microbatch size 为 1。

`logical_tokens` 和 `compute_tokens` 都只把完整的共享序列计一次。`max_length` 作用于整个
state、schema 和读出位置。超长记录会直接报错，不会静默丢弃任何问题或 token。

## 整理训练数据

原生的多题 JSONL 记录可以直接使用。对于每条记录只有一个 QA 的混合数据，可将 state、
group ID、assets 以及 source/domain/modality 元信息都相同的记录合并：

```bash
python -m valen.data.group_questions \
  --input next-generation-qwen/mixer-gvt-261001/data/train.jsonl \
  --output next-generation-qwen/shared-state/data/train.jsonl \
  --max-questions 4

python -m valen.data.group_questions \
  --input next-generation-qwen/mixer-gvt-261001/data/warmup.jsonl \
  --output next-generation-qwen/shared-state/data/warmup.jsonl \
  --max-questions 4
```

该命令保留每个 QA 及其标签，在达到题目上限时拆分分组，以确定性方式重命名冲突的问题 ID，
并记录其原始行号、ID 和记录 ID。它在移动记录之前先解析相对媒体路径，并写出一份 manifest，
包含 QA 计数、任务/来源计数和 SHA-256 摘要。磁盘索引限制了内存占用；`--work-dir` 指定索引的
临时存储目录。源 JSONL 保持不变。每个划分应分别合并。工具中的上下文哈希只控制合并，
不负责训练集与评估集的隔离。

此前的 G395k/V200k-QA/T400k 混合数据合并后保留 995k 条 QA；10% 的 warmup 子集保留 99.5k 条 QA。
使用 `question_mean` 可以保留这些 QA 比例。初始的四题上限并不保证 token 上限；如果某条编译后的
记录过长，可以降低题目上限，或调整媒体/序列预算。

## 两阶段训练

这些配方使用 Qwen3.5-2B、Mixer 和 FlashAttention-2，初始指向 smoke 数据，训练上限为 100 步。
请复制到新的实验中，设置数据和输出路径，完整训练时提高步数上限。各阶段之间保持 head 维度、
视频帧采样和媒体预算一致。

```bash
# 从公开的 Qwen backbone 出发，只预热决策头。
VALEN_GPUS=8 bash scripts/train/launch.sh \
  configs/train/qwen/sft_shared_state_warmup.json

# Mixer + 语言 LoRA + 视觉 merger，从上一步的 warmup 初始化。
VALEN_GPUS=8 bash scripts/train/launch.sh \
  configs/train/qwen/sft_shared_state_joint.json \
  --initialize output/qwen-shared-state/warmup/latest

python -m valen.evaluate --checkpoint output/qwen-shared-state/joint/latest \
  --data data/smoke/train.jsonl --output output/qwen-shared-state/evaluation
```

推理和评估从 checkpoint 配置中恢复执行模式。省略模式与显式指定 `question` 归一化后完全相同，
因此旧 checkpoint 可以继续恢复训练。`--resume` 要求执行模式和 loss reduction 都不变；
修改其中任何一个时，应使用 `--initialize` 并指定新的输出目录。从 warmup 初始化 joint 时，
保持同一种共享 state 输入格式。

## 验证

```bash
python -m pytest -q tests/qwen/test_shared_state.py \
  tests/common/test_group_questions.py tests/integration/test_sft_training.py

# 在单张 CUDA GPU 上用真实的预训练 2B 模型做集成检查。
python scripts/smoke/qwen/gpu_smoke.py \
  --config configs/train/qwen/sft_shared_state_joint.json \
  --output artifacts/qwen-shared-state-smoke
```

CPU 测试检查以下内容：四种头在一次前向/反向下的梯度、部分标签时的输入一致性、
题目数不等时的 batch 加权、带缓存的 RLCD、checkpoint 恢复，以及包含 DeltaNet、full attention
和合成视频 patch 的微型真实 Qwen3.5。GPU 命令检查预训练模型加载、联合训练梯度、保存/恢复、
阶段间初始化、RLCD 和所配置的注意力后端。这些检查不衡量独立验证集上的任务质量，
也不衡量吞吐提升。
