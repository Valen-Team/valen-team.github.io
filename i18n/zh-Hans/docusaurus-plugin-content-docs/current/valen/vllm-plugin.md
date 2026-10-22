---
title: vLLM 插件部署
sidebar_label: 插件部署
---

# 使用 vLLM 插件部署

`valen-vllm` 通过 `/v1/systemone` 提供 Valen 决策服务。

## 环境要求

Linux x86-64、Python 3.12、glibc 2.34 及以上、CUDA 13，以及官方 vLLM `0.32.1rc1.dev253+g30aded62d`。安装插件前，先按[固定版本环境说明](https://github.com/Valen-Team/Valen/blob/main/serving/vllm/README_zh.md#安装并启动)准备 vLLM。

支持单 GPU、`shared_state` 和文本/图片 Choice、Noul、Score，已在 H200 上测试 Valen-2B。直接视频推理请使用 [Transformers](./quickstart.md)。

## 构建部署包

在 Valen 仓库根目录运行：

```bash
python -m pip install build
python -m build --wheel serving/vllm
python serving/vllm/build_kit.py \
  serving/vllm/dist/valen_vllm-0.1.0.dev1-py3-none-any.whl ./vllm-kit
```

将 `vllm-kit/` 和完整模型目录复制到 GPU 服务器。

## 安装并启动

在上述 vLLM 环境中运行：

```bash
bash /path/to/vllm-kit/install.sh
MODEL=/path/to/Valen-2B CUDA_VISIBLE_DEVICES=0 \
  bash /path/to/vllm-kit/serve.sh
```

默认地址 `127.0.0.1:8000`，模型名 `valen`。可通过 `HOST`、`PORT`、`MODEL_NAME` 修改。

## 发送请求

等待模型加载完成，在另一个终端运行：

```bash
curl http://127.0.0.1:8000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen","state":"A cat is on the sofa.","questions":{"on_sofa":{"type":"noul","instructions":"The cat is on the sofa."}}}'
```

`answers.on_sofa.noul` 表示该陈述为真的概率。请求格式与 SGLang 本地接口相同，与托管 `/v1/decisions` 不同。

## 发送图片请求

客户端会将本地 PNG/JPEG/WebP 编码成 data URL：

```bash
python /path/to/vllm-kit/example_client.py --image /path/to/cat.jpg
```

启动参数和输入限制见[部署包说明](https://github.com/Valen-Team/Valen/blob/main/serving/vllm/README_zh.md)。
