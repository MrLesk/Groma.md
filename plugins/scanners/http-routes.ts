import type { ScanHttpEndpoint } from '@groma/scanner'
import { below, type Placed, type Placement } from './http-order.ts'
import { blockedPath, endpointPath, readablePrefix } from './http-paths.ts'
import {
  atTopLevel, entryStart, mounting, orderedFrameworks, routeMembers, routeMethod, routerRegistrations, unreadHonoMembers,
  type Call, type Registrar, type Registration, type Registrations, type RouterContext,
} from './http-routers.ts'
import type { Node } from './http-syntax.ts'
import { methodText } from './http-url.ts'
import { declarationOf, heldAt, importOrigin, literalText, objectEntries, runtimeGlobal, urlParts } from './http-values.ts'

/*
 * The endpoints the registrations ./http-routers.ts finds serve, placed where their registrar is
 * mounted and ranked in the order they run, and Bun.serve routes, for every TypeScript-family compiler.
 */

interface Mount {
  /** The registration on the parent instance. */
  registration: Registration
  /** Undefined when the prefix is not literal, which leaves the mounted routes unknown. */
  prefix?: string
  /** The registrar's place among those the call mounts, which are tried in that order. */
  position: number
}

/** What one `use` or `route` call mounts, read once. */
interface MountCall {
  /** The recognized registrars among its arguments. */
  children: Node[]
  /** The path it states: empty when it states none, undefined when computed. */
  prefix?: string
  /** Whether it may serve anything below its prefix, which blocks that path in its place. */
  blocks: boolean
}

interface Routing extends Registrations {
  mounts: Map<Node, Mount[]>
  calls: Map<Registration, MountCall>
  context: RouterContext
}

type Reading = Omit<Routing, 'mounts' | 'calls'>

/** A mounted instance: the router itself, or the routes a Koa router exposes through `routes()`. */
async function registrarArgument(reading: Reading, argument: Node): Promise<Node | undefined> {
  const { ts } = reading.context
  const named = ts.isCallExpression(argument) && ts.isPropertyAccessExpression(argument.expression)
    && argument.expression.name.text === 'routes' ? argument.expression.expression : argument
  if (!ts.isIdentifier(named)) return undefined
  const declaration = await declarationOf(reading.context, named)
  return declaration !== undefined && reading.registrars.has(declaration) ? declaration : undefined
}

/**
 * A router the scan cannot follow: the `routes()` of one it does not recognize, or a name loaded from
 * a relative module, which is the application's own code rather than a package's middleware, unless
 * the scan sees it is a function, which is middleware.
 */
async function foreignRouter(reading: Reading, argument: Node): Promise<boolean> {
  const { context } = reading
  const { ts } = context
  if (await registrarArgument(reading, argument) !== undefined) return false
  if (ts.isCallExpression(argument) && ts.isPropertyAccessExpression(argument.expression)) {
    return argument.expression.name.text === 'routes'
  }
  const origin = await importOrigin(context, argument)
  if (origin?.module.startsWith('.') !== true) return false
  return !await seenFunction(context, argument)
}

/** Whether the scan sees that the argument holds a function. */
async function seenFunction(context: RouterContext, argument: Node): Promise<boolean> {
  const held = await heldAt(context, argument)
  return typeof held === 'object' && context.ts.isFunctionLike(held.node)
}

/** Middleware: a function the scan sees, or a handler a package provides, such as `express.json()` or `cors()`. */
async function middleware(context: RouterContext, argument: Node): Promise<boolean> {
  const { ts } = context
  if (await seenFunction(context, argument)) return true
  const callee = ts.isCallExpression(argument) ? argument.expression : argument
  const holder = ts.isPropertyAccessExpression(callee) ? callee.expression : callee
  const origin = await importOrigin(context, holder)
  return origin !== undefined && !origin.module.startsWith('.')
}

/**
 * Whether a `use` call under a path only adds middleware. An Express or Koa `use` can also mount a router, so
 * only when the scan sees that every handler is a function.
 */
async function onlyMiddleware(reading: Reading, registration: Registration, handlers: readonly Node[]): Promise<boolean> {
  if (registration.member !== 'use') return false
  return (await Promise.all(handlers.map(handler => seenFunction(reading.context, handler)))).every(Boolean)
}

/**
 * What a `use` or `route` call mounts: the recognized registrars among its arguments, under the path
 * its first argument states, or under no path when the first argument is itself a registrar or a
 * handler, such as `app.use(requireAuth, api)`. A call that only adds middleware mounts nothing. A mount
 * the scan cannot follow blocks: its prefix is not literal, what it mounts under a path is neither a
 * recognized registrar nor middleware, a mounted router states an own path the scan cannot read, or it
 * mounts only a router the scan cannot follow, with or without a path.
 */
async function readMount(reading: Reading, registration: Registration): Promise<MountCall> {
  const [first, ...rest] = registration.call.arguments
  const nothing = { children: [], prefix: '', blocks: false }
  if (first === undefined) return nothing
  const leading = await registrarArgument(reading, first)
  const pathless = leading !== undefined || await foreignRouter(reading, first) || await middleware(reading.context, first)
  if (!pathless && await onlyMiddleware(reading, registration, rest)) return nothing
  const children = leading === undefined ? [] : [leading]
  for (const argument of rest) {
    const child = await registrarArgument(reading, argument)
    if (child !== undefined) children.push(child)
  }
  const prefix = pathless ? '' : await literalText(reading.context, first)
  // A handler next to a recognized registrar is middleware, wherever it comes from.
  const foreign = children.length === 0
    && (await Promise.all(registration.call.arguments.map(argument => foreignRouter(reading, argument)))).some(Boolean)
  const hidden = children.some(child => reading.registrars.get(child)!.prefix === undefined)
  const unfollowed = prefix === undefined ? children.length > 0 : !pathless && children.length === 0
  return { children, blocks: foreign || hidden || unfollowed, ...(prefix === undefined ? {} : { prefix }) }
}

async function collectMounts(reading: Reading): Promise<Pick<Routing, 'mounts' | 'calls'>> {
  const mounts = new Map<Node, Mount[]>()
  const calls = new Map<Registration, MountCall>()
  for (const registration of reading.registrations) {
    if (!mounting(registration)) continue
    const mount = await readMount(reading, registration)
    calls.set(registration, mount)
    for (const [position, child] of mount.children.entries()) {
      const entry = { registration, position, ...(mount.prefix === undefined ? {} : { prefix: mount.prefix }) }
      mounts.set(child, [...mounts.get(child) ?? [], entry])
    }
  }
  return { mounts, calls }
}

/** The registrar's own path follows where it is placed. */
function withPrefix(placement: Placement, registrar: Registrar): Placement {
  return registrar.prefix === '' ? placement : { ...placement, prefix: `${placement.prefix}/${registrar.prefix}` }
}

/**
 * Whether a mounted entry is under the mount. Hono's `route` and a Koa router's `use` copy the routes
 * the child has when the call runs, so an entry is under it only when it comes first; the others serve
 * the child's routes as they change. The copy's order is known between top-level statements of one
 * file, and for a mount in another file, which runs after the top-level statements of the file that
 * creates the child: an import finishes its module first, a circular import being the accepted exception.
 */
function underMount(routing: Routing, mount: Registration, entry: Node, child: Node): 'yes' | 'no' | 'unknown' {
  const { ts } = routing.context
  const parent = routing.registrars.get(mount.declaration)!
  const copies = (parent.framework === 'hono' && mount.member === 'route')
    || (parent.framework === 'koa' && parent.kind === 'router' && mount.member === 'use')
  if (!copies) return 'yes'
  if (mount.call.getSourceFile() !== entry.getSourceFile()) {
    return entry.getSourceFile() === child.getSourceFile() && atTopLevel(ts, entry) ? 'yes' : 'unknown'
  }
  if (!atTopLevel(ts, mount.call) || !atTopLevel(ts, entry)) return 'unknown'
  return entryStart(ts, entry) < entryStart(ts, mount.call) ? 'yes' : 'no'
}

/** Give same-named local applications distinct order identities while keeping unique names readable. */
function applicationId(routing: Routing, declaration: Node, variable: string): string {
  const file = routing.context.file(declaration)
  const namesakes = [...routing.registrars].filter(([node, registrar]) => registrar.kind === 'app'
    && registrar.variable === variable && routing.context.file(node) === file)
  return `${file}#${variable}${namesakes.length > 1 ? `@${declaration.getStart()}` : ''}`
}

/** Every place an entry serves from; an unmounted router or one with an unknown path serves nothing. */
function placements(routing: Routing, declaration: Node, entry: Node, seen: ReadonlySet<Node> = new Set()): Placement[] {
  const registrar = routing.registrars.get(declaration)!
  if (seen.has(declaration) || registrar.prefix === undefined) return []
  const entries = routing.mounts.get(declaration) ?? []
  if (entries.length === 0) {
    if (registrar.kind === 'router') return []
    const application = applicationId(routing, declaration, registrar.variable)
    const ordered = orderedFrameworks.has(registrar.framework)
    return [withPrefix({ prefix: '', application, rank: [], known: true, ordered, certain: true }, registrar)]
  }
  // A mount whose prefix is unknown blocks its parent's paths instead of placing these routes.
  return entries.flatMap(({ registration, prefix, position }) => {
    const under = prefix === undefined ? 'no' : underMount(routing, registration, entry, declaration)
    if (under === 'no') return []
    return placements(routing, registration.declaration, registration.call, new Set([...seen, declaration])).map(parent => {
      const at = below(parent, prefix!, routing.indices.get(registration.call), position)
      return { ...withPrefix(at, registrar), certain: parent.certain && under === 'yes' }
    })
  })
}

async function methodList(context: RouterContext, node: Node | undefined): Promise<string[]> {
  if (node === undefined) return []
  const values = context.ts.isArrayLiteralExpression(node) ? [...node.elements] : [node]
  const methods = await Promise.all(values.map(async value => methodText(await literalText(context, value))))
  return methods.every(method => method !== undefined) ? methods as string[] : []
}

/**
 * A route entry the scan sees but cannot read, a registration or a hand-off `entry`, still occupies its
 * place in an application that takes the first registered match: it is reported as its known prefix and
 * a remainder that may or may not match.
 */
function blocked(routing: Routing, placement: Placement, prefix: string, method: string, entry: Node): Placed[] {
  if (!placement.ordered) return []
  const at = below(placement, prefix, routing.indices.get(entry))
  const operation = routing.context.callerOperation(entry)
  return [{ endpoint: { operation, method, path: blockedPath(at.prefix) }, placement: at }]
}

/** Hono's trailing `*` also matches the path without it. A route that may not be there only blocks its path. */
function served(
  routing: Routing, placement: Placement, route: string, methods: readonly string[], operation: string, registration: Registration,
): Placed[] {
  if (!placement.certain) return methods.flatMap(method => blocked(routing, placement, route, method, registration.call))
  const at = below(placement, route, routing.indices.get(registration.call))
  const path = endpointPath(at.prefix, routing.registrars.get(registration.declaration)!.framework === 'hono')
  return methods.map(method => ({ endpoint: { operation, method, path }, placement: at }))
}

/** The expression an option object's property certainly holds. */
async function option(context: RouterContext, options: Node, name: string): Promise<Node | undefined> {
  const value = await heldAt(context, options, name)
  return typeof value === 'object' ? value.node : undefined
}

/** Fastify's `route({ method, url, handler })`, or Express's `route(path)`, whose chained handlers are not read. */
async function routeOptions(routing: Routing, registration: Registration, placement: Placement): Promise<Placed[]> {
  const { context } = routing
  const { call } = registration
  const argument = call.arguments[0]!
  const options = await heldAt(context, argument)
  if (typeof options !== 'object' || !context.ts.isObjectLiteralExpression(options.node)) {
    return blocked(routing, placement, readablePrefix(await urlParts(context, argument)), '*', call)
  }
  const url = await literalText(context, await option(context, argument, 'url'))
  const methods = await methodList(context, await option(context, argument, 'method'))
  if (url === undefined || methods.length === 0) return blocked(routing, placement, url ?? '', '*', call)
  const operation = await context.handlerOperation(await option(context, argument, 'handler'), call)
  return served(routing, placement, url, methods, operation, registration)
}

/** Hono's `on(method, path)`, `basePath(path)` and `mount(path)` block their path, read as far as it is literal. */
async function unreadCall(routing: Routing, registration: Registration, placement: Placement): Promise<Placed[]> {
  const { call, member } = registration
  const { context } = routing
  const [first, second] = call.arguments
  const path = member === 'on' ? second : first
  const prefix = path === undefined ? '' : readablePrefix(await urlParts(context, path))
  const method = member === 'on' ? methodText(await literalText(context, first)) : undefined
  return blocked(routing, placement, prefix, method ?? '*', call)
}

/**
 * Fastify's `register(plugin, { prefix })` registers the plugin's routes, which the scan does not read,
 * below its prefix. Fastify prefers the most specific route, so the block carries no order.
 */
async function registerCall(routing: Routing, registration: Registration, placement: Placement): Promise<Placed[]> {
  const { call } = registration
  const options = call.arguments[1]
  const prefix = options === undefined ? 'absent' : await heldAt(routing.context, options, 'prefix')
  const readable = typeof prefix === 'object' ? readablePrefix(await urlParts(routing.context, prefix.node)) : ''
  const at = below(placement, readable)
  return [{ endpoint: { operation: routing.context.callerOperation(call), method: '*', path: blockedPath(at.prefix) }, placement: at }]
}

/** The path argument: a Koa router also takes `get(name, path, handler)`, whose first argument names the route. */
async function pathArgument(routing: Routing, registration: Registration): Promise<Node> {
  const [first, second] = registration.call.arguments
  const named = registration.member !== 'redirect' && registration.call.arguments.length > 2
    && routing.registrars.get(registration.declaration)!.framework === 'koa'
  const name = named ? await literalText(routing.context, first) : undefined
  return name !== undefined && !name.startsWith('/') ? second! : first!
}

/**
 * A registration needs its own handler: `app.get('name')` alone reads a setting. A Koa `redirect` answers
 * at its source path, which a route name in its place leaves unknown.
 */
async function routeCall(routing: Routing, registration: Registration, placement: Placement): Promise<Placed[]> {
  const { call, member } = registration
  const framework = routing.registrars.get(registration.declaration)!.framework
  if (unreadHonoMembers.has(member)) return unreadCall(routing, registration, placement)
  if (member === 'register') return registerCall(routing, registration, placement)
  if (member === 'route' && call.arguments.length === 1) return routeOptions(routing, registration, placement)
  const method = routeMethod(member, framework)
  if (method === undefined || call.arguments.length < 2) return []
  const parts = await urlParts(routing.context, await pathArgument(routing, registration))
  const route = parts.length === 1 && parts[0]!.kind === 'text' ? parts[0]!.text : undefined
  if (route === undefined || (member === 'redirect' && !route.startsWith('/'))) {
    return blocked(routing, placement, route === undefined ? readablePrefix(parts) : '', method, call)
  }
  const handler = member === 'redirect' ? undefined : call.arguments[call.arguments.length - 1]
  return served(routing, placement, route, [method], await routing.context.handlerOperation(handler, call), registration)
}

/** A mount the scan cannot follow may serve anything below its prefix, so it blocks that path in its place. */
async function mountCall(routing: Routing, registration: Registration, placement: Placement): Promise<Placed[]> {
  const { call } = registration
  const mount = routing.calls.get(registration)!
  if (!mount.blocks) return []
  const parts = await urlParts(routing.context, call.arguments[0]!)
  return blocked(routing, placement, mount.prefix ?? readablePrefix(parts), '*', call)
}

async function registrationEndpoints(routing: Routing, registration: Registration): Promise<Placed[]> {
  const placed: Placed[] = []
  for (const placement of placements(routing, registration.declaration, registration.call)) {
    placed.push(...await (mounting(registration) ? mountCall : routeCall)(routing, registration, placement))
  }
  return placed
}

/**
 * The endpoints the sources' routers serve, with the placement that orders them; an ordered entry the
 * scan cannot read blocks its paths, and a registrar handed off to other code blocks from its own root.
 */
export async function routerEndpoints(
  context: RouterContext, sources: readonly Node[], calls: readonly Call[],
): Promise<Placed[]> {
  const reading: Reading = { ...await routerRegistrations(context, sources, calls), context }
  const routing: Routing = { ...reading, ...await collectMounts(reading) }
  const placed = routing.handOffs.flatMap(({ reference, declaration }) => placements(routing, declaration, reference)
    .flatMap(placement => blocked(routing, placement, '', '*', reference)))
  for (const registration of routing.registrations) placed.push(...await registrationEndpoints(routing, registration))
  return placed
}

/** `Bun.serve` on the runtime's global, or the `serve` the `bun` module exports. */
async function bunServe(context: RouterContext, call: Call): Promise<boolean> {
  const { ts } = context
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const receiver = callee.expression
    return ts.isIdentifier(receiver) && receiver.text === 'Bun' && callee.name.text === 'serve' && await runtimeGlobal(context, receiver)
  }
  const origin = await importOrigin(context, callee)
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
async function serveRoute(context: RouterContext, route: string, value: Node, call: Call): Promise<ScanHttpEndpoint[]> {
  const path = endpointPath(route)
  const byMethod = await objectEntries(context, value)
  if (byMethod === undefined) {
    return await seenFunction(context, value) ? [{ operation: await context.handlerOperation(value, call), method: '*', path }] : []
  }
  const endpoints: ScanHttpEndpoint[] = []
  for (const [key, handler] of byMethod) {
    const method = serveMethod(key)
    if (method !== undefined) endpoints.push({ operation: await context.handlerOperation(handler, call), method, path })
  }
  return endpoints
}

/** Bun.serve routes, which prefer the most specific route and so carry no order. */
export async function serveEndpoints(context: RouterContext, calls: readonly Call[]): Promise<ScanHttpEndpoint[]> {
  const endpoints: ScanHttpEndpoint[] = []
  for (const call of calls) {
    const [options] = call.arguments
    if (options === undefined || !await bunServe(context, call)) continue
    const routes = await heldAt(context, options, 'routes')
    const entries = typeof routes === 'object' ? await objectEntries(context, routes.node) : undefined
    for (const [route, value] of entries ?? []) endpoints.push(...await serveRoute(context, route, value, call))
  }
  return endpoints
}
