import path from 'node:path'
import { repositoryFiles } from '../../projects.ts'

/** The go command leaves out test files, testdata, and each directory or file whose name starts with "." or "_". */
function ignoredByGo(file: string): boolean {
  return file.endsWith('_test.go') || file.split('/').some(part =>
    part === 'testdata' || part.startsWith('.') || part.startsWith('_'))
}

/** The tracked or unignored module declarations and Go files under root that the go command reads, relative to root. */
async function candidates(root: string): Promise<{ modules: string[]; files: string[] }> {
  const found = await repositoryFiles(root, file =>
    (file.endsWith('.go') || path.posix.basename(file) === 'go.mod') && !ignoredByGo(file))
  return {
    modules: found.filter(file => path.posix.basename(file) === 'go.mod').map(file => path.posix.dirname(file)),
    files: found.filter(file => file.endsWith('.go')),
  }
}

/** A file belongs to the nearest module directory above it. */
function moduleOf(file: string, modules: string[]): string | undefined {
  return modules.filter(module => module === '.' || file.startsWith(`${module}/`))
    .sort((left, right) => right.length - left.length)[0]
}

/** Each module directory under root, relative to it, whose go.mod `excluded` does not name. */
export async function goModules(root: string, excluded: (file: string) => boolean): Promise<string[]> {
  return (await candidates(root)).modules.filter(module => !excluded(path.posix.join(module, 'go.mod')))
}

/** The Go source of every module under root, before exclusions: the scanner's listing. */
export async function goSources(root: string): Promise<string[]> {
  const { modules, files } = await candidates(root)
  return files.filter(file => moduleOf(file, modules) !== undefined)
}

/**
 * The Go source one module compiles, relative to its directory, less the files `excluded` names. Files of a module
 * nested in it stay out even when that module's go.mod is excluded, because the go command never compiles them here.
 */
export async function moduleSources(module: string, excluded: (file: string) => boolean): Promise<string[]> {
  const { modules, files } = await candidates(module)
  return files.filter(file => moduleOf(file, modules) === '.' && !excluded(file))
}
