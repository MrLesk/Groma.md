import type { ScanHttpEndpoint, ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { axiosRequest, fetchRequest, runtimeFetch, type FetchClient } from '../../http-clients.ts'
import { classicChecker } from '../../http-checker.ts'
import { declarationOf, heldAt, urlContext, type UrlContext } from '../../http-values.ts'
import { enclosingOperation, type Operation } from './evidence.ts'
import { relative, type VueProject } from './project.ts'
import { serverRoute } from './server-routes.ts'

/** The two clients Nuxt supplies by auto-import, which are ofetch. */
const NUXT_CLIENTS = new Set(['$fetch', 'useFetch'])

export interface VueHttpInput {
  project: VueProject
  /** The directory holding the project manifest; route locations are read relative to it. */
  projectRoot: string
  /** Nuxt serves the file-location routes; another server in `server/` serves paths of its own. */
  nuxt: boolean
  /** The operation a fact belongs to, or undefined when no source position maps to it. */
  operationId: (node: Operation) => string | undefined
  /** The operation for a file's own top-level code, which `<script setup>` runs on setup. */
  moduleOperation: (file: string) => string
}

/** A file the project itself provides, as opposed to an installed package or the compiler's libraries. */
function projectSource(projectRoot: string, fileName: string): boolean {
  const file = relative(projectRoot, fileName)
  return !file.startsWith('../') && !file.includes('node_modules/')
}

/**
 * The runtime's `fetch`, or a Nuxt client. Nuxt supplies `$fetch` and `useFetch` by auto-import, so
 * neither name claims anything until it resolves to a declaration outside the project source: a
 * project's own `useFetch` composable, or a generated wrapper, is a local function whose own body
 * decides the URL.
 */
async function vueClient(context: UrlContext, projectRoot: string, callee: ts.Node): Promise<FetchClient | undefined> {
  if (!ts.isIdentifier(callee) || !NUXT_CLIENTS.has(callee.text)) return runtimeFetch(context, callee)
  const declaration = await declarationOf(context, callee)
  return declaration !== undefined && !projectSource(projectRoot, declaration.getSourceFile().fileName) ? 'ofetch' : undefined
}

function isOperation(node: ts.Node): node is Operation {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return node.body !== undefined
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node)
}

/** A function written in place, or one this file declares under the name, as a function or held by a variable. */
async function localFunction(context: UrlContext, node: ts.Node, source: ts.SourceFile): Promise<Operation | undefined> {
  if (isOperation(node)) return node
  if (!ts.isIdentifier(node)) return undefined
  const held = await heldAt(context, node)
  const value = typeof held === 'object' ? held.node as ts.Node : undefined
  return value !== undefined && isOperation(value) && value.getSourceFile() === source ? value : undefined
}

function isDefaultFunction(statement: ts.Statement): boolean {
  if (!ts.isFunctionDeclaration(statement) || !ts.canHaveModifiers(statement)) return false
  return (ts.getModifiers(statement) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)
}

/**
 * The function a server route's default export designates: a default-exported function, or a function
 * the default export names or passes to a handler wrapper such as `defineEventHandler`.
 */
async function routeHandler(context: UrlContext, source: ts.SourceFile): Promise<Operation | undefined> {
  for (const statement of source.statements) {
    if (isDefaultFunction(statement)) return isOperation(statement) ? statement : undefined
    if (!ts.isExportAssignment(statement) || statement.isExportEquals === true) continue
    const value = statement.expression
    const handler = ts.isCallExpression(value) ? value.arguments[0] : value
    return handler === undefined ? undefined : localFunction(context, handler, source)
  }
  return undefined
}

function calls(source: ts.SourceFile): ts.CallExpression[] {
  const found: ts.CallExpression[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) found.push(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

async function fileRequests(context: UrlContext, source: ts.SourceFile, file: string, input: VueHttpInput): Promise<ScanHttpRequest[]> {
  const requests: ScanHttpRequest[] = []
  for (const call of calls(source)) {
    const fact = await fetchRequest(context, call, callee => vueClient(context, input.projectRoot, callee as ts.Node))
      ?? await axiosRequest(context, call)
    if (fact === undefined) continue
    // A call in a component's own top-level code runs on setup, which the module operation names.
    const caller = enclosingOperation(call)
    const operation = (caller === undefined ? undefined : input.operationId(caller)) ?? input.moduleOperation(file)
    requests.push({ operation, ...fact })
  }
  return requests
}

/**
 * Nuxt serves every file in `server/api` and `server/routes`, so a route reports its endpoint even when
 * the scan cannot resolve the handler: the file's module operation then names it.
 */
async function fileEndpoint(
  context: UrlContext, source: ts.SourceFile, files: { project: string; owned: string }, input: VueHttpInput,
): Promise<ScanHttpEndpoint | undefined> {
  const route = input.nuxt ? serverRoute(files.project) : undefined
  if (route === undefined) return undefined
  const handler = await routeHandler(context, source)
  const operation = (handler === undefined ? undefined : input.operationId(handler)) ?? input.moduleOperation(files.owned)
  return { operation, ...route }
}

/**
 * The requests the Vue project sends and the endpoints Nuxt serves by file location. Positions come
 * from the project, so a fact from a single-file component names an operation in that `.vue` file.
 */
export async function vueHttpFacts(input: VueHttpInput): Promise<{
  httpRequests: ScanHttpRequest[]; httpEndpoints: ScanHttpEndpoint[]
}> {
  const context = urlContext(ts, classicChecker(ts, input.project.checker), input.project.files)
  const httpRequests: ScanHttpRequest[] = []
  const httpEndpoints: ScanHttpEndpoint[] = []
  for (const source of input.project.files) {
    const owned = relative(input.project.root, source.fileName)
    httpRequests.push(...await fileRequests(context, source, owned, input))
    const endpoint = await fileEndpoint(context, source, { project: relative(input.projectRoot, source.fileName), owned }, input)
    if (endpoint !== undefined) httpEndpoints.push(endpoint)
  }
  return { httpRequests, httpEndpoints }
}
