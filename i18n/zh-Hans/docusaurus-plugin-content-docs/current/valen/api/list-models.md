---
mdx:
  format: mdx
title: List Models
sidebar_label: GET List Models
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# List Models

列出托管服务中的模型。将返回的 `id` 用作推理请求的 `model` 字段。

```text
GET /v1/models
```

[服务地址与认证](../api.md)。免费 API 无需 Key；使用带 Key 的入口时，添加 `Authorization: Bearer $VALEN_API_KEY`。

## 调用示例

此接口无需请求体。运行 Python 示例前，在客户端安装 `requests`。

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

## 响应

成功时返回 HTTP 200。以下示例只展示列表中的一个模型：

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `object` | string | 列表类型：`list`。 |
| `data` | object[] | 模型列表。 |
| `data[].id` | string | 模型标识，用于请求中的 `model` 字段。 |
| `data[].object` | string | 条目类型：`model`。 |
| `data[].created` | integer | 上游提供的创建时间，Unix 时间戳，单位为秒。 |

从 `data[].id` 读取模型名，例如 `valen-0.8b`、`valen-2b` 和 `valen-4b`。

## 使用模型

将选定的 Valen 模型 ID 填入 [System One](./systemone.md) 或 [Decisions](./decisions.md) 请求的 `model` 字段，例如 `"model": "valen-2b"`。
