import { expect, test } from 'bun:test'
import { defaultPageSize, listPage, listWindowFooter, listWindowRequested, parseListWindow } from '../src/list-window.ts'
import type { ListWindowInput } from '../src/list-window.ts'

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
  expect(() => window({ maxCount: '0' })).toThrow('--max-count')
  expect(() => window({ skip: '-1' })).toThrow('--skip')
  expect(() => window({ count: true, json: true })).toThrow('--count')
  expect(listWindowRequested({})).toBe(false)
  expect(listWindowRequested({ skip: '0' })).toBe(true)
})

test.concurrent('a cut page names the range, the total and the command for the following items', () => {
  const command = ['view', 'api', '--plain', '--skip', '1']
  const cut = listPage(['a', 'b', 'c', 'd'], window({ maxCount: '2', skip: '1' }, command))
  const footer = listWindowFooter(cut, command)
  // Keep the range, total, and next offset independent of the surrounding prose.
  expect(footer?.match(/\d+/g)).toEqual(['2', '3', '4', '3'])
  expect(footer).toEndWith('groma view api --plain --skip 3')
  // The last page has nothing to offer next, and a complete list has no footer at all.
  const last = listPage(['a', 'b', 'c', 'd'], window({ skip: '3' }, command))
  const lastFooter = listWindowFooter(last, command)
  expect(lastFooter?.match(/\d+/g)).toEqual(['4', '4', '4'])
  expect(lastFooter).not.toContain('groma ')
  expect(listWindowFooter(listPage(['a', 'b'], window({}, command)), command)).toBeUndefined()
})

test.concurrent('--count reports the whole list instead of one page', () => {
  const items = Array.from({ length: defaultPageSize + 5 }, (_, index) => index)
  expect(listPage(items, window({ count: true })).items).toHaveLength(items.length)
  expect(listPage(items, window({ count: true, maxCount: '3' })).items).toHaveLength(3)
})
