import { beforeAll, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseScanObservation } from '../packages/scanner/src/index.ts'
import { buildWorker } from '../plugins/scanners/scala/build.ts'
import { run } from '../plugins/scanners/scala/src/process.ts'

const root = path.resolve(import.meta.dir, '../test/fixtures/scala-parse')
const workerJar = path.resolve(import.meta.dir, '../plugins/scanners/scala/dist/worker.jar')

const allFiles = [
  'Inventory.scala',
  'PackageObject.scala',
  'Indent.scala',
  'Operations.scala',
  'Tokens.scala',
  'Calls.scala',
  'DuplicatePrice.scala',
  'Selection.scala',
  'api/Calls.scala',
  'api/Pricing.scala',
  'ApplyInfix.scala',
  'Broken.scala',
  'Ok.scala',
]

function javaCommand(): string {
  return process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java'
}

async function scan(files: readonly string[]) {
  return parseScanObservation(await run(javaCommand(), ['-jar', workerJar, 'scan', root], root, `${files.join('\n')}\n`))
}

beforeAll(async () => {
  await mkdir(path.dirname(workerJar), { recursive: true })
  await buildWorker(workerJar)
})

test('top-level inventory lists types and a package def without fields or nested classes', async () => {
  const observation = await scan(['Inventory.scala'])
  const symbols = observation.files!.find(file => file.file === 'Inventory.scala')!.symbols!
    .map(symbol => [symbol.name, symbol.kind] as const)
    .sort((left, right) => left[0].localeCompare(right[0]))
  expect(symbols).toEqual([
    ['Nested', 'class'],
    ['ship', 'def'],
    ['ShopCase', 'class'],
    ['ShopClass', 'class'],
    ['ShopEnum', 'enum'],
    ['ShopObject', 'object'],
    ['ShopTrait', 'trait'],
  ])
  expect(symbols.some(([name]) => name === 'Inner')).toBeFalse()
  expect(symbols.some(([name]) => name === 'total')).toBeFalse()
})

test('package object members become top-level symbols', async () => {
  const observation = await scan(['PackageObject.scala'])
  const symbols = observation.files!.find(file => file.file === 'PackageObject.scala')!.symbols!.map(symbol => symbol.name)
  expect(symbols).toEqual(['route'])
})

test('significant indentation still yields the type and its method', async () => {
  const observation = await scan(['Indent.scala'])
  const file = observation.files!.find(entry => entry.file === 'Indent.scala')!
  expect(file.symbols!.map(symbol => symbol.name)).toEqual(['Orders'])
  expect(observation.operations!.some(operation => operation.name === 'Orders.place')).toBeTrue()
})

test('operations include methods, secondary constructors, named givens, and function vals only', async () => {
  const observation = await scan(['Operations.scala'])
  const names = observation.operations!.map(operation => operation.name).sort()
  expect(names).toEqual([
    'Demo.helper',
    'Demo.noop',
    'Worker.fn',
    'Worker.ord',
    'Worker.run',
    'Worker.this',
  ])
})

test('token lists ignore parameter renames but keep field renames', async () => {
  const observation = await scan(['Tokens.scala'])
  const tokens = new Map(observation.operations!.map(operation => [operation.name, operation.tokens]))
  expect(tokens.get('Pricing.first')).toEqual(tokens.get('Pricing.alt'))
  expect(tokens.get('Pricing.first')).not.toEqual(tokens.get('Pricing.otherLine'))
})

test('same-file bare calls resolve when the name is unique in the file', async () => {
  const observation = await scan(['Calls.scala'])
  const call = observation.invocations!.find(entry => entry.member === 'price')!
  expect(call.unresolved).toBeFalse()
  expect(call.targets).toHaveLength(1)
})

test('duplicate definitions leave same-file calls unresolved', async () => {
  const observation = await scan(['DuplicatePrice.scala'])
  const call = observation.invocations!.find(entry => entry.member === 'price' && entry.line === 4)!
  expect(call.unresolved).toBeTrue()
  expect(call.targets).toEqual([])
})

test('selection calls stay unresolved even when the member exists in the file', async () => {
  const observation = await scan(['Selection.scala'])
  expect(observation.invocations!.some(entry => entry.member === 'price' && !entry.unresolved)).toBeFalse()
})

test('cross-file calls stay unresolved', async () => {
  const observation = await scan(['api/Calls.scala', 'api/Pricing.scala'])
  const call = observation.invocations!.find(entry => entry.member === 'price')!
  expect(call.unresolved).toBeTrue()
})

test('apply and infix calls stay unresolved', async () => {
  const observation = await scan(['ApplyInfix.scala'])
  expect(observation.invocations!.every(call => call.unresolved)).toBeTrue()
})

test('a parse error removes symbols for that file and keeps siblings', async () => {
  const observation = await scan(['Broken.scala', 'Ok.scala'])
  expect(observation.files!.find(file => file.file === 'Broken.scala')).toBeUndefined()
  expect(observation.files!.find(file => file.file === 'Ok.scala')!.symbols!.length).toBeGreaterThan(0)
  expect(observation.diagnostics).toContainEqual(expect.objectContaining({
    code: 'SCALA_SOURCE_INVALID',
    file: 'Broken.scala',
  }))
})

test('two scans of the same input are identical', async () => {
  const first = await scan(allFiles)
  const second = await scan(allFiles)
  expect(second).toEqual(first)
})
