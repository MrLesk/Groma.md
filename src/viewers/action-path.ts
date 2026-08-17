import {
  ancestorIds,
  parentOfElements,
  promotedPeer,
} from './relationship-text.ts'
import type { ArchitectureWorld, WorldRelationship } from '../types.ts'

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
  world: ArchitectureWorld,
  parentOf: ReturnType<typeof parentOfElements>,
): WorldRelationship[] {
  return world.relationships.filter(relationship => {
    return promotedPeer(relationship, elementId, parentOf)?.outgoing === true
  })
}

export function outgoingActions(
  elementId: string | undefined,
  world: ArchitectureWorld,
): WorldRelationship[] {
  if (elementId === undefined) return []
  const parentOf = parentOfElements(world.elements)
  const own = exclusiveOutgoing(elementId, world, parentOf)
  const selected = world.elements.find(item => item.representationId === elementId)
  if (selected?.kind !== 'person') return own

  const used = new Set(own.map(relationship => relationship.target))
  const launchers: string[] = []
  for (const target of used) {
    const starts = exclusiveOutgoing(target, world, parentOf)
    if (starts.some(relationship => used.has(relationship.target))) {
      launchers.push(target)
    }
  }
  if (launchers.length === 0) return own

  const exposed: WorldRelationship[] = []
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
  world: ArchitectureWorld,
): WorldRelationship[] {
  const selected = world.elements.find(item => item.representationId === elementId)
  if (selected?.kind !== 'person') return []
  return outgoingActions(elementId, world)
}

/** The walk's legs in travel order: people reaching the start, then onward. */
export function actionLegs(
  actionId: string | undefined,
  world: ArchitectureWorld,
): WorldRelationship[] {
  const start = world.relationships.find(relationship => relationship.id === actionId)
  if (start === undefined) return []
  const legs: WorldRelationship[] = []
  const ids = new Set<string>()
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  for (const relationship of world.relationships) {
    if (
      relationship.target === start.source
      && byId.get(relationship.source)?.kind === 'person'
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
  world: ArchitectureWorld,
): Set<string> {
  return new Set(actionLegs(actionId, world).map(leg => leg.id))
}

/** Every person command in the world, deduped across the people who share it. */
export function worldCommands(world: ArchitectureWorld): WorldRelationship[] {
  const seen = new Set<string>()
  const commands: WorldRelationship[] = []
  for (const person of world.elements) {
    if (person.kind !== 'person') continue
    for (const action of pickableActions(person.representationId, world)) {
      if (seen.has(action.id)) continue
      seen.add(action.id)
      commands.push(action)
    }
  }
  return commands
}

/** The person commands whose walk touches the element. */
export function travelledBy(
  elementId: string,
  world: ArchitectureWorld,
): WorldRelationship[] {
  return worldCommands(world).filter(action =>
    elementOnPath(elementId, actionPath(action.id, world), world))
}

export function elementOnPath(
  elementId: string,
  pathIds: Set<string>,
  world: ArchitectureWorld,
): boolean {
  const parentOf = parentOfElements(world.elements)
  return world.relationships.some(relationship => {
    if (!pathIds.has(relationship.id)) return false
    return ancestorIds(relationship.source, parentOf).includes(elementId)
      || ancestorIds(relationship.target, parentOf).includes(elementId)
  })
}
