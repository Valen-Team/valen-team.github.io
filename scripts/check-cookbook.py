"""Offline policy tests, source checks and deterministic download bundle."""
import argparse
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CODE = ROOT / 'static/cookbook/code'
sys.dont_write_bytecode = True
sys.path.insert(0, str(CODE))
from common import choice_status
from ticket_routing import run as route

# The command each page shows, for recipes that take more than the shared options.
REPLAY_COMMANDS = {
    'skill_support_router': ['--message', 'Order was super late AND they forgot my drink', '--order-status', 'delivered'],
    'unknown_categories': ['demo', '--text', 'Please change the delivery address before you ship my order.'],
}

class Policies(unittest.TestCase):
    def choice(self, probabilities):
        return {'choice': 'change_address', 'probabilities': [
            {'value': 'change_address', 'probability': probabilities[0]},
            {'value': 'cancel', 'probability': probabilities[1]}]}

    def test_uncertain_choices_go_to_review(self):
        self.assertFalse(choice_status(self.choice([.55, .45]))[1])
        self.assertTrue(choice_status(self.choice([.9, .1]))[1])

    def test_invalid_probabilities_are_rejected(self):
        for probabilities in [[float('nan'), .1], [1.1, -.1], [.5, .1]]:
            with self.subTest(probabilities=probabilities), self.assertRaises(ValueError):
                choice_status(self.choice(probabilities))

    def test_cross_question_disagreement_requires_review(self):
        sample = json.loads((CODE / 'samples.json').read_text())['ticket']
        response = [{'name': 'intent', **self.choice([.99, .01])},
                    {'name': 'address_change', 'probability': .1},
                    {'name': 'explicitness', 'score': .2}]
        result = route(lambda _: {'answers': response}, sample)
        self.assertEqual(result['queue'], 'human_review')
        self.assertEqual(result['action'], 'review_request_before_changing_order')

    def test_business_scripts_compile_and_have_entrypoints(self):
        for path in CODE.glob('*.py'):
            tree = ast.parse(path.read_text(), filename=str(path))
            compile(tree, str(path), 'exec')
            if path.stem != 'common':
                self.assertIn('def main(', path.read_text())

    def test_every_recipe_imports_its_canonical_code(self):
        for locale in [ROOT / 'cookbook', ROOT / 'i18n/zh-Hans/docusaurus-plugin-content-docs-cookbook/current']:
            for recipe in ['api-quickstart', 'local-inference', 'ticket-routing', 'product-screening', 'video-tagging']:
                text = (locale / (recipe + '.mdx')).read_text()
                self.assertIn('/static/cookbook/code/' + recipe.replace('-', '_') + '.py', text)
                self.assertIn('<CookbookEvidence', text)
                self.assertIn('valen-cookbook.zip', text)

    def test_calibrated_routing_has_one_canonical_script_and_inputs(self):
        import subprocess
        names = ['calibrated_ticket_routing.py', 'calibration_protocol.json', 'calibration_request.json']
        for locale in [ROOT / 'cookbook', ROOT / 'i18n/zh-Hans/docusaurus-plugin-content-docs-cookbook/current']:
            text = (locale / 'calibrated-routing.mdx').read_text()
            for name in names:
                self.assertIn('/static/cookbook/code/' + name, text)
                self.assertTrue((CODE / name).is_file())
            self.assertIn('valen-cookbook.zip', text)
        request = json.loads((CODE / 'calibration_request.json').read_text())
        self.assertEqual(request['questions']['intent']['type'], 'choice')
        result = subprocess.run([sys.executable, '-I', str(CODE / names[0]), '--help'],
                                capture_output=True, text=True, check=True)
        self.assertIn('--calibration', result.stdout)
        self.assertIn('--policy', result.stdout)

    def test_published_code_matches_real_model_execution(self):
        evidence = json.loads((ROOT / 'static/cookbook/results.json').read_text())
        self.assertEqual(evidence['validation_kind'], 'real_model_execution')
        self.assertEqual(len(evidence['recipes']), 5)
        for recipe in evidence['recipes'].values():
            self.assertEqual(recipe['status'], 'verified')
            self.assertTrue(recipe['revision'])
            self.assertTrue(recipe['result'])
        for filename, digest in evidence['tested_sources'].items():
            self.assertEqual(hashlib.sha256((CODE / filename).read_bytes()).hexdigest(), digest,
                             'Code changed after real-model validation: ' + filename)

    def test_recipes_replay_their_recorded_answers(self):
        import subprocess
        evidence = json.loads((ROOT / 'static/cookbook/results.json').read_text())['recipes']
        for path in sorted((CODE / 'caches').glob('*.json')):
            with self.subTest(recipe=path.stem):
                command = REPLAY_COMMANDS.get(path.stem, ['--asset-dir', str(CODE.parent)])
                result = subprocess.run([sys.executable, str(CODE / (path.stem + '.py')), *command, '--replay', 'only'],
                                        capture_output=True, text=True, cwd=CODE,
                                        env={'PYTHONDONTWRITEBYTECODE': '1', 'PATH': os.environ['PATH']})
                self.assertEqual(result.returncode, 0, result.stderr)
                published = CODE.parent / 'outputs' / (path.stem + '.json')
                expected = (json.loads(published.read_text()) if published.exists()
                            else evidence[path.stem.replace('_', '-')]['result'])
                self.assertEqual(json.loads(result.stdout), expected)

    def test_domain_recipe_is_bound_to_real_training_smoke(self):
        report = json.loads((ROOT / 'static/cookbook/validation/p2-finetuning.json').read_text())
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(report['validation_kind'], 'real_model_smoke')
        self.assertEqual(report['before']['step'], 0)
        self.assertEqual(report['after']['step'], 2)
        self.assertFalse(report['quality_improvement_claimed'])
        self.assertFalse(report['export_validated'])
        for filename, digest in report['tested_sources'].items():
            self.assertEqual(hashlib.sha256((CODE / filename).read_bytes()).hexdigest(), digest)
        for locale in [ROOT / 'cookbook', ROOT / 'i18n/zh-Hans/docusaurus-plugin-content-docs-cookbook/current']:
            self.assertIn('/static/cookbook/code/domain_finetuning.py', (locale / 'domain-finetuning.mdx').read_text())

    def test_failures_and_backend_scope_remain_visible(self):
        validation = ROOT / 'static/cookbook/validation'
        release = json.loads((validation / 'release-checks.json').read_text())
        performance = json.loads((validation / 'performance.json').read_text())
        self.assertTrue(release['completed'])
        self.assertTrue(release['passed'])
        self.assertFalse(performance['passed'])  # Do not erase the unsupported video probe.
        failures = [row for row in performance['records'] if not row['passed']]
        self.assertEqual([(row['backend'], row['modality']) for row in failures], [('gguf-q8', 'video')])
        self.assertEqual(len([row for row in performance['records'] if row['passed']]), 8)
        fixture = release['fixture_sha256']
        for name in ['native-fp32', 'onnx-fp32', 'onnx-production', 'gguf-prebuilt', 'gguf-source-video']:
            report = json.loads((validation / (name + '-contract.json')).read_text())
            self.assertEqual(report['fixture_sha256'], fixture)
            self.assertTrue(report['passed'])
            self.assertTrue(all(row['passed'] for row in report['records']))
        self.assertNotIn('video', json.loads((validation / 'gguf-prebuilt-contract.json').read_text())['scope'])
        self.assertIn('video', json.loads((validation / 'gguf-source-video-contract.json').read_text())['scope'])


def main():
    p = argparse.ArgumentParser(__doc__)
    p.add_argument('--bundle', action='store_true')
    args = p.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Policies)
    suite.addTests(unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_unknown_categories.py'))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    if args.bundle:
        # Generated from maintained files; the archive is never hand-edited.
        with zipfile.ZipFile(ROOT / 'static/cookbook/valen-cookbook.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(CODE.rglob('*')):
                if not path.is_file() or '__pycache__' in path.parts:
                    continue
                info = zipfile.ZipInfo('valen-cookbook/' + path.relative_to(CODE).as_posix(), (2026, 10, 26, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                archive.writestr(info, path.read_bytes())
        print('Generated cookbook download from canonical source files.')


if __name__ == '__main__':
    main()
