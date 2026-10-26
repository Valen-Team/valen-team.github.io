"""Local basics: both protocols and direct image/video inference. Apache-2.0."""
from common import client, emit, parser, request, samples


def main():
    p = parser(__doc__)
    p.set_defaults(backend="onnx")
    args = p.parse_args()
    if args.backend == "remote":
        p.error("Use api_quickstart.py for HTTP; this tutorial requires an offline local model")
    data = samples()
    from valen_sdk.protocol import to_internal
    body = {"input": data["ticket"]["text"], "questions": data["ticket"]["questions"], "temperature": 1.0}
    # The SDK adapter preserves candidate order and maps predicate to noul.
    internal = to_internal(body)
    with client(args) as predict:
        public_text = predict(body)
        system_one_text = predict(internal)
        image = request(predict, [{"role": "user", "content": [
            {"type": "input_image", "image_url": str((args.asset_dir / data["product"]["image"]).resolve())},
        ]}], [data["product"]["question"]])
        video = request(predict, [{"role": "user", "content": [
            {"type": "input_video", "video_url": str((args.asset_dir / data["video"]["path"]).resolve())},
        ]}], [data["video"]["question"], data["video"]["action_question"]])
        emit({"decisions": public_text, "system_one": system_one_text, "image": image, "video": video}, args)


if __name__ == "__main__":
    main()
