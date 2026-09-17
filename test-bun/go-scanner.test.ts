import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildWorker } from '../plugins/scanners/go/build.ts'
import { scanGoSource } from '../plugins/scanners/go/src/adapter.ts'
import { readScannerConfig, writeScannerConfig } from '../src/scanner/modules/config.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'

import type { ScanObservation } from '@groma/scanner'

const go = process.env.GROMA_TEST_GO
const goTest = go ? test.concurrent : test.skip
const fixtures = path.resolve(import.meta.dir, '../test/fixtures')

async function fixture(name = 'go-module') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-go-test-'))
  await cp(path.join(fixtures, name), root, { recursive: true })
  return { root, worker: path.join(root, process.platform === 'win32' ? 'worker.exe' : 'worker') }
}

function lineOf(source: string, text: string): number {
  return source.slice(0, source.indexOf(text)).split('\n').length
}

function calls(observation: ScanObservation) {
  const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
  return observation.invocations!.map(call => ({
    ...call, caller: operations.get(call.source)!,
    providers: call.targets.map(id => operations.get(id)!),
  }))
}

goTest('Go resolves imported functions and concrete methods while preserving wrapper and closure ownership', async () => {
  const { root, worker } = await fixture()
  try {
    await buildWorker(worker, go)
    const options = { worker }
    const first = await scanGoSource(root, options)
    expect(await scanGoSource(root, options)).toEqual(first)
    const source = await readFile(path.join(root, 'caller.go'), 'utf8')
    const evidence = calls(first)
    const at = (text: string) => evidence.find(call => call.position === source.indexOf(text))!
    expect(at('worker.Work()').providers).toEqual([
      expect.objectContaining({ file: 'provider/provider.go', name: '(*example.test/dispatch/provider.Worker).Work' }),
    ])
    expect(at('port.Work()')).toMatchObject({ targets: [], unresolved: true })
    expect(at('actions.Apply()')).toMatchObject({ targets: [], unresolved: true })
    expect(at('Wrap()\n}').providers[0]!.position).toBe(source.indexOf('func Wrap'))
    expect(at('alias.Build() }()').caller.name).toBe('closure')
    expect(at('alias.Build() }()').caller.position).toBe(source.indexOf('func() {'))
    expect(at('worker.Work()').caller.position).toBe(source.indexOf('func Run'))
    expect(first.invocations!.every(call => call.binding === undefined)).toBeTrue()
    expect(new Set(first.files.map(file => file.file)).size).toBe(first.files.length)
    const byId = new Map(first.roots.map(root => [root.id, root]))
    expect(first.files.every(file => file.roots.every(id => byId.get(id)?.kind === 'package'))).toBeTrue()
    expect(first.roots.filter(root => root.parent).every(root => byId.get(root.parent!)?.kind === 'module')).toBeTrue()
    await writeFile(path.join(root, 'caller.go'), source.replaceAll('alias', 'renamed'))
    const renamed = calls(await scanGoSource(root, options))
    expect(renamed.filter(call => call.member === 'Build').map(call => call.targets))
      .toEqual(evidence.filter(call => call.member === 'Build').map(call => call.targets))
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('Go preserves unresolved calls without dependencies and rejects malformed syntax', async () => {
  const { root, worker } = await fixture()
  try {
    await buildWorker(worker, go)
    await writeFile(path.join(root, 'caller.go'), 'package dispatch\nfunc Broken() { absent() }\n')
    const observation = await scanGoSource(root, { worker })
    expect(observation.invocations).toEqual([expect.objectContaining({ targets: [], unresolved: true })])
    await writeFile(path.join(root, 'caller.go'), 'package dispatch\nfunc Broken( {\n')
    await expect(scanGoSource(root, { worker })).rejects.toThrow()
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('Go attaches source ranges and binding-normalized tokens only to named operations', async () => {
  const { root, worker } = await fixture('go-duplicates')
  try {
    await buildWorker(worker, go)
    const operations = (await scanGoSource(root, { worker })).operations!
    const named = (name: string) => operations.find(operation => operation.name.endsWith(name))!
    // Anonymous literals, including fields of a literal passed as a call argument, and initializer code.
    expect(operations.filter(operation => !operation.tokens).map(operation => operation.name).sort())
      .toEqual(['closure', 'closure', 'closure', 'example.test/duplicates.init', 'initializer'])
    // Literals assigned to a variable or keyed in a literal that is not an argument take that name.
    expect(operations.filter(operation => operation.tokens).map(operation => operation.name))
      .toEqual(expect.arrayContaining(['validate', 'normalize', 'Start']))
    const source = await readFile(path.join(root, 'forms.go'), 'utf8')
    expect(named('.Install')).toMatchObject({
      startLine: lineOf(source, 'func (hooks *Hooks) Install'), endLine: lineOf(source, '}\n\nfunc Apply'),
    })
    // Size is left to core, so an empty named body still reports its range.
    expect(named('.Apply').tokens).toEqual([])
    // Renamed parameters, named results, range and type switch variables produce the same tokens.
    expect(named('.Names').tokens).toEqual(named('.Labels').tokens!)
    // Package-level names, including the operation's own name, and slice bounds keep bodies apart.
    expect(named('.Factorial').tokens).not.toEqual(named('.Fact').tokens!)
    expect(named('.Tail').tokens).not.toEqual(named('.Head').tokens!)
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

goTest('groma lint reports identical and near-duplicate Go bodies across renamed local names', async () => {
  const { root, worker } = await fixture('go-duplicates')
  try {
    await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
    await buildWorker(worker, go)
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/go'))
    const config = await readScannerConfig(root)
    await writeScannerConfig(root, { ...config, scanners: config.scanners.map(scanner => ({ ...scanner, settings: { worker } })) })
    const lint = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../src/cli.ts'), 'lint'],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text()])
    expect(code, error).toBe(1)
    const findings = out.split(/\n(?=\S)/).map(block => ({
      locations: [...block.matchAll(/\S+\.go:\d+/g)].map(match => match[0]).sort(),
      similar: block.includes('not identical'),
    }))
    const ready = await readFile(path.join(root, 'ready.go'), 'utf8')
    const copy = await readFile(path.join(root, 'copy.go'), 'utf8')
    expect(findings).toContainEqual({
      locations: [`copy.go:${lineOf(copy, 'func ReadyToRun')}`, `ready.go:${lineOf(ready, 'func CanStart')}`], similar: false,
    })
    expect(findings).toContainEqual({
      locations: [`copy.go:${lineOf(copy, 'func Completion')}`, `ready.go:${lineOf(ready, 'func Progress')}`], similar: true,
    })
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
