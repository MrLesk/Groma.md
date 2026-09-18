import type { ScanHttpRequest } from '@groma/scanner'
import { typeName, type FileScope } from './http-endpoints.ts'
import { literalText, requestUrl, type Constants, type RequestUrl } from './http-url.ts'
import { children, field, list, memberOf, nameOf, type Fields, type Syntax } from './syntax.ts'

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

function methodToken(node: Fields | undefined, constants: Constants): string | undefined {
  const written = literalText(node, constants)?.toUpperCase()
  return written !== undefined && /^[A-Z][A-Z-]*$/.test(written) ? written : undefined
}

/**
 * HTTP clients this scanner recognizes. Ordinary objects share the member names, so a call counts
 * only when its receiver is proved to hold one of these.
 */
const clientTypes = new Set([
  'GuzzleHttp\\Client', 'GuzzleHttp\\ClientInterface', 'Psr\\Http\\Client\\ClientInterface',
  'Symfony\\Contracts\\HttpClient\\HttpClientInterface',
])

function isClientType(node: Fields | undefined, scope: FileScope): boolean {
  const name = typeName(node, scope)
  return name !== undefined && clientTypes.has(name)
}

/** The name a `new Client(...)` assignment binds, such as `$client` in `$client = new Client(...)`. */
function boundClient(node: Fields, scope: FileScope): string | undefined {
  if (node.kind !== 'assign' || field(node, 'right')?.kind !== 'new') return undefined
  const created = field(node, 'right')!
  const target = field(node, 'left')
  if (!isClientType(field(created, 'what'), scope) || target?.kind !== 'variable') return undefined
  return typeof target.name === 'string' ? target.name : undefined
}

/**
 * Names that hold a client in this declaration: a typed parameter, a constructor-promoted or
 * declared property, and a variable bound to `new Client(...)`.
 */
export function clientNames(node: Syntax, scope: FileScope): string[] {
  const names: string[] = []
  function visit(current: Syntax): void {
    const fields = current as Fields
    if ((fields.kind === 'parameter' || fields.kind === 'property') && isClientType(field(fields, 'type'), scope)) {
      const name = nameOf(field(fields, 'name'))
      if (name !== undefined) names.push(name)
    }
    const bound = boundClient(fields, scope)
    if (bound !== undefined) names.push(bound)
    for (const child of children(current)) visit(child)
  }
  visit(node)
  return names
}

/** The receiver of a member call as a name this file can prove: `$client` or `$this->http`. */
function receiverName(call: Fields): string | undefined {
  const receiver = field(field(call, 'what')!, 'what')
  if (receiver?.kind === 'variable' && typeof receiver.name === 'string') return receiver.name
  if (receiver?.kind !== 'propertylookup' || field(receiver, 'what')?.name !== 'this') return undefined
  return nameOf(field(receiver, 'offset'))
}

/** The plain function a call names, such as `wp_remote_get`. */
function functionName(call: Fields): string | undefined {
  return call.kind === 'call' ? nameOf(field(call, 'what'))?.replace(/^\\/, '') : undefined
}

/**
 * A client whose own base URL the application configures, such as a Guzzle client's `base_uri`,
 * called as `$client->get($url)` or `$client->request('GET', $url)`.
 */
function clientRequest(call: Fields, scope: FileScope): SentRequest[] {
  const receiver = receiverName(call)
  if (receiver === undefined || !scope.clients.has(receiver)) return []
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
  const name = functionName(call)
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

/** A URL or method a cURL call states; the handle they belong to is not tracked. */
export interface CurlPart {
  url?: RequestUrl
  method?: string
}

/** Options that state the URL or the method of a cURL request. */
function curlOption(option: string | undefined, value: Fields | undefined, constants: Constants): CurlPart | undefined {
  if (option === 'CURLOPT_URL') return { url: requestUrl(value, constants, false) }
  if (option === 'CURLOPT_CUSTOMREQUEST') {
    const method = methodToken(value, constants)
    return method === undefined ? undefined : { method }
  }
  return option === 'CURLOPT_POST' && value?.kind === 'boolean' && value.value === true ? { method: 'POST' } : undefined
}

/**
 * What a `curl_init`, `curl_setopt` or `curl_setopt_array` call states. The parts of one operation
 * are combined by the file walk, which does not follow which handle each part configures.
 */
export function curlParts(call: Fields, constants: Constants): CurlPart[] {
  const name = functionName(call)
  const args = list(call, 'arguments')
  if (name === 'curl_init') return args.length === 0 ? [] : [{ url: requestUrl(args[0], constants, false) }]
  if (name === 'curl_setopt') {
    const part = curlOption(nameOf(args[1]), args[2], constants)
    return part === undefined ? [] : [part]
  }
  if (name !== 'curl_setopt_array' || args[1]?.kind !== 'array') return []
  return list(args[1], 'items').flatMap(item => {
    const part = curlOption(nameOf(field(item, 'key')), field(item, 'value'), constants)
    return part === undefined ? [] : [part]
  })
}
