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
 * Rule 3 in docs/relationship-inference.md. `possibly` also counts what only some runtime values
 * reach. A dynamic segment reaches a constrained parameter certainly, since the source computes it
 * for that route.
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
  return !head.constrained || reach === 'possibly' || segment.kind === 'dynamic'
}

/** A constrained catch-all accepts only some remainders and may stand for routes a scanner could not read. */
function constrainedCatchAll(segment: HttpEndpointSegment | undefined): boolean {
  return segment?.kind === 'catch-all' && segment.constrained === true
}

/**
 * A leading literal only one side states is removable when both sides then continue with the same
 * literal, or when the endpoint possibly continues with a constrained catch-all. The result names
 * the side and the removed text, since each is a different deployment.
 */
function removedPrefix(
  side: 'request' | 'endpoint',
  prefix: HttpEndpointSegment | KnownSegment | undefined,
  endpointNext: HttpEndpointSegment | undefined,
  requestNext: KnownSegment | undefined,
  reach: Reach,
): string | undefined {
  if (prefix?.kind !== 'literal' || requestNext === undefined) return undefined
  const continues = endpointNext?.kind === 'literal'
    ? reaches(endpointNext, requestNext, reach)
    : reach === 'possibly' && constrainedCatchAll(endpointNext)
  return continues ? `${side} ${prefix.value.toLowerCase()}` : undefined
}

/** How an endpoint matched a request. */
interface Rank {
  /** The removed leading segment, as its side and lowercase text; empty for an exact path. */
  removed: string
  /** The match needs its catch-all to take part of the request. */
  throughCatchAll: boolean
  /** The endpoint segments compared with the request, after any removed endpoint prefix. */
  compared: readonly HttpEndpointSegment[]
}

function segmentScore(segment: HttpEndpointSegment): number {
  if (segment.kind === 'literal') return 0
  return segment.kind === 'parameter' ? 1 : 2
}

/** Whether a matching endpoint needs its catch-all to take part of the request. */
function throughCatchAll(endpoint: readonly HttpEndpointSegment[], request: readonly KnownSegment[], reach: Reach): boolean {
  const last = endpoint.at(-1)
  return last?.kind === 'catch-all' && (!last.optional || !matches(endpoint.slice(0, -1), request, reach))
}

function matchRank(endpoint: readonly HttpEndpointSegment[], request: readonly KnownSegment[], reach: Reach): Rank | undefined {
  if (matches(endpoint, request, reach)) return { removed: '', throughCatchAll: throughCatchAll(endpoint, request, reach), compared: endpoint }
  const fromRequest = removedPrefix('request', request[0], endpoint[0], request[1], reach)
  const shorter = request.slice(1)
  if (fromRequest !== undefined && matches(endpoint, shorter, reach)) {
    return { removed: fromRequest, throughCatchAll: throughCatchAll(endpoint, shorter, reach), compared: endpoint }
  }
  const fromEndpoint = removedPrefix('endpoint', endpoint[0], endpoint[1], request[0], reach)
  const rest = endpoint.slice(1)
  if (fromEndpoint !== undefined && matches(rest, request, reach)) {
    return { removed: fromEndpoint, throughCatchAll: throughCatchAll(rest, request, reach), compared: rest }
  }
  return undefined
}

function constrainedSegment(segment: HttpEndpointSegment): boolean {
  return segment.kind !== 'literal' && segment.constrained === true
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
    const constrained = endpoint.path.some(constrainedSegment)
    found.push({ endpoint, possibleRank, certainRank, constrained })
  }
  return found
}

type Preference = 'specificity' | 'position' | 'none'

/** The application an endpoint belongs to, as one scanner reports it. */
function application(endpoint: ServedEndpoint): string {
  return `${endpoint.scanner}\0${endpoint.order?.application ?? ''}`
}

/** An endpoint whose path is one catch-all, such as a fallback for every path. */
function rootCatchAll(match: Match): boolean {
  return match.endpoint.path[0]?.kind === 'catch-all'
}

/**
 * Rule 4.1. A root catch-all takes whatever its own application serves nowhere else, which says
 * nothing about another application's routes.
 */
function ownApplicationCatchAlls(found: readonly Match[]): readonly Match[] {
  const direct = new Set(found.filter(match => !match.possibleRank.throughCatchAll).map(match => application(match.endpoint)))
  if (direct.size === 0) return found
  return found.filter(match => !rootCatchAll(match) || direct.has(application(match.endpoint)))
}

/** A match that removed the literal before a constrained catch-all, which accepts any remainder. */
function removedBeforeCatchAll(match: Match): boolean {
  return match.possibleRank.removed.startsWith('endpoint') && match.endpoint.path[1]?.kind === 'catch-all'
}

/** Rule 4.2. Removing the literal before a constrained catch-all fits any request, so it shows no deployment. */
function assumedDeployments(found: readonly Match[]): readonly Match[] {
  const assumed = new Set(found.filter(match => !removedBeforeCatchAll(match)).map(match => match.possibleRank.removed))
  return found.filter(match => !removedBeforeCatchAll(match) || assumed.has(match.possibleRank.removed))
}

/**
 * Rule 4.3. An exact certain path that needs no catch-all shows the paths compare as written. A
 * match that removed a segment drops out, and a certain match found only by removing one stays as
 * a possible match.
 */
function comparedAsWritten(found: readonly Match[]): readonly Match[] {
  if (!found.some(({ certainRank }) => certainRank?.removed === '' && !certainRank.throughCatchAll)) return found
  return found.filter(match => match.possibleRank.removed === '')
    .map(match => match.certainRank?.removed === '' ? match : { ...match, certainRank: undefined })
}

/** Rule 5. Specificity and position rank only matches of one deployment and one kind of router. */
function preference(found: readonly Match[]): Preference {
  const ranked = found.flatMap(match => [match.possibleRank, ...(match.certainRank ? [match.certainRank] : [])]
    .map(rank => ({ rank, application: match.endpoint.order && application(match.endpoint) })))
  const removed = new Set(ranked.map(item => item.rank.removed))
  const applications = new Set(ranked.map(item => item.application))
  if (removed.size > 1 || applications.size > 1) return 'none'
  return applications.has(undefined) ? 'specificity' : 'position'
}

/** A comparison key under the preference; a smaller key is preferred. */
function rankKey(endpoint: ServedEndpoint, rank: Rank, by: Preference): number[] {
  if (by === 'specificity') return rank.compared.map(segmentScore)
  if (by === 'position' && endpoint.order) return [endpoint.order.position]
  return []
}

/** A key that has ended reads as -1, more specific than an optional parameter or catch-all it did not use. */
function firstDifference(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    if ((left[index] ?? -1) !== (right[index] ?? -1)) return index
  }
  return length
}

/** The first position that differs decides. */
function compareKeys(left: readonly number[], right: readonly number[]): number {
  const index = firstDifference(left, right)
  return (left[index] ?? -1) - (right[index] ?? -1)
}

/**
 * Rule 6.2. Routers rank constrained segments against plain parameters and catch-alls by their own
 * rules, but every one prefers a literal segment.
 */
function constraintMayWin(match: Match, key: readonly number[], best: readonly number[]): boolean {
  const difference = firstDifference(key, best)
  return best[difference] !== 0 || match.possibleRank.compared.findIndex(constrainedSegment) < difference
}

function bestKey(keys: readonly number[][]): number[] | undefined {
  return keys.reduce<number[] | undefined>((least, key) => least === undefined || compareKeys(key, least) < 0 ? key : least, undefined)
}

/** Rule 6.4. A constrained catch-all may stand for routes whose handler files the scanner could not tell. */
function unattributed(match: Match): boolean {
  return constrainedCatchAll(match.endpoint.path.at(-1))
}

/**
 * Rules 3 to 6. A derived row is permanent, so every endpoint a runtime value could reach instead
 * of the chosen one must be in the chosen file.
 */
function provider(request: SentRequest, endpoints: readonly ServedEndpoint[]): ServedEndpoint[] {
  const found = comparedAsWritten(assumedDeployments(ownApplicationCatchAlls(requestMatches(request, endpoints))))
  const by = preference(found)
  const key = (endpoint: ServedEndpoint, rank: Rank) => rankKey(endpoint, rank, by)
  const best = bestKey(found.flatMap(({ endpoint, certainRank }) => certainRank ? [key(endpoint, certainRank)] : []))
  if (best === undefined) return []
  const chosen = found.filter(({ endpoint, certainRank }) => certainRank !== undefined && compareKeys(key(endpoint, certainRank), best) === 0)
  const competes = (match: Match) => {
    const rank = key(match.endpoint, match.possibleRank)
    return compareKeys(rank, best) <= 0 || (match.constrained && by === 'specificity' && constraintMayWin(match, rank, best))
  }
  const competing = chosen.some(match => match.constrained) ? found : found.filter(competes)
  if (competing.some(unattributed)) return []
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
