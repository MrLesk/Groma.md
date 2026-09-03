import type { ArchitectureGraph } from './types.ts'

/** Nothing to draw yet: a viewer shows the invitation to scan or draft instead of empty ground. */
export function isEmptyWorld(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return world.elements.length === 0
}
