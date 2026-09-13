import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildWorker } from '../plugins/scanners/go/build.ts'
import { scanGoSource } from '../plugins/scanners/go/src/adapter.ts'

import type { ScanObservation } from '@groma/scanner'

const go = process.env.GROMA_TEST_GO
const goTest = go ? test.concurrent : test.skip

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-go-test-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/go-module'), root, { recursive: true })
  return { root, worker: path.join(root, process.platform === 'win32' ? 'worker.exe' : 'worker') }
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
    const options = { go, worker }
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

goTest('Go rejects invalid compilation without an observation', async () => {
  const { root, worker } = await fixture()
  try {
    await buildWorker(worker, go)
    await writeFile(path.join(root, 'caller.go'), 'package dispatch\nfunc Broken() { absent() }\n')
    await expect(scanGoSource(root, { go, worker })).rejects.toThrow()
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
