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

向托管 API 提供文本或图片，并提出判断、选择或评分问题。接口返回每个问题的结果及对应概率。视频可先提取画面帧，再作为图片输入。

```text
POST /v1/systemone
```

[服务地址与认证](../api.md)

## 快速调用

客户端安装 `requests` 后，可直接运行 Python 示例；也可切换为 cURL。

<RequestExample protocol="systemone" />

## 请求头

| 字段 | 说明 |
|---|---|
| `Content-Type` | 必填，`application/json` |
| `Origin` | 浏览器自动携带；免费 API 对浏览器来源使用允许列表。非浏览器客户端可省略。 |
| `Authorization` | Key 入口必填，`Bearer $VALEN_API_KEY` |
| `TypeSafe-Danger-Zone-Images` | 图片请求必填，`true` |

## 请求体

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 托管模型 ID，例如 `valen-2b`；见 [List Models](./list-models.md)。 |
| `state` | string / object | 是 | 所有问题共享的上下文：文本，或带命名字段的 JSON 对象，问题中可以按路径引用，例如 `message`。 |
| `questions` | object | 是 | 按问题 ID 索引的映射。 |
| `temperature` | number | 否 | Valen 校准扩展；有限正数，默认 `1.0`。 |
| `assets` | object | 否 | 按引用名索引的图片资源，见下方图片输入。 |

问题指令为非空字符串。请求校验由上游 API 执行。

## 问题类型

<Tabs groupId="systemone-question-type">
<TabItem value="noul" label="noul" default>

判断条件是否成立，返回 0–1 之间的概率。可选的 `criteria` 用具体情形描述两种情况：`{"true": "...", "false": "..."}`。

请求：

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

答案示例：

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

从候选项中选择一个值，并返回候选概率分布。

请求：

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

答案示例：

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

按从低到高的等级评分。`score` 是零起始等级索引的概率加权平均值，三档范围为 0–2。

请求：

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

答案示例：

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

## 响应

请求成功时返回 HTTP 200，响应内容为 JSON。

| 字段 | 类型 | 说明 |
|---|---|---|
| `model` | string | 是 | 托管模型 ID，例如 `valen-2b`；见 [List Models](./list-models.md)。 |
| `answers` | object | 按问题 ID 索引的答案。 |
| `usage` | object | `input_tokens` 和 `output_tokens`。 |

`confidence` 是独立置信度，不等于最大候选概率。响应还可能包含 `model_id`、`revision`、`internal_usage`、`timing` 和 `images`。

## 图片输入

示例读取本地 PNG、JPEG 或 WebP 图片并完成编码和请求。将 `image.png` 替换为你的文件，MIME 类型会根据文件名自动识别。图片通过 `assets` 提供，并在 `state` 中引用。

<RequestExample protocol="systemone" image />

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
| `422` | 上游字段校验失败，`detail` 为错误列表。 |
| `429` | 触发限流，请稍后重试。 |

协议参考：[TypeSafe System One](https://docs.typesafe.ai/api/system-one).
