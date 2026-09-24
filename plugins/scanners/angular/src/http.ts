import type { ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { classicChecker } from '../../http-checker.ts'
import { requestUrl, type UrlPart } from '../../http-url.ts'
import { declarationOf, heldAt, heldParts, methodName, urlContext, urlParts, type UrlContext } from '../../http-values.ts'
import { angularImport } from './directives.ts'

const CLIENT = '@angular/common/http'

/** The HttpClient methods that take the URL first. */
const METHODS = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

function injectsClient(initializer: ts.Expression | undefined, checker: ts.TypeChecker): boolean {
  if (initializer === undefined || !ts.isCallExpression(initializer)) return false
  if (!angularImport(initializer.expression, checker, 'inject')) return false
  const token = initializer.arguments[0]
  return token !== undefined && angularImport(token, checker, 'HttpClient', CLIENT)
}

function declaredClient(type: ts.TypeNode | undefined, checker: ts.TypeChecker): boolean {
  return type !== undefined && ts.isTypeReferenceNode(type)
    && angularImport(type.typeName, checker, 'HttpClient', CLIENT)
}

/**
 * The receiver must hold the injected client: a constructor parameter property, a field, or a local
 * whose type is `HttpClient`, or one that `inject(HttpClient)` supplies. A method name alone proves
 * nothing, since any object can have a `get`.
 */
async function isHttpClient(context: UrlContext, checker: ts.TypeChecker, node: ts.Expression): Promise<boolean> {
  const declaration = await declarationOf(context, node) as ts.Declaration | undefined
  if (declaration === undefined) return false
  if (ts.isParameter(declaration)) return declaredClient(declaration.type, checker)
  if (ts.isPropertyDeclaration(declaration) || ts.isVariableDeclaration(declaration)) {
    return declaredClient(declaration.type, checker) || injectsClient(declaration.initializer, checker)
  }
  return false
}

/** A request's method, its URL as text and the holes the source computes, and the node whose operation sends it. */
interface ClientCall { method?: string; parts: UrlPart[]; sender: ts.Node }

/** The method and URL of one client call; `request` names its method first. */
async function clientCall(context: UrlContext, checker: ts.TypeChecker, call: ts.CallExpression): Promise<ClientCall | undefined> {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !await isHttpClient(context, checker, callee.expression)) return undefined
  const method = METHODS.get(callee.name.text)
  if (method !== undefined) {
    const url = call.arguments[0]
    return url === undefined ? undefined : { method, parts: await urlParts(context, url), sender: call }
  }
  if (callee.name.text !== 'request') return undefined
  // `request(method, url)`; the single `HttpRequest` form states no separate URL.
  const url = call.arguments[1]
  if (url === undefined) return undefined
  const named = await methodName(context, call.arguments[0])
  return { ...(named === undefined ? {} : { method: named }), parts: await urlParts(context, url), sender: call }
}

/**
 * `httpResource(() => url)` or `httpResource(() => ({ url, method }))`: the function that returns the request is the
 * operation that sends it. Without a method the resource sends GET.
 */
async function resourceCall(context: UrlContext, checker: ts.TypeChecker, call: ts.CallExpression): Promise<ClientCall | undefined> {
  const factory = call.arguments[0]
  if (!angularImport(call.expression, checker, 'httpResource', CLIENT) || !factory || !ts.isArrowFunction(factory) || ts.isBlock(factory.body)) return undefined
  const returned = await heldAt(context, factory.body)
  const request = typeof returned === 'string' ? undefined : returned.node as ts.Expression
  if (!request || !ts.isObjectLiteralExpression(request)) {
    return { method: 'GET', parts: await urlParts(context, factory.body), sender: factory.body }
  }
  const url = await heldAt(context, request, 'url')
  const method = await heldAt(context, request, 'method')
  if (url === 'absent') return undefined
  const stated = method === 'absent' ? 'GET' : typeof method === 'string' ? undefined : await methodName(context, method.node)
  return { ...(stated === undefined ? {} : { method: stated }), parts: await heldParts(context, url), sender: factory.body }
}

/**
 * The requests Angular's HttpClient and httpResource send. Angular serves no endpoint: its router routes,
 * interceptors and guards answer no HTTP request. `sources` are every file the program compiles, so a change
 * to a value anywhere in them keeps that value from being folded; `operationOf` names the operation that
 * sends a request, or nothing for a call the project does not report.
 */
export async function angularHttpRequests(
  sources: readonly ts.SourceFile[],
  checker: ts.TypeChecker,
  operationOf: (node: ts.Node) => string | undefined,
): Promise<ScanHttpRequest[]> {
  const context = urlContext(ts, classicChecker(ts, checker), sources)
  const calls: ts.CallExpression[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) calls.push(node)
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  const requests: ScanHttpRequest[] = []
  for (const call of calls) {
    const request = await clientCall(context, checker, call) ?? await resourceCall(context, checker, call)
    const operation = request === undefined ? undefined : operationOf(request.sender)
    if (request === undefined || operation === undefined) continue
    requests.push({ operation, ...(request.method === undefined ? {} : { method: request.method }), ...requestUrl(request.parts) })
  }
  return requests
}
