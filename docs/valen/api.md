---
title: Call the Valen API
sidebar_label: API quickstart
description: Send a structured decision request to a hosted Valen model.
---

# Call the Valen API

The [API cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart.ipynb) documents hosted access to `valen-preview-0923`, `valen-0-8b`, `valen-2b`, and `valen-4b`.

## Free API: no key

We provide a free API with limited capacity for evaluation and small requests:

```text
POST https://api.valen-team.workers.dev/v1/decisions
```

Frequency and capacity limits apply; availability is not guaranteed. Retry later on HTTP 429 and avoid concurrent batch workloads. Supported models: `valen-preview-0923`, `valen-2b`, `valen-4b`, and `valen-0-8b`, selected through `model`. Current request restrictions: one question named `q0` of type `predicate`, `choice`, or `score`; 2–8 choices or ordered score levels where applicable; and temperature `1.0`. Text is limited to 4000 characters, instructions to 1000 characters, and each choice description to 300 characters. Keep images under 3 MB and request bodies under 4,500,000 bytes.

The Python/cURL examples below require no key and include the free endpoint's required `Origin: https://valen-team.github.io` header. The website demo can call it directly; browser calls from other websites are not enabled. Origin is not an access credential.

## Higher quotas: request an API key by email

For batch workloads or higher quotas, email [liuziyu77@sjtu.edu.cn](mailto:liuziyu77@sjtu.edu.cn) to request an API key. Describe your use case, expected request volume, and model or input types.

Once approved, use `https://llm-proxy.openxxlab.com/v1/decisions` and store your own key in an environment variable:

```bash
export VALEN_API_KEY="replace-with-your-own-key"
```

Change the URL in the examples below to the official endpoint and replace `headers` with:

```python
import os
headers = {"Authorization": "Bearer " + os.environ["VALEN_API_KEY"]}
```

Never embed personal or team keys in frontend code or public repositories. Available quotas are subject to confirmation by the service operator.

## Request and response

`questions` is an array; `answers[i]` corresponds to `questions[i]` and echoes its `name`. `probabilities` contains the choice distribution. `confidence` is a separate value, not the highest choice probability. `temperature` is a Valen calibration extension. Send images as inline data URLs.

Select a model using the request’s `model` field. The response includes a `model_id` identifier.


### Native output types

| `type` | Additional question fields | Answer fields |
| --- | --- | --- |
| `predicate` | None | `probability`: probability the condition is true (0–1) |
| `choice` | `choices: [{value, description}, …]` | `choice`, `probabilities`, optional `confidence` |
| `score` | `levels: [{label, description}, …]`, ordered low to high | `score`, `probabilities`, optional `confidence` |

`score` is the probability-weighted average of level indices starting at 0; five levels span 0–4. Score distribution entries contain `label`, numeric index `value`, and `probability`.

```json
{"name":"q0","type":"predicate","instructions":"Does the user intend to buy?"}
```

```json
{"name":"q0","type":"score","instructions":"Rate purchase intent","levels":[{"label":"Low","description":"No intent to buy"},{"label":"High","description":"Explicit intent to buy"}]}
```

## Ask Valen in the browser

[Ask Valen](/) opens with an empty composer for text, images, or video, with three example cards underneath. Choose an output view: choices, Yes/No, or a rating. Add or remove 2–8 choices, or edit five ordered rating levels. These use native `choice`, `predicate`, and `score` requests respectively. Yes/No shows the returned probability that the condition is true, with Yes selected at 50% or above. Ratings display the returned score on a 0–4 scale for five levels, together with the level probability distribution. Confidence is separate from the score.

Browser uploads accept JPG/JPEG, PNG, and WebP images up to 3 MB, or browser-decodable MP4 and WebM videos up to 20 MB. Videos are processed locally into a middle-frame JPEG; video bytes are not sent to the model. Use the local video interface for motion or event ordering. A supported extension does not guarantee a supported codec; transcode files that the browser cannot decode.

## Send your first request

Install `requests` in your Python environment:

```bash
python -m pip install requests
```

This example uses the free endpoint with the cookbook request schema:

```python
import requests

response = requests.post(
    "https://api.valen-team.workers.dev/v1/decisions",
    headers={"Origin": "https://valen-team.github.io"},
    json={
        "model": "valen-2b",
        "input": "A cat is sitting on the sofa.",
        "questions": [{
            "name": "q0",
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
body = response.json()
answer = body["answers"][0]
print(answer["name"], answer["choice"])
print("Confidence:", answer["confidence"])
for entry in answer["probabilities"]:
    print(entry["value"], entry["probability"])
print("Model ID:", body.get("model_id"))
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

## Video input: decisions from a frame

The homepage video example follows the official cookbook: read a local MP4, extract its middle frame, encode it as JPEG, and send it as `input_image`. This is not an MP4 upload and does not establish hosted API support for `input_video`. A single frame supports visual questions, not motion or event ordering. For the local video model interface, see [data format](/docs/valen/data-format/).

Install the dependencies:

```bash
python -m pip install requests "Pillow>=10" av==16.1.0
```

Place `assets/cookbook/momos.mp4` from the official repository in your working directory. Run this complete example using the free endpoint without a key. Frame extraction happens locally; only one JPEG is sent to the API:

```python
import base64
import io
import os

import av
import requests

# Extract the middle frame, following the official cookbook.
video_path = "momos.mp4"
with av.open(video_path) as video:
    frame_count = sum(1 for _ in video.decode(video=0))
if frame_count == 0:
    raise ValueError("The video has no decodable frames")
with av.open(video_path) as video:
    for index, frame in enumerate(video.decode(video=0)):
        if index == frame_count // 2:
            image = frame.to_image()
            break

buffer = io.BytesIO()
image.save(buffer, format="JPEG", quality=95)
image_url = "data:image/jpeg;base64," + base64.b64encode(
    buffer.getvalue()
).decode("ascii")

response = requests.post(
    "https://api.valen-team.workers.dev/v1/decisions",
    headers={"Origin": "https://valen-team.github.io"},
    json={
        "model": "valen-2b",
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": "Answer using only the visible image."},
                {"type": "input_image", "image_url": image_url},
            ],
        }],
        "questions": [{
            "name": "q0",
            "type": "choice",
            "instructions": "What is the color of the sauce in the foil container on the left?",
            "choices": [
                {"value": "brown", "description": "Brown"},
                {"value": "white", "description": "White"},
                {"value": "red", "description": "Red"},
                {"value": "orange", "description": "Orange"},
            ],
        }],
        "temperature": 1.0,
    },
    timeout=120,
)
response.raise_for_status()
answer = response.json()["answers"][0]
print(answer["choice"], answer["confidence"])
for entry in answer["probabilities"]:
    print(entry["value"], entry["probability"])
```

[Open the API cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart.ipynb) · [Run locally](/docs/valen/quickstart/)

