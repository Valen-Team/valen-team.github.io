"""Shared cookbook runner. Apache-2.0. No implicit model or media downloads."""
import argparse
import base64
from contextlib import contextmanager
import json
import math
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent


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
    return p


@contextmanager
def client(args):
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
        {"type": "input_image", "image_url": "data:image/jpeg;base64," + base64.b64encode(payload).decode("ascii")},
    ]}]


def image_bytes(path):
    import io
    from PIL import Image, ImageOps
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((512, 512))
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=95)
        return buffer.getvalue()


def middle_frame(path):
    """Decode a bounded clip twice: count first, then keep only its middle frame."""
    import av
    import io
    from PIL import ImageOps
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
                image = ImageOps.exif_transpose(frame.to_image()).convert("RGB")
                image.thumbnail((512, 512))
                buffer = io.BytesIO()
                image.save(buffer, format="JPEG", quality=95)
                return buffer.getvalue(), {"frame_index": target, "total_frames": count,
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
