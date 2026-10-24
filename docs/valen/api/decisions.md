---
mdx:
  format: mdx
title: Decisions
sidebar_label: POST Decisions
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import RequestExample from '@site/src/components/modern/RequestExample';

# Decisions

Send text or images to the hosted API and ask predicate, choice, or score questions. The API returns results and associated probabilities for each question. For video, extract frames first and submit them as image inputs.

```text
POST /v1/decisions
```

[Base URLs and authentication](../api.md)

## Quick request

Install `requests` in the client environment to run the Python example, or switch to cURL.

<RequestExample protocol="decisions" />

## Headers

| Field | Description |
|---|---|
| `Content-Type` | Required: `application/json` |
| `Origin` | Optional; sent automatically by browsers. |
| `Authorization` | Required on the keyed endpoint: `Bearer $VALEN_API_KEY` |

## Body

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | string | Yes | Hosted model ID, such as `valen-2b`; see [List Models](./list-models.md). |
| `input` | string / messages[] | Yes | Shared evidence for all questions. |
| `questions` | object[] | Yes | Question list; each item has `name`, `type`, and `instructions`. |
| `temperature` | number | No | Valen calibration extension; finite and positive, defaults to `1.0`. |

Instructions must be nonempty text. The upstream API validates requests.

## Question types

<Tabs groupId="decisions-question-type">
<TabItem value="predicate" label="predicate" default>

Return the probability, from 0 to 1, that a condition holds.

Request:

```json
{
  "model": "valen-2b",
  "temperature": 1.0,
  "input": "A cat is on the sofa.",
  "questions": [
    {
      "name": "q0",
      "type": "predicate",
      "instructions": "The cat is on the sofa."
    }
  ]
}
```

Example answer:

```json
{
  "answers": [
    {
      "type": "predicate",
      "name": "q0",
      "probability": 0.98
    }
  ]
}
```

</TabItem>
<TabItem value="choice" label="choice">

Select a candidate value and return the candidate distribution.

Request:

```json
{
  "model": "valen-2b",
  "temperature": 1.0,
  "input": "A cat is on the sofa.",
  "questions": [
    {
      "name": "q0",
      "type": "choice",
      "instructions": "Which animal is present?",
      "choices": [
        {
          "value": "cat",
          "description": "A cat"
        },
        {
          "value": "dog",
          "description": "A dog"
        }
      ]
    }
  ]
}
```

Example answer:

```json
{
  "answers": [
    {
      "type": "choice",
      "name": "q0",
      "choice": "cat",
      "probabilities": [
        {
          "value": "cat",
          "probability": 0.9
        },
        {
          "value": "dog",
          "probability": 0.1
        }
      ],
      "confidence": 0.8
    }
  ]
}
```

</TabItem>
<TabItem value="score" label="score">

Rate against ordered levels. `score` is the probability-weighted average of zero-based level indices; three levels span 0–2.

Request:

```json
{
  "model": "valen-2b",
  "temperature": 1.0,
  "input": "A cat is on the sofa.",
  "questions": [
    {
      "name": "q0",
      "type": "score",
      "instructions": "How clearly is the animal identified?",
      "levels": [
        {
          "label": "0",
          "description": "Unclear"
        },
        {
          "label": "1",
          "description": "Partially clear"
        },
        {
          "label": "2",
          "description": "Clear"
        }
      ]
    }
  ]
}
```

Example answer:

```json
{
  "answers": [
    {
      "type": "score",
      "name": "q0",
      "score": 1.5,
      "probabilities": [
        {
          "label": "0",
          "value": 0,
          "probability": 0.1
        },
        {
          "label": "1",
          "value": 1,
          "probability": 0.3
        },
        {
          "label": "2",
          "value": 2,
          "probability": 0.6
        }
      ],
      "confidence": 0.25
    }
  ]
}
```

</TabItem>
</Tabs>

## Response

Successful requests return HTTP 200 with a JSON response body.

| Field | Type | Description |
|---|---|---|
| `model` | string | Model that answered the request. |
| `answers` | object[] | Answers in request order, echoing each question name. |
| `usage` | object | `input_tokens` and `output_tokens`. |

`confidence` is separate from the maximum candidate probability. Responses may also include `model_id`, `revision`, `internal_usage`, `timing`, and `images`.

## Images

This example encodes a local PNG, JPEG, or WebP image and sends the request. Replace `image.png` with your file; its MIME type is inferred from the filename. Images are sent as `input_image` content parts.

<RequestExample protocol="decisions" image />

## Errors

| Status | Description |
|---|---|
| `400` | Request rejected by the upstream API. |
| `429` | Rate limit exceeded; retry later. |

Protocol reference: [OpenAI Decisions](https://developers.openai.com/api/docs/guides/decisions).
