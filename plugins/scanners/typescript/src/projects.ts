import path from 'node:path'
import { stat } from 'node:fs/promises'
import type { API, ParsedCommandLine } from 'typescript/unstable/async'
import { projectFiles } from '../../projects.ts'

export interface TypeScriptProject { key: string; config?: ParsedCommandLine; files: string[] }

/** A nested config owns its included files before an enclosing config does. */
export async function typescriptProjects(api: API, root: string, files: string[]): Promise<TypeScriptProject[]> {
  const configurations = new Map<string, ParsedCommandLine>()
  async function read(file: string): Promise<void> {
    if (configurations.has(file)) return
    const config = await api.parseConfigFile(file)
    // An empty input set contributes no source; other config errors still block scanning.
    const errors = config.errors.filter(error => error.code !== 18003)
    if (errors.length) throw new Error(`${file}: ${errors.map(error => error.text).join('\n')}`)
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
      if (!previous || path.dirname(project.key).split(path.sep).length >= path.dirname(previous.key).split(path.sep).length) {
        owners.set(path.resolve(file), project)
      }
    }
  }
  for (const project of projects) project.files = project.files.filter(file => owners.get(path.resolve(file)) === project)
  const loose = [...selected].filter(file => !owners.has(file))
  return [...projects.filter(project => project.files.length), ...(loose.length ? [{ key: '', files: loose }] : [])]
}
