"""Validate offline reports and create the small, static homepage evidence snapshot.

No network. This never fits a temperature or selects a policy on test data.
Keep raw test curves in downloadable reports; homepage choices use frozen policies.
"""
import argparse
import hashlib
import gzip
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = ("Valen-0.8B", "Valen-2B", "Valen-4B")


def read(path):
    if not path.exists() and path.with_suffix(path.suffix + ".gz").exists():
        path = path.with_suffix(path.suffix + ".gz")
    return json.loads(gzip.decompress(path.read_bytes())) if path.suffix == ".gz" else json.loads(path.read_text())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n")


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def validate(model, report):
    if report["schema_version"] != 1 or report["identity"]["model"] != "Valen-Team/" + model:
        raise ValueError("Wrong report/model identity")
    if not report.get("study", {}).get("name", "").startswith("BANKING77 retrospective"):
        raise ValueError("This homepage snapshot is scoped to the documented BANKING77 study")
    artifact = report["calibration"]
    if artifact["identity"] != report["identity"] or artifact["kind"] != "temperature":
        raise ValueError("Calibration identity mismatch")
    if not math.isfinite(artifact["temperature"]) or artifact["temperature"] <= 0:
        raise ValueError("Invalid temperature")
    test = report["test"]
    fit_groups, test_groups = set(artifact["fit"]["group_hashes"]), set(test["group_hashes"])
    if fit_groups & test_groups:
        raise ValueError("Fit/test leakage")
    if report["before"]["questions"] != test["questions"] or report["after"]["questions"] != test["questions"]:
        raise ValueError("Report count mismatch")
    for metrics in (report["before"], report["after"]):
        if len(metrics["bins"]) != 15 or sum(b["n"] for b in metrics["bins"]) != metrics["ece_questions"]:
            raise ValueError("ECE bin/count mismatch")
        for key in ("ece", "nll", "brier", "accuracy"):
            value = metrics[key]
            if value is not None and (not math.isfinite(value) or value < 0 or key in ("ece", "accuracy") and value > 1):
                raise ValueError("Invalid metric")
        n = metrics["ece_questions"]
        ece = sum(b["n"] * abs(b["mean_probability"] - b["accuracy"]) for b in metrics["bins"] if b["n"]) / n if n else None
        if metrics["ece"] is not None and (ece is None or abs(metrics["ece"] - ece) > 1e-12):
            raise ValueError("ECE disagrees with bins")
        for key in ("nll", "brier", "mae", "rps"):
            count = metrics[key + "_questions"]
            mean = metrics[key + "_sum"] / count if count else None
            if mean != metrics[key]:
                raise ValueError("Metric disagrees with sufficient sums")
    if not report.get("operating_points"):
        raise ValueError("Frozen validation policies are required")
    for operating in report["operating_points"]:
        policy, point = operating["policy"], operating["test"]
        if policy["identity"] != report["identity"] or policy["calibration_sha256"] != fingerprint(artifact):
            raise ValueError("Policy is bound to another model/calibration")
        selection = policy["selection"]
        if len({artifact["fit"]["group_namespace"], selection["group_namespace"], test["group_namespace"]}) != 1:
            raise ValueError("Split group namespace mismatch")
        policy_groups = set(selection["group_hashes"])
        if policy_groups & (fit_groups | test_groups):
            raise ValueError("Policy split leakage")
        if operating["validation_target"] != policy["max_error"] or point["threshold"] != policy["threshold"]:
            raise ValueError("Test operating point did not freeze the validation rule")
        n, errors, eligible = point["accepted"], point["errors"], point["eligible"]
        if not 0 <= errors <= n <= eligible or eligible != report["after"]["hard_questions"]:
            raise ValueError("Invalid policy denominator")
        if abs(point["coverage"] - (n / eligible if eligible else 0)) > 1e-12:
            raise ValueError("Coverage does not match counts")
        if point["error_rate"] != (errors / n if n else None):
            raise ValueError("Error rate does not match counts")
        curve = report["after"]["risk_coverage"]
        if policy["threshold"] is None:
            matched = curve[0]
        else:
            accepted_points = [p for p in curve if p["threshold"] is not None and p["threshold"] >= policy["threshold"]]
            matched = accepted_points[-1] if accepted_points else curve[0]
        if matched is None or any(matched[k] != point[k] for k in ("accepted", "errors", "coverage", "error_rate")):
            raise ValueError("Policy point does not match the measured test curve")


def small_metrics(metrics):
    result = {k: metrics[k] for k in ("ece", "nll", "brier", "accuracy", "bins", "probability_one_questions")}
    curve = metrics["risk_coverage"]
    # Chart-only sampling: never used to select thresholds or calculate metrics.
    indices = sorted({round(i * (len(curve) - 1) / 100) for i in range(101)})
    result["risk_coverage"] = [{k: curve[i][k] for k in ("coverage", "error_rate", "accepted")} for i in indices]
    return result


def import_reports(source, root=ROOT):
    reports = {model: read(source / model / "report.json") for model in MODELS}
    for model, report in reports.items():
        validate(model, report)
    if len({tuple(p["validation_target"] for p in r["operating_points"]) for r in reports.values()}) != 1:
        raise ValueError("Compare models using the same predeclared validation targets")
    if len({tuple(r["test"]["group_hashes"]) for r in reports.values()}) != 1:
        raise ValueError("Compare models on the same test cohort")
    entries = []
    for model, report in reports.items():
        prefix = "/reliability/data/" + model
        folder = root / "static" / "reliability" / "data" / model
        folder.mkdir(parents=True, exist_ok=True)
        packed = gzip.compress(json.dumps(report, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode(), mtime=0)
        (folder / "report.json.gz").write_bytes(packed)
        # Remove only the previously generated uncompressed copy, if present.
        if (folder / "report.json").exists():
            (folder / "report.json").unlink()
        write(folder / "calibration.json", report["calibration"])
        write(folder / "protocol.json", report["study"]["protocol"])
        for i, operating in enumerate(report["operating_points"]):
            write(folder / f"policy-{i}.json", operating["policy"])
        entries.append({"model": model, "status": "measured", "revision": report["identity"]["revision"],
                        "questions": report["test"]["questions"], "report_url": prefix + "/report.json.gz", "report_bytes": len(packed),
                        "calibration_url": prefix + "/calibration.json", "protocol_url": prefix + "/protocol.json",
                        "source_url": report["study"]["source_url"],
                        "scope": "BANKING77 · English · 77 candidate intents · retrospective public-test replay. Not a production or vision guarantee.",
                        "before": small_metrics(report["before"]), "after": small_metrics(report["after"]),
                        "operating_points": [{"validation_target": p["validation_target"], "test": p["test"], "policy_url": prefix + f"/policy-{i}.json"}
                                             for i, p in enumerate(report["operating_points"])]})
    snapshot = {"schema_version": 1, "scenario": "banking-intent-routing", "models": entries}
    write(root / "src" / "data" / "reliability.json", snapshot)
    return snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory containing <model>/report.json")
    args = parser.parse_args()
    snapshot = import_reports(args.source)
    print("Imported verified reports:", ", ".join(m["model"] for m in snapshot["models"]))


if __name__ == "__main__":
    main()
