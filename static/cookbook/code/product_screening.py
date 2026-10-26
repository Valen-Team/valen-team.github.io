"""Screen photographic print listings for image/category mismatch. Apache-2.0."""
from common import choice_status, client, emit, image_bytes, image_input, parser, request, samples


def run(predict, sample, asset_dir):
    answer = request(predict, image_input(image_bytes(asset_dir / sample["image"])), [sample["question"]])["group"]
    confidence, certain = choice_status(answer)
    listings = []
    for listing in sample["listings"]:
        probability = next(x["probability"] for x in answer["probabilities"] if x["value"] == listing["expected_group"])
        status = "manual_review" if not certain else "accept" if answer["choice"] == listing["expected_group"] else "category_mismatch"
        listings.append({**listing, "status": status, "category_match_probability": probability})
    return {"listings": sorted(listings, key=lambda x: x["category_match_probability"], reverse=True),
            "predicted_group": answer["choice"], "confidence": confidence, "answer": answer}


def main():
    args = parser(__doc__).parse_args()
    with client(args) as predict:
        emit(run(predict, samples()["product"], args.asset_dir), args)


if __name__ == "__main__":
    main()
