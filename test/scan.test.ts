import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'

import { foldScanResult } from '../src/core.ts'
import { scanTypeScriptSource } from '../src/typescript-scanner.ts'
import type { ScanCandidate } from '../src/types.ts'

function documentBody(source: string): string {
  const close = source.indexOf('\n---\n', 4)
  assert.ok(close !== -1)
  return source.slice(close + 5)
}

async function writeTree(
  root: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

async function createWorld(
  t: TestContext,
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-scan-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeTree(root, {
    'groma/observed/README.md': '# Observed\n',
    'groma/missing/README.md': '# Missing\n',
    'groma/plans/README.md': '# Plans\n',
    'groma/observed/systems/shop/system.md': `---
id: shop
kind: system
---

# Shop

Lets customers place orders.
`,
    'groma/observed/systems/shop/containers/api/container.md': `---
id: api
kind: container
parent: shop
---

# Api

Takes order requests.
`,
    ...files,
  })
  return root
}

const ordersDocument = `---
id: orders
kind: component
parent: api
code:
  - scanner: typescript
    file: src/orders.ts
    symbol: placeOrder
---

# Orders

Places and tracks customer orders.

## Notes

Curated prose must remain.
`

const inventoryDocument = `---
id: inventory
kind: component
parent: api
---

# Inventory

Tracks stock for the shop.
`

function ordersCandidate(
  overrides: Partial<ScanCandidate> = {},
): ScanCandidate {
  return {
    kind: 'component',
    name: 'Orders',
    responsibility: 'This must not overwrite curated prose.',
    parent: 'Api',
    code: [
      { scanner: 'typescript', file: 'src/orders.ts', symbol: 'placeOrder' },
      { scanner: 'typescript', file: 'src/orders.ts', symbol: 'cancelOrder' },
    ],
    ...overrides,
  }
}

test('the TypeScript plugin result has no architecture IDs', async () => {
  const result = await scanTypeScriptSource('.')
  assert.deepEqual(result, { candidates: [] })
  assert.equal(JSON.stringify(result).includes('"id"'), false)
})

test('an observed match refreshes code and leaves the body alone', async t => {
  const root = await createWorld(t, {
    'groma/observed/systems/shop/containers/api/components/orders.md':
      ordersDocument,
  })

  const summary = await foldScanResult(root, {
    candidates: [
      ordersCandidate({
        name: 'Order service',
      }),
    ],
  })

  const source = await readFile(
    path.join(
      root,
      'groma/observed/systems/shop/containers/api/components/orders.md',
    ),
    'utf8',
  )
  assert.deepEqual(summary, { created: 0, refreshed: 1, matched: 0 })
  assert.match(source, /symbol: cancelOrder/)
  assert.equal(documentBody(source), documentBody(ordersDocument))
  assert.match(source, /Curated prose must remain\./)
  assert.doesNotMatch(source, /This must not overwrite curated prose/)
})

test('a ghost match attaches code and stays planned', async t => {
  const root = await createWorld(t, {
    'groma/plans/next/README.md': `---
id: next
---

# Next
`,
    'groma/plans/next/systems/shop/containers/api/components/inventory.md':
      inventoryDocument,
  })

  const summary = await foldScanResult(root, {
    candidates: [{
      kind: 'component',
      name: 'Inventory',
      responsibility: 'This must not accept the ghost.',
      parent: 'Api',
      code: [
        { scanner: 'typescript', file: 'src/inventory.ts', symbol: 'Inventory' },
      ],
    }],
  })

  const planned = await readFile(
    path.join(
      root,
      'groma/plans/next/systems/shop/containers/api/components/inventory.md',
    ),
    'utf8',
  )
  await assert.rejects(
    readFile(
      path.join(
        root,
        'groma/observed/systems/shop/containers/api/components/inventory.md',
      ),
    ),
    (error: NodeJS.ErrnoException) => error.code === 'ENOENT',
  )
  assert.deepEqual(summary, { created: 0, refreshed: 0, matched: 1 })
  assert.match(planned, /file: src\/inventory\.ts/)
  assert.match(planned, /symbol: Inventory/)
  assert.equal(documentBody(planned), documentBody(inventoryDocument))
  assert.doesNotMatch(planned, /This must not accept the ghost/)
})

test('an unknown candidate becomes a new observed file with a kebab-case id', async t => {
  const root = await createWorld(t, {})

  const summary = await foldScanResult(root, {
    candidates: [{
      kind: 'component',
      name: 'Stock checker',
      responsibility: 'Checks stock before placing an order.',
      parent: 'Api',
      code: [{ scanner: 'typescript', file: 'src/stock.ts' }],
    }],
  })

  const source = await readFile(
    path.join(
      root,
      'groma/observed/systems/shop/containers/api/components/stock-checker.md',
    ),
    'utf8',
  )
  assert.deepEqual(summary, { created: 1, refreshed: 0, matched: 0 })
  assert.equal(source, `---
id: stock-checker
kind: component
parent: api
code:
  - scanner: typescript
    file: src/stock.ts
---

# Stock checker

Checks stock before placing an order.
`)
})
