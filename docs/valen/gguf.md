---
title: GGUF local service
---

# GGUF local service

Valen GGUF models run on the Valen custom llama.cpp runtime, a local HTTP server that returns candidate probabilities and boxes. Runtime **0.2.0** serves Valen-Decision-1.5 with text and image input, including `bbox` questions, and also loads the Valen-Decision-1.0 files. For the quickest online trial, see [version selection](/docs/valen/choosing/).

## Valen-Decision-1.5 models

Each repository provides a Q8_0 text file and the matching vision file `vision-native-limits-F32.gguf`; the 0.8B to 9B repositories also provide an F32 text file. Start with Q8_0; use the text file and the vision file of the same size.

| Size | Repository | Pinned commit | Q8_0 | F32 | Vision |
| --- | --- | --- | --- | --- | --- |
| 0.8B | [Valen-Decision-1.5-0.8B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-GGUF) | [`248de9a2fe91`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-GGUF/tree/248de9a2fe91ec2ce9794f7f88ca1194c75c1872) | 0.77 GiB | 2.83 GiB | 0.37 GiB |
| 2B | [Valen-Decision-1.5-2B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-GGUF) | [`ebf1ee58836b`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-GGUF/tree/ebf1ee58836b5dcbd07f0a74bef2d4d94f63b80d) | 1.90 GiB | 7.05 GiB | 1.23 GiB |
| 4B | [Valen-Decision-1.5-4B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-GGUF) | [`8104bad0c9b8`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-GGUF/tree/8104bad0c9b8d9e878fb8ddca1614abe986e55a3) | 4.20 GiB | 15.71 GiB | 1.24 GiB |
| 9B | [Valen-Decision-1.5-9B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-GGUF) | [`1a2e9236acf7`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-GGUF/tree/1a2e9236acf7501596bdd71ca2fde1ada6e991aa) | 7.91 GiB | 29.62 GiB | 1.70 GiB |
| 27B | [Valen-Decision-1.5-27B-GGUF](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-GGUF) | [`106a90310976`](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-GGUF/tree/106a90310976a8601f6ebf801c8a568538582ce5) | 25.43 GiB | — | 1.72 GiB |

## Linux x86-64 CPU prebuilt package

Runtime version **0.2.0** targets Ubuntu 22.04+, glibc 2.35+ and AVX2/FMA/F16C/BMI2 CPUs; it runs as is, with no compilation. The [release](https://github.com/Valen-Team/Valen/releases/tag/gguf-runtime-v0.2.0) lists the validation scope and SHA256.

System prerequisites are `curl`, `tar`, `sha256sum`, `libstdc++6` and `libgomp1`. On a minimal Ubuntu installation, install them first:

```sh
sudo apt-get update
sudo apt-get install -y curl ca-certificates coreutils tar libstdc++6 libgomp1
```

Download the runtime and its checksum file:

```sh
base=https://github.com/Valen-Team/Valen/releases/download/gguf-runtime-v0.2.0
curl -fLO "$base/valen-gguf-runtime-0.2.0-linux-x86_64.tar.gz"
curl -fLO "$base/SHA256SUMS"
sha256sum -c SHA256SUMS
tar -xzf valen-gguf-runtime-0.2.0-linux-x86_64.tar.gz
cd valen-gguf-runtime-0.2.0-linux-x86_64
```

## Download a model and serve

Reuse model files you already have. The 0.8B Q8_0 text file is about 0.77 GiB and its vision file about 0.37 GiB on disk. Download both from the pinned commit, verify them, and start the server:

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

Text-only serving needs just `-m`. For another size, substitute that size's text and vision files from the tables on this page.

## Text request

In another terminal:

```sh
curl --fail http://127.0.0.1:8080/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{"state":{"messages":[{"role":"user","content":"The film was excellent."}]},"questions":{"sentiment":{"type":"choice","instructions":"Classify the sentiment.","criteria":{"positive":"Positive","negative":"Negative"}}}}'
```

The response contains structured candidate probabilities for each question. The whole request is evaluated in one pass, so it must fit the context and batch capacities; raise `-c`, `-b` and `-ub` together for larger requests. `/v1/decisions` accepts the native Decisions schema and returns the same numbers.

## Bbox request with an image

Send images as data URLs in `state.messages`. A `bbox` question locates what its instructions describe; `image` is the zero-based position of the image in the request and defaults to the first image. Python only prepares the request file:

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

The answer holds a box and a point normalized to the image width and height, `bbox` as `[x1, y1, x2, y2]` and `point` as `[x, y]`, with a confidence. This is the 0.8B Q8_0 answer for a photo of a blue mug on a counter:

```json
{"answers": {"mug": {"type": "bbox", "bbox": [0.2605, 0.3101, 0.8244, 0.8232], "point": [0.5425, 0.5667], "confidence": 0.9519},
             "full": {"type": "noul", "noul": 0.9713351087170098}},
 "usage": {"input_tokens": 672, "output_tokens": 0}}
```

Bbox questions can be mixed with `choice`, `score` and `noul` questions in one request, and a request can carry several images. For PNG input use the `data:image/png;base64,` prefix.

## File checksums

| Size | File | SHA256 |
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

Each repository also carries `SHA256SUMS`, `MANIFEST.json` (source hashes, runtime and patch hashes, file sizes, validation numbers) and a runtime guide with conversion and source-build commands: [0.8B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-0.8B-GGUF/blob/main/RUNTIME_GUIDE.md) · [2B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-2B-GGUF/blob/main/RUNTIME_GUIDE.md) · [4B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-4B-GGUF/blob/main/RUNTIME_GUIDE.md) · [9B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-9B-GGUF/blob/main/RUNTIME_GUIDE.md) · [27B](https://huggingface.co/Valen-Team/Valen-Decision-1.5-27B-GGUF/blob/main/RUNTIME_GUIDE.md).

## Validation

Every size was served by the runtime 0.2.0 `llama-server` on Linux x86-64 CPU and compared with native `model.predict` in FP32 on six requests: one text request, one image request and four bbox requests, including one with two images. Token counts were equal in every case. The table lists the maximum absolute difference per file; the release gate is a probability difference of at most 0.08.

| Size | File | Probability | Box | Bbox confidence |
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

The per-request numbers are in each repository's `MANIFEST.json` and runtime guide.

## Release record

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

The final archive was extracted on the cluster, checked file by file, and served a Valen-Decision-1.5-0.8B Q8_0 text request twice with identical answers, the bbox request above, and a Valen-0.8B Q8_0 text request. The source change from runtime 0.1.0 is [`valen-decision-1.5-runtime.patch`](https://github.com/Valen-Team/Valen/tree/main/serving/gguf); the package includes the complete patched source.

## Valen-Decision-1.0

Runtime 0.2.0 also loads the Valen-Decision-1.0 GGUF files. All three sizes provide F32 and Q8_0; each model repository records its [quality report](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF/blob/main/validation/quality-summary.json). The 0.8B Q8_0 text file is about 0.761 GiB:

```sh
curl -fL https://huggingface.co/Valen-Team/Valen-0.8B-GGUF/resolve/e24c6ad38a83d300ae7fc83917a1a54a0e416455/Valen-0.8B-Q8_0.gguf -o Valen-0.8B-Q8_0.gguf
echo '930d29c39c7104bb69a028a0605fad5eba0949e1f3ad4a3a3bbca13716c4b9d6  Valen-0.8B-Q8_0.gguf' | sha256sum -c -
./serve -m "$PWD/Valen-0.8B-Q8_0.gguf" --load-mode none --device none -ngl 0 \
  --host 127.0.0.1 --port 8080 -c 4096 -b 4096 -ub 4096 \
  -t 4 --parallel 1 --no-warmup
```

The text request above works unchanged. For images, add `--mmproj /your/cache/vision-native-limits-F32.gguf --no-mmproj-offload --image-min-tokens 64 --image-max-tokens 256` with the vision file from the same Valen-Decision-1.0 repository (0.8B SHA256 `db28fe68408846202ad9dd8ac71c4f43df7d8665e0d94422fa1e91e3029fe03b`); the [Cookbook validation](https://valen-team.github.io/cookbook/validation/) records the measured image runs.

Source pins, patches, licenses and source-build/Ollama instructions for Valen-Decision-1.0 are in each model repository; the custom Ollama build runs the Valen-Decision-1.0 files:

- [0.8B GGUF](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF) · [runtime guide](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF/blob/main/RUNTIME_GUIDE.md) · [custom Ollama](https://huggingface.co/Valen-Team/Valen-0.8B-GGUF/blob/main/OLLAMA_USAGE.md)
- [2B GGUF](https://huggingface.co/Valen-Team/Valen-2B-GGUF) · [runtime guide](https://huggingface.co/Valen-Team/Valen-2B-GGUF/blob/main/RUNTIME_GUIDE.md) · [custom Ollama](https://huggingface.co/Valen-Team/Valen-2B-GGUF/blob/main/OLLAMA_USAGE.md)
- [4B GGUF](https://huggingface.co/Valen-Team/Valen-4B-GGUF) · [runtime guide](https://huggingface.co/Valen-Team/Valen-4B-GGUF/blob/main/RUNTIME_GUIDE.md) · [custom Ollama](https://huggingface.co/Valen-Team/Valen-4B-GGUF/blob/main/OLLAMA_USAGE.md)

The [runtime 0.1.0 release](https://github.com/Valen-Team/Valen/releases/tag/gguf-runtime-v0.1.0) remains available.
