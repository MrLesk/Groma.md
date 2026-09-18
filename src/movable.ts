import type { ArchitectureElement, ArchitectureFlow, ArchitectureRelationship } from './types.ts'

/**
 * Why a record cannot move to another parent wherever it goes, or undefined when nothing stops it. A move
 * relocates the record's document without repointing links, so a flow step or an authored concept row
 * naming the record would break.
 */
export function moveBlocker(
  element: Pick<ArchitectureElement, 'id'>,
  body: string,
  relationships: readonly ArchitectureRelationship[],
  flows: readonly ArchitectureFlow[],
): string | undefined {
  if (body.trim() !== '') return `cannot move "${element.id}" because it has authored meaning`
  const flow = flows.find(item => item.steps.some(step => step.source === element.id || step.target === element.id))
  if (flow !== undefined) return `cannot move "${element.id}" while flow ${flow.id} names it`
  const named = relationships.some(relationship => relationship.connections.some(connection => connection.authored
    && (connection.source === element.id || connection.target === element.id)))
  if (named) return `cannot move "${element.id}" while an authored relationship names it`
  return undefined
}
