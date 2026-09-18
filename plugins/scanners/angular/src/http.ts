import type { ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { requestUrl } from '../../http-url.ts'
import { declarationOf, methodName, urlContext, urlParts, type UrlContext } from '../../http-values.ts'
import { angularImport } from './components.ts'

const CLIENT = '@angular/common/http'

interface AngularContext extends UrlContext {
  checker: ts.TypeChecker
}

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
function isHttpClient(node: ts.Expression, context: AngularContext): boolean {
  const declaration = declarationOf<ts.Declaration>(context, node)
  if (declaration === undefined) return false
  if (ts.isParameter(declaration)) return declaredClient(declaration.type, context.checker)
  if (ts.isPropertyDeclaration(declaration) || ts.isVariableDeclaration(declaration)) {
    return declaredClient(declaration.type, context.checker) || injectsClient(declaration.initializer, context.checker)
  }
  return false
}

/** The method and URL of one client call; `request` names its method first. */
function clientCall(
  call: ts.CallExpression, context: AngularContext,
): { method?: string; url: ts.Expression } | undefined {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !isHttpClient(callee.expression, context)) return undefined
  const method = METHODS.get(callee.name.text)
  if (method !== undefined) {
    const url = call.arguments[0]
    return url === undefined ? undefined : { method, url }
  }
  if (callee.name.text !== 'request') return undefined
  // `request(method, url)`; the single `HttpRequest` form states no separate URL.
  const url = call.arguments[1]
  if (url === undefined) return undefined
  const named = methodName(context, call.arguments[0])
  return { ...(named === undefined ? {} : { method: named }), url }
}

/**
 * The requests Angular's HttpClient sends. Angular serves no endpoint: its router routes,
 * interceptors and guards answer no HTTP request. `sources` are every file of the project, so a
 * change to a value anywhere in them keeps that value from being folded.
 */
export function angularHttpRequests(
  sources: readonly ts.SourceFile[],
  checker: ts.TypeChecker,
  callerOperation: (call: ts.Node) => string | undefined,
): ScanHttpRequest[] {
  const context: AngularContext = urlContext(ts, checker, sources)
  const requests: ScanHttpRequest[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const client = clientCall(node, context)
      const operation = client === undefined ? undefined : callerOperation(node)
      if (client !== undefined && operation !== undefined) {
        requests.push({
          operation,
          ...(client.method === undefined ? {} : { method: client.method }),
          ...requestUrl(urlParts(context, client.url)),
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  for (const source of sources) visit(source)
  return requests
}
