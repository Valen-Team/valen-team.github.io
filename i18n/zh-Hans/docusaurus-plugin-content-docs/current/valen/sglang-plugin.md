---
title: SGLang 插件部署
sidebar_label: SGLang 插件
---

# 使用 SGLang 插件部署

`valen-sglang` 为原版 SGLang 添加 Valen 推理支持，提供 `/v1/systemone` 接口。

## 环境要求

Linux x86-64、CUDA 13、已配置的官方 SGLang 环境（提交 `c1c287a42928495166e14dbcef31b9e1f1dac199`）。安装器检查引擎版本并安装锁定的依赖；[基础镜像与完整环境说明](https://github.com/Valen-Team/Valen/blob/main/serving/sglang/README_zh.md#支持环境)。

已验证：单张 H200、Valen-2B，支持文本/图片和 choice、noul、score，TP=PP=1。

## 构建部署包

当前版本为 0.1.0.dev2，需从源码构建。在 Valen 仓库根目录运行：

```bash
python -m pip install build
python -m build --wheel serving/sglang
python serving/sglang/build_kit.py \
  serving/sglang/dist/valen_sglang-0.1.0.dev2-py3-none-any.whl \
  ./serving-kit/sglang
```

将生成的 `serving-kit/sglang/` 和完整模型目录放到服务器上。

## 安装并启动

在上述 SGLang 环境中运行，替换部署包和模型路径：

```bash
bash /path/to/serving-kit/sglang/install.sh
MODEL=/path/to/Valen-2B CUDA_VISIBLE_DEVICES=0 \
  bash /path/to/serving-kit/sglang/serve.sh
```

默认监听 `127.0.0.1:30000`，模型名为 `valen`。可通过 `HOST`、`PORT`、`MODEL_NAME` 修改。

## 发送请求

等待模型加载完成后，在另一个终端运行：

```bash
curl http://localhost:30000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen","state":"A cat is on the sofa.","questions":{"on_sofa":{"type":"noul","instructions":"The cat is on the sofa."}}}'
```

结果位于 `answers.on_sofa.noul`，表示该陈述为真的概率。

## 发送图片请求

部署包附带图片请求示例：

```bash
python /path/to/serving-kit/sglang/example_client.py --image /path/to/cat.jpg
```

完整请求格式、启动参数和支持范围见[部署包说明](https://github.com/Valen-Team/Valen/blob/main/serving/sglang/README_zh.md)；对照测试结果见[验证记录](https://github.com/Valen-Team/Valen/blob/main/serving/sglang/VALIDATION.md)。
