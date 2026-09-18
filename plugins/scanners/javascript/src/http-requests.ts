import ts from 'typescript'
import { axiosRequest, fetchMethod, type ClientContext, type RequestFact } from '../../http-clients.ts'
import { requestUrl } from '../../http-url.ts'
import { heldAt, heldParts, importOrigin, methodName, urlParts } from '../../http-values.ts'

export interface JavaScriptContext extends ClientContext {
  ts: typeof ts
  checker: ts.TypeChecker
}

/** jQuery helpers whose own name states the method. */
const jqueryHelpers = new Map([
  ['get', 'GET'], ['getJSON', 'GET'], ['getScript', 'GET'], ['post', 'POST'],
])

/**
 * A client the runtime provides under one of `names`, which nothing in the file declares, or the one
 * the file imports or requires as `module`'s `exported` export; any other declaration is not it.
 */
function client(context: JavaScriptContext, node: ts.Node, names: readonly string[], module: string, exported?: string): boolean {
  if (!ts.isIdentifier(node) || !names.includes(node.text)) return false
  if (context.checker.getSymbolAtLocation(node) === undefined) return true
  const origin = importOrigin(context, node)
  return origin?.module === module && (exported === undefined || origin.name === exported)
}

function fetchRequest(context: JavaScriptContext, call: ts.CallExpression): RequestFact | undefined {
  if (!client(context, call.expression, ['fetch'], 'node-fetch', 'default')) return undefined
  const [url, init] = call.arguments
  if (url === undefined) return undefined
  return { ...fetchMethod(context, url, init), ...requestUrl(urlParts(context, url)) }
}

/** jQuery prefers `method` to its older `type`; settings the scan cannot read state no method. */
function ajaxMethod(context: JavaScriptContext, settings: ts.Node | undefined): { method?: string } {
  if (settings === undefined) return { method: 'GET' }
  for (const key of ['method', 'type']) {
    const value = heldAt(context, settings, key)
    if (value === 'absent') continue
    const method = typeof value === 'object' ? methodName(context, value.node) : undefined
    return method === undefined ? {} : { method }
  }
  return { method: 'GET' }
}

/** `$.ajax(settings)`, whose settings state the URL, and `$.ajax(url, settings)`. */
function ajaxRequest(context: JavaScriptContext, call: ts.CallExpression): RequestFact | undefined {
  const [first, second] = call.arguments
  if (first === undefined) return undefined
  if (second !== undefined) return { ...ajaxMethod(context, second), ...requestUrl(urlParts(context, first)) }
  const url = heldAt(context, first, 'url')
  return url === 'absent' ? undefined : { ...ajaxMethod(context, first), ...requestUrl(heldParts(context, url)) }
}

/** The jQuery ajax helpers, whose first argument is the URL. */
function jqueryRequest(context: JavaScriptContext, call: ts.CallExpression): RequestFact | undefined {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !client(context, callee.expression, ['$', 'jQuery'], 'jquery')) return undefined
  const member = callee.name.text
  const method = jqueryHelpers.get(member)
  const [url] = call.arguments
  if (method !== undefined) return url === undefined ? undefined : { method, ...requestUrl(urlParts(context, url)) }
  return member === 'ajax' ? ajaxRequest(context, call) : undefined
}

/** The request one call sends, when the call reaches a recognized client. */
export function httpRequest(context: JavaScriptContext, call: ts.CallExpression): RequestFact | undefined {
  return fetchRequest(context, call) ?? axiosRequest(context, call) ?? jqueryRequest(context, call)
}
