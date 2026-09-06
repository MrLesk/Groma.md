import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { copyFixture, groma, projectRoot, readRelative, readTree, writeTree } from './cli-helpers.ts'

const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'edit')
const ordersPath = 'groma/systems/shop/containers/api/components/orders.md'

test('groma edit assigns and clears a component group without changing its meaning', { concurrency: true }, async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-curate-')
  const grouped = await groma(root, ['edit', 'orders', '--group', 'Commerce'])

  assert.equal(grouped.code, 0, grouped.stderr)
  const groupedSource = await readRelative(root, ordersPath)
  assert.match(groupedSource, /^ {2}group: Commerce$/m)
  assert.match(groupedSource, /Owns the order lifecycle\./)
  assert.equal(await readRelative(root, 'groma/relationships.md'), await readRelative(fixtureRoot, 'groma/relationships.md'))

  const ungrouped = await groma(root, ['edit', 'orders', '--ungroup'])
  assert.equal(ungrouped.code, 0, ungrouped.stderr)
  assert.doesNotMatch(await readRelative(root, ordersPath), /^ {2}group:/m)
})

test('groma edit moves an empty scanned component to another container', { concurrency: true }, async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-curate-')
  const helper = `---
type: C4 Component
title: Helper
status: stable
groma:
  id: helper
  parent: api
  code:
    - scanner: typescript
      file: src/helper.ts
---
`
  await writeTree(root, {
    'groma/systems/shop/containers/worker/container.md': `---
type: C4 Container
title: Worker
status: stable
groma:
  id: worker
  parent: shop
---

Runs background jobs.
`,
    'groma/systems/shop/containers/api/components/helper.md': helper,
  })

  const moved = await groma(root, ['edit', 'helper', '--parent', 'worker'])

  assert.equal(moved.code, 0, moved.stderr)
  await assert.rejects(readRelative(root, 'groma/systems/shop/containers/api/components/helper.md'), { code: 'ENOENT' })
  assert.equal(
    await readRelative(root, 'groma/systems/shop/containers/worker/components/helper.md'),
    helper.replace('parent: api', 'parent: worker'),
  )
})

test('groma edit combines empty scanned components into one authored responsibility', { concurrency: true }, async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-curate-')
  await writeTree(root, {
    'groma/systems/shop/containers/api/components/read.md': `---
type: C4 Component
title: Read
status: stable
groma:
  id: read
  parent: api
  code:
    - scanner: typescript
      file: src/read.ts
---
`,
    'groma/systems/shop/containers/api/components/write.md': `---
type: C4 Component
title: Write
status: stable
groma:
  id: write
  parent: api
  code:
    - scanner: typescript
      file: src/write.ts
---
`,
  })

  const combined = await groma(root, [
    'edit',
    'read',
    '--overview',
    'Reads and writes order data.',
    '--group',
    'Persistence',
    '--combine',
    'write',
  ])

  assert.equal(combined.code, 0, combined.stderr)
  const source = await readRelative(root, 'groma/systems/shop/containers/api/components/read.md')
  assert.match(source, /^ {2}group: Persistence$/m)
  assert.match(source, /file: src\/read\.ts/)
  assert.match(source, /file: src\/write\.ts/)
  assert.match(source, /Reads and writes order data\./)
  await assert.rejects(readRelative(root, 'groma/systems/shop/containers/api/components/write.md'), { code: 'ENOENT' })
})

test('groma edit combines an empty scanned container and reparents its empty children', { concurrency: true }, async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-curate-')
  await writeTree(root, {
    'groma/systems/shop/containers/worker/container.md': `---
type: C4 Container
title: Worker
status: stable
groma:
  id: worker
  parent: shop
---
`,
    'groma/systems/shop/containers/worker/components/helper.md': `---
type: C4 Component
title: Helper
status: stable
groma:
  id: helper
  parent: worker
  code:
    - scanner: typescript
      file: src/helper.ts
---
`,
  })

  const combined = await groma(root, ['edit', 'api', '--combine', 'worker'])

  assert.equal(combined.code, 0, combined.stderr)
  await assert.rejects(readRelative(root, 'groma/systems/shop/containers/worker/container.md'), { code: 'ENOENT' })
  await assert.rejects(readRelative(root, 'groma/systems/shop/containers/worker/components/helper.md'), { code: 'ENOENT' })
  assert.match(
    await readRelative(root, 'groma/systems/shop/containers/api/components/helper.md'),
    /parent: api/,
  )
})

test('structural edits reject authored or related elements before writing', { concurrency: true }, async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-curate-')
  await writeTree(root, {
    'groma/systems/shop/containers/api/components/grouped.md': `---
type: C4 Component
title: Grouped
status: stable
groma:
  id: grouped
  parent: api
  group: Commerce
  code:
    - scanner: typescript
      file: src/grouped.ts
---
`,
    'groma/systems/shop/containers/api/components/typed.md': `---
type: C4 Component
title: Typed
status: stable
groma:
  id: typed
  parent: api
  technology: TypeScript
  code:
    - scanner: typescript
      file: src/typed.ts
---
`,
  })
  const before = await readTree(root)
  const cases: string[][] = [
    ['edit', 'orders', '--parent', 'api'],
    ['edit', 'orders', '--combine', 'stock'],
    ['edit', 'orders', '--combine', 'grouped'],
    ['edit', 'orders', '--combine', 'typed'],
    ['edit', 'api', '--group', 'Runtime'],
  ]

  for (const args of cases) {
    const result = await groma(root, args)
    assert.notEqual(result.code, 0)
    assert.deepEqual(await readTree(root), before)
  }
})
