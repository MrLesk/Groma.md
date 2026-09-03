import type { ArchitectureElement, ArchitectureRelationship } from './types.ts'

/** Why an element's existing architecture document cannot move to another parent. */
export function moveBlocker(
  element: Pick<ArchitectureElement, 'id' | 'kind'>,
  relationships: readonly ArchitectureRelationship[],
  body: string,
): string | undefined {
  if (element.kind !== 'component') return '--parent can currently move only components'
  const relationship = relationships.find(entry => {
    return entry.sourceId === element.id || entry.targetId === element.id
  })
  if (relationship !== undefined) {
    return `cannot structurally replace "${relationship.sourceId}" or "${relationship.targetId}" `
      + 'while it owns an authored relationship'
  }
  if (body.trim() !== '') {
    return `cannot structurally replace "${element.id}" because it has authored meaning`
  }
  return undefined
}
