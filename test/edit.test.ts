import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'edit',
)

const observedOrdersPath =
  'groma/observed/systems/shop/containers/api/components/orders.md'
const plannedOrdersPath =
  'groma/plans/next/systems/shop/containers/api/components/orders.md'

const observedOrders = `---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: src/orders.ts
      symbol: placeOrder
---

Owns the order lifecycle.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const editedOrders = `---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: src/orders.ts
      symbol: placeOrder
---

Places and tracks customer orders.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const restatedOrders = `---
type: C4 Component
title: Orders
status: draft
groma:
  id: orders
  parent: api
---

Places an order through a guided checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const copiedOrders = `---
type: C4 Component
title: Orders
status: draft
groma:
  id: orders
  parent: api
---

Owns the order lifecycle.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const approvedPlanIndex = '# Next\n'

const approvedOutcome = `# Next

## Outcome

The next release adds stock checks.
`

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

function groma(root: string, args: string[]) {
  return run('bun', [path.join(projectRoot, 'src/cli.ts'), ...args], root)
}

async function createRepo(t: TestContext): Promise<string> {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'groma-edit-'))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const root = path.join(parent, 'repo')
  await cp(fixtureRoot, root, { recursive: true })
  return root
}

async function readTree(root: string, relative = 'groma'): Promise<Record<string, string>> {
  const dir = path.join(root, relative)
  const tree: Record<string, string> = {}
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const rel = `${relative}/${entry.name}`
    if (entry.isDirectory()) {
      Object.assign(tree, await readTree(root, rel))
    } else {
      tree[rel] = await readFile(path.join(root, rel), 'utf8')
    }
  }
  return tree
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

function readRelative(root: string, relative: string): Promise<string> {
  return readFile(path.join(root, ...relative.split('/')), 'utf8')
}

test('groma edit element --overview replaces only the owning lead prose', async t => {
  const root = await createRepo(t)
  const result = await groma(root, [
    'edit',
    'orders',
    '--overview',
    'Places and tracks customer orders.',
  ])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout, 'ok\norders\n')
  assert.equal(result.stderr, '')
  assert.equal(await readRelative(root, observedOrdersPath), editedOrders)
})

test('groma edit element --plan restates the id without code and creates the plan index', async t => {
  const root = await createRepo(t)
  const result = await groma(root, [
    'edit',
    'orders',
    '--plan',
    'next',
    '--overview',
    'Places an order through a guided checkout.',
  ])
  const world = await groma(root, ['view', '--plain'])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout, 'ok\norders\n')
  assert.equal(await readRelative(root, plannedOrdersPath), restatedOrders)
  assert.equal(await readRelative(root, observedOrdersPath), observedOrders)
  assert.equal(
    await readRelative(root, 'groma/plans/next/index.md'),
    approvedPlanIndex,
  )
  assert.match(world.stdout, /orders {2}component {2}Orders {2}planned:next/)

  const existingRoot = await createRepo(t)
  const customIndex = '# Custom heading\n'
  await writeTree(existingRoot, { 'groma/plans/next/index.md': customIndex })
  const existing = await groma(existingRoot, [
    'edit',
    'orders',
    '--plan',
    'next',
    '--overview',
    'Places an order through a guided checkout.',
  ])
  assert.equal(existing.code, 0, existing.stderr)
  assert.equal(
    await readRelative(existingRoot, 'groma/plans/next/index.md'),
    customIndex,
  )
})

test('groma edit plan --overview sets the plan index Outcome body', async t => {
  const root = await createRepo(t)
  await writeTree(root, { 'groma/plans/next/index.md': approvedPlanIndex })
  const created = await groma(root, [
    'edit',
    'next',
    '--overview',
    'The next release adds stock checks.',
  ])

  assert.equal(created.code, 0, created.stderr)
  assert.equal(created.stdout, 'ok\nnext\n')
  assert.equal(await readRelative(root, 'groma/plans/next/index.md'), approvedOutcome)

  const replaced = await groma(root, [
    'edit',
    'next',
    '--overview',
    'Stock checks ship next.',
  ])
  assert.equal(replaced.code, 0, replaced.stderr)
  assert.equal(
    await readRelative(root, 'groma/plans/next/index.md'),
    `# Next

## Outcome

Stock checks ship next.
`,
  )
})

test('a restated ghost copies current overview when --overview is omitted and later edits the planned owner', async t => {
  const root = await createRepo(t)
  const copied = await groma(root, ['edit', 'orders', '--plan', 'next'])
  assert.equal(copied.code, 0, copied.stderr)
  assert.equal(copied.stdout, 'ok\norders\n')
  assert.equal(await readRelative(root, plannedOrdersPath), copiedOrders)

  const noop = await groma(root, ['edit', 'orders', '--plan', 'next'])
  assert.equal(noop.code, 0, noop.stderr)
  assert.equal(await readRelative(root, plannedOrdersPath), copiedOrders)

  const restated = await groma(root, [
    'edit',
    'orders',
    '--plan',
    'next',
    '--overview',
    'Places an order through a guided checkout.',
  ])
  assert.equal(restated.code, 0, restated.stderr)
  assert.equal(await readRelative(root, plannedOrdersPath), restatedOrders)
  assert.equal(await readRelative(root, observedOrdersPath), observedOrders)

  const owned = await groma(root, [
    'edit',
    'orders',
    '--overview',
    'Places and tracks customer orders.',
  ])
  assert.equal(owned.code, 0, owned.stderr)
  assert.equal(
    await readRelative(root, plannedOrdersPath),
    restatedOrders.replace(
      'Places an order through a guided checkout.',
      'Places and tracks customer orders.',
    ),
  )
  assert.equal(await readRelative(root, observedOrdersPath), observedOrders)
})

test('unknown id, missing --overview, --plan on a plan, non-kebab plan id, and a claimed id fail without writes', async t => {
  const root = await createRepo(t)
  await writeTree(root, {
    'groma/plans/next/index.md': approvedPlanIndex,
    'groma/plans/other/index.md': '# Other\n',
    'groma/plans/other/systems/shop/containers/api/components/orders.md': copiedOrders,
  })
  const before = await readTree(root)

  const cases: Array<{ name: string, args: string[], pattern: RegExp }> = [
    {
      name: 'unknown id',
      args: ['edit', 'nope', '--overview', 'Missing.'],
      pattern: /unknown id "nope"/,
    },
    {
      name: 'unknown id without overview',
      args: ['edit', 'nope'],
      pattern: /unknown id "nope"/,
    },
    {
      name: 'missing overview on an element',
      args: ['edit', 'orders'],
      pattern: /--overview/,
    },
    {
      name: 'missing overview on a plan',
      args: ['edit', 'next'],
      pattern: /--overview/,
    },
    {
      name: '--plan on a plan id',
      args: ['edit', 'next', '--plan', 'other', '--overview', 'Nope.'],
      pattern: /--plan is only valid on an element/,
    },
    {
      name: 'non-kebab plan id',
      args: ['edit', 'stock', '--plan', 'Next', '--overview', 'Nope.'],
      pattern: /plan id must be lowercase kebab-case/,
    },
    {
      name: 'id claimed by another plan',
      args: ['edit', 'orders', '--plan', 'next', '--overview', 'Nope.'],
      pattern: /already claimed by other/,
    },
  ]

  for (const item of cases) {
    const result = await groma(root, item.args)
    assert.notEqual(result.code, 0, item.name)
    assert.match(result.stderr, item.pattern, item.name)
    assert.equal(result.stdout, '', item.name)
    assert.deepEqual(await readTree(root), before, item.name)
  }
})
