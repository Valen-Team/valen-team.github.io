"""Turn an incoming ticket into a queue and a review priority. Apache-2.0."""
from common import choice_status, client, emit, parser, request, samples


def run(predict, sample):
    answers = request(predict, sample["text"], sample["questions"])
    intent = answers["intent"]
    confidence, certain = choice_status(intent)
    probability = answers["address_change"]["probability"]
    explicitness = answers["explicitness"]["score"]
    # These are illustrative workflow thresholds, not calibrated accuracy claims.
    route = intent["choice"] if certain else "human_review"
    if route == "change_address" and probability < 0.8:
        route = "human_review"
    return {"ticket_id": sample["id"], "queue": route, "confidence": confidence,
            "address_change_probability": probability, "explicitness_score": explicitness,
            "review_priority": round(probability * explicitness / 2, 6),
            "action": "review_request_before_changing_order", "answers": list(answers.values())}


def main():
    args = parser(__doc__).parse_args()
    with client(args) as predict:
        emit(run(predict, samples()["ticket"]), args)


if __name__ == "__main__":
    main()
