import path from 'node:path'
import { stat } from 'node:fs/promises'
import type { ScanDiagnostic } from '@groma/scanner'
import type { API, ParsedCommandLine } from 'typescript/unstable/async'
import { projectFiles } from '../../projects.ts'
import type { BuildOutput } from '../../workspace-packages.ts'

export interface TypeScriptProject { key: string; config?: ParsedCommandLine; files: string[] }

/** An extended config the checkout lacks: a package's (TS6053) or a generated file (TS5083). */
const absentBase = new Set([5083, 6053])

/**
 * Whether a project owns a file before the one that owns it so far: a config whose directory contains the file comes
 * before one including it from elsewhere, such as through an extended config's include; then the nearer, deeper one.
 * A referenced config, read later, wins a tie.
 */
function outranks(project: TypeScriptProject, previous: TypeScriptProject, file: string): boolean {
  const contains = (candidate: TypeScriptProject) => file.startsWith(`${path.dirname(candidate.key)}${path.sep}`)
  const depth = (candidate: TypeScriptProject) => path.dirname(candidate.key).split(path.sep).length
  return contains(project) === contains(previous) ? depth(project) >= depth(previous) : contains(project)
}

/** Where each config's build writes its sources: a config that states both `outDir` and `rootDir`. */
export function buildOutputs(root: string, projects: readonly TypeScriptProject[]): BuildOutput[] {
  const relative = (file: string) => path.relative(root, path.resolve(file)).split(path.sep).join('/')
  return projects.flatMap(({ config }) => {
    const { outDir, rootDir } = config?.options ?? {}
    return outDir === undefined || rootDir === undefined ? [] : [{ outDir: relative(outDir), rootDir: relative(rootDir) }]
  })
}

/** A nested config owns its included files before an enclosing config does. */
export async function typescriptProjects(api: API, root: string, files: string[]): Promise<{
  projects: TypeScriptProject[]
  diagnostics: ScanDiagnostic[]
}> {
  const configurations = new Map<string, ParsedCommandLine>()
  const diagnostics: ScanDiagnostic[] = []
  async function read(file: string): Promise<void> {
    if (configurations.has(file)) return
    const config = await api.parseConfigFile(file)
    // An empty input set contributes no source, and a fresh checkout without installed packages or
    // generated files still has the config's own settings; other config errors block scanning.
    const errors = config.errors.filter(error => error.code !== 18003 && !absentBase.has(error.code))
    if (errors.length) throw new Error(`${file}: ${errors.map(error => error.text).join('\n')}`)
    diagnostics.push(...config.errors.filter(error => absentBase.has(error.code)).map(error => ({
      severity: 'warning' as const, code: 'typescript-missing-config-base',
      file: path.relative(root, file).split(path.sep).join('/'),
      message: `The extended TypeScript config is absent; source uses the available settings. ${error.text}`,
    })))
    configurations.set(file, config)
    for (const reference of config.projectReferences ?? []) {
      const target = (await stat(reference.path)).isDirectory() ? path.join(reference.path, 'tsconfig.json') : reference.path
      await read(target)
    }
  }
  for (const file of await projectFiles(root, file => path.posix.basename(file) === 'tsconfig.json')) await read(path.join(root, file))
  const selected = new Set(files.map(file => path.resolve(root, file)))
  const projects = [...configurations].map(([key, config]) => ({ key, config,
    files: config.fileNames.filter(file => selected.has(path.resolve(file))) }))
  const owners = new Map<string, TypeScriptProject>()
  for (const project of projects) {
    for (const file of project.files) {
      const previous = owners.get(path.resolve(file))
      if (!previous || outranks(project, previous, path.resolve(file))) owners.set(path.resolve(file), project)
    }
  }
  for (const project of projects) project.files = project.files.filter(file => owners.get(path.resolve(file)) === project)
  const loose = [...selected].filter(file => !owners.has(file))
  return {
    projects: [...projects.filter(project => project.files.length), ...(loose.length ? [{ key: '', files: loose }] : [])],
    diagnostics,
  }
}
