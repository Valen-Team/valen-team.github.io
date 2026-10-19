---
title: 调用 Valen API
sidebar_label: API 入门
description: 向托管的 Valen 模型发送结构化决策请求。
---

# 调用 Valen API

[API Cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart_zh.ipynb) 提供 `valen-preview-0923`、`valen-0-8b`、`valen-2b` 和 `valen-4b` 的托管调用示例。

## 发送第一个请求

在当前 Python 环境安装 `requests`：

```bash
python -m pip install requests
```

以下示例使用已发布 Cookbook 中的服务地址和请求结构：

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

最新服务地址和完整示例以[发布的 Notebook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart_zh.ipynb) 为准。

## API 与本地接口的数据结构

托管 API 使用 `input`、`questions` 列表，以及包含 `value` 和 `description` 的 `choices`。本地 Hugging Face 接口使用 `state`、问题映射和 `criteria`。请按照所调用接口的结构构造请求。

## 图片输入

Cookbook 将图片编码为 JPEG data URL，放入用户消息：

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

将消息列表作为 `input`，连同问题一起传入。Cookbook 还提供了视频准备方式与多个完整评测示例。

[打开 API Cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart_zh.ipynb) · [在本地运行](/zh-Hans/docs/valen/quickstart/)

