"""Verify only the pinned upstream AgentAction serializer; this does not run a simulation."""
import ast, dataclasses, hashlib, json, sys, typing
from pathlib import Path
source=Path(sys.argv[1])/'backend/app/services/simulation_runner.py'
raw=source.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='5ddb78ece900fe836fdb90e9d831d2036365909c953ae839497edb6ec4f20666','Unexpected upstream source'
node=next(n for n in ast.parse(raw).body if isinstance(n,ast.ClassDef) and n.name=='AgentAction')
ns={'dataclass':dataclasses.dataclass,'field':dataclasses.field,'Dict':typing.Dict,'Any':typing.Any,'Optional':typing.Optional}
exec(compile(ast.Module(body=[node],type_ignores=[]),str(source),'exec'),ns)
expected=json.loads((Path(__file__).parent.parent/'app/tests/fixtures/native-actions.json').read_text())['data']['all_actions'][0]
assert ns['AgentAction'](**expected).to_dict()==expected
print('Pinned upstream AgentAction.to_dict fixture verified; OASIS/Zep generation not executed.')
