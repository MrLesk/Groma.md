import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildPackage } from '../plugins/scanners/python/build.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { compileWatchPatterns } from '../src/scanner/watch-patterns.ts'

const fixtures = path.resolve(import.meta.dir, '../test/fixtures')
const cli = path.resolve(import.meta.dir, '../src/cli.ts')

async function fixture(name = 'python-project') {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-python-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'src/index.js'))).default
  await cp(path.join(fixtures, name), root, { recursive: true })
  for (const file of await readdir(root, { recursive: true })) {
    if (file.endsWith('.fixture')) await rename(path.join(root, file), path.join(root, file.slice(0, -'.fixture'.length)))
  }
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root })
  if (await git.exited !== 0) throw new Error('Could not initialize fixture')
  return { root, temporary, scanner, artifact }
}

test.concurrent('Python keeps function ownership, nested projects and exact source positions without executing code', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    const file = path.join(root, 'service.py')
    // Python source lines exclude Unicode separators inside strings; keep CRLF offsets too.
    const source = (await readFile(file, 'utf8')).replace('🐍', '🐍\u2028text').replace(/\r?\n/g, '\r\n')
    await writeFile(file, source)
    await scanner.checkReadiness!(root)
    const first = (await scanner.scan(root))!
    expect(await scanner.scan(root)).toEqual(first)
    const roots = new Map(first.roots.map(item => [item.id, item]))
    const owner = first.files.find(item => item.file === 'nested/worker.py')!.roots[0]!
    expect(roots.get(owner)?.parent).toBe(first.files.find(item => item.file === 'service.py')!.roots[0])
    expect(new Set(first.files.map(item => item.file)).size).toBe(first.files.length)
    const operations = new Map(first.operations!.map(item => [item.id, item]))
    const calls = first.invocations!.filter(call => operations.get(call.source)!.file === 'service.py')
    const at = (text: string) => calls.find(call => call.position === source.indexOf(text))!
    expect(operations.get(at('self.port.send(value)').source)?.position).toBe(source.indexOf('async def run'))
    expect(operations.get(at('inner()').source)?.position).toBe(source.indexOf('def nested'))
    expect(operations.get(at('local_work()').source)?.position).toBe(source.indexOf('def work'))
    expect(at('self.port.send(value)')).toMatchObject({ member: 'send', line: 6, targets: [], unresolved: true })
    for (const text of ['factory()', 'default()', 'anonymous()', 'deferred()', 'class_body()']) expect(at(text)).toBeUndefined()
    expect(first.invocations!.every(call => call.unresolved && call.targets.length === 0 && !call.binding)).toBe(true)
    expect(first.diagnostics.some(item => item.code === 'PYTHON_SYNTAX_ONLY')).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python excludes ignored files, environments and tests while keeping tracked and untracked source', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await writeFile(path.join(root, '.gitignore'), 'ignored.py\ntracked.py\n')
    for (const file of ['ignored.py', 'tracked.py', 'test_bad.py', 'conftest.py']) {
      await writeFile(path.join(root, file), file === 'tracked.py' ? 'def live(): pass\n' : 'invalid syntax @\n')
    }
    for (const directory of ['.venv', 'venv', '__pycache__', 'tests', 'test', 'node_modules']) {
      await mkdir(path.join(root, directory))
      await writeFile(path.join(root, directory, 'bad.py'), 'invalid syntax @\n')
    }
    const git = Bun.spawn(['git', 'add', '-f', 'tracked.py'], { cwd: root })
    expect(await git.exited).toBe(0)
    expect((await scanner.scan(root))!.files.map(item => item.file)).toEqual(['nested/worker.py', 'service.py', 'tracked.py'])
    const watches = compileWatchPatterns(scanner.watch)
    expect(watches('nested/worker.py')).toBe(true)
    expect(watches('nested/pyproject.toml')).toBe(true)
    expect(watches('.venv/bad.py')).toBe(false)
    expect(watches('tests/bad.py')).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('lint finds identical and near-duplicate Python functions but never callbacks or initialization code', async () => {
  const { root, temporary, artifact } = await fixture('python-duplicated-logic')
  try {
    await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
    await addScanner(root, artifact)
    const lint = Bun.spawn([process.execPath, cli, 'lint'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text()])
    expect(code, error).toBe(1)
    // Each finding starts on an unindented line; similar copies are marked as not identical.
    const findings = out.trim().split(/\n(?=\S)/).map(finding => ({
      at: [...finding.matchAll(/\S+\.py:\d+/g)].map(match => match[0]).sort(),
      identical: !finding.includes('not identical'),
    }))
    // The renamed readiness copy matches exactly; the identical lambdas and initialization loops are absent.
    expect(findings).toEqual([
      { at: ['invoice.py:1', 'quote.py:1'], identical: false },
      { at: ['readiness.py:1', 'scheduling.py:1'], identical: true },
    ])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python rejects syntax and scope errors without returning partial observations', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    for (const source of ['def broken(:\n', 'return 1\n']) {
      await writeFile(path.join(root, 'nested/worker.py'), source)
      await expect(scanner.scan(root)).rejects.toThrow('PYTHON_SCAN_FAILED')
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Python supports source without packaging metadata and returns no observation without source', async () => {
  const { root, temporary, scanner } = await fixture()
  try {
    await rm(path.join(root, 'pyproject.toml'))
    await rm(path.join(root, 'nested'), { recursive: true })
    const result = (await scanner.scan(root))!
    expect(result.roots).toHaveLength(1)
    expect(result.roots[0]?.kind).toBe('source-group')
    expect(result.files[0]?.roots).toEqual([result.roots[0]!.id])
    await rm(path.join(root, 'service.py'))
    expect(await scanner.scan(root)).toBeUndefined()
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
