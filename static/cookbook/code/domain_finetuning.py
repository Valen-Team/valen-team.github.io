"""Small CC0-authored support-domain pipeline; reuses Valen training/evaluation.

Code: Apache-2.0 (Cookbook code license). Synthetic example text/labels: CC0-1.0.
No external dataset, model download or training loop is implemented here.
"""
import argparse
import hashlib
import json
from pathlib import Path
import random

# Independent authored situations, not augmentations of one shared source.
SPLITS = {
    'train': [('Please send my parcel to my new home.', 'address'),
              ('Cancel the duplicate order.', 'cancel'),
              ('How much does delivery cost?', 'other'),
              ('The house number on my order is wrong.', 'address'),
              ('I do not want this purchase anymore.', 'cancel'),
              ('What are your opening hours?', 'other'),
              ('Use my office as the shipping destination.', 'address'),
              ('Stop processing this order and refund it.', 'cancel'),
              ('Is the blue version in stock?', 'other'),
              ('My postcode needs correcting before dispatch.', 'address'),
              ('I ordered by mistake; please void it.', 'cancel'),
              ('Can I pay with a gift card?', 'other')],
    'validation': [('The street name entered at checkout needs an update.', 'address'),
                   ('Withdraw my purchase before shipment.', 'cancel'),
                   ('Does the warranty cover accidental damage?', 'other')],
    'test': [('Deliver to the apartment across the road instead.', 'address'),
             ('Terminate this transaction; I no longer need the item.', 'cancel'),
             ('Which sizes are available?', 'other')],
}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def prepare(args):
    root = Path(args.output).resolve()
    if root.exists() and any(root.iterdir()):
        raise FileExistsError('Use a fresh output directory; existing experiment is preserved')
    root.mkdir(parents=True, exist_ok=True)
    model = Path(args.model).resolve()
    settings = json.loads((model / 'config.json').read_text())
    if settings.get('model_type') != 'valen_qwen':
        raise ValueError('Expected a cached complete Valen main revision')
    if settings.get('auto_map', {}).get('AutoModel', '').endswith('ValenQwenWithLoRA'):
        raise ValueError('Adapter-only model is not a complete starting model')
    for split, rows in SPLITS.items():
        records = []
        for i, (text, label) in enumerate(rows):
            records.append({'group_id': f'authored-{split}-{i}',
                'request': {'state': text, 'questions': {'intent': {'type': 'choice',
                    'instructions': 'Classify the requested customer-support action.',
                    'criteria': {'address': 'Change delivery address', 'cancel': 'Cancel the order',
                                 'other': 'Another request'}}}},
                'targets': {'intent': {'probabilities': {k: float(k == label)
                    for k in ['address', 'cancel', 'other']}}},
                'meta': {'domain': 'synthetic_support', 'language_bucket': 'en', 'modality': 'text'}})
        (root / (split + '.jsonl')).write_text(''.join(json.dumps(r) + '\n' for r in records))
    # Reuse the existing released-checkpoint LoRA recipe, overriding only this experiment.
    cfg = json.loads(Path(args.recipe).read_text())
    cfg['model'].update(model_path=str(model), dtype='bf16', attn_implementation='sdpa')
    cfg['data'].update(path=str(root / 'train.jsonl'), max_length=2048)
    cfg['training'].update(output=str(root / 'run'), max_steps=1, epochs=2,
        tokens_per_step=1024, microbatch_max_tokens=2048, save_every=1,
        lora_rank=8, lora_alpha=16, loss_reduction='question_mean')
    write_json(root / 'config.json', cfg)
    cfg['training']['max_steps'] = 2
    write_json(root / 'resume.json', cfg)
    (root / 'DATA-LICENSE.txt').write_text('Synthetic support text and labels authored for this recipe: CC0-1.0.\nReplace with authorized representative data before drawing quality conclusions.\n')
    check(root)


def check(root):
    from valen.data.schema import read_jsonl
    groups, states, report = set(), set(), {}
    for split in ['train', 'validation', 'test']:
        path = root / (split + '.jsonl')
        records = read_jsonl(path)
        local_groups = {r['group_id'] for r in records}
        # Exact normalized text duplicates only; semantic leakage needs human/source review.
        local_states = {' '.join(r['request']['state'].lower().split()) for r in records}
        if groups & local_groups or states & local_states or len(local_states) != len(records):
            raise ValueError('Cross-split group/state overlap or duplicate state')
        groups |= local_groups
        states |= local_states
        report[split] = {'records': len(records), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    report['scope'] = 'Schema, group and exact normalized-state overlap; not semantic leakage detection or quality evaluation'
    write_json(root / 'data-check.json', report)
    print(json.dumps(report))


def baseline(args):
    import torch
    from valen.training.runner import normalize_config
    from valen.modeling.factory import build_model, optimizer_groups
    from valen.training.checkpoint import save_checkpoint
    cfg = normalize_config(json.loads(Path(args.config).read_text()))
    torch.manual_seed(cfg.get('seed', 42))
    model = build_model(cfg)
    optimizer = torch.optim.AdamW(optimizer_groups(model, cfg), weight_decay=cfg.get('weight_decay', .01))
    # Save the unmodified starting model through the existing checkpoint writer.
    save_checkpoint(args.output, model, optimizer, cfg,
        {'epoch': 0, 'cursor': 0, 'step': 0, 'order': None}, random.Random(42))


def compare(args):
    before = json.loads(Path(args.before).read_text())
    after = json.loads(Path(args.after).read_text())
    write_json(Path(args.output), {'validation_kind': 'real_model_smoke_comparison',
        'test_records': 3, 'quality_improvement_claimed': False,
        'note': 'Same independent authored test; tiny synthetic sample cannot establish domain quality.',
        'before': before, 'after': after})


def main():
    p = argparse.ArgumentParser(__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    q = sub.add_parser('prepare')
    q.add_argument('--model', required=True)
    q.add_argument('--recipe', default='configs/train/qwen/sft_finetune_lora.json')
    q.add_argument('--output', default='output/domain')
    q = sub.add_parser('check'); q.add_argument('--output', default='output/domain')
    q = sub.add_parser('baseline'); q.add_argument('--config', required=True); q.add_argument('--output', required=True)
    q = sub.add_parser('compare')
    for name in ['before', 'after', 'output']: q.add_argument('--' + name, required=True)
    args = p.parse_args()
    if args.command == 'check': check(Path(args.output))
    else: globals()[args.command](args)


if __name__ == '__main__':
    main()
