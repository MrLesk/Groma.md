import { afterAll, beforeAll, expect, test } from 'bun:test'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { ScanObservation } from '@groma/scanner'

import { buildWorker } from '../plugins/scanners/java/build.ts'
import { isJavaScanFile, scanJavaSource } from '../plugins/scanners/java/src/adapter.ts'
import { readJavaInput } from '../plugins/scanners/java/src/config.ts'
import { inferRelationships } from '../src/relationship-inference.ts'

const execute = promisify(execFile)
// One immutable worker artifact; every concurrent test owns its source tree and process.
const tools = await mkdtemp(path.join(os.tmpdir(), 'groma-java-test-worker-'))
const worker = path.join(tools, 'worker.jar')
beforeAll(() => buildWorker(worker))
afterAll(() => rm(tools, { recursive: true, force: true }))

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-java-test-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/java-source-set'), root, { recursive: true })
  return root
}

async function scan(root: string): Promise<ScanObservation> {
  const observation = await scanJavaSource(root, { worker })
  if (!observation) throw new Error('Expected a configured Java observation')
  return observation
}

function calls(observation: ScanObservation) {
  const operations = new Map(observation.operations?.map(operation => [operation.id, operation]))
  return observation.invocations!.map(call => ({ ...call,
    caller: operations.get(call.source)!.name, sourceFile: operations.get(call.source)!.file,
    providers: call.targets.map(id => operations.get(id)!.name),
  }))
}

async function configure(root: string, value: object): Promise<void> {
  await writeFile(path.join(root, 'groma-java.json'), JSON.stringify(value))
}

test.concurrent('Java resolves overloads and implementations, preserves wrappers, and leaves virtual dispatch unknown', async () => {
  const root = await repository()
  try {
    const first = await scan(root)
    expect(await scan(root)).toEqual(first)
    expect(first.files).toHaveLength(5)
    expect(new Set(first.placements.map(item => item.file)).size).toBe(first.files.length)
    const evidence = calls(first)
    expect(evidence).toContainEqual(expect.objectContaining({ caller: 'entry.Caller#run(sample.Port)',
      providers: ['sample.Provider#ship(int)'], unresolved: false }))
    expect(evidence).toContainEqual(expect.objectContaining({ caller: 'entry.Caller#wrap(java.lang.String)',
      providers: ['sample.Provider#ship(java.lang.String)'], unresolved: false }))
    expect(evidence).toContainEqual(expect.objectContaining({ caller: 'entry.Caller#run(sample.Port)',
      providers: ['entry.Caller#wrap(java.lang.String)'], unresolved: false }))
    expect(evidence).toContainEqual(expect.objectContaining({ line: 13, member: 'deliver', providers: [], unresolved: true }))
    expect(evidence).toContainEqual(expect.objectContaining({ line: 14, member: 'decorate', providers: [], unresolved: true }))
    expect(evidence).toContainEqual(expect.objectContaining({ line: 15, member: 'deliver',
      providers: ['sample.Provider#deliver(java.lang.String)'], unresolved: false }))
    expect(evidence).toContainEqual(expect.objectContaining({ caller: 'sample.Child#render()',
      providers: ['sample.Base#render()'], unresolved: false }))
    expect(first.relationships.some(row => row.source === 'src/Caller.java' && row.target === 'src/Unused.java')).toBeFalse()
    expect(inferRelationships([first], new Map(first.files.map(file => [file.file, file.file])))).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Java separates deferred bodies and initializers without inventing generated operations or calls', async () => {
  const root = await repository()
  try {
    const observation = await scan(root)
    const evidence = calls(observation)
    const lambda = evidence.find(call => call.line === 16)!
    expect(lambda.caller).toContain('lambda')
    expect(lambda.providers).toEqual(['sample.Provider#ship(java.lang.String)'])
    expect(evidence.some(call => call.line === 17)).toBeFalse()
    const initializers = evidence.filter(call => call.sourceFile === 'src/Caller.java' && [7, 8].includes(call.line))
    expect(initializers).toHaveLength(2)
    expect(new Set(initializers.map(call => call.source)).size).toBe(2)
    expect(initializers.every(call => call.caller.startsWith('<') && !call.unresolved)).toBeTrue()
    expect(observation.operations!.some(operation => operation.name === 'sample.Point#x()')).toBeFalse()
    expect(observation.operations!.some(operation => operation.name === 'entry.Caller#Caller()')).toBeFalse()
    expect(observation.files.find(file => file.file === 'src/Shapes.java')!.symbols.some(symbol => symbol.kind === 'record')).toBeTrue()
    expect((await readdir(path.join(root, 'src'))).some(file => file.endsWith('.class'))).toBeFalse()
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Java fails atomically for unresolved dependencies and does not leak a partial observation', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'src/Broken.java'), 'class Broken { missing.Library field; }')
    await expect(scan(root)).rejects.toThrow('JAVA_SCAN_FAILED')
    const input = (await readJavaInput(root))!
    const child = Bun.spawn(['java', '-jar', worker, root, '17', ''], {
      stdin: Buffer.from(`${input.files.join('\n')}\n`), stdout: 'pipe', stderr: 'pipe',
    })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code).toBe(2)
    expect(stdout).toBe('')
    expect(stderr).toContain('JAVA_SCAN_FAILED')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Java rejects unsupported scope and deterministic limits rather than truncating output', async () => {
  const root = await repository()
  try {
    await configure(root, { sourceRoots: ['src'], release: 17, maxFiles: 1 })
    await expect(scan(root)).rejects.toThrow('maxFiles=1')
    await configure(root, { sourceRoots: ['src'], release: 25 })
    await expect(scan(root)).rejects.toThrow('Java release')
    await configure(root, { sourceRoots: ['src'], release: 17 })
    await writeFile(path.join(root, 'src/module-info.java'), 'module example {}')
    await expect(scan(root)).rejects.toThrow('JPMS')
    await configure(root, { sourceRoots: [], release: 17 })
    await expect(scan(root)).rejects.toThrow('must not be empty')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Java is opt-in and a missing runtime or worker fails without any automatic installation', async () => {
  const root = await repository()
  try {
    await expect(scanJavaSource(root, { worker, java: path.join(root, 'missing-java') })).rejects.toThrow('no observation')
    await expect(scanJavaSource(root, { worker: path.join(root, 'missing.jar') })).rejects.toThrow('worker is missing')
    await rm(path.join(root, 'groma-java.json'))
    expect(await scanJavaSource(root, { worker: 'missing.jar' })).toBeUndefined()
    expect(isJavaScanFile('groma-java.json')).toBeTrue()
    expect(isJavaScanFile('src/Type.java')).toBeTrue()
    expect(isJavaScanFile('lib/provider.jar')).toBeTrue()
    expect(isJavaScanFile('README.md')).toBeFalse()
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Java never executes a classpath annotation processor or repository build wrapper', async () => {
  const root = await repository()
  try {
    const processor = path.join(root, 'processor')
    await mkdir(path.join(processor, 'META-INF/services'), { recursive: true })
    await writeFile(path.join(processor, 'Bomb.java'), `
import java.util.Set;
import javax.annotation.processing.*;
import javax.lang.model.element.*;
@SupportedAnnotationTypes("*")
public class Bomb extends AbstractProcessor {
  public boolean process(Set<? extends TypeElement> a, RoundEnvironment r) {
    throw new AssertionError("PROCESSOR_MUST_NOT_EXECUTE");
  }
}`)
    await execute('javac', ['-proc:none', '-d', processor, path.join(processor, 'Bomb.java')])
    await writeFile(path.join(processor, 'META-INF/services/javax.annotation.processing.Processor'), 'Bomb\n')
    await execute('jar', ['--create', '--file', path.join(root, 'processor.jar'), '-C', processor, '.'])
    await writeFile(path.join(root, 'mvnw'), '#!/bin/sh\nexit 123\n', { mode: 0o755 })
    await configure(root, { sourceRoots: ['src'], release: 17, classpath: ['processor.jar'] })
    expect((await scan(root)).complete).toBeTrue()
  } finally { await rm(root, { recursive: true, force: true }) }
})

for (const [release, body] of [
  [8, 'return java.util.Collections.emptyList();'],
  [11, 'return " ".isBlank();'],
  [21, 'return java.util.List.of(1, 2).getFirst();'],
] as const) {
  test.concurrent(`Java enforces the platform API for release ${release}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-java-release-'))
    try {
      await mkdir(path.join(root, 'src'))
      await configure(root, { sourceRoots: ['src'], release })
      await writeFile(path.join(root, 'src/Api.java'), `class Api { Object api() { ${body} } }`)
      expect((await scan(root)).files).toHaveLength(1)
      await writeFile(path.join(root, 'src/Api.java'), 'class Api { void api() { Thread.startVirtualThread(() -> {}); } }')
      if (release < 21) await expect(scan(root)).rejects.toThrow('JAVA_SCAN_FAILED')
      else expect((await scan(root)).complete).toBeTrue()
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}

test.concurrent('Java source roots cannot escape the repository and a killed worker cannot return an observation', async () => {
  const root = await repository()
  try {
    await configure(root, { sourceRoots: ['../'], release: 17 })
    await expect(scan(root)).rejects.toThrow('stay inside')
    await configure(root, { sourceRoots: ['src'], release: 17, guessedBuild: true })
    await expect(scan(root)).rejects.toThrow('Unknown Java configuration')
    await configure(root, { sourceRoots: ['src'], release: 17 })
    await expect(scanJavaSource(root, { worker, timeout: 1 })).rejects.toThrow('no observation')
  } finally { await rm(root, { recursive: true, force: true }) }
})
