import type { AnnotatedElement, WorldElement } from './types.ts'

function meaningRank(element: AnnotatedElement): number {
  if (element.kind === 'actor') return 0
  if (element.external) return 2
  return 1
}

/** Geometry-free sibling order for renderers that place the semantic architecture themselves. */
export function compareSemanticElements(left: AnnotatedElement, right: AnnotatedElement): number {
  return meaningRank(left) - meaningRank(right)
    || (left.representationId < right.representationId
      ? -1
      : left.representationId > right.representationId ? 1 : 0)
}

/** TUI sibling order: actors, then internal software, then externals; left to right in the ELK world. */
export function compareElements(left: WorldElement, right: WorldElement): number {
  return meaningRank(left) - meaningRank(right)
    || left.bounds.x - right.bounds.x
    || left.bounds.y - right.bounds.y
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}
