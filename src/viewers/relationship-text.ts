import type { AnnotatedRelationship } from '../types.ts'

/** One ordered pair of endpoints at the selection's depth, with every relationship it summarizes. */
export interface RelationshipPair {
  outgoing: boolean
  peerId: string
  relationships: AnnotatedRelationship[]
}

/** The selection's relationships, promoted to its depth and listed once per direction and peer, in first-seen order. */
export function relationshipPairs(
  relationships: readonly AnnotatedRelationship[],
  selectedId: string,
  parentOf: ParentOf,
): RelationshipPair[] {
  const pairs = new Map<string, RelationshipPair>()
  for (const relationship of relationships) {
    const ends = promotedPeer(relationship, selectedId, parentOf)
    if (ends === null) continue
    const key = `${ends.outgoing}\0${ends.peerId}`
    const pair = pairs.get(key)
    if (pair === undefined) pairs.set(key, { ...ends, relationships: [relationship] })
    else pair.relationships.push(relationship)
  }
  return [...pairs.values()]
}

/** Each distinct description of a pair, in first-seen order. */
export function pairDescriptions(pair: { relationships: readonly { description: string }[] }): string[] {
  return [...new Set(pair.relationships.map(relationship => relationship.description))]
}

export type ParentOf = (id: string) => string | null

export function parentOfElements(
  elements: Iterable<{ representationId: string; parent: string | null }>,
): ParentOf {
  const byId = new Map<string, string | null>()
  for (const element of elements) byId.set(element.representationId, element.parent)
  return id => byId.get(id) ?? null
}

/** Leaf-to-root ids, including `id`. */
export function ancestorIds(id: string, parentOf: ParentOf): string[] {
  const ids = [id]
  const seen = new Set([id])
  let current = parentOf(id)
  while (current !== null && !seen.has(current)) {
    ids.push(current)
    seen.add(current)
    current = parentOf(current)
  }
  return ids
}

/**
 * Route text is on when the selection is an endpoint or an ancestor of
 * exactly one endpoint. The shared ancestor is not a participant.
 */
export function showsRelationshipText(
  relationship: { source: string; target: string },
  selectedId: string | null,
  parentOf: ParentOf = () => null,
): boolean {
  if (selectedId === null) return false
  const onSource = ancestorIds(relationship.source, parentOf).includes(selectedId)
  const onTarget = ancestorIds(relationship.target, parentOf).includes(selectedId)
  return onSource !== onTarget
}

/** The other end at the same containment depth as the selection. */
export function promotedPeer(
  relationship: { source: string; target: string },
  selectedId: string,
  parentOf: ParentOf,
): { outgoing: boolean; peerId: string } | null {
  if (!showsRelationshipText(relationship, selectedId, parentOf)) return null
  const sourceChain = ancestorIds(relationship.source, parentOf)
  const outgoing = sourceChain.includes(selectedId)
  const own = outgoing ? sourceChain : ancestorIds(relationship.target, parentOf)
  const other = outgoing ? ancestorIds(relationship.target, parentOf) : sourceChain
  const depthFromRoot = own.length - 1 - own.indexOf(selectedId)
  const peerIndex = Math.max(0, other.length - 1 - depthFromRoot)
  return { outgoing, peerId: other[peerIndex]! }
}
