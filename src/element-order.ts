import type { WorldElement } from './types.ts'

function meaningRank(element: WorldElement): number {
  if (element.kind === 'actor') return 0
  if (element.external) return 2
  return 1
}

/** Sibling order shared by the hierarchy pane and the sheet: actors, then internal software, then externals; left to right. */
export function compareElements(left: WorldElement, right: WorldElement): number {
  return meaningRank(left) - meaningRank(right)
    || left.bounds.x - right.bounds.x
    || left.bounds.y - right.bounds.y
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}
