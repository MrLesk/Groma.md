import type { HttpRequestSegment } from '@groma/scanner'

// The compiler-free half of an HTTP request producer, shared by every TypeScript-family scanner,
// the TypeScript scanner included.

/** RFC 3986 path characters, the literal text the shared contract accepts. */
export const pathText = /^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$/

const absolute = /^([A-Za-z][A-Za-z\d+.-]*:)?\/\//

/** A marker no literal path text can hold, so a real space is never mistaken for a computed value. */
const HOLE = '\0'

/** One computed expression inside a URL; `configured` marks a value the scanner cannot see. */
export type UrlPart = { kind: 'text'; text: string } | { kind: 'hole'; configured: boolean }

export const computedPart: UrlPart = { kind: 'hole', configured: false }
export const configuredPart: UrlPart = { kind: 'hole', configured: true }

function requestSegment(part: string): HttpRequestSegment {
  if (part === HOLE) return { kind: 'dynamic' }
  if (part.includes(HOLE) || !pathText.test(part)) return { kind: 'unknown' }
  return { kind: 'literal', value: part }
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

/** Adjacent literal text reads as one piece, so `'/' + '//host'` still states a host. */
function joinedText(input: readonly UrlPart[]): UrlPart[] {
  const parts: UrlPart[] = []
  for (const part of input) {
    const last = parts.at(-1)
    if (part.kind === 'text' && last?.kind === 'text') parts[parts.length - 1] = { kind: 'text', text: last.text + part.text }
    else if (part.kind === 'hole' || part.text !== '') parts.push(part)
  }
  return parts
}

/**
 * Turn a resolved URL into the request fact. A base the scanner resolves to a host, or cannot
 * resolve at all, becomes a leading unknown segment; only a configuration value sets `configured`,
 * and only when a slash follows it, since text that continues the value's last segment is unknown.
 */
export function requestUrl(input: readonly UrlPart[]): { configured?: true; path: HttpRequestSegment[] } {
  const parts = joinedText(input)
  const [first, ...rest] = parts
  if (first === undefined) return { path: [{ kind: 'unknown' }] }
  if (first.kind === 'hole') {
    const path = segmentsOf(rest)
    const next = rest[0]
    const separated = next === undefined || (next.kind === 'text' && next.text.startsWith('/'))
    return first.configured && separated ? { configured: true, path } : { path: [{ kind: 'unknown' }, ...path] }
  }
  if (absolute.test(first.text)) {
    return { path: [{ kind: 'unknown' }, ...segmentsOf([{ kind: 'text', text: afterAuthority(first.text) }, ...rest])] }
  }
  if (!first.text.startsWith('/')) return { path: [{ kind: 'unknown' }, ...segmentsOf(parts)] }
  return { path: segmentsOf(parts) }
}

/**
 * The URL an axios client requests: a base joins a relative path with one slash, and an absolute URL
 * replaces it. A path whose start the scanner cannot see may be absolute, so the URL starts unknown.
 */
export function joinBase(base: readonly UrlPart[], url: readonly UrlPart[]): UrlPart[] {
  const stated = joinedText(base)
  const path = joinedText(url)
  const [first] = path
  if (stated.length === 0) return path
  if (first === undefined) return stated
  if (first.kind === 'hole') return [computedPart, ...path.slice(1)]
  return absolute.test(first.text) ? path : [...stated, { kind: 'text', text: '/' }, ...path]
}

/**
 * The URL `$fetch` and `useFetch` request, as ofetch reads a `baseURL`: a URL that already starts with a
 * literal base, followed by `/`, `?` or its end, is kept, and a base joins any other one. Where that
 * boundary falls on a computed part, the URL starts unknown.
 */
export function withBase(base: readonly UrlPart[], url: readonly UrlPart[]): UrlPart[] {
  const stated = joinedText(base)
  const path = joinedText(url)
  const [only] = stated
  const [first, ...rest] = path
  if (stated.length !== 1 || only?.kind !== 'text' || first?.kind !== 'text' || absolute.test(first.text)) {
    return joinBase(stated, path)
  }
  const prefix = only.text.replace(/\/$/, '')
  if (first.text.startsWith(prefix)) {
    const next = first.text[prefix.length]
    if (next === undefined) return rest.length === 0 ? path : [computedPart, ...rest]
    return next === '/' || next === '?' ? path : joinBase(stated, path)
  }
  return prefix.startsWith(first.text) && rest.length > 0 ? [computedPart, ...rest] : joinBase(stated, path)
}
