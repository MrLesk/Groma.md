import type { HttpEndpointSegment } from '@groma/scanner'
import { pathText } from '../../http-url.ts'

/*
 * The endpoints Nuxt serves by file location, read as Nitro names its server routes: the path after
 * `server/api`, which keeps its `/api` prefix, or after `server/routes`, without route group
 * directories, an environment suffix, a method suffix or a final `index`.
 */
const SERVER_ROUTE = /^server\/((?:api|routes)\/.+)\.(?:[cm]?[jt]s|[jt]sx)$/
const GROUP = /\([^(/]+\)\//g
const SUFFIX = /(?:\.(connect|delete|get|head|options|patch|post|put|trace))?(?:\.(?:dev|prod|prerender))?$/

/** A placeholder's name, or `*` for one a name cannot spell. */
function named(text: string): string {
  return text !== '' && pathText.test(text) ? text : '*'
}

/**
 * One segment as Nitro registers it: `[...]` and `[...name]` become `**` and `**:name`, and `[name]`
 * becomes `:name`. A segment that then starts with `**` is a catch-all and one that starts with `:` a
 * parameter; any other text, `hello-:name` included, is literal. Undefined marks a catch-all before the
 * last segment, or text the path cannot hold.
 */
function routeSegment(part: string, last: boolean): HttpEndpointSegment | undefined {
  const registered = part.replace(/\[\.{3}]/g, '**').replace(/\[\.{3}(\w+)]/g, '**:$1').replace(/\[([^/\]]+)]/g, ':$1')
  if (registered.startsWith('**')) return last ? { kind: 'catch-all', name: named(registered.slice(3)) } : undefined
  if (registered.startsWith(':')) return { kind: 'parameter', name: named(registered.slice(1)) }
  return pathText.test(registered) ? { kind: 'literal', value: registered } : undefined
}

/**
 * The path a Nuxt server route serves, and the method its file name states. A segment the scanner
 * cannot state becomes a constrained optional catch-all in place of itself and the rest, so no route
 * is omitted.
 */
export function serverRoute(file: string): { method: string; path: HttpEndpointSegment[] } | undefined {
  const match = SERVER_ROUTE.exec(file)
  if (match === null) return undefined
  const grouped = match[1]!.replace(GROUP, '')
  const suffix = SUFFIX.exec(grouped)!
  const route = grouped.slice(0, suffix.index)
  // `server/api` keeps its prefix; `server/routes` serves from the root.
  const parts = (route.startsWith('routes/') ? route.slice('routes/'.length) : route).split('/')
  const segments = parts.at(-1) === 'index' ? parts.slice(0, -1) : parts
  const path: HttpEndpointSegment[] = []
  for (const [index, part] of segments.entries()) {
    const segment = routeSegment(part, index === segments.length - 1)
    if (segment === undefined) {
      path.push({ kind: 'catch-all', name: '*', optional: true, constrained: true })
      break
    }
    path.push(segment)
  }
  return { method: suffix[1]?.toUpperCase() ?? '*', path }
}
