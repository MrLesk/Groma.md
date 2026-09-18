import { expect, test } from 'bun:test'
import path from 'node:path'
import { annotateArchitecture } from '../src/core.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { parseListWindow } from '../src/list-window.ts'
import type { ListWindowInput } from '../src/list-window.ts'
import { boundaryRelationships, fileConnections, renderPlainRecord, renderPlainWorld, rootRelationships } from '../src/plain-world.ts'
import type { PlainRelationship } from '../src/plain-world.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/flows')
const plainViewFixture = path.resolve(import.meta.dir, '../test/fixtures/plain-view')
const viewerViewFixture = path.resolve(import.meta.dir, '../test/fixtures/viewer-view')

async function loadFixture() {
  return annotateArchitecture(await loadArchitecture(fixture))
}

function ends(relationships: readonly PlainRelationship[]): string[] {
  return relationships.map(relationship => `${relationship.source}->${relationship.target}`).sort()
}

test.concurrent('the overview lifts relationships to root elements and drops those inside one system', async () => {
  const world = await loadFixture()
  expect(ends(rootRelationships(world))).toEqual(['requester->service', 'service->journal'])
})

test.concurrent('a drill-down keeps only relationships crossing the element boundary, split by direction', async () => {
  const world = await loadFixture()
  const container = boundaryRelationships(world, 'api')
  expect(ends(container.incoming)).toEqual(['requester->entry'])
  expect(ends(container.outgoing)).toEqual(['entry->journal'])
  const component = boundaryRelationships(world, 'entry')
  expect(ends(component.incoming)).toEqual(['requester->entry', 'worker->entry'])
  expect(ends(component.outgoing)).toEqual(['entry->journal', 'entry->worker'])
})

test.concurrent('a file lists only the rows whose endpoint is that file, not the rows addressed to its owner', async () => {
  const world = await loadFixture()
  const rows = fileConnections(world, 'src/entry.ts')
  expect(ends(rows.incoming)).toEqual(['src/worker.ts->src/entry.ts'])
  expect(ends(rows.outgoing)).toEqual(['src/entry.ts->src/worker.ts'])
})

test.concurrent('a file without relationship rows still answers with its owner and the owner record command', async () => {
  const answer = await renderPlainRecord(plainViewFixture, 'src/routes/orders.ts', false, parseListWindow({}, []))
  expect(answer.ok).toBe(true)
  expect(answer.ok ? answer.text.trimEnd() : '').toEndWith('groma view orders')
})

type Render = (input: ListWindowInput) => Promise<string>

function overview(root: string): Render {
  return input => renderPlainWorld(root, parseListWindow(input, ['view', '--plain']))
}

function record(root: string, target: string, plain: boolean): Render {
  const command = ['view', target, ...plain ? ['--plain'] : []]
  return async input => {
    const result = await renderPlainRecord(root, target, plain, parseListWindow(input, command))
    expect(result.ok).toBe(true)
    return result.ok ? result.text.trimEnd() : ''
  }
}

/** The printed blocks, without the footer. */
function blocks(text: string): string[] {
  return text.split('\n\n').filter(block => block !== '' && !block.startsWith('Showing '))
}

/**
 * The page after the first `size` items repeats the complete answer's first `headBlocks` blocks, and the two pages'
 * remaining blocks, joined in order, are exactly the complete answer. `size` must end a section so no section title
 * repeats, and the remaining items must fit in one default page.
 */
async function expectPagesRejoin(render: Render, size: number, headBlocks: number): Promise<void> {
  const complete = blocks(await render({}))
  const first = blocks(await render({ maxCount: String(size) }))
  const second = blocks(await render({ skip: String(size) }))
  expect(second.slice(0, headBlocks)).toEqual(complete.slice(0, headBlocks))
  expect([...first, ...second.slice(headBlocks)]).toEqual(complete)
}

test.concurrent('consecutive overview pages print the complete answer once, in order', async () => {
  const pages = overview(viewerViewFixture)
  const complete = await pages({})
  const total = Number(await pages({ count: true }))
  expect(total).toBeGreaterThan(2)
  await expectPagesRejoin(pages, 2, 0)
  expect(await pages({ maxCount: '2' })).toContain(`Showing 1-2 of ${total} items.`)
  expect(await pages({ skip: '2' })).not.toContain('Next:')
  expect(complete).not.toContain('Showing')
  expect(await pages({ skip: String(total) })).toContain(`Showing 0 of ${total} items.`)
})

test.concurrent('an empty section and the closing command print on the page that reaches their place', async () => {
  // The overview's empty Flows index sits between two pages, the drill-down ends with an empty section,
  // and the file answer ends with the owner record command.
  await expectPagesRejoin(overview(plainViewFixture), 4, 0)
  await expectPagesRejoin(record(plainViewFixture, 'shop', true), 2, 1)
  await expectPagesRejoin(record(fixture, 'src/entry.ts', false), 1, 1)
})

test.concurrent('a draft summary pages the elements it touches', async () => {
  const draft = record(plainViewFixture, 'next', false)
  const complete = blocks(await draft({}))
  const total = Number(await draft({ count: true }))
  expect(total).toBe(1)
  const pastEnd = await draft({ skip: '1' })
  expect(pastEnd).toContain('Showing 0 of 1 items.')
  expect(blocks(pastEnd)).toEqual(complete.slice(0, -1))
})

test.concurrent('a drill-down pages its children and keeps the element it describes', async () => {
  const drillDown = record(viewerViewFixture, 'shop', true)
  const total = Number(await drillDown({ count: true }))
  const page = await drillDown({ maxCount: '2' })
  expect(page).toContain('shop  system  Shop')
  expect(page).toContain(`Showing 1-2 of ${total} items. Next: groma view shop --plain --skip 2`)
})
