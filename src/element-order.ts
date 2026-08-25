import type { AnnotatedElement } from './types.ts'

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
