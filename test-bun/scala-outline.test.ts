import { beforeAll, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { CodeSymbol, CodeType } from '../packages/scanner/src/index.ts'
import { buildWorker } from '../plugins/scanners/scala/build.ts'
import { readScalaOutline } from '../plugins/scanners/scala/src/adapter.ts'

const root = path.resolve(import.meta.dir, '../test/fixtures/scala-outline')
const workerJar = path.resolve(import.meta.dir, '../plugins/scanners/scala/dist/worker.jar')

const symbol = ({ name, line, visibility, entry }: CodeSymbol) => [name, line, visibility, entry]

beforeAll(async () => {
  await mkdir(path.dirname(workerJar), { recursive: true })
  await buildWorker(workerJar)
})

test('Orders.scala outline follows Scala visibility and omits non-outline declarations', async () => {
  const files = await readScalaOutline(root, [{ file: 'Orders.scala', symbols: [] }])
  const outline = (file: string) => files.find(candidate => candidate.file === file)!.declarations.map(declaration => [
    declaration.kind, ...symbol(declaration), declaration.kind === 'type' ? declaration.members.map(symbol) : [],
  ])
  expect(outline('Orders.scala')).toEqual([
    ['type', 'Orders', 3, 'public', false, [
      ['place', 4, 'public', false],
      ['audit', 5, 'private', false],
      ['first', 6, 'protected', false],
      ['count', 7, 'internal', false],
    ]],
    ['type', 'Receipt', 11, 'public', false, [
      ['Receipt', 11, 'public', false],
      ['this', 12, 'public', false],
      ['this', 13, 'public', false],
    ]],
    ['type', 'Status', 15, 'public', false, [
      ['label', 17, 'public', false],
    ]],
    ['function', 'ship', 19, 'public', false, []],
  ])
})

test('entry marks a linked type and member by bare names', async () => {
  const files = await readScalaOutline(root, [{ file: 'Orders.scala', symbols: ['Orders', 'Orders.place'] }])
  const orders = files.find(file => file.file === 'Orders.scala')!.declarations.find(declaration => declaration.name === 'Orders')! as CodeType
  expect(orders.entry).toBeTrue()
  const place = orders.members.find(member => member.name === 'place')!
  expect(place.entry).toBeTrue()
  expect(orders.members.find(member => member.name === 'audit')!.entry).toBeFalse()
})
