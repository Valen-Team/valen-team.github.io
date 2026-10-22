---
title: vLLM plugin deployment
sidebar_label: Plugin
---

# Deploy with the vLLM plugin

`valen-vllm` serves Valen decisions through `/v1/systemone`.

## Requirements

Linux x86-64, Python 3.12, glibc 2.34+, CUDA 13, and official vLLM `0.32.1rc1.dev253+g30aded62d`. Follow the [pinned environment setup](https://github.com/Valen-Team/Valen/blob/main/serving/vllm/README.md#install-and-start) before installing the plugin.

The plugin supports single-GPU text/image Choice, Noul and Score with `shared_state` execution. Tested with Valen-2B on H200. For direct video inference, use [Transformers](./quickstart.md).

## Build the kit

Run from the Valen repository root:

```bash
python -m pip install build
python -m build --wheel serving/vllm
python serving/vllm/build_kit.py \
  serving/vllm/dist/valen_vllm-0.1.0.dev1-py3-none-any.whl ./vllm-kit
```

Copy `vllm-kit/` and a complete checkpoint to the GPU host.

## Install and start

Inside the required vLLM environment:

```bash
bash /path/to/vllm-kit/install.sh
MODEL=/path/to/Valen-2B CUDA_VISIBLE_DEVICES=0 \
  bash /path/to/vllm-kit/serve.sh
```

Defaults: `127.0.0.1:8000`, model name `valen`. Override with `HOST`, `PORT` and `MODEL_NAME`.

## Send a request

Once the model is ready, run in another terminal:

```bash
curl http://127.0.0.1:8000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen","state":"A cat is on the sofa.","questions":{"on_sofa":{"type":"noul","instructions":"The cat is on the sofa."}}}'
```

`answers.on_sofa.noul` is the probability that the statement is true. This uses the same local request format as SGLang; the hosted `/v1/decisions` format is different.

## Send an image request

The client encodes a local PNG/JPEG/WebP as a data URL:

```bash
python /path/to/vllm-kit/example_client.py --image /path/to/cat.jpg
```

See the [kit guide](https://github.com/Valen-Team/Valen/blob/main/serving/vllm/README.md) for launch options and input limits.
