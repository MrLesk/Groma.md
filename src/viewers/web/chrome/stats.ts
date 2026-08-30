import { compareSemanticElements } from '../../../element-order.ts'
import type { AnnotatedElement, ArchitectureGraph } from '../../../types.ts'

export function primarySystem(world: ArchitectureGraph): AnnotatedElement | undefined {
  return world.elements
    .filter(element => element.kind === 'system' && !element.external)
    .sort(compareSemanticElements)[0]
}

export function paintWorldStats(host: HTMLElement, world: ArchitectureGraph, flowCount: number): void {
  const system = primarySystem(world)
  host.textContent = system === undefined
    ? ''
    : `${system.name} · ${flowCount} flows · ${world.elements.length} elements`
}
