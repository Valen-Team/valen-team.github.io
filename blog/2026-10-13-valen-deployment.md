---
slug: valen-deployment
title: "More ways to run Valen: API, ONNX, and GGUF"
description: "New deployment formats and an API cookbook bring Valen decisions into more applications."
authors: [valen]
tags: [release, models]
---

Valen now offers additional deployment formats and documented API access.

ONNX and GGUF releases are available through the Valen Team Hugging Face organization. The API cookbook includes examples for the preview checkpoint and the 0.8B, 2B, and 4B models.

<!-- truncate -->

## Use a hosted model

The [API cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart.ipynb) contains executable examples with input previews and saved outputs. Start with the [API quickstart](/docs/valen/api/) for the request schema.

## Run an exported model

The published exports include a `FORMAT_USAGE.md` guide and a dedicated `valen_formats.py` inference entry point.

ONNX uses ONNX Runtime for the visual backbone, language backbone, and Mixer. GGUF retains the original tensor precision and uses a custom `valen_qwen` architecture, so use the accompanying Valen inference entry point.

[Browse released models and formats](https://huggingface.co/Valen-Team)

## Export from source

The repository includes tools to export and verify formats, and to check agreement on text, image, and video inputs across execution modes.

[Read the export guide](https://github.com/Valen-Team/Valen/blob/main/scripts/README.md)

Source: [Valen release notes](https://github.com/Valen-Team/Valen#news).

