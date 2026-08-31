import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAnnotatedArchitecture } from '../src/core.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'create',
)

const approvedStock = `---
type: C4 Component
title: Stock
status: draft
groma:
  id: stock
  parent: api
---

Checks stock before placing an order.
`

const approvedPlanIndex = '# Next\n'

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
  const parent = await mkdtemp(path.join(os.tmpdir(), 'groma-create-'))
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

const approvedArgs = [
  'create',
  'Stock',
  '--plan',
  'next',
  '--kind',
  'component',
  '--parent',
  'api',
  '--overview',
  'Checks stock before placing an order.',
]

test('groma create authors a planned component and prints ok plus the kebab-case id', async t => {
  const root = await createRepo(t)
  const result = await groma(root, approvedArgs)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout, 'ok\nstock\n')
  assert.equal(result.stderr, '')
  assert.equal(
    await readFile(
      path.join(root, 'groma/plans/next/systems/shop/containers/api/components/stock.md'),
      'utf8',
    ),
    approvedStock,
  )
})

test('a created container or component is planned under the given parent', async t => {
  const root = await createRepo(t)
  const component = await groma(root, approvedArgs)
  const container = await groma(root, [
    'create',
    'Warehouse',
    '--plan',
    'next',
    '--kind',
    'container',
    '--parent',
    'shop',
    '--overview',
    'Stores goods.',
  ])

  assert.equal(component.code, 0, component.stderr)
  assert.equal(container.code, 0, container.stderr)
  const model = await loadAnnotatedArchitecture(root)
  const stock = model.elements.find(element => element.id === 'stock')
  const warehouse = model.elements.find(element => element.id === 'warehouse')
  assert.ok(stock)
  assert.equal(stock.origin, 'planned')
  assert.equal(stock.plan, 'next')
  assert.equal(stock.parent, 'observed:api')
  assert.ok(warehouse)
  assert.equal(warehouse.origin, 'planned')
  assert.equal(warehouse.plan, 'next')
  assert.equal(warehouse.parent, 'observed:shop')
})

test('groma create --observed rebuilds the observed scaffold without a plan', async t => {
  const root = await createRepo(t)
  await rm(path.join(root, 'groma', 'observed'), { recursive: true, force: true })

  const system = await groma(root, [
    'create',
    'Shop',
    '--observed',
    '--kind',
    'system',
    '--overview',
    'Sells goods.',
  ])
  const container = await groma(root, [
    'create',
    'API',
    '--observed',
    '--kind',
    'container',
    '--parent',
    'shop',
    '--technology',
    'HTTP',
    '--overview',
    'Handles orders.',
  ])
  const external = await groma(root, [
    'create',
    'Git',
    '--observed',
    '--kind',
    'system',
    '--external',
    '--overview',
    'Keeps history.',
  ])

  assert.equal(system.code, 0, system.stderr)
  assert.equal(container.code, 0, container.stderr)
  assert.equal(external.code, 0, external.stderr)
  const model = await loadAnnotatedArchitecture(root)
  assert.equal(model.elements.find(element => element.id === 'shop')?.origin, 'observed')
  assert.equal(model.elements.find(element => element.id === 'api')?.parent, 'observed:shop')
  assert.equal(model.elements.find(element => element.id === 'api')?.technology, 'HTTP')
  assert.equal(model.elements.find(element => element.id === 'git')?.external, true)
  assert.equal(
    await readFile(path.join(root, 'groma', 'observed', 'index.md'), 'utf8'),
    '# Observed architecture\n',
  )
})

test('--parent is required for container and component and forbidden for actor and system', async t => {
  const root = await createRepo(t)
  const before = await readTree(root)
  const missingComponentParent = await groma(root, [
    'create',
    'Stock',
    '--plan',
    'next',
    '--kind',
    'component',
    '--overview',
    'Checks stock.',
  ])
  const missingContainerParent = await groma(root, [
    'create',
    'Warehouse',
    '--plan',
    'next',
    '--kind',
    'container',
    '--overview',
    'Stores goods.',
  ])
  const actorParent = await groma(root, [
    'create',
    'Buyer',
    '--plan',
    'next',
    '--kind',
    'actor',
    '--parent',
    'shop',
    '--overview',
    'Pays for goods.',
  ])
  const systemParent = await groma(root, [
    'create',
    'Git',
    '--plan',
    'next',
    '--kind',
    'system',
    '--parent',
    'shop',
    '--overview',
    'Versions the Markdown.',
  ])

  assert.notEqual(missingComponentParent.code, 0)
  assert.match(missingComponentParent.stderr, /--parent is required for component/)
  assert.equal(missingComponentParent.stdout, '')
  assert.notEqual(missingContainerParent.code, 0)
  assert.match(missingContainerParent.stderr, /--parent is required for container/)
  assert.notEqual(actorParent.code, 0)
  assert.match(actorParent.stderr, /--parent is forbidden for actor/)
  assert.notEqual(systemParent.code, 0)
  assert.match(systemParent.stderr, /--parent is forbidden for system/)
  assert.deepEqual(await readTree(root), before)

  const actor = await groma(root, [
    'create',
    'Buyer',
    '--plan',
    'next',
    '--kind',
    'actor',
    '--overview',
    'Pays for goods.',
  ])
  assert.equal(actor.code, 0, actor.stderr)
  assert.equal(actor.stdout, 'ok\nbuyer\n')
  const model = await loadAnnotatedArchitecture(root)
  const buyer = model.elements.find(element => element.id === 'buyer')
  assert.ok(buyer)
  assert.equal(buyer.origin, 'planned')
  assert.equal(buyer.parent, null)
  assert.equal(
    await readFile(path.join(root, 'groma/plans/next/actors/buyer.md'), 'utf8'),
    `---
type: C4 Actor
title: Buyer
status: draft
groma:
  id: buyer
---

Pays for goods.
`,
  )
})

test('first use of a kebab-case plan id writes the plan index and leaves an existing index alone', async t => {
  const firstRoot = await createRepo(t)
  const first = await groma(firstRoot, approvedArgs)
  assert.equal(first.code, 0, first.stderr)
  assert.equal(
    await readFile(path.join(firstRoot, 'groma/plans/next/index.md'), 'utf8'),
    approvedPlanIndex,
  )

  const existingRoot = await createRepo(t)
  const existingIndex = '# Custom heading\n'
  await writeTree(existingRoot, { 'groma/plans/next/index.md': existingIndex })
  const existing = await groma(existingRoot, approvedArgs)
  assert.equal(existing.code, 0, existing.stderr)
  assert.equal(
    await readFile(path.join(existingRoot, 'groma/plans/next/index.md'), 'utf8'),
    existingIndex,
  )
})

test('duplicate id, unknown parent, missing flag, illegal kind or parent, and non-kebab plan id fail without writes', async t => {
  const root = await createRepo(t)
  await writeTree(root, {
    'groma/observed/systems/shop/containers/api/components/stock.md':
      approvedStock.replace('status: draft', 'status: stable'),
  })
  const before = await readTree(root)

  const cases: Array<{ name: string, args: string[], pattern: RegExp }> = [
    {
      name: 'duplicate id',
      args: approvedArgs,
      pattern: /id "stock" already exists/,
    },
    {
      name: 'unknown parent',
      args: [
        'create',
        'Inventory',
        '--plan',
        'next',
        '--kind',
        'component',
        '--parent',
        'nope',
        '--overview',
        'Tracks stock.',
      ],
      pattern: /unknown parent "nope"/,
    },
    {
      name: 'missing plan',
      args: [
        'create',
        'Inventory',
        '--kind',
        'component',
        '--parent',
        'api',
        '--overview',
        'Tracks stock.',
      ],
      pattern: /--plan/,
    },
    {
      name: 'missing kind',
      args: [
        'create',
        'Inventory',
        '--plan',
        'next',
        '--parent',
        'api',
        '--overview',
        'Tracks stock.',
      ],
      pattern: /--kind/,
    },
    {
      name: 'missing overview',
      args: [
        'create',
        'Inventory',
        '--plan',
        'next',
        '--kind',
        'component',
        '--parent',
        'api',
      ],
      pattern: /--overview/,
    },
    {
      name: 'illegal kind',
      args: [
        'create',
        'Inventory',
        '--plan',
        'next',
        '--kind',
        'person',
        '--parent',
        'api',
        '--overview',
        'Tracks stock.',
      ],
      pattern: /unknown kind "person"/,
    },
    {
      name: 'illegal parent kind',
      args: [
        'create',
        'Inventory',
        '--plan',
        'next',
        '--kind',
        'component',
        '--parent',
        'shop',
        '--overview',
        'Tracks stock.',
      ],
      pattern: /component requires a container parent, but "shop" is a system/,
    },
    {
      name: 'non-kebab plan id',
      args: [
        'create',
        'Inventory',
        '--plan',
        'Next',
        '--kind',
        'component',
        '--parent',
        'api',
        '--overview',
        'Tracks stock.',
      ],
      pattern: /plan id must be lowercase kebab-case/,
    },
    {
      name: 'external component',
      args: [
        'create',
        'Inventory',
        '--observed',
        '--kind',
        'component',
        '--parent',
        'api',
        '--external',
        '--overview',
        'Tracks stock.',
      ],
      pattern: /--external is allowed only for systems/,
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
