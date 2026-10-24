---
mdx:
  format: mdx
title: List Models
sidebar_label: GET List Models
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# List Models

List models exposed by the hosted service. Use a returned `id` as the `model` field in inference requests.

```text
GET /v1/models
```

[Base URLs and authentication](../api.md). The free API requires no key; add `Authorization: Bearer $VALEN_API_KEY` when using the keyed endpoint.

## Quick request

No request body is needed. Install `requests` in the client environment to run the Python example.

<Tabs groupId="request-language">
<TabItem value="python" label="Python" default>

```python
import requests

response = requests.get(
    "https://api.valen-team.workers.dev/v1/models",
    timeout=30,
)
response.raise_for_status()
models = response.json()["data"]
print([model["id"] for model in models if model["id"].startswith("valen-")])
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash
curl --fail-with-body https://api.valen-team.workers.dev/v1/models
```

</TabItem>
</Tabs>

## Response

Successful requests return HTTP 200. This example shows one model from the list:

```json
{
  "object": "list",
  "data": [
    {
      "id": "valen-2b",
      "object": "model",
      "created": 1792745074
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `object` | string | List type: `list`. |
| `data` | object[] | Model list. |
| `data[].id` | string | Model identifier to use in the request's `model` field. |
| `data[].object` | string | Entry type: `model`. |
| `data[].created` | integer | Upstream creation time as a Unix timestamp in seconds. |

Read model names from `data[].id`, such as `valen-0.8b`, `valen-2b`, and `valen-4b`.

## Use a model

Set the `model` field in a [System One](./systemone.md) or [Decisions](./decisions.md) request to your chosen Valen model ID, such as `"model": "valen-2b"`.
