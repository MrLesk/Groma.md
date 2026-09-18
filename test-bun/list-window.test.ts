import { expect, test } from 'bun:test'
import path from 'node:path'
import { defaultPageSize, listPage, listWindowFooter, listWindowRequested, parseListWindow } from '../src/list-window.ts'
import type { ListWindowInput } from '../src/list-window.ts'
import { renderPlainRecord, renderPlainWorld } from '../src/plain-world.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/viewer-view')
const plainView = path.resolve(import.meta.dir, '../test/fixtures/plain-view')
const flows = path.resolve(import.meta.dir, '../test/fixtures/flows')

function window(input: ListWindowInput, command: string[] = []) {
  return parseListWindow(input, command)
}

test.concurrent('a window without options holds one default page and then the following items', () => {
  const items = Array.from({ length: defaultPageSize + 2 }, (_, index) => index)
  const first = listPage(items, window({}))
  expect(first.items).toHaveLength(defaultPageSize)
  expect(first.nextSkip).toBe(defaultPageSize)
  const second = listPage(items, window({ skip: String(first.nextSkip) }))
  expect(second.items).toEqual([defaultPageSize, defaultPageSize + 1])
  expect(second.nextSkip).toBeNull()
  expect([...first.items, ...second.items]).toEqual(items)
})

test.concurrent('a chosen count and skip select the window, and invalid values are refused', () => {
  const items = ['a', 'b', 'c', 'd']
  expect(listPage(items, window({ maxCount: '2', skip: '1' })).items).toEqual(['b', 'c'])
  expect(listPage(items, window({ skip: '4' })).items).toEqual([])
  expect(listPage(items, window({ maxCount: '9' })).nextSkip).toBeNull()
  expect(() => window({ maxCount: '0' })).toThrow('--max-count must be a positive integer (1 or greater).')
  expect(() => window({ skip: '-1' })).toThrow('--skip must be a non-negative integer (0 or greater).')
  expect(() => window({ count: true, json: true })).toThrow('--count cannot be combined with --json.')
  expect(listWindowRequested({})).toBe(false)
  expect(listWindowRequested({ skip: '0' })).toBe(true)
})

test.concurrent('a cut page names the range, the total and the command for the following items', () => {
  const command = ['view', 'api', '--plain', '--skip', '1']
  const cut = listPage(['a', 'b', 'c', 'd'], window({ maxCount: '2', skip: '1' }, command))
  expect(listWindowFooter(cut, command)).toBe('Showing 2-3 of 4 items. Next: groma view api --plain --skip 3')
  // The last page has nothing to offer next, and a complete list has no footer at all.
  const last = listPage(['a', 'b', 'c', 'd'], window({ skip: '3' }, command))
  expect(listWindowFooter(last, command)).toBe('Showing 4-4 of 4 items.')
  expect(listWindowFooter(listPage(['a', 'b'], window({}, command)), command)).toBeUndefined()
})

test.concurrent('--count reports the whole list instead of one page', () => {
  const items = Array.from({ length: defaultPageSize + 5 }, (_, index) => index)
  expect(listPage(items, window({ count: true })).items).toHaveLength(items.length)
  expect(listPage(items, window({ count: true, maxCount: '3' })).items).toHaveLength(3)
})

type Render = (input: ListWindowInput) => Promise<string>

function overview(input: ListWindowInput): Promise<string> {
  return renderPlainWorld(fixture, window(input, ['view', '--plain']))
}

function record(root: string, target: string, plain: boolean): Render {
  return async input => {
    const result = await renderPlainRecord(root, target, plain, window(input, ['view', target, '--plain']))
    expect(result.ok).toBe(true)
    return result.ok ? result.text.trimEnd() : ''
  }
}

/** The printed blocks, without the footer. */
function blocks(text: string): string[] {
  return text.split('\n\n').filter(block => block !== '' && !block.startsWith('Showing '))
}

/**
 * A page of `size` items and the page after it both repeat the head, which a page past the end prints alone,
 * and their remaining blocks, joined in order, are exactly the complete answer. `size` must end a section so no
 * section title repeats, and the remaining items must fit in one default page.
 */
async function expectPagesRejoin(render: Render, size: number): Promise<void> {
  const complete = blocks(await render({}))
  const total = await render({ count: true })
  const head = blocks(await render({ skip: total }))
  const first = blocks(await render({ maxCount: String(size) }))
  const second = blocks(await render({ skip: String(size) }))
  expect(first.slice(0, head.length)).toEqual(head)
  expect(second.slice(0, head.length)).toEqual(head)
  expect([...first, ...second.slice(head.length)]).toEqual(complete)
}

test.concurrent('consecutive overview pages print the complete answer once, in order', async () => {
  const complete = await overview({})
  const total = Number(await overview({ count: true }))
  expect(total).toBeGreaterThan(2)
  await expectPagesRejoin(overview, 2)
  expect(await overview({ maxCount: '2' })).toContain(`Showing 1-2 of ${total} items.`)
  expect(await overview({ skip: '2' })).not.toContain('Next:')
  expect(complete).not.toContain('Showing')
  expect(await overview({ skip: String(total) })).toContain(`Showing 0 of ${total} items.`)
})

test.concurrent('an empty section and the closing command print on the page that reaches their place', async () => {
  // The overview's empty Flows index sits between two pages, the drill-down ends with an empty section,
  // and the file answer ends with the owner record command.
  await expectPagesRejoin(page => renderPlainWorld(plainView, window(page, ['view', '--plain'])), 4)
  await expectPagesRejoin(record(plainView, 'shop', true), 2)
  await expectPagesRejoin(record(flows, 'src/entry.ts', false), 1)
})

test.concurrent('a draft summary pages the elements it touches', async () => {
  const draft = record(plainView, 'next', false)
  const complete = blocks(await draft({}))
  const total = Number(await draft({ count: true }))
  expect(total).toBe(1)
  const pastEnd = await draft({ skip: '1' })
  expect(pastEnd).toContain('Showing 0 of 1 items.')
  expect(blocks(pastEnd)).toEqual(complete.slice(0, -1))
})

test.concurrent('a drill-down pages its children and keeps the element it describes', async () => {
  const drillDown = record(fixture, 'shop', true)
  const total = Number(await drillDown({ count: true }))
  const page = await drillDown({ maxCount: '2' })
  expect(page).toContain('shop  system  Shop')
  expect(page).toContain(`Showing 1-2 of ${total} items. Next: groma view shop --plain --skip 2`)
})
