"""Choice with an explicit none option, optional review gates and offline replay. Apache-2.0."""
import hashlib
import json
import math
from pathlib import Path
import random
from collections import Counter
from contextlib import contextmanager

from common import client, parser

HERE = Path(__file__).resolve().parent
CHOICES = [
    {"value": "refund", "description": "Requests money back, a payment reversal, or reimbursement."},
    {"value": "shipping", "description": "Asks about shipment progress, tracking, delivery time, or parcel location."},
    {"value": "invoice", "description": "Requests or corrects an invoice or receipt, or asks about its contents."},
]
NONE = {"value": "none", "description": "None of the three categories applies, or the message lacks enough information to choose one."}
INSTRUCTIONS = "Classify the customer's current request using only the supplied message and the candidate descriptions. Do not invent missing context."
STRATEGIES = ("A_threshold", "B_none", "C_none_threshold")


@contextmanager
def prediction_client(args):
    if args.backend != "native":
        with client(args) as predict:
            yield predict
        return
    if not args.model or not Path(args.model).is_dir():
        raise ValueError("native requires an existing model directory; no implicit download")
    import torch
    from transformers import AutoModel, AutoProcessor
    if args.threads < 1:
        raise ValueError("--threads must be positive")
    torch.set_num_threads(args.threads)
    model = AutoModel.from_pretrained(args.model, trust_remote_code=True, local_files_only=True,
                                      dtype=torch.float32, attn_implementation="eager").float().to(args.device).eval()
    model.backbone_autocast_dtype = None
    processor = AutoProcessor.from_pretrained(args.model, trust_remote_code=True, local_files_only=True)
    def predict(body):
        with torch.inference_mode():
            return model.predict(body, processor=processor, execution="shared_state", temperature=1.0)
    yield predict


def runtime_identity(args):
    return {"backend": args.backend, "model": args.model, "revision": args.revision,
            "base_url": args.base_url if args.backend == "remote" else None,
            "device": args.device if args.backend == "native" else None,
            "threads": args.threads, "temperature": 1.0}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def question(with_none):
    return {"name": "intent", "type": "choice", "instructions": INSTRUCTIONS,
            "choices": CHOICES + ([NONE] if with_none else [])}


def validated_answer(answer, with_none):
    expected = [c["value"] for c in question(with_none)["choices"]]
    values = answer["probabilities"]
    if (len(values) != len(expected) or {v["value"] for v in values} != set(expected)
            or any(type(v["probability"]) not in (int, float) or not math.isfinite(v["probability"])
                   or not 0 <= v["probability"] <= 1 for v in values)
            or abs(sum(v["probability"] for v in values) - 1) > 1e-4):
        raise ValueError("Invalid candidate probabilities")
    probabilities = {v["value"]: v["probability"] for v in values}
    selected = answer["choice"]
    if selected not in probabilities or probabilities[selected] < max(probabilities.values()) - 1e-7:
        raise ValueError("Selected value is not a maximum-probability candidate")
    return probabilities


def route(answer, strategy, policy=None):
    if strategy not in STRATEGIES:
        raise ValueError("Unknown strategy")
    if answer is None:
        return {"selected": None, "route": "human_review", "reason": "request_error"}
    with_none = strategy != "A_threshold"
    p = validated_answer(answer, with_none)
    selected = answer["choice"]
    ordered = sorted(p.values(), reverse=True)
    result = {"selected": selected, "probability": p[selected], "margin": ordered[0] - ordered[1],
              "probabilities": answer["probabilities"], "route": "human_review"}
    if with_none and selected == "none":
        result["reason"] = "none_selected"
    elif strategy == "B_none":
        result.update(route="automatic", reason="accepted")
    elif policy is None:
        raise ValueError("A frozen policy is required")
    elif policy.get("reject_all"):
        result["reason"] = "no_validation_rule"
    elif p[selected] < policy["threshold"]:
        result["reason"] = "low_probability"
    elif result["margin"] < policy["margin"]:
        result["reason"] = "small_margin"
    else:
        result.update(route="automatic", reason="accepted")
    return result


def load_dataset(path):
    data = json.loads(Path(path).read_text())
    ids, groups, texts = set(), {}, {}
    for row in data["rows"]:
        if (not row["id"] or row["id"] in ids or not row["group_id"] or not row["text"].strip()
                or row["split"] not in ("validation", "test")
                or row["kind"] not in ("in_scope", "outside", "insufficient")
                or (row["kind"] == "in_scope" and row["gold"] not in {c["value"] for c in CHOICES})
                or (row["kind"] != "in_scope" and row["gold"] is not None)):
            raise ValueError("Invalid dataset row")
        ids.add(row["id"])
        identity = (row["split"], row["kind"], row["gold"])
        if groups.setdefault(row["group_id"], identity) != identity:
            raise ValueError("Source group crosses splits or labels")
        if texts.setdefault(row["text"], row["group_id"]) != row["group_id"]:
            raise ValueError("Duplicate text across source groups")
    if {r["split"] for r in data["rows"]} != {"validation", "test"}:
        raise ValueError("Both validation and test are required")
    return data


def protocol():
    return {"temperature": 1.0, "without_none": question(False), "with_none": question(True)}


def collect(args, data):
    identity = runtime_identity(args)
    header = {"schema_version": 1, "dataset_sha256": digest(data), "protocol_sha256": digest(protocol()),
              "identity": identity, "source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    args.cache.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if args.cache.exists():
        lines = args.cache.read_text().splitlines()
        if not lines or json.loads(lines[0]) != header:
            raise ValueError("Cache identity changed; use a new cache path")
        existing = [json.loads(line) for line in lines[1:]]
    keys = [(r["id"], r["variant"]) for r in existing]
    expected = {(r["id"], v) for r in data["rows"] for v in ("without_none", "with_none")}
    if len(keys) != len(set(keys)) or not set(keys) <= expected:
        raise ValueError("Duplicate or unexpected cache rows")
    seen = set(keys)
    # Failures are retained and never silently retried; a resume only fills missing requests.
    with args.cache.open("a") as f:
        if not args.cache.stat().st_size:
            f.write(json.dumps(header) + "\n")
            f.flush()
        if seen == expected:
            return
        with prediction_client(args) as predict:
            for row in data["rows"]:
                for variant in ("without_none", "with_none"):
                    if (row["id"], variant) in seen:
                        continue
                    result = {"id": row["id"], "variant": variant}
                    try:
                        response = predict({"input": row["text"], "questions": [question(variant == "with_none")], "temperature": 1.0})
                        answers = response["answers"]
                        if len(answers) != 1 or answers[0]["name"] != "intent":
                            raise ValueError("Missing or unexpected answer")
                        answer = answers[0]
                        validated_answer(answer, variant == "with_none")
                        result.update(status="ok", answer=answer, resolved_model=response.get("model"))
                    except Exception as exc:
                        result.update(status="error", error_type=type(exc).__name__)
                    f.write(json.dumps(result, ensure_ascii=False, allow_nan=False) + "\n")
                    f.flush()
                    if result["status"] == "error" and not seen:
                        raise RuntimeError("First request failed; stopped to avoid unnecessary traffic. Inspect cache.")
                    seen.add((row["id"], variant))


def decisions(rows, cache, strategy, policy):
    variant = "without_none" if strategy == "A_threshold" else "with_none"
    out = []
    for row in rows:
        record = cache[(row["id"], variant)]
        result = route(record["answer"] if record["status"] == "ok" else None, strategy, policy)
        out.append({**row, **result})
    return out


def counts(rows):
    accepted = [r for r in rows if r["route"] == "automatic"]
    return {"requests": len(rows), "source_groups": len({r["group_id"] for r in rows}),
            "accepted": len(accepted),
            "accepted_errors": sum(r["kind"] != "in_scope" or r["selected"] != r["gold"] for r in accepted),
            "outside": sum(r["kind"] == "outside" for r in rows),
            "outside_accepted": sum(r["kind"] == "outside" for r in accepted),
            "in_scope": sum(r["kind"] == "in_scope" for r in rows),
            "in_scope_review": sum(r["kind"] == "in_scope" and r["route"] == "human_review" for r in rows),
            "insufficient": sum(r["kind"] == "insufficient" for r in rows),
            "insufficient_review": sum(r["kind"] == "insufficient" and r["route"] == "human_review" for r in rows),
            "request_errors": sum(r["reason"] == "request_error" for r in rows),
            "outside_detected": sum(r["kind"] == "outside" and r["route"] == "human_review" and r["reason"] != "request_error" for r in rows)}


RATIOS = {"coverage": ("accepted", "requests"), "accepted_error_rate": ("accepted_errors", "accepted"),
          "outside_miss_rate": ("outside_accepted", "outside"),
          "in_scope_review_rate": ("in_scope_review", "in_scope"),
          "insufficient_review_rate": ("insufficient_review", "insufficient"),
          "outside_detection_rate": ("outside_detected", "outside")}


def metrics(rows, bootstrap=1000):
    c = counts(rows)
    result = {"counts": c, "reasons": dict(Counter(r["reason"] for r in rows))}
    groups = {}
    for r in rows:
        groups.setdefault(r["group_id"], []).append(r)
    grouped = list(groups.values())
    rng = random.Random(20261027)
    samples = {key: [] for key in RATIOS}
    for _ in range(bootstrap):
        sampled = counts([r for group in rng.choices(grouped, k=len(grouped)) for r in group])
        for key, (num, den) in RATIOS.items():
            if sampled[den]:
                samples[key].append(sampled[num] / sampled[den])
    for key, (num, den) in RATIOS.items():
        values = sorted(samples[key])
        result[key] = {"value": c[num] / c[den] if c[den] else None,
                       "ci95": [values[int((len(values)-1)*q)] for q in (.025, .975)] if values else None}
    return result


def select_policy(rows, cache, strategy, max_error=.05):
    best = None
    for threshold in (0, .5, .6, .7, .8, .85, .9, .95, .98, .99, 1.0):
        for margin in (0, .1, .2, .3, .4, .5):
            policy = {"threshold": threshold, "margin": margin, "reject_all": False}
            routed = decisions(rows, cache, strategy, policy)
            c = counts(routed)
            accepted_groups = len({r["group_id"] for r in routed if r["route"] == "automatic"})
            if c["accepted"] and accepted_groups >= 5 and c["accepted_errors"] / c["accepted"] <= max_error:
                rank = (c["accepted"], -c["accepted_errors"], -threshold, -margin)
                if best is None or rank > best[0]:
                    best = (rank, policy)
    return {**(best[1] if best else {"reject_all": True, "threshold": None, "margin": None}),
            "validation_observed_error_target": max_error, "min_accepted_source_groups": 5,
            "selection": "maximum validation coverage, then fewer errors, then lower threshold and margin; no test tuning"}


def replay(args, data):
    lines = [json.loads(line) for line in args.cache.read_text().splitlines()]
    header = lines[0]
    if (header["dataset_sha256"] != digest(data) or header["protocol_sha256"] != digest(protocol())
            or header["source_sha256"] != hashlib.sha256(Path(__file__).read_bytes()).hexdigest()):
        raise ValueError("Dataset, protocol or collection source changed")
    keys = [(r["id"], r["variant"]) for r in lines[1:]]
    expected = {(r["id"], v) for r in data["rows"] for v in ("without_none", "with_none")}
    if len(keys) != len(set(keys)) or set(keys) != expected:
        raise ValueError("Cache must contain exactly two predictions per row")
    cache = dict(zip(keys, lines[1:]))
    for (_, variant), record in cache.items():
        if record["status"] == "ok":
            validated_answer(record["answer"], variant == "with_none")
        elif record["status"] != "error":
            raise ValueError("Unknown prediction status")
    validation = [r for r in data["rows"] if r["split"] == "validation"]
    test = [r for r in data["rows"] if r["split"] == "test"]
    policies = {s: select_policy(validation, cache, s) if s != "B_none" else None for s in STRATEGIES}
    report = {"schema_version": 1, "validation_kind": "real_model_execution", "identity": header["identity"],
              "dataset_sha256": digest(data), "protocol_sha256": digest(protocol()),
              "cache_sha256": hashlib.sha256(args.cache.read_bytes()).hexdigest(),
              "source_sha256": header["source_sha256"], "resolved_models": sorted({r["resolved_model"] for r in lines[1:] if r.get("resolved_model")}),
              "confidence_interval": "95% percentile bootstrap, 1000 resamples of source groups, seed 20261027; descriptive, not an operational guarantee",
              "scope": data["description"], "policies": policies, "results": {}, "cases": []}
    for strategy in STRATEGIES:
        test_rows = decisions(test, cache, strategy, policies[strategy])
        report["results"][strategy] = {"validation": metrics(decisions(validation, cache, strategy, policies[strategy])),
                                      "test": metrics(test_rows)}
        # Publish all test decisions; tutorials choose examples without hiding failures.
        report["cases"].extend({"strategy": strategy, **r} for r in test_rows)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def main(argv=None):
    p = parser(__doc__)
    p.add_argument("command", choices=("collect", "report", "demo"))
    p.add_argument("--dataset", type=Path, default=HERE / "unknown_categories_data.json")
    p.add_argument("--cache", type=Path, default=Path("unknown-predictions.jsonl"))
    p.add_argument("--device", default="cpu", help="Existing native model execution device, e.g. cpu or cuda")
    p.add_argument("--revision", help="Pinned revision or explicit deployment identifier, recorded with predictions")
    p.add_argument("--policy", type=Path, help="Report from this model/deployment and protocol")
    p.add_argument("--text", default="Please delete my account and erase my personal data.")
    args = p.parse_args(argv)
    if args.command == "collect":
        if not args.revision or not args.model:
            p.error("collect requires --model and --revision; do not mix deployments in one cache")
        collect(args, load_dataset(args.dataset))
    elif args.command == "report":
        if args.output is None:
            p.error("report requires --output")
        replay(args, load_dataset(args.dataset))
    else:
        frozen = None
        if args.policy:
            report = json.loads(args.policy.read_text())
            identity = report["identity"]
            actual = runtime_identity(args)
            if report["protocol_sha256"] != digest(protocol()) or identity != actual:
                raise ValueError("Policy model/deployment or protocol mismatch; collect and fit your own policy")
            frozen = report["policies"]["C_none_threshold"]
        with prediction_client(args) as predict:
            try:
                response = predict({"input": args.text, "questions": [question(True)], "temperature": 1.0})
                answer = response["answers"][0]
                validated_answer(answer, True)
            except Exception:
                answer = None
            result = route(answer, "C_none_threshold" if frozen is not None else "B_none", frozen)
        print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
