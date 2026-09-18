import type { HttpEndpointSegment } from '@groma/scanner'
import { pathText } from '../../http-url.ts'

// The route patterns match the reference ../../http-paths.ts; change both together.
// Request paths come from the shared ../../http-url.ts, which both producers already use.

const splat = /^\*([A-Za-z_]\w*)?$/
const parameter = /^:([A-Za-z_]\w*)(\?)?$/
/** The `(.*)` remainder Koa and Express route patterns write, which needs at least one segment. */
const remainder = '(.*)'

function endpointSegment(part: string, last: boolean): HttpEndpointSegment | undefined {
  if (part === remainder) return last ? { kind: 'catch-all', name: '*' } : undefined
  const wildcard = splat.exec(part)
  if (wildcard) return last ? { kind: 'catch-all', name: wildcard[1] ?? '*' } : undefined
  const named = parameter.exec(part)
  if (named) return { kind: 'parameter', name: named[1]!, ...(named[2] ? { optional: true } : {}) }
  return pathText.test(part) ? { kind: 'literal', value: part } : undefined
}

/**
 * Route patterns shared by the supported frameworks: literal text, `:name`, `:name?`, and a
 * trailing `*`, `*name` or `(.*)`. Anything else, such as another regular expression or an optional
 * group, is unsupported and reports no endpoint.
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
