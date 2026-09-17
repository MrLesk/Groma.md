import { existsSync } from 'node:fs'
import path from 'node:path'
import type { ScanDiagnostic, ScanInvocation, ScanObservation, ScanOperation } from '@groma/scanner'

import { GromaFileSystem } from './groma-filesystem.ts'
import { httpRelationships } from './http-relationships.ts'
import { readDocument, withRelationship, writeDocument } from './markdown-emitter.ts'
import { RELATIONSHIPS_TYPE } from './okf-profile.ts'
import { composeInvocations, type InvocationEvidence } from './scan-evidence.ts'
import type { RelationshipConnection } from './types.ts'

/** The supplied-operation rule requires one known provider owner for each concrete binding. */
function suppliedNamedCallback(
  invocation: ScanInvocation,
  operations: ReadonlyMap<string, ScanOperation>,
  owners: ReadonlyMap<string, string>,
): { source: ScanOperation; targets: ScanOperation[]; member: string } | undefined {
  if (!invocation.binding || !invocation.member || invocation.unresolved || !invocation.targets.length) return undefined
  const source = operations.get(invocation.source)
  const targets = invocation.targets.flatMap(id => operations.get(id) ?? [])
  if (!source || targets.length !== invocation.targets.length) return undefined
  const sourceOwner = owners.get(source.file)
  const targetOwners = new Set(targets.map(target => owners.get(target.file)))
  if (!sourceOwner || targetOwners.size !== 1 || targetOwners.has(undefined) || targetOwners.has(sourceOwner)) return undefined
  return { source, targets, member: invocation.member }
}

/** Direct calls, type uses, and unresolved wiring remain temporary evidence, never map claims. */
export function inferRelationships(
  observations: readonly ScanObservation[],
  owners: ReadonlyMap<string, string>,
): RelationshipConnection[] {
  return derivedRows(composeInvocations(observations).claims, observations, owners)
}

/** Each ordered file pair has one derived row that states every supported interaction and its scanners. */
function derivedRows(
  claims: readonly InvocationEvidence[],
  observations: readonly ScanObservation[],
  owners: ReadonlyMap<string, string>,
): RelationshipConnection[] {
  const rows = new Map<string, RelationshipConnection>()
  for (const row of [...relationshipsFromClaims(claims, owners), ...httpRelationships(observations, owners)]) {
    const key = `${row.source}\0${row.target}`
    const existing = rows.get(key)
    rows.set(key, existing === undefined ? row : {
      ...existing,
      description: `${existing.description}; ${row.description}`,
      technology: [...new Set([...existing.technology.split(', '), ...row.technology.split(', ')])].sort().join(', '),
    })
  }
  return [...rows.values()].sort((left, right) => `${left.source}\0${left.target}`.localeCompare(`${right.source}\0${right.target}`))
}

function relationshipsFromClaims(
  claims: readonly InvocationEvidence[],
  owners: ReadonlyMap<string, string>,
): RelationshipConnection[] {
  const pairs = new Map<string, { source: string; target: string; members: Set<string>; scanners: Set<string> }>()
  for (const { invocation, operations, scanners } of claims) {
    const interaction = suppliedNamedCallback(invocation, operations, owners)
    if (!interaction) continue
    for (const target of interaction.targets) {
      const source = interaction.source.file
      const key = `${source}\0${target.file}`
      const pair = pairs.get(key) ?? { source, target: target.file, members: new Set<string>(), scanners: new Set<string>() }
      pair.members.add(interaction.member)
      for (const scanner of scanners) pair.scanners.add(scanner)
      pairs.set(key, pair)
    }
  }
  return [...pairs.values()].map(({ source, target, members, scanners }): RelationshipConnection => ({
    source, target,
    description: `Invokes supplied callback${members.size === 1 ? '' : 's'}: ${[...members].sort().join(', ')}`,
    technology: [...scanners].sort().join(', '),
    status: 'stable', authored: false,
  }))
}

/** Replace only the core-owned section; keep authored sections and other Markdown intact. */
function withoutDerivedSection(source: string): string {
  const lines = source.replaceAll('\r\n', '\n').split('\n')
  const start = lines.indexOf('## Derived relationships')
  if (start < 0) return source
  let end = start + 1
  while (end < lines.length && !lines[end]?.startsWith('## ')) end++
  lines.splice(start, end - start)
  return lines.join('\n')
}

export async function refreshDerivedRelationships(
  repositoryRoot: string,
  observations: readonly ScanObservation[],
  owners: ReadonlyMap<string, string>,
  retained: readonly RelationshipConnection[] = [],
): Promise<ScanDiagnostic[]> {
  const { claims, conflicts } = composeInvocations(observations)
  const filename = GromaFileSystem.open(repositoryRoot).sourceFilename('relationships.md')
  const present = existsSync(path.join(repositoryRoot, filename))
  const before = present ? await readDocument(repositoryRoot, filename) : `---\ntype: ${RELATIONSHIPS_TYPE}\ntitle: Architecture relationships\n---\n`
  let source = withoutDerivedSection(before)
  const protectedPairs = new Set(retained.map(row => `${row.source}\0${row.target}`))
  const refreshed = derivedRows(claims, observations, owners).filter(row => !protectedPairs.has(`${row.source}\0${row.target}`))
  for (const connection of [...retained, ...refreshed]) {
    source = withRelationship(source, {
      ...connection,
      sourceName: connection.source,
      sourceHref: path.posix.relative(path.posix.dirname(filename), connection.source),
      targetName: connection.target,
      targetHref: path.posix.relative(path.posix.dirname(filename), connection.target),
    })
  }
  if (source !== before) await writeDocument(repositoryRoot, filename, source)
  return conflicts
}
