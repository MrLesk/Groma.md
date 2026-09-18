import type { ScanHttpEndpoint, ScanHttpRequest, ScanOperation, ScanSymbol } from '@groma/scanner'
import { clientRequests } from './http-clients.ts'
import { curlRequests } from './http-curl.ts'
import {
  attributeEndpoints, attributeScope, builderEndpoints, globalPatterns, groupBlocker, groupCall, invokableEndpoints, registration,
  restRouteEndpoints, whereRequirements, type FileScope, type PendingEndpoint,
} from './http-endpoints.ts'
import { laravelApplication, laravelRouting, routesFile, routingMounts, unmounted, type Base, type Mount } from './http-laravel.ts'
import { blockerPath, routeSegments, type Requirements } from './http-routes.ts'
import { joinRoutes, literalText, noRoute, type Constants } from './http-url.ts'
import { boundReceivers, callableReceivers, typeReceivers, type Receiver } from './receivers.ts'
import {
  calledFunction, callables, children, field, list, memberOf, moduleOperationId, nameOf, operationId, qualifiedName, symbolName,
  typeKinds, typeName, type Fields, type NameScope, type Syntax,
} from './syntax.ts'

/**
 * HTTP facts of one file. Endpoint handlers are resolved to operations, and Laravel routes placed
 * under the files that load them and Laravel's global patterns, once every file is read.
 */
export interface PhpHttpFacts {
  endpoints: PendingEndpoint[]
  requests: ScanHttpRequest[]
  /** Routes files this file loads, such as through Laravel's `withRouting` or a route group given a file. */
  mounts: Mount[]
  /** Laravel's global parameter patterns this file sets. */
  patterns: Requirements
  /** The file's top-level code, when a fact above names it as the operation that registers or requests. */
  operations: ScanOperation[]
}

/** Literal constant values by the name PHP gives them: `Ns\NAME` and `Ns\Type::NAME`. */
type ConstantTable = ReadonlyMap<string, string | undefined>

const noConstants: Constants = () => undefined

/** `use A\B as C` makes `C` mean `A\B`; without an alias the last name segment stands for it. */
function collectImports(tree: Syntax): Map<string, string> {
  const imports = new Map<string, string>()
  function visit(node: Syntax): void {
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
  const mounts: Mount[] = []
  const patterns = new Map<string, string>()
  const curl = curlRequests()
  const table = collectConstants(tree)

  function callFacts(node: Fields, scope: FileScope): void {
    endpoints.push(...builderEndpoints(node, scope), ...restRouteEndpoints(node, scope))
    mounts.push(...routingMounts(node, scope, registration(scope).registrar))
    for (const [name, pattern] of globalPatterns(node, scope) ?? []) patterns.set(name, pattern)
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

  /**
   * The scope a declaration opens: a namespace, a type with its attribute prefix, patterns and
   * receiver properties, or an operation with its own receiver parameters. Code inside a type reaches
   * the type's properties through `$this`; variables of enclosing code are not visible.
   */
  function declared(node: Fields, scope: FileScope, group?: Receiver): FileScope | undefined {
    if (node.kind === 'namespace') return renamed(scope, { namespace: nameOf(node.name) ?? '' })
    if (typeKinds.has(node.kind)) {
      const name = nameOf(node.name)
      const typed = renamed(scope, { type: name === undefined ? undefined : symbolName(scope.namespace, name) })
      const { prefix, requirements } = attributeScope(node, typed.constants)
      return { ...typed, receivers: typeReceivers(node, typed), prefix: joinRoutes(scope.prefix, prefix), requirements }
    }
    if (!callables.has(node.kind)) return undefined
    const properties = [...scope.receivers].filter(([name]) => name.startsWith('$this->'))
    const receivers = new Map([...properties, ...callableReceivers(node, scope, group)])
    return { ...scope, operation: operationId(file, node), receivers }
  }

  /** A routes file loaded by a group, or required inside a Laravel group's closure, is served under that group. */
  function load(loaded: Fields | undefined, at: Pick<FileScope, 'prefix' | 'requirements'>, scope: FileScope, include: boolean): void {
    const target = routesFile(loaded, scope.file, scope.constants)
    mounts.push({ target, prefix: at.prefix, requirements: at.requirements, file: scope.file, registrar: registration(scope).registrar, include })
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
    if (group.routes === undefined && laravel) load(group.loaded, group, scope, false)
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
    if (member === 'group' || member === 'domain') return { ...scope, prefix: { text: scope.prefix.text, resolved: false } }
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
    if (node.kind === 'include' && (scope.grouped || scope.operation === undefined)) load(field(node, 'target'), scope, scope, true)
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
  visit(tree as Fields, { ...named, receivers: boundReceivers(tree as Fields, named) })
  const allRequests = [...requests, ...curl.requests()]
  // The file's top-level code is an operation only when a fact names it.
  const module = moduleOperationId(file)
  const used = [...endpoints, ...mounts].some(fact => fact.registrar === module) || allRequests.some(request => request.operation === module)
  return { endpoints, requests: allRequests, mounts, patterns, operations: used ? [{ id: module, file, name: '(module)', position: 0 }] : [] }
}

/** One file's facts as the scan collects them, before handler symbols name operations. */
export interface FileFacts extends Pick<PhpHttpFacts, 'endpoints' | 'mounts' | 'patterns'> {
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
 * The endpoint a route entry reports under one base. An entry whose path is unresolved, or whose
 * handler names no declared operation, is a blocker named after the operation that registers it.
 */
function served(entry: PendingEndpoint, operation: string | undefined, base: Base, laravel: { patterns: Requirements; application: string }): ScanHttpEndpoint {
  const path = joinRoutes(base.prefix, entry.route)
  // A Laravel route's own patterns, then those of the group that loads its file, override the global ones.
  const requirements = entry.laravel ? new Map([...laravel.patterns, ...base.requirements, ...entry.requirements]) : entry.requirements
  const segments = routeSegments(path.text, requirements)
  const known = operation !== undefined && path.resolved
  const order = entry.laravel ? { application: laravel.application, position: 0 } : entry.order
  return { operation: known ? operation : entry.registrar, method: entry.method, path: known ? segments : blockerPath(segments), order }
}

/**
 * Endpoints of every file's route entries. A handler the scan cannot place, such as a controller
 * method with no body or a function name several files declare, leaves its entry a blocker. A Laravel
 * route is served under each prefix a file that loads its file states, with Laravel's global patterns.
 */
export function resolveEndpoints(
  files: readonly FileFacts[], operations: readonly ScanOperation[], manifests: readonly string[],
): ScanHttpEndpoint[] {
  const declared = new Set(operations.map(operation => operation.id))
  const byName = operationsByName(files, declared)
  const paths = files.map(file => file.file)
  const application = (file: string) => laravelApplication(file, paths, manifests)
  const laravel = laravelRouting(files, application)
  const endpoints = files.flatMap(file => file.endpoints.flatMap(entry => {
    const found = entry.handler === undefined ? undefined : 'operation' in entry.handler ? entry.handler.operation : byName.get(entry.handler.symbol)
    const operation = found !== undefined && declared.has(found) ? found : undefined
    const context = { patterns: laravel.patterns, application: application(file.file) }
    return (entry.laravel ? laravel.basesOf(file.file) : [unmounted]).map(base => served(entry, operation, base, context))
  }))
  return [...endpoints, ...laravel.blockers]
}
