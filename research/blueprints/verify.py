"""Record reproducible checks; never turn a failed check into a successful run."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'research/blueprints/evidence'
OUT.mkdir(parents=True, exist_ok=True)


def track(path: Path) -> None:
    task_id = os.environ.get('BLUEPRINT_TRACK_TASK')
    if not task_id:
        return
    value = json.loads(subprocess.check_output(['backlog', 'task', 'view', task_id, '--json'], cwd=ROOT))
    task = value.get('task', value)
    files = task.get('modifiedFiles', [])
    name = path.relative_to(ROOT).as_posix()
    if name not in files:
        files.append(name)
    subprocess.run(['backlog', 'task', 'edit', task_id, *[arg for f in files for arg in ('--modified-file', f)]], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)


def run(name: str, args: list[str], cwd: Path = ROOT) -> dict:
    print(f'CHECK {name}: {args}', flush=True)
    path = OUT / f'{name}.log'
    with path.open('w') as output:
        result = subprocess.run(args, cwd=cwd, stdout=output, stderr=subprocess.STDOUT, check=False)
    track(path)
    print(f'{name}: exit {result.returncode}', flush=True)
    return {'name': name, 'command': args, 'directory': str(cwd.relative_to(ROOT)), 'exitCode': result.returncode, 'log': path.name}


results = [
    run('research-lint', ['../../node_modules/.bin/biome', 'lint', '.'], ROOT / 'research/blueprints'),
    run('research-types', ['bun', 'node_modules/.bin/tsc', '--noEmit', '--project', 'research/blueprints/tsconfig.json']),
    run('domain-tests', ['bun', 'test', 'test-bun/blueprint-research.test.ts', 'test-bun/blueprint-map-views.test.ts']),
    run('repository-check', ['bun', 'run', 'check']),
    run('build', ['bun', 'research/blueprints/build.ts']),
]
if results[-1]['exitCode'] == 0:
    results.append(run('browser-tests', [sys.executable, 'research/blueprints/capture.py']))
html = ROOT / 'dist/blueprint-research/index.html'
report = {
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'bun': subprocess.check_output(['bun', '--version'], text=True).strip(),
    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
    'python': sys.version.split()[0],
    'checks': results,
    'htmlSha256': hashlib.sha256(html.read_bytes()).hexdigest() if html.exists() else None,
    'allPassed': all(item['exitCode'] == 0 for item in results) and len(results) == 6,
    'scope': 'Isolated fixture prototype using the existing Groma renderer; no production authoring or scanner changes.',
}
path = OUT / 'checks.json'
path.write_text(json.dumps(report, indent=2) + '\n')
track(path)
print(json.dumps(report, indent=2), flush=True)
raise SystemExit(0 if report['allPassed'] else 1)
