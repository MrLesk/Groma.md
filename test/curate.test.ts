import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'edit')
const ordersPath = 'groma/observed/systems/shop/containers/api/components/orders.md'

function groma(root: string, args: string[]) {
  return new Promise<{ code: number | null, stdout: string, stderr: string }>(
    (resolve, reject) => {
      const child = spawn(
        'bun',
        [path.join(projectRoot, 'src/cli.ts'), ...args],
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
      child.on('error', reject)
      child.on('close', code => { resolve({ code, stdout, stderr }) })
    },
  )
}

async function createRepo(t: TestContext): Promise<string> {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'groma-curate-'))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const root = path.join(parent, 'repo')
  await cp(fixtureRoot, root, { recursive: true })
  return root
}

async function readTree(root: string, relative = 'groma'): Promise<Record<string, string>> {
  const directory = path.join(root, relative)
  const tree: Record<string, string> = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = `${relative}/${entry.name}`
    if (entry.isDirectory()) Object.assign(tree, await readTree(root, child))
    else tree[child] = await readFile(path.join(root, child), 'utf8')
  }
  return tree
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, relative)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

function readRelative(root: string, relative: string): Promise<string> {
  return readFile(path.join(root, relative), 'utf8')
}

test('groma edit assigns and clears a component group without changing its meaning', async t => {
  const root = await createRepo(t)
  const grouped = await groma(root, ['edit', 'orders', '--group', 'Commerce'])

  assert.equal(grouped.code, 0, grouped.stderr)
  const groupedSource = await readRelative(root, ordersPath)
  assert.match(groupedSource, /group: "Commerce"/)
  assert.match(groupedSource, /Owns the order lifecycle\./)
  assert.match(groupedSource, /\[Stock\]\(stock\.md\)/)

  const ungrouped = await groma(root, ['edit', 'orders', '--ungroup'])
  assert.equal(ungrouped.code, 0, ungrouped.stderr)
  assert.doesNotMatch(await readRelative(root, ordersPath), /^group:/m)
})

test('groma edit moves an empty scanned component to another container', async t => {
  const root = await createRepo(t)
  const helper = `---
id: helper
kind: component
parent: api
code:
  - scanner: typescript
    file: src/helper.ts
---

# Helper
`
  await writeTree(root, {
    'groma/observed/systems/shop/containers/worker/container.md': `---
id: worker
kind: container
parent: shop
---

# Worker

Runs background jobs.
`,
    'groma/observed/systems/shop/containers/api/components/helper.md': helper,
  })

  const moved = await groma(root, ['edit', 'helper', '--parent', 'worker'])

  assert.equal(moved.code, 0, moved.stderr)
  await assert.rejects(readRelative(root, 'groma/observed/systems/shop/containers/api/components/helper.md'))
  assert.equal(
    await readRelative(root, 'groma/observed/systems/shop/containers/worker/components/helper.md'),
    helper.replace('parent: api', 'parent: "worker"'),
  )
})

test('groma edit combines empty scanned components into one authored responsibility', async t => {
  const root = await createRepo(t)
  await writeTree(root, {
    'groma/observed/systems/shop/containers/api/components/read.md': `---
id: read
kind: component
parent: api
code:
  - scanner: typescript
    file: src/read.ts
---

# Read
`,
    'groma/observed/systems/shop/containers/api/components/write.md': `---
id: write
kind: component
parent: api
code:
  - scanner: typescript
    file: src/write.ts
---

# Write
`,
  })

  const combined = await groma(root, [
    'edit',
    'read',
    '--description',
    'Reads and writes order data.',
    '--group',
    'Persistence',
    '--combine',
    'write',
  ])

  assert.equal(combined.code, 0, combined.stderr)
  const source = await readRelative(root, 'groma/observed/systems/shop/containers/api/components/read.md')
  assert.match(source, /group: "Persistence"/)
  assert.match(source, /file: src\/read\.ts/)
  assert.match(source, /file: src\/write\.ts/)
  assert.match(source, /Reads and writes order data\./)
  await assert.rejects(readRelative(root, 'groma/observed/systems/shop/containers/api/components/write.md'))
})

test('groma edit combines an empty scanned container and reparents its empty children', async t => {
  const root = await createRepo(t)
  await writeTree(root, {
    'groma/observed/systems/shop/containers/worker/container.md': `---
id: worker
kind: container
parent: shop
---

# Worker
`,
    'groma/observed/systems/shop/containers/worker/components/helper.md': `---
id: helper
kind: component
parent: worker
code:
  - scanner: typescript
    file: src/helper.ts
---

# Helper
`,
  })

  const combined = await groma(root, ['edit', 'api', '--combine', 'worker'])

  assert.equal(combined.code, 0, combined.stderr)
  await assert.rejects(readRelative(root, 'groma/observed/systems/shop/containers/worker/container.md'))
  await assert.rejects(readRelative(root, 'groma/observed/systems/shop/containers/worker/components/helper.md'))
  assert.match(
    await readRelative(root, 'groma/observed/systems/shop/containers/api/components/helper.md'),
    /parent: "api"/,
  )
})

test('structural edits reject authored or related elements before writing', async t => {
  const root = await createRepo(t)
  await writeTree(root, {
    'groma/observed/systems/shop/containers/api/components/grouped.md': `---
id: grouped
kind: component
parent: api
group: "Commerce"
code:
  - scanner: typescript
    file: src/grouped.ts
---

# Grouped
`,
    'groma/observed/systems/shop/containers/api/components/typed.md': `---
id: typed
kind: component
parent: api
technology: "TypeScript"
code:
  - scanner: typescript
    file: src/typed.ts
---

# Typed
`,
  })
  const before = await readTree(root)
  const cases: Array<{ args: string[], pattern: RegExp }> = [
    { args: ['edit', 'orders', '--parent', 'api'], pattern: /authored relationship/ },
    { args: ['edit', 'orders', '--combine', 'stock'], pattern: /authored relationship/ },
    { args: ['edit', 'orders', '--combine', 'grouped'], pattern: /authored metadata/ },
    { args: ['edit', 'orders', '--combine', 'typed'], pattern: /authored metadata/ },
    { args: ['edit', 'api', '--group', 'Runtime'], pattern: /only valid on components/ },
  ]

  for (const item of cases) {
    const result = await groma(root, item.args)
    assert.notEqual(result.code, 0)
    assert.match(result.stderr, item.pattern)
    assert.deepEqual(await readTree(root), before)
  }
})
