"""Validate the launch body with pinned official Pydantic models, without executing a run.
Pass --upstream to an unchanged DeerFlow source checkout at the documented commit.
"""
import argparse
import importlib.util
import json
import subprocess
import sys
import types
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--upstream', required=True)
root = Path(parser.parse_args().upstream).resolve()
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
assert commit == 'd4ed40075f9101db6424b2331ea410934af146ac'
# Namespace only the parents; execute the exact official modules below, avoiding
# unrelated runtime initialization and service credentials during schema checks.
for name in ['deerflow', 'deerflow.runtime', 'deerflow.utils']:
    module = types.ModuleType(name)
    module.__path__ = []
    sys.modules[name] = module

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, root / path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

load('deerflow.runtime.stream_modes', 'backend/packages/harness/deerflow/runtime/stream_modes.py')
load('deerflow.utils.thread_id', 'backend/packages/harness/deerflow/utils/thread_id.py')
models = load('deerflow_gateway_run_models', 'backend/app/gateway/run_models.py')
id = 'ca8ada3d-cefd-4dad-b2ef-a36b08ebc664'
body = {'input': {'messages': [{'id': id, 'role': 'user', 'content': 'Ordinary research contract fixture'}]}, 'context': {'model_name': 'gemini-3.8-flash'}, 'metadata': {'floatboat_operation_id': id}, 'stream_mode': ['values', 'updates'], 'multitask_strategy': 'reject', 'on_disconnect': 'continue'}
request = models.RunCreateRequest.model_validate(body)
assert request.context['model_name'] == 'gemini-3.8-flash'
assert request.on_disconnect == 'continue'
assert request.metadata['floatboat_operation_id'] == id
try:
    models.RunCreateRequest.model_validate({**body, 'invented_run_option': True})
except Exception:
    pass
else:
    raise AssertionError('official request model must reject invented options')
print(json.dumps({'officialRunCreateRequest': True, 'sourceCommit': commit, 'backgroundRunPayload': body, 'liveRunExecuted': False}))
