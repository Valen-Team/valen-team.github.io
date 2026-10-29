"""Shared cookbook runner. Apache-2.0. No implicit model or media downloads."""
import argparse
import base64
from contextlib import ExitStack, contextmanager
import hashlib
import json
import math
import os
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
CACHES = HERE / "caches"


def samples():
    return json.loads((HERE / "samples.json").read_text())


def parser(description):
    p = argparse.ArgumentParser(description=description)
    p.add_argument("--backend", choices=["remote", "onnx", "native"], default="remote")
    p.add_argument("--base-url", default=os.environ.get("VALEN_BASE_URL", "https://llm-proxy.openxxlab.com/v1"))
    p.add_argument("--model", default=os.environ.get("VALEN_MODEL"))
    p.add_argument("--threads", type=int, default=4)
    p.add_argument("--asset-dir", type=Path, default=Path("."))
    p.add_argument("--output", type=Path)
    p.add_argument("--replay", choices=["auto", "only", "off"], default="auto",
                   help="auto: reuse recorded answers and record new ones; only: recorded answers only; "
                        "off: always call the model")
    return p


@contextmanager
def client(args):
    """Answers for remote requests are recorded in caches/<script>.json, keyed by model and request."""
    mode = getattr(args, "replay", "off") if args.backend == "remote" else "off"
    if mode == "off":
        with live_client(args) as predict:
            yield predict
        return
    path = CACHES / (Path(sys.argv[0]).stem + ".json")
    store = json.loads(path.read_text()) if path.exists() else {}
    with ExitStack() as stack:
        live = []

        def predict(body):
            key = hashlib.sha256(json.dumps({"model": args.model or "valen-2b", **pixels(body)}, sort_keys=True,
                                            ensure_ascii=False).encode()).hexdigest()
            if key not in store:
                if mode == "only":
                    raise KeyError(f"No recorded answer in caches/{path.name}; run with --replay auto to call the model")
                if not live:
                    live.append(stack.enter_context(live_client(args)))
                store[key] = live[0](body)
                CACHES.mkdir(exist_ok=True)
                path.write_text(json.dumps(store, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
            return store[key]
        yield predict


def pixels(value):
    """Key images by their decoded pixels, so another zlib or Pillow build finds the same recorded answer."""
    if isinstance(value, dict):
        return {k: pixels(v) for k, v in value.items()}
    if isinstance(value, list):
        return [pixels(v) for v in value]
    if isinstance(value, str) and value.startswith("data:image/"):
        import io
        from PIL import Image
        with Image.open(io.BytesIO(base64.b64decode(value.split(",", 1)[1]))) as image:
            return f"image {image.size} " + hashlib.sha256(image.convert("RGB").tobytes()).hexdigest()
    return value


@contextmanager
def live_client(args):
    if args.threads < 1:
        raise ValueError("--threads must be positive")
    if args.backend == "native":
        if not args.model or not Path(args.model).is_dir():
            raise ValueError("native requires --model pointing to an existing local Valen model directory")
        import torch
        from transformers import AutoModel, AutoProcessor
        torch.set_num_threads(args.threads)
        model = AutoModel.from_pretrained(args.model, trust_remote_code=True, local_files_only=True,
                                          dtype=torch.float32, attn_implementation="eager").float().cpu().eval()
        model.backbone_autocast_dtype = None
        processor = AutoProcessor.from_pretrained(args.model, trust_remote_code=True, local_files_only=True)

        def predict(body):
            with torch.inference_mode():
                return model.predict(body, processor=processor, execution="shared_state",
                                     temperature=body.get("temperature", 1.0))
        yield predict
    else:
        from valen_sdk import Valen
        if args.backend == "onnx":
            if not args.model or not Path(args.model).is_dir():
                raise ValueError("onnx requires --model pointing to an existing local ONNX bundle")
            instance = Valen.local(args.model, variant="fp32", local_files_only=True, num_threads=args.threads)
        else:
            instance = Valen.remote(args.base_url, model=args.model or "valen-2b",
                                    api_key=os.environ.get("VALEN_API_KEY"), max_retries=0)
        with instance:
            yield instance.predict


def image_input(payload):
    """Inline media works across HTTP services; never send a client-local path."""
    return [{"role": "user", "content": [
        {"type": "input_text", "text": "Answer using only the visible image."},
        {"type": "input_image", "image_url": "data:image/png;base64," + base64.b64encode(payload).decode("ascii")},
    ]}]


def png(image):
    """Lossless 512px PNG: the pixels sent are exactly the pixels decoded, on any machine."""
    import io
    from PIL import ImageOps
    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((512, 512))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def image_bytes(path):
    from PIL import Image
    with Image.open(path) as image:
        return png(image)


def frame_image(frame):
    """RGB from the decoded YUV planes, converted by Pillow: H.264 decoding is bit-exact, ffmpeg's RGB conversion is not."""
    from PIL import Image
    if frame.format.name != "yuv420p":
        frame = frame.reformat(format="yuv420p")
    y, u, v = (Image.frombuffer("L", (plane.width, plane.height), bytes(plane), "raw", "L", plane.line_size, 1)
               for plane in frame.planes)
    # Video stores limited range (16-235 luma, 16-240 chroma); Pillow's YCbCr expects full range.
    y = y.point(lambda x: min(255, max(0, round((x - 16) * 255 / 219))))
    u, v = (c.point(lambda x: min(255, max(0, round((x - 128) * 255 / 224 + 128)))).resize(y.size, Image.BILINEAR)
            for c in (u, v))
    return Image.merge("YCbCr", (y, u, v)).convert("RGB")


def middle_frame(path):
    """Decode a bounded clip twice: count first, then keep only its middle frame."""
    import av
    with av.open(str(path)) as video:
        stream = video.streams.video[0]
        if stream.width * stream.height > 4096 * 2160:
            raise ValueError("Clip exceeds the cookbook's 4K frame limit")
        count = 0
        for _ in video.decode(video=0):
            count += 1
            if count > 1800:
                raise ValueError("Clip exceeds the cookbook's 1800-frame limit")
    if not count:
        raise ValueError("Clip contains no decodable frames")
    target = count // 2
    with av.open(str(path)) as video:
        for index, frame in enumerate(video.decode(video=0)):
            if index == target:
                return png(frame_image(frame)), {"frame_index": target, "total_frames": count,
                                            "timestamp_seconds": float(frame.time) if frame.time is not None else None}
    raise ValueError("Clip changed while decoding")


def request(predict, source, questions):
    response = predict({"input": source, "questions": questions, "temperature": 1.0})
    answers = response["answers"]
    if [a["name"] for a in answers] != [q["name"] for q in questions]:
        raise ValueError("Service returned missing or reordered answers")
    return {a["name"]: a for a in answers}


def choice_status(answer, *, threshold=0.8, margin=0.2):
    probabilities = [float(x["probability"]) for x in answer["probabilities"]]
    if (not probabilities or any(not math.isfinite(x) or not 0 <= x <= 1 for x in probabilities)
            or abs(sum(probabilities) - 1) > 1e-4):
        raise ValueError("Invalid choice probability distribution")
    selected = next(x for x in answer["probabilities"]
                    if type(x["value"]) is type(answer["choice"]) and x["value"] == answer["choice"])
    ordered = sorted(probabilities, reverse=True)
    confidence = float(selected["probability"])
    gap = ordered[0] - (ordered[1] if len(ordered) > 1 else 0)
    return confidence, confidence >= threshold and gap >= margin


def emit(value, args):
    text = json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if args.output:
        args.output.write_text(text)
    print(text, end="")
