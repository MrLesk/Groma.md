import type { ArchitectureGraph, WorkItem } from '../../types.ts'
import { touchedElements } from '../../work/pins.ts'
import { elementOnPath, type FlowRef } from '../flows.ts'
import { flowHighlight } from './flow/state.ts'
import type { IsoMap } from './iso/map.ts'
import { primarySelection, selectedArchitecture, type Selection } from './selection.ts'

/** One hop in either direction, limited to components rather than their containing surfaces. */
function componentNeighborhood(selection: Selection, world: ArchitectureGraph) {
  const id = selection.kind === 'architecture' ? primarySelection(selection) : undefined
  const selected = world.elements.find(element => element.representationId === id && element.kind === 'component')
  const peers = new Set(world.relationships.flatMap(edge => {
    if (edge.source === selected?.representationId) return [edge.target]
    if (edge.target === selected?.representationId) return [edge.source]
    return []
  }))
  const neighbors = new Set(world.elements
    .filter(element => element.kind === 'component' && peers.has(element.representationId))
    .map(element => element.representationId))
  return { selected: selected?.representationId, neighbors }
}

/** Browser-only emphasis; the inspector selection and architecture stay unchanged. */
export function createMapHighlights(
  map: Pick<IsoMap, 'select' | 'mark' | 'setLitRoutes' | 'markNeighbors'>,
) {
  return {
    paint(selection: Selection, world: ArchitectureGraph, flows: readonly FlowRef[], tasks: WorkItem[]): void {
      const neighborhood = componentNeighborhood(selection, world)
      map.select(selectedArchitecture(selection))
      map.markNeighbors(neighborhood.selected, neighborhood.neighbors)
      map.mark(new Set(tasks.flatMap(item => touchedElements(item, world))))
      const { routes, focusedRoute } = flowHighlight(flows, world)
      map.setLitRoutes(routes, id => elementOnPath(id, routes, world), focusedRoute)
    },
  }
}
