import path from 'node:path'
import type { ScanObservation, ScanOperation } from '@groma/scanner'

import type { ArchitectureFinding, ArchitectureFindingInstance } from './types.ts'

const MIN_TOKENS = 8
const GRAM = 3
const NEAR_LCS = 0.7
const SKIP_NAMES = new Set(['callback', '(module)'])

interface Candidate {
  file: string
  name: string
  startLine: number
  endLine: number
  tokens: string[]
  fingerprint: string
  counts: Map<string, number>
  owner?: string
}

const remembered = new Map<string, readonly ArchitectureFinding[]>()

function keyOf(root: string): string {
  return path.resolve(root)
}

export function rememberArchitectureFindings(
  repositoryRoot: string,
  findings: readonly ArchitectureFinding[],
): void {
  remembered.set(keyOf(repositoryRoot), findings)
}

export function architectureFindingsFor(repositoryRoot: string): readonly ArchitectureFinding[] {
  return remembered.get(keyOf(repositoryRoot)) ?? []
}

export function findingsForOwner(
  findings: readonly ArchitectureFinding[],
  ownerId: string,
): ArchitectureFinding[] {
  return findings.filter(finding => finding.instances.some(instance => instance.owner === ownerId))
}

export interface OperationCopies {
  similar: boolean
  copies: ArchitectureFindingInstance[]
}

function sameInstance(instance: ArchitectureFindingInstance, file: string, name: string, line: number): boolean {
  return instance.file === file && instance.name === name && instance.startLine === line
}

/** Other locations that look like this operation. Undefined when it has no copies. */
export function copiesOf(
  findings: readonly ArchitectureFinding[],
  file: string,
  name: string,
  line: number,
): OperationCopies | undefined {
  const copies: ArchitectureFindingInstance[] = []
  const seen = new Set<string>()
  let similar = false
  for (const finding of findings) {
    if (!finding.instances.some(instance => sameInstance(instance, file, name, line))) continue
    if (finding.match === 'similar') similar = true
    for (const instance of finding.instances) {
      if (sameInstance(instance, file, name, line)) continue
      const key = `${instance.file}:${instance.startLine}:${instance.name}`
      if (seen.has(key)) continue
      seen.add(key)
      copies.push(instance)
    }
  }
  return copies.length === 0 ? undefined : { similar, copies }
}

export function formatArchitectureFindings(findings: readonly ArchitectureFinding[]): string[] {
  return findings.flatMap(finding => {
    const [first, ...rest] = finding.instances
    if (first === undefined || rest.length === 0) return []
    const lines = [
      `${first.name}  ${first.file}:${first.startLine}`,
      '  possible duplicates:',
      ...rest.map(instance => `    ${instance.name}  ${instance.file}:${instance.startLine}`),
    ]
    if (finding.match === 'similar') lines.push('  not identical')
    return lines
  })
}

function candidates(
  observations: readonly ScanObservation[],
  owners: ReadonlyMap<string, string>,
): Candidate[] {
  return observations.flatMap(observation => (observation.operations ?? []).flatMap(operation => {
    const candidate = candidateOf(operation, owners)
    return candidate === undefined ? [] : [candidate]
  }))
}

function candidateOf(
  operation: ScanOperation,
  owners: ReadonlyMap<string, string>,
): Candidate | undefined {
  if (!operation.tokens || operation.tokens.length < MIN_TOKENS) return undefined
  if (SKIP_NAMES.has(operation.name)) return undefined
  if (operation.startLine === undefined || operation.endLine === undefined) return undefined
  const owner = owners.get(operation.file)
  return {
    file: operation.file,
    name: operation.name,
    startLine: operation.startLine,
    endLine: operation.endLine,
    tokens: operation.tokens,
    fingerprint: operation.tokens.join('\0'),
    counts: bag(operation.tokens),
    ...(owner === undefined ? {} : { owner }),
  }
}

function grams(tokens: string[]): string[] {
  if (tokens.length < GRAM) return [tokens.join(' ')]
  const out: string[] = []
  for (let index = 0; index <= tokens.length - GRAM; index++) {
    out.push(tokens.slice(index, index + GRAM).join(' '))
  }
  return out
}

function lcsRatio(left: readonly string[], right: readonly string[]): number {
  const n = left.length
  const m = right.length
  if (n === 0 || m === 0) return 0
  let previous = new Uint16Array(m + 1)
  let current = new Uint16Array(m + 1)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      current[j] = left[i - 1] === right[j - 1]
        ? previous[j - 1]! + 1
        : Math.max(previous[j]!, current[j - 1]!)
    }
    ;[previous, current] = [current, previous]
    current.fill(0)
  }
  return (2 * previous[m]!) / (n + m)
}

function unionFind(size: number): { find(index: number): number; union(left: number, right: number): void } {
  const parent = Array.from({ length: size }, (_, index) => index)
  function find(index: number): number {
    const current = parent[index]!
    if (current === index) return index
    const root = find(current)
    parent[index] = root
    return root
  }
  function union(left: number, right: number): void {
    const a = find(left)
    const b = find(right)
    if (a !== b) parent[a] = b
  }
  return { find, union }
}

function exactGroups(items: readonly Candidate[]): number[][] {
  const groups = new Map<string, number[]>()
  items.forEach((item, index) => {
    const group = groups.get(item.fingerprint) ?? []
    group.push(index)
    groups.set(item.fingerprint, group)
  })
  return [...groups.values()].filter(group => group.length > 1)
}

function gramIndex(items: readonly Candidate[]): { gramSets: Set<string>[]; index: Map<string, number[]> } {
  const gramSets = items.map(item => new Set(grams(item.tokens)))
  const index = new Map<string, number[]>()
  gramSets.forEach((set, itemIndex) => {
    for (const gram of set) {
      const ids = index.get(gram) ?? []
      ids.push(itemIndex)
      index.set(gram, ids)
    }
  })
  return { gramSets, index }
}

function laterSharing(itemIndex: number, gramSets: readonly Set<string>[], index: ReadonlyMap<string, number[]>): number[] {
  const later = new Set<number>()
  for (const gram of gramSets[itemIndex]!) {
    for (const other of index.get(gram) ?? []) if (other > itemIndex) later.add(other)
  }
  return [...later]
}

function nearPair(left: Candidate, right: Candidate): boolean {
  const total = left.tokens.length + right.tokens.length
  if (2 * Math.min(left.tokens.length, right.tokens.length) / total < NEAR_LCS) return false
  // A common subsequence cannot contain more copies of a token than either body.
  let shared = 0
  for (const [token, count] of left.counts) shared += Math.min(count, right.counts.get(token) ?? 0)
  if (2 * shared / total < NEAR_LCS) return false
  return lcsRatio(left.tokens, right.tokens) >= NEAR_LCS
}

function clusters(items: readonly Candidate[]): number[][] {
  const sets = unionFind(items.length)
  for (const group of exactGroups(items)) {
    for (let index = 1; index < group.length; index++) sets.union(group[0]!, group[index]!)
  }
  const { gramSets, index } = gramIndex(items)
  for (let i = 0; i < items.length; i++) {
    for (const j of laterSharing(i, gramSets, index)) {
      // Findings expose connected clusters, so an internal edge cannot change the result.
      if (sets.find(i) !== sets.find(j) && nearPair(items[i]!, items[j]!)) sets.union(i, j)
    }
  }
  const byRoot = new Map<number, number[]>()
  items.forEach((_, index) => {
    const root = sets.find(index)
    const group = byRoot.get(root) ?? []
    group.push(index)
    byRoot.set(root, group)
  })
  return [...byRoot.values()].filter(group => group.length > 1)
}

function bag(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}

function onlyIn(left: Map<string, number>, right: Map<string, number>): string[] {
  const tokens: string[] = []
  for (const [token, count] of left) {
    const extra = count - (right.get(token) ?? 0)
    for (let index = 0; index < extra; index++) tokens.push(token)
  }
  return tokens
}

function shown(tokens: string[]): string {
  return tokens.slice(0, 8).join(' ') + (tokens.length > 8 ? ' …' : '')
}

function pairDifferences(left: Candidate, right: Candidate): string[] {
  const a = bag(left.tokens)
  const b = bag(right.tokens)
  const onlyLeft = onlyIn(a, b)
  const onlyRight = onlyIn(b, a)
  const lines: string[] = []
  if (onlyLeft.length > 0) lines.push(`${left.name} has ${shown(onlyLeft)}`)
  if (onlyRight.length > 0) lines.push(`${right.name} has ${shown(onlyRight)}`)
  return lines
}

function clusterDifferences(members: readonly Candidate[]): string[] {
  if (members.every(member => member.fingerprint === members[0]!.fingerprint)) return []
  if (members.length === 2) return pairDifferences(members[0]!, members[1]!)
  const first = members[0]!
  return members.slice(1).flatMap(member => {
    if (member.fingerprint === first.fingerprint) return []
    return pairDifferences(first, member)
  })
}

function instanceOf(candidate: Candidate): ArchitectureFindingInstance {
  return {
    file: candidate.file,
    startLine: candidate.startLine,
    endLine: candidate.endLine,
    name: candidate.name,
    ...(candidate.owner === undefined ? {} : { owner: candidate.owner }),
  }
}

function titleOf(members: readonly Candidate[]): string {
  const names = [...new Set(members.map(member => member.name))].sort()
  return names.join(', ')
}

function findingId(members: readonly Candidate[]): string {
  return `duplicated-logic:${members.map(member => `${member.file}:${member.startLine}:${member.name}`).sort().join('|')}`
}

function findingOf(members: readonly Candidate[]): ArchitectureFinding {
  const ordered = [...members].sort((left, right) => {
    return `${left.file}:${left.startLine}`.localeCompare(`${right.file}:${right.startLine}`)
  })
  const exact = ordered.every(member => member.fingerprint === ordered[0]!.fingerprint)
  return {
    id: findingId(ordered),
    kind: 'duplicated-logic',
    title: titleOf(ordered),
    match: exact ? 'exact' : 'similar',
    instances: ordered.map(instanceOf),
    differences: clusterDifferences(ordered),
  }
}

/** Compare tokenized operations and map matches to component owners. Does not invent a required change. */
export function detectDuplicatedLogic(
  observations: readonly ScanObservation[],
  owners: ReadonlyMap<string, string>,
): ArchitectureFinding[] {
  const items = candidates(observations, owners)
  return clusters(items)
    .map(group => findingOf(group.map(index => items[index]!)))
    .sort((left, right) => left.id.localeCompare(right.id))
}
