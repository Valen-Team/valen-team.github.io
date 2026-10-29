---
mdx:
  format: mdx
title: System One
sidebar_label: POST System One
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import RequestExample from '@site/src/components/modern/RequestExample';

# System One

Send text or images to the hosted API and ask predicate, choice, or score questions. The API returns results and associated probabilities for each question. For video, extract frames first and submit them as image inputs.

```text
POST /v1/systemone
```

[Base URLs and authentication](../api.md)

## Quick request

Install `requests` in the client environment to run the Python example, or switch to cURL.

<RequestExample protocol="systemone" />

## Headers

| Field | Description |
|---|---|
| `Content-Type` | Required: `application/json` |
| `Origin` | Browsers send this automatically; the free API uses an allowlist for browser origins. Non-browser clients may omit it. |
| `Authorization` | Required on the keyed endpoint: `Bearer $VALEN_API_KEY` |
| `TypeSafe-Danger-Zone-Images` | Required for images: `true` |

## Body

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | string | Yes | Hosted model ID, such as `valen-2b`; see [List Models](./list-models.md). |
| `state` | string / object | Yes | Shared evidence for all questions: text, or a JSON object with named fields that questions can reference by path, such as `message`. |
| `questions` | object | Yes | Questions keyed by ID. |
| `temperature` | number | No | Valen calibration extension; finite and positive, defaults to `1.0`. |
| `assets` | object | No | Image assets keyed by reference; see Images below. |

Instructions must be nonempty text. The upstream API validates requests.

## Question types

<Tabs groupId="systemone-question-type">
<TabItem value="noul" label="noul" default>

Return the probability, from 0 to 1, that a condition holds. Optional `criteria` describes both cases concretely: `{"true": "...", "false": "..."}`.

Request:

```json
{
  "model": "valen-2b",
  "temperature": 1.0,
  "state": "A cat is on the sofa.",
  "questions": {
    "q0": {
      "type": "noul",
      "instructions": "The cat is on the sofa.",
      "criteria": {
        "true": "A cat is sitting or lying on the sofa",
        "false": "The sofa is empty, or the cat is somewhere else"
      }
    }
  }
}
```

Example answer:

```json
{
  "answers": {
    "q0": {
      "type": "noul",
      "noul": 0.98
    }
  }
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
  "state": "A cat is on the sofa.",
  "questions": {
    "q0": {
      "type": "choice",
      "instructions": "Which animal is present?",
      "criteria": {
        "cat": "A cat",
        "dog": "A dog"
      }
    }
  }
}
```

Example answer:

```json
{
  "answers": {
    "q0": {
      "type": "choice",
      "choice": "cat",
      "probabilities": {
        "cat": 0.9,
        "dog": 0.1
      },
      "confidence": 0.8
    }
  }
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
  "state": "A cat is on the sofa.",
  "questions": {
    "q0": {
      "type": "score",
      "instructions": "How clearly is the animal identified?",
      "criteria": [
        "Unclear",
        "Partially clear",
        "Clear"
      ]
    }
  }
}
```

Example answer:

```json
{
  "answers": {
    "q0": {
      "type": "score",
      "score": 1.5,
      "probabilities": {
        "0": 0.1,
        "1": 0.3,
        "2": 0.6
      },
      "legend": {
        "0": "Unclear",
        "1": "Partially clear",
        "2": "Clear"
      },
      "confidence": 0.25
    }
  }
}
```

</TabItem>
</Tabs>

## Response

Successful requests return HTTP 200 with a JSON response body.

| Field | Type | Description |
|---|---|---|
| `model` | string | Model that answered the request. |
| `answers` | object | Answers keyed by question ID. |
| `usage` | object | `input_tokens` and `output_tokens`. |

`confidence` is separate from the maximum candidate probability. Responses may also include `model_id`, `revision`, `internal_usage`, `timing`, and `images`.

## Images

This example encodes a local PNG, JPEG, or WebP image and sends the request. Replace `image.png` with your file; its MIME type is inferred from the filename. Images are provided through `assets` and referenced in `state`.

<RequestExample protocol="systemone" image />

## Limits

The hosted endpoints accept, per request:

| Item | Limit |
| --- | --- |
| Images | 1 |
| Questions | 8 |
| Candidates per question | 16 |
| Characters per candidate description | 300 |
| Characters of instructions | 2,000 |

A request over a limit returns HTTP 400 with the limit in `detail`. For video, send one frame per request and combine the answers in code; for more questions, send another request with the same evidence. Local deployments set their own limits, for example `VALEN_MAX_IMAGES`.

## Errors

| Status | Description |
|---|---|
| `400` | Request rejected by the upstream API. |
| `422` | Upstream field validation failed; `detail` is an error list. |
| `429` | Rate limit exceeded; retry later. |

Protocol reference: [TypeSafe System One](https://docs.typesafe.ai/api/system-one).
