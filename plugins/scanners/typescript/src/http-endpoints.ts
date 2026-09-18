import type { ScanHttpEndpoint } from '@groma/scanner'
import {
  isArrayLiteralExpression, isCallExpression, isClassDeclaration, isDecorator, isIdentifier,
  isMethodDeclaration, isNewExpression, isObjectLiteralExpression, isPropertyAccessExpression,
  isPropertyAssignment, isVariableDeclaration,
  type CallExpression, type Node, type SourceFile,
} from 'typescript/unstable/ast'

import { endpointPath } from './http-paths.ts'
import {
  declarationOf, importOrigin, literalText, methodName, objectValue, propertyName, propertyValue,
  type HttpContext,
} from './http-values.ts'

/** Route registration members shared by Express, Fastify and Hono; `all` serves every method. */
const routeMembers = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'], ['all', '*'],
])

/** NestJS method decorators from `@nestjs/common`. */
const controllerMembers = new Map([
  ['Get', 'GET'], ['Post', 'POST'], ['Put', 'PUT'], ['Patch', 'PATCH'],
  ['Delete', 'DELETE'], ['Head', 'HEAD'], ['Options', 'OPTIONS'], ['All', '*'],
])

/** A router must be mounted to serve anything; an application instance serves from the root. */
type RegistrarKind = 'app' | 'router'
type Registrars = Map<Node, RegistrarKind>

interface Mount {
  /** The instance this mount hangs under; its own prefixes precede this one. */
  parent: Node
  /** Undefined when the prefix is not literal, which leaves the routes unsupported. */
  prefix?: string
}

function walk(node: Node, visitor: (node: Node) => void): void {
  visitor(node)
  node.forEachChild(child => walk(child, visitor))
}

/** Recognize an instance by the module its constructor comes from, not by its type. */
function registrarKind(initializer: Node): RegistrarKind | undefined {
  if (!isCallExpression(initializer) && !isNewExpression(initializer)) return undefined
  const callee = initializer.expression
  if (isPropertyAccessExpression(callee)) {
    return importOrigin(callee.expression)?.module === 'express' && callee.name.text === 'Router' ? 'router' : undefined
  }
  const origin = importOrigin(callee)
  if (origin === undefined) return undefined
  if (origin.module === 'express') return origin.name === 'Router' ? 'router' : 'app'
  if (origin.module === 'fastify') return 'app'
  return origin.module === 'hono' && origin.name === 'Hono' ? 'app' : undefined
}

function collectRegistrars(sources: readonly SourceFile[]): Registrars {
  const registrars: Registrars = new Map()
  for (const source of sources) {
    walk(source, node => {
      if (!isVariableDeclaration(node) || !node.initializer) return
      const kind = registrarKind(node.initializer)
      if (kind !== undefined) registrars.set(node, kind)
    })
  }
  return registrars
}

/** `use('/api', router)` and `route('/v1', child)` mount one instance under a prefix. */
async function mountOf(call: CallExpression, context: HttpContext): Promise<{ child: Node; prefix?: string } | undefined> {
  const callee = call.expression
  if (!isPropertyAccessExpression(callee)) return undefined
  const member = callee.name.text
  if ((member !== 'use' && member !== 'route') || call.arguments.length < 2) return undefined
  return { child: call.arguments[1]!, prefix: await literalText(call.arguments[0], context) }
}

/** The registrar a call is made on, when the scan knows it. */
async function receiverDeclaration(
  call: CallExpression, registrars: Registrars, context: HttpContext,
): Promise<Node | undefined> {
  const receiver = isPropertyAccessExpression(call.expression) ? call.expression.expression : undefined
  if (receiver === undefined || !isIdentifier(receiver)) return undefined
  const declaration = await declarationOf(receiver, context.checker)
  return declaration !== undefined && registrars.has(declaration) ? declaration : undefined
}

async function mountEntry(
  call: CallExpression, registrars: Registrars, context: HttpContext,
): Promise<{ child: Node; mount: Mount } | undefined> {
  const mount = await mountOf(call, context)
  if (mount === undefined || !isIdentifier(mount.child)) return undefined
  const child = await declarationOf(mount.child, context.checker)
  if (child === undefined || !registrars.has(child)) return undefined
  // An unrecognized host, such as `createApp().use('/api', router)`, hides its own prefix.
  const parent = await receiverDeclaration(call, registrars, context)
  if (parent === undefined) return undefined
  return { child, mount: { parent, ...(mount.prefix === undefined ? {} : { prefix: mount.prefix }) } }
}

async function collectMounts(
  calls: readonly CallExpression[], registrars: Registrars, context: HttpContext,
): Promise<Map<Node, Mount[]>> {
  const mounts = new Map<Node, Mount[]>()
  for (const call of calls) {
    const entry = await mountEntry(call, registrars, context)
    if (entry === undefined) continue
    mounts.set(entry.child, [...mounts.get(entry.child) ?? [], entry.mount])
  }
  return mounts
}

/** Every path this instance serves under, or undefined when a mount is unknown. */
function mountPrefixes(
  declaration: Node, registrars: Registrars, mounts: Map<Node, Mount[]>, seen: ReadonlySet<Node> = new Set(),
): string[] | undefined {
  if (seen.has(declaration)) return undefined
  const entries = mounts.get(declaration)
  if (entries === undefined || entries.length === 0) {
    return registrars.get(declaration) === 'router' ? undefined : ['']
  }
  const prefixes: string[] = []
  for (const entry of entries) {
    // Each mount is its own branch, so a second mount of the same instance is not a cycle.
    const parents = entry.prefix === undefined
      ? undefined : mountPrefixes(entry.parent, registrars, mounts, new Set([...seen, declaration]))
    if (parents === undefined) return undefined
    prefixes.push(...parents.map(parent => `${parent}/${entry.prefix}`))
  }
  return [...new Set(prefixes)]
}

function endpointsFor(prefixes: readonly string[], route: string, methods: readonly string[], operation: string): ScanHttpEndpoint[] {
  const endpoints: ScanHttpEndpoint[] = []
  for (const prefix of prefixes) {
    const path = endpointPath(`${prefix}/${route}`)
    if (path === undefined) continue
    for (const method of methods) endpoints.push({ operation, method, path })
  }
  return endpoints
}

async function methodList(node: Node | undefined, context: HttpContext): Promise<string[]> {
  if (node === undefined) return []
  const values = isArrayLiteralExpression(node) ? [...node.elements] : [node]
  const methods = await Promise.all(values.map(async value => methodName(await literalText(value, context))))
  return methods.every(method => method !== undefined) ? methods as string[] : []
}

/** Fastify's `route({ method, url, handler })` form. */
async function routeOptions(
  call: CallExpression, prefixes: readonly string[], context: HttpContext,
): Promise<ScanHttpEndpoint[]> {
  const options = await objectValue(call.arguments[0], context)
  if (options === undefined) return []
  const url = await literalText(propertyValue(options, 'url'), context)
  const methods = await methodList(propertyValue(options, 'method'), context)
  if (url === undefined || methods.length === 0) return []
  return endpointsFor(prefixes, url, methods, await context.handlerOperation(propertyValue(options, 'handler'), call))
}

/** A registration needs its own handler: `app.get('name')` alone reads a setting. */
async function routeEndpoints(
  call: CallExpression, registrars: Registrars, mounts: Map<Node, Mount[]>, context: HttpContext,
): Promise<ScanHttpEndpoint[]> {
  const callee = call.expression
  if (!isPropertyAccessExpression(callee)) return []
  const declaration = await receiverDeclaration(call, registrars, context)
  if (declaration === undefined) return []
  const prefixes = mountPrefixes(declaration, registrars, mounts)
  if (prefixes === undefined) return []
  if (callee.name.text === 'route' && call.arguments.length === 1) return routeOptions(call, prefixes, context)
  const method = routeMembers.get(callee.name.text)
  if (method === undefined || call.arguments.length < 2) return []
  const route = await literalText(call.arguments[0], context)
  if (route === undefined) return []
  const handler = call.arguments[call.arguments.length - 1]
  return endpointsFor(prefixes, route, [method], await context.handlerOperation(handler, call))
}

function decoratorCall(node: Node, name: string): CallExpression | undefined {
  const modifiers = ('modifiers' in node ? node.modifiers : undefined) as readonly Node[] | undefined
  for (const modifier of modifiers ?? []) {
    if (!isDecorator(modifier) || !isCallExpression(modifier.expression)) continue
    const callee = modifier.expression.expression
    if (isIdentifier(callee) && callee.text === name && importOrigin(callee)?.module === '@nestjs/common') {
      return modifier.expression
    }
  }
  return undefined
}

async function decoratorPath(decorator: CallExpression, context: HttpContext): Promise<string | undefined> {
  return decorator.arguments.length === 0 ? '' : literalText(decorator.arguments[0], context)
}

/** One controller method serves every route its decorators declare. */
async function controllerMethod(member: Node, prefix: string, context: HttpContext): Promise<ScanHttpEndpoint[]> {
  if (!isMethodDeclaration(member) || !member.body) return []
  const endpoints: ScanHttpEndpoint[] = []
  for (const [name, method] of controllerMembers) {
    const decorator = decoratorCall(member, name)
    const route = decorator === undefined ? undefined : await decoratorPath(decorator, context)
    if (route === undefined) continue
    endpoints.push(...endpointsFor([prefix], route, [method], await context.handlerOperation(member, member)))
  }
  return endpoints
}

async function controllerEndpoints(source: SourceFile, context: HttpContext): Promise<ScanHttpEndpoint[]> {
  const endpoints: ScanHttpEndpoint[] = []
  for (const statement of source.statements) {
    if (!isClassDeclaration(statement)) continue
    const controller = decoratorCall(statement, 'Controller')
    const prefix = controller === undefined ? undefined : await decoratorPath(controller, context)
    if (prefix === undefined) continue
    for (const member of statement.members) endpoints.push(...await controllerMethod(member, prefix, context))
  }
  return endpoints
}

function isBunServe(call: CallExpression): boolean {
  const callee = call.expression
  if (isPropertyAccessExpression(callee)) {
    return isIdentifier(callee.expression) && callee.expression.text === 'Bun' && callee.name.text === 'serve'
  }
  return isIdentifier(callee) && callee.text === 'serve' && importOrigin(callee)?.module === 'bun'
}

/**
 * A route value is one handler for every method, or an object of handlers by method. A value the
 * scan cannot read, such as a spread of handlers, claims no method at all.
 */
async function serveRoute(
  route: string, value: Node, call: CallExpression, context: HttpContext,
): Promise<ScanHttpEndpoint[]> {
  const byMethod = await objectValue(value, context)
  if (byMethod === undefined) {
    const values = await context.values(value)
    const readable = values?.length === 1 && !isObjectLiteralExpression(values[0]!)
    return readable ? endpointsFor([''], route, ['*'], await context.handlerOperation(value, call)) : []
  }
  const endpoints: ScanHttpEndpoint[] = []
  for (const property of byMethod.properties) {
    const method = isPropertyAssignment(property) ? serveMethod(propertyName(property)) : undefined
    if (method === undefined || !isPropertyAssignment(property)) continue
    endpoints.push(...endpointsFor([''], route, [method], await context.handlerOperation(property.initializer, call)))
  }
  return endpoints
}

/** A route object's keys are methods, so an unknown key is not a handler. */
function serveMethod(key: string | undefined): string | undefined {
  const method = methodName(key)
  return method !== undefined && [...routeMembers.values()].includes(method) ? method : undefined
}

async function serveEndpoints(call: CallExpression, context: HttpContext): Promise<ScanHttpEndpoint[]> {
  if (!isBunServe(call)) return []
  const options = await objectValue(call.arguments[0], context)
  const routes = options === undefined ? undefined : await objectValue(propertyValue(options, 'routes'), context)
  if (routes === undefined) return []
  const endpoints: ScanHttpEndpoint[] = []
  for (const property of routes.properties) {
    const route = isPropertyAssignment(property) ? propertyName(property) : undefined
    if (route === undefined || !isPropertyAssignment(property)) continue
    endpoints.push(...await serveRoute(route, property.initializer, call, context))
  }
  return endpoints
}

/** Endpoints the supported frameworks serve; an unsupported route or mount reports nothing. */
export async function httpEndpoints(
  sources: readonly SourceFile[], calls: readonly CallExpression[], context: HttpContext,
): Promise<ScanHttpEndpoint[]> {
  const registrars = collectRegistrars(sources)
  const mounts = await collectMounts(calls, registrars, context)
  const endpoints: ScanHttpEndpoint[] = []
  for (const call of calls) {
    endpoints.push(...await routeEndpoints(call, registrars, mounts, context))
    endpoints.push(...await serveEndpoints(call, context))
  }
  for (const source of sources) endpoints.push(...await controllerEndpoints(source, context))
  return endpoints
}
