---
title: Call the Valen API
sidebar_label: API quickstart
description: Send a structured decision request to a hosted Valen model.
---

# Call the Valen API

The [API cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart.ipynb) documents hosted access to `valen-preview-0923`, `valen-0-8b`, `valen-2b`, and `valen-4b`.

## Send your first request

Install `requests` in your Python environment:

```bash
python -m pip install requests
```

This example follows the endpoint and request schema in the published cookbook:

```python
import requests

response = requests.post(
    "https://llm-proxy.openxxlab.com/v1/decisions",
    json={
        "model": "valen-2b",
        "input": "A cat is sitting on the sofa.",
        "questions": [{
            "name": "animal",
            "type": "choice",
            "instructions": "Which animal is present?",
            "choices": [
                {"value": "cat", "description": "A cat"},
                {"value": "dog", "description": "A dog"},
            ],
        }],
        "temperature": 1.0,
    },
    timeout=120,
)
response.raise_for_status()
print(response.json()["answers"][0])
```

Use the [published notebook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart.ipynb) for the current endpoint and full examples.

## API schema and local schema

The hosted API uses `input`, a list of `questions`, and `choices` entries with `value` and `description`. The local Hugging Face interface uses `state`, a question mapping, and `criteria`.

Use the schema for the interface you are calling.

## Image inputs

The cookbook represents an image as a JPEG data URL in a user message:

```python
import base64

image_url = "data:image/jpeg;base64," + base64.b64encode(
    image_bytes
).decode("ascii")

state = [{
    "role": "user",
    "content": [
        {"type": "input_text", "text": "Answer using only the visible image."},
        {"type": "input_image", "image_url": image_url},
    ],
}]
```

Pass this message list as `input` together with the question. The cookbook also includes video preparation and several evaluation cases.

[Open the API cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart.ipynb) · [Run locally](/docs/valen/quickstart/)

