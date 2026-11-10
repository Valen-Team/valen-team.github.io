---
title: Bbox questions
sidebar_label: Bbox questions
description: Ask Valen-Decision-1.5 where something is in an image and get a box back.
---

# Bbox questions

A `bbox` question asks where something is in an image. Valen-Decision-1.5 answers with a box, its centre point and a confidence, in the same forward pass as the predicate, choice and score questions about the same input.

Ask bbox questions through [Transformers](./quickstart.md) with the native Valen-Decision-1.5 weights, in any of the five sizes, or through the Python and JavaScript SDKs with a Valen-Decision-1.5 ONNX bundle: see [bbox questions in the SDKs](./onnx.md#bbox-questions). The hosted API answers predicate, choice and score questions.

## Request

Load the model as in [Transformers local inference](./quickstart.md#load-a-model) and download the example image:

```bash
curl -fL https://valen-team.github.io/cookbook/code/media/mug-counter.jpg -o mug-counter.jpg
```

Add questions of type `bbox`. They can sit next to other question types in one request.

```python
result = model.predict({
    "input": [{"role": "user", "content": [
        {"type": "input_image", "image_url": "mug-counter.jpg"},
    ]}],
    "questions": [
        {"name": "mug", "type": "bbox", "instructions": "The blue mug.", "image": 0},
        {"name": "sponge", "type": "bbox", "instructions": "The sponge."},
        {"name": "box", "type": "bbox", "instructions": "The white box."},
        {"name": "rack", "type": "bbox", "instructions": "The dish rack."},
        {"name": "full", "type": "predicate", "instructions": "The mug has coffee in it."},
    ],
})
for answer in result["answers"]:
    print(answer)
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | string | Yes | `bbox` |
| `instructions` | string | Yes | What to locate, as nonempty text. |
| `image` | integer | No | Zero-based index of the image to search, in the order images appear in the input. Defaults to `0`. |
| `name` | string | Yes in Decisions | Echoed in the answer. SystemOne uses the question key instead. |

A bbox question has no candidates: the image tokens are the candidates.

## Answer

Output of the request above from Valen-Decision-1.5-0.8B:

```json
{
  "model": "Valen",
  "answers": [
    {"name": "mug", "type": "bbox", "bbox": [0.2533, 0.3112, 0.8276, 0.8263], "point": [0.5404, 0.5687], "confidence": 0.9467},
    {"name": "sponge", "type": "bbox", "bbox": [0.0, 0.5077, 0.1936, 0.7243], "point": [0.0968, 0.616], "confidence": 0.9226},
    {"name": "box", "type": "bbox", "bbox": [0.6213, 0.0, 0.9816, 0.3704], "point": [0.8014, 0.1852], "confidence": 0.8785},
    {"name": "rack", "type": "bbox", "bbox": [0.0, 0.075, 0.3272, 0.4854], "point": [0.1636, 0.2802], "confidence": 0.8566},
    {"name": "full", "type": "predicate", "probability": 0.9847116274944776}
  ],
  "usage": {"input_tokens": 749, "output_tokens": 0},
  "internal_usage": {"compute_tokens": 749}
}
```

![The four returned boxes drawn on the example photo: the blue mug, the sponge, the white box and the dish rack](/img/bbox-mug-counter.jpg)

| Field | Type | Description |
| --- | --- | --- |
| `bbox` | number[4] | `[x1, y1, x2, y2]`, the left, top, right and bottom edges. |
| `point` | number[2] | `[x, y]`, the centre of the box. |
| `confidence` | number | From 0 to 1: the probability mass of the image tokens whose centres fall inside the box. |

Coordinates are normalized to `[0, 1]` against the original image width and height, with the origin at the top-left corner. Multiply `x` values by the image width and `y` values by the image height to get pixels: on this 768 × 768 photo the mug box is about `[195, 239, 636, 635]`.

The output was recorded on CPU in FP32 with torch 2.14.1 and transformers 5.20.2; values on a BF16 GPU differ in the last digits. Use `confidence` to decide when to accept a box.

## SystemOne

SystemOne uses the same question fields, keyed by question ID, and returns `bbox`, `point` and `confidence` under the same key.

```python
result = model.predict({
    "state": {"messages": [{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": "mug-counter.jpg"}},
    ]}]},
    "questions": {
        "mug": {"type": "bbox", "instructions": "The blue mug.", "image": 0},
        "full": {"type": "noul", "instructions": "The mug has coffee in it."},
    },
})
mug = result["answers"]["mug"]
print(mug["bbox"], mug["point"], mug["confidence"])
```

## Training targets

In training data, the target of a bbox question is a normalized box, `{"bbox": [x1, y1, x2, y2]}` with `x1 < x2` and `y1 < y2`, or a normalized point, `{"point": [x, y]}`. See the [data format](./data-format.md) for the rest of a training record and [the architecture](./architecture.md#valen-decision-15) for how the grounding head reads the image.
