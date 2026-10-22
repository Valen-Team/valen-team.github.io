---
title: SGLang 镜像部署
sidebar_label: SGLang 镜像
---

# 使用 SGLang 镜像部署

使用 Valen-Team 预构建镜像启动本地 HTTP 服务。

## 环境要求

Linux x86-64、NVIDIA GPU、兼容 CUDA 13 的驱动，以及已配置 NVIDIA Container Toolkit 的 Docker。

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

首次启动会下载模型，缓存目录用于复用权重。更换模型时修改 `--model-path`。

## 发送请求

等待模型加载完成后，在另一个终端运行：

```bash
curl http://localhost:30000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen","state":"A cat is on the sofa.","questions":{"on_sofa":{"type":"noul","instructions":"The cat is on the sofa."}}}'
```

`answers.on_sofa.noul` 表示该陈述为真的概率。

## 发送图片请求

将图片编码为 data URL 后发送。客户端需安装 `requests`：

```bash
python -m pip install requests
```

<details>
<summary>Python 图片请求示例</summary>

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

</details>
