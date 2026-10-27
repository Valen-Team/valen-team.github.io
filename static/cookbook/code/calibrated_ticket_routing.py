"""Route tickets with fitted parameters and a frozen review policy. Apache-2.0."""
import argparse
import json


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--model-id")
    parser.add_argument("--revision")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--request", required=True)
    parser.add_argument("--protocol", required=True)
    parser.add_argument("--calibration", required=True)
    parser.add_argument("--policy", required=True)
    args = parser.parse_args(argv)
    from valen.evaluation.calibration import load_calibration, read_json
    from valen.reliability_collect import LocalRelease
    from valen.routing import route_choice
    model = LocalRelease(args.model_dir, read_json(args.protocol), model_id=args.model_id,
                         revision=args.revision, device=args.device)
    calibration = load_calibration(args.calibration, model.identity)
    policy = read_json(args.policy)
    request = read_json(args.request)
    questions = request["questions"]
    if len(questions) != 1 or next(iter(questions.values()))["type"] != "choice":
        raise ValueError("This example expects one Choice question")
    qid = next(iter(questions))
    try:
        keys, logits = model.logits(request)[qid]
    except Exception as exc:
        result = {"route": "human_review", "reason": "inference_failed", "error_type": type(exc).__name__}
    else:
        result = route_choice(keys, logits, calibration, policy)
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))


if __name__ == "__main__":
    main()
