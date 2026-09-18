// A derived row is permanent: the next scan restores it, so core abstains whenever a match is uncertain.
import type { HttpEndpointSegment, HttpRequestSegment, ScanHttpRequest, ScanObservation } from '@groma/scanner'

import type { RelationshipConnection } from './types.ts'

type KnownSegment = Exclude<HttpRequestSegment, { kind: 'unknown' }>

interface ServedEndpoint {
  file: string
  scanner: string
  method: string
  path: HttpEndpointSegment[]
}

interface SentRequest {
  file: string
  scanner: string
  method: string
  path: KnownSegment[]
}

/**
 * A known request has a method and no unknown text. A path after a configured base must start with
 * a literal segment, because the base itself contributes no text core can compare.
 */
function knownRequest(request: ScanHttpRequest): request is ScanHttpRequest & { method: string; path: KnownSegment[] } {
  if (request.method === undefined || request.path.some(segment => segment.kind === 'unknown')) return false
  return !request.configured || request.path[0]?.kind === 'literal'
}

/** Operation IDs are local to their observation, so each fact is resolved to its file there. */
function httpFacts(observations: readonly ScanObservation[]): { endpoints: ServedEndpoint[]; requests: SentRequest[] } {
  const endpoints: ServedEndpoint[] = []
  const requests: SentRequest[] = []
  for (const observation of observations) {
    const files = new Map(observation.operations?.map(operation => [operation.id, operation.file]))
    const scanner = observation.scanner.id
    for (const { operation, method, path } of observation.httpEndpoints ?? []) {
      const file = files.get(operation)
      if (file !== undefined) endpoints.push({ file, scanner, method, path })
    }
    for (const request of observation.httpRequests ?? []) {
      const file = files.get(request.operation)
      if (file !== undefined && knownRequest(request)) requests.push({ file, scanner, method: request.method, path: request.path })
    }
  }
  return { endpoints, requests }
}

/**
 * A dynamic segment fills a parameter or catch-all position. It could also equal a literal at
 * runtime: `dynamicFillsLiteral` treats that as a match, which keeps a literal route in another
 * file uncertain.
 */
function matches(endpoint: readonly HttpEndpointSegment[], request: readonly KnownSegment[], dynamicFillsLiteral: boolean): boolean {
  const [head, ...rest] = endpoint
  if (head === undefined) return request.length === 0
  if (head.kind === 'catch-all') return request.length >= (head.optional ? 0 : 1)
  if (head.kind === 'parameter' && head.optional && matches(rest, request, dynamicFillsLiteral)) return true
  const [segment, ...remaining] = request
  if (segment === undefined) return false
  if (head.kind === 'literal' && !literalFilled(head.value, segment, dynamicFillsLiteral)) return false
  return matches(rest, remaining, dynamicFillsLiteral)
}

/** Some frameworks route case-insensitively, and template-generated paths differ only in case. */
function sameText(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function literalFilled(value: string, segment: KnownSegment, dynamicFillsLiteral: boolean): boolean {
  return segment.kind === 'literal' ? sameText(segment.value, value) : dynamicFillsLiteral
}

type Segment = HttpEndpointSegment | KnownSegment

/** A leading literal only one side states is removable when both sides then continue with the same literal. */
function removablePrefix(prefix: Segment | undefined, next: Segment | undefined, other: Segment | undefined): boolean {
  return prefix?.kind === 'literal' && next?.kind === 'literal' && other?.kind === 'literal' && sameText(next.value, other.value)
}

/** How exactly an endpoint matched: an exact path first, then its segments from most specific. */
interface Specificity {
  exact: number
  /** One score per declared segment: a literal is 0, a parameter 1, a catch-all 2. */
  segments: number[]
}

function segmentScore(segment: HttpEndpointSegment): number {
  if (segment.kind === 'literal') return 0
  return segment.kind === 'parameter' ? 1 : 2
}

/** Routers resolve segment by segment, so the first position that differs decides. */
function moreSpecific(left: Specificity, right: Specificity): number {
  if (left.exact !== right.exact) return left.exact - right.exact
  const length = Math.max(left.segments.length, right.segments.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left.segments[index] ?? 3) - (right.segments[index] ?? 3)
    if (difference !== 0) return difference
  }
  return 0
}

function matchSpecificity(
  endpoint: readonly HttpEndpointSegment[],
  request: readonly KnownSegment[],
  dynamicFillsLiteral: boolean,
): Specificity | undefined {
  const segments = endpoint.map(segmentScore)
  if (matches(endpoint, request, dynamicFillsLiteral)) return { exact: 0, segments }
  if (removablePrefix(request[0], request[1], endpoint[0]) && matches(endpoint, request.slice(1), dynamicFillsLiteral)) {
    return { exact: 1, segments }
  }
  if (removablePrefix(endpoint[0], endpoint[1], request[0]) && matches(endpoint.slice(1), request, dynamicFillsLiteral)) {
    return { exact: 1, segments: segments.slice(1) }
  }
  return undefined
}

interface Match {
  endpoint: ServedEndpoint
  specificity: Specificity
  /** The request reaches this endpoint without a dynamic segment standing in for a literal. */
  certain: boolean
}

/** Only the endpoints a router would prefer stay; a more specific route hides a looser one. */
function preferredMatches(request: SentRequest, endpoints: readonly ServedEndpoint[]): Match[] {
  const found: Match[] = []
  for (const endpoint of endpoints) {
    if (endpoint.method !== '*' && endpoint.method !== request.method) continue
    const specificity = matchSpecificity(endpoint.path, request.path, true)
    if (specificity === undefined) continue
    const certain = matchSpecificity(endpoint.path, request.path, false)
    found.push({ endpoint, specificity, certain: certain !== undefined && moreSpecific(certain, specificity) === 0 })
  }
  const best = found.map(match => match.specificity)
    .reduce<Specificity | undefined>((least, item) => least === undefined || moreSpecific(item, least) < 0 ? item : least, undefined)
  return best === undefined ? [] : found.filter(match => moreSpecific(match.specificity, best) === 0)
}

/** Every preferred endpoint must be in one file, and at least one must be reached certainly. */
function provider(request: SentRequest, endpoints: readonly ServedEndpoint[]): ServedEndpoint[] {
  const preferred = preferredMatches(request, endpoints)
  const certain = preferred.filter(match => match.certain)
  const files = new Set(preferred.map(match => match.endpoint.file))
  return files.size === 1 && certain.length > 0 ? certain.map(match => match.endpoint) : []
}

/** Markdown emphasis would consume these characters inside a stored path. */
function escapeLabel(text: string): string {
  return text.replaceAll(/[*_]/g, character => `\\${character}`)
}

/** `:id`, `:id?`, `:rest+` and `:rest*` survive the Markdown table, unlike braces. */
function segmentLabel(segment: HttpEndpointSegment): string {
  if (segment.kind === 'literal') return escapeLabel(segment.value)
  if (segment.kind === 'parameter') return `:${escapeLabel(segment.name)}${segment.optional ? '?' : ''}`
  return `:${escapeLabel(segment.name)}${segment.optional ? '*' : '+'}`
}

/** Derive a row from the requesting file to the one providing file when both have different owners. */
export function httpRelationships(
  observations: readonly ScanObservation[],
  owners: ReadonlyMap<string, string>,
): RelationshipConnection[] {
  const { endpoints, requests } = httpFacts(observations)
  const pairs = new Map<string, { source: string; target: string; labels: Set<string>; scanners: Set<string> }>()
  for (const request of requests) {
    const reached = provider(request, endpoints)
    const target = reached[0]?.file
    const sourceOwner = owners.get(request.file)
    const targetOwner = target === undefined ? undefined : owners.get(target)
    if (target === undefined || sourceOwner === undefined || targetOwner === undefined || targetOwner === sourceOwner) continue
    const key = `${request.file}\0${target}`
    const pair = pairs.get(key) ?? { source: request.file, target, labels: new Set<string>(), scanners: new Set<string>() }
    pair.scanners.add(request.scanner)
    for (const endpoint of reached) {
      pair.labels.add(`${request.method} /${endpoint.path.map(segmentLabel).join('/')}`)
      pair.scanners.add(endpoint.scanner)
    }
    pairs.set(key, pair)
  }
  return [...pairs.values()].map(({ source, target, labels, scanners }): RelationshipConnection => ({
    source, target,
    description: `Calls HTTP endpoint${labels.size === 1 ? '' : 's'}: ${[...labels].sort().join(', ')}`,
    technology: [...scanners].sort().join(', '),
    status: 'stable', authored: false,
  }))
}
