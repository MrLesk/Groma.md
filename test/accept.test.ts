import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'

import { createScanObservation } from '@groma/scanner'

import { acceptGhost, loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { readRelative, writeTree } from './cli-helpers.ts'

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

test('acceptGhost flips a matched ghost to stable in its own file and keeps the draft tag', { concurrency: true }, async t => {
  const root = await createWorld(t, { [inventoryPath]: matchedInventoryDocument })

  assert.equal(await acceptGhost(root, 'inventory'), 'accepted')

  const accepted = (await loadAnnotatedArchitecture(root)).elements.find(element => element.id === 'inventory')!
  assert.equal(accepted.origin, 'observed')
  assert.equal(accepted.draft, 'next')
})

test('acceptGhost fails when the ghost has no scan match', { concurrency: true }, async t => {
  const root = await createWorld(t, { [inventoryPath]: inventoryDocument })

  assert.equal(await acceptGhost(root, 'inventory'), 'unmatched')
  assert.equal(await readRelative(root, inventoryPath), inventoryDocument)
})

test('acceptGhost fails when the id is not a ghost', { concurrency: true }, async t => {
  const root = await createWorld(t, {})
  assert.equal(await acceptGhost(root, 'api'), 'not-draft')
  assert.equal(await acceptGhost(root, 'unknown'), 'not-draft')
})

test('a scan match leaves the ghost a draft until accept', { concurrency: true }, async t => {
  const root = await createWorld(t, { [inventoryPath]: inventoryDocument })

  const summary = await reconcileScanObservations(root, [createScanObservation({
    scanner: { technology: 'fixture', id: 'typescript', engine: 'test', engineVersion: '1' },
    roots: [
      { id: 'root', kind: 'package', name: 'Shop', file: 'package.json' },
      { kind: 'project', parent: 'root', id: 'scope:src/api.ts', name: 'Api' },
    ],
    files: [{ roots: ['scope:src/api.ts'],
      file: 'src/inventory.ts',
      symbols: [{ id: 'src/inventory.ts#Inventory', name: 'Inventory', kind: 'class' }],
    }],
    diagnostics: [],
  })])

  assert.deepEqual(summary, { created: 0, refreshed: 0, matched: 1 })
  const matched = (await loadAnnotatedArchitecture(root)).elements.find(element => element.id === 'inventory')!
  assert.equal(matched.origin, 'draft')
  assert.equal(matched.code.length, 1)

  assert.equal(await acceptGhost(root, 'inventory'), 'accepted')
  const accepted = (await loadAnnotatedArchitecture(root)).elements.find(element => element.id === 'inventory')!
  assert.equal(accepted.origin, 'observed')
  assert.deepEqual(accepted.code, matched.code)
})
