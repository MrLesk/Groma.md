import type { ScanHttpEndpoint, ScanHttpRequest, ScanOperation, ScanSymbol } from '@groma/scanner'
import { clientRequests } from './http-clients.ts'
import { curlRequests } from './http-curl.ts'
import {
  attributeEndpoints, attributeScope, builderEndpoints, globalPatterns, groupBlocker, groupCall, invokableEndpoints, registration,
  restRouteEndpoints, whereRequirements, type FileScope, type Handler, type PendingEndpoint,
} from './http-endpoints.ts'
import { laravelApplication, laravelRouting, loadOf, rootBase, routingLoads, type Base, type Load, type Loader } from './http-laravel.ts'
import { blockerPath, routeSegments, type Requirements } from './http-routes.ts'
import { joinRoutes, literalText, noRoute, routeText, unresolvedRoute, type Constants, type RouteText } from './http-url.ts'
import { boundReceivers, callableReceivers, proved, setsBasePath, typeReceivers, type Receiver } from './receivers.ts'
import {
  calledFunction, callables, children, field, list, memberOf, moduleOperationId, nameOf, operationId, qualifiedName, receiverOf,
  symbolName, typeKinds, typeName, type Fields, type NameScope, type Syntax,
} from './syntax.ts'

/**
 * HTTP facts of one file. Endpoint handlers are resolved to operations, and routes placed under what
 * the project adds to them, once every file is read.
 */
export interface PhpHttpFacts {
  endpoints: PendingEndpoint[]
  requests: ScanHttpRequest[]
  /** A declared class and the parent whose inherited methods it can serve. */
  parents: Map<string, string>
  /** Routes files this file loads, such as through Laravel's `withRouting` or a route group given a file. */
  loads: Load[]
  /** Laravel's global parameter patterns this file sets. */
  patterns: Requirements
  /** The base paths this file gives Slim applications with `setBasePath`. */
  basePaths: RouteText[]
}

/** Literal constant values by the name PHP gives them: `Ns\NAME` and `Ns\Type::NAME`. */
type ConstantTable = ReadonlyMap<string, string | undefined>

const noConstants: Constants = () => undefined

/** `use A\B as C` makes `C` mean `A\B`; without an alias the last name segment stands for it. */
function collectImports(tree: Syntax): Map<string, string> {
  const imports = new Map<string, string>()
  function visit(node: Syntax): void {
    if (node !== tree && node.kind === 'namespace') return
    if (node.kind === 'useitem') {
      const name = String((node as Fields).name)
      imports.set(nameOf(field(node, 'alias')) ?? name.split('\\').at(-1)!, name)
    }
    for (const child of children(node)) visit(child)
  }
  visit(tree)
  return imports
}

/**
 * Constants the file declares as literal text: `const NAME = '/api'` in its namespace, a constant of a
 * named type, and `define('NAME', '/api')`, which names a global constant. A name the file declares
 * twice proves no value.
 */
function collectConstants(tree: Syntax): ConstantTable {
  const table = new Map<string, string | undefined>()
  function declare(name: string | undefined, value: Fields | undefined): void {
    if (name !== undefined) table.set(name, table.has(name) ? undefined : literalText(value, noConstants))
  }
  /** `define('NAME', ...)` names a global constant, whatever namespace calls it. */
  function define(call: Fields): void {
    const [defined, value] = list(call, 'arguments')
    const written = literalText(defined, noConstants)
    declare(written === undefined ? undefined : qualifiedName(written), value)
  }
  /** A `const` of the namespace, or of the enclosing type, whose name is null for an anonymous class. */
  function constant(node: Fields, namespace: string, type: string | null | undefined): void {
    const name = nameOf(field(node, 'name'))!
    if (type !== null) declare(type === undefined ? symbolName(namespace, name) : `${type}::${name}`, field(node, 'value'))
  }
  function visit(node: Fields, namespace: string, type: string | null | undefined): void {
    const name = nameOf(field(node, 'name'))
    const inner = node.kind === 'namespace' ? name ?? '' : namespace
    const owner = typeKinds.has(node.kind) ? (name === undefined ? null : symbolName(namespace, name)) : type
    if (node.kind === 'constant') constant(node, inner, owner)
    if (calledFunction(node) === 'define') define(node)
    for (const child of children(node)) visit(child as Fields, inner, owner)
  }
  visit(tree as Fields, '', undefined)
  return table
}

/** The class constant `Type::NAME` or `self::NAME` names; `static::NAME` can name a subclass's constant. */
function classConstant(reference: Fields, scope: NameScope): string | undefined {
  const owner = field(reference, 'what')
  const offset = field(reference, 'offset')
  const type = owner?.kind === 'staticreference' ? undefined : typeName(owner, scope)
  return type === undefined || offset?.kind !== 'identifier' ? undefined : `${type}::${nameOf(offset)}`
}

/** Constant references resolved as PHP resolves them from the code being read. */
function constantsIn(table: ConstantTable, scope: NameScope): Constants {
  return reference => {
    if (reference.kind === 'staticlookup') {
      const key = classConstant(reference, scope)
      return key === undefined ? undefined : table.get(key)
    }
    if (reference.kind !== 'name') return undefined
    const written = String(reference.name)
    if (written.includes('\\')) return table.get(typeName(reference, scope)!)
    // An unqualified name means the namespace's constant when the file declares one, and the global one otherwise.
    const local = symbolName(scope.namespace, written)
    return table.has(local) ? table.get(local) : table.get(written)
  }
}

/** Endpoints and requests one PHP file states, read from its syntax alone. */
export function phpHttpFacts(file: string, tree: Syntax): PhpHttpFacts {
  const endpoints: PendingEndpoint[] = []
  const requests: ScanHttpRequest[] = []
  const parents = new Map<string, string>()
  const loads: Load[] = []
  const patterns = new Map<string, string>()
  const basePaths: RouteText[] = []
  const curl = curlRequests()
  const table = collectConstants(tree)

  function callFacts(node: Fields, scope: FileScope): void {
    endpoints.push(...builderEndpoints(node, scope), ...restRouteEndpoints(node, scope))
    loads.push(...routingLoads(node, scope, loaderOf(scope)))
    for (const [name, pattern] of globalPatterns(node, scope) ?? []) patterns.set(name, pattern)
    if (setsBasePath(node) && proved(receiverOf(node), scope)?.role === 'slim') basePaths.push(routeText(list(node, 'arguments')[0], scope.constants))
    // A request belongs to the operation that supplies its URL, which is the file's top-level code outside every function.
    const operation = registration(scope).registrar
    for (const request of clientRequests(node, scope)) requests.push({ operation, ...request })
  }

  function visitChildren(node: Syntax, scope: FileScope): void {
    for (const child of children(node)) visit(child as Fields, scope)
  }

  /** A scope with other names, and the constants those names resolve. */
  function renamed(scope: FileScope, names: Partial<NameScope>): FileScope {
    const next = { ...scope, ...names }
    return { ...next, constants: constantsIn(table, next) }
  }

  function recordParent(node: Fields, scope: FileScope): void {
    const parent = node.kind === 'class' ? typeName(field(node, 'extends'), scope) : undefined
    if (scope.type !== undefined && parent !== undefined) parents.set(scope.type, parent)
  }

  /**
   * The scope a declaration opens: a namespace, a type with its attribute prefix, patterns and
   * receiver properties, or an operation with its own receiver parameters. Code inside a type reaches
   * the type's properties through `$this`; variables of enclosing code are not visible.
   */
  function declared(node: Fields, scope: FileScope, group?: Receiver): FileScope | undefined {
    if (node.kind === 'namespace') {
      const named = renamed(scope, { namespace: nameOf(node.name) ?? '', imports: collectImports(node) })
      return { ...named, receivers: boundReceivers(node, named) }
    }
    if (typeKinds.has(node.kind)) {
      const name = nameOf(node.name)
      const typed = renamed(scope, { type: name === undefined ? undefined : symbolName(scope.namespace, name) })
      recordParent(node, typed)
      const { prefix, requirements } = attributeScope(node, typed)
      return { ...typed, receivers: typeReceivers(node, typed), prefix: joinRoutes(scope.prefix, prefix), requirements }
    }
    if (!callables.has(node.kind)) return undefined
    const properties = [...scope.receivers].filter(([name]) => name.startsWith('$this->'))
    const receivers = new Map([...properties, ...callableReceivers(node, scope, group)])
    return { ...scope, operation: operationId(file, node), receivers }
  }

  /** Code that loads a routes file, with the prefix and patterns the loaded routes are served under. */
  function loaderOf(scope: FileScope, at: Pick<FileScope, 'prefix' | 'requirements'> = scope): Loader {
    return { file, constants: scope.constants, prefix: at.prefix, requirements: at.requirements, registrar: registration(scope).registrar }
  }

  /**
   * A group's routes are declared in its closure, which the router calls with the group as its first
   * parameter. Laravel keeps the group's prefix, patterns and controller for every route registered
   * while the closure runs; a Slim group passes them only through that parameter.
   */
  function visitGroup(node: Fields, scope: FileScope): boolean {
    const group = node.kind === 'call' ? groupCall(node, scope) : undefined
    if (group === undefined) return false
    const laravel = group.router === 'laravel'
    const inner = laravel ? { ...scope, prefix: group.prefix, requirements: group.requirements, controller: group.controller, grouped: true } : scope
    if (group.routes === undefined && laravel) loads.push(loadOf(group.loaded, loaderOf(scope, group), false))
    else if (group.routes === undefined) endpoints.push(...groupBlocker(group, scope))
    else visitChildren(group.routes, declared(group.routes, inner, group.member)!)
    return true
  }

  /**
   * What code inside a node runs under: a route modifier such as `->whereNumber('id')` applies its
   * patterns to the route call it wraps, `->domain(...)` binds that route to a host, and a closure
   * passed to `group` on a receiver the scanner cannot prove runs under an unresolved prefix.
   */
  function modified(node: Fields, scope: FileScope): FileScope {
    const member = node.kind === 'call' ? memberOf(node)?.toLowerCase() : undefined
    if (member === 'group' || member === 'domain') return { ...scope, prefix: joinRoutes(scope.prefix, unresolvedRoute) }
    const where = node.kind === 'call' ? whereRequirements(node, scope.constants) : undefined
    return where === undefined ? scope : { ...scope, requirements: new Map([...scope.requirements, ...where]) }
  }

  /** A class's own route, when Symfony reads its attribute as the route of `__invoke`, then its members. */
  function visitDeclaration(node: Fields, scope: FileScope, opened: FileScope): void {
    if (typeKinds.has(node.kind)) endpoints.push(...invokableEndpoints(node, { ...opened, prefix: scope.prefix, requirements: scope.requirements }))
    visitChildren(node, opened)
  }

  /** Facts a node that declares nothing states: routes, loads and requests. */
  function statementFacts(node: Fields, scope: FileScope): void {
    if (node.kind === 'call') callFacts(node, scope)
    // A routes file required at the top level, or inside a Laravel group's closure, is served under that code.
    if (node.kind === 'include' && (scope.grouped || scope.operation === undefined)) loads.push(loadOf(field(node, 'target'), loaderOf(scope), true))
    curl.record(registration(scope).registrar, node, scope.constants)
  }

  function visit(node: Fields, scope: FileScope): void {
    if (node.kind === 'method') endpoints.push(...attributeEndpoints(node, scope))
    const opened = declared(node, scope)
    if (opened !== undefined) visitDeclaration(node, scope, opened)
    else if (!visitGroup(node, scope)) {
      statementFacts(node, scope)
      visitChildren(node, modified(node, scope))
    }
  }

  const top: FileScope = {
    file, namespace: '', imports: collectImports(tree), constants: noConstants, prefix: noRoute, requirements: new Map(), receivers: new Map(),
  }
  const named = renamed(top, {})
  const globalReceivers = list(tree, 'children').some(child => child.kind === 'namespace')
    ? new Map<string, Receiver>() : boundReceivers(tree as Fields, named)
  visit(tree as Fields, { ...named, receivers: globalReceivers })
  return { endpoints, requests: [...requests, ...curl.requests()], parents, loads, patterns, basePaths }
}

/**
 * The operation of a file's top-level code, which route entries, loads and requests there name. The
 * scan reports it only when a final HTTP fact names it.
 */
export function moduleOperation(file: string): ScanOperation {
  return { id: moduleOperationId(file), file, name: '(module)', position: 0 }
}

/** One file's facts as the scan collects them, before handler symbols name operations. */
export interface FileFacts extends Pick<PhpHttpFacts, 'endpoints' | 'parents' | 'loads' | 'patterns' | 'basePaths'> {
  file: string
  symbols: ScanSymbol[]
}

/** Declared operations by symbol name; a name several operations share names none. */
function operationsByName(files: readonly FileFacts[], declared: ReadonlySet<string>): Map<string, string | undefined> {
  const byName = new Map<string, string | undefined>()
  for (const { id, name } of files.flatMap(file => file.symbols)) {
    if (declared.has(id)) byName.set(name, byName.has(name) && byName.get(name) !== id ? undefined : id)
  }
  return byName
}

/**
 * The one base path the project's Slim applications are given: the root when no file calls
 * `setBasePath`, the stated path when exactly one call states it, and unresolved otherwise.
 */
function slimBase(files: readonly FileFacts[]): RouteText {
  const paths = files.flatMap(file => file.basePaths)
  if (paths.length === 0) return noRoute
  return paths.length === 1 && paths[0]!.resolved ? paths[0]! : unresolvedRoute
}

/**
 * The endpoint a route entry reports under one base. An entry whose path is unresolved, or whose
 * handler names no declared operation, is a blocker named after the operation that registers it.
 * Every PHP router this scanner reads takes the first registered match, and the scanner does not
 * prove the order files register their routes in, so every endpoint takes position 0 in its
 * application: the Laravel project's, or else the declaring file.
 */
function served(entry: PendingEndpoint, operation: string | undefined, base: Base, context: { patterns: Requirements; application: string }): ScanHttpEndpoint {
  const path = joinRoutes(base.prefix, entry.route)
  // A Laravel route's own patterns, then those of the group that loads its file, override the global ones.
  const requirements = entry.routing === 'laravel' ? new Map([...context.patterns, ...base.requirements, ...entry.requirements]) : entry.requirements
  const segments = routeSegments(path.text, requirements, entry.routing !== 'symfony')
  const known = operation !== undefined && path.resolved
  const order = { application: context.application, position: 0 }
  return { operation: known ? operation : entry.registrar, method: entry.method, path: known ? segments : blockerPath(segments), order }
}

/**
 * Endpoints of every file's route entries. A handler the scan cannot place, such as a controller
 * method with no body or a function name several files declare, leaves its entry a blocker. A Laravel
 * route is served under each prefix a file that loads its file states, with Laravel's global patterns,
 * and a route a typed Slim application registers under the project's Slim base path.
 */
export function resolveEndpoints(
  files: readonly FileFacts[], operations: readonly ScanOperation[], manifests: readonly string[],
): ScanHttpEndpoint[] {
  const declared = new Set(operations.map(operation => operation.id))
  const byName = operationsByName(files, declared)
  const parents = new Map<string, string | undefined>()
  for (const file of files) for (const [child, parent] of file.parents) {
    parents.set(child, parents.has(child) ? undefined : parent)
  }
  const paths = files.map(file => file.file)
  const application = (file: string) => laravelApplication(file, paths, manifests)
  const laravel = laravelRouting(files, application)
  const slim: Base = { prefix: slimBase(files), requirements: new Map() }
  const inheritedOperation = (symbol: string): string | undefined => {
    const separator = symbol.lastIndexOf('::')
    if (separator < 0) return byName.get(symbol)
    const method = symbol.slice(separator + 2)
    let type: string | undefined = symbol.slice(0, separator)
    const seen = new Set<string>()
    while (type !== undefined && !seen.has(type)) {
      seen.add(type)
      const name = `${type}::${method}`
      if (byName.has(name)) return byName.get(name)
      type = parents.get(type)
    }
    return undefined
  }
  const operationOf = (handler: Handler | undefined) => {
    const found = handler === undefined ? undefined : 'operation' in handler ? handler.operation : inheritedOperation(handler.symbol)
    return found !== undefined && declared.has(found) ? found : undefined
  }
  const endpoints = files.flatMap(({ file, endpoints }) => endpoints.flatMap(entry => {
    const laravelRoute = entry.routing === 'laravel'
    const context = { patterns: laravel.patterns, application: laravelRoute ? application(file) : file }
    const bases = laravelRoute ? laravel.basesOf(file) : [entry.routing === 'slim' ? slim : rootBase]
    return bases.map(base => served(entry, operationOf(entry.handler), base, context))
  }))
  return [...endpoints, ...laravel.blockers]
}
