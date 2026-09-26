import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, parseScanObservation, type ScanObservation } from '@groma/scanner'
import { SCALAMETA_VERSION } from '../versions.ts'
import { scanWithWorker } from './adapter.ts'
import {
  buildDirectories,
  filesForBuild,
  selectBuildSources,
  type BuildSelection,
  type ModelLoader,
} from './model.ts'

const BUILD_ROOT_ID = 'sbt-build'

function repoPath(buildKey: string, buildRelative: string): string {
  return buildKey === '' ? buildRelative : `${buildKey}/${buildRelative}`
}

function buildRelative(buildKey: string, repoRelative: string): string {
  if (buildKey === '') return repoRelative
  const prefix = `${buildKey}/`
  if (!repoRelative.startsWith(prefix)) throw new Error(`File ${repoRelative} is outside build ${buildKey || '.'}`)
  return repoRelative.slice(prefix.length)
}

async function readBuildProperties(buildRoot: string, buildFiles: readonly string[]): Promise<string> {
  if (!buildFiles.includes('project/build.properties')) return ''
  return readFile(path.join(buildRoot, 'project/build.properties'), 'utf8')
}

function buildRoots(selection: BuildSelection) {
  if (selection.projects.length === 0) return []
  return [
    { id: BUILD_ROOT_ID, kind: 'sbt-build', name: selection.projects[0]!.name, file: 'build.sbt' },
    ...selection.projects.map(project => ({
      id: project.id,
      kind: 'sbt-project',
      name: project.name,
      parent: BUILD_ROOT_ID,
    })),
  ]
}

function attachBuildRoots(observation: ScanObservation, selection: BuildSelection, buildKey: string): ScanObservation {
  const ownerByRepoFile = new Map<string, string>()
  for (const project of selection.projects) {
    for (const file of project.files) ownerByRepoFile.set(file, project.id)
  }
  const remapId = (id: string, buildRelativeFile: string) => {
    const hash = id.indexOf('#')
    const suffix = hash === -1 ? '' : id.slice(hash)
    return `${buildRelativeFile}${suffix}`
  }
  return {
    ...observation,
    roots: buildRoots(selection),
    files: observation.files.map(source => {
      const repoFile = repoPath(buildKey, source.file)
      return {
        ...source,
        roots: ownerByRepoFile.has(repoFile) ? [ownerByRepoFile.get(repoFile)!] : [],
        symbols: source.symbols.map(symbol => ({ ...symbol, id: `${source.file}#${symbol.name}` })),
      }
    }),
    operations: observation.operations?.map(operation => ({
      ...operation,
      id: remapId(operation.id, operation.file),
    })),
    invocations: observation.invocations?.map(call => ({
      ...call,
      source: remapId(call.source, call.source.split('#')[0]!),
      targets: call.targets.map(target => remapId(target, target.split('#')[0]!)),
    })),
  }
}

function withDiagnostics(observation: ScanObservation, selection: BuildSelection): ScanObservation {
  return {
    ...observation,
    diagnostics: [
      ...observation.diagnostics,
      ...selection.diagnostics,
      ...selection.projects.flatMap(project => project.diagnostics),
    ],
  }
}

function emptyObservation(): ScanObservation {
  return createScanObservation({
    scanner: { id: 'scala', technology: 'scala', engine: 'scalameta', engineVersion: SCALAMETA_VERSION },
    roots: [],
    files: [],
    diagnostics: [],
  })
}

/** Scan one sbt build directory using an injected `gromaModel` loader. */
export async function scanScalaBuild(
  repositoryRoot: string,
  buildKey: string,
  buildRelativeFiles: readonly string[],
  loadModel: ModelLoader,
): Promise<ScanObservation | undefined> {
  const buildRoot = path.join(repositoryRoot, buildKey.split('/').join(path.sep))
  const candidates = buildRelativeFiles.map(file => repoPath(buildKey, file))
  const propertiesText = await readBuildProperties(buildRoot, buildRelativeFiles)
  const gateOnly = selectBuildSources(repositoryRoot, buildKey, buildRelativeFiles, candidates, {
    buildRoot,
    projects: [],
  }, propertiesText)
  if (gateOnly.projects.length === 0 && gateOnly.diagnostics.some(item => item.code === 'SCALA_SBT_UNSUPPORTED')) {
    return withDiagnostics(attachBuildRoots({ ...emptyObservation(), roots: buildRoots(gateOnly) }, gateOnly, buildKey), gateOnly)
  }
  const model = await loadModel(repositoryRoot, buildKey, buildRelativeFiles)
  const selection = selectBuildSources(repositoryRoot, buildKey, buildRelativeFiles, candidates, model, propertiesText)
  const scanFiles = [...new Set(selection.projects.flatMap(project => project.files))].sort()
  const workerFiles = scanFiles.map(file => buildRelative(buildKey, file))

  if (scanFiles.length === 0) {
    return withDiagnostics(attachBuildRoots({ ...emptyObservation(), roots: buildRoots(selection) }, selection, buildKey), selection)
  }

  const stdout = await scanWithWorker(buildRoot, workerFiles)
  const parsed = parseScanObservation(stdout)
  return withDiagnostics(attachBuildRoots(parsed, selection, buildKey), selection)
}

/** Compile candidates the model keeps, before scanner exclusions. */
export async function listScalaSourceFiles(
  repositoryRoot: string,
  candidates: readonly string[],
  loadModel: ModelLoader,
): Promise<string[]> {
  const builds = buildDirectories(candidates)
  const sources = new Set<string>()
  for (const buildKey of builds) {
    const repoBuildFiles = filesForBuild(candidates, buildKey, builds)
    const buildRelativeFiles = repoBuildFiles.map(file => buildRelative(buildKey, file))
    const buildRoot = path.join(repositoryRoot, buildKey.split('/').join(path.sep))
    const propertiesText = await readBuildProperties(buildRoot, buildRelativeFiles)
    const gateOnly = selectBuildSources(repositoryRoot, buildKey, buildRelativeFiles, candidates, {
      buildRoot,
      projects: [],
    }, propertiesText)
    if (gateOnly.projects.length === 0 && gateOnly.diagnostics.some(item => item.code === 'SCALA_SBT_UNSUPPORTED')) continue
    const model = await loadModel(repositoryRoot, buildKey, buildRelativeFiles)
    const selection = selectBuildSources(repositoryRoot, buildKey, buildRelativeFiles, candidates, model, propertiesText)
    for (const project of selection.projects) {
      for (const file of project.files) sources.add(file)
    }
  }
  return [...sources].sort()
}
