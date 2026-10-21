---
title: SGLang 本地推理
sidebar_label: SGLang 镜像
description: 使用公开 SGLang 镜像在本地启动 Valen 服务。
---

# 使用 SGLang 在本地推理

使用公开镜像 `ghcr.io/valen-team/sglang:valen-v0.1.0`，将 Valen 启动为本地 HTTP 服务。服务端无需克隆 Valen 源码或配置宿主机 Python 环境。

该镜像由 Valen-Team 维护，包含 Valen 原生推理支持，是独立于 SGLang 官方镜像的发行版。

## 环境要求

- Linux x86-64、显存足够的 NVIDIA GPU，以及兼容 CUDA 13 的宿主机驱动。
- 已配置 NVIDIA Container Toolkit 的 Docker，让容器能够访问 GPU。
- 拉取镜像时可访问 GHCR；首次启动下载模型时可访问 Hugging Face，或提前准备完整的模型目录。

镜像包含推理运行环境，不包含模型权重。下面的缓存挂载可以在容器重启后复用已下载的权重。

## 启动服务

```bash
docker pull ghcr.io/valen-team/sglang:valen-v0.1.0
docker run --rm --gpus device=0 --ipc=host \
  -p 127.0.0.1:30000:30000 \
  -v "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  ghcr.io/valen-team/sglang:valen-v0.1.0 \
  --model-path Valen-Team/Valen-2B --served-model-name valen \
  --host 0.0.0.0 --port 30000
```

等待模型加载完成后再发送请求。服务暴露在 `localhost:30000`；`--host 0.0.0.0` 用于监听容器内部端口。`--served-model-name valen` 为请求指定固定的模型名称。

将 `--model-path` 替换为 `Valen-Team/Valen-0.8B` 或 `Valen-Team/Valen-4B`，可以选择其他已发布规模。请为所选模型准备足够显存；原生实现的 GPU 对照验证使用的是 H200 上的 Valen-2B。

## 发送文本请求

```bash
curl http://localhost:30000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "valen",
    "state": "A cat is sitting on the sofa.",
    "questions": {
      "animal": {
        "type": "choice",
        "instructions": "Which animal is present?",
        "criteria": {"cat": "A cat", "dog": "A dog"}
      },
      "on_sofa": {
        "type": "noul",
        "instructions": "The cat is on the sofa."
      },
      "clarity": {
        "type": "score",
        "instructions": "How clearly does the state identify the animal?",
        "criteria": ["Not identified", "Ambiguous", "Clearly identified"]
      }
    }
  }'
```

`/v1/systemone` 接受本地 Valen 格式的 `state`、`questions` 映射，以及服务端的 `model` 名称。所有问题共享同一状态，以 `shared_state` 模式执行。

按问题 ID 读取响应中的 `answers` 映射：

| 问题类型 | 输入 | 返回字段 |
| --- | --- | --- |
| `choice` | `criteria`：1–255 个候选名到非空描述的映射 | `choice`、`probabilities`、`confidence` |
| `noul` | 在 `instructions` 中描述命题，省略 `criteria` | `noul`：命题为真的概率 |
| `score` | `criteria`：2–255 个非空等级描述组成的有序列表 | `score`：从 0 开始的等级期望值，以及 `probabilities`、`legend`、`confidence` |

每个问题都必须提供非空字符串 `instructions`。Choice 候选顺序和 Score 等级顺序沿用输入顺序；Noul 使用检查点固定的是非候选。响应还包含 `usage.input_tokens`。

托管 `/v1/decisions` API 使用 `input`、问题列表、`choices` / `levels` 和 `predicate`，与本地接口不同，不能直接照搬托管 API 的请求体。

## 发送图片请求

客户端可将本地图片编码为 data URL，无需将图片文件挂载进服务端容器。请让 MIME 类型与文件格式保持一致。

```bash
python -m pip install requests
```

```python
import base64
from pathlib import Path

import requests

# Replace cat.jpg with a local JPEG file.
image = base64.b64encode(Path("cat.jpg").read_bytes()).decode("ascii")
response = requests.post(
    "http://localhost:30000/v1/systemone",
    json={
        "model": "valen",
        "state": {"messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {
                    "url": f"data:image/jpeg;base64,{image}"
                }},
                {"type": "text", "text": "Inspect this image."},
            ],
        }]},
        "questions": {
            "animal": {
                "type": "choice",
                "instructions": "Which animal is visible?",
                "criteria": {"cat": "A cat", "dog": "A dog"},
            },
        },
    },
    timeout=120,
)
response.raise_for_status()
print(response.json()["answers"])
```

## 使用已下载的权重

挂载完整检查点目录，其中需要包含配置、tokenizer、processor 和权重文件。将下面的宿主机路径替换为实际目录；请求中仍使用 `"model": "valen"`。

```bash
docker run --rm --gpus device=0 --ipc=host \
  -p 127.0.0.1:30000:30000 \
  -v /absolute/path/to/Valen-2B:/models/Valen-2B:ro \
  ghcr.io/valen-team/sglang:valen-v0.1.0 \
  --model-path /models/Valen-2B --served-model-name valen \
  --host 0.0.0.0 --port 30000
```

## 支持范围

- 文本和图片输入，支持 `choice`、`noul`、`score` 三类决策。
- 单 GPU 的 `shared_state` 推理；张量并行和流水线并行度都必须为 1。
- Backbone 使用 BF16，决策头权重与池化保留 FP32。
- 当前版本不支持直接传入 `video_url`。视频推理请使用 Transformers，或由客户端抽帧后通过图片接口提交。

原生实现已在 H200 上使用 Valen-2B 与检查点的 Transformers 实现进行对照，覆盖图片输入及并发请求。发布镜像已通过构建和导入检查，但尚未完成该打包镜像的 GPU 端到端运行验证。

发行源码与验证细节见[镜像说明](https://github.com/Valen-Team/sglang/tree/main/docker/valen)。
