import type { ScanHttpRequest } from '@groma/scanner'
import {
  isCallExpression, isIdentifier, isPropertyAccessExpression, isVariableDeclaration, NodeFlags,
  type CallExpression, type Node,
} from 'typescript/unstable/ast'

import { requestUrl, type UrlPart } from './http-paths.ts'
import {
  declarationOf, importOrigin, literalText, methodName, objectValue, propertyValue, urlParts,
  type HttpContext,
} from './http-values.ts'

const shorthand = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

/** A declaration in project source means a local function, not the runtime client. */
function localDeclaration(declaration: Node | undefined): boolean {
  return declaration !== undefined && !declaration.getSourceFile().fileName.endsWith('.d.ts')
}

async function initMethod(init: Node | undefined, context: HttpContext): Promise<{ method?: string }> {
  if (init === undefined) return { method: 'GET' }
  const options = await objectValue(init, context)
  if (options === undefined) return {}
  const value = propertyValue(options, 'method')
  if (value === undefined) return { method: 'GET' }
  const method = methodName(await literalText(value, context))
  return method === undefined ? {} : { method }
}

async function fetchRequest(call: CallExpression, context: HttpContext): Promise<ScanHttpRequest | undefined> {
  const callee = call.expression
  if (!isIdentifier(callee) || callee.text !== 'fetch') return undefined
  if (localDeclaration(await declarationOf(callee, context.checker))) return undefined
  const [url, init] = call.arguments
  if (url === undefined) return undefined
  return {
    operation: context.callerOperation(call),
    ...await initMethod(init, context),
    ...requestUrl(await urlParts(url, context)),
  }
}

/** The axios default export; a named import such as `isAxiosError` is not a client. */
function isAxios(node: Node): boolean {
  const origin = importOrigin(node)
  return origin?.module === 'axios' && origin.name === 'default'
}

/** `axios` itself, or an instance from `axios.create`, whose `baseURL` starts every path. */
async function axiosClient(node: Node, context: HttpContext): Promise<{ base: UrlPart[] } | undefined> {
  if (!isIdentifier(node)) return undefined
  if (isAxios(node)) return { base: [] }
  const declaration = await declarationOf(node, context.checker)
  if (declaration === undefined || !isVariableDeclaration(declaration) || !declaration.initializer) return undefined
  // A reassignable instance can change its base, so only a constant states one.
  if (!(declaration.parent.flags & NodeFlags.Const)) return undefined
  const initializer = declaration.initializer
  if (!isCallExpression(initializer) || !isPropertyAccessExpression(initializer.expression)) return undefined
  const created = initializer.expression
  if (created.name.text !== 'create' || !isAxios(created.expression)) return undefined
  const config = await objectValue(initializer.arguments[0], context)
  const baseUrl = config === undefined ? undefined : propertyValue(config, 'baseURL')
  return { base: baseUrl === undefined ? [] : await urlParts(baseUrl, context) }
}

async function urlRequest(
  call: CallExpression, base: UrlPart[], method: string | undefined, url: Node | undefined, context: HttpContext,
): Promise<ScanHttpRequest | undefined> {
  if (url === undefined) return undefined
  return {
    operation: context.callerOperation(call),
    ...(method === undefined ? {} : { method }),
    ...requestUrl([...base, ...await urlParts(url, context)]),
  }
}

/** The `axios(config)` and `axios.request(config)` forms, whose method defaults to GET. */
async function configRequest(
  call: CallExpression, base: UrlPart[], config: Node | undefined, context: HttpContext,
): Promise<ScanHttpRequest | undefined> {
  const options = await objectValue(config, context)
  if (options === undefined) return undefined
  const declared = propertyValue(options, 'method')
  const method = declared === undefined ? 'GET' : methodName(await literalText(declared, context))
  return urlRequest(call, base, method, propertyValue(options, 'url'), context)
}

async function axiosRequest(call: CallExpression, context: HttpContext): Promise<ScanHttpRequest | undefined> {
  const callee = call.expression
  if (isPropertyAccessExpression(callee)) {
    const client = await axiosClient(callee.expression, context)
    if (client === undefined) return undefined
    const method = shorthand.get(callee.name.text)
    if (method !== undefined) return urlRequest(call, client.base, method, call.arguments[0], context)
    return callee.name.text === 'request' ? configRequest(call, client.base, call.arguments[0], context) : undefined
  }
  const client = await axiosClient(callee, context)
  if (client === undefined) return undefined
  const [first, second] = call.arguments
  if (await objectValue(first, context) !== undefined) return configRequest(call, client.base, first, context)
  const { method } = await initMethod(second, context)
  return urlRequest(call, client.base, method, first, context)
}

/** Requests the supported clients send; anything computed stays in the fact as unknown text. */
export async function httpRequests(calls: readonly CallExpression[], context: HttpContext): Promise<ScanHttpRequest[]> {
  const requests: ScanHttpRequest[] = []
  for (const call of calls) {
    const request = await fetchRequest(call, context) ?? await axiosRequest(call, context)
    if (request !== undefined) requests.push(request)
  }
  return requests
}
