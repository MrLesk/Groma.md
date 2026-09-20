import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation } from '@groma/scanner'
import { addThing } from '../src/add.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import type { StructuralResult } from '../src/curate.ts'
import { editArchitecture } from '../src/edit.ts'
import { addFlow } from '../src/flow-authoring.ts'
import { RELATIONSHIPS_TYPE, requireGromaMapping } from '../src/okf-profile.ts'
import { addRelation } from '../src/relation.ts'
import { removeThing } from '../src/remove.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

/** Source evidence for two explicitly declared systems and application containers. */
function observation() {
  return createScanObservation({
    scanner: { id: 'fixture', technology: 'fixture', engine: 'fixture', engineVersion: '1' },
    roots: [{ id: 'one', kind: 'project', name: 'Shop' }, { id: 'two', kind: 'project', name: 'Depot' }],
    files: [
      { file: 'one/a.ts', roots: ['one'], symbols: [] },
      { file: 'one/b.ts', roots: ['one'], symbols: [] },
      { file: 'two/c.ts', roots: ['two'], symbols: [] },
    ],
    diagnostics: [],
  })
}

async function repository(scanned = observation()): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-systems-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/curation'), root, { recursive: true })
  await reconcileScanObservations(root, [scanned])
  return root
}

function ids(model: AnnotatedArchitectureModel, kind: 'system' | 'container'): string[] {
  return model.elements.filter(element => element.kind === kind).map(element => element.id).toSorted()
}

/** Which element owns each scanned file; curation must not change ownership. */
function owners(model: AnnotatedArchitectureModel): string[] {
  return model.elements
    .flatMap(element => element.code.map(reference => `${reference.file}=${element.id}`))
    .toSorted()
}

function parentOf(model: AnnotatedArchitectureModel, id: string): string | null | undefined {
  return model.elements.find(element => element.id === id)?.parent
}

async function documentOf(root: string, id: string): Promise<string> {
  const records = await loadArchitecture(root)
  const document = records.documents
    .filter(item => item.frontmatter.type !== RELATIONSHIPS_TYPE)
    .find(item => requireGromaMapping(item.frontmatter, item.sourceFilename).id === id)
  return document!.sourceFilename
}

test.concurrent('combining two systems moves their containers and components, and later scans create nothing', async () => {
  const root = await repository()
  try {
    const before = await loadAnnotatedArchitecture(root)
    const [absorbed, survivor] = ids(before, 'system')
    const result = await editArchitecture(root, { id: survivor!, combine: [absorbed!] }) as StructuralResult

    expect(result.replacements).toEqual([{ oldId: absorbed!, newId: survivor! }])
    // The absorbed container and its component are written under the survivor and removed from the old system.
    expect(result.created).toHaveLength(2)
    expect(result.removed).toHaveLength(3)
    expect(result.affectedIds).toContain(absorbed!)

    const after = await loadAnnotatedArchitecture(root)
    expect(ids(after, 'system')).toEqual([survivor!])
    expect(ids(after, 'container').map(id => parentOf(after, id))).toEqual([survivor!, survivor!])
    expect(owners(after)).toEqual(owners(before))

    const scans = [await reconcileScanObservations(root, [observation()]), await reconcileScanObservations(root, [observation()])]
    expect(scans.map(summary => summary.created)).toEqual([0, 0])
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(after.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a described container keeps its meaning and children when moved, and its empty system can leave', async () => {
  const root = await repository()
  try {
    const initial = await loadAnnotatedArchitecture(root)
    const [destination, origin] = ids(initial, 'system')
    const container = ids(initial, 'container').find(id => parentOf(initial, id) === origin)!
    await editArchitecture(root, { id: container, description: 'Processes requests.', overview: 'Runs the request handlers in one process.' })
    const before = await loadAnnotatedArchitecture(root)
    const components = before.elements.filter(element => element.parent === container).map(element => element.id)
    expect(components.length).toBeGreaterThan(1)

    const result = await editArchitecture(root, { id: container, parent: destination! }) as StructuralResult
    expect(result.created).toHaveLength(components.length + 1)
    expect(result.removed).toHaveLength(components.length + 1)

    const after = await loadAnnotatedArchitecture(root)
    expect(parentOf(after, container)).toBe(destination!)
    expect(after.elements.filter(element => element.parent === container).map(element => element.id)).toEqual(components)
    expect(owners(after)).toEqual(owners(before))
    expect(after.elements.find(element => element.id === container)).toMatchObject({
      ...before.elements.find(element => element.id === container)!, parent: destination,
    })
    // Moving retains the old system until the curator explicitly removes it.
    expect(ids(after, 'system')).toEqual(ids(before, 'system'))
    await removeThing(root, { id: origin! })
    const removed = await loadAnnotatedArchitecture(root)
    expect(ids(removed, 'system')).toEqual([destination!])

    const scans = [await reconcileScanObservations(root, [observation()]), await reconcileScanObservations(root, [observation()])]
    expect(scans.map(summary => summary.created)).toEqual([0, 0])
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(removed.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('an external system is no destination, and a container needs a system parent', async () => {
  const root = await repository()
  try {
    const external = await addThing(root, { thing: 'external', name: 'Vault', overview: 'Keeps the takings.' }) as string
    const world = await loadAnnotatedArchitecture(root)
    const [container, sibling] = ids(world, 'container')
    const system = parentOf(world, container!) as string

    await expect(editArchitecture(root, { id: container!, parent: external })).rejects.toThrow('external system')
    await expect(editArchitecture(root, { id: system, combine: [external] })).rejects.toThrow('cannot combine')
    await expect(editArchitecture(root, { id: container!, parent: sibling! })).rejects.toThrow('requires a system parent')
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(world.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('an authored concept row naming a moved or absorbed record refuses the change and writes nothing', async () => {
  const root = await repository()
  try {
    const actor = await addThing(root, { thing: 'actor', name: 'Clerk', overview: 'Counts stock.' }) as string
    const before = await loadAnnotatedArchitecture(root)
    const [absorbed, survivor] = ids(before, 'system')
    const container = ids(before, 'container').find(id => parentOf(before, id) === absorbed)!
    await addRelation(root, { source: actor, target: container, description: 'Counts stock', technology: 'Browser' })
    const related = await loadAnnotatedArchitecture(root)

    // The row links the container's document, which both operations would move without repointing the link.
    for (const edit of [{ id: survivor!, combine: [absorbed!] }, { id: container, parent: survivor! }]) {
      await expect(editArchitecture(root, edit)).rejects.toThrow()
    }
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(related.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a move that would leave a flow step unresolvable is refused and writes nothing', async () => {
  const root = await repository()
  try {
    await addRelation(root, { source: 'one/a.ts', target: 'two/c.ts', description: 'Requests stock', technology: 'HTTPS' })
    const link = async (id: string) => path.posix.relative('groma/flows', await documentOf(root, id))
    await addFlow(root, 'Order stock', {
      overview: 'The shop asks the depot for stock.',
      steps: ['| From | To | Action |', '| --- | --- | --- |', `| [A](${await link('a')}) | [C](${await link('c')}) | Request stock |`].join('\n'),
    })
    const before = await loadAnnotatedArchitecture(root)
    const container = parentOf(before, 'a')!
    const destination = ids(before, 'system').find(id => id !== parentOf(before, container))!
    // The web pane offers no new parent for a flow endpoint, whose move the write refuses.
    const movable = (id: string) => before.elements.find(element => element.id === id)?.movable
    expect([movable('a'), movable('b')]).toEqual([false, true])
    await expect(editArchitecture(root, { id: 'a', parent: parentOf(before, 'c')! })).rejects.toThrow()

    await expect(editArchitecture(root, { id: container, parent: destination })).rejects.toThrow('would not resolve')
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(before.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})
