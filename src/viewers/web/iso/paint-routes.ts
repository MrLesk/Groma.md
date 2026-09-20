import { escaped } from '../atoms/escape.ts'
import type { LayeredScene } from '../layers/separation.ts'
import { planeMatrix } from './project.ts'
import { pointsAttribute, svgMarkup as svg } from './svg.ts'

/** Neutral strokes are batched by origin; each route keeps its own interaction overlay and identity. */
export function routesSvg(scene: LayeredScene): string {
  const basePathsByOrigin = new Map<string, string[]>()
  const interactiveRoutes = scene.routes.map(({ route, points, arrow, lifts }) => {
    const originPaths = basePathsByOrigin.get(route.origin) ?? []
    const liftPath = lifts.map(({ from, to }) =>
      `M${pointsAttribute([from])}L${pointsAttribute([to])}`).join('')
    originPaths.push(`M${pointsAttribute(points)}`, liftPath)
    basePathsByOrigin.set(route.origin, originPaths)
    const ghost = route.origin === 'observed' ? '' : ` ghost ${route.origin}`
    return svg('g', { 'data-id': route.id }, `route${ghost}`,
      svg('polyline', { points: pointsAttribute(points) }, 'line')
      + svg('path', { d: liftPath }, 'line lift')
      + svg('g', { transform: `${planeMatrix('ground', arrow.at, scene.view)} rotate(${arrow.turn})` }, 'arrow',
        svg('path', { d: 'M0 0L-8 5.25L-8 -5.25Z' }))
      + svg('polyline', { points: pointsAttribute(points) }, 'hit')
      + svg('title', {}, '', escaped(route.description)))
  }).join('')
  const base = [...basePathsByOrigin].map(([origin, lines]) => {
    const ghost = origin === 'observed' ? '' : ` ghost ${origin}`
    return svg('path', { d: lines.join('') }, `route route-base${ghost}`)
  }).join('')
  return base + interactiveRoutes
}
