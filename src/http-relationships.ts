// A derived row is permanent: the next scan restores it, so core abstains whenever a match is uncertain.
import type { HttpEndpointSegment, HttpRequestSegment, ScanHttpEndpoint, ScanHttpRequest, ScanObservation } from '@groma/scanner'

import type { RelationshipConnection } from './types.ts'

type KnownSegment = Exclude<HttpRequestSegment, { kind: 'unknown' }>

interface ServedEndpoint {
  file: string
  scanner: string
  method: string
  path: HttpEndpointSegment[]
  order: ScanHttpEndpoint['order']
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
    for (const { operation, method, path, order } of observation.httpEndpoints ?? []) {
      const file = files.get(operation)
      if (file !== undefined) endpoints.push({ file, scanner, method, path, order })
    }
    for (const request of observation.httpRequests ?? []) {
      const file = files.get(request.operation)
      if (file !== undefined && knownRequest(request)) requests.push({ file, scanner, method: request.method, path: request.path })
    }
  }
  return { endpoints, requests }
}

/**
 * How a request segment may reach an endpoint segment. `possibly` also counts what only some
 * runtime values reach: a dynamic segment equal to a literal, and text a constrained segment may
 * accept. `certainly` lets a dynamic segment fill a constrained parameter, since the source computes
 * it for that route.
 */
type Reach = 'possibly' | 'certainly'

function matches(endpoint: readonly HttpEndpointSegment[], request: readonly KnownSegment[], reach: Reach): boolean {
  const [head, ...rest] = endpoint
  if (head === undefined) return request.length === 0
  if (head.kind === 'catch-all') return request.length >= (head.optional ? 0 : 1) && (reach === 'possibly' || !head.constrained)
  if (head.kind === 'parameter' && head.optional && matches(rest, request, reach)) return true
  const [segment, ...remaining] = request
  return segment !== undefined && reaches(head, segment, reach) && matches(rest, remaining, reach)
}

/** Some frameworks route case-insensitively, and template-generated paths differ only in case. */
function sameText(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function reaches(head: HttpEndpointSegment, segment: KnownSegment, reach: Reach): boolean {
  if (head.kind === 'literal') return segment.kind === 'literal' ? sameText(segment.value, head.value) : reach === 'possibly'
  return !head.constrained || reach === 'possibly' || (reach === 'certainly' && segment.kind === 'dynamic')
}

/**
 * A leading literal only one side states is removable when both sides then continue with the same
 * literal. The result names the side and the removed text, since each is a different deployment.
 */
function removedPrefix(
  side: 'request' | 'endpoint',
  prefix: HttpEndpointSegment | KnownSegment | undefined,
  endpointNext: HttpEndpointSegment | undefined,
  requestNext: KnownSegment | undefined,
  reach: Reach,
): string | undefined {
  if (prefix?.kind !== 'literal' || endpointNext?.kind !== 'literal' || requestNext === undefined) return undefined
  return reaches(endpointNext, requestNext, reach) ? `${side} ${prefix.value.toLowerCase()}` : undefined
}

/** How an endpoint matched a request. */
interface Rank {
  /** The removed leading segment, as its side and lowercase text; empty for an exact path. */
  removed: string
  /** An exact path that needs its catch-all to take part of the request. */
  throughCatchAll: boolean
  /** One score per compared endpoint segment: a literal is 0, a parameter 1, a catch-all 2. */
  segments: number[]
}

function segmentScore(segment: HttpEndpointSegment): number {
  if (segment.kind === 'literal') return 0
  return segment.kind === 'parameter' ? 1 : 2
}

function matchRank(endpoint: readonly HttpEndpointSegment[], request: readonly KnownSegment[], reach: Reach): Rank | undefined {
  const segments = endpoint.map(segmentScore)
  if (matches(endpoint, request, reach)) {
    const last = endpoint.at(-1)
    const throughCatchAll = last?.kind === 'catch-all' && (!last.optional || !matches(endpoint.slice(0, -1), request, reach))
    return { removed: '', throughCatchAll, segments }
  }
  const fromRequest = removedPrefix('request', request[0], endpoint[0], request[1], reach)
  if (fromRequest !== undefined && matches(endpoint, request.slice(1), reach)) return { removed: fromRequest, throughCatchAll: false, segments }
  const fromEndpoint = removedPrefix('endpoint', endpoint[0], endpoint[1], request[0], reach)
  if (fromEndpoint !== undefined && matches(endpoint.slice(1), request, reach)) {
    return { removed: fromEndpoint, throughCatchAll: false, segments: segments.slice(1) }
  }
  return undefined
}

interface Match {
  endpoint: ServedEndpoint
  /** How some runtime value reaches the endpoint. */
  possibleRank: Rank
  /** How every runtime value reaches it; absent when only some values do. */
  certainRank: Rank | undefined
  /** The endpoint declares a constrained segment, which its router may rank by its own rules. */
  constrained: boolean
}

function requestMatches(request: SentRequest, endpoints: readonly ServedEndpoint[]): Match[] {
  const found: Match[] = []
  for (const endpoint of endpoints) {
    if (endpoint.method !== '*' && endpoint.method !== request.method) continue
    const possibleRank = matchRank(endpoint.path, request.path, 'possibly')
    if (possibleRank === undefined) continue
    const certainRank = matchRank(endpoint.path, request.path, 'certainly')
    const constrained = endpoint.path.some(segment => segment.kind !== 'literal' && segment.constrained === true)
    found.push({ endpoint, possibleRank, certainRank, constrained })
  }
  return found
}

/**
 * What decides between matches after exactness: segment specificity when every router prefers
 * the most specific route, registration position when every match is registered in one
 * first-match application, and nothing when routers, applications or removed segments differ.
 */
type Preference = 'specificity' | 'position' | 'none'

/** Positions are comparable only within one application as one scanner reports it. */
function application(endpoint: ServedEndpoint): string | undefined {
  return endpoint.order && `${endpoint.scanner}\0${endpoint.order.application}`
}

/**
 * An exact path that needs no catch-all shows the paths are compared as written, so it hides every
 * match that removed a leading segment. Only the remaining matches choose the preference.
 */
function preference(found: readonly Match[], exact: boolean): Preference {
  const ranked = found.flatMap(match => [match.possibleRank, ...(match.certainRank ? [match.certainRank] : [])]
    .filter(rank => !exact || rank.removed === '')
    .map(rank => ({ rank, application: application(match.endpoint) })))
  const removed = new Set(ranked.map(item => item.rank.removed))
  const applications = new Set(ranked.map(item => item.application))
  if (removed.size > 1 || applications.size > 1) return 'none'
  return applications.has(undefined) ? 'specificity' : 'position'
}

/** A comparison key, most preferred first: exactness, then what the preference compares. */
function rankKey(endpoint: ServedEndpoint, rank: Rank, by: Preference, exact: boolean): number[] {
  if (exact && rank.removed !== '') return [1]
  if (by === 'specificity') return [0, ...rank.segments]
  if (by === 'position' && endpoint.order) return [0, endpoint.order.position]
  return [0]
}

/**
 * The first position that differs decides. A path that has ended is more specific than one
 * continuing with an optional parameter or catch-all it did not use.
 */
function compareKeys(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? -1) - (right[index] ?? -1)
    if (difference !== 0) return difference
  }
  return 0
}

function bestKey(keys: readonly number[][]): number[] | undefined {
  return keys.reduce<number[] | undefined>((least, key) => least === undefined || compareKeys(key, least) < 0 ? key : least, undefined)
}

/**
 * A router sends a value that equals no literal to the best certain match. Any endpoint another
 * value could reach at least as well also competes. Routers rank constraints by their own rules,
 * so an endpoint with a constrained segment competes whatever its specificity; only a later
 * registration position rules it out. When a chosen endpoint has a constrained segment, every
 * reachable endpoint competes, because values the constraint rejects go elsewhere. Every
 * competing endpoint must be in the chosen endpoints' file. Unless specificity decides, the
 * router's choice between several certain endpoints is unknown, so exactly one must remain.
 */
function provider(request: SentRequest, endpoints: readonly ServedEndpoint[]): ServedEndpoint[] {
  const found = requestMatches(request, endpoints)
  const exact = found.some(({ certainRank }) => certainRank?.removed === '' && !certainRank.throughCatchAll)
  const by = preference(found, exact)
  const key = (endpoint: ServedEndpoint, rank: Rank) => rankKey(endpoint, rank, by, exact)
  const best = bestKey(found.flatMap(({ endpoint, certainRank }) => certainRank ? [key(endpoint, certainRank)] : []))
  if (best === undefined) return []
  const chosen = found.filter(({ endpoint, certainRank }) => certainRank !== undefined && compareKeys(key(endpoint, certainRank), best) === 0)
  const competes = ({ endpoint, possibleRank, constrained }: Match) => {
    const rank = key(endpoint, possibleRank)
    return compareKeys(constrained && by === 'specificity' ? rank.slice(0, 1) : rank, best) <= 0
  }
  const competing = chosen.some(match => match.constrained) ? found : found.filter(competes)
  const files = new Set([...chosen, ...competing].map(match => match.endpoint.file))
  const labels = new Set(chosen.map(match => pathLabel(match.endpoint)))
  return files.size === 1 && (by === 'specificity' || labels.size === 1) ? chosen.map(match => match.endpoint) : []
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

function pathLabel(endpoint: ServedEndpoint): string {
  return `/${endpoint.path.map(segmentLabel).join('/')}`
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
      pair.labels.add(`${request.method} ${pathLabel(endpoint)}`)
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
