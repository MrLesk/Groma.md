import type { ArchitectureElement, ArchitectureRelationship, RelationshipConnection } from './types.ts'

export function fileOwners(elements: readonly ArchitectureElement[]): Map<string, ArchitectureElement> {
  const owners = new Map<string, ArchitectureElement>()
  for (const element of elements) {
    for (const reference of element.code) {
      const owner = owners.get(reference.file)
      if (owner && owner.id !== element.id) throw new Error(`source file "${reference.file}" has more than one owner`)
      owners.set(reference.file, element)
    }
  }
  return owners
}

function pairKey(source: string, target: string): string {
  return `${source}\0${target}`
}

function relationshipText(connections: RelationshipConnection[]): Pick<ArchitectureRelationship, 'description' | 'technology' | 'status'> {
  const stable = connections.filter(connection => connection.status === 'stable')
  const active = stable.length ? stable : connections
  return {
    status: stable.length ? 'stable' : 'draft',
    description: [...new Set(active.map(connection => connection.description))].join('; '),
    technology: [...new Set(active.map(connection => connection.technology))].join(', '),
  }
}

/** Project exact file connections through their current owners, with one edge per component pair. */
export function sourceRelationships(
  elements: readonly ArchitectureElement[],
  connections: readonly RelationshipConnection[],
): ArchitectureRelationship[] {
  const owners = fileOwners(elements)
  const endpoints = new Map([...elements.map(element => [element.id, element] as const), ...owners])
  const authored = new Set(connections.filter(connection => connection.authored && connection.status === 'stable')
    .map(connection => pairKey(connection.source, connection.target)))
  const relationships = new Map<string, ArchitectureRelationship>()
  for (const connection of connections) {
    if (!connection.authored && authored.has(pairKey(connection.source, connection.target))) continue
    const source = endpoints.get(connection.source)!
    const target = endpoints.get(connection.target)!
    if (source.id === target.id) continue
    const key = pairKey(source.id, target.id)
    let relationship = relationships.get(key)
    if (!relationship) {
      relationship = {
        connections: [],
        status: connection.status,
        sourceId: source.id,
        targetId: target.id,
        description: '',
        technology: '',
        sourceFilename: source.sourceFilename,
        targetSourceFilename: target.sourceFilename,
      }
      relationships.set(key, relationship)
    }
    relationship.connections.push(connection)
  }
  return [...relationships.values()].map(relationship => ({
    ...relationship,
    ...relationshipText(relationship.connections),
  })).sort((left, right) => pairKey(left.sourceId, left.targetId).localeCompare(pairKey(right.sourceId, right.targetId)))
}
