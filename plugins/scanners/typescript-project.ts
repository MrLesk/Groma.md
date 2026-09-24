import path from 'node:path'

import { frameworkProjects, repositoryFiles, type FrameworkConfigs } from './projects.ts'

export interface FrameworkSources extends FrameworkConfigs {
  root: string
  /** The dependency that makes a package directory this framework's project. */
  dependency: string
  /** Extensions whose presence marks a project directory, as the scan's own project search uses. */
  projects: readonly string[]
  /** Extensions the scan reads inside a project, including any companion resource it reads. */
  sources: readonly string[]
  /** A further project-relative file the scan reads, such as a route that a file location declares. */
  also?: (projectRelative: string) => boolean
  /** The scanner's exclusions; a source listing, which comes before them, passes none. */
  excluded?: (file: string) => boolean
}

/**
 * Each project directory with the repository files its framework scan reads: every source of its kind outside the
 * exclusions that no nested project claims. No program, type checker or project tool runs, so which files a project's
 * program resolves stays for the analysis to decide.
 */
export async function frameworkProjectFiles(options: FrameworkSources): Promise<Map<string, string[]>> {
  const { root, dependency, projects, sources, also, excluded = () => false } = options
  const directories = (await frameworkProjects(root, dependency, projects, options, excluded))
    .map(directory => path.relative(root, directory).split(path.sep).join('/') || '.')
    // Deepest first, so a file belongs to its nearest project.
    .sort((left, right) => right.length - left.length)
  const assigned = new Map(directories.map(directory => [directory, [] as string[]]))
  if (directories.length === 0) return assigned
  for (const file of await repositoryFiles(root, candidate => !candidate.endsWith('.d.ts') && !excluded(candidate))) {
    const project = directories.find(directory => directory === '.' || file.startsWith(`${directory}/`))
    if (project === undefined) continue
    const local = project === '.' ? file : file.slice(project.length + 1)
    if (sources.some(extension => file.endsWith(extension)) || (also?.(local) ?? false)) assigned.get(project)!.push(file)
  }
  return assigned
}

/** The repository files a framework scan reads, across all its projects. */
export async function frameworkSourceFiles(options: FrameworkSources): Promise<string[]> {
  return [...(await frameworkProjectFiles(options)).values()].flat().sort()
}
