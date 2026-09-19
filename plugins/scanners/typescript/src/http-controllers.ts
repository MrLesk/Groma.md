import {
  isCallExpression, isClassDeclaration, isDecorator, isIdentifier, isMethodDeclaration, isNewExpression,
  isPropertyAccessExpression,
  type CallExpression, type Node, type SourceFile,
} from 'typescript/unstable/ast'

import { below, type Placed, type Placement } from '../../http-order.ts'
import { blockedPath, endpointPath, readablePrefix } from '../../http-paths.ts'
import type { RouterContext } from '../../http-routers.ts'
import { importOrigin, urlParts } from '../../http-values.ts'

/** NestJS method decorators from `@nestjs/common`. */
const controllerMembers = new Map([
  ['Get', 'GET'], ['Post', 'POST'], ['Put', 'PUT'], ['Patch', 'PATCH'],
  ['Delete', 'DELETE'], ['Head', 'HEAD'], ['Options', 'OPTIONS'], ['All', '*'],
])

interface NestApplication {
  /** The file that creates the application, when the scan sees exactly one. */
  application?: string
  /** Express, NestJS's default platform, takes the first registered match. */
  ordered: boolean
}

async function nestFactoryCreate(context: RouterContext, call: CallExpression): Promise<boolean> {
  const callee = call.expression
  if (!isPropertyAccessExpression(callee) || callee.name.text !== 'create') return false
  const origin = await importOrigin(context, callee.expression)
  return origin?.module === '@nestjs/core' && origin.name === 'NestFactory'
}

/** `NestFactory.create(AppModule, new FastifyAdapter())` serves through Fastify, which prefers the most specific route. */
async function fastifyAdapter(context: RouterContext, call: CallExpression): Promise<boolean> {
  const adapter = call.arguments[1]
  if (adapter === undefined || !isNewExpression(adapter)) return false
  return (await importOrigin(context, adapter.expression))?.module === '@nestjs/platform-fastify'
}

async function nestApplication(context: RouterContext, calls: readonly CallExpression[]): Promise<NestApplication> {
  const creations: CallExpression[] = []
  for (const call of calls) if (await nestFactoryCreate(context, call)) creations.push(call)
  const [only] = creations
  if (only === undefined || creations.length > 1) return { ordered: true }
  return { application: context.file(only), ordered: !await fastifyAdapter(context, only) }
}

async function decoratorCall(context: RouterContext, node: Node, name: string): Promise<CallExpression | undefined> {
  const modifiers = ('modifiers' in node ? node.modifiers : undefined) as readonly Node[] | undefined
  for (const modifier of modifiers ?? []) {
    if (!isDecorator(modifier) || !isCallExpression(modifier.expression)) continue
    const callee = modifier.expression.expression
    if (!isIdentifier(callee) || callee.text !== name) continue
    if ((await importOrigin(context, callee))?.module === '@nestjs/common') return modifier.expression
  }
  return undefined
}

/** A decorator's path, or undefined with the literal text it starts with when the path is computed. */
async function decoratorPath(context: RouterContext, decorator: CallExpression): Promise<{ path?: string; prefix: string }> {
  const [argument] = decorator.arguments
  if (argument === undefined) return { path: '', prefix: '' }
  const parts = await urlParts(context, argument)
  return parts.length === 1 && parts[0]!.kind === 'text' ? { path: parts[0]!.text, prefix: '' } : { prefix: readablePrefix(parts) }
}

/** One controller method serves every route its decorators declare; a computed route blocks its prefix. */
async function controllerMethod(context: RouterContext, member: Node, controller: Placement): Promise<Placed[]> {
  if (!isMethodDeclaration(member) || !member.body) return []
  const placed: Placed[] = []
  for (const [name, method] of controllerMembers) {
    const decorator = await decoratorCall(context, member, name)
    if (decorator === undefined) continue
    const { path, prefix } = await decoratorPath(context, decorator)
    const placement = below(controller, path ?? prefix)
    const operation = await context.handlerOperation(member, member)
    placed.push({ endpoint: { operation, method, path: path === undefined ? blockedPath(placement.prefix) : endpointPath(placement.prefix) }, placement })
  }
  return placed
}

/** The endpoints of one controller class; a controller whose own path is computed blocks every route below it. */
async function controllerClass(context: RouterContext, statement: Node, nest: NestApplication): Promise<Placed[]> {
  if (!isClassDeclaration(statement)) return []
  const decorator = await decoratorCall(context, statement, 'Controller')
  if (decorator === undefined) return []
  const { path, prefix } = await decoratorPath(context, decorator)
  const application = nest.application ?? context.file(statement)
  const controller: Placement = { prefix: path ?? prefix, application, rank: [], known: false, ordered: nest.ordered, certain: true }
  const placed: Placed[] = []
  for (const member of statement.members) placed.push(...await controllerMethod(context, member, controller))
  if (path !== undefined) return placed
  return placed.map(entry => ({ ...entry, endpoint: { ...entry.endpoint, path: blockedPath(prefix) } }))
}

/**
 * NestJS controller endpoints. Behind Express, NestJS registers them in an order the scan does not
 * follow across modules, so every endpoint of the application shares one position.
 */
export async function controllerEndpoints(
  context: RouterContext, sources: readonly SourceFile[], calls: readonly CallExpression[],
): Promise<Placed[]> {
  const nest = await nestApplication(context, calls)
  const placed: Placed[] = []
  for (const source of sources) {
    for (const statement of source.statements) placed.push(...await controllerClass(context, statement, nest))
  }
  return placed
}
