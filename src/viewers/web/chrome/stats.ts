import { compareSemanticElements } from '../../../element-order.ts'
import type { AnnotatedElement, ArchitectureGraph } from '../../../types.ts'

export function primarySystem(world: ArchitectureGraph): AnnotatedElement | undefined {
  return world.elements
    .filter(element => element.kind === 'system' && !element.external)
    .sort(compareSemanticElements)[0]
}

export function paintWorldStats(host: HTMLElement, world: ArchitectureGraph, flowCount: number): void {
  const system = primarySystem(world)
  host.replaceChildren()
  if (system === undefined) return
  const name = document.createElement('span')
  name.className = 'project-name'
  name.textContent = system.title
  const counts = document.createElement('span')
  counts.className = 'world-counts'
  counts.textContent = `${flowCount} flows · ${world.elements.length} elements`
  host.append(name, counts)
}
