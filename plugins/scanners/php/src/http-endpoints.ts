import type { HttpEndpointSegment } from '@groma/scanner'
import { joinPath, literalText, routeSegments, type Constants } from './http-url.ts'
import { field, list, memberOf, nameOf, operationId, symbolName, type Fields } from './syntax.ts'

/** The handler that answers the endpoint: an operation in this file, or a scan symbol name to resolve. */
export type Handler = { operation: string } | { symbol: string }

/** An endpoint whose handler is not resolved to an operation id yet. */
export interface PendingEndpoint {
  handler: Handler
  method: string
  path: HttpEndpointSegment[]
}

/** What the file being read says about names: its namespace, its `use` aliases and its constants. */
export interface FileScope {
  file: string
  namespace: string
  /** Operation the code being read belongs to; top-level code has none. */
  operation?: string
  /** Alias or last name segment to its fully qualified name. */
  imports: ReadonlyMap<string, string>
  constants: Constants
  /** Fully qualified name of the enclosing type, for a `[$this, 'method']` handler. */
  type?: string
  /** Route prefix the enclosing groups declare; undefined when one of them is not literal. */
  prefix: string | undefined
  /** Names bound to a recognized HTTP client: `$client` and `$this->http`. */
  clients: ReadonlySet<string>
}

const routeMethods = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'], ['delete', 'DELETE'],
  ['options', 'OPTIONS'], ['head', 'HEAD'], ['any', '*'],
])
/** WordPress names its method sets with these constants. */
const restServerMethods = new Map([
  ['READABLE', ['GET']], ['CREATABLE', ['POST']], ['EDITABLE', ['POST', 'PUT', 'PATCH']],
  ['DELETABLE', ['DELETE']], ['ALLMETHODS', ['*']],
])

/** The receiver of a member call, for reading a builder chain such as `Route::prefix('api')->group(...)`. */
function receiverOf(call: Fields): Fields | undefined {
  return field(field(call, 'what')!, 'what')
}

/** The fully qualified name a class reference states, through the file's `use` aliases. */
export function typeName(node: Fields | undefined, scope: Pick<FileScope, 'namespace' | 'imports' | 'type'>): string | undefined {
  if (node?.kind === 'selfreference' || node?.kind === 'staticreference') return scope.type
  if (node?.kind !== 'name') return undefined
  const written = String(node.name)
  if (written.startsWith('\\')) return written.slice(1)
  const [head, ...rest] = written.split('\\')
  const imported = scope.imports.get(head!)
  if (imported !== undefined) return [imported, ...rest].join('\\')
  return scope.namespace ? `${scope.namespace}\\${written}` : written
}

/** `Foo::class`, `self::class` or `$this`, as the type whose method handles the request. */
function handlerType(node: Fields | undefined, scope: FileScope): string | undefined {
  if (node?.kind === 'variable' && node.name === 'this') return scope.type
  if (node?.kind !== 'staticlookup' || nameOf(field(node, 'offset')) !== 'class') return undefined
  return typeName(field(node, 'what'), scope)
}

/** A `[Type::class, 'method']` or `[$this, 'method']` array handler. */
function arrayHandler(node: Fields, scope: FileScope): Handler | undefined {
  const items = list(node, 'items')
  if (items.length !== 2) return undefined
  const type = handlerType(field(items[0]!, 'value'), scope)
  const method = literalText(field(items[1]!, 'value'), scope.constants)
  return type === undefined || method === undefined ? undefined : { symbol: symbolName('', method, type) }
}

/**
 * The handler an argument names: a function literal written in place, an array callable, an
 * invokable class, or a symbol name a string states. Anything else leaves the endpoint unreported.
 */
export function handlerOf(argument: Fields | undefined, scope: FileScope): Handler | undefined {
  if (argument === undefined) return undefined
  if (argument.kind === 'closure' || argument.kind === 'arrowfunc') {
    return { operation: operationId(scope.file, argument) }
  }
  if (argument.kind === 'array') return arrayHandler(argument, scope)
  const invokable = handlerType(argument, scope)
  if (invokable !== undefined) return { symbol: symbolName('', '__invoke', invokable) }
  const written = literalText(argument, scope.constants)
  // A string names a function or a `Type::method`, already fully qualified as PHP resolves it.
  return written === undefined || !/^\\?[\w\\]+(?:::\w+)?$/.test(written) ? undefined : { symbol: written.replace(/^\\/, '') }
}

/** An unresolved prefix or route, or an unresolved handler, reports no endpoint. */
function endpointsFor(
  methods: string[], route: string | undefined, handler: Handler | undefined, prefix: string | undefined,
): PendingEndpoint[] {
  if (handler === undefined) return []
  const written = joinPath(prefix, route)
  const path = written === undefined ? undefined : routeSegments(written)
  return path === undefined ? [] : methods.map(method => ({ handler, method, path }))
}

/** The literal method names an argument lists, such as `['get', 'head']` or `'GET, POST'`. */
function methodList(node: Fields | undefined, constants: Constants): string[] | undefined {
  const written = node?.kind === 'array'
    ? list(node, 'items').map(item => literalText(field(item, 'value'), constants))
    : [literalText(node, constants)]
  if (written.some(name => name === undefined)) return undefined
  const methods = written.flatMap(name => name!.split(',').map(part => part.trim().toUpperCase()))
  return methods.every(name => /^[A-Z][A-Z-]*$/.test(name)) ? methods : undefined
}

/**
 * A route registered on a builder, either statically as `Route::get('/talks', $handler)` or on an
 * application or group object as `$app->get('/talks', $handler)`. `match` and `map` list their methods.
 */
export function builderEndpoints(call: Fields, scope: FileScope): PendingEndpoint[] {
  const member = memberOf(call)?.toLowerCase()
  const args = list(call, 'arguments')
  if (member === 'match' || member === 'map') {
    if (args.length !== 3) return []
    const methods = methodList(args[0], scope.constants)
    return methods === undefined ? [] : endpointsFor(methods, literalText(args[1], scope.constants), handlerOf(args[2], scope), scope.prefix)
  }
  const method = member === undefined ? undefined : routeMethods.get(member)
  // Two arguments, a route and a handler: any other shape is some other call that shares the name.
  if (method === undefined || args.length !== 2) return []
  return endpointsFor([method], literalText(args[0], scope.constants), handlerOf(args[1], scope), scope.prefix)
}

/** The value of an array entry with the given literal key. */
function entryValue(node: Fields | undefined, key: string, constants: Constants): Fields | undefined {
  if (node?.kind !== 'array') return undefined
  const entry = list(node, 'items').find(item => literalText(field(item, 'key'), constants) === key)
  return entry === undefined ? undefined : field(entry, 'value')
}

/**
 * Prefixes a builder chain declares, such as `Route::prefix('api')->middleware('auth')->group(...)`.
 * A prefix the source computes leaves the chain unresolved.
 */
function chainPrefix(call: Fields, constants: Constants): string | undefined {
  const prefixes: (string | undefined)[] = []
  let current: Fields | undefined = receiverOf(call)
  while (current?.kind === 'call') {
    if (memberOf(current)?.toLowerCase() === 'prefix') {
      prefixes.unshift(literalText(list(current, 'arguments')[0], constants))
    }
    current = receiverOf(current)
  }
  return joinPath(...prefixes)
}

/** The prefix a group states as its first argument, either as a path or as a `prefix` option. */
function groupPrefix(argument: Fields | undefined, constants: Constants): string | undefined {
  if (argument === undefined) return ''
  const option = argument.kind === 'array' ? entryValue(argument, 'prefix', constants) : undefined
  // A group array without a prefix option states no prefix; any other unresolved value states one.
  if (argument.kind === 'array' && option === undefined) return ''
  return literalText(option ?? argument, constants)
}

/** A route group whose closure declares routes under a shared prefix. */
export function groupCall(call: Fields, constants: Constants): { prefix: string | undefined; routes: Fields } | undefined {
  if (memberOf(call)?.toLowerCase() !== 'group') return undefined
  const args = list(call, 'arguments')
  const routes = args.find(argument => argument.kind === 'closure' || argument.kind === 'arrowfunc')
  if (routes === undefined) return undefined
  const stated = groupPrefix(args[0] === routes ? undefined : args[0], constants)
  return { prefix: joinPath(chainPrefix(call, constants), stated), routes }
}

/** The path and methods a `#[Route]` attribute states; a computed path leaves the route unreported. */
function attributeRoute(attribute: Fields, constants: Constants): { route: string | undefined; methods: string[] } {
  const args = list(attribute, 'args')
  const positional = args.find(argument => argument.kind !== 'namedargument')
  const named = (name: string) => args.find(argument => argument.kind === 'namedargument' && argument.name === name)
  const path = named('path') ?? positional
  const methods = named('methods')
  return {
    // A named argument wraps its value; a positional argument is the value.
    route: path === undefined ? '' : literalText(path.kind === 'namedargument' ? field(path, 'value') : path, constants),
    methods: methods === undefined ? ['*'] : methodList(field(methods, 'value'), constants) ?? [],
  }
}

/** Attributes named `Route`, as Symfony writes them on a controller class and its methods. */
export function routeAttributes(node: Fields): Fields[] {
  return list(node, 'attrGroups').flatMap(group => list(group, 'attrs')
    .filter(attribute => String(attribute.name).split('\\').at(-1) === 'Route'))
}

/**
 * The prefix a class-level `#[Route]` attribute states for every route in the class. A class with no
 * such attribute states no prefix; one whose attribute path is not literal leaves it unresolved.
 */
export function attributePrefix(node: Fields, constants: Constants): string | undefined {
  return joinPath(...routeAttributes(node).map(attribute => attributeRoute(attribute, constants).route))
}

/** Endpoints a controller method's own `#[Route]` attributes declare, under the class prefix. */
export function attributeEndpoints(method: Fields, scope: FileScope): PendingEndpoint[] {
  if (field(method, 'body') === undefined) return []
  const handler: Handler = { operation: operationId(scope.file, method) }
  return routeAttributes(method).flatMap(attribute => {
    const { route, methods } = attributeRoute(attribute, scope.constants)
    return endpointsFor(methods, route, handler, scope.prefix)
  })
}

/**
 * A WordPress REST route: `register_rest_route($namespace, $route, $args)`. The served path is the
 * namespace and route the source states; the REST root the site adds is not part of the source.
 */
export function restRouteEndpoints(call: Fields, scope: FileScope): PendingEndpoint[] {
  if (nameOf(field(call, 'what'))?.replace(/^\\/, '') !== 'register_rest_route') return []
  const [namespace, route, args] = list(call, 'arguments')
  const declared = literalText(namespace, scope.constants)
  const written = literalText(route, scope.constants)
  if (declared === undefined || written === undefined) return []
  const path = joinPath(declared, written)
  const configurations = entryValue(args, 'methods', scope.constants) === undefined
    ? list(args, 'items').map(item => field(item, 'value')).filter(value => value?.kind === 'array')
    : [args]
  return configurations.flatMap(configuration => {
    const methods = restMethods(entryValue(configuration, 'methods', scope.constants), scope.constants)
    const handler = handlerOf(entryValue(configuration, 'callback', scope.constants), scope)
    return methods === undefined ? [] : endpointsFor(methods, path, handler, scope.prefix)
  })
}

/** Methods a REST route states, either as names or as `WP_REST_Server` constants. */
function restMethods(node: Fields | undefined, constants: Constants): string[] | undefined {
  if (node?.kind === 'staticlookup') return restServerMethods.get(nameOf(field(node, 'offset')) ?? '')
  const written = literalText(node, constants)
  if (written === undefined) return methodList(node, constants)
  return restServerMethods.get(written.toUpperCase()) ?? methodList(node, constants)
}
