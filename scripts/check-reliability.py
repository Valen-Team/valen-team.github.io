"""Offline evidence publication checks, using the actual retained aggregate reports."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("reliability_import", ROOT / "scripts/import-reliability.py")
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class EvidencePublication(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = ROOT / "static/reliability/data"
        cls.reports = {model: publisher.read(cls.source / model / "report.json") for model in publisher.MODELS}

    def test_real_reports_pass_and_share_test_groups(self):
        groups = []
        for model, report in self.reports.items():
            publisher.validate(model, report)
            groups.append(report["test"]["group_hashes"])
            self.assertEqual(report["test"]["questions"], 1276)
            self.assertEqual(report["calibration"]["fit"]["questions"], 908)
            self.assertEqual(report["policy"]["selection"]["questions"], 896)
        self.assertTrue(all(g == groups[0] for g in groups))

    def test_snapshot_is_reproducible_and_all_downloads_exist(self):
        snapshot = publisher.read(ROOT / "src/data/reliability.json")
        with tempfile.TemporaryDirectory() as temp:
            rebuilt = publisher.import_reports(self.source, Path(temp))
        self.assertEqual(snapshot, rebuilt)
        for model in snapshot["models"]:
            for field in ("report_url", "calibration_url", "protocol_url"):
                self.assertTrue((ROOT / "static" / model[field].lstrip("/")).is_file())
            for point in model["operating_points"]:
                self.assertTrue((ROOT / "static" / point["policy_url"].lstrip("/")).is_file())

    def test_model_or_calibration_mismatch_cannot_be_published(self):
        report = copy.deepcopy(self.reports["Valen-0.8B"])
        report["calibration"]["temperature"] = 1
        with self.assertRaises(ValueError): publisher.validate("Valen-0.8B", report)
        with self.assertRaises(ValueError): publisher.validate("Valen-4B", self.reports["Valen-0.8B"])

    def test_changed_denominator_cannot_be_published(self):
        report = copy.deepcopy(self.reports["Valen-0.8B"])
        report["operating_points"][-1]["test"]["eligible"] += 1
        with self.assertRaises(ValueError): publisher.validate("Valen-0.8B", report)

    def test_test_group_leakage_cannot_be_published(self):
        report = copy.deepcopy(self.reports["Valen-0.8B"])
        report["test"]["group_hashes"].append(report["calibration"]["fit"]["group_hashes"][0])
        with self.assertRaises(ValueError): publisher.validate("Valen-0.8B", report)

    def test_regressions_and_accept_nothing_states_are_retained(self):
        snapshot = publisher.read(ROOT / "src/data/reliability.json")
        model = next(m for m in snapshot["models"] if m["model"] == "Valen-4B")
        self.assertGreater(model["after"]["ece"], model["before"]["ece"])
        self.assertGreater(model["after"]["brier"], model["before"]["brier"])
        self.assertEqual(model["operating_points"][0]["test"]["accepted"], 0)
        self.assertIsNone(model["operating_points"][0]["test"]["error_rate"])

    def test_public_reports_contain_no_remote_paths_or_per_question_payloads(self):
        for report in self.reports.values():
            text = json.dumps(report)
            self.assertNotIn("/mnt/", text)
            self.assertNotIn("/home/", text)
            self.assertNotIn('"rows":', text)
            self.assertNotIn('"request":', text)
            self.assertEqual(report["verification"]["argmax_changes"], 0)


if __name__ == "__main__":
    unittest.main()
