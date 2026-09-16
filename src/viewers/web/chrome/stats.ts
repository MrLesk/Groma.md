import type { ProjectProfile } from '../../../project-profile.ts'
import type { ArchitectureGraph } from '../../../types.ts'

/** Internal C4 levels; actors and external systems stay outside this summary. */
export function c4Counts(world: Pick<ArchitectureGraph, 'elements'>): { system: number; container: number; component: number } {
  const counts = { system: 0, container: 0, component: 0 }
  for (const element of world.elements) {
    if (element.kind === 'actor' || element.external) continue
    counts[element.kind] += 1
  }
  return counts
}

/**
 * Names the project from its profile beside the internal C4 counts. The header stays empty only when no Groma
 * package is loaded, because the reader rejects a Groma directory without a valid `project.md`.
 */
export function paintHeaderSummary(
  host: HTMLElement,
  world: Pick<ArchitectureGraph, 'elements'>,
  project: Pick<ProjectProfile, 'title'> | undefined,
): void {
  host.replaceChildren()
  if (project === undefined) return
  const name = document.createElement('span')
  name.className = 'project-name'
  name.textContent = project.title
  const counts = document.createElement('span')
  counts.className = 'world-counts'
  counts.textContent = Object.entries(c4Counts(world))
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`)
    .join(' · ')
  host.append(name, counts)
}
