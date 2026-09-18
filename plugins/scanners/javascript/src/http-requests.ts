import type { ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { requestUrl, type UrlPart } from '../../http-url.ts'
import { methodName, urlParts } from '../../http-values.ts'
import { instanceValue, objectValue, propertyValue, type HttpReader } from './http-reads.ts'

// The supported clients follow the reference ../../typescript/src/http-requests.ts; change both together.

const shorthand = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])

/** jQuery helpers whose own name states the method. */
const jqueryHelpers = new Map([
  ['get', 'GET'], ['getJSON', 'GET'], ['getScript', 'GET'], ['post', 'POST'],
])

/** The runtime's own `fetch`, or one this file imports from `node-fetch`; a local `fetch` is not it. */
function isFetch(reader: HttpReader, callee: ts.Node): boolean {
  if (!ts.isIdentifier(callee) || callee.text !== 'fetch') return false
  const origin = reader.scope.originOf(callee)
  if (origin !== undefined) return origin.module === 'node-fetch' && origin.name === 'default'
  return reader.scope.declarationOf(callee) === undefined
}

/** A request without options is a GET; options the scanner cannot read state no method. */
function initMethod(reader: HttpReader, init: ts.Node | undefined): { method?: string } {
  if (init === undefined) return { method: 'GET' }
  const options = objectValue(reader, init)
  if (options === undefined) return {}
  const declared = propertyValue(options, 'method')
  if (declared === undefined) return { method: 'GET' }
  const method = methodName(reader, declared)
  return method === undefined ? {} : { method }
}

function fetchRequest(reader: HttpReader, call: ts.CallExpression, operation: string): ScanHttpRequest | undefined {
  if (!isFetch(reader, call.expression)) return undefined
  const [url, init] = call.arguments
  if (url === undefined) return undefined
  return { operation, ...initMethod(reader, init), ...requestUrl(urlParts(reader, url)) }
}

/** The axios default export, however this file imports or requires it. */
function isAxios(reader: HttpReader, node: ts.Node): boolean {
  const origin = reader.scope.originOf(node)
  return origin?.module === 'axios' && origin.name === 'default'
}

/** `axios` itself, or an instance from `axios.create`, whose `baseURL` starts every path. */
function axiosClient(reader: HttpReader, node: ts.Node): { base: UrlPart[] } | undefined {
  if (!ts.isIdentifier(node)) return undefined
  if (isAxios(reader, node)) return { base: [] }
  const created = instanceValue(reader, node)
  if (created === undefined || !ts.isCallExpression(created)) return undefined
  const callee = created.expression
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'create') return undefined
  if (!isAxios(reader, callee.expression)) return undefined
  const config = objectValue(reader, created.arguments[0])
  const baseUrl = config === undefined ? undefined : propertyValue(config, 'baseURL')
  return { base: baseUrl === undefined ? [] : urlParts(reader, baseUrl) }
}

function urlRequest(
  reader: HttpReader, operation: string, base: UrlPart[], method: string | undefined, url: ts.Node | undefined,
): ScanHttpRequest | undefined {
  if (url === undefined) return undefined
  return {
    operation,
    ...(method === undefined ? {} : { method }),
    ...requestUrl([...base, ...urlParts(reader, url)]),
  }
}

/** The `axios(config)` and `axios.request(config)` forms, whose method defaults to GET. */
function configRequest(
  reader: HttpReader, operation: string, base: UrlPart[], config: ts.Node | undefined,
): ScanHttpRequest | undefined {
  const options = objectValue(reader, config)
  if (options === undefined) return undefined
  const declared = propertyValue(options, 'method')
  const method = declared === undefined ? 'GET' : methodName(reader, declared)
  return urlRequest(reader, operation, base, method, propertyValue(options, 'url'))
}

function axiosRequest(reader: HttpReader, call: ts.CallExpression, operation: string): ScanHttpRequest | undefined {
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) {
    const client = axiosClient(reader, callee.expression)
    if (client === undefined) return undefined
    const method = shorthand.get(callee.name.text)
    if (method !== undefined) return urlRequest(reader, operation, client.base, method, call.arguments[0])
    return callee.name.text === 'request' ? configRequest(reader, operation, client.base, call.arguments[0]) : undefined
  }
  const client = axiosClient(reader, callee)
  if (client === undefined) return undefined
  const [first, second] = call.arguments
  if (objectValue(reader, first) !== undefined) return configRequest(reader, operation, client.base, first)
  return urlRequest(reader, operation, client.base, initMethod(reader, second).method, first)
}

/** The jQuery global, or the one this file imports; a `$` the file declares itself is not it. */
function isJQuery(reader: HttpReader, node: ts.Node): boolean {
  if (!ts.isIdentifier(node) || (node.text !== '$' && node.text !== 'jQuery')) return false
  const origin = reader.scope.originOf(node)
  if (origin !== undefined) return origin.module === 'jquery'
  return reader.scope.declarationOf(node) === undefined
}

/** `$.ajax({ url, type })` and `$.ajax(url, { type })`; settings the scanner cannot read state nothing. */
function ajaxRequest(reader: HttpReader, call: ts.CallExpression, operation: string): ScanHttpRequest | undefined {
  const [first, second] = call.arguments
  const settings = second === undefined ? objectValue(reader, first) : objectValue(reader, second)
  if (settings === undefined) return undefined
  const url = second === undefined ? propertyValue(settings, 'url') : first
  const declared = propertyValue(settings, 'type') ?? propertyValue(settings, 'method')
  const method = declared === undefined ? 'GET' : methodName(reader, declared)
  return urlRequest(reader, operation, [], method, url)
}

/** The jQuery ajax helpers, whose first argument is the URL. */
function jqueryRequest(reader: HttpReader, call: ts.CallExpression, operation: string): ScanHttpRequest | undefined {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !isJQuery(reader, callee.expression)) return undefined
  const member = callee.name.text
  const method = jqueryHelpers.get(member)
  if (method !== undefined) return urlRequest(reader, operation, [], method, call.arguments[0])
  return member === 'ajax' ? ajaxRequest(reader, call, operation) : undefined
}

/** The request one call sends, when the call reaches a recognized client. */
export function httpRequest(reader: HttpReader, call: ts.CallExpression, operation: string): ScanHttpRequest | undefined {
  return fetchRequest(reader, call, operation)
    ?? axiosRequest(reader, call, operation)
    ?? jqueryRequest(reader, call, operation)
}
