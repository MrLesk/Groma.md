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
export function nextRouters(directory: string): Routers {
  const active = (name: string): string => existsSync(path.join(directory, name)) ? name : `src/${name}`
  return { app: active('app'), pages: active('pages') }
}

/** The route a file declares by its location under an active router, or undefined for any other file. */
export function routeLocation(file: string, routers: Routers): { router: 'app' | 'pages'; directory?: string } | undefined {
  const within = (directory: string): string | undefined => file.startsWith(`${directory}/`) ? file.slice(directory.length + 1) : undefined
  const app = APP_ROUTE.exec(within(routers.app) ?? '')
  // A private folder such as `_lib` opts itself and its subfolders out of routing.
  if (app) return app[1]?.split('/').some(part => part.startsWith('_'))
    ? undefined : { router: 'app', ...(app[1] === undefined ? {} : { directory: app[1] }) }
  const pages = PAGES_API.exec(within(routers.pages) ?? '')
  return pages ? { router: 'pages', directory: pages[1]! } : undefined
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

function hasModifier(statement: ts.Statement, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(statement)
    && (ts.getModifiers(statement) ?? []).some(modifier => modifier.kind === kind)
}

/** What a route export serves: the function the file defines, the file's module code, or nothing. */
type Served = Operation | ts.SourceFile | undefined

/** A literal value is data, never a handler. */
function literal(node: ts.Node): boolean {
  return ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node) || ts.isLiteralExpression(node)
    || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword
}

/**
 * A function the route file defines serves itself; a literal serves nothing. Any other value, such as a
 * wrapper's result or an import, runs through the file's module code, which then names the endpoint.
 */
function served(source: ts.SourceFile, value: ts.Node | undefined, depth = 0): Served {
  if (value === undefined || literal(value)) return undefined
  if (executable(value)) return value
  return ts.isIdentifier(value) && depth < 8 ? servedName(source, value.text, depth + 1) : source
}

/** What a name the file exports serves, through its local declaration; an imported name is the module's. */
function servedName(source: ts.SourceFile, name: string, depth = 0): Served {
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return served(source, statement, depth)
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return served(source, declaration.initializer, depth)
    }
  }
  return source
}

/** Each name a statement exports, with what it serves: declarations, and export lists such as `export { handler as GET }`. */
function statementExports(source: ts.SourceFile, statement: ts.Statement): [string, Served][] {
  if (ts.isExportDeclaration(statement)) {
    if (statement.isTypeOnly || statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) return []
    // A name another module defines runs through this file's module code.
    return statement.exportClause.elements.filter(element => !element.isTypeOnly).map(element => [element.name.text,
      statement.moduleSpecifier === undefined ? servedName(source, (element.propertyName ?? element.name).text) : source])
  }
  if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return []
  const name = hasModifier(statement, ts.SyntaxKind.DefaultKeyword) ? 'default' : undefined
  if (ts.isFunctionDeclaration(statement)) return [[name ?? statement.name!.text, served(source, statement)]]
  if (!ts.isVariableStatement(statement)) return []
  // `export const { GET, POST } = handlers` exports values another object holds, run through the module code.
  return statement.declarationList.declarations.flatMap((declaration): [string, Served][] => ts.isIdentifier(declaration.name)
    ? [[declaration.name.text, served(source, declaration.initializer)]]
    : ts.isObjectBindingPattern(declaration.name) ? declaration.name.elements.flatMap((element): [string, Served][] =>
      ts.isIdentifier(element.name) ? [[element.name.text, source]] : []) : [])
}

/** What each name a route file exports serves; `export default value` is the name `default`. */
function routeExports(source: ts.SourceFile): Map<string, Served> {
  return new Map(source.statements.flatMap((statement): [string, Served][] => ts.isExportAssignment(statement)
    ? statement.isExportEquals === true ? [] : [['default', served(source, statement.expression)]]
    : statementExports(source, statement)))
}

/** An App Router file answers each method it exports; a Pages Router API route answers every method with its default export. */
function answeredMethod(router: 'app' | 'pages', name: string): string | undefined {
  if (router === 'app') return METHODS.has(name) ? name : undefined
  return name === 'default' ? '*' : undefined
}

/**
 * The endpoints a Next.js project serves by file location: an App Router route file's method
 * handlers, and a Pages Router API route's default export, which answers every method.
 */
export function nextRouteEndpoints(
  sources: readonly ts.SourceFile[],
  directory: string,
  routers: Routers,
  operationId: (node: Operation | ts.SourceFile) => string,
): ScanHttpEndpoint[] {
  const endpoints: ScanHttpEndpoint[] = []
  for (const source of sources) {
    const location = routeLocation(path.relative(directory, source.fileName).split(path.sep).join('/'), routers)
    const segments = location === undefined ? undefined : routePath(location.directory, location.router === 'pages')
    if (location === undefined || segments === undefined) continue
    for (const [name, handler] of routeExports(source)) {
      const method = answeredMethod(location.router, name)
      if (method !== undefined && handler !== undefined) endpoints.push({ operation: operationId(handler), method, path: segments })
    }
  }
  return endpoints
}
