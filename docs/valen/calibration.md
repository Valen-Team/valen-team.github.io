---
title: Calibrate and automate
description: Use measured results to choose what Valen routes automatically and what needs review.
---

# Let Valen route the clear cases

Valen returns probabilities over your candidate intents. Use them to route qualifying tickets automatically and send the rest for human review.

[Try a ticket in the browser →](/?example=ticket)

## See how much work it can take on

On the BANKING77 test split, Valen-Decision-1.5-0.8B accepted **783 of 1,276 questions** using a rule selected before the test at a 5% validation target. **27 accepted answers were wrong**: **61.4% automated coverage** with **3.45% accepted error**. Under the same target, Valen-Decision-1.5-2B accepted 881 questions (69.0%) with 20 errors (2.27%), and Valen-Decision-1.5-4B accepted 971 (76.1%) with 18 errors (1.85%).

A stricter target shrinks the automated share. At a 2% target, 2B accepted 634 questions with 5 errors (0.79%) and 4B accepted 654 with 3 errors (0.46%), while 0.8B had no qualifying rule. At a 1% target no size had a qualifying rule, so every question goes to review.

This is an English benchmark with 77 candidate intents. Explore the [released-model evidence](/docs/valen/reliability/) to compare models and validation targets, inspect accepted counts and errors, and check the study's scope.

## Choose the scope using your own data

Calibration uses labeled examples from your workflow to check and adjust the reported probabilities. The tools report automated coverage, errors and review volume, helping you decide whether to integrate Valen.

Fitting calibration parameters requires no model retraining. Save the parameters and routing policy for the same model and runtime configuration, and decide whether to adopt them using your independent test results.

[Run the complete ticket-routing example →](/cookbook/calibrated-routing/)

The example includes the data format, calibration commands and routing code. It returns `automatic` or `human_review` for integration with your existing queues.
