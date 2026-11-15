---
title: "QwenClawBench final leaderboard"
---

# QwenClawBench final leaderboard

The published rows below are from the
[QwenClawBench leaderboard](https://skylenage-ai.github.io/QwenClawBench-Leaderboard/).
The GLM-5.2 and DeepSeek V4 Flash rows are the final strict results from this
evaluation, with invalid samples counted as zero.

| Reference position | Model | Score | Auto | LLM |
| ---: | --- | ---: | ---: | ---: |
| 1 | Claude Sonnet 4.6 | 60.5 | 74.5 | 73.4 |
| 2 | Claude Opus 4.6 | 59.5 | 75.8 | 72.1 |
| reference projection 3 | **GLM-5.2 (this evaluation)** | **59.26** | **72.50** | **69.10** |
| 3 | GLM-5.1 | 58.7 | 74.6 | 70.9 |
| 4 | Qwen3.6-Plus | 57.4 | 74.7 | 69.0 |
| 5 | GPT-5.4high | 56.7 | 71.5 | 72.9 |
| 6 | MiMo-V2-Pro | 56.5 | 73.0 | 69.1 |
| 7 | Claude Opus 4.5high | 56.1 | 75.1 | 70.7 |
| 8 | GLM-5 | 54.9 | 72.9 | 66.7 |
| 9 | Qwen3.5-Plus | 53.0 | 71.0 | 65.8 |
| 10 | Kimi-K2.5 | 51.9 | 69.5 | 62.6 |
| 11 | DeepSeek-V3.2-Thinking | 50.7 | 71.2 | 62.4 |
| 12 | MiniMax-M2.7high | 50.5 | 70.6 | 65.1 |
| below published rows | **DeepSeek V4 Flash (this evaluation)** | **46.52** | **60.99** | **55.84** |

## Evaluated results

Each evaluated model covers 100 tasks with three OpenClaw rollouts per task.
Invalid samples count as zero.

| Model | Samples | Valid samples | Completion rate | Score | Auto | LLM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `glm-5.2` | 300 | 282 | 94.00% | **59.2645** | **72.4988** | **69.0950** |
| `bailian/deepseek-v4-flash` | 300 | 245 | 81.67% | **46.5202** | **60.9912** | **55.8392** |

## Published-score comparison

| Evaluated model | Published reference | Score delta | Auto delta | LLM delta |
| --- | --- | ---: | ---: | ---: |
| `glm-5.2` | GLM-5.1 | **+0.56** | -2.10 | -1.81 |
| `glm-5.2` | GLM-5 | **+4.36** | -0.40 | +2.40 |
| `bailian/deepseek-v4-flash` | DeepSeek-V3.2-Thinking | **-4.18** | -10.21 | -6.56 |

The two evaluated models are reference projections rather than official
rankings. The official leaderboard uses Claude as judge; this evaluation
uses GLM-5.2. The model, harness, endpoint, and service versions also differ.
