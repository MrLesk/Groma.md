import { existsSync } from 'node:fs'
import path from 'node:path'
import type { ScanInvocation, ScanObservation, ScanOperation } from '@groma/scanner'

import { GromaFileSystem } from './groma-filesystem.ts'
import { readDocument, withRelationship, writeDocument } from './markdown-emitter.ts'
import { RELATIONSHIPS_TYPE } from './okf-profile.ts'
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
  const pairs = new Map<string, RelationshipConnection>()
  for (const observation of observations) {
    const operations = new Map(observation.operations?.map(operation => [operation.id, operation]))
    for (const invocation of observation.invocations ?? []) {
      const interaction = suppliedNamedCallback(invocation, operations, owners)
      if (!interaction) continue
      for (const target of interaction.targets) {
        const source = interaction.source.file
        const key = `${source}\0${target.file}`
        const description = `Invokes supplied ${interaction.member} callback`
        const existing = pairs.get(key)
        const descriptions = new Set(existing?.description.split('; ') ?? [])
        descriptions.add(description)
        pairs.set(key, {
          source, target: target.file, description: [...descriptions].sort().join('; '),
          technology: observation.scanner.language, status: 'stable', authored: false,
        })
      }
    }
  }
  return [...pairs.values()].sort((left, right) => `${left.source}\0${left.target}`.localeCompare(`${right.source}\0${right.target}`))
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
): Promise<void> {
  const filename = GromaFileSystem.open(repositoryRoot).sourceFilename('relationships.md')
  const present = existsSync(path.join(repositoryRoot, filename))
  const before = present ? await readDocument(repositoryRoot, filename) : `---\ntype: ${RELATIONSHIPS_TYPE}\ntitle: Architecture relationships\n---\n`
  let source = withoutDerivedSection(before)
  for (const connection of inferRelationships(observations, owners)) {
    source = withRelationship(source, {
      ...connection,
      sourceName: connection.source,
      sourceHref: path.posix.relative(path.posix.dirname(filename), connection.source),
      targetName: connection.target,
      targetHref: path.posix.relative(path.posix.dirname(filename), connection.target),
    })
  }
  if (source !== before) await writeDocument(repositoryRoot, filename, source)
}
