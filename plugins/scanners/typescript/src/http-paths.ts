import type { HttpEndpointSegment, HttpRequestSegment } from '@groma/scanner'

/** RFC 3986 path characters, the literal text the shared contract accepts. */
const pathText = /^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$/
const splat = /^\*([A-Za-z_]\w*)?$/
const parameter = /^:([A-Za-z_]\w*)(\?)?$/
const absolute = /^([A-Za-z][A-Za-z\d+.-]*:)?\/\//

/** One computed expression inside a URL; `configured` marks a value the scanner cannot see. */
export type UrlPart = { kind: 'text'; text: string } | { kind: 'hole'; configured: boolean }

/** A NUL is never valid URL path text, so it cannot collide with a literal segment. */
const HOLE = '\u0000'

function literalValue(text: string): string | undefined {
  return pathText.test(text) ? text : undefined
}

function endpointSegment(part: string, last: boolean): HttpEndpointSegment | undefined {
  const wildcard = splat.exec(part)
  if (wildcard) return last ? { kind: 'catch-all', name: wildcard[1] ?? '*' } : undefined
  const named = parameter.exec(part)
  if (named) return { kind: 'parameter', name: named[1]!, ...(named[2] ? { optional: true } : {}) }
  const value = literalValue(part)
  return value === undefined ? undefined : { kind: 'literal', value }
}

/**
 * Route patterns shared by the supported frameworks: literal text, `:name`, `:name?`, and a
 * trailing `*` or `*name`. Anything else, such as a regular expression or an optional group,
 * is unsupported and reports no endpoint.
 */
export function endpointPath(pattern: string): HttpEndpointSegment[] | undefined {
  const parts = pattern.split('/').filter(part => part !== '')
  const segments: HttpEndpointSegment[] = []
  for (const [index, part] of parts.entries()) {
    const segment = endpointSegment(part, index === parts.length - 1)
    if (segment === undefined) return undefined
    segments.push(segment)
  }
  return segments
}

function requestSegment(part: string): HttpRequestSegment {
  if (part === HOLE) return { kind: 'dynamic' }
  if (part.includes(HOLE)) return { kind: 'unknown' }
  const value = literalValue(part)
  return value === undefined ? { kind: 'unknown' } : { kind: 'literal', value }
}

/** The path stops before the query and fragment, whose text never reaches the fact. */
function segmentsOf(parts: readonly UrlPart[]): HttpRequestSegment[] {
  const url = parts.map(part => part.kind === 'text' ? part.text : HOLE).join('')
  const end = Math.min(...['?', '#'].map(mark => url.includes(mark) ? url.indexOf(mark) : url.length))
  return url.slice(0, end).split('/').filter(part => part !== '').map(requestSegment)
}

/** A literal scheme and authority state a host, which is never comparable path text. */
function afterAuthority(text: string): string {
  const slash = text.indexOf('/', text.indexOf('//') + 2)
  return slash < 0 ? '' : text.slice(slash)
}

/**
 * Turn a resolved URL into the request fact. A base the scanner resolves to a host, or cannot
 * resolve at all, becomes a leading unknown segment; only a configuration value sets `configured`.
 */
export function requestUrl(input: readonly UrlPart[]): { configured?: true; path: HttpRequestSegment[] } {
  const parts = input.filter(part => part.kind === 'hole' || part.text !== '')
  const [first, ...rest] = parts
  if (first === undefined) return { path: [{ kind: 'unknown' }] }
  if (first.kind === 'hole') {
    const path = segmentsOf(rest)
    return first.configured ? { configured: true, path } : { path: [{ kind: 'unknown' }, ...path] }
  }
  if (absolute.test(first.text)) {
    return { path: [{ kind: 'unknown' }, ...segmentsOf([{ kind: 'text', text: afterAuthority(first.text) }, ...rest])] }
  }
  if (!first.text.startsWith('/')) return { path: [{ kind: 'unknown' }, ...segmentsOf(parts)] }
  return { path: segmentsOf(parts) }
}
