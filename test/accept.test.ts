import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { acceptGhost, foldScanResult } from '../src/core.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function run(command: string, args: string[], cwd: string) {
  return new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      resolve({ code, stdout, stderr })
    })
  })
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
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-accept-'))
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
    'groma/plans/next/README.md': `---
id: next
---

# Next
`,
    ...files,
  })
  return root
}

const inventoryDocument = `---
id: inventory
kind: component
parent: api
---

# Inventory

Tracks stock for the shop.
`

const matchedInventoryDocument = `---
id: inventory
kind: component
parent: api
code:
  - scanner: typescript
    file: src/inventory.ts
    symbol: Inventory
---

# Inventory

Tracks stock for the shop.
`

async function missing(filename: string): Promise<void> {
  await assert.rejects(
    readFile(filename),
    (error: NodeJS.ErrnoException) => error.code === 'ENOENT',
  )
}

test('acceptGhost applies a matched new ghost into observed', async t => {
  const root = await createWorld(t, {
    'groma/plans/next/systems/shop/containers/api/components/inventory.md':
      matchedInventoryDocument,
  })

  assert.equal(await acceptGhost(root, 'inventory'), 'accepted')

  const observed = await readFile(
    path.join(
      root,
      'groma/observed/systems/shop/containers/api/components/inventory.md',
    ),
    'utf8',
  )
  assert.equal(observed, matchedInventoryDocument)
  await missing(path.join(
    root,
    'groma/plans/next/systems/shop/containers/api/components/inventory.md',
  ))
})

test('acceptGhost updates a restated observed document and removes the ghost', async t => {
  const root = await createWorld(t, {
    'groma/observed/systems/shop/containers/api/components/orders.md': `---
id: orders
kind: component
parent: api
code:
  - scanner: typescript
    file: src/orders.ts
---

# Orders

Places orders.
`,
    'groma/plans/next/systems/shop/containers/api/components/orders.md': `---
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
`,
  })

  assert.equal(await acceptGhost(root, 'orders'), 'accepted')

  const observed = await readFile(
    path.join(
      root,
      'groma/observed/systems/shop/containers/api/components/orders.md',
    ),
    'utf8',
  )
  assert.match(observed, /Places and tracks customer orders\./)
  assert.match(observed, /symbol: placeOrder/)
  assert.doesNotMatch(observed, /Places orders\.\n/)
  await missing(path.join(
    root,
    'groma/plans/next/systems/shop/containers/api/components/orders.md',
  ))
})

test('acceptGhost moves a restated ghost when the observed path changes', async t => {
  const root = await createWorld(t, {
    'groma/observed/systems/shop/containers/warehouse/container.md': `---
id: warehouse
kind: container
parent: shop
---

# Warehouse

Stores stock.
`,
    'groma/observed/systems/shop/containers/api/components/orders.md': `---
id: orders
kind: component
parent: api
---

# Orders

Places orders.
`,
    'groma/plans/next/systems/shop/containers/warehouse/components/orders.md': `---
id: orders
kind: component
parent: warehouse
code:
  - scanner: typescript
    file: src/orders.ts
---

# Orders

Picks stock in the warehouse.
`,
  })

  assert.equal(await acceptGhost(root, 'orders'), 'accepted')

  const observed = await readFile(
    path.join(
      root,
      'groma/observed/systems/shop/containers/warehouse/components/orders.md',
    ),
    'utf8',
  )
  assert.match(observed, /parent: warehouse/)
  assert.match(observed, /Picks stock in the warehouse\./)
  await missing(path.join(
    root,
    'groma/observed/systems/shop/containers/api/components/orders.md',
  ))
  await missing(path.join(
    root,
    'groma/plans/next/systems/shop/containers/warehouse/components/orders.md',
  ))
})

test('acceptGhost fails when the ghost has no scan match', async t => {
  const root = await createWorld(t, {
    'groma/plans/next/systems/shop/containers/api/components/inventory.md':
      inventoryDocument,
  })

  assert.equal(await acceptGhost(root, 'inventory'), 'unmatched')
  await missing(path.join(
    root,
    'groma/observed/systems/shop/containers/api/components/inventory.md',
  ))
  const planned = await readFile(
    path.join(
      root,
      'groma/plans/next/systems/shop/containers/api/components/inventory.md',
    ),
    'utf8',
  )
  assert.equal(planned, inventoryDocument)
})

test('acceptGhost fails when the id is not a planned ghost', async t => {
  const root = await createWorld(t, {})
  assert.equal(await acceptGhost(root, 'api'), 'missing')
  assert.equal(await acceptGhost(root, 'unknown'), 'missing')
})

test('a scan match leaves the ghost planned until accept', async t => {
  const root = await createWorld(t, {
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

  assert.deepEqual(summary, { created: 0, refreshed: 0, matched: 1 })
  await missing(path.join(
    root,
    'groma/observed/systems/shop/containers/api/components/inventory.md',
  ))
  assert.equal(await acceptGhost(root, 'inventory'), 'accepted')
  const observed = await readFile(
    path.join(
      root,
      'groma/observed/systems/shop/containers/api/components/inventory.md',
    ),
    'utf8',
  )
  assert.match(observed, /Tracks stock for the shop\./)
  assert.match(observed, /file: src\/inventory\.ts/)
  assert.doesNotMatch(observed, /This must not accept the ghost/)
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

test('groma accept applies a ghost after it scans a name match', async t => {
  const root = await createScanRepo(t, {
    'groma/plans/next/README.md': `---
id: next
---

# Next
`,
    'groma/plans/next/systems/shop/containers/cli/components/scanner.md': `---
id: scanner
kind: component
parent: cli
---

# Scanner

Reads the shop source.
`,
  })

  const result = await run(
    'bun',
    [path.join(projectRoot, 'src/cli.ts'), 'accept', 'scanner'],
    root,
  )

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout, 'ok\n')
  const observed = await readFile(
    path.join(
      root,
      'groma/observed/systems/shop/containers/cli/components/scanner.md',
    ),
    'utf8',
  )
  assert.match(observed, /Reads the shop source\./)
  assert.match(observed, /file: src\/scanner\.ts/)
  await missing(path.join(
    root,
    'groma/plans/next/systems/shop/containers/cli/components/scanner.md',
  ))
})

test('groma accept fails when a scan does not match the ghost', async t => {
  const root = await createScanRepo(t, {
    'groma/plans/next/README.md': `---
id: next
---

# Next
`,
    'groma/plans/next/systems/shop/containers/api/components/widget.md': `---
id: widget
kind: component
parent: api
---

# Widget

Does not exist in source.
`,
  })

  const result = await run(
    'bun',
    [path.join(projectRoot, 'src/cli.ts'), 'accept', 'widget'],
    root,
  )

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'no scan match\n')
  assert.equal(result.stdout, '')
  const planned = await readFile(
    path.join(
      root,
      'groma/plans/next/systems/shop/containers/api/components/widget.md',
    ),
    'utf8',
  )
  assert.match(planned, /Does not exist in source\./)
  assert.doesNotMatch(planned, /\ncode:\n/)
  await missing(path.join(
    root,
    'groma/observed/systems/shop/containers/api/components/widget.md',
  ))
})
