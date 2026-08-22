import type { ProjectedScene } from './project.ts'
import { planeMatrix } from './project.ts'
import { pointsAttribute, svg } from './svg.ts'

export interface RouteNode {
  group: SVGGElement
  /** The arrowhead's triangle; the map scales it by the inverse zoom so it keeps its screen size like every stroke. */
  head: SVGPathElement
  source: string
  target: string
}

/** One group per route, carrying its relationship id: the line, its arrowhead lying on the sheet, a wide transparent hit line and the description as a tooltip. */
export function paintRoutes(layer: SVGGElement, scene: ProjectedScene): Map<string, RouteNode> {
  const nodes = new Map<string, RouteNode>()
  for (const { route, points, arrow } of scene.routes) {
    const ghost = route.origin === 'observed' ? '' : ` ghost ${route.origin}`
    const group = svg('g', { 'data-id': route.id }, `route${ghost}`)
    const title = svg('title')
    title.textContent = route.description
    const head = svg('path', { d: 'M0 0L-8 3.5L-8 -3.5Z' })
    const pose = svg('g', { transform: `${planeMatrix('ground', arrow.at)} rotate(${arrow.turn})` }, 'arrow')
    pose.append(head)
    group.append(
      svg('polyline', { points: pointsAttribute(points) }, 'line'),
      pose,
      svg('polyline', { points: pointsAttribute(points) }, 'hit'),
      title,
    )
    nodes.set(route.id, { group, head, source: route.source, target: route.target })
    layer.append(group)
  }
  return nodes
}
