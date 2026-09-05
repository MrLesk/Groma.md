import { ancestorIds, parentOfElements } from './relationship-text.ts'
import type { AnnotatedRelationship, ArchitectureFlow, ArchitectureGraph } from '../types.ts'

/** One authored scenario, optionally focused on its zero-based step. */
export interface FlowRef {
  id: string
  step?: number
}

/** Ordered steps share existing routes; each action explains this scenario. */
export function flowLegs(id: string | undefined, world: ArchitectureGraph): AnnotatedRelationship[] {
  const flow = world.flows.find(item => item.id === id)
  const relationships = new Map(world.relationships.map(item => [item.id, item]))
  return flow?.steps.map(step => ({
    ...relationships.get(step.relationshipId)!,
    description: step.action,
  })) ?? []
}

export function flowRouteIds(flow: FlowRef | undefined, world: ArchitectureGraph): Set<string> {
  const steps = world.flows.find(item => item.id === flow?.id)?.steps ?? []
  return new Set((flow?.step === undefined ? steps : steps.slice(flow.step, flow.step + 1)).map(step => step.relationshipId))
}

/** Membership includes the visible ancestors of the exact authored endpoints. */
export function elementOnPath(elementId: string, pathIds: ReadonlySet<string>, world: ArchitectureGraph): boolean {
  const parentOf = parentOfElements(world.elements)
  return world.relationships.some(relationship => pathIds.has(relationship.id)
    && (ancestorIds(relationship.source, parentOf).includes(elementId)
      || ancestorIds(relationship.target, parentOf).includes(elementId)))
}

export function flowsThrough(elementId: string, world: ArchitectureGraph): ArchitectureFlow[] {
  return world.flows.filter(flow => elementOnPath(elementId, flowRouteIds({ id: flow.id }, world), world))
}
