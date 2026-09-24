import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { ScanDiagnostic } from '@groma/scanner'
import ts from 'typescript'
import { isUnder } from '../../projects.ts'
import { hasDependency } from '../../typescript-project.ts'
import { nextRouters, routeLocation, type Routers } from './routes.ts'

/** An extended config a fresh checkout lacks: an uninstalled package's (TS6053) or a generated file (TS5083). */
const absentBase = new Set([5083, 6053])

export function relative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

function failDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  const errors = diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(errors.map(item => `${item.file?.fileName ?? 'React'}: ${ts.flattenDiagnosticMessageText(item.messageText, '\n')}`).join('\n'))
}

/** The `tsconfig.json` among `configs` that compiles a package: its own, else the nearest one in its repository ancestors. */
function packageConfig(directory: string, repositoryRoot: string, configs: ReadonlySet<string>): string {
  for (let current = directory; ; current = path.dirname(current)) {
    const file = path.join(current, 'tsconfig.json')
    if (configs.has(relative(repositoryRoot, file))) return file
    if (current === repositoryRoot) throw new Error(`${directory}: no TypeScript config in the package or its repository ancestors`)
  }
}

/**
 * The config that compiles a package's components: its tsconfig.json, or, for a solution config that names no
 * source of its own, the first config it references that compiles a TSX file the scanner reads. An absent
 * extended base leaves the config's own settings.
 */
function componentConfig(configFile: string, repositoryRoot: string, typescriptSources: ReadonlySet<string>,
  diagnostics: ScanDiagnostic[]): ts.ParsedCommandLine | undefined {
  const config = ts.readConfigFile(configFile, ts.sys.readFile)
  if (config.error) failDiagnostics([config.error])
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configFile), undefined, configFile)
  failDiagnostics(parsed.errors.filter(item => !absentBase.has(item.code)))
  diagnostics.push(...parsed.errors.filter(item => absentBase.has(item.code)).map(item => ({
    severity: 'warning' as const, code: 'react-missing-config-base', file: relative(repositoryRoot, configFile),
    message: `The extended TypeScript config is absent; source uses the available settings. ${ts.flattenDiagnosticMessageText(item.messageText, ' ')}`,
  })))
  if (parsed.fileNames.length || !parsed.projectReferences?.length) return parsed
  for (const reference of parsed.projectReferences) {
    const referenced = componentConfig(ts.resolveProjectReferencePath(reference), repositoryRoot, typescriptSources, diagnostics)
    if (referenced?.fileNames.some(file => file.endsWith('.tsx') && typescriptSources.has(relative(repositoryRoot, file)))) return referenced
  }
  return undefined
}

/** A React package's compiler program and the source files it reports. */
export interface ReactProject {
  manifest: { name: string }
  program: ts.Program
  routers: Routers
  /** Every source the program compiles that the scanner reads, where components, handlers and values resolve. */
  readable: ts.SourceFile[]
  /** The package's own sources among them, which the scan inspects and reports. */
  owned: ts.SourceFile[]
  /** The package's TSX components. */
  components: ts.SourceFile[]
  /** Next.js route files, in a project that declares `next`. */
  routes: ts.SourceFile[]
  diagnostics: ScanDiagnostic[]
  /** The React package that owns a repository file: the nearest one containing it, else this package. */
  owner: (file: string) => string
}

/**
 * A React package's program. `typescriptSources` holds the TypeScript sources among the scanner's files, so
 * declaration files and the tests its defaults exclude are not React sources, and `configs` the `tsconfig.json`
 * files among them. A file belongs to the nearest of the React `packages`, listed deepest first, so a package
 * whose config also compiles a nested package leaves that package's files to it. A package without components
 * of its own, such as one holding only excluded tests, has nothing to report.
 */
export function reactProject(directory: string, repositoryRoot: string, typescriptSources: ReadonlySet<string>,
  configs: ReadonlySet<string>, packages: readonly string[]): ReactProject | undefined {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
  const configFile = packageConfig(directory, repositoryRoot, configs)
  try {
    const project = relative(repositoryRoot, directory)
    const owner = (file: string) => packages.find(item => isUnder(file, item)) ?? project
    const belongs = (file: string) => owner(file) === project
    const diagnostics: ScanDiagnostic[] = []
    const config = componentConfig(configFile, repositoryRoot, typescriptSources, diagnostics)
    if (config === undefined) return undefined
    // Next.js serves every route file by its location, including those the config leaves out, such as a
    // `.well-known` directory; another server's files in the same places serve paths of its own.
    const routers = nextRouters(directory)
    const routeFiles = hasDependency(manifest, 'next') ? [...typescriptSources].filter(file => isUnder(file, project) && belongs(file)
      && routeLocation(project === '' ? file : file.slice(project.length + 1), routers) !== undefined) : []
    const roots = [...new Set([...config.fileNames, ...routeFiles.map(file => path.join(repositoryRoot, file))])]
    const program = ts.createProgram(roots, { ...config.options, noEmit: true })
    const readable = program.getSourceFiles().filter(source => typescriptSources.has(relative(repositoryRoot, source.fileName)))
    const owned = readable.filter(source => belongs(relative(repositoryRoot, source.fileName)))
    // Only the syntax of a source the scanner reads can fail it.
    for (const source of owned) failDiagnostics(program.getSyntacticDiagnostics(source))
    const components = owned.filter(source => source.fileName.endsWith('.tsx'))
    if (!components.length) return undefined
    const routes = owned.filter(source => routeFiles.includes(relative(repositoryRoot, source.fileName)))
    return { manifest, program, routers, readable, owned, components, routes, diagnostics, owner }
  } catch (error) {
    throw new Error(`REACT_SOURCE_INVALID: Check ${relative(repositoryRoot, configFile)} and its TSX syntax. ${error}`)
  }
}
