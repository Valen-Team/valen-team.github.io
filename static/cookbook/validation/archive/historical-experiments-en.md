---
title: Historical experiments
---

These are historical Base/Sokoban experiments, not results for current released Mixer models. Training loss is not independent test quality.

## Full experiments

In the tables, `Valen-Base-*` are general-task models and `Valen-Sokoban-*` are Sokoban models; RLCD is this repository's reinforcement-learning training method. Each group of experiments uses checkpoints trained on its own task.

### Model Card

We ran ablations over the training method and the training data:

| Model | Training method | Data | Dataset |
| --- | --- | --- | --- |
| Valen-Base-SFT-0.8B | SFT | General SFT 100k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) |
| Valen-Base-SFT-2B | SFT | General SFT 100k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) |
| Valen-Base-RLCD-0.8B | SFT + RLCD | General SFT 70k + General RLCD 30k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) |
| Valen-Base-RLCD-2B | SFT + RLCD | General SFT 70k + General RLCD 30k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k) |
| Valen-Sokoban-SFT-2B | SFT + SFT | General SFT 100k + Sokoban SFT 30k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k)&nbsp;[![Sokoban](https://img.shields.io/badge/Sokoban-8A63B8?style=flat&logo=huggingface&logoColor=FFD21E)](https://huggingface.co/datasets/Valen-Team/Valen-Eval-Game) |
| Valen-Sokoban-RLCD-2B | SFT + RLCD | General SFT 100k + Sokoban RLCD 30k | [![General 100k](https://img.shields.io/badge/General-100k-2185B5?style=flat&logo=huggingface&logoColor=FFD21E&labelColor=555555)](https://huggingface.co/datasets/Valen-Team/Valen-Training-General-100k)&nbsp;[![Sokoban](https://img.shields.io/badge/Sokoban-8A63B8?style=flat&logo=huggingface&logoColor=FFD21E)](https://huggingface.co/datasets/Valen-Team/Valen-Eval-Game) |

The Sokoban training and evaluation sets are both included in [Valen-Eval-Game](https://huggingface.co/datasets/Valen-Team/Valen-Eval-Game); training and evaluation each use their own split.

#### Training Loss

<p align="center">
  <a href="https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/figures/training/sft100k_loss.png"><img src="https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/figures/training/sft100k_loss.png" alt="Training loss curves of Valen-Base-SFT-0.8B and 2B on the General 100k data." width="1000"></a><br>
  <sub>General SFT: training loss of 0.8B and 2B.</sub>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/figures/training/sokoban_rlcd_loss_reward.png"><img src="https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/figures/training/sokoban_rlcd_loss_reward.png" alt="Loss and mean reward of the Valen-Sokoban-RLCD 0.8B and 2B models during training." width="1000"></a><br>
  <sub>Sokoban RLCD: training loss and reward of 0.8B and 2B.</sub>
</p>
