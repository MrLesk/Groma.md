import type { ScanHttpEndpoint, ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { axiosRequest, fetchMethod, optionsBase, type ClientContext, type RequestFact } from '../../http-clients.ts'
import { requestUrl, withBase } from '../../http-url.ts'
import { declarationOf, heldAt, urlContext, urlParts } from '../../http-values.ts'
import { enclosingOperation, type Operation } from './evidence.ts'
import { relative, type VueProject } from './project.ts'
import { serverRoute } from './server-routes.ts'

/** Clients the runtime supplies: the platform's `fetch`, and the two Nuxt auto-imports. */
const GLOBAL_CLIENTS = new Set(['fetch', '$fetch', 'useFetch'])

interface VueContext extends ClientContext {
  checker: ts.TypeChecker
}

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
 * A client the runtime supplies. A name the project declares itself, such as its own `useFetch`
 * composable or a generated wrapper, is a local function whose own body decides the URL. Nuxt supplies
 * `$fetch` and `useFetch` by auto-import, so neither name claims anything until it resolves.
 */
function isGlobalClient(callee: ts.Expression, context: VueContext, projectRoot: string): boolean {
  if (!ts.isIdentifier(callee) || !GLOBAL_CLIENTS.has(callee.text)) return false
  const declaration = declarationOf<ts.Declaration>(context, callee)
  if (declaration !== undefined && projectSource(projectRoot, declaration.getSourceFile().fileName)) return false
  return callee.text === 'fetch' || declaration !== undefined
}

/**
 * `fetch(url, options)`, `$fetch(url, options)` and `useFetch(url, options)` all read the URL first;
 * Nuxt's two also read a `baseURL` option, which options the scanner cannot read may hold.
 */
function globalRequest(call: ts.CallExpression, context: VueContext, projectRoot: string): RequestFact | undefined {
  if (!isGlobalClient(call.expression, context, projectRoot)) return undefined
  const [url, options] = call.arguments
  if (url === undefined) return undefined
  const parts = urlParts(context, url)
  const nuxt = (call.expression as ts.Identifier).text !== 'fetch'
  const target = nuxt ? withBase(optionsBase(context, options, []), parts) : parts
  return { ...fetchMethod(context, url, options), ...requestUrl(target) }
}

function isOperation(node: ts.Node): node is Operation {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return node.body !== undefined
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node)
}

/** A function written in place, or one this file declares under the name, as a function or held by a variable. */
function localFunction(node: ts.Node, source: ts.SourceFile, context: VueContext): Operation | undefined {
  if (isOperation(node)) return node
  if (!ts.isIdentifier(node)) return undefined
  const declaration = declarationOf<ts.Node>(context, node)
  const held = heldAt(context, node)
  const value = declaration !== undefined && ts.isFunctionDeclaration(declaration) ? declaration
    : typeof held === 'object' ? held.node as ts.Node : undefined
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
function routeHandler(source: ts.SourceFile, context: VueContext): Operation | undefined {
  for (const statement of source.statements) {
    if (isDefaultFunction(statement)) return isOperation(statement) ? statement : undefined
    if (!ts.isExportAssignment(statement) || statement.isExportEquals === true) continue
    const value = statement.expression
    const handler = ts.isCallExpression(value) ? value.arguments[0] : value
    return handler === undefined ? undefined : localFunction(handler, source, context)
  }
  return undefined
}

function fileRequests(source: ts.SourceFile, file: string, input: VueHttpInput, context: VueContext): ScanHttpRequest[] {
  const requests: ScanHttpRequest[] = []
  const visit = (node: ts.Node): void => {
    const fact = ts.isCallExpression(node)
      ? globalRequest(node, context, input.projectRoot) ?? axiosRequest(context, node)
      : undefined
    if (fact !== undefined) {
      // A call in a component's own top-level code runs on setup, which the module operation names.
      const caller = enclosingOperation(node)
      const operation = (caller === undefined ? undefined : input.operationId(caller)) ?? input.moduleOperation(file)
      requests.push({ operation, ...fact })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return requests
}

/**
 * Nuxt serves every file in `server/api` and `server/routes`, so a route reports its endpoint even when
 * the scan cannot resolve the handler: the file's module operation then names it.
 */
function fileEndpoint(source: ts.SourceFile, files: { project: string; owned: string }, input: VueHttpInput, context: VueContext): ScanHttpEndpoint | undefined {
  const route = input.nuxt ? serverRoute(files.project) : undefined
  if (route === undefined) return undefined
  const handler = routeHandler(source, context)
  const operation = (handler === undefined ? undefined : input.operationId(handler)) ?? input.moduleOperation(files.owned)
  return { operation, ...route }
}

/**
 * The requests the Vue project sends and the endpoints Nuxt serves by file location. Positions come
 * from the project, so a fact from a single-file component names an operation in that `.vue` file.
 */
export function vueHttpFacts(input: VueHttpInput): {
  httpRequests: ScanHttpRequest[]; httpEndpoints: ScanHttpEndpoint[]
} {
  const context: VueContext = urlContext(ts, input.project.checker, input.project.files)
  const httpRequests: ScanHttpRequest[] = []
  const httpEndpoints: ScanHttpEndpoint[] = []
  for (const source of input.project.files) {
    const owned = relative(input.project.root, source.fileName)
    httpRequests.push(...fileRequests(source, owned, input, context))
    const endpoint = fileEndpoint(source, { project: relative(input.projectRoot, source.fileName), owned }, input, context)
    if (endpoint !== undefined) httpEndpoints.push(endpoint)
  }
  return { httpRequests, httpEndpoints }
}
