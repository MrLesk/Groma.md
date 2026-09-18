import path from 'node:path'
import type { ScanHttpEndpoint } from '@groma/scanner'
import { blockerPath, routeSegments, unreadablePattern, type Requirements } from './http-routes.ts'
import { joinRoutes, literalText, noRoute, routeText, unresolvedRoute, type Constants, type RouteText } from './http-url.ts'
import { calledFunction, field, list, memberOf, receiverOf, typeName, type Fields, type NameScope } from './syntax.ts'

/** A routes file this scanner reads, named from the file that loads it. */
interface RoutesFile {
  path: string
  /** Set for `base_path(...)`: the path is under the Laravel application root, an ancestor of the loading file. */
  fromRoot: boolean
}

/**
 * A routes file that another file loads under a prefix and patterns: through Laravel's `withRouting`,
 * a route group given a file, or a `require` or `include`.
 */
export interface Load {
  /** Undefined when the source does not say which file it loads. */
  target: RoutesFile | undefined
  prefix: RouteText
  requirements: Requirements
  /** The loading file and the operation that loads it, which a blocker names when the target is unknown. */
  file: string
  registrar: string
  /** Set for a `require` or `include`, which serves nothing when its own file is served nowhere. */
  include: boolean
}

/** A path that starts at `__DIR__`, the loading file's own directory, such as `__DIR__.'/../routes/api.php'`. */
function fromDirectory(node: Fields | undefined, file: string, constants: Constants): string | undefined {
  if (node?.kind === 'magic' && String(node.value).toUpperCase() === '__DIR__') return path.posix.dirname(file)
  if (node?.kind !== 'bin' || node.type !== '.') return undefined
  const left = fromDirectory(field(node, 'left'), file, constants)
  const right = literalText(field(node, 'right'), constants)
  return left === undefined || right === undefined ? undefined : left + right
}

/** The routes file an expression names: `base_path('routes/api.php')` or a path from `__DIR__`. */
function routesFile(node: Fields | undefined, file: string, constants: Constants): RoutesFile | undefined {
  if (node !== undefined && calledFunction(node) === 'base_path') {
    const written = literalText(list(node, 'arguments')[0], constants)
    return written === undefined ? undefined : { path: path.posix.normalize(written).replace(/^\.?\//, ''), fromRoot: true }
  }
  const written = fromDirectory(node, file, constants)
  return written === undefined ? undefined : { path: path.posix.normalize(written), fromRoot: false }
}

/** Where the code that loads a routes file runs: its file, constants, prefix and patterns, and its operation. */
export interface Loader {
  file: string
  constants: Constants
  prefix: RouteText
  requirements: Requirements
  registrar: string
}

/** The load of the routes file an expression names, served under the loader's prefix and patterns. */
export function loadOf(node: Fields | undefined, loader: Loader, include: boolean): Load {
  const { file, prefix, requirements, registrar } = loader
  return { target: routesFile(node, file, loader.constants), prefix, requirements, file, registrar, include }
}

/** The start of a chain such as `Application::configure(...)->withRouting(...)`. */
function chainRoot(call: Fields): Fields | undefined {
  let current = receiverOf(call)
  while (current?.kind === 'call') current = receiverOf(current)
  return current
}

/**
 * Routes files Laravel's `Application::configure(...)->withRouting(web: ..., api: ..., apiPrefix: ...)`
 * loads: web routes without a prefix, and API routes under `apiPrefix`, which defaults to `api`.
 */
export function routingLoads(call: Fields, scope: NameScope, loader: Loader): Load[] {
  if (memberOf(call)?.toLowerCase() !== 'withrouting' || typeName(chainRoot(call), scope) !== 'Illuminate\\Foundation\\Application') return []
  const named = (name: string) => {
    const argument = list(call, 'arguments').find(candidate => candidate.kind === 'namedargument' && candidate.name === name)
    return argument === undefined ? undefined : field(argument, 'value')
  }
  const apiPrefix = named('apiPrefix')
  const loads = (files: Fields | undefined, prefix: RouteText): Load[] => (files?.kind === 'array' ? list(files, 'items').map(item => field(item, 'value')) : [files])
    .filter(value => value !== undefined)
    .map(value => loadOf(value, { ...loader, prefix, requirements: new Map() }, false))
  return [
    ...loads(named('web'), noRoute),
    ...loads(named('api'), apiPrefix === undefined ? { text: 'api', resolved: true } : routeText(apiPrefix, loader.constants)),
  ]
}

/** Whether `candidate` is the file `name` in `file`'s own directory or one of its ancestors. */
function inAncestor(candidate: string, name: string, file: string): boolean {
  return (candidate === name || candidate.endsWith(`/${name}`)) && file.startsWith(candidate.slice(0, -name.length))
}

/** The scanned file a load names: the exact path, or the one `base_path` path under an ancestor of the loading file. */
function loadedFile(load: Load, files: readonly string[]): string | undefined {
  const target = load.target
  if (target === undefined) return undefined
  if (!target.fromRoot) return files.includes(target.path) ? target.path : undefined
  const candidates = files.filter(file => inAncestor(file, target.path, load.file))
  return candidates.length === 1 ? candidates[0] : undefined
}

/** What a Laravel route is served under: the prefix and patterns of the files that load its file. */
export interface Base {
  prefix: RouteText
  requirements: Requirements
}

export const rootBase: Base = { prefix: noRoute, requirements: new Map() }

/** The base of a file no load reaches: its routes are served under an unknown prefix. */
const unknownBase: Base = { prefix: unresolvedRoute, requirements: new Map() }

/** Laravel's global patterns, which `Route::pattern` sets for every route; files that disagree on a name make it unreadable. */
function mergedPatterns(declared: readonly Requirements[]): Requirements {
  const merged = new Map<string, string>()
  for (const [name, pattern] of declared.flatMap(patterns => [...patterns])) {
    merged.set(name, merged.has(name) && merged.get(name) !== pattern ? unreadablePattern : pattern)
  }
  return merged
}

function under(base: Base, load: Load): Base {
  return { prefix: joinRoutes(base.prefix, load.prefix), requirements: new Map([...base.requirements, ...load.requirements]) }
}

/**
 * The application every Laravel endpoint of one project shares, so that the project's routes and
 * blockers compete with each other: its `bootstrap/app.php`, else its nearest `composer.json`, else
 * the declaring file.
 */
export function laravelApplication(file: string, phpFiles: readonly string[], manifests: readonly string[]): string {
  const nearest = (candidates: readonly string[], name: string) => candidates.filter(candidate => inAncestor(candidate, name, file))
    .sort((left, right) => right.length - left.length)[0]
  return nearest(phpFiles, 'bootstrap/app.php') ?? nearest(manifests, 'composer.json') ?? file
}

/**
 * How every Laravel route of a scan is served. A load serves its target under each base of its
 * loading file, so loads compose: a file loaded under `api` that loads another under `v1` serves that
 * one under `api/v1`. A loading file with no base serves a group's or `withRouting`'s file from the
 * root, and a `require`'s file nowhere. A file left with no base serves under an unknown prefix, and a
 * load whose file the scan cannot read blocks its prefix under each base.
 */
export function laravelRouting(files: readonly { file: string; loads: Load[]; patterns: Requirements }[], application: (file: string) => string) {
  const paths = files.map(file => file.file)
  const loads = files.flatMap(file => file.loads).map(load => ({ load, target: loadedFile(load, paths) }))
  // A load cycle serves under an unknown prefix.
  function basesOf(file: string, visiting: ReadonlySet<string>): Base[] {
    return loads.filter(({ target }) => target === file).flatMap(({ load }) => loaderBases(load, visiting).map(base => under(base, load)))
  }
  function loaderBases(load: Load, visiting: ReadonlySet<string>): Base[] {
    if (visiting.has(load.file)) return [unknownBase]
    const bases = basesOf(load.file, new Set([...visiting, load.file]))
    return bases.length > 0 || load.include ? bases : [rootBase]
  }
  const blockers: ScanHttpEndpoint[] = loads.filter(({ target }) => target === undefined).flatMap(({ load }) => loaderBases(load, new Set())
    .map(base => under(base, load)).map(base => ({
      operation: load.registrar, method: '*', path: blockerPath(routeSegments(base.prefix.text, base.requirements)),
      order: { application: application(load.file), position: 0 },
    })))
  return {
    patterns: mergedPatterns(files.map(file => file.patterns)),
    basesOf: (file: string) => {
      const bases = basesOf(file, new Set([file]))
      return bases.length > 0 ? bases : [unknownBase]
    },
    blockers,
  }
}
