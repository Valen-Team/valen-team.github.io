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

向托管 API 提供文本或图片，并提出判断、选择或评分问题。接口返回每个问题的结果及对应概率。视频可先提取画面帧，再作为图片输入。

```text
POST /v1/decisions
```

[服务地址与认证](../api.md)

## 快速调用

客户端安装 `requests` 后，可直接运行 Python 示例；也可切换为 cURL。

<RequestExample protocol="decisions" />

## 请求头

| 字段 | 说明 |
|---|---|
| `Content-Type` | 必填，`application/json` |
| `Origin` | 浏览器自动携带；免费 API 对浏览器来源使用允许列表。非浏览器客户端可省略。 |
| `Authorization` | Key 入口必填，`Bearer $VALEN_API_KEY` |

## 请求体

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 托管模型 ID，例如 `valen-2b`；见 [List Models](./list-models.md)。 |
| `input` | string / messages[] | 是 | 所有问题共享的上下文。 |
| `questions` | object[] | 是 | 问题列表，每项含 `name`、`type` 和 `instructions`。 |
| `temperature` | number | 否 | Valen 校准扩展；有限正数，默认 `1.0`。 |

问题指令为非空字符串。请求校验由上游 API 执行。

## 问题类型

<Tabs groupId="decisions-question-type">
<TabItem value="predicate" label="predicate" default>

判断条件是否成立，返回 0–1 之间的概率。

请求：

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

答案示例：

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

从候选项中选择一个值，并返回候选概率分布。

请求：

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

答案示例：

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

按从低到高的等级评分。`score` 是零起始等级索引的概率加权平均值，三档范围为 0–2。

请求：

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

答案示例：

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

## 响应

请求成功时返回 HTTP 200，响应内容为 JSON。

| 字段 | 类型 | 说明 |
|---|---|---|
| `model` | string | 是 | 托管模型 ID，例如 `valen-2b`；见 [List Models](./list-models.md)。 |
| `answers` | object[] | 按请求顺序返回，包含对应的 `name`。 |
| `usage` | object | `input_tokens` 和 `output_tokens`。 |

`confidence` 是独立置信度，不等于最大候选概率。响应还可能包含 `model_id`、`revision`、`internal_usage`、`timing` 和 `images`。

## 图片输入

示例读取本地 PNG、JPEG 或 WebP 图片并完成编码和请求。将 `image.png` 替换为你的文件，MIME 类型会根据文件名自动识别。图片通过 `input_image` 内容块提供。

<RequestExample protocol="decisions" image />

## 限制

托管接口对每个请求的限制：

| 项目 | 上限 |
| --- | --- |
| 图片 | 1 张 |
| 问题 | 8 个 |
| 每个问题的候选项 | 16 个 |
| 每条候选描述 | 300 字符 |
| 问题指令 | 2,000 字符 |

超出限制会返回 HTTP 400，`detail` 中写明具体限制。视频请每个请求发送一帧，在代码里合并回答；问题更多时，用相同的证据再发一个请求。本地部署可自行设置上限，例如 `VALEN_MAX_IMAGES`。

## 错误

| 状态 | 说明 |
|---|---|
| `400` | 上游拒绝请求。 |
| `429` | 触发限流，请稍后重试。 |

协议参考：[OpenAI Decisions](https://developers.openai.com/api/docs/guides/decisions).
