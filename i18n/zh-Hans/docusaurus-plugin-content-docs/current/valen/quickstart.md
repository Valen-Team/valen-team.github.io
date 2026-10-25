---
mdx:
  format: mdx
title: Transformers 本地推理
sidebar_label: Transformers 推理
description: 安装依赖并使用两种协议运行 Valen。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# 使用 Transformers 在本地推理

在 Python 中加载 Valen，使用 SystemOne 或 Decisions 对文本、图片和视频进行判断、选择与评分。

本页使用 PyTorch 与原生 Hugging Face 权重，不需要安装 Valen SDK。需要 CPU、ONNX Runtime 或浏览器推理时，请阅读 [ONNX 与 SDK](./onnx.md)。

## 安装依赖

使用 Python 3.10+ 和支持 BF16 的 CUDA GPU：

```bash
python -m pip install torch torchvision transformers pillow av
```

## 加载模型

```python
import torch
from transformers import AutoModel

model = (
    AutoModel.from_pretrained(
        "Valen-Team/Valen-0.8B",
        trust_remote_code=True,
        dtype="auto",
        attn_implementation="sdpa",
    )
    .to("cuda")
    .eval()
)
torch.set_float32_matmul_precision("highest")
torch.backends.cudnn.allow_tf32 = False
```

将模型名替换为 `Valen-Team/Valen-2B` 或 `Valen-Team/Valen-4B`，可以切换规模。`dtype="auto"` 保留各模型的存储精度，Mixer 决策头使用 FP32。

首次加载会下载并缓存原生模型权重。已有缓存后，在 `AutoModel.from_pretrained(...)` 中加入 `local_files_only=True` 可禁止下载；也可以将模型 ID 换成本地模型目录。请使用原生 `Valen-*B` 仓库，ONNX 图由 [SDK](./onnx.md) 加载。

## 文本推理与结果读取

先运行上方加载模型的代码，再选择下面一个协议标签执行示例。两个标签表达相同任务，选择其中一种即可；图片和视频示例复用同一个已加载的 `model`。

<Tabs groupId="hf-inference-protocol">
<TabItem value="systemone" label="SystemOne" default>

```python
answer = model.predict(
    {
        "state": "A cat is sitting on the sofa.",
        "questions": {
            "animal": {
                "type": "choice",
                "instructions": "Which animal is present?",
                "criteria": {"cat": "A cat", "dog": "A dog"},
            },
            "on_sofa": {"type": "noul", "instructions": "The cat is on the sofa."},
            "clarity": {
                "type": "score",
                "instructions": "How clear is the evidence?",
                "criteria": ["Unclear", "Partly clear", "Clear"],
            },
        },
    },
    execution="shared_state",
    temperature=1.0,
)
print(answer["answers"]["animal"]["choice"])
print(answer["answers"]["animal"]["probabilities"])
print(answer["answers"]["on_sofa"]["noul"])
print(answer["answers"]["clarity"]["score"])
```

</TabItem>
<TabItem value="decisions" label="Decisions">

```python
answer = model.predict(
    {
        "input": "A cat is sitting on the sofa.",
        "questions": [
            {
                "name": "animal",
                "type": "choice",
                "instructions": "Which animal is present?",
                "choices": [
                    {"value": "cat", "description": "A cat"},
                    {"value": "dog", "description": "A dog"},
                ],
            },
            {
                "name": "on_sofa",
                "type": "predicate",
                "instructions": "The cat is on the sofa.",
            },
            {
                "name": "clarity",
                "type": "score",
                "instructions": "How clear is the evidence?",
                "levels": [
                    {"label": "0", "description": "Unclear"},
                    {"label": "1", "description": "Partly clear"},
                    {"label": "2", "description": "Clear"},
                ],
            },
        ],
    },
    execution="shared_state",
    temperature=1.0,
)
print(answer["answers"][0]["choice"])
print(answer["answers"][0]["probabilities"])
print(answer["answers"][1]["probability"])
print(answer["answers"][2]["score"])
```

</TabItem>
</Tabs>

SystemOne 的 `answers` 按问题 ID 索引；Decisions 的 `answers` 按请求顺序返回，并保留问题名。`score` 是从 0 开始的等级索引的概率加权平均值，以上三档范围为 0–2。

## 图片推理

将 `cat.jpg` 替换为本地 PNG、JPEG 或 WebP 图片。相对路径通过 `media_root` 解析，也可以使用绝对路径。

<Tabs groupId="hf-inference-protocol">
<TabItem value="systemone" label="SystemOne" default>

```python
answer = model.predict(
    {
        "state": {
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "image_url", "image_url": {"url": "cat.jpg"}}],
                }
            ]
        },
        "questions": {
            "animal": {
                "type": "choice",
                "instructions": "Which animal is present?",
                "criteria": {"cat": "A cat", "dog": "A dog"},
            }
        },
    },
    execution="shared_state",
    temperature=1.0,
    media_root=".",
)
print(answer["answers"])
```

</TabItem>
<TabItem value="decisions" label="Decisions">

```python
answer = model.predict(
    {
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_image", "image_url": "cat.jpg"}],
            }
        ],
        "questions": [
            {
                "name": "animal",
                "type": "choice",
                "instructions": "Which animal is present?",
                "choices": [
                    {"value": "cat", "description": "A cat"},
                    {"value": "dog", "description": "A dog"},
                ],
            }
        ],
    },
    execution="shared_state",
    temperature=1.0,
    media_root=".",
)
print(answer["answers"])
```

</TabItem>
</Tabs>

## 视频推理

将 `clip.mp4` 替换为本地视频。模型配置默认采样 16 帧。

<Tabs groupId="hf-inference-protocol">
<TabItem value="systemone" label="SystemOne" default>

```python
answer = model.predict(
    {
        "state": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "video_url", "video_url": {"url": "clip.mp4"}}
                    ],
                }
            ]
        },
        "questions": {
            "walking": {"type": "noul", "instructions": "A person is walking."}
        },
    },
    execution="shared_state",
    temperature=1.0,
    media_root=".",
)
print(answer["answers"])
```

</TabItem>
<TabItem value="decisions" label="Decisions">

```python
answer = model.predict(
    {
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_video", "video_url": "clip.mp4"}],
            }
        ],
        "questions": [
            {
                "name": "walking",
                "type": "predicate",
                "instructions": "A person is walking.",
            }
        ],
    },
    execution="shared_state",
    temperature=1.0,
    media_root=".",
)
print(answer["answers"])
```

</TabItem>
</Tabs>

## 执行方式与温度

- `shared_state`：多个问题和候选项共享一个序列。
- `question`：逐问题或分支执行。
- `temperature`：默认为 `1.0`，接受大于零的有限数值，用于缩放候选 logits 后计算概率。

两种协议均可通过 `model.predict(request, execution="question", temperature=0.5)` 调整。请求体中的 `temperature` 优先于同名调用参数。

真实输入预览与完整示例见[本地推理 Notebook](https://github.com/Valen-Team/Valen/blob/main/cookbook/local_inference_zh.ipynb)。

本地 HTTP 服务： [SGLang](/zh-Hans/docs/valen/sglang/) · [vLLM](/zh-Hans/docs/valen/vllm/)
