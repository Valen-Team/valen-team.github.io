---
title: 调用 Valen API
sidebar_label: API 入门
description: 向托管的 Valen 模型发送结构化决策请求。
---

# 调用 Valen API

[API Cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart_zh.ipynb) 提供 `valen-preview-0923`、`valen-0-8b`、`valen-2b` 和 `valen-4b` 的托管调用示例。

## 免费 API：无需 Key

我们提供免费、有限额的 API，适合体验和少量调用：

```text
POST https://api.valen-team.workers.dev/v1/decisions
```

免费入口有频率和容量限制，可用额度不作保证。遇到 HTTP 429 时请稍后重试，避免并发批量调用。支持 `valen-preview-0923`、`valen-2b`、`valen-4b` 和 `valen-0-8b`，通过 `model` 选择。当前请求限制：一次只传一个 `name: "q0"` 的问题，支持 `predicate`、`choice`、`score`；选择题传 2–8 个候选项，评分传 2–8 个有序档位，`temperature` 固定为 `1.0`。文本最多 4000 字符，问题指令最多 1000 字符，每项描述最多 300 字符；图片建议不超过 3 MB，请求体不超过 4,500,000 字节。

下面的 Python/cURL 示例无需 Key，并包含免费入口要求的 `Origin: https://valen-team.github.io` 请求头。官网演示可直接调用；其他网站的浏览器跨域访问目前不开放。Origin 不是访问凭据。

## 更高额度：邮件申请 API Key

需要批量调用或更高额度，请发邮件至 [liuziyu77@sjtu.edu.cn](mailto:liuziyu77@sjtu.edu.cn) 申请 API Key，说明用途、预计调用量以及使用的模型或输入类型。

获批后使用官方接口 `https://llm-proxy.openxxlab.com/v1/decisions`，在环境变量中保存自己的 Key：

```bash
export VALEN_API_KEY="替换为你自己的 Key"
```

将下方示例的 URL 改为官方接口，并将 `headers` 改为：

```python
import os
headers = {"Authorization": "Bearer " + os.environ["VALEN_API_KEY"]}
```

不要把个人或团队 Key 放进前端代码或公开仓库。具体额度以服务方确认的信息为准。

## 请求与响应

`questions` 是数组，`answers[i]` 对应 `questions[i]`，并返回相同的 `name`。`probabilities` 是候选项的概率分布；`confidence` 是独立置信度，不等于最高候选概率。`temperature` 是 Valen 的校准扩展。图片使用内联 data URL。

通过请求中的 `model` 字段选择模型，响应中的 `model_id` 提供模型标识。


### 原生输出类型

| `type` | 问题附加字段 | 结果字段 |
| --- | --- | --- |
| `predicate` | 无 | `probability`：条件成立的概率（0–1） |
| `choice` | `choices: [{value, description}, …]` | `choice`、`probabilities`、可选 `confidence` |
| `score` | `levels: [{label, description}, …]`，按从低到高排列 | `score`、`probabilities`、可选 `confidence` |

`score` 是从 0 开始的档位索引的概率加权平均值；五档范围为 0–4。评分分布条目包含 `label`、数值索引 `value` 和 `probability`。

```json
{"name":"q0","type":"predicate","instructions":"用户是否有购买意向？"}
```

```json
{"name":"q0","type":"score","instructions":"评估购买意向强度","levels":[{"label":"低","description":"无购买意向"},{"label":"高","description":"明确想购买"}]}
```

## 在网页中提问

[问问 Valen](/) 默认是空白输入框，支持文字、图片和视频，下面提供三个可一键载入的例子。通过输出菜单选择「选择答案」「是 / 否」或「评分」；选择答案时可以增删 2–8 个候选项，评分时可以编辑五个从低到高的档位。这三种方式分别使用原生 `choice`、`predicate`、`score` 请求。是非判断展示条件成立的返回概率，达到 50% 时显示「是」；评分直接展示返回的 `score`，五档对应 0–4 分，并展示各档位的概率分布。`confidence` 与评分独立。

网页上传支持 JPG/JPEG、PNG、WebP 图片（最大 3 MB），以及浏览器可解码的 MP4、WebM 视频（最大 20 MB）。视频在本地提取中间帧，只向模型发送处理后的 JPEG；如需判断运动或事件顺序，请参阅本地视频接口。文件扩展名相同的视频可能使用不同编码，浏览器无法解码时需要先转码。

## 发送第一个请求

在当前 Python 环境安装 `requests`：

```bash
python -m pip install requests
```

以下示例使用免费接口地址和 Cookbook 的请求结构：

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

## 视频输入：从画面做决策

首页的视频示例遵循官方 Cookbook：先读取本地 MP4，提取中间帧并编码为 JPEG，再通过 `input_image` 发送。当前示例不是直接上传 MP4，也不代表已验证托管 API 支持 `input_video`。单帧适合画面内容判断，不能判断运动过程或事件顺序；本地视频模型的数据格式见[数据格式](/docs/valen/data-format/)。

安装依赖：

```bash
python -m pip install requests "Pillow>=10" av==16.1.0
```

将官方仓库 `assets/cookbook/momos.mp4` 保存到当前目录，无需 Key 即可运行以下免费接口示例。帧提取在本地完成，只向接口发送一张 JPEG：

```python
import base64
import io
import os

import av
import requests

# 按照官方 Cookbook，提取视频中间帧。
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
                {"type": "input_text", "text": "请仅根据图片中可见的内容回答问题。"},
                {"type": "input_image", "image_url": image_url},
            ],
        }],
        "questions": [{
            "name": "q0",
            "type": "choice",
            "instructions": "左边铝箔容器里的酱料是什么颜色？",
            "choices": [
                {"value": "brown", "description": "棕色"},
                {"value": "white", "description": "白色"},
                {"value": "red", "description": "红色"},
                {"value": "orange", "description": "橙色"},
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

[打开 API Cookbook](https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart_zh.ipynb) · [在本地运行](/zh-Hans/docs/valen/quickstart/)

