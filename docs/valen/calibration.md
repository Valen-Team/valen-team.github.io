---
title: Calibrate and automate
description: Use measured results to choose what Valen routes automatically and what needs review.
---

# Let Valen route the clear cases

Valen returns probabilities over your candidate intents. Use them to route qualifying tickets automatically and send the rest for human review.

[Try a ticket in the browser →](/?example=ticket)

## See how much work it can take on

In a retrospective replay of BANKING77 predictions, Valen 0.8B accepted **147 of 1,276 test questions** using a rule selected before the test. **One accepted answer was wrong**: **11.5% automated coverage** with **0.68% accepted error**.

This is an English benchmark with 77 candidate intents. Explore the [released-model evidence](/docs/valen/reliability/) to compare models and validation targets, inspect accepted counts and errors, and check the study's scope.

## Choose the scope using your own data

Calibration uses labeled examples from your workflow to check and adjust the reported probabilities. The tools report automated coverage, errors and review volume, helping you decide whether to integrate Valen.

Fitting calibration parameters requires no model retraining. Save the parameters and routing policy for the same model and runtime configuration, and decide whether to adopt them using your independent test results.

[Run the complete ticket-routing example →](/cookbook/calibrated-routing/)

The example includes the data format, calibration commands and routing code. It returns `automatic` or `human_review` for integration with your existing queues.
