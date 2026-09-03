import type { ArchitectureGraph } from './types.ts'

/** Nothing to draw yet: a viewer shows the invitation to scan or draft instead of empty ground. */
export function isEmptyWorld(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return world.elements.length === 0
}

/** The shared next steps for an initialized project whose architecture is still empty. */
export function emptyWorldLines(projectTitle: string): readonly string[] {
  return [
    projectTitle,
    '',
    'Architecture is empty.',
    'Observe code: groma scan',
    'Start a draft: groma add draft <name> --overview <markdown>',
    'Add its first ghost: groma draft component <name> --parent <id>',
  ]
}
