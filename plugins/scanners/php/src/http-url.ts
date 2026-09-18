import type { HttpEndpointSegment, HttpRequestSegment } from '@groma/scanner'
import { field, list, nameOf, type Fields } from './syntax.ts'

/**
 * Text the source proves, a computed value it does not, or a base the application reads from
 * configuration, such as a WordPress site URL.
 */
export type TextPart = { kind: 'literal'; value: string } | { kind: 'computed' } | { kind: 'base' }

/** Constant values declared once in the file being read, by their bare name. */
export type Constants = ReadonlyMap<string, string | undefined>

/** A constant referenced as `NAME`, `self::NAME` or `Type::NAME`; a name declared twice proves nothing. */
function constantText(node: Fields, constants: Constants): string | undefined {
  const name = node.kind === 'name' ? String(node.name)
    : node.kind === 'staticlookup' ? nameOf(field(node, 'offset')) : undefined
  return name === undefined ? undefined : constants.get(name.replace(/^\\/, ''))
}

/** Calls that answer with this site's own root, which the scanner cannot resolve to text. */
const baseCalls = new Set([
  'rest_url', 'get_rest_url', 'home_url', 'get_home_url', 'site_url', 'get_site_url', 'admin_url', 'get_admin_url',
])

/** A site-root call contributes a configured base followed by its own literal path argument. */
function baseCallParts(node: Fields, constants: Constants): TextPart[] | undefined {
  if (node.kind !== 'call') return undefined
  const name = nameOf(field(node, 'what'))?.replace(/^\\/, '')
  if (name === undefined || !baseCalls.has(name)) return undefined
  const [argument] = list(node, 'arguments')
  return [{ kind: 'base' }, ...(argument === undefined ? [] : textParts(argument, constants))]
}

/** The text of a URL or route expression, part by part. Concatenation and interpolation keep their order. */
export function textParts(node: Fields | undefined, constants: Constants): TextPart[] {
  if (node === undefined) return [{ kind: 'computed' }]
  if (node.kind === 'string' || node.kind === 'nowdoc') return [{ kind: 'literal', value: String(node.value) }]
  if (node.kind === 'encapsed') return list(node, 'value').flatMap(part => textParts(field(part, 'expression'), constants))
  if (node.kind === 'bin' && node.type === '.') {
    return [...textParts(field(node, 'left'), constants), ...textParts(field(node, 'right'), constants)]
  }
  const base = baseCallParts(node, constants)
  if (base !== undefined) return base
  const constant = constantText(node, constants)
  return constant === undefined ? [{ kind: 'computed' }] : [{ kind: 'literal', value: constant }]
}

/** The literal text of an expression, or undefined when any part is not literal. */
export function literalText(node: Fields | undefined, constants: Constants): string | undefined {
  const parts = textParts(node, constants)
  if (!parts.every(part => part.kind === 'literal')) return undefined
  return parts.map(part => (part as { kind: 'literal'; value: string }).value).join('')
}

/** A request URL as the fact format states it: the path, and whether a configured base precedes it. */
export interface RequestUrl {
  configured?: true
  path: HttpRequestSegment[]
}

const authority = /^(?:[A-Za-z][\w+.-]*:)?\/\//

/** One whole computed segment is dynamic; text that mixes computed and literal parts is unknown. */
function closeSegment(text: string, computed: number): HttpRequestSegment[] {
  if (computed > 0) return [{ kind: computed === 1 && text === '' ? 'dynamic' : 'unknown' }]
  if (text === '') return []
  return [pathSegment.test(text) ? { kind: 'literal', value: text } : { kind: 'unknown' }]
}

/** Segments of the path these parts spell, ending at the query or fragment. */
function segmentsOf(parts: readonly TextPart[]): HttpRequestSegment[] {
  const segments: HttpRequestSegment[] = []
  let text = ''
  let computed = 0
  for (const part of parts) {
    if (part.kind !== 'literal') {
      computed++
      continue
    }
    const end = part.value.search(/[?#]/)
    const pieces = (end < 0 ? part.value : part.value.slice(0, end)).split('/')
    for (const [index, piece] of pieces.entries()) {
      if (index > 0) {
        segments.push(...closeSegment(text, computed))
        text = ''
        computed = 0
      }
      text += piece
    }
    if (end >= 0) break
  }
  return [...segments, ...closeSegment(text, computed)]
}

/**
 * The URL an expression states. A scheme or authority means the request leaves this application's
 * root, which the fact format reports as a leading unknown segment.
 */
export function requestUrl(node: Fields | undefined, constants: Constants, configuredBase: boolean): RequestUrl {
  const [head, ...rest] = textParts(node, constants)
  if (head?.kind === 'base') return { configured: true, path: segmentsOf(rest) }
  // A base the scanner cannot resolve, or one that states a host, is the leading unknown segment.
  if (head === undefined || head.kind === 'computed') return { path: [{ kind: 'unknown' }, ...segmentsOf(rest)] }
  if (authority.test(head.value)) {
    const start = head.value.indexOf('/', head.value.indexOf('//') + 2)
    const remainder: TextPart[] = start < 0 ? [] : [{ kind: 'literal', value: head.value.slice(start) }, ...rest]
    return { path: [{ kind: 'unknown' }, ...segmentsOf(remainder)] }
  }
  return { ...(configuredBase ? { configured: true } : {}), path: segmentsOf([head, ...rest]) }
}

/**
 * One path from parts that must all be known. An unresolved part, such as a group prefix the source
 * computes, leaves the whole path unknown, because no literal path can stand for it.
 */
export function joinPath(...parts: (string | undefined)[]): string | undefined {
  return parts.some(part => part === undefined) ? undefined : parts.filter(part => part !== '').join('/')
}

/** A route parameter written as `{id}`, `{id?}`, `{id<regex>}`, `{id:regex}` or `(?P<id>regex)`. */
const routeParameter = /^(?:\{(\w+)(\?)?(?:[<:][^{}]*)?\}|\(\?P<(\w+)>.*\))$/

/**
 * The segments of a literal route, or undefined when a segment is neither a whole literal nor a
 * whole parameter, such as `/talks/item-{id}`. Reporting such a route would claim a path the
 * application does not serve.
 */
export function routeSegments(route: string): HttpEndpointSegment[] | undefined {
  const segments: HttpEndpointSegment[] = []
  for (const part of route.split('/')) {
    if (part === '') continue
    const parameter = routeParameter.exec(part)
    if (parameter) {
      segments.push({ kind: 'parameter', name: parameter[1] ?? parameter[3]!, ...(parameter[2] ? { optional: true } : {}) })
      continue
    }
    if (/[{}()<>[\]]/.test(part) || !pathSegment.test(part)) return undefined
    segments.push({ kind: 'literal', value: part })
  }
  return segments
}

/** Characters the fact format accepts in literal text; other text cannot be reported as a literal. */
const pathSegment = /^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$/
