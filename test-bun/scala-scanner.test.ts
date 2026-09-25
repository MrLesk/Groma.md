import { beforeAll, expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildWorker } from '../plugins/scanners/scala/build.ts'
import type { GromaModel } from '../plugins/scanners/scala/src/model.ts'
import { listScalaSourceFiles, scanScalaBuild } from '../plugins/scanners/scala/src/scan.ts'

const workerJar = path.resolve(import.meta.dir, '../plugins/scanners/scala/dist/worker.jar')

beforeAll(async () => {
  await mkdir(path.dirname(workerJar), { recursive: true })
  await buildWorker(workerJar)
})

test('host scan honors injected Compile directories and drops test sources', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-scala-host-'))
  try {
    const root = temporary
    await writeFile(path.join(root, 'build.sbt'), 'name := "shop"\n')
    await mkdir(path.join(root, 'project'), { recursive: true })
    await writeFile(path.join(root, 'project/build.properties'), 'sbt.version=2.0.9\n')
    await mkdir(path.join(root, 'modules/api/scala'), { recursive: true })
    await mkdir(path.join(root, 'src/main/scala'), { recursive: true })
    await mkdir(path.join(root, 'src/test/scala'), { recursive: true })
    await cp(path.resolve(import.meta.dir, '../test/fixtures/scala-parse/Ok.scala'), path.join(root, 'modules/api/scala/Ok.scala'))
    await cp(path.resolve(import.meta.dir, '../test/fixtures/scala-parse/Broken.scala'), path.join(root, 'src/main/scala/Main.scala'))
    await cp(path.resolve(import.meta.dir, '../test/fixtures/scala-parse/Ok.scala'), path.join(root, 'src/test/scala/Spec.scala'))

    const model: GromaModel = {
      buildRoot: root,
      projects: [{
        id: 'root',
        name: 'shop',
        base: root,
        scalaVersion: '3.9.0',
        unmanagedSourceDirectories: [path.join(root, 'modules/api/scala')],
        hasManagedSources: false,
      }],
    }
    const loadModel = async () => model
    const candidates = [
      'build.sbt',
      'project/build.properties',
      'modules/api/scala/Ok.scala',
      'src/main/scala/Main.scala',
      'src/test/scala/Spec.scala',
    ]
    const observation = await scanScalaBuild(root, '', candidates, loadModel)
    const files = observation!.files.map(file => file.file).sort()
    expect(files).toEqual(['modules/api/scala/Ok.scala'])
    expect(await listScalaSourceFiles(root, candidates, loadModel)).toEqual(['modules/api/scala/Ok.scala'])
    expect(observation!.roots.some(entry => entry.kind === 'sbt-build')).toBeTrue()
    expect(observation!.roots.some(entry => entry.kind === 'sbt-project' && entry.id === 'root')).toBeTrue()
    expect(observation!.files[0]!.roots).toEqual(['root'])
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
