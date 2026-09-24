import path from 'node:path'
import { withJavaScriptEntries } from '../../entry-points/javascript.ts'
import { entrySourceInputs } from '../../entry-points/source.ts'
import { classicChecker } from '../../http-checker.ts'
import { createScanObservation, type ScanObservation, type ScannerSettings } from '@groma/scanner'
import ts from 'typescript'
import { frameworkProjects } from '../../projects.ts'
import { listTypeScriptFiles } from '../../typescript/src/files.ts'
import { combineObservations } from '../../observations.ts'
import { Evidence } from './evidence.ts'
import { caller } from './functions.ts'
import { reactHttpRequests } from './http.ts'
import { reactProject, relative, type ReactProject } from './project.ts'
import { nextRouteEndpoints } from './routes.ts'

/**
 * The package directories whose React source the scanner reads, including those that use an ancestor config, among
 * the files `excluded` leaves in.
 */
export function reactProjects(root: string, excluded?: (file: string) => boolean): Promise<string[]> {
  return frameworkProjects(root, 'react', ['.tsx'], { inheritConfig: true }, excluded)
}

/**
 * Visit every React package one at a time, so its compiler program is released before the next loads. Each
 * reads the TypeScript sources this scanner's exclusions leave in.
 */
async function eachProject(root: string, excluded: (file: string) => boolean,
  visit: (directory: string, project: ReactProject) => Promise<void>): Promise<void> {
  const typescriptSources = new Set((await listTypeScriptFiles(root)).filter(file => !excluded(file)))
  const directories = await reactProjects(root, excluded)
  const packages = directories.map(directory => relative(root, directory)).sort((left, right) => right.length - left.length)
  for (const directory of directories) {
    const project = reactProject(directory, root, typescriptSources, packages)
    if (project !== undefined) await visit(directory, project)
  }
}

export async function checkReactReadiness(root: string, _settings?: ScannerSettings,
  excluded: (file: string) => boolean = () => false): Promise<void> {
  await eachProject(root, excluded, async () => {})
}

export async function scanReact(root: string, _settings?: ScannerSettings, excluded: (file: string) => boolean = () => false) {
  const parts: { key: string; observation: ScanObservation }[] = []
  await eachProject(root, excluded, async (directory, project) => {
    const observation = await scanProject(root, directory, project, excluded)
    if (observation) parts.push({ key: relative(root, directory), observation })
  })
  return combineObservations(parts)
}

async function scanProject(root: string, directory: string,
  { manifest, program, routers, readable, owned, components, routes, diagnostics, owner }: ReactProject,
  excluded: (file: string) => boolean) {
  const evidence = new Evidence(root, program, readable)
  for (const source of components) evidence.inspect(source)
  const httpRequests = await reactHttpRequests(components, readable, program.getTypeChecker(),
    call => evidence.operationId(caller(call) ?? call.getSourceFile()))
  const httpEndpoints = nextRouteEndpoints(routes, directory, routers, handler => evidence.operationId(handler))
  // A handler in a TypeScript module joins the components and routes the scanner reports. A file another
  // package owns, such as a nested library's component, stays in that package's source root.
  const files = [...new Set([...[...components, ...routes].map(source => relative(root, source.fileName)),
    ...[...evidence.operations.values()].map(operation => operation.file)])]
  const own = relative(root, directory)
  const packageRoot = (file: string) => owner(file) === own ? 'react-project' : `package:${owner(file)}`
  const others = [...new Set(files.map(owner))].filter(item => item !== own)
  return withJavaScriptEntries(root, createScanObservation({ scanner: { id: 'react', technology: 'typescript/react', engine: 'typescript-sdk', engineVersion: ts.version },
    roots: [{ id: 'react-project', kind: 'package', name: manifest.name, file: relative(root, path.join(directory, 'package.json')) },
      ...others.map(item => ({ id: `package:${item}`, kind: 'package', name: item || '.', file: path.posix.join(item, 'package.json') }))],
    files: files.map(file => ({ file, symbols: [], roots: [packageRoot(file)] })),
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: [...diagnostics, ...evidence.diagnostics],
    ...(httpEndpoints.length ? { httpEndpoints } : {}), ...(httpRequests.length ? { httpRequests } : {}) }),
    await entrySourceInputs(root, ts, classicChecker(ts, program.getTypeChecker()), owned), excluded)
}
