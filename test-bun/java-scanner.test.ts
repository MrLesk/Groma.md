import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildWorker } from '../plugins/scanners/java/build.ts'
import { scanJavaSource } from '../plugins/scanners/java/src/adapter.ts'
import { javaCommand, mavenInvocation, run } from '../plugins/scanners/java/src/process.ts'
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
  return parseScanObservation(await run(javaCommand(), ['-jar', worker, root, '25', 'UTF-8', ''], root, `\n${files.join('\n')}`))
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

test.concurrent('Java rejects incomplete attribution and reports missing JDK without returning partial facts', async () => {
  const { root, worker } = await fixture()
  try {
    await writeFile(path.join(root, 'src/main/java/Unused.java'), 'class Unused { missing.Library field; }')
    await expect(compilerScan(root, worker)).rejects.toThrow('JAVA_SCAN_FAILED')
    await expect(scanJavaSource(root, { worker, java: path.join(root, 'missing-java') })).rejects.toThrow('JAVA_JDK_MISSING')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Windows Maven batch launchers use cmd while installed Java remains a direct executable', () => {
  expect(mavenInvocation('C:\\Program Files\\Maven\\bin\\mvn.cmd', ['-Doutput=C:\\project path\\model.xml'], 'win32'))
    .toEqual([process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', '""C:\\Program Files\\Maven\\bin\\mvn.cmd" "-Doutput=C:\\project path\\model.xml""']])
  expect(mavenInvocation('/tools/mvn', ['--offline'], 'darwin')).toEqual(['/tools/mvn', ['--offline']])
})

// Maven integration is opt-in because repository checks also run on machines without Java project tooling.
const mavenTest = process.env.GROMA_TEST_MAVEN ? test.concurrent : test.skip
mavenTest('Maven derives Java 25 source roots and dependencies; missing tooling has actionable preparation', async () => {
  const { root, worker } = await fixture()
  try {
    const originalPom = await readFile(path.join(root, 'pom.xml'), 'utf8')
    await cp(path.join(root, 'src/main/java'), path.join(root, 'selected-src'), { recursive: true })
    await rm(path.join(root, 'src'), { recursive: true })
    await writeFile(path.join(root, 'pom.xml'), originalPom.replace('</project>', '<build><sourceDirectory>selected-src</sourceDirectory></build></project>'))
    const options = { worker, maven: process.env.GROMA_TEST_MAVEN! }
    const first = await scanJavaSource(root, options)
    expect(first).toEqual(await scanJavaSource(root, options))
    expect(first.files.length).toBe(5)
    expect(first.files.every(file => file.file.startsWith('selected-src/'))).toBeTrue()
    expect(calls(first).some(call => !call.unresolved)).toBeTrue()
    await expect(scanJavaSource(root, { worker, maven: path.join(root, 'missing-maven') })).rejects.toThrow('JAVA_MAVEN_PREPARATION')
    const pom = await readFile(path.join(root, 'pom.xml'), 'utf8')
    await writeFile(path.join(root, 'pom.xml'), pom.replace('<maven.compiler.release>25', '<maven.compiler.release>99'))
    await expect(scanJavaSource(root, options)).rejects.toThrow('JAVA_COMPILATION_FAILED')
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
