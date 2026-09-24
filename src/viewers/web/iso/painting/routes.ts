import type { LayeredScene } from '../projection/separation.ts'
import { planeMatrix } from '../projection/project.ts'
import { node, pointsAttribute, type SvgNode } from './svg.ts'

/** Neutral strokes are batched by origin; each route keeps its own interaction overlay and identity. */
export function routesSvg(scene: LayeredScene): SvgNode[] {
  const basePathsByOrigin = new Map<string, string[]>()
  const interactiveRoutes = scene.routes.map(({ route, points, arrow, lifts }) => {
    const originPaths = basePathsByOrigin.get(route.origin) ?? []
    const liftPath = lifts.map(({ from, to }) =>
      `M${pointsAttribute([from])}L${pointsAttribute([to])}`).join('')
    originPaths.push(`M${pointsAttribute(points)}`, liftPath)
    basePathsByOrigin.set(route.origin, originPaths)
    const ghost = route.origin === 'observed' ? '' : ` ghost ${route.origin}`
    return node('g', { 'data-id': route.id }, `route${ghost}`, [
      node('polyline', { points: pointsAttribute(points) }, 'line'),
      node('path', { d: liftPath }, 'line lift'),
      node('g', { transform: `${planeMatrix('ground', arrow.at, scene.view)} rotate(${arrow.turn})` }, 'arrow', [
        node('path', { d: 'M0 0L-8 5.25L-8 -5.25Z' }),
      ]),
      node('polyline', { points: pointsAttribute(points) }, 'hit'),
      node('title', {}, '', route.description),
    ])
  })
  const base = [...basePathsByOrigin].map(([origin, lines]) => {
    const ghost = origin === 'observed' ? '' : ` ghost ${origin}`
    return node('path', { d: lines.join('') }, `route route-base${ghost}`)
  })
  return [...base, ...interactiveRoutes]
}
