import { staysInSegment, unreadablePattern, type Requirements } from './http-routes.ts'
import { joinRoutes, literalText, noRoute, routeText, unresolvedRoute, type Constants, type RouteText } from './http-url.ts'
import { proved, type Receiver, type Receivers, type Router } from './receivers.ts'
import {
  calledFunction, field, list, memberOf, moduleOperationId, nameOf, operationId, qualifiedName, receiverOf, symbolName, typeName,
  type Fields, type NameScope,
} from './syntax.ts'

/** The handler that answers the endpoint: an operation in this file, or a scan symbol name to resolve. */
export type Handler = { operation: string } | { symbol: string }

/**
 * Which router's route syntax and project-wide rules an entry uses.
 */
export type Routing = 'laravel' | 'slim' | 'symfony'

/** A route entry of one file, before handler symbols name operations and before the project adds to it. */
export interface PendingEndpoint {
  /** Undefined when the handler or the methods are not readable, which makes the entry a blocker. */
  handler: Handler | undefined
  method: string
  /** The route under the prefixes of its own file, as far as the source states it. */
  route: RouteText
  requirements: Requirements
  routing?: Routing
  /** The operation that registers the route, which the endpoint names as a blocker. */
  registrar: string
}

/** What the code being read can prove: its names, constants, route prefix and receivers. */
export interface FileScope extends NameScope {
  file: string
  /** Operation the code being read belongs to; top-level code has none. */
  operation?: string
  constants: Constants
  /** Route prefix the enclosing groups and class attribute declare, as far as the source states it. */
  prefix: RouteText
  /** Parameter patterns the enclosing group, class attribute or route modifiers state. */
  requirements: Requirements
  /** Receivers proved to hold an HTTP client or a router. */
  receivers: Receivers
  /** The controller a Laravel `Route::controller(...)` group names for the method names its routes state. */
  controller?: string
  /** Set inside the closure of a Laravel route group, where a required routes file is served under the group. */
  grouped?: boolean
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
 * The handler a Laravel route argument names. Laravel reads a plain string as a method of the
 * controller its `Route::controller(...)` group names, or otherwise as a controller class, never as a
 * function, so a string outside such a group leaves the handler unknown.
 */
function laravelHandler(argument: Fields | undefined, scope: FileScope): Handler | undefined {
  const written = argument?.kind === 'string' || argument?.kind === 'nowdoc' ? literalText(argument, scope.constants) : undefined
  if (written === undefined) return handlerOf(argument, scope)
  return scope.controller === undefined ? undefined : { symbol: symbolName('', written, scope.controller) }
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
  return written === undefined || !/^\\?[\w\\]+(?:::\w+)?$/.test(written) ? undefined : { symbol: qualifiedName(written) }
}

/** Where a route entry is registered: its prefix, patterns, router and registering operation. */
type Registration = Pick<FileScope, 'prefix' | 'requirements'> & { registrar: string; routing?: Routing }

export function registration(scope: FileScope): Registration {
  return { prefix: scope.prefix, requirements: scope.requirements, registrar: scope.operation ?? moduleOperationId(scope.file) }
}

/**
 * Endpoints of one route entry, for every method unless the methods are not readable (undefined).
 * Every PHP router this scanner reads takes the first registered match, so an entry whose methods or
 * handler are not readable is still reported, as a blocker.
 */
function endpointsFor(methods: string[] | undefined, route: RouteText, handler: Handler | undefined, at: Registration): PendingEndpoint[] {
  const entry = {
    handler: methods === undefined ? undefined : handler, route: joinRoutes(at.prefix, route), requirements: at.requirements,
    routing: at.routing, registrar: at.registrar,
  }
  return (methods ?? ['*']).map(method => ({ ...entry, method }))
}

/**
 * Patterns by parameter name. A name the scanner cannot read may name any parameter, so every
 * parameter becomes constrained (`*`), by the stated pattern only when it stays inside one segment.
 */
function patterns(entries: [string | undefined, string | undefined][]): Map<string, string> {
  return new Map(entries.map(([name, pattern]) => name !== undefined ? [name, pattern ?? unreadablePattern]
    : ['*', pattern !== undefined && staysInSegment(pattern) ? pattern : unreadablePattern]))
}

/** `['id' => '\d+']` as patterns by parameter name. */
function patternMap(node: Fields | undefined, constants: Constants): Map<string, string> {
  if (node?.kind !== 'array') return patterns([[undefined, undefined]])
  return patterns(list(node, 'items').map(item => [literalText(field(item, 'key'), constants), literalText(field(item, 'value'), constants)]))
}

/** Laravel's named `where` helpers, whose patterns stay inside one segment. */
const whereHelpers = new Map([
  ['wherenumber', '[0-9]+'], ['wherealpha', '[a-zA-Z]+'], ['wherealphanumeric', '[a-zA-Z0-9]+'],
  ['whereuuid', '[\\da-fA-F-]+'], ['whereulid', '[0-9a-zA-Z]+'],
])

/** The patterns a Laravel `where`, `whereNumber`, `whereIn` or similar call states, or undefined for any other call. */
export function whereRequirements(call: Fields, constants: Constants): Map<string, string> | undefined {
  const member = memberOf(call)?.toLowerCase()
  const [names, value] = list(call, 'arguments')
  if (member === 'where' && names?.kind === 'array') return patternMap(names, constants)
  const values = member === 'wherein' && value?.kind === 'array'
    ? list(value, 'items').map(item => literalText(field(item, 'value'), constants)) : [undefined]
  const pattern = member === 'where' ? literalText(value, constants) ?? unreadablePattern
    : member === 'wherein' ? (values.includes(undefined) ? unreadablePattern : values.join('|'))
      : whereHelpers.get(member ?? '')
  if (pattern === undefined) return undefined
  const written = names?.kind === 'array' ? list(names, 'items').map(item => field(item, 'value')) : [names]
  return patterns(written.map(name => [literalText(name, constants), pattern]))
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

/** What a builder chain such as `Route::prefix('api')->where([...])` states for the routes it registers. */
interface Chain {
  prefix: RouteText
  requirements: Map<string, string>
  router: Router
  routing?: Routing
  controller?: string
}

/** A chain call that states a prefix, a host, a controller or patterns for the routes the chain registers. */
function chainModifier(call: Fields, chain: Pick<Chain, 'requirements' | 'controller'>, prefixes: RouteText[], scope: FileScope): void {
  const member = memberOf(call)?.toLowerCase()
  const [argument] = list(call, 'arguments')
  if (member === 'prefix') prefixes.unshift(routeText(argument, scope.constants))
  // A route that answers only on one host cannot be told apart from the rest by its path.
  if (member === 'domain') prefixes.unshift(unresolvedRoute)
  if (member === 'controller') chain.controller = argument?.kind === 'staticlookup' ? typeName(field(argument, 'what'), scope) : undefined
  for (const [name, pattern] of whereRequirements(call, scope.constants) ?? []) chain.requirements.set(name, pattern)
}

/**
 * The prefix, controller and parameter patterns a builder chain declares, when the chain starts at a
 * proved router; undefined when it does not. A Laravel chain continues the group the code runs in; a
 * Slim chain continues its receiver's own prefix. A computed prefix is unresolved.
 */
function routerChain(call: Fields, scope: FileScope): Chain | undefined {
  const prefixes: RouteText[] = []
  const chain = { requirements: new Map(scope.requirements), controller: scope.controller }
  let current = receiverOf(call)
  while (current?.kind === 'call') {
    chainModifier(current, chain, prefixes, scope)
    current = receiverOf(current)
  }
  const receiver = proved(current, scope)
  if (receiver === undefined || receiver.role === 'client') return undefined
  if (receiver.role === 'laravel') return { ...chain, prefix: joinRoutes(scope.prefix, ...prefixes), router: 'laravel', routing: 'laravel' }
  const routing = receiver.projectBase ? 'slim' : undefined
  return { ...chain, prefix: joinRoutes(receiver.prefix, ...prefixes), router: 'slim', routing }
}

/** The patterns Laravel's `Route::pattern('id', ...)` or `Route::patterns([...])` sets for every route. */
export function globalPatterns(call: Fields, scope: FileScope): Map<string, string> | undefined {
  const member = memberOf(call)?.toLowerCase()
  if ((member !== 'pattern' && member !== 'patterns') || proved(receiverOf(call), scope)?.role !== 'laravel') return undefined
  const [names, value] = list(call, 'arguments')
  return member === 'patterns' ? patternMap(names, scope.constants) : patterns([[literalText(names, scope.constants), literalText(value, scope.constants)]])
}

/** Members that register routes this scanner does not report: views, redirects and resource controllers. */
const unreadRoutes = new Set([
  'view', 'redirect', 'permanentredirect', 'resource', 'resources', 'apiresource', 'apiresources', 'singleton', 'apisingleton',
])

/** The methods a builder member registers, undefined when not readable, and the position of its route argument. */
function builderRoute(member: string | undefined, args: Fields[], constants: Constants): { methods: string[] | undefined; at: number } | undefined {
  if (member === 'match' || member === 'map') return { methods: methodList(args[0], constants), at: 1 }
  if (unreadRoutes.has(member ?? '')) return { methods: undefined, at: 0 }
  const method = member === undefined ? undefined : routeMethods.get(member)
  return method === undefined ? undefined : { methods: [method], at: 0 }
}

/**
 * A route registered on a proved router, either statically as `Route::get('/talks', $handler)`,
 * after fluent prefixes as `Route::prefix('api')->get(...)`, or on an application or group object
 * as `$app->get('/talks', $handler)`. `match` and `map` list their methods.
 */
export function builderEndpoints(call: Fields, scope: FileScope): PendingEndpoint[] {
  const args = list(call, 'arguments')
  const route = builderRoute(memberOf(call)?.toLowerCase(), args, scope.constants)
  const chain = route === undefined ? undefined : routerChain(call, scope)
  if (route === undefined || chain === undefined) return []
  const at = { ...registration(scope), ...chain }
  const handler = chain.router === 'laravel' ? laravelHandler(args[route.at + 1], { ...scope, controller: chain.controller })
    : handlerOf(args[route.at + 1], scope)
  return endpointsFor(route.methods, routeText(args[route.at], scope.constants), handler, at)
}

/** The value of an array entry with the given literal key. */
function entryValue(node: Fields | undefined, key: string, constants: Constants): Fields | undefined {
  if (node?.kind !== 'array') return undefined
  const entry = list(node, 'items').find(item => literalText(field(item, 'key'), constants) === key)
  return entry === undefined ? undefined : field(entry, 'value')
}

/** The prefix a group states as its first argument, either as a path or as a `prefix` option. */
function groupPrefix(argument: Fields | undefined, constants: Constants): RouteText {
  if (argument === undefined) return noRoute
  const option = argument.kind === 'array' ? entryValue(argument, 'prefix', constants) : undefined
  // A group array without a prefix option states no prefix; any other unresolved value states one.
  if (argument.kind === 'array' && option === undefined) return noRoute
  return routeText(option ?? argument, constants)
}

/**
 * A route group on a proved router: its options, then either the closure that declares its routes,
 * with the receiver the router passes that closure first, or what names the routes it loads from
 * elsewhere, such as a Laravel routes file.
 */
export interface Group extends Chain {
  routes: Fields | undefined
  member: Receiver
  loaded: Fields | undefined
}

/** A route group on a proved router, whose routes share its prefix and patterns. */
export function groupCall(call: Fields, scope: FileScope): Group | undefined {
  const chain = memberOf(call)?.toLowerCase() === 'group' ? routerChain(call, scope) : undefined
  if (chain === undefined) return undefined
  const args = list(call, 'arguments')
  const last = args.at(-1)
  const routes = last?.kind === 'closure' || last?.kind === 'arrowfunc' ? last : undefined
  const options = args.length > 1 ? args[0] : undefined
  // Laravel's group options may also state patterns, and a host that makes every route inside a blocker.
  const where = entryValue(options, 'where', scope.constants)
  const requirements = where === undefined ? chain.requirements : new Map([...chain.requirements, ...patternMap(where, scope.constants)])
  const host = entryValue(options, 'domain', scope.constants) === undefined ? noRoute : unresolvedRoute
  const prefix = joinRoutes(chain.prefix, groupPrefix(options, scope.constants), host)
  const member: Receiver = chain.router === 'laravel' ? { role: 'laravel' } : { role: 'slim', prefix, projectBase: chain.routing === 'slim' }
  return { ...chain, prefix, requirements, routes, member, loaded: routes === undefined ? last : undefined }
}

/** What a `#[Route]` attribute states; methods are undefined when not readable. */
interface AttributeRoute {
  route: RouteText
  methods: string[] | undefined
  requirements: Requirements
}

function attributeRoute(attribute: Fields, constants: Constants): AttributeRoute {
  const args = list(attribute, 'args')
  const positional = args.find(argument => argument.kind !== 'namedargument')
  const named = (name: string) => args.find(argument => argument.kind === 'namedargument' && argument.name === name)
  const path = named('path') ?? positional
  const methods = named('methods')
  const requirements = named('requirements')
  return {
    // A named argument wraps its value; a positional argument is the value.
    route: path === undefined ? noRoute : routeText(path.kind === 'namedargument' ? field(path, 'value') : path, constants),
    methods: methods === undefined ? ['*'] : methodList(field(methods, 'value'), constants),
    requirements: requirements === undefined ? new Map() : patternMap(field(requirements, 'value'), constants),
  }
}

/** Only proved routing attributes register Symfony-style endpoints. Drupal's Route extends Symfony's. */
export function routeAttributes(node: Fields, scope: NameScope): Fields[] {
  return list(node, 'attrGroups').flatMap(group => list(group, 'attrs')
    .filter(attribute => ['Symfony\\Component\\Routing\\Attribute\\Route', 'Symfony\\Component\\Routing\\Annotation\\Route',
      'Drupal\\Core\\Routing\\Attribute\\Route']
      .includes(typeName(String(attribute.name), scope) ?? '')))
}

/**
 * The prefix and parameter patterns a class-level `#[Route]` attribute states for every route in the
 * class. A class with no such attribute states neither; a path that is not literal leaves the prefix
 * unresolved.
 */
export function attributeScope(node: Fields, scope: FileScope): Pick<FileScope, 'prefix' | 'requirements'> {
  const routes = routeAttributes(node, scope).map(attribute => attributeRoute(attribute, scope.constants))
  return { prefix: joinRoutes(...routes.map(route => route.route)), requirements: new Map(routes.flatMap(route => [...route.requirements])) }
}

/** A Slim group whose routes come from a callable the scanner does not follow blocks its prefix. */
export function groupBlocker(group: Group, scope: FileScope): PendingEndpoint[] {
  return endpointsFor(undefined, unresolvedRoute, undefined, { ...registration(scope), ...group })
}

/** Endpoints `#[Route]` attributes declare for one method with a body, which also registers them. */
function routedMethod(attributes: Fields[], method: Fields, scope: FileScope): PendingEndpoint[] {
  const handler = { operation: operationId(scope.file, method) }
  return attributes.flatMap(attribute => {
    const { route, methods, requirements } = attributeRoute(attribute, scope.constants)
    const at = { ...scope, requirements: new Map([...scope.requirements, ...requirements]), registrar: handler.operation,
      routing: 'symfony' as const }
    return endpointsFor(methods, route, handler, at)
  })
}

/** Endpoints a controller method's own `#[Route]` attributes declare, under the class prefix and patterns. */
export function attributeEndpoints(method: Fields, scope: FileScope): PendingEndpoint[] {
  return field(method, 'body') === undefined ? [] : routedMethod(routeAttributes(method, scope), method, scope)
}

/**
 * Symfony reads the class-level `#[Route]` of an invokable controller whose methods declare no route
 * as the route of `__invoke`, not as a prefix. The scope is the one the class is declared in.
 */
export function invokableEndpoints(type: Fields, scope: FileScope): PendingEndpoint[] {
  const methods = list(type, 'body').filter(member => member.kind === 'method')
  const invoke = methods.find(method => nameOf(method.name)?.toLowerCase() === '__invoke' && field(method, 'body') !== undefined)
  if (invoke === undefined || methods.some(method => routeAttributes(method, scope).length > 0)) return []
  return routedMethod(routeAttributes(type, scope), invoke, scope)
}

/**
 * A WordPress REST route: `register_rest_route($namespace, $route, $args)`. The served path is the
 * namespace and route the source states; the REST root the site adds is not part of the source.
 */
export function restRouteEndpoints(call: Fields, scope: FileScope): PendingEndpoint[] {
  if (calledFunction(call) !== 'register_rest_route') return []
  const [namespace, route, args] = list(call, 'arguments')
  const path = joinRoutes(routeText(namespace, scope.constants), routeText(route, scope.constants))
  const configurations = entryValue(args, 'callback', scope.constants) !== undefined ? [args]
    : list(args, 'items').filter(item => {
      const key = field(item, 'key')
      return key === undefined || (['number', 'string'].includes(key.kind) && /^\d+$/.test(String(key.value)))
    }).map(item => field(item, 'value')).filter(value => value?.kind === 'array')
  // Arguments that state no readable configuration still register the route.
  if (configurations.length === 0) return endpointsFor(undefined, path, undefined, registration(scope))
  return configurations.flatMap(configuration => {
    const declared = entryValue(configuration, 'methods', scope.constants)
    const methods = declared === undefined ? ['GET'] : restMethods(declared, scope.constants)
    const handler = handlerOf(entryValue(configuration, 'callback', scope.constants), scope)
    return endpointsFor(methods, path, handler, registration(scope))
  })
}

/** Methods a REST route states, either as names or as `WP_REST_Server` constants. */
function restMethods(node: Fields | undefined, constants: Constants): string[] | undefined {
  if (node?.kind === 'staticlookup') return restServerMethods.get(nameOf(field(node, 'offset')) ?? '')
  const written = literalText(node, constants)
  if (written === undefined) return methodList(node, constants)
  return restServerMethods.get(written.toUpperCase()) ?? methodList(node, constants)
}
