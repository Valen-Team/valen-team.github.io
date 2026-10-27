"""Offline routing, leakage, denominator and replay checks; no model calls."""
import copy
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'static/cookbook/code'))
import unknown_categories as u


def answer(values):
    return {'name': 'intent', 'type': 'choice', 'choice': max(values, key=values.get),
            'probabilities': [{'value': k, 'probability': v} for k, v in values.items()]}


class UnknownCategories(unittest.TestCase):
    def test_none_overrides_high_probability_and_all_gates(self):
        a = answer({'refund': .001, 'shipping': .001, 'invoice': .001, 'none': .997})
        for strategy in ('B_none', 'C_none_threshold'):
            r = u.route(a, strategy, {'threshold': 0, 'margin': 0})
            self.assertEqual((r['route'], r['reason']), ('human_review', 'none_selected'))

    def test_probability_gap_and_request_errors(self):
        a = answer({'refund': .65, 'shipping': .3, 'invoice': .05})
        self.assertEqual(u.route(a, 'A_threshold', {'threshold': .8, 'margin': .2})['reason'], 'low_probability')
        self.assertEqual(u.route(a, 'A_threshold', {'threshold': .6, 'margin': .4})['reason'], 'small_margin')
        self.assertEqual(u.route(a, 'A_threshold', {'threshold': .65, 'margin': .3})['route'], 'automatic')
        self.assertEqual(u.route(None, 'B_none')['reason'], 'request_error')
        self.assertEqual(u.route(a, 'A_threshold', {'reject_all': True})['reason'], 'no_validation_rule')

    def test_malformed_output_cannot_be_accepted(self):
        good = answer({'refund': .8, 'shipping': .1, 'invoice': .1, 'none': 0})
        for change in ('nan', 'sum', 'duplicate', 'selection'):
            bad = copy.deepcopy(good)
            if change == 'nan': bad['probabilities'][0]['probability'] = float('nan')
            if change == 'sum': bad['probabilities'][0]['probability'] = .2
            if change == 'duplicate': bad['probabilities'][1]['value'] = 'refund'
            if change == 'selection': bad['choice'] = 'shipping'
            with self.subTest(change=change), self.assertRaises(ValueError):
                u.route(bad, 'B_none')

    def test_denominators_include_failures_without_crediting_detection(self):
        rows = [
            {'group_id': 'a', 'kind': 'outside', 'gold': None, 'selected': 'refund', 'route': 'automatic', 'reason': 'accepted'},
            {'group_id': 'b', 'kind': 'outside', 'gold': None, 'selected': None, 'route': 'human_review', 'reason': 'request_error'},
            {'group_id': 'c', 'kind': 'in_scope', 'gold': 'refund', 'selected': 'none', 'route': 'human_review', 'reason': 'none_selected'},
            {'group_id': 'd', 'kind': 'insufficient', 'gold': None, 'selected': 'none', 'route': 'human_review', 'reason': 'none_selected'},
        ]
        r = u.metrics(rows, bootstrap=50)
        self.assertEqual(r['outside_miss_rate']['value'], .5)
        self.assertEqual(r['outside_detection_rate']['value'], 0)
        self.assertEqual(r['accepted_error_rate']['value'], 1)
        self.assertEqual(r['coverage']['value'], .25)
        self.assertEqual(r['in_scope_review_rate']['value'], 1)
        self.assertEqual(r['counts']['request_errors'], 1)
        self.assertIsNone(u.metrics(rows[1:], bootstrap=10)['accepted_error_rate']['value'])

    def test_group_split_and_no_feasible_policy(self):
        data = u.load_dataset(ROOT / 'static/cookbook/code/unknown_categories_data.json')
        val = [r for r in data['rows'] if r['split'] == 'validation']
        test = [r for r in data['rows'] if r['split'] == 'test']
        self.assertEqual((len(val), len(test)), (100, 200))
        self.assertFalse({r['group_id'] for r in val} & {r['group_id'] for r in test})
        unknown = [r for r in val if r['kind'] != 'in_scope']
        cache = {(r['id'], 'without_none'): {'status': 'ok', 'answer': answer({'refund': 1., 'shipping': 0., 'invoice': 0.})} for r in unknown}
        self.assertTrue(u.select_policy(unknown, cache, 'A_threshold')['reject_all'])
        bad = copy.deepcopy(data)
        bad['rows'][1]['split'] = 'test'
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'data.json'
            path.write_text(json.dumps(bad))
            with self.assertRaisesRegex(ValueError, 'crosses splits'):
                u.load_dataset(path)

    def test_replay_rejects_missing_predictions_and_wrong_protocol(self):
        data = u.load_dataset(ROOT / 'static/cookbook/code/unknown_categories_data.json')
        import hashlib
        header = {'dataset_sha256': u.digest(data), 'protocol_sha256': u.digest(u.protocol()),
                  'source_sha256': hashlib.sha256(Path(u.__file__).read_bytes()).hexdigest()}
        with tempfile.TemporaryDirectory() as temp:
            args = SimpleNamespace(cache=Path(temp) / 'cache.jsonl', output=Path(temp) / 'report.json')
            args.cache.write_text(json.dumps(header) + '\n')
            with self.assertRaisesRegex(ValueError, 'exactly two'):
                u.replay(args, data)
            header['protocol_sha256'] = 'different'
            args.cache.write_text(json.dumps(header) + '\n')
            with self.assertRaisesRegex(ValueError, 'changed'):
                u.replay(args, data)


    def test_collection_hides_labels_and_resumes_without_calls(self):
        from contextlib import contextmanager
        from unittest.mock import patch
        sent = []
        @contextmanager
        def fake_client(args):
            def predict(body):
                sent.append(body)
                options = body['questions'][0]['choices']
                values = {q['value']: 1 / len(options) for q in options}
                return {'answers': [answer(values)], 'model': 'test-fixture'}
            yield predict
        data = {'rows': [{'id':'a','group_id':'secret-truth-group','split':'test',
                          'kind':'outside','gold':None,'text':'Please delete my account.'}]}
        with tempfile.TemporaryDirectory() as temp, patch.object(u, 'prediction_client', fake_client):
            args = SimpleNamespace(backend='remote', model='fixture', revision='fixture-r1',
                                   base_url='http://localhost/v1', device='cpu', threads=4,
                                   cache=Path(temp) / 'cache.jsonl')
            u.collect(args, data)
            u.collect(args, data)
            self.assertEqual(len(sent), 2)
            for body in sent:
                self.assertEqual(set(body), {'input', 'questions', 'temperature'})
                self.assertNotIn('secret-truth-group', json.dumps(body))
            self.assertEqual(len(sent[0]['questions'][0]['choices']), 3)
            self.assertEqual(len(sent[1]['questions'][0]['choices']), 4)
            self.assertEqual(len(args.cache.read_text().splitlines()), 3)
            changed = copy.deepcopy(data)
            changed['rows'][0]['text'] = 'A different message'
            with self.assertRaisesRegex(ValueError, 'identity changed'):
                u.collect(args, changed)

    def test_published_evidence_replays_and_matches_canonical_sources(self):
        import gzip
        import hashlib
        evidence = ROOT / 'static/cookbook/validation/unknown-categories'
        full_bytes = gzip.decompress((evidence / 'report.json.gz').read_bytes())
        full = json.loads(full_bytes)
        summary = json.loads((evidence / 'summary.json').read_text())
        runtime = json.loads((evidence / 'runtime.json').read_text())
        self.assertEqual(full['validation_kind'], 'real_model_execution')
        self.assertEqual(summary['complete_report_sha256'], hashlib.sha256(full_bytes).hexdigest())
        self.assertEqual(summary['results'], full['results'])
        self.assertEqual(summary['policies'], full['policies'])
        self.assertEqual(runtime['revision'], full['identity']['revision'])
        for name, sha in runtime['tested_sources'].items():
            path = evidence / name if name == 'run_cached.py' else ROOT / 'static/cookbook/code' / name
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), sha, name)
        for case in summary['cases']:
            self.assertIn({k:v for k,v in case.items() if k != 'caption'}, full['cases'])
        with tempfile.TemporaryDirectory() as temp:
            args = SimpleNamespace(cache=Path(temp) / 'cache.jsonl', output=Path(temp) / 'report.json')
            args.cache.write_bytes(gzip.decompress((evidence / 'predictions.jsonl.gz').read_bytes()))
            cached = [json.loads(line) for line in args.cache.read_text().splitlines()][1:]
            for output in summary['example']['outputs']:
                record = next(r for r in cached if r['id'] == summary['example']['id'] and r['variant'] == output['variant'])
                self.assertEqual(output['selected'], record['answer']['choice'])
                self.assertEqual(output['probabilities'], record['answer']['probabilities'])
            for strategy, decision in summary['example']['decisions'].items():
                variant = 'without_none' if strategy == 'A_threshold' else 'with_none'
                record = next(r for r in cached if r['id'] == summary['example']['id'] and r['variant'] == variant)
                self.assertEqual(decision, u.route(record['answer'], strategy, full['policies'][strategy]))
            u.replay(args, u.load_dataset(ROOT / 'static/cookbook/code/unknown_categories_data.json'))
            self.assertEqual(json.loads(args.output.read_text()), full)
        for locale in (ROOT / 'cookbook', ROOT / 'i18n/zh-Hans/docusaurus-plugin-content-docs-cookbook/current'):
            page = (locale / 'unknown-categories.mdx').read_text()
            self.assertIn('/static/cookbook/code/unknown_categories.py', page)
            self.assertIn('valen-cookbook.zip', page)
            for section in ('example', 'metrics', 'cases'):
                self.assertIn('section="' + section + '"', page)


if __name__ == '__main__':
    unittest.main()
