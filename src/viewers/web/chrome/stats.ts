import { compareSemanticElements } from '../../../element-order.ts'
import type { AnnotatedElement, ArchitectureGraph } from '../../../types.ts'

export function primarySystem(world: ArchitectureGraph): AnnotatedElement | undefined {
  return world.elements
    .filter(element => element.kind === 'system' && !element.external)
    .sort(compareSemanticElements)[0]
}

/** Internal C4 levels; actors and external systems stay outside this summary. */
export function c4Counts(world: Pick<ArchitectureGraph, 'elements'>): { system: number; container: number; component: number } {
  const counts = { system: 0, container: 0, component: 0 }
  for (const element of world.elements) {
    if (element.kind === 'actor' || element.external) continue
    counts[element.kind] += 1
  }
  return counts
}

export function paintWorldStats(host: HTMLElement, world: ArchitectureGraph): void {
  const system = primarySystem(world)
  host.replaceChildren()
  if (system === undefined) return
  const name = document.createElement('span')
  name.className = 'project-name'
  name.textContent = system.title
  const counts = document.createElement('span')
  counts.className = 'world-counts'
  counts.textContent = Object.entries(c4Counts(world))
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`)
    .join(' · ')
  host.append(name, counts)
}
