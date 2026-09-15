import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'

import os from 'node:os'
import path from 'node:path'
import { buildWorker } from '../plugins/scanners/java/build.ts'
import { javaCommand, run } from '../plugins/scanners/java/src/process.ts'

import { parseScanObservation, type ScanObservation } from '@groma/scanner'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-java-test-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/java-maven'), root, { recursive: true })
  const worker = path.join(root, 'worker.jar')
  await buildWorker(worker)
  return { root, worker }
}

async function compilerScan(root: string, worker: string) {
  const files = ['Caller', 'Port', 'Provider', 'Shapes', 'Unused'].map(name => `src/main/java/${name}.java`)
  return parseScanObservation(await run(javaCommand(), ['-jar', worker, root, '25', 'UTF-8'], root, `${files.join('\n')}`))
}

function calls(observation: ScanObservation) {
  const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
  return observation.invocations!.map(call => ({ ...call,
    caller: operations.get(call.source)!.name, providers: call.targets.map(id => operations.get(id)!.name),
  }))
}

test.concurrent('Java compiler resolves overloads and preserves wrappers while virtual dispatch remains unknown', async () => {
  const { root, worker } = await fixture()
  try {
    const first = await compilerScan(root, worker)
    expect(await compilerScan(root, worker)).toEqual(first)
    const evidence = calls(first)
    expect(evidence).toContainEqual(expect.objectContaining({ caller: 'entry.Caller#run(sample.Port)',
      providers: ['sample.Provider#ship(int)'], unresolved: false }))
    expect(evidence).toContainEqual(expect.objectContaining({ caller: 'entry.Caller#wrap(java.lang.String)',
      providers: ['sample.Provider#ship(java.lang.String)'], unresolved: false }))
    expect(evidence).toContainEqual(expect.objectContaining({ caller: 'entry.Caller#run(sample.Port)',
      providers: ['entry.Caller#wrap(java.lang.String)'], unresolved: false }))
    expect(evidence).toContainEqual(expect.objectContaining({ line: 13, member: 'deliver', providers: [], unresolved: true }))
    expect(evidence).toContainEqual(expect.objectContaining({ line: 15, member: 'deliver',
      providers: ['sample.Provider#deliver(java.lang.String)'], unresolved: false }))
    expect(first.invocations!.every(call => !call.binding)).toBeTrue()
    expect(first.operations!.some(operation => operation.name === 'sample.Point#x()')).toBeFalse()
    expect(evidence.some(call => call.line === 17)).toBeFalse()
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Java retains proven local calls while missing external types and invalid overload arguments stay unresolved', async () => {
  const { root, worker } = await fixture()
  try {
    await writeFile(path.join(root, 'src/main/java/Caller.java'), `package entry;
import unavailable.External;
import sample.Provider;
public class Caller {
  public static void run() { Provider.ship(1); Provider.ship(missing); External.work(); }
}`)
    const observation = await compilerScan(root, worker)
    const evidence = calls(observation)
    expect(evidence).toContainEqual(expect.objectContaining({ providers: ['sample.Provider#ship(int)'], unresolved: false }))
    expect(evidence.filter(call => call.member === 'ship' && call.unresolved)).toHaveLength(1)
    expect(evidence.find(call => call.member === 'work')).toMatchObject({ providers: [], unresolved: true })
  } finally { await rm(root, { recursive: true, force: true }) }
})
