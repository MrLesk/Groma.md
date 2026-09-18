import { existsSync } from 'node:fs'
import path from 'node:path'
import type { HttpEndpointSegment, ScanHttpEndpoint } from '@groma/scanner'
import ts from 'typescript'
import { pathText } from '../../http-url.ts'
import { executable, type Operation } from './functions.ts'

/** The methods an App Router route file exports one handler per. */
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

const APP_ROUTE = /^(?:(.+)\/)?route\.tsx?$/
const PAGES_API = /^(api\/.+)\.tsx?$/

const OPTIONAL_CATCH_ALL = /^\[\[\.\.\.(.+)\]\]$/
const CATCH_ALL = /^\[\.\.\.(.+)\]$/
const PARAMETER = /^\[(.+)\]$/

/** The directories Next.js serves routes from, relative to the project root. */
export interface Routers {
  app: string
  pages: string
}

/** Next.js reads `app` and `pages` from the project root, each from `src` only when the root has none. */
export function nextRouters(projectRoot: string): Routers {
  const active = (name: string): string => existsSync(path.join(projectRoot, name)) ? name : `src/${name}`
  return { app: active('app'), pages: active('pages') }
}

/** The route a file declares by its location under an active router, or undefined for any other file. */
export function routeLocation(file: string, routers: Routers): { router: 'app' | 'pages'; directory?: string } | undefined {
  const within = (directory: string): string | undefined => file.startsWith(`${directory}/`) ? file.slice(directory.length + 1) : undefined
  const app = APP_ROUTE.exec(within(routers.app) ?? '')
  if (app) return { router: 'app', ...(app[1] === undefined ? {} : { directory: app[1] }) }
  const pages = PAGES_API.exec(within(routers.pages) ?? '')
  return pages ? { router: 'pages', directory: pages[1]! } : undefined
}

/** Whether a file sits where a Next.js project may declare a route, under its root or `src`. */
export function routeCandidate(file: string): boolean {
  return ['', 'src/'].some(prefix => routeLocation(file, { app: `${prefix}app`, pages: `${prefix}pages` }) !== undefined)
}

/** A fully parenthesized name organizes files without serving a segment, unless it marks an intercept. */
const GROUP = /^\((?!\.+\))[^)]+\)$/

/**
 * One path segment of a route directory. A parallel route `@modal`, an intercepted route `(.)talks`,
 * and a segment that is only partly dynamic leave the route unsupported.
 */
function routeSegment(part: string, last: boolean): HttpEndpointSegment | undefined {
  const optional = OPTIONAL_CATCH_ALL.exec(part)
  if (optional) return last && pathText.test(optional[1]!) ? { kind: 'catch-all', name: optional[1]!, optional: true } : undefined
  const rest = CATCH_ALL.exec(part)
  if (rest) return last && pathText.test(rest[1]!) ? { kind: 'catch-all', name: rest[1]! } : undefined
  const parameter = PARAMETER.exec(part)
  if (parameter) return pathText.test(parameter[1]!) ? { kind: 'parameter', name: parameter[1]! } : undefined
  // A route group `(marketing)`, an intercepted route `(.)talks`, a parallel route `@modal`, and a
  // partly dynamic segment name no served segment.
  if (part.startsWith('(') || part.startsWith('@') || part.includes('[') || part.includes(']')) return undefined
  return pathText.test(part) ? { kind: 'literal', value: part } : undefined
}

/** A Pages Router `index` file serves its directory; every other `index` is an ordinary segment. */
function routeParts(directory: string | undefined, stripIndex: boolean): string[] {
  const parts = (directory ?? '').split('/').filter(part => part !== '' && !GROUP.test(part))
  return stripIndex && parts.at(-1) === 'index' ? parts.slice(0, -1) : parts
}

function routePath(directory: string | undefined, stripIndex: boolean): HttpEndpointSegment[] | undefined {
  const parts = routeParts(directory, stripIndex)
  const segments: HttpEndpointSegment[] = []
  for (const [index, part] of parts.entries()) {
    const segment = routeSegment(part, index === parts.length - 1)
    if (segment === undefined) return undefined
    segments.push(segment)
  }
  return segments
}

function functionValue(node: ts.Node | undefined): Operation | undefined {
  return node !== undefined && executable(node) ? node : undefined
}

function hasModifier(statement: ts.Statement, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(statement)
    && (ts.getModifiers(statement) ?? []).some(modifier => modifier.kind === kind)
}

/** `export async function GET()`, whose name is the method it answers. */
function declaredHandler(statement: ts.Statement): [string, Operation] | undefined {
  if (!ts.isFunctionDeclaration(statement) || statement.name === undefined) return undefined
  const handler = functionValue(statement)
  return handler !== undefined && METHODS.has(statement.name.text) ? [statement.name.text, handler] : undefined
}

/** `export const GET = async () => {}`, one entry per declared method name. */
function boundHandlers(statement: ts.Statement): [string, Operation][] {
  if (!ts.isVariableStatement(statement)) return []
  return statement.declarationList.declarations.flatMap((declaration): [string, Operation][] => {
    const handler = functionValue(declaration.initializer)
    if (handler === undefined || !ts.isIdentifier(declaration.name) || !METHODS.has(declaration.name.text)) return []
    return [[declaration.name.text, handler]]
  })
}

/** The method handlers an App Router route file exports. */
function appHandlers(source: ts.SourceFile): Map<string, Operation> {
  const exported = source.statements.filter(statement => hasModifier(statement, ts.SyntaxKind.ExportKeyword))
  return new Map(exported.flatMap(statement => {
    const declared = declaredHandler(statement)
    return declared === undefined ? boundHandlers(statement) : [declared]
  }))
}

/** A local name the file's default export names, resolved without the checker. */
function localFunction(source: ts.SourceFile, name: string): Operation | undefined {
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return functionValue(statement)
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return functionValue(declaration.initializer)
    }
  }
  return undefined
}

/** A Pages Router API route answers every method with its default export. */
function pagesHandler(source: ts.SourceFile): Operation | undefined {
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)
      && hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) return functionValue(statement)
    if (!ts.isExportAssignment(statement) || statement.isExportEquals === true) continue
    const value = functionValue(statement.expression)
    if (value !== undefined) return value
    if (ts.isIdentifier(statement.expression)) return localFunction(source, statement.expression.text)
  }
  return undefined
}

/**
 * The endpoints a Next.js project serves by file location: an App Router route file's method
 * handlers, and a Pages Router API route's default export, which answers every method.
 */
export function nextRouteEndpoints(
  sources: readonly ts.SourceFile[],
  projectRoot: string,
  routers: Routers,
  operationId: (node: Operation) => string,
): ScanHttpEndpoint[] {
  const endpoints: ScanHttpEndpoint[] = []
  for (const source of sources) {
    const location = routeLocation(path.relative(projectRoot, source.fileName).split(path.sep).join('/'), routers)
    const segments = location === undefined ? undefined : routePath(location.directory, location.router === 'pages')
    if (location === undefined || segments === undefined) continue
    if (location.router === 'app') {
      for (const [method, handler] of appHandlers(source)) {
        endpoints.push({ operation: operationId(handler), method, path: segments })
      }
      continue
    }
    const handler = pagesHandler(source)
    if (handler !== undefined) endpoints.push({ operation: operationId(handler), method: '*', path: segments })
  }
  return endpoints
}
