import { expect, test } from 'bun:test'
import type { ArchitectureFinding, ArchitectureFindingInstance } from '../src/types.ts'
import { compareOperations, comparisonReader, duplicateGroups, operationSource } from '../src/viewers/web/duplicates/model.ts'

function instance(owner: string, startLine = 2, endLine = 4): ArchitectureFindingInstance {
  return { owner, name: 'operation', file: `${owner}.ts`, startLine, endLine }
}

test.concurrent('owner filters keep outside copies and combine with match filtering', () => {
  const findings: ArchitectureFinding[] = [
    { id: 'shared', kind: 'duplicated-logic', title: '', match: 'similar', instances: [instance('a'), instance('b')], differences: [] },
    { id: 'local', kind: 'duplicated-logic', title: '', match: 'exact', instances: [instance('b'), instance('b', 8, 10)], differences: [] },
  ]
  const groups = duplicateGroups(findings, 'a', 'similar')
  expect(groups).toHaveLength(1)
  expect(groups[0]!.instances.map(copy => copy.owner)).toEqual(['a', 'b'])
  expect(duplicateGroups(findings, 'a', 'exact')).toEqual([])
  expect(findings[0]!.instances).toHaveLength(2)
})

test.concurrent('comparison uses inclusive source ranges and preserves real line numbers across insertions', () => {
  const left = operationSource('outside\r\nstart\r\nreturn 5\r\nend\r\noutside', instance('a'))
  const right = operationSource('outside\nstart\nlog()\nreturn 10\nend\noutside', instance('b', 2, 5))
  const [a, b] = compareOperations(left, right, [2, 2])
  expect(a.map(line => line.number)).toEqual([2, 3, 4])
  expect(b.map(line => line.number)).toEqual([2, 3, 4, 5])
  expect(a.filter(line => line.changed).map(line => line.text)).toEqual(['return 5'])
  expect(b.filter(line => line.changed).map(line => line.text)).toEqual(['log()', 'return 10'])
  expect(a.at(-1)?.changed).toBe(false)
  expect(b.at(-1)?.changed).toBe(false)
})

test.concurrent('new comparison wins over a late source response', async () => {
  const reader = comparisonReader<string>()
  const published: (string | Error)[] = []
  let resolve!: (value: string) => void
  const pending = reader.read(() => new Promise<string>(done => { resolve = done }), value => published.push(value))
  await reader.read(async () => 'new', value => published.push(value))
  resolve('old')
  await pending
  expect(published).toEqual(['new'])
})

test.concurrent('closing or refreshing discards pending source errors', async () => {
  const reader = comparisonReader<string>()
  const published: (string | Error)[] = []
  let reject!: (error: Error) => void
  const pending = reader.read(() => new Promise<string>((_, fail) => { reject = fail }), value => published.push(value))
  reader.invalidate()
  reject(new Error('previous source'))
  await pending
  expect(published).toEqual([])
  await reader.read(async () => { throw new Error('current source') }, value => published.push(value))
  expect((published[0] as Error).message).toBe('current source')
})
