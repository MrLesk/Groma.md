import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'

import { createScanObservation } from '@groma/scanner'

import { acceptGhost, reconcileScanObservations } from '../src/core.ts'
import { groma, readRelative, run, writeTree } from './cli-helpers.ts'

const shopFiles = {
  'groma/index.md': '---\nokf_version: "0.2"\n---\n',
  'groma/project.md': `---
type: Groma Project
title: Shop architecture
groma:
  profile: architecture
---

Describes the shop used by acceptance tests.
`,
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
  'groma/drafts/next.md': `---
type: Draft
title: Next
groma:
  id: next
---

The next release tracks stock.
`,
}

async function createWorld(
  t: TestContext,
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-accept-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeTree(root, { ...shopFiles, ...files })
  return root
}

const inventoryPath = 'groma/systems/shop/containers/api/components/inventory.md'

const inventoryDocument = `---
type: C4 Component
title: Inventory
status: draft
groma:
  id: inventory
  parent: api
  draft: next
---

Tracks stock for the shop.
`

const matchedInventoryDocument = `---
type: C4 Component
title: Inventory
status: draft
groma:
  id: inventory
  parent: api
  draft: next
  code:
    - scanner: typescript
      file: src/inventory.ts
      symbol: Inventory
---

Tracks stock for the shop.
`

test('acceptGhost flips a matched ghost to stable in its own file and keeps the draft tag', async t => {
  const root = await createWorld(t, { [inventoryPath]: matchedInventoryDocument })

  assert.equal(await acceptGhost(root, 'inventory'), 'accepted')

  const accepted = await readRelative(root, inventoryPath)
  assert.equal(accepted, matchedInventoryDocument.replace('status: draft', 'status: stable'))
  assert.match(accepted, /^ {2}draft: next$/m)
})

test('acceptGhost fails when the ghost has no scan match', async t => {
  const root = await createWorld(t, { [inventoryPath]: inventoryDocument })

  assert.equal(await acceptGhost(root, 'inventory'), 'unmatched')
  assert.equal(await readRelative(root, inventoryPath), inventoryDocument)
})

test('acceptGhost fails when the id is not a ghost', async t => {
  const root = await createWorld(t, {})
  assert.equal(await acceptGhost(root, 'api'), 'not-draft')
  assert.equal(await acceptGhost(root, 'unknown'), 'not-draft')
})

test('a scan match leaves the ghost a draft until accept', async t => {
  const root = await createWorld(t, { [inventoryPath]: inventoryDocument })

  const summary = await reconcileScanObservations(root, [createScanObservation({
    scanner: { language: 'typescript', engine: 'test', engineVersion: '1' },
    root: { kind: 'package', name: 'Shop', file: 'package.json' },
    scopes: [{ id: 'scope:src/api.ts', name: 'Api' }],
    files: [{
      file: 'src/inventory.ts',
      symbols: [{ id: 'src/inventory.ts#Inventory', name: 'Inventory', kind: 'class' }],
    }],
    placements: [{ file: 'src/inventory.ts', scope: 'scope:src/api.ts' }],
    relationships: [],
    diagnostics: [],
  })])

  assert.deepEqual(summary, { created: 0, refreshed: 0, matched: 1 })
  const matched = await readRelative(root, inventoryPath)
  assert.match(matched, /^status: draft$/m)
  assert.match(matched, /file: src\/inventory\.ts/)

  assert.equal(await acceptGhost(root, 'inventory'), 'accepted')
  const accepted = await readRelative(root, inventoryPath)
  assert.match(accepted, /^status: stable$/m)
  assert.match(accepted, /Tracks stock for the shop\./)
  assert.match(accepted, /file: src\/inventory\.ts/)
})

async function createScanRepo(
  t: TestContext,
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-cli-accept-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeTree(root, {
    'package.json': JSON.stringify({ name: 'shop', bin: { shop: 'src/cli.ts' } }),
    '.gitignore': 'node_modules/\n',
    ...shopFiles,
    'groma/systems/shop/containers/cli/container.md': `---
type: C4 Container
title: Cli
status: stable
groma:
  id: cli
  parent: shop
---

Runs the shop from a terminal.
`,
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() {}\n",
    'src/scanner.ts': 'export function scan() {}\n',
    ...files,
  })
  const init = await run('git', ['init'], root)
  assert.equal(init.code, 0, init.stderr)
  const add = await run('git', ['add', '-A'], root)
  assert.equal(add.code, 0, add.stderr)
  return root
}

const scannerPath = 'groma/systems/shop/containers/cli/components/scanner.md'

test('groma accept applies a ghost after it scans a name match', async t => {
  const root = await createScanRepo(t, {
    [scannerPath]: `---
type: C4 Component
title: Scanner
status: draft
groma:
  id: scanner
  parent: cli
---

Reads the shop source.
`,
  })

  const result = await groma(root, ['accept', 'scanner'])

  assert.equal(result.code, 0, result.stderr)
  const accepted = await readRelative(root, scannerPath)
  assert.match(accepted, /^status: stable$/m)
  assert.match(accepted, /Reads the shop source\./)
  assert.match(accepted, /file: src\/scanner\.ts/)
})

test('groma accept fails when a scan does not match the ghost', async t => {
  const widgetPath = 'groma/systems/shop/containers/api/components/widget.md'
  const widget = `---
type: C4 Component
title: Widget
status: draft
groma:
  id: widget
  parent: api
---

Does not exist in source.
`
  const root = await createScanRepo(t, { [widgetPath]: widget })

  const result = await groma(root, ['accept', 'widget'])

  assert.equal(result.code, 1)
  assert.equal(await readRelative(root, widgetPath), widget)
})
