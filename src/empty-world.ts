import type { ArchitectureGraph } from './types.ts'

/** Nothing to draw yet: a viewer shows scanner setup guidance instead of empty ground. */
export function isEmptyWorld(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return world.elements.length === 0
}

export function hasComponents(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return world.elements.some(element => element.kind === 'component')
}

/**
 * Scans write evidence, never prose: while the map has components and no element has a description or an
 * overview, nobody has curated it yet and it is still the first scan.
 */
export function awaitsCuration(world: Pick<ArchitectureGraph, 'elements'>): boolean {
  return hasComponents(world) && world.elements.every(element => !element.description && element.overview.trim() === '')
}

export const noComponentsTitle = 'No component found!'
export const noComponentsHint = 'Run groma scanner setup to review project coverage.'
export const scannerSupportNote = 'Source scanning uses the plugins selected for this project.'
export const firstScanTitle = 'First scan'
export const firstScanHint = 'Ask your coding agent to curate this architecture.'

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
