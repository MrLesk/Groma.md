import type { ArchitectureGraph } from './types.ts'

/** Why an element cannot be removed right now, or undefined when the verb would succeed. */
export function removalBlocker(graph: ArchitectureGraph, id: string): string | undefined {
  const element = graph.elements.find(candidate => candidate.id === id)
  if (element === undefined) return `unknown id "${id}"`
  if (element.origin === 'observed' && element.kind !== 'actor' && !element.external) {
    return `${id} is found by the scanner; remove its code or combine it instead`
  }
  if (element.children.length > 0) {
    return `cannot remove ${id}: it contains ${element.children.join(', ')}`
  }
  const dependents = [...new Set(graph.relationships
    .filter(relationship => relationship.target === id)
    .map(relationship => relationship.source))]
  if (dependents.length > 0) {
    return `cannot remove ${id}: ${dependents.join(', ')} relate to it`
  }
  return undefined
}

/** A draft record leaves only once no ghost belongs to it; the stable parts it touched just lose the tag. */
export function draftRemovalBlocker(graph: ArchitectureGraph, draft: string): string | undefined {
  const ghosts = graph.elements
    .filter(element => element.origin === 'draft' && element.draft === draft)
    .map(element => element.id)
  if (ghosts.length > 0) {
    return `cannot remove ${draft}: ghosts ${ghosts.join(', ')} still belong to it`
  }
  return undefined
}
