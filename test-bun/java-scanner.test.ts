import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'

import os from 'node:os'
import path from 'node:path'
import { buildWorker } from '../plugins/scanners/java/build.ts'
import { summarizeMissingTypes } from '../plugins/scanners/java/src/missing-types.ts'
import { javaCommand, run } from '../plugins/scanners/java/src/process.ts'

import { createScanObservation, parseScanObservation, type ScanObservation } from '@groma/scanner'

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

test.concurrent('Java retains proven local calls while missing external types and unresolved names leave calls unresolved', async () => {
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
    // The worker reports javac's own codes; the plugin folds the unresolved names into one summary.
    const summarized = summarizeMissingTypes(observation)!.diagnostics
    const missing = summarized.filter(item => item.code === 'JAVA_MISSING_EXTERNAL_TYPES')
    expect(missing).toHaveLength(1)
    expect(missing[0]!.message).toStartWith('3 ')
    expect(summarized.some(item => item.code.startsWith('compiler.err.'))).toBeFalse()
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Java folds missing external types from every project into one summary', () => {
  const error = (file: string, line: number, code: string, message: string) => ({ severity: 'warning', code, message, file, line })
  const observation = createScanObservation({
    scanner: { id: 'java', technology: 'java', engine: 'javac-tree', engineVersion: '25' },
    roots: [],
    files: [],
    diagnostics: [
      error('one/src/A.java', 2, 'compiler.err.doesnt.exist', 'package alpha does not exist'),
      error('one/src/A.java', 5, 'compiler.err.cant.resolve.location', 'cannot find symbol'),
      error('two/src/B.java', 2, 'compiler.err.doesnt.exist', 'package beta does not exist'),
      error('two/src/B.java', 3, 'compiler.err.doesnt.exist', 'package beta does not exist'),
      error('two/src/B.java', 7, 'compiler.err.cant.resolve', 'cannot find symbol'),
      error('two/src/B.java', 9, 'compiler.err.prob.found.req', 'incompatible types'),
    ],
  })
  const diagnostics = summarizeMissingTypes(observation)!.diagnostics
  const missing = diagnostics.filter(item => item.code === 'JAVA_MISSING_EXTERNAL_TYPES')
  expect(missing).toHaveLength(1)
  expect(missing[0]!.message).toStartWith('5 ')
  expect(missing[0]!.message).toContain('packages: beta, alpha.')
  expect(diagnostics.map(item => item.code).sort()).toEqual(['JAVA_MISSING_EXTERNAL_TYPES', 'compiler.err.prob.found.req'])
})
