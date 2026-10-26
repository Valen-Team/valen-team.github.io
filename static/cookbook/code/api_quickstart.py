"""API basics: text, one image and a sampled video frame. Apache-2.0."""
from common import client, emit, image_bytes, image_input, middle_frame, parser, request, samples


def main():
    args = parser(__doc__).parse_args()
    data = samples()
    with client(args) as predict:
        text = request(predict, data["ticket"]["text"], data["ticket"]["questions"])
        image = request(predict, image_input(image_bytes(args.asset_dir / data["product"]["image"])), [data["product"]["question"]])
        payload, sampling = middle_frame(args.asset_dir / data["video"]["path"])
        video_frame = request(predict, image_input(payload), [data["video"]["question"]])
        emit({"text": text, "image": image, "video_frame": video_frame, "sampling": sampling}, args)


if __name__ == "__main__":
    main()
