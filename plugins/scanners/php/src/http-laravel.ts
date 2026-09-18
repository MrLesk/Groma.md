import path from 'node:path'
import type { ScanHttpEndpoint } from '@groma/scanner'
import { blockerPath, routeSegments, unreadablePattern, type Requirements } from './http-routes.ts'
import { joinRoutes, literalText, noRoute, routeText, type Constants, type RouteText } from './http-url.ts'
import { calledFunction, field, list, memberOf, typeName, type Fields, type NameScope } from './syntax.ts'

/** A routes file this scanner reads, named from the file that loads it. */
interface RoutesFile {
  path: string
  /** Set for `base_path(...)`: the path is under the Laravel application root, an ancestor of the loading file. */
  fromRoot: boolean
}

/**
 * A routes file that another file loads under a prefix and patterns, as Laravel's `withRouting` or a
 * route group given a file does. The routes of the loaded file are served under that prefix.
 */
export interface Mount {
  /** Undefined when the source does not say which file it loads. */
  target: RoutesFile | undefined
  prefix: RouteText
  requirements: Requirements
  /** The loading file and the operation that loads it, which a blocker names when the target is unknown. */
  file: string
  registrar: string
  /**
   * Set for a `require` or `include`, which serves the file under the loader's own routes. A group or
   * `withRouting` that loads a file serves it from the root when no other file loads the loader.
   */
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
export function routesFile(node: Fields | undefined, file: string, constants: Constants): RoutesFile | undefined {
  if (node !== undefined && calledFunction(node) === 'base_path') {
    const written = literalText(list(node, 'arguments')[0], constants)
    return written === undefined ? undefined : { path: path.posix.normalize(written).replace(/^\.?\//, ''), fromRoot: true }
  }
  const written = fromDirectory(node, file, constants)
  return written === undefined ? undefined : { path: path.posix.normalize(written), fromRoot: false }
}

/** The start of a chain such as `Application::configure(...)->withRouting(...)`. */
function chainRoot(call: Fields): Fields | undefined {
  let current = field(field(call, 'what')!, 'what')
  while (current?.kind === 'call') current = field(field(current, 'what')!, 'what')
  return current
}

/**
 * Routes files Laravel's `Application::configure(...)->withRouting(web: ..., api: ..., apiPrefix: ...)`
 * loads: web routes without a prefix, and API routes under `apiPrefix`, which defaults to `api`.
 */
export function routingMounts(call: Fields, scope: NameScope & { file: string; constants: Constants }, registrar: string): Mount[] {
  if (memberOf(call)?.toLowerCase() !== 'withrouting' || typeName(chainRoot(call), scope) !== 'Illuminate\\Foundation\\Application') return []
  const named = (name: string) => {
    const argument = list(call, 'arguments').find(candidate => candidate.kind === 'namedargument' && candidate.name === name)
    return argument === undefined ? undefined : field(argument, 'value')
  }
  const apiPrefix = named('apiPrefix')
  const mounts = (files: Fields | undefined, prefix: RouteText): Mount[] => (files?.kind === 'array' ? list(files, 'items').map(item => field(item, 'value')) : [files])
    .filter(value => value !== undefined)
    .map(value => ({ target: routesFile(value, scope.file, scope.constants), prefix, requirements: new Map(), file: scope.file, registrar, include: false }))
  return [
    ...mounts(named('web'), noRoute),
    ...mounts(named('api'), apiPrefix === undefined ? { text: 'api', resolved: true } : routeText(apiPrefix, scope.constants)),
  ]
}

/** The scanned file a mount loads: the exact path, or the one `base_path` path under an ancestor of the loading file. */
function mountedFile(mount: Mount, files: readonly string[]): string | undefined {
  const target = mount.target
  if (target === undefined) return undefined
  if (!target.fromRoot) return files.includes(target.path) ? target.path : undefined
  const candidates = files.filter(file => (file === target.path || file.endsWith(`/${target.path}`))
    && mount.file.startsWith(file.slice(0, file.length - target.path.length)))
  return candidates.length === 1 ? candidates[0] : undefined
}

/** What a Laravel route is served under: the prefix and patterns of the files that load its file. */
export interface Base {
  prefix: RouteText
  requirements: Requirements
}

export const unmounted: Base = { prefix: noRoute, requirements: new Map() }

/** The base of a file whose loader the scan cannot see: its routes are served under an unknown prefix. */
const unknownBase: Base = { prefix: { text: '', resolved: false }, requirements: new Map() }

/** Laravel's global patterns, which `Route::pattern` sets for every route; files that disagree on a name make it unreadable. */
function mergedPatterns(declared: readonly Requirements[]): Requirements {
  const merged = new Map<string, string>()
  for (const [name, pattern] of declared.flatMap(patterns => [...patterns])) {
    merged.set(name, merged.has(name) && merged.get(name) !== pattern ? unreadablePattern : pattern)
  }
  return merged
}

function under(base: Base, mount: Mount): Base {
  return { prefix: joinRoutes(base.prefix, mount.prefix), requirements: new Map([...base.requirements, ...mount.requirements]) }
}

/** The path among candidates named `name` whose directory is the nearest one holding `file`. */
function nearest(file: string, candidates: readonly string[], name: string): string | undefined {
  return candidates.filter(candidate => (candidate === name || candidate.endsWith(`/${name}`)) && file.startsWith(candidate.slice(0, -name.length)))
    .sort((left, right) => right.length - left.length)[0]
}

/**
 * The application every Laravel endpoint of one project shares, so that the project's routes and
 * blockers compete with each other: its `bootstrap/app.php`, else its nearest `composer.json`, else
 * the declaring file.
 */
export function laravelApplication(file: string, phpFiles: readonly string[], manifests: readonly string[]): string {
  return nearest(file, phpFiles, 'bootstrap/app.php') ?? nearest(file, manifests, 'composer.json') ?? file
}

/**
 * How every Laravel route of a scan is served. Loads compose: a file loaded under `api` that loads
 * another under `v1` serves that file's routes under `api/v1`. A file no load reaches serves its
 * Laravel routes under an unknown prefix, and a load whose file the scan cannot read blocks its prefix;
 * a `require` in a file no load reaches blocks nothing, since that file serves no known routes.
 */
export function laravelRouting(files: readonly { file: string; mounts: Mount[]; patterns: Requirements }[], application: (file: string) => string) {
  const paths = files.map(file => file.file)
  const loads = files.flatMap(file => file.mounts).map(mount => ({ mount, target: mountedFile(mount, paths) }))
  // The bases of a file that some load reaches, or undefined; a load cycle serves under an unknown prefix.
  function basesOf(file: string, visiting: ReadonlySet<string>): Base[] | undefined {
    const incoming = loads.filter(load => load.target === file)
    return incoming.length === 0 ? undefined : incoming.flatMap(({ mount }) => loaderBases(mount, visiting).map(base => under(base, mount)))
  }
  // A require serves under its loader's own routes; a group or `withRouting` of an unloaded file serves from the root.
  function loaderBases(mount: Mount, visiting: ReadonlySet<string>): Base[] {
    if (visiting.has(mount.file)) return [unknownBase]
    return basesOf(mount.file, new Set([...visiting, mount.file])) ?? [mount.include ? unknownBase : unmounted]
  }
  const blocked = loads.filter(load => load.target === undefined && (!load.mount.include || basesOf(load.mount.file, new Set()) !== undefined))
  const blockers: ScanHttpEndpoint[] = blocked.flatMap(({ mount }) => loaderBases(mount, new Set())
    .map(base => under(base, mount)).map(base => ({
      operation: mount.registrar, method: '*', path: blockerPath(routeSegments(base.prefix.text, base.requirements)),
      order: { application: application(mount.file), position: 0 },
    })))
  return {
    patterns: mergedPatterns(files.map(file => file.patterns)),
    basesOf: (file: string) => basesOf(file, new Set([file])) ?? [unknownBase],
    blockers,
  }
}
