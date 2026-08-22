import type { ProjectedScene } from './project.ts'
import { pointsAttribute, round, svg } from './svg.ts'

export interface RouteNode {
  group: SVGGElement
  source: string
  target: string
}

/** One group per route: the line, its arrowhead, a wide transparent hit line and the description as a tooltip. */
export function paintRoutes(layer: SVGGElement, scene: ProjectedScene): Map<string, RouteNode> {
  const nodes = new Map<string, RouteNode>()
  for (const { route, points, arrow } of scene.routes) {
    const ghost = route.origin === 'observed' ? '' : ` ghost ${route.origin}`
    const group = svg('g', {}, `route${ghost}`)
    const title = svg('title')
    title.textContent = route.description
    group.append(
      svg('polyline', { points: pointsAttribute(points) }, 'line'),
      svg('path', {
        d: 'M0 0L-8 3.5L-8 -3.5Z',
        transform: `translate(${round(arrow.at.x)} ${round(arrow.at.y)}) rotate(${round(arrow.angle)})`,
      }, 'arrow'),
      svg('polyline', { points: pointsAttribute(points) }, 'hit'),
      title,
    )
    nodes.set(route.id, { group, source: route.source, target: route.target })
    layer.append(group)
  }
  return nodes
}
