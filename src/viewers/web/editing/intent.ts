import type { AnnotatedElement, Bounds, Point } from '../../../types.ts'

export type CreationKind = 'system' | 'container' | 'component'

/** A drop chooses ownership; it never supplies layout coordinates to core. */
export function creationParent(
  elements: readonly AnnotatedElement[], kind: CreationKind, hitId: string | undefined,
): string | undefined {
  if (kind === 'system') return undefined
  const expected = kind === 'component' ? 'container' : 'system'
  const byId = new Map(elements.map(element => [element.id, element]))
  let element = hitId === undefined ? undefined : byId.get(hitId)
  while (element !== undefined && element.kind !== expected) element = byId.get(element.parent ?? '')
  if (element === undefined || element.external) throw new Error(`Drop onto a ${expected}`)
  return element.id
}

export function gestureBounds(start: Point, end: Point): Bounds {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }
}

/** Enclosing a component's visible body selects it for grouping. */
export function enclosed(bounds: Bounds, component: Bounds): boolean {
  return component.x >= bounds.x && component.y >= bounds.y
    && component.x + component.width <= bounds.x + bounds.width
    && component.y + component.height <= bounds.y + bounds.height
}
