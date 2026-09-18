import type { ScanHttpEndpoint } from '@groma/scanner'
import {
  isArrayLiteralExpression, isBinaryExpression, isCallExpression, isClassLikeDeclaration, isExportAssignment,
  isExportSpecifier, isExpressionStatement, isFunctionLikeDeclaration, isIdentifier, isNewExpression,
  isObjectLiteralExpression, isPropertyAccessExpression, isSourceFile, isVariableDeclaration, isVariableStatement,
  NodeFlags, SyntaxKind,
  type CallExpression, type Node, type SourceFile,
} from 'typescript/unstable/ast'

import { below, withOrder, type Placed, type Placement } from '../../http-order.ts'
import { blockedPath, endpointPath, readablePrefix } from '../../http-paths.ts'
import { controllerEndpoints } from './http-controllers.ts'
import {
  declarationOf, heldAt, importOrigin, literalText, methodName, objectEntries, urlParts,
  type HttpContext, type ImportOrigin,
} from './http-values.ts'

/** Route registration members shared by Express, Fastify and Hono; `all` serves every method. */
const routeMembers = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'], ['all', '*'],
])

/** Hono members that register routes the scan does not read; `basePath` returns a clone sharing its routes. */
const unreadHonoMembers = new Set(['on', 'basePath', 'mount'])

/** Express settings members that return the application; `set` with only a name reads a setting. */
const expressSettings = new Set(['set', 'enable', 'disable', 'engine'])

type Framework = 'express' | 'fastify' | 'hono'

/** A router must be mounted to serve anything; an application instance serves from the root. */
interface Registrar {
  kind: 'app' | 'router'
  framework: Framework
}

/** Express and Hono try routes in registration order; Fastify prefers the most specific route. */
const ORDERED = new Set<Framework>(['express', 'hono'])

interface Registration {
  call: CallExpression
  /** The registrar the call is made on. */
  declaration: Node
  member: string
}

/** A reference that hands a registrar to code the scan does not read, such as `registerRoutes(app)`. */
interface Escape {
  reference: Node
  declaration: Node
}

interface Mount {
  /** The registration on the parent instance. */
  registration: Registration
  /** Undefined when the prefix is not literal, which leaves the mounted routes unknown. */
  prefix?: string
  /** The registrar's place among those the call mounts, which are tried in that order. */
  position: number
}

interface Routing {
  registrars: Map<Node, Registrar>
  registrations: Registration[]
  /** Each registration's and escape's index among its registrar's, when the source proves their order. */
  indices: Map<Node, number>
  mounts: Map<Node, Mount[]>
  context: HttpContext
}

function walk(node: Node, visitor: (node: Node) => void): void {
  visitor(node)
  node.forEachChild(child => walk(child, visitor))
}

/** What a constructor imported from one module builds; a named export such as `json` builds nothing. */
function registrarFrom(origin: ImportOrigin): Registrar | undefined {
  const whole = origin.name === 'default' || origin.name === '*'
  if (origin.module === 'express') {
    if (origin.name === 'Router') return { kind: 'router', framework: 'express' }
    return whole ? { kind: 'app', framework: 'express' } : undefined
  }
  if (origin.module === 'fastify') return whole || origin.name === 'fastify' ? { kind: 'app', framework: 'fastify' } : undefined
  return origin.module === 'hono' && origin.name === 'Hono' ? { kind: 'app', framework: 'hono' } : undefined
}

/** Recognize an instance by the module its constructor comes from, not by its type. */
async function registrarOf(initializer: Node, context: HttpContext): Promise<Registrar | undefined> {
  if (!isCallExpression(initializer) && !isNewExpression(initializer)) return undefined
  const callee = initializer.expression
  if (isPropertyAccessExpression(callee)) {
    const holder = await importOrigin(callee.expression, context.checker)
    return holder?.module === 'express' && callee.name.text === 'Router' ? { kind: 'router', framework: 'express' } : undefined
  }
  const origin = await importOrigin(callee, context.checker)
  return origin === undefined ? undefined : registrarFrom(origin)
}

/** A reassignable instance could be another at runtime, so only a `const` names a registrar. */
async function collectRegistrars(sources: readonly SourceFile[], context: HttpContext): Promise<Map<Node, Registrar>> {
  const declarations: Node[] = []
  for (const source of sources) {
    walk(source, node => {
      if (isVariableDeclaration(node) && node.initializer && isIdentifier(node.name) && node.parent.flags & NodeFlags.Const) {
        declarations.push(node)
      }
    })
  }
  const registrars = new Map<Node, Registrar>()
  for (const declaration of declarations) {
    const registrar = isVariableDeclaration(declaration) && declaration.initializer
      ? await registrarOf(declaration.initializer, context) : undefined
    if (registrar !== undefined) registrars.set(declaration, registrar)
  }
  return registrars
}

function memberOf(call: CallExpression): string | undefined {
  return isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined
}

function registers(member: string, framework: Framework): boolean {
  if (unreadHonoMembers.has(member)) return framework === 'hono'
  return routeMembers.has(member) || member === 'use' || member === 'route'
}

/** The registrar a call is made on, when the scan knows it. */
async function receiverDeclaration(
  call: CallExpression, registrars: Map<Node, Registrar>, context: HttpContext,
): Promise<Node | undefined> {
  const receiver = isPropertyAccessExpression(call.expression) ? call.expression.expression : undefined
  if (receiver !== undefined && isCallExpression(receiver)) return chainedDeclaration(receiver, registrars, context)
  if (receiver === undefined || !isIdentifier(receiver)) return undefined
  const declaration = await declarationOf(receiver, context.checker)
  return declaration !== undefined && registrars.has(declaration) ? declaration : undefined
}

/**
 * A registration returns its registrar, and so do Express's settings calls. Express's `route(path)`
 * returns a route builder and Hono's `basePath` a clone, whose calls the scan does not read.
 */
function returnsRegistrar(call: CallExpression, member: string, framework: Framework): boolean {
  if (framework === 'express' && expressSettings.has(member)) return member !== 'set' || call.arguments.length > 1
  const builder = (member === 'route' && framework === 'express') || member === 'basePath'
  return registers(member, framework) && !builder
}

/** A call chained on a call that returns its registrar is made on the same registrar. */
async function chainedDeclaration(
  call: CallExpression, registrars: Map<Node, Registrar>, context: HttpContext,
): Promise<Node | undefined> {
  const member = memberOf(call)
  const declaration = member === undefined ? undefined : await receiverDeclaration(call, registrars, context)
  if (member === undefined || declaration === undefined) return undefined
  return returnsRegistrar(call, member, registrars.get(declaration)!.framework) ? declaration : undefined
}

async function collectRegistrations(
  calls: readonly CallExpression[], registrars: Map<Node, Registrar>, context: HttpContext,
): Promise<Registration[]> {
  const registrations: Registration[] = []
  for (const call of calls) {
    const member = memberOf(call)
    // Hono registers through every member the other frameworks do, and more.
    if (member === undefined || !registers(member, 'hono')) continue
    const declaration = await receiverDeclaration(call, registrars, context)
    if (declaration !== undefined && registers(member, registrars.get(declaration)!.framework)) {
      registrations.push({ call, declaration, member })
    }
  }
  return registrations
}

function mounting(registration: Registration): boolean {
  return registration.member === 'use' || (registration.member === 'route' && registration.call.arguments.length > 1)
}

/**
 * A node a top-level statement runs once, in source order, when its module loads: outside any function
 * or class, in an expression or variable statement.
 */
function atTopLevel(node: Node): boolean {
  let current = node
  while (!isSourceFile(current.parent)) {
    current = current.parent
    if (isFunctionLikeDeclaration(current) || isClassLikeDeclaration(current)) return false
  }
  return isExpressionStatement(current) || isVariableStatement(current)
}

/** Any use but a member use, an export, or a mount the scan reads hands the registrar on. */
function handedOn(reference: Node, mounts: ReadonlySet<Node>): boolean {
  const parent = reference.parent
  if (isPropertyAccessExpression(parent) && parent.expression === reference) return false
  if (isExportAssignment(parent) || isExportSpecifier(parent)) return false
  return !mounts.has(parent)
}

/** Node's HTTP modules, whose `createServer(app)` serves an application. */
const httpModules = new Set(['http', 'https', 'node:http', 'node:https'])

function moduleExports(node: Node): boolean {
  return isPropertyAccessExpression(node) && isIdentifier(node.expression) && node.expression.text === 'module'
    && node.name.text === 'exports'
}

/** Serving an application registers nothing: `createServer(app)`, an imported `serve(app)`, `module.exports = app`. */
async function serving(reference: Node, context: HttpContext): Promise<boolean> {
  const parent = reference.parent
  if (isBinaryExpression(parent)) {
    return parent.right === reference && parent.operatorToken.kind === SyntaxKind.EqualsToken && moduleExports(parent.left)
  }
  if (!isCallExpression(parent) || !parent.arguments.some(argument => argument === reference)) return false
  const callee = parent.expression
  if (isPropertyAccessExpression(callee)) {
    const holder = await importOrigin(callee.expression, context.checker)
    return callee.name.text === 'createServer' && httpModules.has(holder?.module ?? '')
  }
  const origin = await importOrigin(callee, context.checker)
  if (origin === undefined) return false
  return origin.name === 'serve' || (origin.name === 'createServer' && httpModules.has(origin.module))
}

/**
 * The files whose hand-offs of a registrar count: the one that creates it and those that register on
 * it. A module's top-level statements all run when it is first imported, so another file that imports
 * the registrar runs after every top-level registration of the file it imports it from.
 */
function registeringFiles(declaration: Node, registrations: readonly Registration[]): Set<SourceFile> {
  const files = new Set([declaration.getSourceFile()])
  for (const registration of registrations) {
    if (registration.declaration === declaration) files.add(registration.call.getSourceFile())
  }
  return files
}

/**
 * The references that hand a registrar on, which may register routes where they run. One outside the
 * top level of its file runs at a time the scan does not know, which leaves its registrar's order unknown.
 */
async function collectEscapes(
  registrars: Map<Node, Registrar>, registrations: readonly Registration[], context: HttpContext,
): Promise<Escape[]> {
  const mounts = new Set<Node>(registrations.filter(mounting).map(({ call }) => call))
  const escapes: Escape[] = []
  for (const declaration of registrars.keys()) {
    const files = registeringFiles(declaration, registrations)
    for (const reference of await context.bindings.references(declaration)) {
      if (files.has(reference.getSourceFile()) && handedOn(reference, mounts) && !await serving(reference, context)) {
        escapes.push({ reference, declaration })
      }
    }
  }
  return escapes
}

/**
 * A registrar's registrations and escapes are in a proven order when every one is at the top level of
 * one file, where chained calls run in the order their member names are written; otherwise their order
 * is unknown and they share one index.
 */
function orderIndices(registrations: readonly Registration[], escapes: readonly Escape[]): Map<Node, number> {
  const entries = [
    ...registrations.map(({ call, declaration }) => ({ node: call as Node, declaration, start: memberStart(call) })),
    ...escapes.map(({ reference, declaration }) => ({ node: reference, declaration, start: reference.getStart() })),
  ]
  const byRegistrar = new Map<Node, typeof entries>()
  for (const entry of entries) byRegistrar.set(entry.declaration, [...byRegistrar.get(entry.declaration) ?? [], entry])
  const indices = new Map<Node, number>()
  for (const list of byRegistrar.values()) {
    const files = new Set(list.map(({ node }) => node.getSourceFile()))
    if (files.size !== 1 || !list.every(({ node }) => atTopLevel(node))) continue
    const sorted = [...list].sort((left, right) => left.start - right.start)
    for (const [index, { node }] of sorted.entries()) indices.set(node, index)
  }
  return indices
}

function memberStart(call: CallExpression): number {
  return isPropertyAccessExpression(call.expression) ? call.expression.name.getStart() : call.getStart()
}

async function registrarArgument(argument: Node, routing: Omit<Routing, 'mounts'>): Promise<Node | undefined> {
  if (!isIdentifier(argument)) return undefined
  const declaration = await declarationOf(argument, routing.context.checker)
  return declaration !== undefined && routing.registrars.has(declaration) ? declaration : undefined
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
  const prefix = unprefixed === undefined ? await literalText(first, routing.context) : ''
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

/** Every place this instance serves from; an unmounted router serves nothing. */
function placements(declaration: Node, routing: Routing, seen: ReadonlySet<Node> = new Set()): Placement[] {
  if (seen.has(declaration)) return []
  const registrar = routing.registrars.get(declaration)!
  const entries = routing.mounts.get(declaration) ?? []
  if (entries.length === 0) {
    if (registrar.kind === 'router') return []
    const application = routing.context.file(declaration)
    return [{ prefix: '', application, rank: [], known: true, ordered: ORDERED.has(registrar.framework) }]
  }
  // A mount whose prefix is unknown blocks its parent's paths instead of placing these routes.
  return entries.flatMap(({ registration, prefix, position }) => prefix === undefined ? [] : placements(
    registration.declaration, routing, new Set([...seen, declaration]),
  ).map(parent => {
    const at = below(parent, routing.indices.get(registration.call), prefix)
    return at.known ? { ...at, rank: [...at.rank, position] } : at
  }))
}

async function methodList(node: Node | undefined, context: HttpContext): Promise<string[]> {
  if (node === undefined) return []
  const values = isArrayLiteralExpression(node) ? [...node.elements] : [node]
  const methods = await Promise.all(values.map(async value => methodName(await literalText(value, context))))
  return methods.every(method => method !== undefined) ? methods as string[] : []
}

/**
 * A route entry the scan sees but cannot read, a registration or an escape `entry`, still occupies its
 * place in an application that takes the first registered match: it is reported as its known prefix and
 * a remainder that may or may not match.
 */
function blocked(placement: Placement, prefix: string, method: string, entry: Node, routing: Routing): Placed[] {
  if (!placement.ordered) return []
  const at = below(placement, routing.indices.get(entry), prefix)
  const operation = routing.context.callerOperation(entry)
  return [{ endpoint: { operation, method, path: blockedPath(at.prefix) }, placement: at }]
}

/** Hono's trailing `*` also matches the path without it. */
function served(placement: Placement, route: string, methods: readonly string[], operation: string, registration: Registration, routing: Routing): Placed[] {
  const at = below(placement, routing.indices.get(registration.call), route)
  const path = endpointPath(at.prefix, routing.registrars.get(registration.declaration)!.framework === 'hono')
  return methods.map(method => ({ endpoint: { operation, method, path }, placement: at }))
}

/** The expression an option object's property certainly holds. */
async function option(context: HttpContext, options: Node, name: string): Promise<Node | undefined> {
  const value = await heldAt(context, options, name)
  return typeof value === 'object' ? value.node : undefined
}

/** Fastify's `route({ method, url, handler })`, or Express's `route(path)`, whose chained handlers are not read. */
async function routeOptions(registration: Registration, placement: Placement, routing: Routing): Promise<Placed[]> {
  const { context } = routing
  const argument = registration.call.arguments[0]!
  const options = await heldAt(context, argument)
  if (typeof options !== 'object' || !isObjectLiteralExpression(options.node)) {
    return blocked(placement, readablePrefix(await urlParts(argument, context)), '*', registration.call, routing)
  }
  const url = await literalText(await option(context, argument, 'url'), context)
  const methods = await methodList(await option(context, argument, 'method'), context)
  if (url === undefined || methods.length === 0) return blocked(placement, url ?? '', '*', registration.call, routing)
  const operation = await context.handlerOperation(await option(context, argument, 'handler'), registration.call)
  return served(placement, url, methods, operation, registration, routing)
}

/** Hono's `on(method, path)`, `basePath(path)` and `mount(path)` block their path, read as far as it is literal. */
async function unreadCall(registration: Registration, placement: Placement, routing: Routing): Promise<Placed[]> {
  const { call, member } = registration
  const [first, second] = call.arguments
  const path = member === 'on' ? second : first
  const prefix = path === undefined ? '' : readablePrefix(await urlParts(path, routing.context))
  const method = member === 'on' ? methodName(await literalText(first, routing.context)) : undefined
  return blocked(placement, prefix, method ?? '*', call, routing)
}

/** A registration needs its own handler: `app.get('name')` alone reads a setting. */
async function routeCall(registration: Registration, placement: Placement, routing: Routing): Promise<Placed[]> {
  const { call, member } = registration
  if (unreadHonoMembers.has(member)) return unreadCall(registration, placement, routing)
  if (member === 'route' && call.arguments.length === 1) return routeOptions(registration, placement, routing)
  const method = routeMembers.get(member)
  if (method === undefined || call.arguments.length < 2) return []
  const parts = await urlParts(call.arguments[0]!, routing.context)
  const route = parts.length === 1 && parts[0]!.kind === 'text' ? parts[0]!.text : undefined
  if (route === undefined) return blocked(placement, readablePrefix(parts), method, call, routing)
  const operation = await routing.context.handlerOperation(call.arguments[call.arguments.length - 1], call)
  return served(placement, route, [method], operation, registration, routing)
}

/**
 * A mount the scan cannot follow, because its prefix is not literal or what it mounts under a path is
 * not a recognized registrar, may serve anything below its prefix. Middleware is not a mount: a handler
 * used without a path, or next to a recognized registrar in one call.
 */
async function mountCall(registration: Registration, placement: Placement, routing: Routing): Promise<Placed[]> {
  const { children, prefix } = await mountOf(registration, routing)
  if (prefix !== undefined && (children.length > 0 || registration.call.arguments.length < 2)) return []
  if (prefix === undefined && children.length === 0) return []
  const parts = await urlParts(registration.call.arguments[0]!, routing.context)
  return blocked(placement, prefix ?? readablePrefix(parts), '*', registration.call, routing)
}

async function registrationEndpoints(registration: Registration, routing: Routing): Promise<Placed[]> {
  const placed: Placed[] = []
  for (const placement of placements(registration.declaration, routing)) {
    placed.push(...await (mounting(registration) ? mountCall : routeCall)(registration, placement, routing))
  }
  return placed
}

/** An escape may register anything below the registrar's paths. */
function escapeEndpoints({ reference, declaration }: Escape, routing: Routing): Placed[] {
  return placements(declaration, routing).flatMap(placement => blocked(placement, '', '*', reference, routing))
}

function isBunServe(call: CallExpression, importedServe: boolean): boolean {
  const callee = call.expression
  if (isPropertyAccessExpression(callee)) {
    return isIdentifier(callee.expression) && callee.expression.text === 'Bun' && callee.name.text === 'serve'
  }
  return importedServe
}

/** A route object's keys are methods, so an unknown key is not a handler. */
function serveMethod(key: string | undefined): string | undefined {
  const method = methodName(key)
  return method !== undefined && [...routeMembers.values()].includes(method) ? method : undefined
}

/**
 * A route value is one handler for every method, or an object of handlers by method. A value the
 * scan cannot read, such as a spread of handlers, claims no method at all.
 */
async function serveRoute(route: string, value: Node, call: CallExpression, context: HttpContext): Promise<ScanHttpEndpoint[]> {
  const path = endpointPath(route)
  const byMethod = await objectEntries(value, context)
  if (byMethod === undefined) {
    const values = await context.values(value)
    const readable = values?.length === 1 && !isObjectLiteralExpression(values[0]!)
    return readable ? [{ operation: await context.handlerOperation(value, call), method: '*', path }] : []
  }
  const endpoints: ScanHttpEndpoint[] = []
  for (const [key, handler] of byMethod) {
    const method = serveMethod(key)
    if (method !== undefined) endpoints.push({ operation: await context.handlerOperation(handler, call), method, path })
  }
  return endpoints
}

async function serveEndpoints(call: CallExpression, context: HttpContext): Promise<ScanHttpEndpoint[]> {
  const callee = call.expression
  const importedServe = isIdentifier(callee) && callee.text === 'serve'
    && (await importOrigin(callee, context.checker))?.module === 'bun'
  if (!isBunServe(call, importedServe)) return []
  const options = call.arguments[0]
  const routes = options === undefined ? undefined : await objectEntries(await option(context, options, 'routes'), context)
  const endpoints: ScanHttpEndpoint[] = []
  for (const [route, value] of routes ?? []) endpoints.push(...await serveRoute(route, value, call, context))
  return endpoints
}

/** Endpoints the supported frameworks serve; an ordered entry the scan cannot read blocks its paths. */
export async function httpEndpoints(
  sources: readonly SourceFile[], calls: readonly CallExpression[], context: HttpContext,
): Promise<ScanHttpEndpoint[]> {
  const registrars = await collectRegistrars(sources, context)
  const registrations = await collectRegistrations(calls, registrars, context)
  const escapes = await collectEscapes(registrars, registrations, context)
  const partial = { registrars, registrations, indices: orderIndices(registrations, escapes), context }
  const routing: Routing = { ...partial, mounts: await collectMounts(partial) }
  const placed: Placed[] = escapes.flatMap(entry => escapeEndpoints(entry, routing))
  for (const registration of registrations) placed.push(...await registrationEndpoints(registration, routing))
  placed.push(...await controllerEndpoints(sources, calls, context))
  const endpoints = withOrder(placed)
  for (const call of calls) endpoints.push(...await serveEndpoints(call, context))
  return endpoints
}
