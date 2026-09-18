import type { HttpRequestSegment } from '@groma/scanner'
import { calledFunction, field, list, type Fields } from './syntax.ts'

/**
 * Text the source proves, a computed value it does not, or a base the application reads from
 * configuration, such as a WordPress site URL.
 */
export type TextPart = { kind: 'literal'; value: string } | { kind: 'computed' } | { kind: 'base' }

/**
 * The literal value a constant reference such as `NAME`, `self::NAME` or `Type::NAME` names, when the
 * file being read declares that constant once; undefined for any other expression.
 */
export type Constants = (reference: Fields) => string | undefined

/** Calls that answer with this site's own root, which the scanner cannot resolve to text. */
const baseCalls = new Set([
  'rest_url', 'get_rest_url', 'home_url', 'get_home_url', 'site_url', 'get_site_url', 'admin_url', 'get_admin_url',
])

/**
 * A site-root call contributes a configured base. WordPress joins the call's path argument to the
 * root with a slash, so the argument starts a new segment.
 */
function baseCallParts(node: Fields, constants: Constants): TextPart[] | undefined {
  const name = calledFunction(node)
  if (name === undefined || !baseCalls.has(name)) return undefined
  const [argument] = list(node, 'arguments')
  if (argument === undefined) return [{ kind: 'base' }]
  return [{ kind: 'base' }, { kind: 'literal', value: '/' }, ...textParts(argument, constants)]
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
  const constant = constants(node)
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
  const [next] = rest
  // Text that does not start a new segment after the base continues the base's own last segment.
  if (head?.kind === 'base' && (rest.length === 0 || (next?.kind === 'literal' && next.value.startsWith('/')))) {
    return { configured: true, path: segmentsOf(rest) }
  }
  // A base the scanner cannot resolve, or one that states a host, is the leading unknown segment.
  if (head === undefined || head.kind !== 'literal') return { path: [{ kind: 'unknown' }, ...segmentsOf(rest)] }
  if (authority.test(head.value)) {
    const start = head.value.indexOf('/', head.value.indexOf('//') + 2)
    const remainder: TextPart[] = start < 0 ? [] : [{ kind: 'literal', value: head.value.slice(start) }, ...rest]
    return { path: [{ kind: 'unknown' }, ...segmentsOf(remainder)] }
  }
  return { ...(configuredBase ? { configured: true } : {}), path: segmentsOf([head, ...rest]) }
}

/**
 * A route, or a route prefix, as far as the source states it. An unresolved one, such as a group
 * prefix the source computes, keeps the whole segments its literal text states before that part.
 */
export interface RouteText {
  text: string
  resolved: boolean
}

export const noRoute: RouteText = { text: '', resolved: true }

/** A prefix nothing in the source states. */
export const unresolvedRoute: RouteText = { text: '', resolved: false }

/** The route text an expression states. */
export function routeText(node: Fields | undefined, constants: Constants): RouteText {
  const parts = textParts(node, constants)
  const unresolved = parts.findIndex(part => part.kind !== 'literal')
  const literal = parts.slice(0, unresolved < 0 ? parts.length : unresolved)
    .map(part => (part as { value: string }).value).join('')
  return unresolved < 0 ? { text: literal, resolved: true } : { text: literal.slice(0, literal.lastIndexOf('/') + 1), resolved: false }
}

/** One route from its parts in order; the first unresolved part ends it. */
export function joinRoutes(...parts: RouteText[]): RouteText {
  const end = parts.findIndex(part => !part.resolved)
  const stated = end < 0 ? parts : parts.slice(0, end + 1)
  return { text: stated.map(part => part.text).filter(text => text !== '').join('/'), resolved: end < 0 }
}

/** Characters the fact format accepts in literal text; other text cannot be reported as a literal. */
export const pathSegment = /^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$/
