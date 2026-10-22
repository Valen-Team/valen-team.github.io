---
title: SGLang plugin deployment
sidebar_label: SGLang plugin
---

# Deploy with the SGLang plugin

`valen-sglang` adds Valen inference to stock SGLang through the `/v1/systemone` endpoint.

## Requirements

Linux x86-64, CUDA 13, and a prepared official SGLang environment at commit `c1c287a42928495166e14dbcef31b9e1f1dac199`. The installer checks the engine and installs pinned dependencies. See the [base image and environment requirements](https://github.com/Valen-Team/Valen/blob/main/serving/sglang/README.md#supported-environment).

Validated: one H200 with Valen-2B, text/images, choice/noul/score, TP=PP=1.

## Build the kit

Version 0.1.0.dev2 currently requires a source build. Run from the Valen repository root:

```bash
python -m pip install build
python -m build --wheel serving/sglang
python serving/sglang/build_kit.py \
  serving/sglang/dist/valen_sglang-0.1.0.dev2-py3-none-any.whl \
  ./serving-kit/sglang
```

Copy the generated `serving-kit/sglang/` and a complete checkpoint directory to the server.

## Install and start

Inside the supported SGLang environment, replace the kit and model paths:

```bash
bash /path/to/serving-kit/sglang/install.sh
MODEL=/path/to/Valen-2B CUDA_VISIBLE_DEVICES=0 \
  bash /path/to/serving-kit/sglang/serve.sh
```

Defaults: `127.0.0.1:30000`, model name `valen`. Override with `HOST`, `PORT`, and `MODEL_NAME`.

## Send a request

Wait for model loading to finish, then run in another terminal:

```bash
curl http://localhost:30000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen","state":"A cat is on the sofa.","questions":{"on_sofa":{"type":"noul","instructions":"The cat is on the sofa."}}}'
```

`answers.on_sofa.noul` is the probability that the statement is true.

## Send an image request

The kit includes an image request example:

```bash
python /path/to/serving-kit/sglang/example_client.py --image /path/to/cat.jpg
```

See the [kit instructions](https://github.com/Valen-Team/Valen/blob/main/serving/sglang/README.md) for the full request format, options, and supported scope, and the [validation record](https://github.com/Valen-Team/Valen/blob/main/serving/sglang/VALIDATION.md) for comparison results.
