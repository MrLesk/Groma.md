import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createCachedModelLoader, definitionHash } from '../plugins/scanners/scala/src/cache.ts'
import { SBT_VERSION } from '../plugins/scanners/scala/versions.ts'
import {
  buildDirectories,
  filesForBuild,
  owningBuildDirectory,
  parseGromaModel,
  selectBuildSources,
  sbtVersionGate,
  type GromaModel,
} from '../plugins/scanners/scala/src/model.ts'

const root = '/repo'

function fixtureModel(projects: GromaModel['projects'], buildRoot = root): GromaModel {
  return { buildRoot, projects }
}

test('keeps Compile sources and drops test sources', () => {
  const selection = selectBuildSources(root, '', ['build.sbt'], [
    'src/main/scala/App.scala',
    'src/test/scala/AppSpec.scala',
  ], fixtureModel([{
    id: 'root',
    name: 'root',
    base: root,
    scalaVersion: '3.9.0',
    unmanagedSourceDirectories: [`${root}/src/main/scala`],
    hasManagedSources: false,
  }]))
  expect(selection.projects[0]!.files).toEqual(['src/main/scala/App.scala'])
})

test('honors a custom Compile source directory', () => {
  const selection = selectBuildSources(root, '', ['build.sbt'], [
    'modules/api/scala/Api.scala',
    'src/main/scala/Legacy.scala',
  ], fixtureModel([{
    id: 'root',
    name: 'root',
    base: root,
    scalaVersion: '3.9.0',
    unmanagedSourceDirectories: [`${root}/modules/api/scala`],
    hasManagedSources: false,
  }]))
  expect(selection.projects[0]!.files).toEqual(['modules/api/scala/Api.scala'])
})

test('drops files outside the candidate list', () => {
  const selection = selectBuildSources(root, '', ['build.sbt'], [
    'src/main/scala/Kept.scala',
  ], fixtureModel([{
    id: 'root',
    name: 'root',
    base: root,
    scalaVersion: '3.9.0',
    unmanagedSourceDirectories: [
      `${root}/src/main/scala`,
      `${root}/src/main/scala/Hidden.scala`,
    ],
    hasManagedSources: false,
  }]))
  expect(selection.projects[0]!.files).toEqual(['src/main/scala/Kept.scala'])
})

test('splits nested builds', () => {
  const candidates = [
    'build.sbt',
    'src/main/scala/Root.scala',
    'modules/extra/build.sbt',
    'modules/extra/src/main/scala/Extra.scala',
  ]
  const builds = buildDirectories(candidates)
  expect(builds).toEqual(['', 'modules/extra'])
  expect(filesForBuild(candidates, '', builds)).toEqual(['build.sbt', 'src/main/scala/Root.scala'])
  expect(filesForBuild(candidates, 'modules/extra', builds)).toEqual([
    'modules/extra/build.sbt',
    'modules/extra/src/main/scala/Extra.scala',
  ])
  expect(owningBuildDirectory('modules/extra/src/main/scala/Extra.scala', builds)).toBe('modules/extra')
  expect(owningBuildDirectory('src/main/scala/Root.scala', builds)).toBe('')
})

test('rejects sbt 1 in build.properties', () => {
  const gate = sbtVersionGate('', ['project/build.properties'], 'sbt.version=1.10.0\n')
  expect(gate?.code).toBe('SCALA_SBT_UNSUPPORTED')
  const selection = selectBuildSources(root, '', ['project/build.properties', 'build.sbt'], [], fixtureModel([]), 'sbt.version=1.10.0\n')
  expect(selection.projects).toEqual([])
  expect(selection.diagnostics[0]!.code).toBe('SCALA_SBT_UNSUPPORTED')
})

test('allows a missing sbt.version', () => {
  expect(sbtVersionGate('', ['project/build.properties'], '')).toBeUndefined()
  const selection = selectBuildSources(root, '', ['build.sbt'], ['src/main/scala/App.scala'], fixtureModel([{
    id: 'root',
    name: 'root',
    base: root,
    scalaVersion: '3.9.0',
    unmanagedSourceDirectories: [`${root}/src/main/scala`],
    hasManagedSources: false,
  }]))
  expect(selection.diagnostics.some(item => item.code === 'SCALA_SBT_UNSUPPORTED')).toBeFalse()
  expect(selection.projects[0]!.files).toEqual(['src/main/scala/App.scala'])
})

test('skips a non-3.9 project while keeping a 3.9 sibling', () => {
  const selection = selectBuildSources(root, '', ['build.sbt'], [
    'api/src/main/scala/Api.scala',
    'legacy/src/main/scala/Legacy.scala',
  ], fixtureModel([
    {
      id: 'api',
      name: 'api',
      base: `${root}/api`,
      scalaVersion: '3.9.1',
      unmanagedSourceDirectories: [`${root}/api/src/main/scala`],
      hasManagedSources: false,
    },
    {
      id: 'legacy',
      name: 'legacy',
      base: `${root}/legacy`,
      scalaVersion: '2.13.15',
      unmanagedSourceDirectories: [`${root}/legacy/src/main/scala`],
      hasManagedSources: false,
    },
  ]))
  expect(selection.projects.find(project => project.id === 'api')!.files).toEqual(['api/src/main/scala/Api.scala'])
  expect(selection.projects.find(project => project.id === 'legacy')!.files).toEqual([])
  expect(selection.projects.find(project => project.id === 'legacy')!.diagnostics[0]!.code).toBe('SCALA_VERSION_UNSUPPORTED')
})

test('reports generated sources without reading them', () => {
  const selection = selectBuildSources(root, '', ['build.sbt'], [
    'src/main/scala/App.scala',
    'target/scala-3.9/src_managed/demo/Generated.scala',
  ], fixtureModel([{
    id: 'root',
    name: 'root',
    base: root,
    scalaVersion: '3.9.0',
    unmanagedSourceDirectories: [`${root}/src/main/scala`],
    hasManagedSources: true,
  }]))
  expect(selection.projects[0]!.files).toEqual(['src/main/scala/App.scala'])
  expect(selection.projects[0]!.diagnostics[0]!.code).toBe('SCALA_GENERATED_SOURCES_SKIPPED')
})

test('parseGromaModel reads JSON from sbt', () => {
  const parsed = parseGromaModel(JSON.stringify({
    buildRoot: root,
    projects: [{ id: 'root', name: 'root', base: root, scalaVersion: '3.9.0', unmanagedSourceDirectories: [], hasManagedSources: false }],
  }))
  expect(parsed.projects[0]!.id).toBe('root')
})

test('definition hash ignores src edits but reacts to build.sbt edits', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-scala-cache-'))
  try {
    await mkdir(path.join(temporary, 'project'), { recursive: true })
    await mkdir(path.join(temporary, 'src/main/scala'), { recursive: true })
    await writeFile(path.join(temporary, 'build.sbt'), 'name := "demo"\n')
    await writeFile(path.join(temporary, 'project/build.properties'), `sbt.version=${SBT_VERSION}\n`)
    await writeFile(path.join(temporary, 'src/main/scala/App.scala'), 'object App\n')
    const files = ['build.sbt', 'project/build.properties', 'src/main/scala/App.scala']
    const first = await definitionHash(temporary, '', files)
    await writeFile(path.join(temporary, 'src/main/scala/App.scala'), 'object App { def run = 1 }\n')
    const afterSource = await definitionHash(temporary, '', files)
    expect(afterSource).toBe(first)
    await writeFile(path.join(temporary, 'build.sbt'), 'name := "demo-v2"\n')
    const afterBuild = await definitionHash(temporary, '', files)
    expect(afterBuild).not.toBe(first)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test('cached model loader hits on source edits and misses on build.sbt edits', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-scala-model-cache-'))
  const cacheRoot = path.join(temporary, 'cache')
  try {
    await mkdir(path.join(temporary, 'project'), { recursive: true })
    await mkdir(path.join(temporary, 'src/main/scala'), { recursive: true })
    await writeFile(path.join(temporary, 'build.sbt'), 'name := "demo"\n')
    await writeFile(path.join(temporary, 'project/build.properties'), `sbt.version=${SBT_VERSION}\n`)
    await writeFile(path.join(temporary, 'src/main/scala/App.scala'), 'object App\n')
    const buildFiles = ['build.sbt', 'project/build.properties', 'src/main/scala/App.scala']
    const model: GromaModel = {
      buildRoot: temporary,
      projects: [{
        id: 'demo',
        name: 'demo',
        base: temporary,
        scalaVersion: '3.9.0',
        unmanagedSourceDirectories: [path.join(temporary, 'src/main/scala')],
        hasManagedSources: false,
      }],
    }
    let loads = 0
    const loader = createCachedModelLoader(async () => {
      loads += 1
      return model
    }, cacheRoot)
    await loader(temporary, '', buildFiles)
    expect(loads).toBe(1)
    await loader(temporary, '', buildFiles)
    expect(loads).toBe(1)
    await writeFile(path.join(temporary, 'src/main/scala/App.scala'), 'object App { def run = 1 }\n')
    await loader(temporary, '', buildFiles)
    expect(loads).toBe(1)
    await writeFile(path.join(temporary, 'build.sbt'), 'name := "demo-v2"\n')
    await loader(temporary, '', buildFiles)
    expect(loads).toBe(2)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
