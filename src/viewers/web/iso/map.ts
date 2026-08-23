import { cameraTransform } from './camera.ts'
import type { Camera } from './camera.ts'
import { paintBuildings } from './paint-buildings.ts'
import { paintIslands, paintSheet, paintSlabs } from './paint-ground.ts'
import { paintRoutes, type RouteNode } from './paint-routes.ts'
import type { ProjectedScene } from './project.ts'
import type { Point } from '../../../types.ts'
import { namesVisible, weightAt } from './scale.ts'
import { mapDefs } from './style.ts'
import { svg } from './svg.ts'

/** A grid tile is four cells square: minor lines every cell, one major line each way. */
const TILE_CELLS = 4
const TILE_WIDTH = TILE_CELLS * 48
const TILE_HEIGHT = TILE_CELLS * 24

/**
 * The endless grid: one tile repeated over the whole pane, moved and scaled
 * with the camera so it stays aligned with the sheet's cells. Lines in both
 * isometric directions are drawn past the tile and clipped, so they join up
 * across tiles; their width is set per camera move to stay one screen pixel.
 */
function gridPattern(): { pattern: SVGPatternElement; lines: SVGPathElement[] } {
  const pattern = svg('pattern', {
    id: 'grid', patternUnits: 'userSpaceOnUse', width: TILE_WIDTH, height: TILE_HEIGHT,
  })
  const minor: string[] = []
  const major: string[] = []
  for (let index = -TILE_CELLS; index <= 2 * TILE_CELLS; index += 1) {
    const y = index * 24
    const lines = index % TILE_CELLS === 0 ? major : minor
    lines.push(`M0 ${y}L${TILE_WIDTH} ${y + TILE_HEIGHT}`, `M0 ${y}L${TILE_WIDTH} ${y - TILE_HEIGHT}`)
  }
  const paths = [svg('path', { d: minor.join('') }, 'grid'), svg('path', { d: major.join('') }, 'grid major')]
  /** Inside a pattern the stroke must scale with the tile; the width is corrected in `move` instead. */
  for (const path of paths) path.removeAttribute('vector-effect')
  pattern.append(...paths)
  return { pattern, lines: paths }
}

export interface IsoMap {
  svg: SVGSVGElement
  /** Applies the camera to the map; the grid stays aligned under it, strokes and arrowheads take the zoom's weight, building names show when readable. */
  move(camera: Camera, zoomRatio: number): void
  /** Rebuilds every layer; only a world change needs this. */
  paint(scene: ProjectedScene): void
  /** Marks a selected element with its surface and the routes touching it, or a selected route with both of its ends. */
  select(id: string | undefined): void
  /** Outlines the elements a selected task touches; an empty set clears them. */
  mark(ids: ReadonlySet<string>): void
  /** Lights a picked flow's routes and dims everything off its path. */
  setFlow(litIds: ReadonlySet<string>, onPath: (id: string) => boolean): void
  hitId(target: EventTarget | null): string | undefined
  /** True when a click hit nothing but the sheet. */
  isSheet(target: EventTarget | null): boolean
  /** The point a pin's foot stands on: the bottom-left (ground west) corner of a building, the west corner of a slab's top or of a system island. */
  anchorOf(id: string): Point | undefined
}

/** The map SVG: patterns, one camera group, and the layers back to front. */
export function createMap(host: HTMLElement): IsoMap {
  const root = svg('svg', { role: 'img', 'aria-label': 'Architecture map', tabindex: 0 })
  root.innerHTML = mapDefs
  const grid = gridPattern()
  root.querySelector('defs')!.append(grid.pattern)
  const field = svg('rect', { width: '100%', height: '100%', fill: 'url(#grid)' }, 'field')
  const camera = svg('g', {}, 'camera')
  const layers = {
    sheet: svg('g', {}, 'sheet'),
    islands: svg('g', {}, 'islands'),
    slabs: svg('g', {}, 'slabs'),
    routes: svg('g', {}, 'routes'),
    items: svg('g', {}, 'items'),
  }
  camera.append(...Object.values(layers))
  root.append(field, camera)
  host.replaceChildren(root)

  let items = new Map<string, Element>()
  let painted: ProjectedScene | undefined
  let routes = new Map<string, RouteNode>()
  /** The slab or system island each building and slab stands on, by id. */
  let surfaces = new Map<string, string>()

  return {
    svg: root,
    move(current, zoomRatio) {
      camera.style.transform = cameraTransform(current)
      const weight = weightAt(zoomRatio)
      camera.style.setProperty('--weight', String(weight))
      camera.style.setProperty('--name-opacity', namesVisible(current.k) ? '1' : '0')
      grid.pattern.setAttribute('patternTransform', `translate(${current.x} ${current.y}) scale(${current.k})`)
      for (const line of grid.lines) line.style.strokeWidth = String(1 / current.k)
      for (const route of routes.values()) route.head.setAttribute('transform', `scale(${weight / current.k})`)
    },
    paint(scene) {
      painted = scene
      for (const layer of Object.values(layers)) layer.replaceChildren()
      paintSheet(layers.sheet, scene)
      items = new Map([
        ...paintIslands(layers.islands, scene),
        ...paintSlabs(layers.slabs, scene),
        ...paintBuildings(layers.items, scene),
      ])
      routes = paintRoutes(layers.routes, scene)
      surfaces = new Map([
        ...scene.buildings.map(({ building }) => [building.representationId, building.surface] as const),
        ...scene.slabs.map(({ slab }) => [slab.representationId, slab.island] as const),
      ])
    },
    select(id) {
      const route = routes.get(id ?? '')
      const ends = new Set(route === undefined ? [id] : [route.source, route.target])
      const context = route === undefined ? surfaces.get(id ?? '') : undefined
      for (const [itemId, node] of items) {
        node.classList.toggle('selected', ends.has(itemId))
        node.classList.toggle('context', itemId === context)
      }
      for (const [routeId, node] of routes) {
        node.group.classList.toggle('selected', routeId === id)
        node.group.classList.toggle('endpoint', route === undefined && (ends.has(node.source) || ends.has(node.target)))
      }
    },
    mark(ids) {
      for (const [itemId, node] of items) node.classList.toggle('touched', ids.has(itemId))
    },
    setFlow(litIds, onPath) {
      const tracing = litIds.size > 0
      camera.toggleAttribute('data-tracing', tracing)
      for (const [routeId, route] of routes) route.group.classList.toggle('lit', litIds.has(routeId))
      for (const [itemId, node] of items) node.classList.toggle('onpath', tracing && onPath(itemId))
    },
    hitId(target) {
      if (!(target instanceof Element)) return undefined
      return target.closest<HTMLElement>('[data-id]')?.dataset.id
    },
    isSheet(target) {
      return target === root || target === field
    },
    anchorOf(id) {
      // a left face runs W0, S0, S1, W1 and a top face or island polygon N, E, S, W, so the west corner is the first
      // point of the one and the fourth of the others; a curved building's left face is its front band, whose first
      // point is the leftmost ground point of the curve
      const building = painted?.buildings.find(item => item.building.representationId === id)
      if (building) return building.tiers[0]!.find(face => face.side === 'left')!.points[0]
      const slab = painted?.slabs.find(item => item.slab.representationId === id)
      if (slab) return slab.faces.find(face => face.side === 'top')!.points[3]
      const island = painted?.islands.find(item => item.island.element?.representationId === id)
      return island?.polygon[3]
    },
  }
}
