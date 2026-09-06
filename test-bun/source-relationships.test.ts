import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addRelation, acceptRelation, editRelation, removeRelation } from '../src/relation.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { scanRepository } from '../src/scanner.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-operation-relations-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await mkdir(path.join(root, 'src'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/operation-wiring'), path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', bin: 'src/caller.ts' }))
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
  return root
}

function owner(model: AnnotatedArchitectureModel, file: string) {
  const element = model.elements.find(item => item.code.some(reference => reference.file === `src/${file}.ts`))
  if (element === undefined) throw new Error(`missing owner for ${file}`)
  return element
}

const ends = { source: 'src/worker.ts', target: 'src/provider.ts' }

test.concurrent('operation resolution follows aliases but preserves executable wrappers and concrete callback bindings', async () => {
  const root = await repository()
  try {
    const observation = (await scanTypeScriptSource(root))!
    const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
    const resolved = observation.invocations!.map(invocation => ({
      ...invocation,
      source: operations.get(invocation.source)!.file,
      targets: invocation.targets.map(id => operations.get(id)!.file),
    }))
    expect(resolved).toContainEqual(expect.objectContaining({ source: 'src/caller.ts', targets: ['src/provider.ts'], unresolved: false }))
    expect(resolved).toContainEqual(expect.objectContaining({ source: 'src/wrapper.ts', targets: ['src/provider.ts'], unresolved: false }))
    expect(resolved).toContainEqual(expect.objectContaining({
      source: 'src/worker.ts', targets: ['src/provider.ts'], unresolved: false,
      member: 'deliver', binding: { file: 'src/caller.ts', line: 6 },
    }))
    expect(resolved.some(call => call.targets.includes('src/api.ts'))).toBeFalse()
    const owners = new Map(observation.files.map(file => [file.file, file.file]))
    expect(inferRelationships([observation], owners).map(row => [row.source, row.target])).toEqual([[ends.source, ends.target]])
    owners.set(ends.target, owners.get(ends.source)!)
    expect(inferRelationships([observation], owners)).toEqual([])
    await writeFile(path.join(root, 'src/api.ts'), "export { wrap as send } from './wrapper.ts'\n")
    const wrapped = (await scanTypeScriptSource(root))!
    const wrappedFiles = new Map(wrapped.operations!.map(operation => [operation.id, operation.file]))
    const callerTargets = wrapped.invocations!.filter(invocation => wrappedFiles.get(invocation.source) === 'src/caller.ts')
      .flatMap(invocation => invocation.targets.map(id => wrappedFiles.get(id)))
    expect(callerTargets).toContain('src/wrapper.ts')
    expect(callerTargets).not.toContain('src/provider.ts')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('uncertain alternatives prevent emission even when one known callback target remains', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'src/caller.ts'), `
import { send } from './api.ts'
import { run } from './worker.ts'
declare const unknown: (value: string) => string
declare const choose: boolean
run({ deliver: choose ? send : unknown })
`)
    const observation = (await scanTypeScriptSource(root))!
    const callback = observation.invocations!.find(invocation => invocation.member === 'deliver')!
    expect(callback.targets).toHaveLength(1)
    expect(callback.unresolved).toBeTrue()
    expect(inferRelationships([observation], new Map(observation.files.map(file => [file.file, file.file])))).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('repeated forwarding preserves distinct concrete bindings without multiplying identical evidence', async () => {
  const root = await repository()
  try {
    const forwarding = Array.from({ length: 6 }, (_, index) => {
      const target = index === 0 ? 'run' : `forward${index - 1}`
      return `function forward${index}(actions) { ${`${target}(actions);`.repeat(4)} }`
    }).join('\n')
    await writeFile(path.join(root, 'src/caller.ts'), `
import { send } from './api.ts'
import { wrap } from './wrapper.ts'
import { run } from './worker.ts'
declare const unknown: (value: string) => string
${forwarding}
forward5({ deliver: send })
forward5({ deliver: wrap })
forward5({ deliver: unknown })
`)
    const observation = (await scanTypeScriptSource(root))!
    const operations = new Map(observation.operations!.map(operation => [operation.id, operation.file]))
    const callbacks = observation.invocations!.filter(invocation => invocation.member === 'deliver')
    expect(callbacks).toHaveLength(3)
    expect(callbacks.map(callback => callback.targets.map(id => operations.get(id)))).toEqual([
      ['src/provider.ts'], ['src/wrapper.ts'], [],
    ])
    expect(callbacks.map(callback => callback.unresolved)).toEqual([false, false, true])
    expect(inferRelationships([observation], new Map(observation.files.map(file => [file.file, file.file])))
      .map(row => row.target)).toEqual(['src/provider.ts', 'src/wrapper.ts'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('scan replaces a CRLF derived section instead of appending duplicate rows', async () => {
  const root = await repository()
  try {
    await scanRepository(root)
    const filename = path.join(root, 'groma/relationships.md')
    const first = await readFile(filename, 'utf8')
    await writeFile(filename, first.replaceAll('\n', '\r\n'))
    await scanRepository(root)
    const after = await loadAnnotatedArchitecture(root)
    expect(after.relationships).toHaveLength(1)
    expect(after.relationships[0]!.connections).toEqual([expect.objectContaining({ ...ends, authored: false })])
    const derivedRows = (await readFile(filename, 'utf8')).replaceAll('\r\n', '\n')
      .split('## Derived relationships')[1]?.split('\n').filter(line => line.startsWith('| ['))
    expect(derivedRows).toHaveLength(1)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('scan stores selected interactions without analysis graphs and reload projects current owners', async () => {
  const root = await repository()
  try {
    await scanRepository(root)
    const raw = await loadAnnotatedArchitecture(root)
    const source = owner(raw, 'worker'), target = owner(raw, 'provider')
    expect(raw.relationships.map(row => [row.source, row.target])).toEqual([[source.id, target.id]])
    expect(raw.relationships[0]!.connections).toEqual([expect.objectContaining({ ...ends, authored: false })])
    const stored = await readFile(path.join(root, 'groma/relationships.md'), 'utf8')
    expect(stored).toContain('## Derived relationships')
    const sourceDocument = await readFile(path.join(root, `groma/systems/fixture/containers/${source.parent}/components/${source.id}.md`), 'utf8')
    expect(sourceDocument).not.toMatch(/dependencyFiles:|dependencies:|dependents:|invocations:|operations:/)
    expect((await loadAnnotatedArchitecture(root)).relationships).toEqual(raw.relationships)
    await editArchitecture(root, { id: target.id, parent: source.parent! })
    await editArchitecture(root, { id: source.id, combine: [target.id] })
    expect((await loadAnnotatedArchitecture(root)).relationships).toEqual([])
    expect(await readFile(path.join(root, 'groma/relationships.md'), 'utf8')).toBe(stored)
    await scanRepository(root)
    expect((await loadAnnotatedArchitecture(root)).relationships).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('editing a derived interaction takes authorship and preserves its meaning through rescans', async () => {
  const root = await repository()
  try {
    await scanRepository(root)
    await editRelation(root, { ...ends, description: 'Sends the completed result', technology: 'Callback' })
    await scanRepository(root)
    const after = await loadAnnotatedArchitecture(root)
    expect(after.relationships).toHaveLength(1)
    expect(after.relationships[0]!.connections).toEqual([expect.objectContaining({ ...ends, authored: true, description: 'Sends the completed result' })])
    await writeFile(path.join(root, 'src/worker.ts'), 'export function run(): void {}\n')
    await scanRepository(root)
    expect((await loadAnnotatedArchitecture(root)).relationships).toEqual(after.relationships)
    await expect(addRelation(root, { ...ends, description: 'Another', technology: 'Callback' })).rejects.toThrow('already relates')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('draft interactions stay separate from current derivation and require explicit acceptance', async () => {
  const root = await repository()
  try {
    await scanRepository(root)
    await addRelation(root, { ...ends, description: 'Publishes the result', technology: 'Callback' }, 'draft')
    await scanRepository(root)
    const before = (await loadAnnotatedArchitecture(root)).relationships[0]!
    expect(new Set(before.connections?.map(row => `${row.authored}:${row.status}`))).toEqual(new Set(['false:stable', 'true:draft']))
    await acceptRelation(root, ends)
    const after = (await loadAnnotatedArchitecture(root)).relationships[0]!
    expect(after.connections).toEqual([expect.objectContaining({ ...ends, authored: true, status: 'stable' })])
    await expect(removeRelation(root, ends)).rejects.toThrow('only draft')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('removing the observed callback removes only the derived interaction', async () => {
  const root = await repository()
  try {
    await scanRepository(root)
    await writeFile(path.join(root, 'src/worker.ts'), 'export function run(): void {}\n')
    await scanRepository(root)
    expect((await loadAnnotatedArchitecture(root)).relationships).toEqual([])
    expect(await readFile(path.join(root, 'groma/relationships.md'), 'utf8')).not.toContain('## Derived relationships')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a supplied member overwritten by the receiver does not retain its original provider claim', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'src/worker.ts'), `
export function run(actions: { deliver(value: string): string }): string {
  actions.deliver = value => value
  return actions.deliver('result')
}
`)
    const observation = (await scanTypeScriptSource(root))!
    expect(observation.invocations!.find(invocation => invocation.member === 'deliver')?.unresolved).toBeTrue()
    expect(inferRelationships([observation], new Map(observation.files.map(file => [file.file, file.file])))).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('changing a supplied object before passing it leaves the provider unresolved', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'src/caller.ts'), `
import { send } from './api.ts'
import { run } from './worker.ts'
const actions = { deliver: send }
actions.deliver = value => value
run(actions)
`)
    const observation = (await scanTypeScriptSource(root))!
    expect(observation.invocations!.find(invocation => invocation.member === 'deliver')?.unresolved).toBeTrue()
    expect(inferRelationships([observation], new Map(observation.files.map(file => [file.file, file.file])))).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('all known alternatives within one binding must have the same provider owner', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'src/caller.ts'), `
import { send } from './api.ts'
import { wrap } from './wrapper.ts'
import { run } from './worker.ts'
declare const choose: boolean
run({ deliver: choose ? send : wrap })
`)
    const observation = (await scanTypeScriptSource(root))!
    const callback = observation.invocations!.find(invocation => invocation.member === 'deliver')!
    expect(callback.targets).toHaveLength(2)
    expect(callback.unresolved).toBeFalse()
    const owners = new Map(observation.files.map(file => [file.file, file.file]))
    expect(inferRelationships([observation], owners)).toEqual([])
    owners.set('src/wrapper.ts', 'src/provider.ts')
    expect(inferRelationships([observation], owners).map(row => row.target)).toEqual(['src/provider.ts', 'src/wrapper.ts'])
  } finally { await rm(root, { recursive: true, force: true }) }
})
