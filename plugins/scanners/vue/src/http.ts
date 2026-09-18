import type { HttpEndpointSegment, ScanHttpEndpoint, ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import {
  axiosRequest, createdBase, optionsMethod,
  type Client, type ClientContext, type RequestFact,
} from '../../http-clients.ts'
import { pathText, requestUrl } from '../../http-url.ts'
import { constantOf, declarationOf, urlParts } from '../../http-values.ts'
import { enclosingOperation, type Operation } from './evidence.ts'
import { relative, type VueProject } from './project.ts'

/** Clients the runtime supplies: the platform's `fetch`, and the two Nuxt auto-imports. */
const GLOBAL_CLIENTS = new Set(['fetch', '$fetch', 'useFetch'])

/** A Nuxt server route's file name may end with the method it answers. */
const SUFFIXES = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

const SERVER_ROUTE = /^server\/((?:api|routes)\/.+)\.[cm]?[jt]s$/

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

/** `axios` itself, or an instance assigned once from `axios.create`, whose base starts every path. */
function axiosClient(node: ts.Node, context: VueContext): Client | undefined {
  if (!ts.isIdentifier(node)) return undefined
  const declaration = context.checker.getSymbolAtLocation(node)?.declarations?.[0]
  if (declaration === undefined) return undefined
  const imported = importedModule(declaration)
  if (imported !== undefined) return imported === 'axios' ? { base: [] } : undefined
  // Only a value assigned once: a reassigned instance could carry another base at runtime.
  const created = constantOf<ts.Expression>(context, node)
  if (created === undefined || !ts.isCallExpression(created)) return undefined
  const callee = created.expression
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'create') return undefined
  // Only `axios` has `create`; an instance does not, so the receiver must be the imported client.
  if (axiosClient(callee.expression, context)?.base.length !== 0) return undefined
  return { base: createdBase(context, created) }
}

/** The module an imported name comes from, so a client is recognized without resolving its type. */
function importedModule(declaration: ts.Declaration): string | undefined {
  const clause = ts.isImportSpecifier(declaration) ? declaration.parent.parent.parent
    : ts.isImportClause(declaration) ? declaration.parent : undefined
  if (clause === undefined || !ts.isImportDeclaration(clause) || !ts.isStringLiteral(clause.moduleSpecifier)) {
    return undefined
  }
  return clause.moduleSpecifier.text
}

/** `fetch(url, options)`, `$fetch(url, options)` and `useFetch(url, options)` all read the URL first. */
function globalRequest(call: ts.CallExpression, context: VueContext, projectRoot: string): RequestFact | undefined {
  if (!isGlobalClient(call.expression, context, projectRoot)) return undefined
  const [url, options] = call.arguments
  if (url === undefined) return undefined
  return { ...optionsMethod(context, options), ...requestUrl(urlParts(context, url)) }
}

function routeSegment(part: string, last: boolean): HttpEndpointSegment | undefined {
  const rest = /^\[\.\.\.(.+)\]$/.exec(part)
  if (rest) return last && pathText.test(rest[1]!) ? { kind: 'catch-all', name: rest[1]! } : undefined
  const parameter = /^\[(.+)\]$/.exec(part)
  if (parameter) return pathText.test(parameter[1]!) ? { kind: 'parameter', name: parameter[1]! } : undefined
  if (part.includes('[') || part.includes(']')) return undefined
  return pathText.test(part) ? { kind: 'literal', value: part } : undefined
}

/** The path a Nuxt server route serves, and the method its file name states. */
function serverRoute(file: string): { method: string; path: HttpEndpointSegment[] } | undefined {
  const match = SERVER_ROUTE.exec(file)
  if (match === null) return undefined
  const route = match[1]!
  // `server/api` keeps its prefix; `server/routes` serves from the root.
  const parts = (route.startsWith('routes/') ? route.slice('routes/'.length) : route).split('/')
  const pieces = parts.pop()!.split('.')
  // Only a known suffix names a method; any other dot belongs to the file's own name.
  const suffix = pieces.length > 1 && SUFFIXES.has(pieces.at(-1)!) ? pieces.pop()! : undefined
  const name = pieces.join('.')
  const segments = name === 'index' ? parts : [...parts, name]
  const path: HttpEndpointSegment[] = []
  for (const [index, part] of segments.entries()) {
    const segment = routeSegment(part, index === segments.length - 1)
    if (segment === undefined) return undefined
    path.push(segment)
  }
  return { method: suffix === undefined ? '*' : suffix.toUpperCase(), path }
}

/** The function a server route's default export designates, including the one `defineEventHandler` receives. */
function routeHandler(source: ts.SourceFile): Operation | undefined {
  for (const statement of source.statements) {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals === true) continue
    const value = statement.expression
    if (isOperation(value)) return value
    if (ts.isCallExpression(value)) {
      const argument = value.arguments[0]
      if (argument !== undefined && isOperation(argument)) return argument
    }
  }
  return undefined
}

function isOperation(node: ts.Node): node is Operation {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return node.body !== undefined
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node)
}

function fileRequests(source: ts.SourceFile, file: string, input: VueHttpInput, context: VueContext): ScanHttpRequest[] {
  const requests: ScanHttpRequest[] = []
  const visit = (node: ts.Node): void => {
    const fact = ts.isCallExpression(node)
      ? globalRequest(node, context, input.projectRoot) ?? axiosRequest(context, node, client => axiosClient(client as ts.Node, context))
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

function fileEndpoint(source: ts.SourceFile, file: string, input: VueHttpInput): ScanHttpEndpoint | undefined {
  const route = input.nuxt ? serverRoute(file) : undefined
  if (route === undefined) return undefined
  const handler = routeHandler(source)
  const operation = handler === undefined ? undefined : input.operationId(handler)
  return operation === undefined ? undefined : { operation, ...route }
}

/**
 * The requests the Vue project sends and the endpoints Nuxt serves by file location. Positions come
 * from the project, so a fact from a single-file component names an operation in that `.vue` file.
 */
export function vueHttpFacts(input: VueHttpInput): {
  httpRequests: ScanHttpRequest[]; httpEndpoints: ScanHttpEndpoint[]
} {
  const context: VueContext = { ts, checker: input.project.checker }
  const httpRequests: ScanHttpRequest[] = []
  const httpEndpoints: ScanHttpEndpoint[] = []
  for (const source of input.project.files) {
    const owned = relative(input.project.root, source.fileName)
    httpRequests.push(...fileRequests(source, owned, input, context))
    const endpoint = fileEndpoint(source, relative(input.projectRoot, source.fileName), input)
    if (endpoint !== undefined) httpEndpoints.push(endpoint)
  }
  return { httpRequests, httpEndpoints }
}
