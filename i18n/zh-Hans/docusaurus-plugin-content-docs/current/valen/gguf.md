---
title: GGUF 本地服务
---

# GGUF 本地服务

Valen GGUF 模型通过 Valen 定制 llama.cpp 运行时运行：一个本地 HTTP 服务，返回候选项概率和框。运行时 **0.2.0** 支持 Valen-Decision-1.5 的文本与图片输入（含 `bbox` 问题），同时可加载 Valen-Decision-1.0 的文件。首次在线体验见[版本选择](/zh-Hans/docs/valen/choosing/)。

## Valen-Decision-1.5 模型

每个仓库提供 Q8_0 文本文件和配套的视觉文件 `vision-native-limits-F32.gguf`，0.8B 至 9B 仓库另提供 F32 文本文件。建议从 Q8_0 开始；文本文件和视觉文件使用同一尺寸。

| 尺寸 | 仓库 | 固定 commit | Q8_0 | F32 | 视觉文件 |
| --- | --- | --- | --- | --- | --- |
| 0.8B | [Valen-Decision-1.5-0.8B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-GGUF) | [`248de9a2fe91`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-GGUF/tree/248de9a2fe91ec2ce9794f7f88ca1194c75c1872) | 0.77 GiB | 2.83 GiB | 0.37 GiB |
| 2B | [Valen-Decision-1.5-2B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-GGUF) | [`ebf1ee58836b`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-GGUF/tree/ebf1ee58836b5dcbd07f0a74bef2d4d94f63b80d) | 1.90 GiB | 7.05 GiB | 1.23 GiB |
| 4B | [Valen-Decision-1.5-4B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-GGUF) | [`8104bad0c9b8`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-GGUF/tree/8104bad0c9b8d9e878fb8ddca1614abe986e55a3) | 4.20 GiB | 15.71 GiB | 1.24 GiB |
| 9B | [Valen-Decision-1.5-9B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-GGUF) | [`1a2e9236acf7`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-GGUF/tree/1a2e9236acf7501596bdd71ca2fde1ada6e991aa) | 7.91 GiB | 29.62 GiB | 1.70 GiB |
| 27B | [Valen-Decision-1.5-27B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-GGUF) | [`106a90310976`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-GGUF/tree/106a90310976a8601f6ebf801c8a568538582ce5) | 25.43 GiB | — | 1.72 GiB |

## Linux x86-64 CPU 预编译包

运行包版本 **0.2.0**，目标 Ubuntu 22.04+、glibc 2.35+、AVX2/FMA/F16C/BMI2 CPU，解压即可运行，无需编译。验证范围与 SHA256 见[发布页](https://github.com/Valen-Team/Valen/releases/tag/gguf-runtime-v0.2.0)。

需要系统提供 `curl`、`tar`、`sha256sum`、`libstdc++6` 和 `libgomp1`。最小化 Ubuntu 安装可先执行：

```sh
sudo apt-get update
sudo apt-get install -y curl ca-certificates coreutils tar libstdc++6 libgomp1
```

下载运行包和校验文件：

```sh
base=https://github.com/Valen-Team/Valen/releases/download/gguf-runtime-v0.2.0
curl -fLO "$base/valen-gguf-runtime-0.2.0-linux-x86_64.tar.gz"
curl -fLO "$base/SHA256SUMS"
sha256sum -c SHA256SUMS
tar -xzf valen-gguf-runtime-0.2.0-linux-x86_64.tar.gz
cd valen-gguf-runtime-0.2.0-linux-x86_64
```

## 下载模型并启动服务

优先使用已有模型文件。0.8B 的 Q8_0 文本文件约 0.77 GiB，视觉文件约 0.37 GiB（磁盘大小）。从固定 commit 下载这两个文件，校验后启动服务：

```sh
repo=https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-GGUF/resolve/248de9a2fe91ec2ce9794f7f88ca1194c75c1872
curl -fL "$repo/Valen-Decision-1.5-0.8B-Q8_0.gguf" -o Valen-Decision-1.5-0.8B-Q8_0.gguf
curl -fL "$repo/vision-native-limits-F32.gguf" -o vision-native-limits-F32.gguf
echo 'f62a6578782d2f0dc77ef4cfec35b24cca73679ad27cbf67f2343ea8afe13a13  Valen-Decision-1.5-0.8B-Q8_0.gguf' | sha256sum -c -
echo '67d27406dcb68f035952e3f93710492759d3fafaa07cf763cad7dd877dee3945  vision-native-limits-F32.gguf' | sha256sum -c -
./serve -m "$PWD/Valen-Decision-1.5-0.8B-Q8_0.gguf" --mmproj "$PWD/vision-native-limits-F32.gguf" \
  --load-mode none --device none -ngl 0 \
  --host 127.0.0.1 --port 8080 -c 4096 -b 4096 -ub 4096 \
  -t 4 --parallel 1 --no-warmup
```

只做文本服务时只需 `-m`。其他尺寸按本页表格换成对应尺寸的文本文件和视觉文件。

## 文本请求

另开终端：

```sh
curl --fail http://127.0.0.1:8080/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"state":{"messages":[{"role":"user","content":"The film was excellent."}]},"questions":{"sentiment":{"type":"choice","instructions":"Classify the sentiment.","criteria":{"positive":"Positive","negative":"Negative"}}}}'
```

返回每个问题的结构化候选概率。整个请求一次前向完成，需容纳于上下文和 batch 容量中；请求更大时同时调大 `-c`、`-b` 和 `-ub`。`/v1/decisions` 接收原生 Decisions 格式，返回相同的数值。

## 带图片的 bbox 请求

图片以 data URL 放在 `state.messages` 中。`bbox` 问题定位 instructions 描述的目标；`image` 是图片在请求中的序号（从 0 开始），默认第一张。Python 只用于生成请求文件：

```sh
python3 - <<'PYMEDIA' > bbox-request.json
import base64, json
from pathlib import Path
image = Path("example.jpg")
url = "data:image/jpeg;base64," + base64.b64encode(image.read_bytes()).decode()
print(json.dumps({
    "state": {"messages": [{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": url}}
    ]}]},
    "questions": {
        "mug": {"type": "bbox", "instructions": "The blue mug.", "image": 0},
        "full": {"type": "noul", "instructions": "The mug has coffee in it."}
    }
}))
PYMEDIA
curl --fail http://127.0.0.1:8080/v1/systemone \
  -H 'Content-Type: application/json' --data-binary @bbox-request.json
```

答案包含按图片宽高归一化的框和点：`bbox` 为 `[x1, y1, x2, y2]`，`point` 为 `[x, y]`，并给出置信度。下面是 0.8B Q8_0 对一张"台面上的蓝色马克杯"照片的回答：

```json
{"answers": {"mug": {"type": "bbox", "bbox": [0.2605, 0.3101, 0.8244, 0.8232], "point": [0.5425, 0.5667], "confidence": 0.9519},
             "full": {"type": "noul", "noul": 0.9713351087170098}},
 "usage": {"input_tokens": 672, "output_tokens": 0}}
```

bbox 问题可以与 `choice`、`score`、`noul` 问题放在同一个请求里，一个请求也可以带多张图片。PNG 输入使用 `data:image/png;base64,` 前缀。

## 文件校验值

| 尺寸 | 文件 | SHA256 |
| --- | --- | --- |
| 0.8B | `Valen-Decision-1.5-0.8B-F32.gguf` | `a38ea6a8c9459ce5f4b459fd5c953bd74fb1c758aff56f3f00c9b8e13e98446a` |
| 0.8B | `Valen-Decision-1.5-0.8B-Q8_0.gguf` | `f62a6578782d2f0dc77ef4cfec35b24cca73679ad27cbf67f2343ea8afe13a13` |
| 0.8B | `vision-native-limits-F32.gguf` | `67d27406dcb68f035952e3f93710492759d3fafaa07cf763cad7dd877dee3945` |
| 2B | `Valen-Decision-1.5-2B-F32.gguf` | `0e580633ef554617b589cca437c6a0b58bd63bf2cdcb6a3e4fdc51eedb5b24aa` |
| 2B | `Valen-Decision-1.5-2B-Q8_0.gguf` | `65ca8935e2127c30d735319337026f42954708cf8e315744d7a2bb216e4ad2ee` |
| 2B | `vision-native-limits-F32.gguf` | `063696556e12b9aad4be4431954de94e731d8709b997ae76ed85e9436e96db57` |
| 4B | `Valen-Decision-1.5-4B-F32.gguf` | `2f444252d680f953cd1321ea22b43fa1e0a7aeedb10528d62a2b05dc0b90f732` |
| 4B | `Valen-Decision-1.5-4B-Q8_0.gguf` | `0b9a789f9477cbd1a11150f0b6d584743e44165a2ab7c4ec44c4107f1640e05f` |
| 4B | `vision-native-limits-F32.gguf` | `0334f15885a1a9463eca9577312f411eac48c970250ce0b7e42aed20a6006b85` |
| 9B | `Valen-Decision-1.5-9B-F32.gguf` | `270fa8c2fdbeb338d22dde7c4dcf8d5b4ce91d15ba5429ae778e29e58f8221db` |
| 9B | `Valen-Decision-1.5-9B-Q8_0.gguf` | `b40439965617fb4ecb28f4feb6e70be4ab30479628f8a8cc688d98e72e54ca79` |
| 9B | `vision-native-limits-F32.gguf` | `d646b33792e7e2a6587457961b016295094440ad5a3eca42a5e8b4be1bbe0a20` |
| 27B | `Valen-Decision-1.5-27B-Q8_0.gguf` | `ec5376ce32907446104ca22ce2cb8a6b64ebb3af11ce6b6b2527070dfcb6c862` |
| 27B | `vision-native-limits-F32.gguf` | `2bad96b2e146ecd829024b7edd017ef778cd3f45dd1dc632c6460a67e237d463` |

每个仓库还提供 `SHA256SUMS`、`MANIFEST.json`（来源哈希、运行时与补丁哈希、文件大小、验证数值）以及包含转换和源码构建命令的运行指南：[0.8B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-GGUF/blob/main/RUNTIME_GUIDE.md) · [2B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-GGUF/blob/main/RUNTIME_GUIDE.md) · [4B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-GGUF/blob/main/RUNTIME_GUIDE.md) · [9B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-GGUF/blob/main/RUNTIME_GUIDE.md) · [27B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-GGUF/blob/main/RUNTIME_GUIDE.md)。

## 验证

每个尺寸都由运行时 0.2.0 的 `llama-server` 在 Linux x86-64 CPU 上提供服务，并在六个请求上与原生 `model.predict`（FP32）对比：一个文本请求、一个图片请求和四个 bbox 请求（其中一个带两张图片）。所有请求的 token 数一致。下表为各文件的最大绝对差；发布门槛为概率差不超过 0.08。

| 尺寸 | 文件 | 概率 | 框 | bbox 置信度 |
| --- | --- | --- | --- | --- |
| 0.8B | F32 | 0.00029 | 0.0045 | 0.0031 |
| 0.8B | Q8_0 | 0.02081 | 0.0335 | 0.0438 |
| 2B | F32 | 0.00262 | 0.1011 | 0.0863 |
| 2B | Q8_0 | 0.01092 | 0.0992 | 0.0856 |
| 4B | F32 | 0.00068 | 0.0303 | 0.0261 |
| 4B | Q8_0 | 0.01868 | 0.0296 | 0.0254 |
| 9B | F32 | 0.00025 | 0.0031 | 0.0021 |
| 9B | Q8_0 | 0.00862 | 0.0032 | 0.0071 |
| 27B | Q8_0 | 0.00252 | 0.0553 | 0.0113 |

逐请求数值见各仓库的 `MANIFEST.json` 和运行指南。

## 发布记录

| Field | Value |
| --- | --- |
| Runtime | `0.2.0` |
| Artifact bytes | `32070054` |
| SHA256 | `4b3b6035adbb99f3bb47c75e55804e1f650f96b35b825d95a6cd4ae85ce39537` |
| llama.cpp source base | `1a0b56cec73dac938e0602c974b21dc8e2862830` |
| Valen patch SHA256 (runtime 0.1.0) | `20c8fcb50920ae8e96b158c30c277ab384fb9716d8d51fb01966b562b8e57732` |
| Valen-Decision-1.5 patch SHA256 | `857d670488e0c796b4346b893353cc0d7a5b588cf0d5393c88d58d939f843bb8` |
| Compiler | GCC 11.4 / Ubuntu 22.04 |
| License | llama.cpp MIT + Valen patches Apache-2.0; notices and source included |

最终压缩包已在集群解压并逐文件校验，随后完成 Valen-Decision-1.5-0.8B Q8_0 文本请求（两次答案相同）、上面的 bbox 请求，以及 Valen-0.8B Q8_0 文本请求。相对运行时 0.1.0 的源码改动为 [`valen-decision-1.5-runtime.patch`](https://github.com/Valen-Team/Valen/tree/main/serving/gguf)；运行包内含完整的已打补丁源码。

## Valen-Decision-1.0

运行时 0.2.0 同样可加载 Valen-Decision-1.0 的 GGUF 文件。三个尺寸均提供 F32 和 Q8_0，各模型仓库记录了[质量报告](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF/blob/main/validation/quality-summary.json)。0.8B 的 Q8_0 文本文件约 0.761 GiB：

```sh
curl -fL https://huggingface.co/Valen-Team/Valen-0.8B-GGUF/resolve/e24c6ad38a83d300ae7fc83917a1a54a0e416455/Valen-0.8B-Q8_0.gguf -o Valen-0.8B-Q8_0.gguf
echo '930d29c39c7104bb69a028a0605fad5eba0949e1f3ad4a3a3bbca13716c4b9d6  Valen-0.8B-Q8_0.gguf' | sha256sum -c -
./serve -m "$PWD/Valen-0.8B-Q8_0.gguf" --load-mode none --device none -ngl 0 \
  --host 127.0.0.1 --port 8080 -c 4096 -b 4096 -ub 4096 \
  -t 4 --parallel 1 --no-warmup
```

上面的文本请求可直接使用。图片请求需增加 `--mmproj /your/cache/vision-native-limits-F32.gguf --no-mmproj-offload --image-min-tokens 64 --image-max-tokens 256`，视觉文件取自同一 Valen-Decision-1.0 仓库（0.8B 的 SHA256 为 `db28fe68408846202ad9dd8ac71c4f43df7d8665e0d94422fa1e91e3029fe03b`）；图片实测记录见 [Cookbook 验证](https://valen-team.github.io/zh-Hans/cookbook/validation/)。

Valen-Decision-1.0 的源码 pin、补丁、许可证和源码构建/Ollama 说明由各模型仓库提供；定制 Ollama 运行 Valen-Decision-1.0 的文件：

- [0.8B GGUF](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF) · [runtime guide](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF/blob/main/RUNTIME_GUIDE.md) · [custom Ollama](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF/blob/main/OLLAMA_USAGE.md)
- [2B GGUF](https://huggingface.co/Valen-Team/Valen-2B-GGUF) · [runtime guide](https://huggingface.co/Valen-Team/Valen-2B-GGUF/blob/main/RUNTIME_GUIDE.md) · [custom Ollama](https://huggingface.co/Valen-Team/Valen-2B-GGUF/blob/main/OLLAMA_USAGE.md)
- [4B GGUF](https://huggingface.co/Valen-Team/Valen-4B-GGUF) · [runtime guide](https://huggingface.co/Valen-Team/Valen-4B-GGUF/blob/main/RUNTIME_GUIDE.md) · [custom Ollama](https://huggingface.co/Valen-Team/Valen-4B-GGUF/blob/main/OLLAMA_USAGE.md)

[运行时 0.1.0 发布](https://github.com/Valen-Team/Valen/releases/tag/gguf-runtime-v0.1.0)仍可下载。
