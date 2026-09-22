import type { HttpEndpointSegment } from '@groma/scanner'
import { pathSegment } from './http-url.ts'

/**
 * Patterns a router applies to route parameters by name, such as Laravel's `where` or Symfony's
 * `requirements`. The name `*` stands for every parameter, when the source names them unreadably.
 */
export type Requirements = ReadonlyMap<string, string>

/** Stands for a pattern the scanner cannot read, which may match any text, `/` included. */
export const unreadablePattern = ''

/**
 * A placeholder: `{name}` or `{name?}` (Laravel), `{name<pattern>}` (Symfony), `{name:pattern}` (Slim)
 * or `(?P<name>pattern)` (WordPress). A pattern may itself hold braces, parentheses or `/`.
 */
const placeholder = /\{(\w+)(?:<([^>]*)>)?(\?[^:}]*)?(?::((?:[^{}]|\{[^{}]*\})*))?\}|\(\?P<(\w+)>((?:[^()]|\([^()]*\))*)\)/g

/**
 * A pattern that stays inside one segment: word characters, `\d`, `\w`, classes of those or a
 * negated class that excludes `/`, quantifiers, groups and alternatives. Anything else may match `/`.
 */
const withinSegment = /^(?:\\[dw]|[\w\-|()+*?:]|\[(?:\\[dw]|[\w-])+\]|\[\^[^\]]*\/[^\]]*\]|\{\d+(?:,\d*)?\})+$/

interface Placeholder { name: string; pattern: string | undefined; optional: boolean }
/** Literal text, a placeholder, or the start of a Slim optional group such as `[/{page}]`. */
type Piece = string | Placeholder | { tail: true }

/** The route's segments, each a list of pieces; a Slim optional group ends the route. */
function routePieces(route: string, colonPattern: boolean): Piece[][] {
  const segments: Piece[][] = [[]]
  function text(value: string): boolean {
    const [before, tail] = value.split(/\[(.*)/s)
    for (const [index, part] of before!.split('/').entries()) {
      if (index > 0) segments.push([])
      if (part !== '') segments.at(-1)!.push(part)
    }
    if (tail !== undefined) segments.push([{ tail: true }])
    return tail !== undefined
  }
  let at = 0
  for (const match of route.matchAll(placeholder)) {
    if (text(route.slice(at, match.index))) return segments.filter(pieces => pieces.length > 0)
    segments.at(-1)!.push({ name: (match[1] ?? match[5])!,
      pattern: match[2] ?? (colonPattern ? match[4] : undefined) ?? match[6], optional: match[3] !== undefined })
    at = match.index + match[0].length
  }
  text(route.slice(at))
  return segments.filter(pieces => pieces.length > 0)
}

function isPlaceholder(piece: Piece): piece is Placeholder {
  return typeof piece === 'object' && 'name' in piece
}

/** The pattern a placeholder states inline, or the one its router states for it by name. */
function patternOf(piece: Placeholder, requirements: Requirements): string | undefined {
  return piece.pattern ?? requirements.get(piece.name) ?? requirements.get('*')
}

/** A pattern that can match only text inside one path segment. */
export function staysInSegment(pattern: string): boolean {
  return withinSegment.test(pattern)
}

/** Literal text, or a placeholder whose pattern, if any, stays inside its segment. */
function pieceInSegment(piece: Piece, requirements: Requirements): boolean {
  if (typeof piece === 'string') return pathSegment.test(piece)
  const pattern = isPlaceholder(piece) ? patternOf(piece, requirements) : unreadablePattern
  return pattern === undefined || staysInSegment(pattern)
}

/** A segment that is one placeholder: a parameter, or a catch-all for `.*` or `.+` in the last segment. */
function placeholderSegment(piece: Placeholder, requirements: Requirements, last: boolean): HttpEndpointSegment | undefined {
  const pattern = patternOf(piece, requirements)
  const optional = piece.optional ? { optional: true } : {}
  if (pattern === undefined) return { kind: 'parameter', name: piece.name, ...optional }
  if (last && pattern === '.*') return { kind: 'catch-all', name: piece.name, optional: true }
  if (last && pattern === '.+') return { kind: 'catch-all', name: piece.name }
  return staysInSegment(pattern) ? { kind: 'parameter', name: piece.name, ...optional, constrained: true } : undefined
}

/**
 * One segment as the fact format states it, or undefined when the segment may span segments or
 * cannot be stated, so that a constrained optional catch-all replaces it and the rest of the route.
 */
function segmentOf(pieces: Piece[], requirements: Requirements, last: boolean): HttpEndpointSegment | undefined {
  const [only] = pieces
  if (pieces.length === 1 && typeof only === 'string') return pathSegment.test(only) ? { kind: 'literal', value: only } : undefined
  if (pieces.length === 1 && isPlaceholder(only!)) return placeholderSegment(only, requirements, last)
  // Text mixed with placeholders, such as `photo-{size}`, is one constrained parameter.
  const [first] = pieces.filter(isPlaceholder)
  const statable = first !== undefined && pieces.every(piece => pieceInSegment(piece, requirements))
  return statable ? { kind: 'parameter', name: first.name, constrained: true } : undefined
}

/**
 * The segments of a literal route. A placeholder whose pattern stays in its segment is a constrained
 * parameter; `.*` and `.+` in the last segment are plain catch-alls. From a segment that may span
 * segments or that the format cannot state, a constrained optional catch-all named after its first
 * placeholder replaces the rest of the route, so the endpoint is never widened or omitted.
 */
export function routeSegments(route: string, requirements: Requirements, colonPattern = true): HttpEndpointSegment[] {
  const pieces = routePieces(route, colonPattern)
  const segments: HttpEndpointSegment[] = []
  for (const [index, segment] of pieces.entries()) {
    const stated = segmentOf(segment, requirements, index === pieces.length - 1)
    if (stated !== undefined) {
      segments.push(stated)
      continue
    }
    const named = pieces.slice(index).flat().find(isPlaceholder)
    segments.push({ kind: 'catch-all', name: named?.name ?? 'path', optional: true, constrained: true })
    break
  }
  return segments
}

/**
 * A route entry the scanner sees but cannot report as an endpoint, such as one with an unknown
 * handler or an unresolved path: the literal segments it states first, then a constrained optional
 * catch-all. Core derives no row to it, and abstains on every request it could capture.
 */
export function blockerPath(segments: readonly HttpEndpointSegment[]): HttpEndpointSegment[] {
  const literal = segments.findIndex(segment => segment.kind !== 'literal')
  return [...segments.slice(0, literal < 0 ? segments.length : literal), { kind: 'catch-all', name: 'path', optional: true, constrained: true }]
}
