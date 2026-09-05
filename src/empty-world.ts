import type { ArchitectureGraph } from './types.ts'

/** Nothing to draw yet: a viewer shows the invitation to scan or draft instead of empty ground. */
export function isEmptyWorld(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return world.elements.length === 0
}

export function hasComponents(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return world.elements.some(element => element.kind === 'component')
}

export const noComponentsTitle = 'No components found'
export const createComponentsHint = 'Create supported code, or draft your first system.'

/** The shared next steps for an initialized project whose architecture is still empty. */
export function emptyWorldLines(projectTitle: string): readonly string[] {
  return [
    projectTitle,
    '',
    noComponentsTitle,
    createComponentsHint,
    'groma draft system <name> --overview <markdown>',
  ]
}
