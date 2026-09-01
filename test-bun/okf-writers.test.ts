import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { parseFrontmatter } from 'comark'
import { createScanObservation } from '@groma/scanner'

import { acceptGhost, loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { createArchitectureElement } from '../src/create.ts'
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
    'groma/observed/index.md': '# Observed\n',
    'groma/missing/index.md': '# Missing\n',
    'groma/plans/index.md': '# Plans\n',
    'groma/observed/systems/shop/system.md': `---
type: C4 System
title: Shop
status: stable
groma:
  id: shop
---

Lets customers place orders.
`,
    'groma/observed/systems/shop/containers/api/container.md': `---
type: C4 Container
title: Api
status: stable
groma:
  id: api
  parent: shop
---

Takes order requests.
`,
    'groma/observed/systems/shop/containers/api/components/orders.md': ordersSource,
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
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  return { code, stdout, stderr }
}

test.concurrent('create emits canonical draft and stable OKF concepts and reserved indexes', async () => {
  const root = await temporaryWorld()
  try {
    const rootIndex = await source(root, 'groma/index.md')
    const project = await source(root, 'groma/project.md')
    await createArchitectureElement(root, {
      name: 'Stock',
      plan: 'next',
      kind: 'component',
      parent: 'api',
      overview: 'Checks stock before an order.',
      description: 'Checks stock availability.',
    })
    await createArchitectureElement(root, {
      name: 'Git',
      observed: true,
      kind: 'system',
      overview: 'Keeps architecture history.',
      external: true,
    })

    const planned = await source(
      root,
      'groma/plans/next/systems/shop/containers/api/components/stock.md',
    )
    expect(metadata(planned)).toEqual({
      type: 'C4 Component',
      title: 'Stock',
      description: 'Checks stock availability.',
      status: 'draft',
      groma: { id: 'stock', parent: 'api' },
    })
    expect(planned).not.toContain('\n# Stock\n')
    expect(parseFrontmatter(planned).content.trim()).toBe('Checks stock before an order.')
    expect(metadata(await source(root, 'groma/observed/systems/git/system.md'))).toEqual({
      type: 'C4 System',
      title: 'Git',
      status: 'stable',
      groma: { id: 'git', external: true },
    })
    expect(metadata(await source(root, 'groma/plans/next/index.md'))).toEqual({})
    expect(await source(root, 'groma/index.md')).toBe(rootIndex)
    expect(await source(root, 'groma/project.md')).toBe(project)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('edit and restate preserve unowned OKF metadata and Markdown', async () => {
  const root = await temporaryWorld()
  const observedPath = 'groma/observed/systems/shop/containers/api/components/orders.md'
  const plannedPath = 'groma/plans/next/systems/shop/containers/api/components/orders.md'
  try {
    await editArchitecture(root, {
      id: 'orders',
      overview: 'Places and tracks customer orders.',
    })
    const edited = await source(root, observedPath)
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
    const described = await source(root, observedPath)
    expect(metadata(described).description).toBe('A revised concise description.')
    expect(described).toContain('Places and tracks customer orders.')

    await editArchitecture(root, { id: 'orders', plan: 'next' })
    const planned = await source(root, plannedPath)
    const plannedMetadata = metadata(planned)
    expect(plannedMetadata.status).toBe('draft')
    expect(plannedMetadata.groma).toEqual({ id: 'orders', parent: 'api' })
    expect(plannedMetadata.description).toBe('A revised concise description.')
    expect(plannedMetadata.provenance).toEqual({ source: 'architecture workshop' })
    expect(plannedMetadata.audience).toBe('developers')
    expect(planned).toContain('## Notes\n\nKeep this authored section.')
    expect(metadata(await source(root, 'groma/plans/next/index.md'))).toEqual({})

    await editArchitecture(root, {
      id: 'orders',
      overview: 'Ships planned orders.',
      description: '',
    })
    const revisedPlan = metadata(await source(root, plannedPath))
    expect(revisedPlan.status).toBe('draft')
    expect(revisedPlan.description).toBeUndefined()

    await editArchitecture(root, {
      id: 'next',
      overview: 'The next release ships revised orders.',
    })
    const planIndex = await source(root, 'groma/plans/next/index.md')
    expect(metadata(planIndex)).toEqual({})
    expect(planIndex).toContain('## Outcome\n\nThe next release ships revised orders.')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('structural edit changes only owned Groma metadata', async () => {
  const root = await temporaryWorld()
  const ordersPath = 'groma/observed/systems/shop/containers/api/components/orders.md'
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
  const ordersPath = 'groma/observed/systems/shop/containers/api/components/orders.md'
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

    const helperPath = 'groma/observed/systems/shop/containers/api/components/helper.md'
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

test.concurrent('scan matching stays draft and accept preserves the complete concept as stable', async () => {
  const plannedPath = 'groma/plans/next/systems/shop/containers/api/components/inventory.md'
  const root = await temporaryWorld({
    'groma/plans/next/index.md': '# Next\n',
    [plannedPath]: `---
type: C4 Component
title: Inventory
description: Standard inventory description.
status: draft
groma:
  id: inventory
  parent: api
provenance:
  source: planning workshop
audience: operators
---

Tracks available stock.

## Notes

Preserve this plan note.
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
    expect(metadata(await source(root, plannedPath)).status)
      .toBe('draft')

    expect(await acceptGhost(root, 'inventory')).toBe('accepted')
    const accepted = await source(
      root,
      'groma/observed/systems/shop/containers/api/components/inventory.md',
    )
    const data = metadata(accepted)
    expect(data.status).toBe('stable')
    expect(data.description).toBe('Standard inventory description.')
    expect(data.provenance).toEqual({ source: 'planning workshop' })
    expect(data.audience).toBe('operators')
    expect(mappings(mapping(data.groma).code)[0]?.file).toBe('src/inventory.ts')
    expect(accepted).toContain('Preserve this plan note.')
    await expect(readFile(path.join(root, plannedPath))).rejects.toThrow()
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

test.concurrent('CLI help gives overview and description separate authoring roles', async () => {
  const create = Bun.spawn(['bun', cli, 'create', '--help'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const createHelp = await new Response(create.stdout).text()
  expect(await create.exited).toBe(0)
  expect(createHelp).toContain('--overview <markdown>')
  expect(createHelp).toContain('--description <text>')

  const edit = Bun.spawn(['bun', cli, 'edit', '--help'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const editHelp = await new Response(edit.stdout).text()
  expect(await edit.exited).toBe(0)
  expect(editHelp).toContain('--overview <markdown>')
  expect(editHelp).toContain('--description <text>')
})

test.concurrent('CLI writes overview and optional description to separate owners', async () => {
  const root = await temporaryWorld()
  const plannedPath = 'groma/plans/next/systems/shop/containers/api/components/stock.md'
  try {
    const created = await runCli(root, [
      'create',
      'Stock',
      '--plan',
      'next',
      '--kind',
      'component',
      '--parent',
      'api',
      '--overview',
      'Checks stock before an order.',
      '--description',
      'Concise stock role.',
    ])
    expect(created).toEqual({ code: 0, stdout: 'ok\nstock\n', stderr: '' })
    const authored = await source(root, plannedPath)
    expect(metadata(authored).description).toBe('Concise stock role.')
    expect(parseFrontmatter(authored).content.trim()).toBe('Checks stock before an order.')

    const overviewOnly = await runCli(root, [
      'edit',
      'stock',
      '--overview',
      'Ships stock checks.',
    ])
    expect(overviewOnly).toEqual({ code: 0, stdout: 'ok\nstock\n', stderr: '' })
    const preserved = await source(root, plannedPath)
    expect(metadata(preserved).description).toBe('Concise stock role.')
    expect(parseFrontmatter(preserved).content.trim()).toBe('Ships stock checks.')

    const edited = await runCli(root, [
      'edit',
      'stock',
      '--description',
      '',
    ])
    expect(edited).toEqual({ code: 0, stdout: 'ok\nstock\n', stderr: '' })
    const revised = await source(root, plannedPath)
    expect(metadata(revised).description).toBeUndefined()
    expect(parseFrontmatter(revised).content.trim()).toBe('Ships stock checks.')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
