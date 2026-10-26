---
title: Historical 0.8B training measurements
---

On 26 October 2026 a single node with 8 H200 GPUs completed head warmup (155 steps) and full joint SFT (766 steps) from **Qwen3.5-0.8B plus a newly initialized Mixer**, using 985,000 non-video states. The complete pipeline took 7,096.49 seconds (1h 58m 16s). This is not a low-cost LoRA measurement or a domain-quality result. Historical 32-H200 video training and PR #39 short-run extrapolations differ in data, hardware, grouping and kernels; no strict device speed ratio follows.

The [complete original measurement record](https://valen-team.github.io/cookbook/validation/archive/training-speed-zh-Hans.md) preserves configurations, data counts/hashes, software/kernel versions, complete timings, memory/checkpoint definitions, controlled GDR ablations, video decoder experiments, failures and cleanup/provenance. Its Chinese original is retained without discarding unique evidence. This record reports no held-out accuracy improvement.
