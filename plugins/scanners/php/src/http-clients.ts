import type { ScanHttpRequest } from '@groma/scanner'
import type { FileScope } from './http-endpoints.ts'
import { literalText, requestUrl, type Constants } from './http-url.ts'
import { proved } from './receivers.ts'
import { calledFunction, field, list, memberOf, receiverOf, type Fields } from './syntax.ts'

/** A request without the operation that sends it, which the file walk supplies. */
export type SentRequest = Omit<ScanHttpRequest, 'operation'>

/** Client members that name the method, as Guzzle and clients modelled on it spell them. */
const clientMethods = new Map([
  ['get', 'GET'], ['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH'],
  ['delete', 'DELETE'], ['head', 'HEAD'], ['options', 'OPTIONS'],
])
const wordpressMethods = new Map([
  ['wp_remote_get', 'GET'], ['wp_safe_remote_get', 'GET'], ['wp_remote_post', 'POST'],
  ['wp_safe_remote_post', 'POST'], ['wp_remote_head', 'HEAD'], ['wp_safe_remote_head', 'HEAD'],
])
const wordpressRequest = new Set(['wp_remote_request', 'wp_safe_remote_request'])

/** A method name the source states literally, such as `'GET'`. */
export function methodToken(node: Fields | undefined, constants: Constants): string | undefined {
  const written = literalText(node, constants)?.toUpperCase()
  return written !== undefined && /^[A-Z][A-Z-]*$/.test(written) ? written : undefined
}

/**
 * A client whose own base URL the application configures, such as a Guzzle client's `base_uri`,
 * called as `$client->get($url)` or `$client->request('GET', $url)`.
 */
function clientRequest(call: Fields, scope: FileScope): SentRequest[] {
  if (proved(receiverOf(call), scope)?.role !== 'client') return []
  const member = memberOf(call)?.toLowerCase().replace(/async$/, '')
  const args = list(call, 'arguments')
  if (member === 'request') {
    const method = methodToken(args[0], scope.constants)
    return method === undefined ? [] : [{ method, ...requestUrl(args[1], scope.constants, true) }]
  }
  const method = member === undefined ? undefined : clientMethods.get(member)
  return method === undefined ? [] : [{ method, ...requestUrl(args[0], scope.constants, true) }]
}

/** The WordPress HTTP API, whose function name states the method except for `wp_remote_request`. */
function wordpressRequests(call: Fields, constants: Constants): SentRequest[] {
  const name = calledFunction(call)
  if (name === undefined) return []
  const [url, options] = list(call, 'arguments')
  const named = wordpressMethods.get(name)
  if (named !== undefined) return [{ method: named, ...requestUrl(url, constants, false) }]
  if (!wordpressRequest.has(name)) return []
  const entry = options?.kind === 'array'
    ? list(options, 'items').find(item => literalText(field(item, 'key'), constants)?.toLowerCase() === 'method')
    : undefined
  const method = methodToken(entry === undefined ? undefined : field(entry, 'value'), constants)
  return [{ ...(method === undefined ? {} : { method }), ...requestUrl(url, constants, false) }]
}

/** Requests one call sends, by any client this scanner recognizes. */
export function clientRequests(call: Fields, scope: FileScope): SentRequest[] {
  const wordpress = wordpressRequests(call, scope.constants)
  return wordpress.length > 0 ? wordpress : clientRequest(call, scope)
}
