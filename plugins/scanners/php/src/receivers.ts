import { noRoute, routeText, unresolvedRoute, type RouteText } from './http-url.ts'
import {
  callables, children, field, list, memberOf, nameOf, receiverOf, typeKinds, typeName, type Fields, type NameScope, type Syntax,
} from './syntax.ts'

/**
 * A proved receiver: an HTTP client, or a Laravel or Slim router that registers endpoints. A Laravel
 * router registers under the group the code runs in. A Slim router registers under its own prefix: a
 * group's prefix, a created application's base path, or an unresolved one for a group object whose
 * group the scanner cannot see. A typed Slim application serves under the project's base path, which
 * only the whole scan shows.
 */
export type Receiver =
  | { role: 'client' }
  | { role: 'laravel' }
  | { role: 'slim'; prefix: RouteText; projectBase: boolean }

export type Role = Receiver['role']
export type Router = 'laravel' | 'slim'

/** Receivers as the source spells them, `$client` or `$this->http`. */
export type Receivers = ReadonlyMap<string, Receiver>

/**
 * Types whose values this scanner recognizes. Ordinary objects share their member names, such as
 * `get`, so a call counts only when its receiver is proved to hold one of these.
 */
const receivers = new Map<string, Receiver>([
  ['GuzzleHttp\\Client', { role: 'client' }], ['GuzzleHttp\\ClientInterface', { role: 'client' }],
  ['Psr\\Http\\Client\\ClientInterface', { role: 'client' }],
  ['Symfony\\Contracts\\HttpClient\\HttpClientInterface', { role: 'client' }],
  ['Slim\\App', { role: 'slim', prefix: noRoute, projectBase: true }],
  ['Slim\\Routing\\RouteCollectorProxy', { role: 'slim', prefix: unresolvedRoute, projectBase: false }],
  ['Slim\\Interfaces\\RouteCollectorProxyInterface', { role: 'slim', prefix: unresolvedRoute, projectBase: false }],
  ['Illuminate\\Routing\\Router', { role: 'laravel' }], ['Illuminate\\Contracts\\Routing\\Registrar', { role: 'laravel' }],
])

/** Laravel's `Route` facade registers routes statically, imported or through its global alias. */
const routeFacades = new Set(['Illuminate\\Support\\Facades\\Route', 'Route'])

function receiverOfType(node: Fields | undefined, scope: NameScope): Receiver | undefined {
  const name = typeName(node, scope)
  return name === undefined ? undefined : receivers.get(name)
}

/** A receiver this scanner can follow, spelled `$client` or `$this->http`. */
export function receiverName(node: Fields | undefined): string | undefined {
  if (node?.kind === 'variable' && typeof node.name === 'string') return `$${node.name}`
  if (node?.kind !== 'propertylookup' || field(node, 'what')?.kind !== 'variable' || field(node, 'what')?.name !== 'this') {
    return undefined
  }
  const offset = field(node, 'offset')
  return offset?.kind === 'identifier' ? `$this->${nameOf(offset)}` : undefined
}

/** What the receiver of a call, or the start of a builder chain, is proved to hold. */
export function proved(receiver: Fields | undefined, scope: NameScope & { receivers: Receivers }): Receiver | undefined {
  if (receiver?.kind === 'name') return routeFacades.has(typeName(receiver, scope)!) ? { role: 'laravel' } : undefined
  const name = receiverName(receiver)
  return name === undefined ? undefined : scope.receivers.get(name)
}

/** Properties a type declares with a recognized type, including promoted constructor parameters. */
export function typeReceivers(type: Fields, scope: NameScope): Map<string, Receiver> {
  const found = new Map<string, Receiver>()
  for (const member of list(type, 'body')) {
    const properties = member.kind === 'propertystatement' ? list(member, 'properties')
      : member.kind === 'method' && nameOf(member.name)?.toLowerCase() === '__construct'
        ? list(member, 'arguments').filter(parameter => Number(parameter.flags) !== 0)
        : []
    for (const property of properties) {
      const receiver = receiverOfType(field(property, 'type'), scope)
      if (receiver !== undefined) found.set(`$this->${nameOf(property.name)}`, receiver)
    }
  }
  return found
}

/** A node that declares its own variable scope: a function, method, closure, arrow function or class. */
function ownScope(node: Fields): boolean {
  return callables.has(node.kind) || typeKinds.has(node.kind)
}

/** Nodes of a body, including the functions and classes it declares but not what is inside them. */
function ownNodes(body: Fields | undefined): Fields[] {
  const nodes: Fields[] = []
  function visit(node: Syntax): void {
    nodes.push(node as Fields)
    if (node === body || !ownScope(node as Fields)) for (const child of children(node)) visit(child)
  }
  if (body !== undefined) visit(body)
  return nodes
}

/**
 * How often a body assigns each of its own variables, including through destructuring, `foreach`,
 * and a closure that imports the variable by reference. Other functions and classes it declares
 * have variables of their own.
 */
function writesIn(body: Fields | undefined): Map<string, number> {
  const writes = new Map<string, number>()
  function target(node: Fields | undefined): void {
    if (node?.kind === 'variable' && typeof node.name === 'string') writes.set(node.name, (writes.get(node.name) ?? 0) + 1)
    if (node?.kind === 'list' || node?.kind === 'array') for (const item of list(node, 'items')) target(field(item, 'value'))
  }
  for (const node of ownNodes(body)) {
    if (node.kind === 'assign' || node.kind === 'assignref') target(field(node, 'left'))
    if (node.kind === 'foreach') [field(node, 'key'), field(node, 'value')].forEach(target)
    // A nested closure can assign an enclosing variable only through an import by reference.
    if (node !== body && node.kind === 'closure') list(node, 'uses').filter(used => used.byref === true).forEach(target)
  }
  return writes
}

/** Whether a value is a Slim application the statement creates: `AppFactory::create()` or `new App(...)`. */
function createdApplication(value: Fields | undefined, scope: NameScope): boolean {
  const factory = value?.kind === 'call' && receiverOf(value)?.kind === 'name'
    && typeName(receiverOf(value), scope) === 'Slim\\Factory\\AppFactory'
    && memberOf(value)?.toLowerCase().startsWith('create') === true
  const constructed = value?.kind === 'new' && typeName(field(value, 'what'), scope) === 'Slim\\App'
  return factory || constructed
}

/** Whether a call sets a Slim application's base path: `$app->setBasePath('/myapp')`. */
export function setsBasePath(call: Fields): boolean {
  return call.kind === 'call' && memberOf(call)?.toLowerCase() === 'setbasepath'
}

/**
 * The base paths a body gives its Slim applications with `$app->setBasePath(...)`: the stated one, or
 * an unresolved one when the source computes it or states several.
 */
function basePaths(nodes: readonly Fields[]): Map<string, RouteText> {
  const paths = new Map<string, RouteText>()
  for (const call of nodes.filter(setsBasePath)) {
    const name = receiverName(receiverOf(call))
    if (name === undefined) continue
    const path = routeText(list(call, 'arguments')[0], () => undefined)
    paths.set(name, paths.has(name) ? unresolvedRoute : path)
  }
  return paths
}

/**
 * Variables a body binds to a created Slim application. A variable counts only when every write to
 * it in the body is such a binding. Its routes are served under the base path the body sets.
 */
export function boundReceivers(body: Fields | undefined, scope: NameScope): Map<string, Receiver> {
  const writes = writesIn(body)
  const nodes = ownNodes(body)
  const bindings = new Map<string, number>()
  for (const node of nodes) {
    const left = node.kind === 'assign' ? field(node, 'left') : undefined
    const name = left?.kind === 'variable' && typeof left.name === 'string' ? left.name : undefined
    if (name !== undefined && createdApplication(field(node, 'right'), scope)) bindings.set(name, (bindings.get(name) ?? 0) + 1)
  }
  const bases = basePaths(nodes)
  return new Map([...bindings].filter(([name, count]) => writes.get(name) === count)
    .map(([name]) => [`$${name}`, { role: 'slim', prefix: bases.get(`$${name}`) ?? noRoute, projectBase: false }]))
}

/**
 * The receivers a function, method or closure proves: its parameters declared with a recognized type,
 * the variables its body binds to a created application, the variables a closure imports by value
 * from proved ones, and, for the closure a route group calls, its first parameter, which the router
 * fills with the group. A parameter or import the body assigns proves nothing; other variables of
 * enclosing code are not visible.
 */
export function callableReceivers(callable: Fields, scope: NameScope & { receivers: Receivers }, group?: Receiver): Map<string, Receiver> {
  const writes = writesIn(field(callable, 'body'))
  const found = boundReceivers(field(callable, 'body'), scope)
  for (const used of list(callable, 'uses')) {
    const outer = scope.receivers.get(`$${used.name}`)
    // An import by reference also assigns the enclosing variable, which then proves nothing already.
    if (outer !== undefined && !writes.has(String(used.name))) found.set(`$${used.name}`, outer)
  }
  for (const [index, parameter] of list(callable, 'arguments').entries()) {
    const name = nameOf(parameter.name)!
    const receiver = group !== undefined && index === 0 ? group : receiverOfType(field(parameter, 'type'), scope)
    if (receiver !== undefined && !writes.has(name)) found.set(`$${name}`, receiver)
  }
  return found
}
