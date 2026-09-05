import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { writes } from '../src/authoring.ts'
import type { StructuralResult } from '../src/curate.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { projectRoot, readTree, writeTree } from '../test/cli-helpers.ts'

const api = 'groma/systems/shop/containers/api'
const worker = 'groma/systems/shop/containers/worker'

async function repository(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-structural-results-'))
  try {
    await cp(path.join(projectRoot, 'test/fixtures/edit'), root, { recursive: true })
    await writeTree(root, {
      [`${worker}/container.md`]: emptyElement('worker', 'Container', 'shop'),
      [`${worker}/components/first.md`]: emptyElement('first', 'Component', 'worker'),
      [`${worker}/components/second.md`]: emptyElement('second', 'Component', 'worker'),
      [`${worker}/components/third.md`]: emptyElement('third', 'Component', 'worker'),
    })
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function emptyElement(id: string, kind: string, parent: string): string {
  const code = kind === 'Component' ? `  code:\n    - scanner: typescript\n      file: src/${id}.ts\n` : ''
  return `---\ntype: C4 ${kind}\ntitle: ${id}\nstatus: stable\ngroma:\n  id: ${id}\n  parent: ${parent}\n${code}---\n`
}

async function verifyPaths(root: string, before: Record<string, string>, result: string | StructuralResult): Promise<StructuralResult> {
  if (typeof result === 'string') throw new Error('Expected a structural result')
  const after = await readTree(root)
  expect(result.created.toSorted()).toEqual(Object.keys(after).filter(file => before[file] === undefined).sort())
  const changed = Object.keys(after).filter(file => before[file] !== undefined && before[file] !== after[file])
  for (const file of changed) expect(result.changed).toContain(file)
  for (const file of result.changed) {
    expect(before[file]).toBeDefined()
    expect(after[file]).toBeDefined()
  }
  expect(result.removed.toSorted()).toEqual(Object.keys(before).filter(file => after[file] === undefined).sort())
  return result
}

test.concurrent('component combine reports all absorbed IDs and executed paths', async () => {
  await repository(async root => {
    const before = await readTree(root)
    const result = await verifyPaths(root, before, await writes.edit(root, { id: 'first', combine: ['second', 'third'] }))
    expect(result.affectedIds).toEqual(['first', 'second', 'third'])
    expect(result.replacements).toEqual([
      { absorbedId: 'second', survivingId: 'first' },
      { absorbedId: 'third', survivingId: 'first' },
    ])
    const model = await loadAnnotatedArchitecture(root)
    expect(model.elements.some(element => element.id === 'second' || element.id === 'third')).toBe(false)
    expect(model.elements.find(element => element.id === result.id)?.code.map(reference => reference.file).sort())
      .toEqual(['src/first.ts', 'src/second.ts', 'src/third.ts'])
  })
})

test.concurrent('container combine reports moved children without replacing their IDs', async () => {
  await repository(async root => {
    const before = await readTree(root)
    const result = await verifyPaths(root, before, await writes.edit(root, { id: 'api', combine: ['worker'] }))
    expect(result.changed).toEqual([`${api}/container.md`])
    expect(result.replacements).toEqual([{ absorbedId: 'worker', survivingId: 'api' }])
    expect(result.affectedIds.toSorted()).toEqual(['api', 'first', 'second', 'third', 'worker'])
    const model = await loadAnnotatedArchitecture(root)
    for (const id of ['first', 'second', 'third']) {
      expect(model.elements.find(element => element.id === id)?.parent).toBe('api')
    }
  })
})

test.concurrent('CLI move reports both ownership paths and keeps the ID', async () => {
  await repository(async root => {
    const before = await readTree(root)
    const process = Bun.spawn(['bun', path.join(projectRoot, 'src/cli.ts'), 'edit', 'first', '--parent', 'api'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const output = await new Response(process.stdout).text()
    expect(await process.exited).toBe(0)
    const values = (kind: string) => output.split('\n').filter(line => line.startsWith(`${kind}: `)).map(line => line.slice(kind.length + 2))
    const result = await verifyPaths(root, before, {
      id: 'first', created: values('created'), changed: values('changed'), removed: values('removed'),
      affectedIds: values('affected'), replacements: [],
    })
    expect(result.created).toEqual([`${api}/components/first.md`])
    expect(result.removed).toEqual([`${worker}/components/first.md`])
    expect(result.affectedIds).toEqual(['first'])
    expect(values('replaced')).toEqual([])
    expect((await loadAnnotatedArchitecture(root)).elements.find(element => element.id === 'first')?.parent).toBe('api')
  })
})

test.concurrent('group verbs report the members written, without inventing an element ID for the group', async () => {
  await repository(async root => {
    const operations: Array<() => Promise<string | StructuralResult>> = [
      () => writes.add(root, { thing: 'group', name: 'Domain', members: ['first', 'second'] }),
      () => writes.edit(root, { id: 'worker/domain', title: 'Renamed' }),
      () => writes.remove(root, { id: 'worker/renamed', members: ['second'] }),
      () => writes.remove(root, { id: 'worker/renamed' }),
      () => writes.edit(root, { id: 'third', group: 'Other' }),
      () => writes.edit(root, { id: 'third', ungroup: true }),
    ]
    const members = [['first', 'second'], ['first', 'second'], ['second'], ['first'], ['third'], ['third']]
    for (const [index, operation] of operations.entries()) {
      const result = await verifyPaths(root, await readTree(root), await operation())
      expect(result.affectedIds).toEqual(members[index]!)
      expect(result.replacements).toEqual([])
    }
  })
})

test.concurrent('rejected structural command has no success result or file changes', async () => {
  await repository(async root => {
    const before = await readTree(root)
    const process = Bun.spawn(['bun', path.join(projectRoot, 'src/cli.ts'), 'edit', 'orders', '--combine', 'stock'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const output = await new Response(process.stdout).text()
    expect(await process.exited).not.toBe(0)
    expect(output).toBe('')
    expect(await readTree(root)).toEqual(before)
    await expect(writes.edit(root, { id: 'orders', combine: ['stock'] })).rejects.toThrow()
    expect(await readTree(root)).toEqual(before)
  })
})
