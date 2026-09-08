import type { ArchitectureGraph } from './types.ts'

/** Nothing to draw yet: a viewer shows scanner setup guidance instead of empty ground. */
export function isEmptyWorld(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return world.elements.length === 0
}

export function hasComponents(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return world.elements.some(element => element.kind === 'component')
}

export const noComponentsTitle = 'No component found!'
export const noComponentsHint = 'Run groma scanner setup to review project coverage.'
export const scannerSupportNote = 'TypeScript is embedded; other languages use optional scanner packages.'

/** The shared next steps for an initialized project whose architecture is still empty. */
export function emptyWorldLines(projectTitle: string): readonly string[] {
  return [
    projectTitle,
    '',
    noComponentsTitle,
    noComponentsHint,
    '',
    scannerSupportNote,
  ]
}
