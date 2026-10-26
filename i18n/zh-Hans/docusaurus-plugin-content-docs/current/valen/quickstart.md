---
mdx:
  format: mdx
title: Transformers 本地推理
sidebar_label: Transformers 推理
description: 安装依赖并使用两种协议运行 Valen。
---

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

## 最短调用

模型加载后，用一个判断题检查推理通路：

```python
result = model.predict({
    "input": "A cat is on the sofa.",
    "questions": [{"name": "cat", "type": "predicate", "instructions": "A cat is present."}],
}, execution="shared_state", temperature=1.0)
print(result["answers"][0]["probability"])
```

## 输入与参数

- `shared_state`：问题与候选共享一个序列。
- `question`：分别执行问题或分支。
- `temperature` 默认 `1.0`，须为有限正数，用于缩放候选 logits；请求体中的值优先于关键字参数。
- 原版模型可读取本地图片/视频路径；相对路径基于 `media_root`，默认为当前目录。
- 单 GPU HTTP 插件的图片与视频能力不等同于原版 Python 模型，见后端能力表。

[完整文本、图片、直接视频与双协议教程](/zh-Hans/cookbook/local-inference/) · [API](/zh-Hans/docs/valen/api/) · [ONNX / SDK](/zh-Hans/docs/valen/onnx/) · [SGLang](/zh-Hans/docs/valen/sglang/) · [vLLM](/zh-Hans/docs/valen/vllm/) · [验证范围](/zh-Hans/cookbook/validation/)
