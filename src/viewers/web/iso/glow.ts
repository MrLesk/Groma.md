import type { Point } from '../../../types.ts'
import type { LayeredScene } from '../layers/separation.ts'
import type { Camera } from './camera/camera.ts'
import { boundsOf } from './project.ts'
import { node, patch, pointsAttribute, svg } from './svg.ts'

/**
 * The glow's own layer breathes by opacity alone, so it never repaints the map. It hides by opacity too: removing
 * it, or hiding it with display, changes the layers over the map and makes Safari redraw the whole map.
 */
export const glowCss = `
  #map .highlight-glow {
    position: absolute; left: 0; top: 0; pointer-events: none;
    will-change: opacity;
  }
  #map [data-glows-hidden] > .highlight-glow { opacity: 0; }
  #map .highlight-glow-pulse {
    width: 100%; height: 100%; opacity: 0.55;
    will-change: opacity;
    animation: map-highlight-glow 2600ms ease-in-out infinite;
  }
  @keyframes map-highlight-glow {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    #map .highlight-glow-pulse { animation: none; }
  }
`

/** The glow follows the same projected geometry as the highlighted architecture body. */
function glowShapes(scene: LayeredScene, id: string): Point[][] | undefined {
  const source = scene.buildings.find(item => item.building.representationId === id)
    ?? scene.slabs.find(item => item.slab.representationId === id)
    ?? scene.islands.find(item => item.island.element?.representationId === id)
  if (source === undefined) return undefined
  if ('floors' in source) return source.floors.flat().map(face => face.points)
  if ('faces' in source) return source.faces.map(face => face.points)
  return [source.polygon]
}

/** A bounded, static silhouette lets the browser pulse its HTML layer without fading or repainting the map SVG. */
function highlightGlow(id: string, shapes: readonly Point[][]) {
  const surface = document.createElement('div')
  surface.className = 'highlight-glow'
  surface.setAttribute('aria-hidden', 'true')
  const body = boundsOf(shapes.flat())
  const blur = 32
  const margin = blur * 3
  const bounds = { x: body.x - margin, y: body.y - margin, width: body.width + margin * 2, height: body.height + margin * 2 }
  const filter = `highlight-glow-${id}`
  const drawing = svg('svg', { width: '100%', height: '100%', viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}` })
  patch(drawing, [
    node('defs', {}, '', [node('filter', { id: filter, filterUnits: 'userSpaceOnUse', ...bounds }, '', [
      node('feGaussianBlur', { stdDeviation: blur }),
    ])]),
    node('g', { fill: 'var(--highlight)', filter: `url(#${filter})` }, '',
      shapes.map(points => node('polygon', { points: pointsAttribute(points) }))),
  ])
  // A fresh wrapper starts the halo in the same frame as the newly focused border.
  const pulse = document.createElement('div')
  pulse.className = 'highlight-glow-pulse'
  pulse.append(drawing)
  surface.append(pulse)
  return {
    surface,
    move(camera: Camera): void {
      surface.style.transform = `translate(${camera.x + bounds.x * camera.k}px, ${camera.y + bounds.y * camera.k}px)`
      surface.style.width = `${bounds.width * camera.k}px`
      surface.style.height = `${bounds.height * camera.k}px`
    },
  }
}

/** One glow per focused body, placed in `layer` before `before` so the map draws over it. */
export function createGlows(layer: HTMLElement, before: Element) {
  const glows = new Map<string, ReturnType<typeof highlightGlow> & { signature: string }>()

  /** A glow is rebuilt only when its outline changes, so an unrelated repaint keeps its breathing. */
  const showGlow = (id: string, shapes: readonly Point[][], camera: Camera | undefined): void => {
    const signature = shapes.map(pointsAttribute).join('|')
    const previous = glows.get(id)
    if (previous?.signature === signature) return
    previous?.surface.remove()
    const glow = highlightGlow(id, shapes)
    layer.insertBefore(glow.surface, before)
    if (camera !== undefined) glow.move(camera)
    glows.set(id, { ...glow, signature })
  }

  return {
    /** Shows a glow for each id with a body in the scene and removes the others. */
    show(scene: LayeredScene, ids: readonly string[], camera: Camera | undefined): void {
      const visible = new Set<string>()
      for (const id of ids) {
        const shapes = glowShapes(scene, id)
        if (shapes === undefined) continue
        visible.add(id)
        showGlow(id, shapes, camera)
      }
      for (const [id, glow] of glows) {
        if (visible.has(id)) continue
        glow.surface.remove()
        glows.delete(id)
      }
    },
    move(camera: Camera): void {
      for (const glow of glows.values()) glow.move(camera)
    },
    /** Hides every glow, including ones shown later, until called with false. */
    hide(hidden: boolean): void {
      layer.toggleAttribute('data-glows-hidden', hidden)
    },
  }
}
