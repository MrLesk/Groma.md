import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'
import { writes } from '../src/authoring.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { scanRepository } from '../src/scanner.ts'
import { creationParent, enclosed, gestureBounds } from '../src/viewers/web/editing/intent.ts'
import { repositoryRoot } from './helpers.ts'

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-editing-'))
  await cp(path.join(repositoryRoot, 'test/fixtures/edit'), root, { recursive: true })
  assert.equal(Bun.spawnSync(['git', 'init'], { cwd: root }).exitCode, 0)
  return root
}

const relation = { kind: 'relation' as const, name: 'stock', relation: 'orders', description: 'Checks availability', technology: 'Call' }

test.concurrent('draft relationships survive edits and scans and require explicit acceptance', async () => {
  const root = await fixture()
  try {
    const drafted = Bun.spawn(['bun', path.join(repositoryRoot, 'src/cli.ts'), 'draft', 'relation', 'stock', 'orders', '--description', relation.description, '--technology', relation.technology], { cwd: root, stderr: 'pipe' })
    assert.equal(await drafted.exited, 0, await new Response(drafted.stderr).text())
    const read = async () => (await loadAnnotatedArchitecture(root)).relationships.find(row => row.source === 'stock' && row.target === 'orders')!
    assert.equal((await read()).origin, 'draft')
    await writes.edit(root, { id: 'stock', relation: 'orders', description: 'Reserves availability' })
    assert.equal((await read()).origin, 'draft')
    await scanRepository(root)
    assert.equal((await read()).origin, 'draft')
    const accepted = Bun.spawn(['bun', path.join(repositoryRoot, 'src/cli.ts'), 'accept', 'relation', 'stock', 'orders'], { cwd: root, stderr: 'pipe' })
    assert.equal(await accepted.exited, 0, await new Response(accepted.stderr).text())
    assert.equal((await read()).origin, 'observed')
    const source = path.join(root, 'groma/systems/shop/containers/api/components/stock.md')
    const before = await readFile(source, 'utf8')
    await assert.rejects(writes.remove(root, { id: 'stock', relation: 'orders' }), /only draft relationships can be removed/)
    assert.equal(await readFile(source, 'utf8'), before)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('invalid relation and details saves leave the source unchanged; clearing fields is explicit', async () => {
  const root = await fixture()
  const source = path.join(root, 'groma/systems/shop/containers/api/components/stock.md')
  try {
    const before = await readFile(source, 'utf8')
    await assert.rejects(writes.draft(root, { ...relation, technology: ' ' }))
    await assert.rejects(writes.edit(root, { id: 'stock', title: ' ', overview: 'Changed' }))
    await assert.rejects(writes.edit(root, { id: 'stock', technology: ' ' }))
    await assert.rejects(writes.edit(root, { id: 'stock', overview: '# Duplicate title' }))
    await assert.rejects(writes.edit(root, { id: 'stock', group: 'Checks', technology: ' ' }))
    assert.equal(await readFile(source, 'utf8'), before)
    await writes.edit(root, { id: 'stock', overview: 'Saved overview', technology: 'Bun' })
    await writes.edit(root, { id: 'stock', overview: '', technology: '' })
    const stock = (await loadAnnotatedArchitecture(root)).elements.find(element => element.id === 'stock')!
    assert.equal(stock.overview, '')
    assert.equal(stock.technology, undefined)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('drop intent chooses ancestry and grouping keeps world ownership', async () => {
  const root = await fixture()
  try {
    const world = await loadAnnotatedArchitecture(root)
    assert.equal(creationParent(world.elements, 'component', 'stock'), 'api')
    assert.equal(creationParent(world.elements, 'container', 'stock'), 'shop')
    assert.equal(creationParent(world.elements, 'system', undefined), undefined)
    assert.throws(() => creationParent(world.elements, 'component', undefined))
    const id = await writes.draft(root, { kind: 'component', name: 'Planned check', parent: 'api', overview: '' })
    await writes.add(root, { thing: 'group', name: 'Checks', members: ['stock', id] })
    await writes.edit(root, { id, group: 'Checks', title: 'Inventory check', technology: 'Bun' })
    const selected = (await loadAnnotatedArchitecture(root)).elements.filter(element => ['stock', id].includes(element.id))
    assert.ok(selected.every(element => element.parent === 'api' && element.group === 'Checks'))
    const created = selected.find(element => element.id === id)!
    assert.equal(created.origin, 'draft')
    assert.equal(created.title, 'Inventory check')
    assert.equal(created.technology, 'Bun')
    const bounds = gestureBounds({ x: 100, y: 100 }, { x: 0, y: 0 })
    assert.equal(enclosed(bounds, { x: 10, y: 10, width: 40, height: 40 }), true)
    assert.equal(enclosed(bounds, { x: 80, y: 10, width: 40, height: 40 }), false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
