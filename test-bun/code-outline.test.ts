import { expect, test } from 'bun:test'
import path from 'node:path'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { readCodeStructure as readReferenceOutline } from '../plugins/scanners/typescript/src/structure.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { readCodeStructure, readSnapshotCodeStructure, type CodeFile } from '../src/viewers/source/structure.ts'
import { outlineStopKeys } from '../src/viewers/tui/navigation-details.ts'
import { outlineRowKey } from '../src/viewers/tui/panes/details.ts'
import { createSourceControl } from '../src/viewers/web/source/control.ts'

const mixedFixture = path.resolve(import.meta.dir, '../test/fixtures/mixed-scanner-outline')
const typescriptFixture = path.resolve(import.meta.dir, '../test/fixtures/typescript-outline')

async function mixedComponent() {
  const world = await loadAnnotatedArchitecture(mixedFixture)
  return { world, component: world.elements.find(element => element.kind === 'component')! }
}

test.concurrent('snapshot outlines use installed repository scanners without loading them from the source snapshot', async () => {
  const snapshot = await mkdtemp(path.join(tmpdir(), 'groma-outline-snapshot-'))
  try {
    const { world, component } = await mixedComponent()
    const files = await readSnapshotCodeStructure(mixedFixture, snapshot, world, component.representationId)
    expect(files?.map(file => file.declarations[0]?.name)).toEqual(['beta', 'alpha'])
  } finally { await rm(snapshot, { recursive: true, force: true }) }
})

test.concurrent('a scanner that cannot outline, such as one missing its worker, leaves the other scanners outlining', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-outline-failing-'))
  try {
    await cp(mixedFixture, root, { recursive: true })
    await writeFile(path.join(root, 'plugins/beta/index.js'), `export default {
  id: 'beta',
  watch: { include: [], exclude: [] },
  async scan() { return undefined },
  async readCodeStructure() { throw new Error('BETA_WORKER_MISSING') },
}
`)
    const { world, component } = await mixedComponent()
    const files = await readSnapshotCodeStructure(root, root, world, component.representationId)
    expect(files?.map(file => [file.file, file.declarations[0]?.name])).toEqual([['src/orders.alpha', 'alpha']])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a component whose Code spans two scanners outlines every file in Code order', async () => {
  const { world, component } = await mixedComponent()
  const files = await readCodeStructure(mixedFixture, world, null, component.representationId) ?? []

  // Each fixture scanner names its only declaration after itself.
  expect(files.map(file => [file.file, file.declarations[0]?.name]))
    .toEqual(component.code.map(reference => [reference.file, reference.scanner]))
  const codeStructure = { elementId: component.representationId, files }
  expect(outlineStopKeys({ currentId: component.representationId, detailsTab: 'how', codeStructure }))
    .toEqual(component.code.map(reference => outlineRowKey(reference.file, 0)))
})

test.concurrent('the web details pane loads the outline of a component without TypeScript files', async () => {
  const { component } = await mixedComponent()
  const outline: CodeFile[] = [{ file: component.code[0]!.file, declarations: [] }]
  const requested: string[] = []
  const repainted = Promise.withResolvers<void>()
  const source = createSourceControl({
    host: {} as HTMLElement,
    element: () => component,
    revision: () => undefined,
    readCode: async element => { requested.push(element); return outline },
    readSource: async () => ({ source: '' }),
    repaint: () => repainted.resolve(),
  })

  expect(source.code()).toEqual([])
  expect(requested).toEqual([component.representationId])
  await repainted.promise
  expect(source.code()).toBe(outline)
})

test.concurrent('the TypeScript outline applies the shared declaration and visibility rules', async () => {
  const [file] = await readReferenceOutline(typescriptFixture, [{ file: 'outline.ts', symbols: [] }])
  const summary = file?.declarations.map(declaration => [
    declaration.kind,
    declaration.name,
    declaration.visibility,
    declaration.kind === 'type' ? declaration.members.map(member => [member.name, member.visibility]) : [],
  ])

  // Each overload is listed, an accessor is not, and a nested namespace is transparent.
  expect(summary).toEqual([
    ['function', 'hidden', 'private', []],
    ['function', 'listed', 'public', []],
    ['function', 'overloaded', 'private', []],
    ['function', 'overloaded', 'private', []],
    ['function', 'overloaded', 'private', []],
    ['function', 'described', 'public', []],
    // Methods named by a string or number literal keep that name.
    ['type', 'Service', 'public', [
      ['constructor', 'public'], ['describe', 'public'], ['save', 'public'], ['404', 'public'], ['reset', 'private'],
    ]],
    ['type', 'Store', 'public', [['read', 'public'], ['fetch', 'public']]],
    ['type', 'Mode', 'public', []],
    ['function', 'lookup', 'public', []],
    ['function', 'trim', 'public', []],
    ['type', 'listed', 'private', [['area', 'public']]],
  ])
})
