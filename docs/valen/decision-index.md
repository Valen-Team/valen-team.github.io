---
title: Jev Decision Index
---

# Valen on Jev Decision Index

Jev Decision Index compares models on decision tasks. Valen-Decision-1.5-27B scores **74.66** on the public Text track and **82.91** on the public Vision track of Decision Index 0.4.1; results for all five sizes are below.

| Model | Public Text ↑ | Public Vision ↑ |
| --- | ---: | ---: |
| Valen-Decision-1.5-0.8B | 54.71 | 58.84 |
| Valen-Decision-1.5-2B | 61.89 | 70.54 |
| Valen-Decision-1.5-4B | 69.01 | 77.85 |
| Valen-Decision-1.5-9B | 70.61 | 79.93 |
| Valen-Decision-1.5-27B | **74.66** | **82.91** |

Decision Index 0.4.1 public Text and Vision tracks, evaluated with [JevalKit](/docs/jevalkit/). Scores range from 0 to 100; higher is better. They are normalized index scores, not accuracy percentages.

[Leaderboard](https://huggingface.co/spaces/multimodalart/jev-decision-index) · [Per-size metrics, scorer outputs and run manifests](https://huggingface.co/datasets/Valen-Team/Valen-Decision-Index-Results/blob/main/Valen-Decision-1.5-main16k/RESULTS.md)

## Valen-Decision-1.0

| Model | Full score ↑ | Public score ↑ |
| --- | ---: | ---: |
| Valen-0.8B | 16.55 | 20.71 |
| Valen-2B | 22.20 | 27.20 |
| Valen-4B | 37.57 | 38.54 |

Leaderboard snapshot of 22 October 2026. Full includes private tests; Public covers the public suite. [Source data](https://huggingface.co/spaces/multimodalart/jev-decision-index/blob/0b5ecaf2396891e76c13a19aa17b874b59abcc37/data/index.json)
