---
title: 历史实验记录
---

以下为旧版 Base/Sokoban 实验，不代表当前发布 Mixer 模型。训练 loss 不是独立测试效果。

## 完整实验

表中的 `Valen-Base-*` 为通用任务模型，`Valen-Sokoban-*` 为推箱子任务模型；RLCD 为本仓库的强化学习训练方法。两组实验使用各自任务训练后的 checkpoint。

### Model Card

我们对模型的训练方法，训练数据进行了消融实验：

| 模型 | 训练方法 | 数据 | 数据集 |
| --- | --- | --- | --- |
| Valen-Base-SFT-0.8B | SFT | General SFT 100k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) |
| Valen-Base-SFT-2B | SFT | General SFT 100k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) |
| Valen-Base-RLCD-0.8B | SFT + RLCD | General SFT 70k + General RLCD 30k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) |
| Valen-Base-RLCD-2B | SFT + RLCD | General SFT 70k + General RLCD 30k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) |
| Valen-Sokoban-SFT-2B | SFT + SFT | General SFT 100k + Sokoban SFT 30k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k)&nbsp;[![Sokoban](https://img.shields.io/badge/Sokoban-8A63B8?style=flat&logo=huggingface&logoColor=FFD21E)](https://huggingface.co/datasets/Valen-Team/Valen-Eval-Game) |
| Valen-Sokoban-RLCD-2B | SFT + RLCD | General SFT 100k + Sokoban RLCD 30k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k)&nbsp;[![Sokoban](https://img.shields.io/badge/Sokoban-8A63B8?style=flat&logo=huggingface&logoColor=FFD21E)](https://huggingface.co/datasets/Valen-Team/Valen-Eval-Game) |

Sokoban 的训练集和评测集均包含在 [Valen-Eval-Game](https://huggingface.co/datasets/Valen-Team/Valen-Eval-Game) 中，训练与评测分别使用对应划分。

#### Training Loss

<p align="center">
  <a href="https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/figures/training/sft100k_loss.png"><img src="https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/figures/training/sft100k_loss.png" alt="Valen-Base-SFT-0.8B 和 2B 在 General 100k 数据上的训练损失曲线。" width="1000"></a><br>
  <sub>General SFT：0.8B 与 2B 的训练 loss。</sub>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/figures/training/sokoban_rlcd_loss_reward.png"><img src="https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/figures/training/sokoban_rlcd_loss_reward.png" alt="Valen-Sokoban-RLCD 的 0.8B 和 2B 模型在训练过程中的 loss 与平均 reward。" width="1000"></a><br>
  <sub>Sokoban RLCD：0.8B 与 2B 的训练 loss 和 reward。</sub>
</p>
