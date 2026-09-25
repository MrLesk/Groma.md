import { beforeAll, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildDist, buildWorker } from '../plugins/scanners/scala/build.ts'
import { createScalaScanner } from '../plugins/scanners/scala/src/index.ts'

const repositoryRoot = path.resolve(import.meta.dir, '..')
const workerJar = path.resolve(import.meta.dir, '../plugins/scanners/scala/dist/worker.jar')
const distReady = path.resolve(import.meta.dir, '../plugins/scanners/scala/dist/sbt-launch.jar')

function fixtureCandidates(relativeRoot: string, files: readonly string[]): string[] {
  const prefix = relativeRoot === '' ? '' : `${relativeRoot}/`
  return [
    `${prefix}build.sbt`,
    `${prefix}project/build.properties`,
    ...files.map(file => `${prefix}${file}`),
  ]
}

beforeAll(async () => {
  if (!existsSync(workerJar) || !existsSync(distReady)) {
    await mkdir(path.dirname(workerJar), { recursive: true })
    if (!existsSync(workerJar)) await buildWorker(workerJar)
    if (!existsSync(distReady)) await buildDist(path.dirname(workerJar))
  }
})

function scopedId(buildKey: string, id: string): string {
  return JSON.stringify([buildKey, id])
}

test('single-project sbt model keeps main sources and resolves same-file calls', async () => {
  const relativeRoot = 'test/fixtures/scala-sbt-single'
  const root = repositoryRoot
  const candidates = fixtureCandidates(relativeRoot, [
    'src/main/scala/Shop.scala',
    'src/test/scala/ShopSpec.scala',
  ])
  const scanner = createScalaScanner()
  const observation = await scanner.scan!(root, {}, candidates)
  expect(observation).toBeDefined()
  const files = observation!.files.map(file => file.file).sort()
  expect(files).toEqual(['test/fixtures/scala-sbt-single/src/main/scala/Shop.scala'])
  expect(observation!.roots.some(entry => entry.kind === 'sbt-build' && entry.id === scopedId(relativeRoot, 'sbt-build'))).toBeTrue()
  expect(observation!.roots.some(entry => entry.kind === 'sbt-project' && entry.id === scopedId(relativeRoot, 'scala-sbt-single'))).toBeTrue()
  const call = observation!.invocations!.find(entry => entry.member === 'price')
  expect(call?.unresolved).toBeFalse()
  expect(call?.targets.some(target => target.includes('Shop.price'))).toBeTrue()
  expect(await scanner.listSourceFiles!(root, {}, candidates)).toEqual(files)
})

test('multi-project build shares one sbt-build parent', async () => {
  const relativeRoot = 'test/fixtures/scala-sbt-multi'
  const root = repositoryRoot
  const candidates = fixtureCandidates(relativeRoot, [
    'api/src/main/scala/Api.scala',
    'worker/src/main/scala/Worker.scala',
  ])
  const observation = await createScalaScanner().scan!(root, {}, candidates)
  expect(observation).toBeDefined()
  const projectIds = observation!.roots.filter(entry => entry.kind === 'sbt-project').map(entry => entry.id).sort()
  expect(projectIds).toContain(scopedId(relativeRoot, 'api'))
  expect(projectIds).toContain(scopedId(relativeRoot, 'worker'))
  const files = observation!.files.map(file => file.file).sort()
  expect(files).toEqual([
    'test/fixtures/scala-sbt-multi/api/src/main/scala/Api.scala',
    'test/fixtures/scala-sbt-multi/worker/src/main/scala/Worker.scala',
  ])
})

test('custom Compile / scalaSource directory is scanned', async () => {
  const relativeRoot = 'test/fixtures/scala-sbt-custom-root'
  const root = repositoryRoot
  const candidates = fixtureCandidates(relativeRoot, ['modules/Api.scala'])
  const observation = await createScalaScanner().scan!(root, {}, candidates)
  expect(observation!.files.map(file => file.file)).toEqual([
    'test/fixtures/scala-sbt-custom-root/modules/Api.scala',
  ])
})

test('sbt 1 gate skips the model loader', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-scala-sbt1-'))
  try {
    await writeFile(path.join(temporary, 'build.sbt'), 'name := "legacy"\n')
    await mkdir(path.join(temporary, 'project'), { recursive: true })
    await writeFile(path.join(temporary, 'project/build.properties'), 'sbt.version=1.10.0\n')
    let loaderCalls = 0
    const scanner = createScalaScanner(() => async () => {
      loaderCalls += 1
      throw new Error('loader should not run')
    })
    const observation = await scanner.scan!(temporary, {}, ['build.sbt', 'project/build.properties'])
    expect(loaderCalls).toBe(0)
    expect(observation?.diagnostics.some(item => item.code === 'SCALA_SBT_UNSUPPORTED')).toBeTrue()
    expect(observation?.files.length).toBe(0)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
