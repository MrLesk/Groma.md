import path from 'node:path'
import { isUnder } from '../../projects.ts'
import type { ScanDiagnostic } from '@groma/scanner'

export interface GromaModelProject {
  id: string
  name: string
  base: string
  scalaVersion: string
  unmanagedSourceDirectories: string[]
  hasManagedSources: boolean
}

export interface GromaModel {
  buildRoot: string
  projects: GromaModelProject[]
}

export interface SelectedProject {
  id: string
  name: string
  baseKey: string
  files: string[]
  diagnostics: ScanDiagnostic[]
}

export interface BuildSelection {
  buildKey: string
  diagnostics: ScanDiagnostic[]
  projects: SelectedProject[]
}

/** Directories that contain a `build.sbt` among the scanner's files. */
function buildKey(file: string): string {
  const directory = path.posix.dirname(file)
  return directory === '.' ? '' : directory
}

export function buildDirectories(files: readonly string[]): string[] {
  const directories = new Set<string>()
  for (const file of files) {
    if (path.posix.basename(file) === 'build.sbt') directories.add(buildKey(file))
  }
  return [...directories].sort()
}

/** Innermost build directory that owns a repository-relative path. */
export function owningBuildDirectory(file: string, buildDirectories: readonly string[]): string | undefined {
  const matches = buildDirectories.filter(directory => directory === '' || file === directory || file.startsWith(`${directory}/`))
  if (matches.length === 0) return undefined
  return matches.sort((left, right) => right.length - left.length)[0]
}

export function filesForBuild(allFiles: readonly string[], buildKey: string, buildDirectories: readonly string[]): string[] {
  return allFiles.filter(file => owningBuildDirectory(file, buildDirectories) === buildKey)
}

export function parseGromaModel(text: string): GromaModel {
  return JSON.parse(text) as GromaModel
}

function relativize(repositoryRoot: string, absolute: string): string {
  return path.relative(repositoryRoot, absolute).split(path.sep).join('/')
}

function readProperty(text: string, key: string): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || trimmed === '') continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    if (trimmed.slice(0, index).trim() === key) return trimmed.slice(index + 1).trim()
  }
  return undefined
}

/** `buildFiles` are paths relative to the build directory, not the repository root. */
export function sbtVersionGate(buildKey: string, buildFiles: readonly string[], propertiesText?: string): ScanDiagnostic | undefined {
  const relative = buildKey === '' ? 'project/build.properties' : `${buildKey}/project/build.properties`
  if (!buildFiles.includes('project/build.properties')) return undefined
  const version = readProperty(propertiesText ?? '', 'sbt.version')
  if (version === undefined || version === '') return undefined
  if (version.startsWith('2.')) return undefined
  return {
    severity: 'warning',
    code: 'SCALA_SBT_UNSUPPORTED',
    message: `sbt.version ${version} is outside the supported sbt 2 line.`,
    file: relative,
  }
}

function supportsScala39(version: string): boolean {
  return version.startsWith('3.9')
}

function unmanagedKeys(repositoryRoot: string, project: GromaModelProject): string[] {
  return project.unmanagedSourceDirectories.map(directory => relativize(repositoryRoot, directory))
}

function keepScalaFile(file: string, candidates: ReadonlySet<string>, sourceKeys: readonly string[]): boolean {
  if (!file.endsWith('.scala') || !candidates.has(file)) return false
  return sourceKeys.some(key => isUnder(file, key))
}

/**
 * Select Compile sources for one build from a `gromaModel` JSON value. `candidates` are
 * repository-relative paths core passed to the scanner.
 */
export function selectBuildSources(
  repositoryRoot: string,
  buildKey: string,
  buildFiles: readonly string[],
  candidates: readonly string[],
  model: GromaModel,
  projectBuildProperties = '',
): BuildSelection {
  const diagnostics: ScanDiagnostic[] = []
  const gate = sbtVersionGate(buildKey, buildFiles, projectBuildProperties)
  if (gate !== undefined) {
    diagnostics.push(gate)
    return { buildKey, diagnostics, projects: [] }
  }

  const expectedRoot = path.resolve(repositoryRoot, buildKey.split('/').join(path.sep))
  if (path.resolve(model.buildRoot) !== expectedRoot) {
    throw new Error(`gromaModel buildRoot does not match ${buildKey || '.'}`)
  }

  const candidateSet = new Set(candidates)
  const projects: SelectedProject[] = []

  for (const project of model.projects) {
    const projectDiagnostics: ScanDiagnostic[] = []
    const baseKey = relativize(repositoryRoot, project.base)

    if (!supportsScala39(project.scalaVersion)) {
      projectDiagnostics.push({
        severity: 'warning',
        code: 'SCALA_VERSION_UNSUPPORTED',
        message: `scalaVersion ${project.scalaVersion} is outside the supported Scala 3.9 line.`,
      })
      projects.push({ id: project.id, name: project.name, baseKey, files: [], diagnostics: projectDiagnostics })
      continue
    }

    if (project.hasManagedSources) {
      projectDiagnostics.push({
        severity: 'info',
        code: 'SCALA_GENERATED_SOURCES_SKIPPED',
        message: 'Compile managed source directories are not read.',
      })
    }

    const sourceKeys = unmanagedKeys(repositoryRoot, project)
    const files = candidates.filter(file => isUnder(file, baseKey) && keepScalaFile(file, candidateSet, sourceKeys)).sort()
    projects.push({ id: project.id, name: project.name, baseKey, files, diagnostics: projectDiagnostics })
  }

  return { buildKey, diagnostics, projects }
}

export type ModelLoader = (repositoryRoot: string, buildKey: string, buildFiles: readonly string[]) => Promise<GromaModel>
