import path from 'node:path'
import { repositoryFiles } from '../../projects.ts'

/** The go command leaves out test files, testdata, vendor, and each directory or file whose name starts with "." or "_". */
function ignoredByGo(file: string): boolean {
  return file.endsWith('_test.go') || file.split('/').some(part =>
    part === 'testdata' || part === 'vendor' || part.startsWith('.') || part.startsWith('_'))
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

/** Each module directory under root, relative to it. */
export async function goModules(root: string): Promise<string[]> {
  return (await candidates(root)).modules
}

/** The Go source of every module under root: the scanner's listing. */
export async function goSources(root: string): Promise<string[]> {
  const { modules, files } = await candidates(root)
  return files.filter(file => moduleOf(file, modules) !== undefined)
}

/** The Go source one module compiles, relative to its directory, without the files of modules nested in it. */
export async function moduleSources(module: string): Promise<string[]> {
  const { modules, files } = await candidates(module)
  return files.filter(file => moduleOf(file, modules) === '.')
}
