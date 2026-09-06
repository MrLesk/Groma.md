import type { AnnotatedRelationship, ArchitectureGraph } from '../types.ts'
import type { RouteRequest } from './route-geometry.ts'

function dependencyCount(relationship: AnnotatedRelationship): number {
  const connections = relationship.connections ?? []
  if (connections.some(connection => connection.authored)) return 0
  return new Set(connections.map(connection => `${connection.source}\0${connection.target}`)).size
}

/** Bundle two-way component dependencies toward the larger file-pair count; preserve both semantic IDs. */
export function mapRelationships(world: ArchitectureGraph): RouteRequest[] {
  const components = new Set(world.elements.filter(element => element.kind === 'component').map(element => element.id))
  const pairs = new Map(world.relationships.map(relationship => [`${relationship.source}\0${relationship.target}`, relationship]))
  return world.relationships.flatMap(relationship => {
    const reverse = pairs.get(`${relationship.target}\0${relationship.source}`)
    const ownCount = dependencyCount(relationship)
    const otherCount = reverse ? dependencyCount(reverse) : 0
    const comparable = reverse && ownCount > 0 && otherCount > 0
      && components.has(relationship.source) && components.has(relationship.target)
    if (comparable && ownCount < otherCount) return []
    return [{
      id: relationship.id,
      source: relationship.source,
      target: relationship.target,
      description: relationship.description,
      origin: relationship.origin,
      ...(comparable && ownCount > otherCount ? { relationshipIds: [relationship.id, reverse.id] } : {}),
    }]
  })
}
