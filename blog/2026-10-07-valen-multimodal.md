---
slug: valen-multimodal
title: "Valen 0.8B, 2B, and 4B — now with vision"
description: "Open multimodal decision models and VisualDecisionBench for image and video evaluation."
authors: [valen]
tags: [models, data, release]
---

We are releasing Valen in three sizes — **0.8B, 2B, and 4B** — with support for text, images, and video.

Alongside the models, we are releasing **VisualDecisionBench**, a benchmark for decisions grounded in images and video.

<!-- truncate -->

## A structured decision interface

Valen evaluates a shared state against task instructions and returns probabilities over supplied candidates. It supports Choice, Noul, and Score questions, giving software a structured interface to model decisions.

The repository includes model implementation, data processing, inference and evaluation commands, and SFT and experimental RLCD training support.

## Models

| Size | Download |
| --- | --- |
| 0.8B | [Valen-0.8B](https://huggingface.co/Valen-Team/Valen-0.8B) |
| 2B | [Valen-2B](https://huggingface.co/Valen-Team/Valen-2B) |
| 4B | [Valen-4B](https://huggingface.co/Valen-Team/Valen-4B) |

## VisualDecisionBench

The full released evaluation set contains 1,696 shared states and 9,143 questions, split into 2,000 image questions and 7,143 video questions.

[Explore the benchmark](/benchmarks/) · [Download the dataset](https://huggingface.co/datasets/Valen-Team/VisualDecisionBench)

## Start building

[Run Valen locally](/docs/valen/quickstart/) or explore the [source repository](https://github.com/Valen-Team/Valen).

Source: [Valen release notes](https://github.com/Valen-Team/Valen#news).

