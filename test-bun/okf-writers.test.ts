import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { parseFrontmatter } from 'comark'
import { createScanObservation } from '@groma/scanner'

import { acceptGhost, loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { draftElement } from '../src/draft.ts'
import { editArchitecture } from '../src/edit.ts'
import { saveProjectProfile } from '../src/project-profile.ts'

const cli = path.join(import.meta.dir, '..', 'src', 'cli.ts')

const projectSource = `---
type: Groma Project
title: Shop map
description: A standard project description.
groma:
  profile: architecture
provenance:
  source: architecture workshop
audience: developers
---

Shows the current shop architecture.
`

const ordersSource = `---
type: C4 Component
title: Orders
description: A standard short description.
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: src/orders.ts
      symbol: oldOrder
provenance:
  source: architecture workshop
audience: developers
---

Owns the order lifecycle.

## Notes

Keep this authored section.
`

const nextDraft = `---
type: Draft
title: Next
groma:
  id: next
---

The next release adds stock checks.
`

const ordersPath = 'groma/systems/shop/containers/api/components/orders.md'
const stockPath = 'groma/systems/shop/containers/api/components/stock.md'
const draftPath = 'groma/drafts/next.md'

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

async function temporaryWorld(extra: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-okf-writers-'))
  await writeTree(root, {
    'groma/index.md': '---\nokf_version: "0.2"\n---\n',
    'groma/project.md': projectSource,
    'groma/systems/shop/system.md': `---
type: C4 System
title: Shop
status: stable
groma:
  id: shop
---

Lets customers place orders.
`,
    'groma/systems/shop/containers/api/container.md': `---
type: C4 Container
title: Api
status: stable
groma:
  id: api
  parent: shop
---

Takes order requests.
`,
    'src/orders.ts': 'export function placeOrder() {}\n',
    [ordersPath]: ordersSource,
    [draftPath]: nextDraft,
    ...extra,
  })
  return root
}

async function source(root: string, relative: string): Promise<string> {
  return readFile(path.join(root, ...relative.split('/')), 'utf8')
}

function metadata(markdown: string): Record<string, unknown> {
  return parseFrontmatter(markdown).data
}

function mapping(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('expected a mapping')
  }
  return value as Record<string, unknown>
}

function mappings(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError('expected a list')
  return value.map(mapping)
}

async function runCli(root: string, args: string[]) {
  const process = Bun.spawn(['bun', cli, ...args], {
    cwd: root,
    stdout: 'ignore',
    stderr: 'ignore',
  })
  return process.exited
}

test.concurrent('draft emits a canonical draft OKF concept and leaves the bundle documents alone', async () => {
  const root = await temporaryWorld()
  try {
    const rootIndex = await source(root, 'groma/index.md')
    const project = await source(root, 'groma/project.md')
    await draftElement(root, {
      kind: 'component',
      name: 'Stock',
      parent: 'api',
      overview: 'Checks stock before an order.',
      description: 'Checks stock availability.',
      draft: 'next',
    })

    const drafted = await source(root, stockPath)
    expect(metadata(drafted)).toEqual({
      type: 'C4 Component',
      title: 'Stock',
      description: 'Checks stock availability.',
      status: 'draft',
      groma: { id: 'stock', parent: 'api', draft: 'next' },
    })
    expect(drafted).not.toContain('\n# Stock\n')
    expect(parseFrontmatter(drafted).content.trim()).toBe('Checks stock before an order.')
    expect(await source(root, 'groma/index.md')).toBe(rootIndex)
    expect(await source(root, 'groma/project.md')).toBe(project)
    expect(await source(root, draftPath)).toBe(nextDraft)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('edit preserves unowned OKF metadata and Markdown while it changes meaning and tags', async () => {
  const root = await temporaryWorld()
  try {
    await editArchitecture(root, {
      id: 'orders',
      overview: 'Places and tracks customer orders.',
    })
    const edited = await source(root, ordersPath)
    const editedMetadata = metadata(edited)
    expect(editedMetadata.description).toBe('A standard short description.')
    expect(editedMetadata.status).toBe('stable')
    expect(editedMetadata.provenance).toEqual({ source: 'architecture workshop' })
    expect(editedMetadata.audience).toBe('developers')
    expect(edited).toContain('Places and tracks customer orders.')
    expect(edited).toContain('## Notes\n\nKeep this authored section.')

    await editArchitecture(root, {
      id: 'orders',
      description: 'A revised concise description.',
    })
    const described = await source(root, ordersPath)
    expect(metadata(described).description).toBe('A revised concise description.')
    expect(described).toContain('Places and tracks customer orders.')

    await editArchitecture(root, { id: 'orders', draft: 'next' })
    const tagged = await source(root, ordersPath)
    const taggedMetadata = metadata(tagged)
    expect(taggedMetadata.status).toBe('stable')
    expect(taggedMetadata.groma).toEqual({
      id: 'orders',
      parent: 'api',
      code: mapping(metadata(ordersSource).groma).code,
      draft: 'next',
    })
    expect(taggedMetadata.description).toBe('A revised concise description.')
    expect(taggedMetadata.provenance).toEqual({ source: 'architecture workshop' })
    expect(taggedMetadata.audience).toBe('developers')
    expect(tagged).toContain('## Notes\n\nKeep this authored section.')

    await editArchitecture(root, {
      id: 'orders',
      overview: 'Ships tagged orders.',
      description: '',
    })
    const revised = metadata(await source(root, ordersPath))
    expect(revised.status).toBe('stable')
    expect(revised.description).toBeUndefined()

    await editArchitecture(root, {
      id: 'next',
      overview: 'The next release ships revised orders.',
    })
    const draft = await source(root, draftPath)
    expect(metadata(draft)).toEqual({ type: 'Draft', title: 'Next', groma: { id: 'next' } })
    expect(parseFrontmatter(draft).content.trim()).toBe('The next release ships revised orders.')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('structural edit changes only owned Groma metadata', async () => {
  const root = await temporaryWorld()
  try {
    await editArchitecture(root, { id: 'orders', group: 'Commerce' })
    const edited = await source(root, ordersPath)
    const data = metadata(edited)
    const groma = mapping(data.groma)
    expect(groma.group).toBe('Commerce')
    expect(groma.id).toBe('orders')
    expect(groma.parent).toBe('api')
    expect(groma.code).toEqual(mapping(metadata(ordersSource).groma).code)
    expect(data.status).toBe('stable')
    expect(data.description).toBe('A standard short description.')
    expect(data.provenance).toEqual({ source: 'architecture workshop' })
    expect(data.audience).toBe('developers')
    expect(edited).toContain('Owns the order lifecycle.')
    expect(edited).toContain('Keep this authored section.')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('scan refreshes and creates only owned stable profile fields', async () => {
  const root = await temporaryWorld()
  try {
    await writeFile(path.join(root, ...ordersPath.split('/')), ordersSource.replaceAll('\n', '\r\n'))
    const observation = createScanObservation({
      scanner: { language: 'typescript', engine: 'test', engineVersion: '1' },
      root: { kind: 'package', name: 'Shop', file: 'package.json' },
      scopes: [{ id: 'scope:api', name: 'Api' }],
      files: [
        {
          file: 'src/orders.ts',
          symbols: [{ id: 'src/orders.ts#placeOrder', name: 'placeOrder', kind: 'function' }],
        },
        {
          file: 'src/helper.ts',
          symbols: [{ id: 'src/helper.ts#help', name: 'help', kind: 'function' }],
        },
      ],
      placements: [
        { file: 'src/orders.ts', scope: 'scope:api' },
        { file: 'src/helper.ts', scope: 'scope:api' },
      ],
      relationships: [],
      diagnostics: [],
    })
    expect(await reconcileScanObservations(root, [observation]))
      .toEqual({ created: 1, refreshed: 1, matched: 0 })

    const refreshed = await source(root, ordersPath)
    const refreshedMetadata = metadata(refreshed)
    expect(refreshedMetadata.status).toBe('stable')
    expect(mappings(mapping(refreshedMetadata.groma).code)[0]?.symbol).toBe('placeOrder')
    expect(refreshedMetadata.description).toBe('A standard short description.')
    expect(refreshedMetadata.provenance).toEqual({ source: 'architecture workshop' })
    expect(refreshedMetadata.audience).toBe('developers')
    expect(refreshed).toContain('Keep this authored section.')

    const helperPath = 'groma/systems/shop/containers/api/components/helper.md'
    const helper = await source(root, helperPath)
    expect(metadata(helper)).toEqual({
      type: 'C4 Component',
      title: 'Helper',
      status: 'stable',
      groma: {
        id: 'helper',
        parent: 'api',
        code: [{
          scanner: 'typescript',
          file: 'src/helper.ts',
          symbol: 'help',
          dependencies: 0,
          dependents: 0,
        }],
      },
    })
    expect(parseFrontmatter(helper).content.trim()).toBe('')
    const world = await loadAnnotatedArchitecture(root)
    expect(world.elements.find(element => element.id === 'helper')?.overview).toBe('')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('scan matching stays draft and accept flips the complete concept to stable in place', async () => {
  const inventoryPath = 'groma/systems/shop/containers/api/components/inventory.md'
  const root = await temporaryWorld({
    [inventoryPath]: `---
type: C4 Component
title: Inventory
description: Standard inventory description.
status: draft
groma:
  id: inventory
  parent: api
  draft: next
provenance:
  source: planning workshop
audience: operators
---

Tracks available stock.

## Notes

Preserve this draft note.
`,
  })
  try {
    const observation = createScanObservation({
      scanner: { language: 'typescript', engine: 'test', engineVersion: '1' },
      root: { kind: 'package', name: 'Shop', file: 'package.json' },
      scopes: [{ id: 'scope:api', name: 'Api' }],
      files: [{
        file: 'src/inventory.ts',
        symbols: [{ id: 'src/inventory.ts#Inventory', name: 'Inventory', kind: 'class' }],
      }],
      placements: [{ file: 'src/inventory.ts', scope: 'scope:api' }],
      relationships: [],
      diagnostics: [],
    })
    expect(await reconcileScanObservations(root, [observation]))
      .toEqual({ created: 0, refreshed: 0, matched: 1 })
    expect(metadata(await source(root, inventoryPath)).status).toBe('draft')

    expect(await acceptGhost(root, 'inventory')).toBe('accepted')
    const accepted = await source(root, inventoryPath)
    const data = metadata(accepted)
    expect(data.status).toBe('stable')
    expect(data.description).toBe('Standard inventory description.')
    expect(data.provenance).toEqual({ source: 'planning workshop' })
    expect(data.audience).toBe('operators')
    expect(mapping(data.groma).draft).toBe('next')
    expect(mappings(mapping(data.groma).code)[0]?.file).toBe('src/inventory.ts')
    expect(accepted).toContain('Preserve this draft note.')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('project save preserves the profile marker and unowned OKF metadata', async () => {
  const root = await temporaryWorld()
  try {
    const rootIndex = await source(root, 'groma/index.md')
    const profile = await saveProjectProfile(root, {
      title: 'Current shop map',
      overview: 'Shows **current** responsibilities.\n\n## Scope\n\nThe complete shop.',
    })
    const saved = await source(root, 'groma/project.md')
    const data = metadata(saved)
    expect(profile.title).toBe('Current shop map')
    expect(profile.overview).toContain('## Scope')
    expect(data.type).toBe('Groma Project')
    expect(data.title).toBe('Current shop map')
    expect(data.description).toBe('A standard project description.')
    expect(data.groma).toEqual({ profile: 'architecture' })
    expect(data.provenance).toEqual({ source: 'architecture workshop' })
    expect(data.audience).toBe('developers')
    expect(saved).not.toContain('\n# Current shop map\n')
    expect(await source(root, 'groma/index.md')).toBe(rootIndex)

    await saveProjectProfile(root, {
      title: 'Current shop map',
      overview: profile.overview,
      description: 'A revised standard project description.',
    })
    expect(metadata(await source(root, 'groma/project.md')).description)
      .toBe('A revised standard project description.')

    await saveProjectProfile(root, {
      title: 'Current shop map',
      overview: profile.overview,
      description: '',
    })
    expect(metadata(await source(root, 'groma/project.md')).description).toBeUndefined()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('CLI writes overview and optional description to separate owners', async () => {
  const root = await temporaryWorld()
  try {
    const drafted = await runCli(root, [
      'draft',
      'component',
      'Stock',
      '--parent',
      'api',
      '--overview',
      'Checks stock before an order.',
      '--description',
      'Concise stock role.',
      '--draft',
      'next',
    ])
    expect(drafted).toBe(0)
    const authored = await source(root, stockPath)
    expect(metadata(authored).description).toBe('Concise stock role.')
    expect(parseFrontmatter(authored).content.trim()).toBe('Checks stock before an order.')

    const overviewOnly = await runCli(root, [
      'edit',
      'stock',
      '--overview',
      'Ships stock checks.',
    ])
    expect(overviewOnly).toBe(0)
    const preserved = await source(root, stockPath)
    expect(metadata(preserved).description).toBe('Concise stock role.')
    expect(parseFrontmatter(preserved).content.trim()).toBe('Ships stock checks.')

    const edited = await runCli(root, [
      'edit',
      'stock',
      '--description',
      '',
    ])
    expect(edited).toBe(0)
    const revised = await source(root, stockPath)
    expect(metadata(revised).description).toBeUndefined()
    expect(parseFrontmatter(revised).content.trim()).toBe('Ships stock checks.')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
