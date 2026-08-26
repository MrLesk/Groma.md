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
id: orders
kind: component
parent: api
code:
  - scanner: typescript
    file: src/orders.ts
    symbol: placeOrder
---

# Orders

Owns the order lifecycle.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const editedOrders = `---
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

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const restatedOrders = `---
id: orders
kind: component
parent: api
---

# Orders

Places an order through a guided checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const copiedOrders = `---
id: orders
kind: component
parent: api
---

# Orders

Owns the order lifecycle.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const approvedPlanReadme = `---
id: next
---

# Next
`

const approvedOutcome = `---
id: next
---

# Next

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

test('groma edit element --description replaces only the owning lead prose', async t => {
  const root = await createRepo(t)
  const result = await groma(root, [
    'edit',
    'orders',
    '--description',
    'Places and tracks customer orders.',
  ])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout, 'ok\norders\n')
  assert.equal(result.stderr, '')
  assert.equal(await readRelative(root, observedOrdersPath), editedOrders)
})

test('groma edit element --plan restates the id without code and creates the plan README', async t => {
  const root = await createRepo(t)
  const result = await groma(root, [
    'edit',
    'orders',
    '--plan',
    'next',
    '--description',
    'Places an order through a guided checkout.',
  ])
  const world = await groma(root, ['view', '--plain'])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout, 'ok\norders\n')
  assert.equal(await readRelative(root, plannedOrdersPath), restatedOrders)
  assert.equal(await readRelative(root, observedOrdersPath), observedOrders)
  assert.equal(
    await readRelative(root, 'groma/plans/next/README.md'),
    approvedPlanReadme,
  )
  assert.match(world.stdout, /orders {2}component {2}Orders {2}planned:next/)

  const existingRoot = await createRepo(t)
  const customReadme = `---
id: next
---

# Custom heading
`
  await writeTree(existingRoot, { 'groma/plans/next/README.md': customReadme })
  const existing = await groma(existingRoot, [
    'edit',
    'orders',
    '--plan',
    'next',
    '--description',
    'Places an order through a guided checkout.',
  ])
  assert.equal(existing.code, 0, existing.stderr)
  assert.equal(
    await readRelative(existingRoot, 'groma/plans/next/README.md'),
    customReadme,
  )
})

test('groma edit plan --description sets the plan README Outcome body', async t => {
  const root = await createRepo(t)
  await writeTree(root, { 'groma/plans/next/README.md': approvedPlanReadme })
  const created = await groma(root, [
    'edit',
    'next',
    '--description',
    'The next release adds stock checks.',
  ])

  assert.equal(created.code, 0, created.stderr)
  assert.equal(created.stdout, 'ok\nnext\n')
  assert.equal(await readRelative(root, 'groma/plans/next/README.md'), approvedOutcome)

  const replaced = await groma(root, [
    'edit',
    'next',
    '--description',
    'Stock checks ship next.',
  ])
  assert.equal(replaced.code, 0, replaced.stderr)
  assert.equal(
    await readRelative(root, 'groma/plans/next/README.md'),
    `---
id: next
---

# Next

## Outcome

Stock checks ship next.
`,
  )
})

test('a restated ghost copies current lead when --description is omitted and later edits the planned owner', async t => {
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
    '--description',
    'Places an order through a guided checkout.',
  ])
  assert.equal(restated.code, 0, restated.stderr)
  assert.equal(await readRelative(root, plannedOrdersPath), restatedOrders)
  assert.equal(await readRelative(root, observedOrdersPath), observedOrders)

  const owned = await groma(root, [
    'edit',
    'orders',
    '--description',
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

test('unknown id, missing --description, --plan on a plan, non-kebab plan id, and a claimed id fail without writes', async t => {
  const root = await createRepo(t)
  await writeTree(root, {
    'groma/plans/next/README.md': approvedPlanReadme,
    'groma/plans/other/README.md': `---
id: other
---

# Other
`,
    'groma/plans/other/systems/shop/containers/api/components/orders.md': copiedOrders,
  })
  const before = await readTree(root)

  const cases: Array<{ name: string, args: string[], pattern: RegExp }> = [
    {
      name: 'unknown id',
      args: ['edit', 'nope', '--description', 'Missing.'],
      pattern: /unknown id "nope"/,
    },
    {
      name: 'unknown id without description',
      args: ['edit', 'nope'],
      pattern: /unknown id "nope"/,
    },
    {
      name: 'missing description on an element',
      args: ['edit', 'orders'],
      pattern: /--description/,
    },
    {
      name: 'missing description on a plan',
      args: ['edit', 'next'],
      pattern: /--description/,
    },
    {
      name: '--plan on a plan id',
      args: ['edit', 'next', '--plan', 'other', '--description', 'Nope.'],
      pattern: /--plan is only valid on an element/,
    },
    {
      name: 'non-kebab plan id',
      args: ['edit', 'stock', '--plan', 'Next', '--description', 'Nope.'],
      pattern: /plan id must be lowercase kebab-case/,
    },
    {
      name: 'id claimed by another plan',
      args: ['edit', 'orders', '--plan', 'next', '--description', 'Nope.'],
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
