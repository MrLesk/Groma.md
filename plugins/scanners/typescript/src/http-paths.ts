import type { HttpEndpointSegment } from '@groma/scanner'

import { pathText } from '../../http-url.ts'

// The request rules live in the shared ../../http-url.ts, which the framework scanners use too; only
// this scanner's route patterns stay here.
export { requestUrl, type UrlPart } from '../../http-url.ts'

const splat = /^\*([A-Za-z_]\w*)?$/
const parameter = /^:([A-Za-z_]\w*)(\?)?$/

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

