import ts from 'typescript'
import { axiosRequest, fetchRequest, runtimeFetch, type RequestFact } from '../../http-clients.ts'
import { requestUrl } from '../../http-url.ts'
import { heldAt, heldParts, importOrigin, methodName, runtimeGlobal, urlParts, type UrlContext } from '../../http-values.ts'

/** jQuery helpers whose own name states the method. */
const jqueryHelpers = new Map([
  ['get', 'GET'], ['getJSON', 'GET'], ['getScript', 'GET'], ['post', 'POST'],
])

/** The `$` or `jQuery` the page provides, or the one the file imports or requires from `jquery`; one it declares is not it. */
async function isJQuery(context: UrlContext, node: ts.Node): Promise<boolean> {
  if (!ts.isIdentifier(node) || (node.text !== '$' && node.text !== 'jQuery')) return false
  const origin = await importOrigin(context, node)
  return origin === undefined ? runtimeGlobal(context, node) : origin.module === 'jquery'
}

/** jQuery prefers `method` to its older `type`; settings the scan cannot read state no method. */
async function ajaxMethod(context: UrlContext, settings: ts.Node | undefined): Promise<{ method?: string }> {
  if (settings === undefined) return { method: 'GET' }
  for (const key of ['method', 'type']) {
    const value = await heldAt(context, settings, key)
    if (value === 'absent') continue
    const method = typeof value === 'object' ? await methodName(context, value.node) : undefined
    return method === undefined ? {} : { method }
  }
  return { method: 'GET' }
}

/** `$.ajax(settings)`, whose settings state the URL, and `$.ajax(url, settings)`. */
async function ajaxRequest(context: UrlContext, call: ts.CallExpression): Promise<RequestFact | undefined> {
  const [first, second] = call.arguments
  if (first === undefined) return undefined
  if (second !== undefined) return { ...await ajaxMethod(context, second), ...requestUrl(await urlParts(context, first)) }
  const url = await heldAt(context, first, 'url')
  return url === 'absent' ? undefined : { ...await ajaxMethod(context, first), ...requestUrl(await heldParts(context, url)) }
}

/** The jQuery ajax helpers, whose first argument is the URL. */
async function jqueryRequest(context: UrlContext, call: ts.CallExpression): Promise<RequestFact | undefined> {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !await isJQuery(context, callee.expression)) return undefined
  const member = callee.name.text
  const method = jqueryHelpers.get(member)
  const [url] = call.arguments
  if (method !== undefined) return url === undefined ? undefined : { method, ...requestUrl(await urlParts(context, url)) }
  return member === 'ajax' ? ajaxRequest(context, call) : undefined
}

/** The request one call sends, when the call reaches a recognized client. */
export async function httpRequest(context: UrlContext, call: ts.CallExpression): Promise<RequestFact | undefined> {
  return await fetchRequest(context, call, callee => runtimeFetch(context, callee))
    ?? await axiosRequest(context, call)
    ?? jqueryRequest(context, call)
}
