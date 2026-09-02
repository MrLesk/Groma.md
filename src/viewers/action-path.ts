import {
  ancestorIds,
  parentOfElements,
  promotedPeer,
} from './relationship-text.ts'
import type {
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureGraph,
} from '../types.ts'

/** One command flow, optionally limited to the actor who starts it. */
export interface FlowRef {
  commandId: string
  actorId?: string
}

export function actionCaption(
  relationship: { source: string; target: string; description: string },
  outgoing: boolean,
  nameOf: (id: string) => string | undefined,
): { title: string; detail: string } {
  if (outgoing) {
    return {
      title: relationship.description,
      detail: nameOf(relationship.target) ?? relationship.target,
    }
  }
  return {
    title: nameOf(relationship.source) ?? relationship.source,
    detail: relationship.description,
  }
}

function exclusiveOutgoing(
  elementId: string,
  world: ArchitectureGraph,
  parentOf: ReturnType<typeof parentOfElements>,
): AnnotatedRelationship[] {
  return world.relationships.filter(relationship => {
    return promotedPeer(relationship, elementId, parentOf)?.outgoing === true
  })
}

/** Everything an element reaches along outgoing relationships, the element itself excluded. */
function downstream(
  elementId: string,
  world: ArchitectureGraph,
  parentOf: ReturnType<typeof parentOfElements>,
): Set<string> {
  const reached = new Set<string>()
  const queue = [elementId]
  while (queue.length > 0) {
    for (const relationship of exclusiveOutgoing(queue.shift()!, world, parentOf)) {
      if (reached.has(relationship.target)) continue
      reached.add(relationship.target)
      queue.push(relationship.target)
    }
  }
  reached.delete(elementId)
  return reached
}

/**
 * An actor's commands. When one of the actor's targets reaches another of
 * them, it is a launcher, such as the command line that starts the viewer the
 * actor reads, and its own relationships are the commands.
 */
export function outgoingActions(
  elementId: string | undefined,
  world: ArchitectureGraph,
): AnnotatedRelationship[] {
  if (elementId === undefined) return []
  const parentOf = parentOfElements(world.elements)
  const own = exclusiveOutgoing(elementId, world, parentOf)
  const selected = world.elements.find(item => item.representationId === elementId)
  if (selected?.kind !== 'actor') return own

  const used = new Set(own.map(relationship => relationship.target))
  const launchers: string[] = []
  for (const target of used) {
    const reached = downstream(target, world, parentOf)
    if ([...used].some(other => reached.has(other))) {
      launchers.push(target)
    }
  }
  if (launchers.length === 0) return own

  const exposed: AnnotatedRelationship[] = []
  const covered = new Set<string>()
  for (const launcher of launchers) {
    covered.add(launcher)
    for (const relationship of exclusiveOutgoing(launcher, world, parentOf)) {
      exposed.push(relationship)
      covered.add(relationship.target)
    }
  }
  return [
    ...exposed,
    ...own.filter(relationship => !covered.has(relationship.target)),
  ]
}

export function pickableActions(
  elementId: string | undefined,
  world: ArchitectureGraph,
): AnnotatedRelationship[] {
  const selected = world.elements.find(item => item.representationId === elementId)
  if (selected?.kind !== 'actor') return []
  return outgoingActions(elementId, world)
}

/**
 * The walk's legs in travel order: actors reaching the start, then onward.
 * With an actorId, only that actor's approach joins the walk.
 */
export function actionLegs(
  actionId: string | undefined,
  world: ArchitectureGraph,
  actorId?: string,
): AnnotatedRelationship[] {
  const start = world.relationships.find(relationship => relationship.id === actionId)
  if (start === undefined) return []
  const legs: AnnotatedRelationship[] = []
  const ids = new Set<string>()
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  for (const relationship of world.relationships) {
    if (
      relationship.target === start.source
      && byId.get(relationship.source)?.kind === 'actor'
      && (actorId === undefined || relationship.source === actorId)
    ) {
      legs.push(relationship)
      ids.add(relationship.id)
    }
  }
  const queue = [start]
  while (queue.length > 0) {
    const edge = queue.shift()
    if (edge === undefined || ids.has(edge.id)) continue
    ids.add(edge.id)
    legs.push(edge)
    for (const next of world.relationships) {
      if (next.source === edge.target && !ids.has(next.id)) queue.push(next)
    }
  }
  return legs
}

export function actionPath(
  actionId: string | undefined,
  world: ArchitectureGraph,
  actorId?: string,
): Set<string> {
  return new Set(actionLegs(actionId, world, actorId).map(leg => leg.id))
}

/** The union of authored relationship routes travelled by the active flows. */
export function flowRouteIds(
  flows: readonly FlowRef[],
  world: ArchitectureGraph,
): Set<string> {
  return new Set(flows.flatMap(flow => [
    ...actionPath(flow.commandId, world, flow.actorId),
  ]))
}

/**
 * Commands per world. Finding launchers walks the whole world per actor target, which costs
 * a frame on a large world, so every paint and keypress reuses the first walk. The walk reads
 * the elements and the relationships, so the cache is keyed on both arrays; a reload replaces
 * them and a work-only update keeps them.
 */
const commandsByWorld = new WeakMap<readonly AnnotatedElement[], WeakMap<readonly AnnotatedRelationship[], AnnotatedRelationship[]>>()

/** Every actor command in the world, deduped across the actors who share it. */
export function worldCommands(world: ArchitectureGraph): AnnotatedRelationship[] {
  const byRelationships = commandsByWorld.get(world.elements) ?? new WeakMap()
  commandsByWorld.set(world.elements, byRelationships)
  const cached = byRelationships.get(world.relationships)
  if (cached) return cached
  const seen = new Set<string>()
  const commands: AnnotatedRelationship[] = []
  for (const actor of world.elements) {
    if (actor.kind !== 'actor') continue
    for (const action of pickableActions(actor.representationId, world)) {
      if (seen.has(action.id)) continue
      seen.add(action.id)
      commands.push(action)
    }
  }
  byRelationships.set(world.relationships, commands)
  return commands
}

/** The actor commands whose walk touches the element. */
export function travelledBy(
  elementId: string,
  world: ArchitectureGraph,
): AnnotatedRelationship[] {
  return worldCommands(world).filter(action =>
    elementOnPath(elementId, actionPath(action.id, world), world))
}

export function elementOnPath(
  elementId: string,
  pathIds: Set<string>,
  world: ArchitectureGraph,
): boolean {
  const parentOf = parentOfElements(world.elements)
  return world.relationships.some(relationship => {
    if (!pathIds.has(relationship.id)) return false
    return ancestorIds(relationship.source, parentOf).includes(elementId)
      || ancestorIds(relationship.target, parentOf).includes(elementId)
  })
}
