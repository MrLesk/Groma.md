import type { ProjectedScene } from './project.ts'
import { planeMatrix } from './project.ts'
import { pointsAttribute, svg } from './svg.ts'

export interface RouteNode {
  group: SVGGElement
  source: string
  target: string
}

/** Batches neutral strokes by origin, then keeps one interactive overlay, arrow, hit line and tooltip per route. */
export function paintRoutes(layer: SVGGElement, scene: ProjectedScene): Map<string, RouteNode> {
  const nodes = new Map<string, RouteNode>()
  const basePathsByOrigin = new Map<string, string[]>()
  const interactiveRoutes: SVGGElement[] = []
  for (const { route, points, arrow } of scene.routes) {
    const originPaths = basePathsByOrigin.get(route.origin) ?? []
    originPaths.push(`M${pointsAttribute(points)}`)
    basePathsByOrigin.set(route.origin, originPaths)
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
    nodes.set(route.id, { group, source: route.source, target: route.target })
    interactiveRoutes.push(group)
  }
  for (const [origin, lines] of basePathsByOrigin) {
    const ghost = origin === 'observed' ? '' : ` ghost ${origin}`
    layer.append(svg('path', { d: lines.join('') }, `route route-base${ghost}`))
  }
  layer.append(...interactiveRoutes)
  return nodes
}
