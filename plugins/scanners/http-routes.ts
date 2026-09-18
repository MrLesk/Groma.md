import type { ScanHttpEndpoint } from '@groma/scanner'
import { below, type Placed, type Placement } from './http-order.ts'
import { blockedPath, endpointPath, readablePrefix } from './http-paths.ts'
import {
  atTopLevel, entryStart, mounting, ORDERED, routeMembers, routeMethod, routerRegistrations, unreadHonoMembers,
  type Call, type Node, type Registrar, type Registration, type Registrations, type RouterContext,
} from './http-routers.ts'
import { methodText } from './http-url.ts'

/*
 * The endpoints the registrations ./http-routers.ts finds serve, placed where their registrar is
 * mounted and numbered in the order they run, and Bun.serve routes, for every TypeScript-family
 * compiler.
 */

interface Mount {
  /** The registration on the parent instance. */
  registration: Registration
  /** Undefined when the prefix is not literal, which leaves the mounted routes unknown. */
  prefix?: string
  /** The registrar's place among those the call mounts, which are tried in that order. */
  position: number
}

interface Routing extends Registrations {
  mounts: Map<Node, Mount[]>
  context: RouterContext
}

/** Where an entry serves, and whether it certainly serves there or only may. */
interface Place {
  placement: Placement
  certain: boolean
}

/** A mounted instance: the router itself, or the routes a Koa router exposes through `routes()`. */
async function registrarArgument(argument: Node, routing: Omit<Routing, 'mounts'>): Promise<Node | undefined> {
  const { ts } = routing.context
  const exposed = ts.isCallExpression(argument) && ts.isPropertyAccessExpression(argument.expression)
    && argument.expression.name.text === 'routes' ? argument.expression.expression : undefined
  const named = exposed ?? argument
  if (!ts.isIdentifier(named)) return undefined
  const declaration = await routing.context.declarationOf(named)
  const registrar = declaration === undefined ? undefined : routing.registrars.get(declaration)
  if (registrar === undefined) return undefined
  // A Koa router is mounted through its `routes()`, any other registrar as itself.
  const koa = registrar.framework === 'koa'
  return koa === (exposed !== undefined) ? declaration : undefined
}

/**
 * A router the scan cannot follow: the `routes()` of one it does not recognize, or a name loaded from
 * a relative module, which is the application's own code rather than a package's middleware, unless
 * the scan sees it is a function, which is middleware.
 */
async function foreignRouter(argument: Node, routing: Omit<Routing, 'mounts'>): Promise<boolean> {
  const { ts } = routing.context
  if (await registrarArgument(argument, routing) !== undefined) return false
  if (ts.isCallExpression(argument) && ts.isPropertyAccessExpression(argument.expression)) {
    return argument.expression.name.text === 'routes'
  }
  const origin = await routing.context.importOrigin(argument)
  if (origin?.module.startsWith('.') !== true) return false
  const held = await routing.context.heldAt(argument)
  return typeof held !== 'object' || !ts.isFunctionLike(held.node)
}

/**
 * What a `use` or `route` call mounts: the recognized registrars among its arguments, under the path
 * its first argument states, or under no path when the first argument is itself a registrar.
 */
async function mountOf(
  registration: Registration, routing: Omit<Routing, 'mounts'>,
): Promise<{ children: Node[]; prefix?: string }> {
  const [first, ...rest] = registration.call.arguments
  if (first === undefined) return { children: [] }
  const unprefixed = await registrarArgument(first, routing)
  const children: Node[] = unprefixed === undefined ? [] : [unprefixed]
  for (const argument of rest) {
    const child = await registrarArgument(argument, routing)
    if (child !== undefined) children.push(child)
  }
  const prefix = unprefixed === undefined ? await routing.context.literalText(first) : ''
  return { children, ...(prefix === undefined ? {} : { prefix }) }
}

async function collectMounts(routing: Omit<Routing, 'mounts'>): Promise<Map<Node, Mount[]>> {
  const mounts = new Map<Node, Mount[]>()
  for (const registration of routing.registrations) {
    if (!mounting(registration)) continue
    const { children, prefix } = await mountOf(registration, routing)
    for (const [position, child] of children.entries()) {
      mounts.set(child, [...mounts.get(child) ?? [], { registration, position, ...(prefix === undefined ? {} : { prefix }) }])
    }
  }
  return mounts
}

/** The registrar's own path follows where it is placed. */
function withOwn(placement: Placement, registrar: Registrar): Placement {
  return registrar.own === '' ? placement : { ...placement, prefix: `${placement.prefix}/${registrar.own}` }
}

/**
 * Whether a mounted entry is under the mount. Hono's `route` and a Koa router's `use` copy the routes
 * the child has when the call runs, so an entry is under it only when it comes first; the others serve
 * the child's routes as they change. The copy's order is known only between top-level statements of
 * one file.
 */
function underMount(mount: Registration, entry: Node, routing: Routing): 'yes' | 'no' | 'unknown' {
  const { ts } = routing.context
  const parent = routing.registrars.get(mount.declaration)!
  const copies = (parent.framework === 'hono' && mount.member === 'route')
    || (parent.framework === 'koa' && parent.kind === 'router' && mount.member === 'use')
  if (!copies) return 'yes'
  const ordered = mount.call.getSourceFile() === entry.getSourceFile() && atTopLevel(ts, mount.call) && atTopLevel(ts, entry)
  if (!ordered) return 'unknown'
  return entryStart(ts, entry) < entryStart(ts, mount.call) ? 'yes' : 'no'
}

/**
 * Every place an entry of this instance serves from; an unmounted router, or one whose own path is
 * unknown, serves nothing here.
 */
function placements(declaration: Node, entry: Node, routing: Routing, seen: ReadonlySet<Node> = new Set()): Place[] {
  const registrar = routing.registrars.get(declaration)!
  if (seen.has(declaration) || registrar.own === undefined) return []
  const entries = routing.mounts.get(declaration) ?? []
  if (entries.length === 0) {
    if (registrar.kind === 'router') return []
    const application = routing.context.file(declaration)
    const root = { prefix: '', application, rank: [], known: true, ordered: ORDERED.has(registrar.framework) }
    return [{ placement: withOwn(root, registrar), certain: true }]
  }
  // A mount whose prefix is unknown blocks its parent's paths instead of placing these routes.
  return entries.flatMap(({ registration, prefix, position }) => {
    const under = prefix === undefined ? 'no' : underMount(registration, entry, routing)
    if (under === 'no') return []
    return placements(registration.declaration, registration.call, routing, new Set([...seen, declaration])).map(parent => {
      const at = below(parent.placement, routing.indices.get(registration.call), prefix!)
      const placement = withOwn(at.known ? { ...at, rank: [...at.rank, position] } : at, registrar)
      return { placement, certain: parent.certain && under === 'yes' }
    })
  })
}

async function methodList(node: Node | undefined, context: RouterContext): Promise<string[]> {
  if (node === undefined) return []
  const values = context.ts.isArrayLiteralExpression(node) ? [...node.elements] : [node]
  const methods = await Promise.all(values.map(async value => methodText(await context.literalText(value))))
  return methods.every(method => method !== undefined) ? methods as string[] : []
}

/**
 * A route entry the scan sees but cannot read, a registration or an escape `entry`, still occupies its
 * place in an application that takes the first registered match: it is reported as its known prefix and
 * a remainder that may or may not match. `always` reports it in an application that prefers the most
 * specific route too.
 */
function blocked(place: Place, prefix: string, method: string, entry: Node, routing: Routing, always = false): Placed[] {
  if (!place.placement.ordered && !always) return []
  const at = below(place.placement, routing.indices.get(entry), prefix)
  const operation = routing.context.callerOperation(entry)
  return [{ endpoint: { operation, method, path: blockedPath(at.prefix) }, placement: at }]
}

/** Hono's trailing `*` also matches the path without it. A route that may not be there only blocks its path. */
function served(place: Place, route: string, methods: readonly string[], operation: string, registration: Registration, routing: Routing): Placed[] {
  if (!place.certain) return methods.flatMap(method => blocked(place, route, method, registration.call, routing))
  const at = below(place.placement, routing.indices.get(registration.call), route)
  const path = endpointPath(at.prefix, routing.registrars.get(registration.declaration)!.framework === 'hono')
  return methods.map(method => ({ endpoint: { operation, method, path }, placement: at }))
}

/** The expression an option object's property certainly holds. */
async function option(context: RouterContext, options: Node, name: string): Promise<Node | undefined> {
  const value = await context.heldAt(options, name)
  return typeof value === 'object' ? value.node : undefined
}

/** Fastify's `route({ method, url, handler })`, or Express's `route(path)`, whose chained handlers are not read. */
async function routeOptions(registration: Registration, place: Place, routing: Routing): Promise<Placed[]> {
  const { context } = routing
  const { call } = registration
  const argument = call.arguments[0]!
  const options = await context.heldAt(argument)
  if (typeof options !== 'object' || !context.ts.isObjectLiteralExpression(options.node)) {
    return blocked(place, readablePrefix(await context.urlParts(argument)), '*', call, routing)
  }
  const url = await context.literalText(await option(context, argument, 'url'))
  const methods = await methodList(await option(context, argument, 'method'), context)
  if (url === undefined || methods.length === 0) return blocked(place, url ?? '', '*', call, routing)
  const operation = await context.handlerOperation(await option(context, argument, 'handler'), call)
  return served(place, url, methods, operation, registration, routing)
}

/** Hono's `on(method, path)`, `basePath(path)` and `mount(path)` block their path, read as far as it is literal. */
async function unreadCall(registration: Registration, place: Place, routing: Routing): Promise<Placed[]> {
  const { call, member } = registration
  const { context } = routing
  const [first, second] = call.arguments
  const path = member === 'on' ? second : first
  const prefix = path === undefined ? '' : readablePrefix(await context.urlParts(path))
  const method = member === 'on' ? methodText(await context.literalText(first)) : undefined
  return blocked(place, prefix, method ?? '*', call, routing)
}

/**
 * Fastify's `register(plugin, { prefix })` registers the plugin's routes, which the scan does not read,
 * below its prefix; Fastify prefers the most specific route, so the block carries no order.
 */
async function registerCall(registration: Registration, place: Place, routing: Routing): Promise<Placed[]> {
  const { call } = registration
  const options = call.arguments[1]
  const prefix = options === undefined ? 'absent' : await routing.context.heldAt(options, 'prefix')
  const readable = typeof prefix === 'object' ? readablePrefix(await routing.context.urlParts(prefix.node)) : ''
  return blocked(place, readable, '*', call, routing, true)
}

/** The path argument: a Koa router also takes `get(name, path, handler)`, whose first argument names the route. */
async function pathArgument(registration: Registration, routing: Routing): Promise<Node> {
  const [first, second] = registration.call.arguments
  const named = registration.member !== 'redirect' && registration.call.arguments.length > 2
    && routing.registrars.get(registration.declaration)!.framework === 'koa'
  const name = named ? await routing.context.literalText(first) : undefined
  return name !== undefined && !name.startsWith('/') ? second! : first!
}

/**
 * A registration needs its own handler: `app.get('name')` alone reads a setting. A Koa `redirect` answers
 * at its source path, which a route name in its place leaves unknown.
 */
async function routeCall(registration: Registration, place: Place, routing: Routing): Promise<Placed[]> {
  const { call, member } = registration
  const framework = routing.registrars.get(registration.declaration)!.framework
  if (unreadHonoMembers.has(member)) return unreadCall(registration, place, routing)
  if (member === 'register') return registerCall(registration, place, routing)
  if (member === 'route' && call.arguments.length === 1) return routeOptions(registration, place, routing)
  const method = routeMethod(member, framework)
  if (method === undefined || call.arguments.length < 2) return []
  const parts = await routing.context.urlParts(await pathArgument(registration, routing))
  const route = parts.length === 1 && parts[0]!.kind === 'text' ? parts[0]!.text : undefined
  if (route === undefined || (member === 'redirect' && !route.startsWith('/'))) {
    return blocked(place, route === undefined ? readablePrefix(parts) : '', method, call, routing)
  }
  const handler = member === 'redirect' ? undefined : call.arguments[call.arguments.length - 1]
  return served(place, route, [method], await routing.context.handlerOperation(handler, call), registration, routing)
}

/**
 * A mount the scan cannot follow may serve anything below its prefix: its prefix is not literal, what
 * it mounts under a path is not a recognized registrar, a mounted router states an own path the scan
 * cannot read, or it mounts only a router the scan cannot follow, with or without a path. Middleware is
 * not a mount: a handler from a package or one the scan sees is a function, and any handler next to a
 * recognized registrar in one call.
 */
async function mountCall(registration: Registration, place: Place, routing: Routing): Promise<Placed[]> {
  const { call } = registration
  const { children, prefix } = await mountOf(registration, routing)
  const hidden = children.some(child => routing.registrars.get(child)!.own === undefined)
  // A handler next to a recognized registrar is middleware, wherever it comes from.
  const foreign = children.length === 0
    && (await Promise.all(call.arguments.map(argument => foreignRouter(argument, routing)))).some(Boolean)
  const blocks = hidden || foreign || (prefix === undefined ? children.length > 0 : children.length === 0 && call.arguments.length > 1)
  if (!blocks) return []
  const parts = await routing.context.urlParts(call.arguments[0]!)
  return blocked(place, prefix ?? readablePrefix(parts), '*', call, routing)
}

async function registrationEndpoints(registration: Registration, routing: Routing): Promise<Placed[]> {
  const placed: Placed[] = []
  for (const place of placements(registration.declaration, registration.call, routing)) {
    placed.push(...await (mounting(registration) ? mountCall : routeCall)(registration, place, routing))
  }
  return placed
}

/**
 * The endpoints the sources' routers serve, with the placement that orders them; an ordered entry the
 * scan cannot read blocks its paths, and a registrar handed to other code blocks from its own root.
 */
export async function routerEndpoints(
  sources: readonly Node[], calls: readonly Call[], context: RouterContext,
): Promise<Placed[]> {
  const found = await routerRegistrations(sources, calls, context)
  const partial = { ...found, context }
  const routing: Routing = { ...partial, mounts: await collectMounts(partial) }
  const placed = found.escapes.flatMap(({ reference, declaration }) => placements(declaration, reference, routing)
    .flatMap(place => blocked(place, '', '*', reference, routing)))
  for (const registration of found.registrations) placed.push(...await registrationEndpoints(registration, routing))
  return placed
}

/** `Bun.serve` on the runtime's global, or the `serve` the `bun` module exports. */
async function bunServe(call: Call, context: RouterContext): Promise<boolean> {
  const { ts } = context
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const receiver = callee.expression
    return ts.isIdentifier(receiver) && receiver.text === 'Bun' && callee.name.text === 'serve' && await context.global(receiver)
  }
  const origin = await context.importOrigin(callee)
  return origin?.module === 'bun' && origin.name === 'serve'
}

/** A route object's keys are methods, so an unknown key is not a handler. */
function serveMethod(key: string): string | undefined {
  const method = methodText(key)
  return method !== undefined && [...routeMembers.values()].includes(method) ? method : undefined
}

/**
 * A route value is one handler for every method, or an object of handlers by method. Only a value the
 * scan proves to be a function serves every method; one it cannot read claims none.
 */
async function serveRoute(route: string, value: Node, call: Call, context: RouterContext): Promise<ScanHttpEndpoint[]> {
  const path = endpointPath(route)
  const byMethod = await context.objectEntries(value)
  if (byMethod === undefined) {
    const held = await context.heldAt(value)
    const handler = typeof held === 'object' && context.ts.isFunctionLike(held.node)
    return handler ? [{ operation: await context.handlerOperation(value, call), method: '*', path }] : []
  }
  const endpoints: ScanHttpEndpoint[] = []
  for (const [key, handler] of byMethod) {
    const method = serveMethod(key)
    if (method !== undefined) endpoints.push({ operation: await context.handlerOperation(handler, call), method, path })
  }
  return endpoints
}

/** Bun.serve routes, which prefer the most specific route and so carry no order. */
export async function serveEndpoints(calls: readonly Call[], context: RouterContext): Promise<ScanHttpEndpoint[]> {
  const endpoints: ScanHttpEndpoint[] = []
  for (const call of calls) {
    const [options] = call.arguments
    if (options === undefined || !await bunServe(call, context)) continue
    const routes = await context.heldAt(options, 'routes')
    const entries = typeof routes === 'object' ? await context.objectEntries(routes.node) : undefined
    for (const [route, value] of entries ?? []) endpoints.push(...await serveRoute(route, value, call, context))
  }
  return endpoints
}
