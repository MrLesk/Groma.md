import type { ScanHttpEndpoint } from '@groma/scanner'
import ts from 'typescript'
import { methodName } from '../../http-values.ts'
import { endpointPath } from './http-paths.ts'
import {
  functionValue, instanceValue, literalText, methodFromText, objectValue, propertyName, propertyValue,
  type HttpReader,
} from './http-reads.ts'
import { requiredModule } from './http-scope.ts'

// The supported routers follow the reference ../../typescript/src/http-endpoints.ts; change both together.
// This scanner reads one file at a time, so a router mounted in another file states no path and
// reports nothing, and only routes registered beside their application are supported.

/** Route registration members shared by Express, Fastify and Hono; `all` serves every method. */
const routeMembers = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'], ['all', '*'],
])

/** A router must be mounted to serve anything; an application instance serves from the root. */
type RegistrarKind = 'app' | 'router'

interface Registrar {
  kind: RegistrarKind
  /** The path this instance adds before any mount, or undefined when it states one the scanner cannot read. */
  own: string | undefined
}

type Registrars = Map<ts.Node, Registrar>

interface Mount {
  /** The instance this mount hangs under; its own prefixes precede this one. */
  parent: ts.Node
  /** Undefined when the prefix is not literal, which leaves the routes unsupported. */
  prefix?: string
}

export interface EndpointContext {
  reader: HttpReader
  /** The operation that runs this node: the enclosing function, else the module. */
  operationAt(node: ts.Node): string
}

/** Where a constructor comes from, whether this file imports the module or requires it. */
function constructorModule(reader: HttpReader, node: ts.Node): { module: string; name: string } | undefined {
  const required = requiredModule(node)
  if (required !== undefined) return { module: required, name: 'default' }
  return reader.scope.originOf(node)
}

/** A Koa router's own prefix option; an option the scanner cannot read leaves its path unknown. */
function routerPrefix(reader: HttpReader, initializer: ts.CallExpression | ts.NewExpression): string | undefined {
  const config = initializer.arguments?.[0]
  if (config === undefined) return ''
  const options = objectValue(reader, config)
  if (options === undefined) return undefined
  const prefix = propertyValue(options, 'prefix')
  return prefix === undefined ? '' : literalText(reader, prefix)
}

/** What a constructor from one module builds; only a router states a path of its own. */
function registrarFromModule(
  reader: HttpReader, origin: { module: string; name: string },
  initializer: ts.CallExpression | ts.NewExpression,
): Registrar | undefined {
  if (origin.module === 'express') return { kind: origin.name === 'Router' ? 'router' : 'app', own: '' }
  if (origin.module === 'fastify' || origin.module === 'koa') return { kind: 'app', own: '' }
  if (origin.module === 'hono' && origin.name === 'Hono') return { kind: 'app', own: '' }
  if (origin.module === '@koa/router' || origin.module === 'koa-router') {
    return { kind: 'router', own: routerPrefix(reader, initializer) }
  }
  return undefined
}

/** Recognize an instance by the module its constructor comes from, never by the members it offers. */
function registrarOf(reader: HttpReader, initializer: ts.Expression): Registrar | undefined {
  if (!ts.isCallExpression(initializer) && !ts.isNewExpression(initializer)) return undefined
  const callee = initializer.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const holder = constructorModule(reader, callee.expression)
    return holder?.module === 'express' && callee.name.text === 'Router' ? { kind: 'router', own: '' } : undefined
  }
  const origin = constructorModule(reader, callee)
  return origin === undefined ? undefined : registrarFromModule(reader, origin, initializer)
}

function collectRegistrars(reader: HttpReader, source: ts.SourceFile): Registrars {
  const registrars: Registrars = new Map()
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)
      && !reader.scope.reassigns(node.name.text)) {
      const registrar = registrarOf(reader, node.initializer)
      if (registrar !== undefined) registrars.set(node, registrar)
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
  return registrars
}

/**
 * `router.prefix('/api')` states the router's own path. A second prefix statement replaces the first
 * at runtime, and which one runs last is not a fact one file states, so the path becomes unknown.
 */
function applyPrefixCalls(reader: HttpReader, calls: readonly ts.CallExpression[], registrars: Registrars): void {
  for (const call of calls) {
    const callee = call.expression
    if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'prefix') continue
    const declaration = receiverDeclaration(reader, call, registrars)
    const registrar = declaration === undefined ? undefined : registrars.get(declaration)
    if (declaration === undefined || registrar === undefined) continue
    const stated = literalText(reader, call.arguments[0])
    registrars.set(declaration, { ...registrar, own: registrar.own === '' ? stated : undefined })
  }
}

/** The registrar a call is made on, when the file declares it. */
function receiverDeclaration(reader: HttpReader, call: ts.CallExpression, registrars: Registrars): ts.Node | undefined {
  const receiver = ts.isPropertyAccessExpression(call.expression) ? call.expression.expression : undefined
  if (receiver === undefined || !ts.isIdentifier(receiver)) return undefined
  const declaration = reader.scope.declarationOf(receiver)
  return declaration !== undefined && registrars.has(declaration) ? declaration : undefined
}

/** The instance a mount argument names: the router itself, or the routes a Koa router exposes. */
function mountedRegistrar(reader: HttpReader, node: ts.Expression, registrars: Registrars): ts.Node | undefined {
  const named = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'routes' ? node.expression.expression : node
  if (!ts.isIdentifier(named)) return undefined
  const declaration = reader.scope.declarationOf(named)
  return declaration !== undefined && registrars.has(declaration) ? declaration : undefined
}

/**
 * `use('/api', router)`, `route('/v1', child)` and `use(child.routes())` mount one instance. Only a
 * first argument the mounted instance does not occupy states a prefix.
 */
function mountEntries(
  reader: HttpReader, call: ts.CallExpression, registrars: Registrars,
): { child: ts.Node; mount: Mount }[] {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee)) return []
  const member = callee.name.text
  if (member !== 'use' && member !== 'route') return []
  // An unrecognized host, such as `createApp().use('/api', router)`, hides its own prefix.
  const parent = receiverDeclaration(reader, call, registrars)
  if (parent === undefined) return []
  const entries: { child: ts.Node; mount: Mount }[] = []
  for (const [index, argument] of call.arguments.entries()) {
    const child = mountedRegistrar(reader, argument, registrars)
    if (child === undefined) continue
    const prefix = index === 0 ? '' : literalText(reader, call.arguments[0])
    entries.push({ child, mount: { parent, ...(prefix === undefined ? {} : { prefix }) } })
  }
  return entries
}

function collectMounts(
  reader: HttpReader, calls: readonly ts.CallExpression[], registrars: Registrars,
): Map<ts.Node, Mount[]> {
  const mounts = new Map<ts.Node, Mount[]>()
  for (const call of calls) {
    for (const entry of mountEntries(reader, call, registrars)) {
      mounts.set(entry.child, [...mounts.get(entry.child) ?? [], entry.mount])
    }
  }
  return mounts
}

/** Where this instance hangs, before its own path: the root for an application, its mounts for a router. */
function mountBases(
  declaration: ts.Node, registrars: Registrars, mounts: Map<ts.Node, Mount[]>, seen: ReadonlySet<ts.Node>,
): string[] | undefined {
  const entries = mounts.get(declaration)
  if (entries === undefined || entries.length === 0) {
    return registrars.get(declaration)?.kind === 'router' ? undefined : ['']
  }
  const bases: string[] = []
  for (const entry of entries) {
    // Each mount is its own branch, so a second mount of the same instance is not a cycle.
    const parents = entry.prefix === undefined
      ? undefined : mountPrefixes(entry.parent, registrars, mounts, new Set([...seen, declaration]))
    if (parents === undefined) return undefined
    bases.push(...parents.map(parent => `${parent}/${entry.prefix}`))
  }
  return bases
}

/** Every path this instance serves under, or undefined when a mount or its own path is unknown. */
function mountPrefixes(
  declaration: ts.Node, registrars: Registrars, mounts: Map<ts.Node, Mount[]>, seen: ReadonlySet<ts.Node> = new Set(),
): string[] | undefined {
  const registrar = registrars.get(declaration)
  if (registrar === undefined || registrar.own === undefined || seen.has(declaration)) return undefined
  const bases = mountBases(declaration, registrars, mounts, seen)
  return bases === undefined ? undefined : [...new Set(bases.map(base => `${base}/${registrar.own}`))]
}

function endpointsFor(
  prefixes: readonly string[], route: string, methods: readonly string[], operation: string,
): ScanHttpEndpoint[] {
  const endpoints: ScanHttpEndpoint[] = []
  for (const prefix of prefixes) {
    const path = endpointPath(`${prefix}/${route}`)
    if (path === undefined) continue
    for (const method of methods) endpoints.push({ operation, method, path })
  }
  return endpoints
}

/** The operation a handler names, or the one that registers the route when the handler is unresolved. */
function handlerOperation(context: EndpointContext, handler: ts.Node | undefined, registration: ts.Node): string {
  const target = handler === undefined ? undefined : functionValue(context.reader, handler)
  return context.operationAt(target ?? registration)
}

function methodList(reader: HttpReader, node: ts.Node | undefined): string[] {
  if (node === undefined) return []
  const values = ts.isArrayLiteralExpression(node) ? [...node.elements] : [node]
  const methods = values.map(value => methodName(reader, value))
  return methods.every(method => method !== undefined) ? methods as string[] : []
}

/** Fastify's `route({ method, url, handler })` form. */
function routeOptions(
  context: EndpointContext, call: ts.CallExpression, prefixes: readonly string[],
): ScanHttpEndpoint[] {
  const options = objectValue(context.reader, call.arguments[0])
  if (options === undefined) return []
  const url = literalText(context.reader, propertyValue(options, 'url'))
  const methods = methodList(context.reader, propertyValue(options, 'method'))
  if (url === undefined || methods.length === 0) return []
  return endpointsFor(prefixes, url, methods, handlerOperation(context, propertyValue(options, 'handler'), call))
}

/**
 * The path a registration states. Some routers accept `get(name, path, handler)`, where the first
 * argument names the route, so a value that is not a path is never taken for one.
 */
function routePattern(reader: HttpReader, call: ts.CallExpression): string | undefined {
  const stated = literalText(reader, call.arguments[0])
  if (stated === undefined) return undefined
  if (stated.startsWith('/')) return stated
  const named = literalText(reader, call.arguments[1])
  return named?.startsWith('/') === true ? named : undefined
}

/** A registration needs its own handler: `app.get('name')` alone reads a setting. */
function routeEndpoints(
  context: EndpointContext, call: ts.CallExpression, registrars: Registrars, mounts: Map<ts.Node, Mount[]>,
): ScanHttpEndpoint[] {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee)) return []
  const declaration = receiverDeclaration(context.reader, call, registrars)
  if (declaration === undefined) return []
  const prefixes = mountPrefixes(declaration, registrars, mounts)
  if (prefixes === undefined) return []
  if (callee.name.text === 'route' && call.arguments.length === 1) return routeOptions(context, call, prefixes)
  const method = routeMembers.get(callee.name.text)
  if (method === undefined || call.arguments.length < 2) return []
  const route = routePattern(context.reader, call)
  if (route === undefined) return []
  const handler = call.arguments[call.arguments.length - 1]
  return endpointsFor(prefixes, route, [method], handlerOperation(context, handler, call))
}

/** `Bun.serve` on the runtime global, or the `serve` the `bun` module exports. */
function isBunServe(reader: HttpReader, call: ts.CallExpression): boolean {
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const receiver = callee.expression
    return ts.isIdentifier(receiver) && receiver.text === 'Bun' && callee.name.text === 'serve'
      && reader.scope.declarationOf(receiver) === undefined
  }
  return ts.isIdentifier(callee) && callee.text === 'serve' && reader.scope.originOf(callee)?.module === 'bun'
}

/** A route object's keys are methods, so an unknown key is not a handler. */
function serveMethod(key: string | undefined): string | undefined {
  const method = methodFromText(key)
  return method !== undefined && [...routeMembers.values()].includes(method) ? method : undefined
}

function methodHandlers(
  context: EndpointContext, route: string, byMethod: ts.ObjectLiteralExpression, call: ts.CallExpression,
): ScanHttpEndpoint[] {
  const endpoints: ScanHttpEndpoint[] = []
  for (const property of byMethod.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const method = serveMethod(propertyName(property))
    if (method === undefined) continue
    endpoints.push(...endpointsFor([''], route, [method], handlerOperation(context, property.initializer, call)))
  }
  return endpoints
}

/**
 * A route value is one handler for every method, or an object of handlers by method. An object the
 * scanner cannot read, such as one a spread fills, claims no method at all.
 */
function serveRoute(
  context: EndpointContext, route: string, value: ts.Expression, call: ts.CallExpression,
): ScanHttpEndpoint[] {
  const resolved = ts.isObjectLiteralExpression(value) ? value : instanceValue(context.reader, value)
  if (resolved !== undefined && ts.isObjectLiteralExpression(resolved)) {
    const byMethod = objectValue(context.reader, resolved)
    return byMethod === undefined ? [] : methodHandlers(context, route, byMethod, call)
  }
  return endpointsFor([''], route, ['*'], handlerOperation(context, value, call))
}

function serveEndpoints(context: EndpointContext, call: ts.CallExpression): ScanHttpEndpoint[] {
  if (!isBunServe(context.reader, call)) return []
  const options = objectValue(context.reader, call.arguments[0])
  const routes = options === undefined ? undefined : objectValue(context.reader, propertyValue(options, 'routes'))
  if (routes === undefined) return []
  const endpoints: ScanHttpEndpoint[] = []
  for (const property of routes.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const route = propertyName(property)
    if (route !== undefined) endpoints.push(...serveRoute(context, route, property.initializer, call))
  }
  return endpoints
}

/** Endpoints this file serves; an unsupported route, prefix or mount reports nothing. */
export function httpEndpoints(
  context: EndpointContext, source: ts.SourceFile, calls: readonly ts.CallExpression[],
): ScanHttpEndpoint[] {
  const registrars = collectRegistrars(context.reader, source)
  applyPrefixCalls(context.reader, calls, registrars)
  const mounts = collectMounts(context.reader, calls, registrars)
  const endpoints: ScanHttpEndpoint[] = []
  for (const call of calls) {
    endpoints.push(...routeEndpoints(context, call, registrars, mounts))
    endpoints.push(...serveEndpoints(context, call))
  }
  return endpoints
}
