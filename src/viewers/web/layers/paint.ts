import { pointsAttribute, svg } from '../iso/svg.ts'
import type { LayeredScene } from './separation.ts'

/** Paints the three aligned blueprint planes and the risers that show their separation. */
export function paintLayerPlanes(layer: SVGGElement, scene: LayeredScene): void {
  if (scene.layerPlanes.length === 0) return

  const risers = scene.layerPlanes.slice(1).flatMap((plane, index) => {
    const below = scene.layerPlanes[index]!
    return plane.polygon.map((point, corner) => svg('line', {
      x1: below.polygon[corner]!.x,
      y1: below.polygon[corner]!.y,
      x2: point.x,
      y2: point.y,
    }))
  })
  layer.append(svg('g', {}, 'layer-risers'))
  layer.lastElementChild!.append(...risers)

  for (const plane of scene.layerPlanes) {
    const group = svg('g', { opacity: plane.opacity }, `layer-plane ${plane.layer}`)
    group.append(svg('polygon', { points: pointsAttribute(plane.polygon) }))
    layer.append(group)
  }
}

/** Keeps plane names above architecture bodies while their sheets remain behind them. */
export function paintLayerLabels(layer: SVGGElement, scene: LayeredScene): void {
  for (const plane of scene.layerPlanes) {
    const label = svg('text', {
      x: plane.label.at.x, y: plane.label.at.y, opacity: plane.opacity,
    }, 'layer-label')
    label.textContent = plane.label.text
    layer.append(label)
  }
}

/** Theme-neutral layer treatment; every color comes from the active shared palette. */
export const layerCss = `
  #map .layer-plane, #map .layer-risers, #map .layer-labels { pointer-events: none; }
  #map .layer-plane polygon {
    fill: color-mix(in srgb, var(--paper) 76%, transparent);
    stroke: color-mix(in srgb, var(--ink) 34%, transparent);
    stroke-width: calc(var(--stroke) * var(--weight, 1));
    stroke-dasharray: 5 5;
    vector-effect: non-scaling-stroke;
  }
  #map .layer-plane.container polygon { fill-opacity: 0.76; }
  #map .layer-plane.component polygon { fill-opacity: 0.58; }
  #map .layer-label {
    fill: var(--muted); stroke: var(--paper); paint-order: stroke;
    stroke-width: calc(3px / var(--camera-scale, 1));
    font-size: calc(11px / var(--camera-scale, 1)); font-weight: 700; letter-spacing: 0.18em;
  }
  #map .layer-risers line {
    stroke: color-mix(in srgb, var(--ink) 24%, transparent);
    stroke-width: calc(var(--stroke) * var(--weight, 1));
    stroke-dasharray: 2 5;
    vector-effect: non-scaling-stroke;
  }
  #map .route .lift { stroke-dasharray: 2 5; opacity: 0.52; }
  #map:where(:not([data-camera-moving])) .route:hover .lift, #map .route.endpoint .lift, #map .route.selected .lift,
  #map .route.touched .lift, #map .route.lit .lift { opacity: 1; }
`
