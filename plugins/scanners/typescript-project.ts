import path from 'node:path'

import { frameworkProjects, projectFiles } from './projects.ts'

export interface FrameworkSources {
  root: string
  /** The dependency that makes a package directory this framework's project. */
  dependency: string
  /** Extensions whose presence marks a project directory, as the scan's own project search uses. */
  projects: readonly string[]
  /** Include packages whose nearest TypeScript config is in a repository ancestor. */
  inheritConfig?: boolean
  /** Extensions the scan reads inside a project, including any companion resource it reads. */
  sources: readonly string[]
  /** A further project-relative file the scan reads, such as a route that a file location declares. */
  also?: (projectRelative: string) => boolean
}

/**
 * The repository files a framework scan reads: every source of its kind inside a project directory.
 * No program, type checker or project tool runs, so which files a project's program resolves stays
 * for the analysis to decide.
 */
export async function frameworkSourceFiles(options: FrameworkSources): Promise<string[]> {
  const { root, dependency, projects, sources, also, inheritConfig } = options
  const directories = (await frameworkProjects(root, dependency, projects, { inheritConfig }))
    .map(directory => path.relative(root, directory).split(path.sep).join('/') || '.')
  if (directories.length === 0) return []
  const listed: string[] = []
  for (const file of await projectFiles(root, candidate => !candidate.endsWith('.d.ts'))) {
    const project = directories.find(directory => directory === '.' || file.startsWith(`${directory}/`))
    if (project === undefined) continue
    const local = project === '.' ? file : file.slice(project.length + 1)
    if (sources.some(extension => file.endsWith(extension)) || (also?.(local) ?? false)) listed.push(file)
  }
  return listed.sort()
}
