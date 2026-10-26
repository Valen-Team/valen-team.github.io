"""Create a reviewable visual tag from one sampled clip frame. Apache-2.0."""
from common import choice_status, client, emit, image_input, middle_frame, parser, request, samples


def run(predict, sample, asset_dir):
    payload, sampling = middle_frame(asset_dir / sample["path"])
    answer = request(predict, image_input(payload), [sample["question"]])["sauce_color"]
    confidence, certain = choice_status(answer)
    return {"clip_id": sample["id"], "tags": {"sauce_color": answer["choice"]} if certain else {},
            "status": "tagged" if certain else "manual_review", "confidence": confidence,
            "sampling": sampling, "scope": "single_frame_visual_attribute_only", "answer": answer}


def main():
    args = parser(__doc__).parse_args()
    with client(args) as predict:
        emit(run(predict, samples()["video"], args.asset_dir), args)


if __name__ == "__main__":
    main()
