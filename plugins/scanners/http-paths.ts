import type { HttpEndpointSegment } from '@groma/scanner'
import { pathText, type UrlPart } from './http-url.ts'

/*
 * The route patterns the TypeScript-family routers declare, read without a compiler for the shared
 * router reader in ./http-routes.ts and the scanners' own route forms.
 */

/** A placeholder written alone in a segment: `:id`, `:id?`, `:id(\d+)` or `:id{[0-9]+}`. */
const PLACEHOLDER = /^:([A-Za-z_]\w*)(?:\((.*)\)|\{(.*)\})?(\?)?$/
const FIRST_PLACEHOLDER = /:([A-Za-z_]\w*)/
const WILDCARD = /^\*([A-Za-z_]\w*)?$/
/** Express 5's optional group of one trailing parameter, `/talks{/:id}`. */
const OPTIONAL_GROUP = /\{\/:([A-Za-z_]\w*)\}$/
/** Route syntax that is not literal text. */
const SYNTAX = /[:*(){}?+]/
/** A pattern that matches within one segment: digits, word characters, classes of those and quantifiers. */
const ONE_SEGMENT = /^(?:\^|\$|\\[dw]|[A-Za-z0-9_-]|\[(?:\\[dw]|[A-Za-z0-9_]-[A-Za-z0-9_]|[A-Za-z0-9_-])+\]|[+*?|]|\{\d+(?:,\d*)?\}|\(\?:|[()])+$/
/** A pattern that matches whatever remains of the path. */
const REMAINDER = new Set(['.*', '.+'])

/** What remains of a path the scanner cannot state, which the router may or may not accept. */
function remainder(name = '*'): HttpEndpointSegment {
  return { kind: 'catch-all', name, optional: true, constrained: true }
}

/** Split at the slashes that separate segments, leaving those inside a pattern group. */
function parts(pattern: string): string[] {
  const found: string[] = []
  let depth = 0
  let current = ''
  for (const character of pattern) {
    if (character === '(' || character === '{') depth++
    if ((character === ')' || character === '}') && depth > 0) depth--
    if (character !== '/' || depth > 0) current += character
    else if (current !== '') { found.push(current); current = '' }
  }
  return current === '' ? found : [...found, current]
}

function placeholder(match: RegExpExecArray, last: boolean): HttpEndpointSegment | undefined {
  const [, name, round, curly, optional] = match
  const pattern = round ?? curly
  if (pattern === undefined) return { kind: 'parameter', name: name!, ...(optional ? { optional: true } : {}) }
  // A request path cannot tell `/files` from `/files/`, so a remainder claims at least one segment.
  if (REMAINDER.has(pattern)) return last ? { kind: 'catch-all', name: name! } : undefined
  if (!ONE_SEGMENT.test(pattern)) return undefined
  return { kind: 'parameter', name: name!, ...(optional ? { optional: true } : {}), constrained: true }
}

/** One segment, or undefined when it may span segments or its syntax states nothing certain. */
function segment(part: string, last: boolean, bareWildcard: boolean): HttpEndpointSegment | undefined {
  if (!SYNTAX.test(part)) return pathText.test(part) ? { kind: 'literal', value: part } : undefined
  const wildcard = WILDCARD.exec(part)
  if (wildcard || part === '(.*)') {
    const optional = bareWildcard && wildcard !== null ? { optional: true } : {}
    return last ? { kind: 'catch-all', name: wildcard?.[1] ?? '*', ...optional } : undefined
  }
  const alone = PLACEHOLDER.exec(part)
  if (alone) return placeholder(alone, last)
  // Text mixed with placeholders, such as `talk-:id`, accepts only some segments.
  const first = FIRST_PLACEHOLDER.exec(part)
  if (first === null || /[*(){}?+]/.test(part) || !pathText.test(part)) return undefined
  return { kind: 'parameter', name: first[1]!, constrained: true }
}

/**
 * The path a route pattern serves: literal text, `:name` and `:name?` parameters, an optional trailing
 * `{/:name}` group, and a trailing `*`, `*name` or `(.*)` catch-all, which `bareWildcard` routers such as
 * Hono also match without it. A typed or pattern parameter, and text mixed with a placeholder, is
 * constrained. A pattern that may span segments, or that states nothing certain, becomes a
 * constrained optional catch-all in place of itself and everything after it, so no route is omitted.
 */
export function endpointPath(pattern: string, bareWildcard = false): HttpEndpointSegment[] {
  const group = OPTIONAL_GROUP.exec(pattern)
  // Hono writes a pattern right after a parameter's name, `:id{[0-9]+}`, which is no group.
  if (group !== null && !/:\w*$/.test(pattern.slice(0, group.index))) {
    const path = endpointPath(pattern.slice(0, group.index), bareWildcard)
    return path.at(-1)?.kind === 'catch-all' ? path : [...path, { kind: 'parameter', name: group[1]!, optional: true }]
  }
  const pieces = parts(pattern)
  const path: HttpEndpointSegment[] = []
  for (const [index, part] of pieces.entries()) {
    const stated = segment(part, index === pieces.length - 1, bareWildcard)
    if (stated === undefined) return [...path, remainder(FIRST_PLACEHOLDER.exec(part)?.[1])]
    path.push(stated)
  }
  return path
}

/**
 * The path of a route the scanner sees but cannot read: its known prefix, then any remainder. A
 * catch-all the prefix ends with is part of that remainder, which may also be empty.
 */
export function blockedPath(prefix: string): HttpEndpointSegment[] {
  const path = endpointPath(prefix)
  return [...path.at(-1)?.kind === 'catch-all' ? path.slice(0, -1) : path, remainder()]
}

/** The literal text a route states before anything it computes, up to its last whole segment. */
export function readablePrefix(parts: readonly UrlPart[]): string {
  const [first, second] = parts
  if (first?.kind !== 'text') return ''
  if (second === undefined) return first.text
  return first.text.slice(0, first.text.lastIndexOf('/') + 1)
}
