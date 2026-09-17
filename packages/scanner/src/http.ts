import { array, object } from './values.ts'

/** One segment of an endpoint path as the application declares it. */
export type HttpEndpointSegment =
  | { kind: 'literal'; value: string }
  /** One segment with any text; an optional parameter also matches no segment. */
  | { kind: 'parameter'; name: string; optional?: boolean }
  /** The remaining segments: at least one, or any number when optional. Always last. */
  | { kind: 'catch-all'; name: string; optional?: boolean }

/** One segment of a request path, as far as the source proves its text. */
export type HttpRequestSegment =
  | { kind: 'literal'; value: string }
  /** One whole segment whose value the source computes. */
  | { kind: 'dynamic' }
  /** Text the source does not fully prove: part of one segment, or the rest of the path. */
  | { kind: 'unknown' }

/** An HTTP endpoint the application serves, including one declared by file location. */
export interface ScanHttpEndpoint {
  /** Operation that handles the requests. */
  operation: string
  /** Uppercase method, or `*` when the endpoint accepts every method. */
  method: string
  /** Complete path the application serves, with every prefix the source declares. */
  path: HttpEndpointSegment[]
}

/** An HTTP request the application sends. */
export interface ScanHttpRequest {
  /**
   * Operation that supplies the URL. A local helper's caller supplies it only when the helper
   * passes that URL and method to a recognized client unchanged.
   */
  operation: string
  /** Uppercase method; omitted when the source does not prove it. */
  method?: string
  /**
   * The path follows a value the application reads from configuration, such as an API URL
   * setting. A base the scanner resolves to a host, or cannot resolve at all, is instead a
   * leading `unknown` segment.
   */
  configured?: boolean
  /** Path after any base, ending before the query and fragment. */
  path: HttpRequestSegment[]
}

/** RFC 3986 path characters, which exclude `/`, `?`, `#`, braces and table separators. */
const pathText = /^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$/
const methodToken = /^[A-Z][A-Z-]*$/

function fail(message: string): never {
  throw new Error(message)
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !pathText.test(value)) fail(`${label} must be nonempty URL path characters`)
  return value
}

function method(value: unknown, label: string, anyMethod: boolean): string {
  if (typeof value !== 'string' || !(methodToken.test(value) || (anyMethod && value === '*'))) {
    fail(`${label} must be an uppercase HTTP method${anyMethod ? ' or *' : ''}`)
  }
  return value
}

function operation(value: unknown, operations: ReadonlySet<string>): string {
  if (typeof value !== 'string' || !operations.has(value)) fail('HTTP fact references unknown operation')
  return value
}

function endpointSegment(value: unknown, last: boolean): HttpEndpointSegment {
  const segment = object(value, 'HTTP endpoint segment')
  if (segment.kind === 'literal') return { kind: 'literal', value: text(segment.value, 'HTTP literal segment') }
  if (segment.kind !== 'parameter' && segment.kind !== 'catch-all') fail(`unknown HTTP endpoint segment kind: ${String(segment.kind)}`)
  if (segment.kind === 'catch-all' && !last) fail('an HTTP catch-all segment must be last')
  if (segment.optional !== undefined && typeof segment.optional !== 'boolean') fail('HTTP segment optional must be a boolean')
  return { kind: segment.kind, name: text(segment.name, 'HTTP segment name'), ...(segment.optional ? { optional: true } : {}) }
}

function requestSegment(value: unknown): HttpRequestSegment {
  const segment = object(value, 'HTTP request segment')
  if (segment.kind === 'literal') return { kind: 'literal', value: text(segment.value, 'HTTP literal segment') }
  if (segment.kind === 'dynamic' || segment.kind === 'unknown') return { kind: segment.kind }
  return fail(`unknown HTTP request segment kind: ${String(segment.kind)}`)
}

function endpoint(value: unknown, operations: ReadonlySet<string>): ScanHttpEndpoint {
  const fact = object(value, 'HTTP endpoint')
  const path = array(fact.path, 'HTTP endpoint path')
  return {
    operation: operation(fact.operation, operations),
    method: method(fact.method, 'HTTP endpoint method', true),
    path: path.map((segment, index) => endpointSegment(segment, index === path.length - 1)),
  }
}

function request(value: unknown, operations: ReadonlySet<string>): ScanHttpRequest {
  const fact = object(value, 'HTTP request')
  if (fact.configured !== undefined && typeof fact.configured !== 'boolean') fail('HTTP request configured must be a boolean')
  return {
    operation: operation(fact.operation, operations),
    ...(fact.method === undefined ? {} : { method: method(fact.method, 'HTTP request method', false) }),
    ...(fact.configured ? { configured: true } : {}),
    path: array(fact.path, 'HTTP request path').map(requestSegment),
  }
}

/** Validate HTTP facts against the observation's declared operations. */
export function httpEvidence(
  endpoints: unknown,
  requests: unknown,
  operations: ReadonlySet<string> | undefined,
): { httpEndpoints?: ScanHttpEndpoint[]; httpRequests?: ScanHttpRequest[] } {
  if (endpoints === undefined && requests === undefined) return {}
  if (operations === undefined) fail('HTTP facts require operation declarations')
  return {
    ...(endpoints === undefined ? {} : { httpEndpoints: array(endpoints, 'httpEndpoints').map(fact => endpoint(fact, operations)) }),
    ...(requests === undefined ? {} : { httpRequests: array(requests, 'httpRequests').map(fact => request(fact, operations)) }),
  }
}
