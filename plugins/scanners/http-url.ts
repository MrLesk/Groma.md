import type { HttpRequestSegment } from '@groma/scanner'

// The compiler-free half of an HTTP request producer, shared by the framework scanners. The
// TypeScript scanner keeps its own copy in typescript/src/http-paths.ts because it reads the native
// SDK's syntax tree; change both together.

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
