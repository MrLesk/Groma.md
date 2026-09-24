import path from 'node:path'
import { withJavaScriptEntries } from '../../entry-points/javascript.ts'
import { entrySourceInputs } from '../../entry-points/source.ts'
import { classicChecker } from '../../http-checker.ts'
import { createScanObservation, type ScanObservation, type ScannerSettings } from '@groma/scanner'
import ts from 'typescript'
import { frameworkProjects } from '../../typescript-project.ts'
import { typeScriptSources } from '../../typescript/src/files.ts'
import { combineObservations } from '../../observations.ts'
import { Evidence } from './evidence.ts'
import { caller } from './functions.ts'
import { reactHttpRequests } from './http.ts'
import { reactProject, relative, type ReactProject } from './project.ts'
import { nextRouteEndpoints } from './routes.ts'

/** The package directories among `files` whose React source the scanner reads, including those that use an ancestor config. */
export function reactProjects(root: string, files: readonly string[]): Promise<string[]> {
  return frameworkProjects(root, files, 'react', ['.tsx'], { inheritConfig: true })
}

/**
 * Visit every React package one at a time, so its compiler program is released before the next loads. Each
 * reads the TypeScript sources and configs among the scanner's files.
 */
async function eachProject(root: string, files: readonly string[],
  visit: (directory: string, project: ReactProject) => Promise<void>): Promise<void> {
  const typescriptSources = new Set(typeScriptSources(files))
  const configs = new Set(files.filter(file => path.posix.basename(file) === 'tsconfig.json'))
  const directories = await reactProjects(root, files)
  const packages = directories.map(directory => relative(root, directory)).sort((left, right) => right.length - left.length)
  for (const directory of directories) {
    const project = reactProject(directory, root, typescriptSources, configs, packages)
    if (project !== undefined) await visit(directory, project)
  }
}

export async function checkReactReadiness(root: string, _settings: ScannerSettings, files: readonly string[]): Promise<void> {
  await eachProject(root, files, async () => {})
}

export async function scanReact(root: string, _settings: ScannerSettings, files: readonly string[]) {
  const parts: { key: string; observation: ScanObservation }[] = []
  await eachProject(root, files, async (directory, project) => {
    const observation = await scanProject(root, directory, project, files)
    if (observation) parts.push({ key: relative(root, directory), observation })
  })
  return combineObservations(parts)
}

async function scanProject(root: string, directory: string,
  { manifest, program, routers, readable, owned, components, routes, diagnostics, owner }: ReactProject,
  files: readonly string[]) {
  const evidence = new Evidence(root, program, readable)
  for (const source of components) evidence.inspect(source)
  const httpRequests = await reactHttpRequests(components, readable, program.getTypeChecker(),
    call => evidence.operationId(caller(call) ?? call.getSourceFile()))
  const httpEndpoints = nextRouteEndpoints(routes, directory, routers, handler => evidence.operationId(handler))
  // A handler in a TypeScript module joins the components and routes the scanner reports. A file another
  // package owns, such as a nested library's component, stays in that package's source root.
  const reported = [...new Set([...[...components, ...routes].map(source => relative(root, source.fileName)),
    ...[...evidence.operations.values()].map(operation => operation.file)])]
  const own = relative(root, directory)
  const packageRoot = (file: string) => owner(file) === own ? 'react-project' : `package:${owner(file)}`
  const others = [...new Set(reported.map(owner))].filter(item => item !== own)
  return withJavaScriptEntries(root, createScanObservation({ scanner: { id: 'react', technology: 'typescript/react', engine: 'typescript-sdk', engineVersion: ts.version },
    roots: [{ id: 'react-project', kind: 'package', name: manifest.name, file: relative(root, path.join(directory, 'package.json')) },
      ...others.map(item => ({ id: `package:${item}`, kind: 'package', name: item || '.', file: path.posix.join(item, 'package.json') }))],
    files: reported.map(file => ({ file, symbols: [], roots: [packageRoot(file)] })),
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: [...diagnostics, ...evidence.diagnostics],
    ...(httpEndpoints.length ? { httpEndpoints } : {}), ...(httpRequests.length ? { httpRequests } : {}) }),
    await entrySourceInputs(root, ts, classicChecker(ts, program.getTypeChecker()), owned), files)
}
