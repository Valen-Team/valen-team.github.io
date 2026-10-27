"""Bounded offline evaluation using previously cached project weights."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
MODEL = Path('/mnt/shared-storage-user/mllm/liuziyu/share_data/Valen_Data/models/Valen-0.8B')
PYTHON = '/mnt/shared-storage-user/mllm/zangyuhang/valen/runs/valen-vllm-check-261022-092527/env/bin/python'
if sys.executable != PYTHON:
    env = os.environ | {'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1', 'OMP_NUM_THREADS': '4', 'TOKENIZERS_PARALLELISM': 'false'}
    env['PYTHONPATH'] = '/mnt/shared-storage-user/mllm/zangyuhang/valen/runs/valen-hf-transformers-261024-135321/deps'
    raise SystemExit(subprocess.call([PYTHON, str(Path(__file__).resolve())], env=env))
import torch
import transformers
torch.set_num_threads(8)
artifacts = {}
for p in sorted(MODEL.iterdir()):
    if p.is_file() and p.suffix in ('.json', '.py', '.jinja', '.safetensors'):
        sha = hashlib.sha256()
        with p.open('rb') as f:
            for block in iter(lambda: f.read(8 * 1024 * 1024), b''):
                sha.update(block)
        artifacts[p.name] = sha.hexdigest()
revision = hashlib.sha256(json.dumps(artifacts, sort_keys=True).encode()).hexdigest()
runtime = {'model': 'Valen-Team/Valen-0.8B', 'revision_kind': 'sha256 of sorted cached model artifact hashes',
           'revision': revision, 'artifacts_sha256': artifacts, 'torch': torch.__version__,
           'transformers': transformers.__version__, 'device': 'CPU: ' + next((line.split(':', 1)[1].strip() for line in Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')), __import__('platform').processor()),
           'threads': 8, 'cpu_affinity': sorted(os.sched_getaffinity(0)),
           'precision': 'float32', 'attention': 'eager', 'execution': 'shared_state', 'temperature': 1.0,
           'offline': True, 'model_downloaded': False, 'requests_planned': 600,
           'tested_sources': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                              for name in ('common.py', 'unknown_categories.py', 'unknown_categories_data.json', 'run_cached.py')}}
(ROOT / 'runtime.json').write_text(json.dumps(runtime, indent=2) + '\n')
import unknown_categories as recipe
recipe.main(['collect', '--backend', 'native', '--device', 'cpu', '--threads', '8', '--model', str(MODEL), '--revision', revision,
             '--dataset', str(ROOT / 'unknown_categories_data.json'), '--cache', str(ROOT / 'predictions.jsonl')])
recipe.main(['report', '--dataset', str(ROOT / 'unknown_categories_data.json'), '--cache', str(ROOT / 'predictions.jsonl'),
             '--output', str(ROOT / 'report.json')])
print('Complete: 600 cached text predictions and offline replay report.', flush=True)
