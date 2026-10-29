---
title: API calls
sidebar_label: API calls
---

# API calls

Hosted APIs and local deployments support two protocols:

| Protocol | Method | Path | Documentation |
|---|---|---|---|
| System One | POST | `/v1/systemone` | [API reference](./api/systemone.md) |
| Decisions | POST | `/v1/decisions` | [API reference](./api/decisions.md) |

The hosted service also exposes a model list endpoint:

| Endpoint | Method | Path | Documentation |
|---|---|---|---|
| List Models | GET | `/v1/models` | [API reference](./api/list-models.md) |

The machine-readable [OpenAPI spec](pathname:///openapi.json) describes all three endpoints.

For details on training, data uses, and retention, see [API data handling and retention](./api/data-handling.md).

## Base URLs

| Access | Base URL | Headers |
|---|---|---|
| Free API | `https://api.valen-team.workers.dev` | No key required |
| API key | `https://llm-proxy.openxxlab.com` | `Authorization: Bearer $VALEN_API_KEY` |

For an API key or higher quotas, contact [liuziyu77@sjtu.edu.cn](mailto:liuziyu77@sjtu.edu.cn).

For local model names and image input formats, see: [SGLang](./sglang.md) · [vLLM](./vllm.md) · [Transformers](./quickstart.md).

To have a coding agent build the integration, install the [Valen agent skill](./agent-skill.md).

For in-app integration, see [ONNX & SDKs](./onnx.md), including the Python local ONNX service and Python / JavaScript HTTP clients.
