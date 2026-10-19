---
slug: jevalkit-leaderboard
title: "Introducing the JevalKit Leaderboard"
description: "Compare decision models across benchmarks, explore probability metrics, and download evaluation results."
authors: [valen]
tags: [tooling, release]
---

JevalKit now has a public leaderboard for exploring and comparing decision models.

The release brings benchmark and model-size filters, model comparison, probability metrics, and downloadable results into a single place.

<!-- truncate -->

## A common evaluation workflow

JevalKit provides unified model interfaces and prepared datasets for eight Jev-related benchmark families. The published dataset collection contains ten TSV views; image and video views are subdivisions of VisualDecisionBench.

Twenty model families are registered. Registration is separate from complete evaluation coverage: the leaderboard distinguishes **complete evaluations**, **smoke tests**, and **imported predictions**.

## Explore the results

- Filter by benchmark and model size.
- Compare model results and probability metrics.
- Download the exported evaluation results.
- Inspect coverage and result provenance before comparing scores.

[Open the leaderboard](https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard)

## Run an evaluation

Use the [JevalKit quickstart](/docs/jevalkit/quickstart/) to install dependencies, download a model and dataset, and run an evaluation. The [benchmark protocols](/docs/jevalkit/benchmarks/) explain how each suite is scored.

[GitHub](https://github.com/Valen-Team/JevalKit) · [Datasets](https://huggingface.co/datasets/Valen-Team/JevalKit_Datasets)

Source: [JevalKit release notes](https://github.com/Valen-Team/JevalKit#latest-updates).

