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
import { readFile, writeFile } from 'node:fs/promises'
import { RELATIONSHIPS_TYPE, requireGromaMapping } from '../src/okf-profile.ts'
import { addRelation } from '../src/relation.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

/** One scanned project with two components, so a rename has children and siblings to keep. */
function observation() {
  return createScanObservation({
    scanner: { id: 'fixture', technology: 'fixture', engine: 'fixture', engineVersion: '1' },
    roots: [{ id: 'app', kind: 'project', name: 'Shop' }],
    files: [
      { file: 'src/a.ts', roots: ['app'], symbols: [] },
      { file: 'src/b.ts', roots: ['app'], symbols: [] },
    ],
    diagnostics: [],
  })
}

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-rename-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await reconcileScanObservations(root, [observation()])
  return root
}

function element(model: AnnotatedArchitectureModel, id: string) {
  return model.elements.find(item => item.id === id)
}

async function documentOf(root: string, id: string): Promise<string | undefined> {
  const records = await loadArchitecture(root)
  return records.documents
    .filter(item => item.frontmatter.type !== RELATIONSHIPS_TYPE)
    .find(item => requireGromaMapping(item.frontmatter, item.sourceFilename).id === id)
    ?.sourceFilename
}

test.concurrent('a renamed component keeps its Code at the new document, and later scans keep the new id', async () => {
  const root = await repository()
  try {
    const before = await loadAnnotatedArchitecture(root)
    const result = await editArchitecture(root, { id: 'a', newId: 'order-entry' }) as StructuralResult

    expect(result.id).toBe('order-entry')
    expect(result.replacements).toEqual([{ absorbedId: 'a', survivingId: 'order-entry' }])
    expect(result.created).toEqual([await documentOf(root, 'order-entry') ?? ''])
    expect(result.removed).toHaveLength(1)

    const after = await loadAnnotatedArchitecture(root)
    expect(element(after, 'a')).toBeUndefined()
    expect(element(after, 'order-entry')?.code).toEqual(element(before, 'a')!.code)

    const scans = [await reconcileScanObservations(root, [observation()]), await reconcileScanObservations(root, [observation()])]
    expect(scans.map(summary => summary.created)).toEqual([0, 0])
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(after.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a renamed container takes its components to the new path and they name the new parent', async () => {
  const root = await repository()
  try {
    const before = await loadAnnotatedArchitecture(root)
    const container = before.elements.find(item => item.kind === 'container')!
    const components = before.elements.filter(item => item.parent === container.id).map(item => item.id)
    expect(components.length).toBeGreaterThan(1)

    await editArchitecture(root, { id: container.id, newId: 'storefront' })
    const after = await loadAnnotatedArchitecture(root)
    expect(after.elements.filter(item => item.parent === 'storefront').map(item => item.id)).toEqual(components)
    for (const component of components) {
      expect(await documentOf(root, component)).toContain('containers/storefront/')
    }
    expect((await reconcileScanObservations(root, [observation()])).created).toBe(0)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a concept-addressed relationship row and a flow step follow the rename', async () => {
  const root = await repository()
  try {
    await addThing(root, { thing: 'actor', name: 'Buyer', overview: 'Buys goods.' })
    await addRelation(root, { source: 'buyer', target: 'a', description: 'Places an order', technology: 'Browser' })
    await addRelation(root, { source: 'src/a.ts', target: 'src/b.ts', description: 'Reads stock', technology: 'Function call' })
    const link = async (id: string) => path.posix.relative('groma/flows', (await documentOf(root, id))!)
    await addFlow(root, 'Place an order', {
      overview: 'The buyer places an order.',
      steps: ['| From | To | Action |', '| --- | --- | --- |', `| [A](${await link('a')}) | [B](${await link('b')}) | Read stock |`].join('\n'),
    })

    await editArchitecture(root, { id: 'a', newId: 'order-entry' })
    const after = await loadAnnotatedArchitecture(root)
    expect(after.relationships.some(item => item.source === 'buyer' && item.target === 'order-entry')).toBe(true)
    expect(after.flows[0]?.steps.map(step => step.source)).toEqual(['order-entry'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('links follow the rename whatever spelling they use', async () => {
  const root = await repository()
  try {
    await addThing(root, { thing: 'actor', name: 'Buyer', overview: 'Buys goods.' })
    await addRelation(root, { source: 'buyer', target: 'a', description: 'Places an order', technology: 'Browser' })
    // The loader accepts a relative prefix and a link title; the stored row is written without them.
    const record = path.join(root, 'groma/relationships.md')
    const stored = await readFile(record, 'utf8')
    const link = (await documentOf(root, 'a'))!.split('/').slice(1).join('/')
    await writeFile(record, stored.replace(`(${link})`, `(./${link} "The order entry")`))

    await editArchitecture(root, { id: 'a', newId: 'order-entry' })
    const after = await loadAnnotatedArchitecture(root)
    expect(after.relationships.some(item => item.source === 'buyer' && item.target === 'order-entry')).toBe(true)
    expect(await readFile(record, 'utf8')).toContain('"The order entry"')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('an external system renames, and an actor and a flow are refused', async () => {
  const root = await repository()
  try {
    const external = await addThing(root, { thing: 'external', name: 'Vault', overview: 'Keeps the takings.' }) as string
    const actor = await addThing(root, { thing: 'actor', name: 'Buyer', overview: 'Buys goods.' }) as string
    const link = async (id: string) => path.posix.relative('groma/flows', (await documentOf(root, id))!)
    await addRelation(root, { source: 'src/a.ts', target: 'src/b.ts', description: 'Reads stock', technology: 'Function call' })
    const flow = await addFlow(root, 'Read stock', {
      overview: 'The entry reads stock.',
      steps: ['| From | To | Action |', '| --- | --- | --- |', `| [A](${await link('a')}) | [B](${await link('b')}) | Read stock |`].join('\n'),
    })

    await editArchitecture(root, { id: external, newId: 'takings-vault' })
    const after = await loadAnnotatedArchitecture(root)
    expect(after.elements.find(item => item.id === 'takings-vault')?.external).toBe(true)
    expect(await documentOf(root, 'takings-vault')).toBe('groma/externals/takings-vault.md')

    await expect(editArchitecture(root, { id: actor, newId: 'shopper' })).rejects.toThrow('--id renames')
    await expect(editArchitecture(root, { id: flow, newId: 'stock-read' })).rejects.toThrow('--id renames')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a taken or reserved id is refused and nothing is written', async () => {
  const root = await repository()
  try {
    const before = await loadAnnotatedArchitecture(root)
    await expect(editArchitecture(root, { id: 'a', newId: 'b' })).rejects.toThrow('already exists')
    await expect(editArchitecture(root, { id: 'a', newId: 'index' })).rejects.toThrow('reserved document name')
    await expect(editArchitecture(root, { id: 'a', newId: 'later', combine: ['b'] })).rejects.toThrow('separate edit')
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(before.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})
