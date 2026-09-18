import { expect, test } from 'bun:test'
import path from 'node:path'
import { defaultPageSize, listPage, listWindowFooter, listWindowRequested, parseListWindow } from '../src/list-window.ts'
import type { ListWindowInput } from '../src/list-window.ts'
import { renderPlainRecord, renderPlainWorld } from '../src/plain-world.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/viewer-view')

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

function overview(input: ListWindowInput): Promise<string> {
  return renderPlainWorld(fixture, window(input, ['view', '--plain']))
}

async function drillDown(target: string, input: ListWindowInput): Promise<string> {
  const result = await renderPlainRecord(fixture, target, true, window(input, ['view', target, '--plain']))
  expect(result.ok).toBe(true)
  return result.ok ? result.text : ''
}

/** Content lines, without blank lines and without the footer. */
function lines(text: string): string[] {
  return [...new Set(text.split('\n').filter(line => line !== '' && !line.startsWith('Showing ')))].toSorted()
}

test.concurrent('consecutive pages show the same sections and items as the complete answer', async () => {
  const complete = await overview({})
  const total = Number(await overview({ count: true }))
  expect(total).toBeGreaterThan(2)
  const first = await overview({ maxCount: '2' })
  const second = await overview({ maxCount: String(total), skip: '2' })
  expect(lines(`${first}\n${second}`)).toEqual(lines(complete))
  // An index that holds no item at all stays visible on every page.
  expect(first).toContain('Flows\n-----\nnone')
  expect(first).toContain(`Showing 1-2 of ${total} items.`)
  expect(second).not.toContain('Next:')
  expect(complete).not.toContain('Showing')
  expect(await overview({ skip: String(total) })).toContain(`Showing 0 of ${total} items.`)
})

test.concurrent('a drill-down pages its children and keeps the element it describes', async () => {
  const total = Number(await drillDown('shop', { count: true }))
  const page = await drillDown('shop', { maxCount: '2' })
  expect(page).toContain('shop  system  Shop')
  expect(page).toContain(`Showing 1-2 of ${total} items. Next: groma view shop --plain --skip 2`)
})
