import path from 'node:path'

/** The go command leaves out test files, testdata, and each directory or file whose name starts with "." or "_". */
function ignoredByGo(file: string): boolean {
  return file.endsWith('_test.go') || file.split('/').some(part =>
    part === 'testdata' || part.startsWith('.') || part.startsWith('_'))
}

/** The module directories and Go files among `files` that the go command reads, relative to the same folder. */
function goFiles(files: readonly string[]): { modules: string[]; sources: string[] } {
  const read = files.filter(file => !ignoredByGo(file))
  return {
    modules: read.filter(file => path.posix.basename(file) === 'go.mod').map(file => path.posix.dirname(file)),
    sources: read.filter(file => file.endsWith('.go')),
  }
}

/** A file belongs to the nearest module directory above it. */
function moduleOf(file: string, modules: string[]): string | undefined {
  return modules.filter(module => module === '.' || file.startsWith(`${module}/`))
    .sort((left, right) => right.length - left.length)[0]
}

/** The directory of each module among `files`, relative to the same folder. */
export function goModules(files: readonly string[]): string[] {
  return goFiles(files).modules
}

/** The Go source of every module among `candidates`, before exclusions: the scanner's listing. */
export function goSources(candidates: readonly string[]): string[] {
  const { modules, sources } = goFiles(candidates)
  return sources.filter(file => moduleOf(file, modules) !== undefined)
}

/** The Go source one module compiles among its files, relative to its directory, without a nested module's files. */
export function moduleSources(files: readonly string[]): string[] {
  const { modules, sources } = goFiles(files)
  return sources.filter(file => moduleOf(file, modules) === '.')
}
