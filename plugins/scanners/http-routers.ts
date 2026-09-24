import { inBatches } from './http-checker.ts'
import type { Node, TextNode } from './http-syntax.ts'
import { declarationOf, heldAt, importOrigin, literalText, unassigned, type UrlCompiler, type UrlContext } from './http-values.ts'

/*
 * The routers of the TypeScript family, read the same way under every compiler: the Express, Fastify,
 * Hono and Koa instances the sources create, the calls that register routes on them, the references
 * that hand them to code the scan does not read, and the order all of those run in. The TypeScript
 * scanner reads them with the native SDK over the program, and the JavaScript scanner with the classic
 * compiler over one file. ./http-routes.ts turns them into endpoints.
 */

export interface Call extends Node { expression: Node; arguments: readonly Node[] }
interface Construction extends Node { expression: Node; arguments?: readonly Node[] }
interface Access extends Node { expression: Node; name: TextNode }
interface Variable extends Node { name: Node; initializer?: Node; parent: Node & { flags: number; parent: Node & { modifiers?: readonly { kind: number }[] } } }
interface Binary extends Node { left: Node; right: Node; operatorToken: { kind: number } }
interface ArrayLiteral extends Node { elements: readonly Node[] }

export interface RouterCompiler {
  SyntaxKind: { EqualsToken: number; ExportKeyword: number }
  forEachChild(node: Node, visit: (child: Node) => void): void
  isIdentifier(node: Node): node is TextNode
  isCallExpression(node: Node): node is Call
  isNewExpression(node: Node): node is Construction
  isPropertyAccessExpression(node: Node): node is Access
  isVariableDeclaration(node: Node): node is Variable
  isArrayLiteralExpression(node: Node): node is ArrayLiteral
  isObjectLiteralExpression(node: Node): boolean
  isBinaryExpression(node: Node): node is Binary
  isExportAssignment(node: Node): boolean
  isExportSpecifier(node: Node): boolean
  isExpressionStatement(node: Node): boolean
  isVariableStatement(node: Node): boolean
  isSourceFile(node: Node): boolean
  isFunctionLike(node: Node): boolean
  isClassLike(node: Node): boolean
}

export type Framework = 'express' | 'fastify' | 'hono' | 'koa'

/** What a scanner's router reading needs beyond its readers' shared context. */
export interface RouterContext extends UrlContext {
  ts: UrlCompiler & RouterCompiler
  /** The frameworks the scanner recognizes. */
  frameworks: ReadonlySet<Framework>
  /**
   * Whether exporting a registrar hands it off to code the scan does not read: a scan of one file alone
   * never sees the files that import it.
   */
  exportsHandOff: boolean
  /** The operation serving a route: its resolved handler when certain, else the registering operation. */
  handlerOperation(handler: Node | undefined, registration: Node): Promise<string>
  /** The operation that runs this node. */
  callerOperation(node: Node): string
  /** The path of the file that holds a node. */
  file(node: Node): string
}

/** A router must be mounted to serve anything; an application instance serves from the root. */
export interface Registrar {
  kind: 'app' | 'router'
  framework: Framework
  /** The variable that holds the instance, which names an application beside its file. */
  variable: string
  /** The path a Koa router adds before its routes; undefined when the source states one the scan cannot read. */
  prefix: string | undefined
}

export interface Registration {
  call: Call
  /** The registrar the call is made on. */
  declaration: Node
  member: string
}

/** A reference that hands a registrar to code the scan does not read, such as `registerRoutes(app)`. */
export interface HandOff {
  reference: Node
  declaration: Node
  /** An export at the top of its file, which importers receive only after the whole file has run. */
  last: boolean
}

/** Route registration members shared by the frameworks; `all` serves every method. */
export const routeMembers = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'], ['all', '*'],
])

/** A Koa router's `del`, which is `delete`, and `redirect(source, destination)`, which answers every method at its source. */
const koaMembers = new Map([['del', 'DELETE'], ['redirect', '*']])

/** The method a route member of this framework serves. */
export function routeMethod(member: string, framework: Framework): string | undefined {
  return routeMembers.get(member) ?? (framework === 'koa' ? koaMembers.get(member) : undefined)
}

/** Hono members that register routes the scan does not read; `basePath` returns a clone sharing its routes. */
export const unreadHonoMembers = new Set(['on', 'basePath', 'mount'])

/** Express settings members that return the application. */
const expressSettings = new Set(['set', 'enable', 'disable', 'engine'])

/** Express, Hono and Koa routers try routes in registration order; Fastify prefers the most specific route. */
export const orderedFrameworks = new Set<Framework>(['express', 'hono', 'koa'])

type Built = Pick<Registrar, 'kind' | 'framework'>
const expressApp: Built = { kind: 'app', framework: 'express' }
const fastifyApp: Built = { kind: 'app', framework: 'fastify' }
const koaApp: Built = { kind: 'app', framework: 'koa' }
const koaRouter: Built = { kind: 'router', framework: 'koa' }

/** What each module's exports build when called or constructed; `*` is a namespace import of the module. */
const constructors = new Map<string, Record<string, Built>>([
  ['express', { default: expressApp, '*': expressApp, Router: { kind: 'router', framework: 'express' } }],
  ['fastify', { default: fastifyApp, '*': fastifyApp, fastify: fastifyApp }],
  ['hono', { Hono: { kind: 'app', framework: 'hono' } }],
  ['koa', { default: koaApp, '*': koaApp }],
  ['@koa/router', { default: koaRouter, '*': koaRouter }],
  ['koa-router', { default: koaRouter, '*': koaRouter }],
])

/** A Koa router's `prefix` option; an option the scan cannot read leaves its path unknown. */
async function routerPrefix(context: RouterContext, initializer: Construction): Promise<string | undefined> {
  const [options] = initializer.arguments ?? []
  if (options === undefined) return ''
  const prefix = await heldAt(context, options, 'prefix')
  if (prefix === 'absent') return ''
  return typeof prefix === 'object' ? literalText(context, prefix.node) : undefined
}

async function built(
  context: RouterContext, found: Built | undefined, initializer: Construction, variable: string,
): Promise<Registrar | undefined> {
  if (found === undefined || !context.frameworks.has(found.framework)) return undefined
  return { ...found, variable, prefix: found === koaRouter ? await routerPrefix(context, initializer) : '' }
}

/** Recognize an instance by the module its constructor comes from, not by its type or its members. */
async function registrarOf(context: RouterContext, initializer: Node, variable: string): Promise<Registrar | undefined> {
  const { ts } = context
  if (!ts.isCallExpression(initializer) && !ts.isNewExpression(initializer)) return undefined
  const callee = initializer.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const holder = await importOrigin(context, callee.expression)
    const router = holder?.module === 'express' && callee.name.text === 'Router'
    return built(context, router ? constructors.get('express')!.Router : undefined, initializer, variable)
  }
  const origin = await importOrigin(context, callee)
  return built(context, origin === undefined ? undefined : constructors.get(origin.module)?.[origin.name], initializer, variable)
}

function walk(ts: RouterCompiler, node: Node, visitor: (node: Node) => void): void {
  visitor(node)
  ts.forEachChild(node, child => walk(ts, child, visitor))
}

/** A variable another value could replace is not the instance it was created as. */
async function collectRegistrars(context: RouterContext, sources: readonly Node[]): Promise<Map<Node, Registrar>> {
  const { ts } = context
  const declarations: (Variable & { name: TextNode; initializer: Node })[] = []
  for (const source of sources) {
    walk(ts, source, node => {
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined && ts.isIdentifier(node.name)) {
        declarations.push(node as Variable & { name: TextNode; initializer: Node })
      }
    })
  }
  const found = await inBatches(declarations, async declaration => {
    const registrar = await registrarOf(context, declaration.initializer, declaration.name.text)
    return registrar !== undefined && await unassigned(context, declaration) ? registrar : undefined
  })
  const registrars = new Map<Node, Registrar>()
  for (const [index, registrar] of found.entries()) if (registrar !== undefined) registrars.set(declarations[index]!, registrar)
  return registrars
}

/** A member some framework registers through, before the registrar is known. */
function candidate(member: string): boolean {
  return (['hono', 'koa', 'fastify'] as const).some(framework => registers(member, framework))
}

function memberOf(ts: RouterCompiler, call: Call): string | undefined {
  return ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined
}

export function registers(member: string, framework: Framework): boolean {
  if (unreadHonoMembers.has(member)) return framework === 'hono'
  if (koaMembers.has(member)) return framework === 'koa'
  if (member === 'register') return framework === 'fastify'
  if (member === 'route') return framework !== 'koa'
  // Hono mounts a sub-application only with `route` and `mount`, so its `use` only adds middleware.
  if (member === 'use') return framework !== 'hono'
  return routeMembers.has(member)
}

/**
 * A registration returns its registrar, and so do Express's settings calls, Hono's `use` and a Koa router's
 * `prefix`. Express's `route(path)` returns a route builder and Hono's `basePath` a clone, whose calls the scan
 * does not read.
 */
function returnsRegistrar(member: string, framework: Framework): boolean {
  if (framework === 'express' && expressSettings.has(member)) return true
  if (framework === 'hono' && member === 'use') return true
  if (framework === 'koa' && member === 'prefix') return true
  const builder = (member === 'route' && framework === 'express') || member === 'basePath'
  return registers(member, framework) && !builder
}

/** The registrar a call is made on, when the scan knows it; a call chained on another is made on what it returns. */
async function receiverDeclaration(
  context: RouterContext, call: Call, registrars: Map<Node, Registrar>,
): Promise<Node | undefined> {
  const { ts } = context
  const receiver = ts.isPropertyAccessExpression(call.expression) ? call.expression.expression : undefined
  if (receiver !== undefined && ts.isCallExpression(receiver)) {
    const member = memberOf(ts, receiver)
    const declaration = member === undefined ? undefined : await receiverDeclaration(context, receiver, registrars)
    if (member === undefined || declaration === undefined) return undefined
    return returnsRegistrar(member, registrars.get(declaration)!.framework) ? declaration : undefined
  }
  if (receiver === undefined || !ts.isIdentifier(receiver)) return undefined
  const declaration = await declarationOf(context, receiver)
  return declaration !== undefined && registrars.has(declaration) ? declaration : undefined
}

async function collectRegistrations(
  context: RouterContext, calls: readonly Call[], registrars: Map<Node, Registrar>,
): Promise<Registration[]> {
  const candidates = calls.flatMap(call => {
    const member = memberOf(context.ts, call)
    return member !== undefined && candidate(member) ? [{ call, member }] : []
  })
  const declarations = await inBatches(candidates, ({ call }) => receiverDeclaration(context, call, registrars))
  return candidates.flatMap(({ call, member }, index) => {
    const declaration = declarations[index]
    return declaration !== undefined && registers(member, registrars.get(declaration)!.framework) ? [{ call, declaration, member }] : []
  })
}

/**
 * `router.prefix('/api')` states a Koa router's own path for all its routes. A second one replaces the
 * first at runtime, in an order the scan does not follow, so the path becomes unknown.
 */
async function applyPrefixes(context: RouterContext, calls: readonly Call[], registrars: Map<Node, Registrar>): Promise<void> {
  for (const call of calls) {
    if (memberOf(context.ts, call) !== 'prefix') continue
    const declaration = await receiverDeclaration(context, call, registrars)
    const registrar = declaration === undefined ? undefined : registrars.get(declaration)
    if (registrar?.framework !== 'koa' || registrar.kind !== 'router') continue
    const stated = await literalText(context, call.arguments[0])
    registrars.set(declaration!, { ...registrar, prefix: registrar.prefix === '' ? stated : undefined })
  }
}

export function mounting(registration: Registration): boolean {
  return registration.member === 'use' || (registration.member === 'route' && registration.call.arguments.length > 1)
}

/**
 * A node a top-level statement runs once, in source order, when its module loads: outside any function
 * or class, in an expression or variable statement.
 */
export function atTopLevel(ts: RouterCompiler, node: Node): boolean {
  let current = node
  while (!ts.isSourceFile(current.parent)) {
    current = current.parent
    if (ts.isFunctionLike(current) || ts.isClassLike(current)) return false
  }
  return ts.isExpressionStatement(current) || ts.isVariableStatement(current)
}

/** Any use but a member use or a mount the scan reads hands the registrar on. */
function handedOn(ts: RouterCompiler, reference: Node, mounts: ReadonlySet<Node>): boolean {
  const parent = reference.parent
  if (ts.isPropertyAccessExpression(parent) && parent.expression === reference) return false
  return !mounts.has(parent)
}

/**
 * How a reference exports the registrar: `last` for an export statement, `export default app` or
 * `export { app }`, or a CommonJS export assignment at the top of the file, and `anywhere` for one
 * elsewhere.
 */
function exportOf(ts: RouterCompiler, reference: Node): 'last' | 'anywhere' | undefined {
  const parent = reference.parent
  if (ts.isExportAssignment(parent) || ts.isExportSpecifier(parent)) return 'last'
  const assigned = ts.isBinaryExpression(parent) && parent.right === reference
    && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && commonJsExport(ts, parent.left)
  if (!assigned) return undefined
  return atTopLevel(ts, parent) ? 'last' : 'anywhere'
}

/** `export const app = express()`, whose declaration is itself the export. */
function exportedDeclaration(ts: RouterCompiler, declaration: Node): boolean {
  if (!ts.isVariableDeclaration(declaration)) return false
  return declaration.parent.parent.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) === true
}

/** Node's HTTP modules, whose `createServer(app)` serves an application. */
const httpModules = new Set(['http', 'https', 'node:http', 'node:https'])

/** A CommonJS export: `module.exports`, or a property of it or of `exports`. */
function commonJsExport(ts: RouterCompiler, node: Node): boolean {
  if (!ts.isPropertyAccessExpression(node)) return false
  const root = node.expression
  if (!ts.isIdentifier(root)) return commonJsExport(ts, root)
  return root.text === 'exports' || (root.text === 'module' && node.name.text === 'exports')
}

/** Serving an application registers nothing: Node's `createServer(app)` and an imported `serve(app)`. */
async function serving(context: RouterContext, reference: Node): Promise<boolean> {
  const { ts } = context
  const parent = reference.parent
  if (!ts.isCallExpression(parent) || !parent.arguments.some(argument => argument === reference)) return false
  const callee = parent.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const holder = await importOrigin(context, callee.expression)
    return callee.name.text === 'createServer' && httpModules.has(holder?.module ?? '')
  }
  const origin = await importOrigin(context, callee)
  if (origin === undefined) return false
  return origin.name === 'serve' || (origin.name === 'createServer' && httpModules.has(origin.module))
}

/**
 * The files whose hand-offs of a registrar count: the one that creates it and those that register on
 * it. A module's top-level statements all run when it is first imported, so another file that imports
 * the registrar runs after every top-level registration of the file it imports it from.
 */
function registeringFiles(declaration: Node, registrations: readonly Registration[]): Set<object> {
  const files = new Set([declaration.getSourceFile()])
  for (const registration of registrations) {
    if (registration.declaration === declaration) files.add(registration.call.getSourceFile())
  }
  return files
}

/**
 * How one reference hands a registrar off, if it does. An export reaches code the scan does not read
 * only when the scan never sees the files that import it; they run after the whole file.
 */
async function handOffAt(
  context: RouterContext, reference: Node, declaration: Node, mounts: ReadonlySet<Node>,
): Promise<HandOff | undefined> {
  const { ts } = context
  const exported = exportOf(ts, reference)
  if (exported !== undefined) return context.exportsHandOff ? { reference, declaration, last: exported === 'last' } : undefined
  if (!handedOn(ts, reference, mounts) || await serving(context, reference)) return undefined
  return { reference, declaration, last: false }
}

/**
 * The references that hand a registrar off, which may register routes where they run. One outside the
 * top level of its file runs at a time the scan does not know, which leaves its registrar's order unknown.
 */
async function collectHandOffs(
  context: RouterContext, registrars: Map<Node, Registrar>, registrations: readonly Registration[],
): Promise<HandOff[]> {
  const mounts = new Set<Node>(registrations.filter(mounting).map(({ call }) => call))
  const handOffs: HandOff[] = []
  for (const declaration of registrars.keys()) {
    if (context.exportsHandOff && exportedDeclaration(context.ts, declaration)) handOffs.push({ reference: declaration, declaration, last: true })
    const files = registeringFiles(declaration, registrations)
    for (const reference of await context.bindings.references(declaration)) {
      const found = files.has(reference.getSourceFile()) ? await handOffAt(context, reference, declaration, mounts) : undefined
      if (found !== undefined) handOffs.push(found)
    }
  }
  return handOffs
}

/** Where an entry runs among its file's statements: a chained call at its member name. */
export function entryStart(ts: RouterCompiler, node: Node): number {
  return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) ? node.expression.name.getStart() : node.getStart()
}

/**
 * A registrar's registrations and hand-offs are in a proven order when every one is at the top level of
 * one file, where chained calls run in the order their member names are written; otherwise their order
 * is unknown and they share one index.
 */
function orderIndices(ts: RouterCompiler, registrations: readonly Registration[], handOffs: readonly HandOff[]): Map<Node, number> {
  const entries = [
    ...registrations.map(({ call, declaration }) => ({ node: call as Node, declaration, start: entryStart(ts, call), last: false })),
    ...handOffs.map(({ reference, declaration, last }) => ({
      node: reference, declaration, start: last ? Number.POSITIVE_INFINITY : reference.getStart(), last,
    })),
  ]
  const byRegistrar = new Map<Node, typeof entries>()
  for (const entry of entries) byRegistrar.set(entry.declaration, [...byRegistrar.get(entry.declaration) ?? [], entry])
  const indices = new Map<Node, number>()
  for (const list of byRegistrar.values()) {
    const files = new Set(list.map(({ node }) => node.getSourceFile()))
    if (files.size !== 1 || !list.every(({ node, last }) => last || atTopLevel(ts, node))) continue
    const sorted = [...list].sort((left, right) => left.start - right.start)
    for (const [index, { node }] of sorted.entries()) indices.set(node, index)
  }
  return indices
}

export interface Registrations {
  registrars: Map<Node, Registrar>
  registrations: Registration[]
  handOffs: HandOff[]
  /** Each registration's and hand-off's index among its registrar's, when the source proves their order. */
  indices: Map<Node, number>
}

/** The registrars the sources create, what the calls register on them, and in what order. */
export async function routerRegistrations(
  context: RouterContext, sources: readonly Node[], calls: readonly Call[],
): Promise<Registrations> {
  const registrars = await collectRegistrars(context, sources)
  await applyPrefixes(context, calls, registrars)
  const registrations = await collectRegistrations(context, calls, registrars)
  const handOffs = await collectHandOffs(context, registrars, registrations)
  return { registrars, registrations, handOffs, indices: orderIndices(context.ts, registrations, handOffs) }
}
