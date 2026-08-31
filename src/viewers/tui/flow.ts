import { actionLegs } from '../action-path.ts'
import { ancestorIds, parentOfElements } from '../relationship-text.ts'
import type { TerminalViewModel } from './model.ts'
import { visibleEndpointFor, type TerminalProjection } from './projection.ts'

export interface ProjectedFlowEndpoint {
  title: string
  visibleKey?: string
  visibleTitle?: string
}

export interface ProjectedFlowStep {
  id: string
  index: number
  total: number
  description: string
  source: ProjectedFlowEndpoint
  target: ProjectedFlowEndpoint
}

function visibleEndpoint(
  id: string,
  world: TerminalViewModel,
  projection: TerminalProjection,
): { key: string; title: string; representationId?: string } | undefined {
  const byId = new Map(world.elements.map(element => [element.representationId, element]))
  const visible = new Map(projection.items.flatMap(item => {
    return item.representationId === undefined ? [] : [[item.representationId, item] as const]
  }))
  const boundary = projection.level === 'components'
    ? projection.items.find(item => item.kind === 'container')
    : undefined
  return visibleEndpointFor(id, visible, byId, boundary)
}

/** Exact authored endpoints paired with the cards that represent them in the current scope. */
export function projectFlowStep(
  world: TerminalViewModel,
  projection: TerminalProjection,
  actionId: string | undefined,
  actorId: string | undefined,
  step: number | undefined,
): ProjectedFlowStep | undefined {
  if (step === undefined) return undefined
  const legs = actionLegs(actionId, world, actorId)
  const leg = legs[step]
  if (!leg) return undefined
  const byId = new Map(world.elements.map(element => [element.representationId, element]))
  const parentOf = parentOfElements(world.elements)
  const endpoint = (id: string): ProjectedFlowEndpoint => {
    const exact = byId.get(id)
    const visible = visibleEndpoint(id, world, projection)
    const visibleIsAncestor = visible?.representationId !== undefined
      && ancestorIds(id, parentOf).includes(visible.representationId)
    return {
      title: exact?.title ?? id,
      visibleKey: visible?.key,
      visibleTitle: visibleIsAncestor ? visible.title : undefined,
    }
  }
  return {
    id: leg.id,
    index: step,
    total: legs.length,
    description: leg.description,
    source: endpoint(leg.source),
    target: endpoint(leg.target),
  }
}

export function flowEndpointLabel(endpoint: ProjectedFlowEndpoint): string {
  return endpoint.visibleTitle === undefined || endpoint.visibleTitle === endpoint.title
    ? endpoint.title
    : `${endpoint.visibleTitle} / ${endpoint.title}`
}
