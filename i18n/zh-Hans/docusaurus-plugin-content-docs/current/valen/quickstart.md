---
title: Transformers 本地推理
sidebar_label: Transformers 推理
description: 安装 Valen，并运行第一个结构化决策示例。
---

# 使用 Transformers 在本地推理

使用 Hugging Face Transformers，在 Python 中直接加载已发布的 Valen 检查点。支持文本、图片、视频，以及 `shared_state` 和 `question` 两种执行模式。

如果需要通过预构建镜像启动本地 HTTP 服务，请阅读 [SGLang 推理指南](/zh-Hans/docs/valen/sglang/)。

## 准备环境

使用 Python 3.10+ 和 CUDA GPU。在新克隆的仓库中运行安装脚本：

```bash
git clone https://github.com/Valen-Team/Valen.git
cd Valen
bash scripts/setup/bootstrap.sh
source .venv/bin/activate
```

已有环境或其他安装方式请参考[上游安装说明](https://github.com/Valen-Team/Valen/blob/main/scripts/README.md#installation)。当前环境应满足所选模型的依赖要求。

## 运行文本决策

```python
import torch
from transformers import AutoModel

model = AutoModel.from_pretrained(
    "Valen-Team/Valen-0.8B",
    trust_remote_code=True,
    dtype="auto",
    attn_implementation="sdpa",
).to("cuda").eval()

torch.set_float32_matmul_precision("highest")
torch.backends.cudnn.allow_tf32 = False

answer = model.predict({
    "state": "A cat is sitting on the sofa.",
    "questions": {
        "animal": {
            "type": "choice",
            "instructions": "Which animal is present?",
            "criteria": {"cat": "A cat", "dog": "A dog"},
        },
        "on_sofa": {
            "type": "noul",
            "instructions": "The cat is on the sofa.",
        },
    },
}, execution="shared_state")

print(answer)
```

模型会针对每个问题返回结构化决策。请读取返回的概率，而不是将其视为生成式文本。

将模型名替换为 `Valen-Team/Valen-2B` 或 `Valen-Team/Valen-4B`，可以切换到其他规模。

## 使用图像与视频

将文本状态替换为包含媒体内容的消息对象。[数据格式指南](/zh-Hans/docs/valen/data-format/)定义了完整的输入结构、媒体路径与视频约定。

需要可执行示例、输入预览与保存结果时，打开[本地推理 Notebook](https://github.com/Valen-Team/Valen/blob/main/cookbook/local_inference_zh.ipynb)。

## 选择执行模式

- `shared_state`：将所有问题和候选项放入共享序列。
- `question`：按照架构约定逐问题或逐分支执行。

计算与数据分组细节见[共享状态执行](/zh-Hans/docs/valen/qwen-shared-state/)。

## 下一步

[调用 API](/zh-Hans/docs/valen/api/) · [配置训练](/zh-Hans/docs/valen/configuration/) · [使用 JevalKit 评测](/zh-Hans/docs/jevalkit/quickstart/)

来源：[Valen README](https://github.com/Valen-Team/Valen#quick-start)。

