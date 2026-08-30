import type { Point } from '../../../types.ts'
import { PLANE } from '../../../sheet/measure.ts'
import { paintLayerLabels, paintLayerPlanes } from '../layers/paint.ts'
import type { LayeredScene } from '../layers/separation.ts'
import type { Camera } from './camera.ts'
import { paintBuildings } from './paint-buildings.ts'
import { paintIslands, paintSheet, paintSlabs } from './paint-ground.ts'
import { paintRoutes, type RouteNode } from './paint-routes.ts'
import { DEFAULT_PROJECTION, planeMatrix } from './project.ts'
import type { ProjectionView } from './project.ts'
import {
  GRID_TILE_CELLS,
  facadeDetailsVisible,
  gridVisible,
  minorGridVisible,
  weightAt,
} from './scale.ts'
import { mapDefs } from './style.ts'
import { svg } from './svg.ts'

/** A graph-paper tile: minor lines every cell, one major line each way. */
const TILE_SIZE = GRID_TILE_CELLS * PLANE
/** Idle time before the temporary motion delta commits into the SVG camera. */
const ZOOM_SETTLE_MS = 80

/**
 * The endless grid: one tile repeated over the whole pane, moved and scaled
 * with the camera so it stays aligned with the sheet's cells. Lines in both
 * isometric directions are drawn past the tile and clipped, so they join up
 * across tiles; their width is set per camera move to stay screen-constant.
 */
function gridPattern(): { pattern: SVGPatternElement; lines: SVGPathElement[] } {
  const pattern = svg('pattern', {
    id: 'grid', patternUnits: 'userSpaceOnUse', width: TILE_SIZE, height: TILE_SIZE,
  })
  const minor: string[] = []
  const major: string[] = []
  for (let index = 0; index < GRID_TILE_CELLS; index += 1) {
    const offset = index * PLANE
    const lines = index % GRID_TILE_CELLS === 0 ? major : minor
    lines.push(`M${offset} 0V${TILE_SIZE}`, `M0 ${offset}H${TILE_SIZE}`)
  }
  const paths = [svg('path', { d: minor.join('') }, 'grid'), svg('path', { d: major.join('') }, 'grid major')]
  /** Inside a pattern the stroke must scale with the tile; the width is corrected in `move` instead. */
  for (const path of paths) path.removeAttribute('vector-effect')
  pattern.append(...paths)
  return { pattern, lines: paths }
}

export interface IsoMap {
  svg: HTMLElement
  /** Applies the camera and reports whether its compositor scale changed. */
  move(camera: Camera, zoomRatio: number): boolean
  /** Rebuilds every layer after an architecture or project-profile change. */
  paint(scene: LayeredScene): void
  /** Unions the existing selected-element and selected-route treatments across an ordered selection. */
  select(ids: readonly string[]): void
  /** Outlines the elements the active tasks touch and accents the routes leaving them, dotted when the target is untouched; an empty set clears both. */
  mark(ids: ReadonlySet<string>): void
  /** Lights route ids and direct endpoints; contextual ancestors stay neutral while everything off the path dims. */
  setLitRoutes(litRouteIds: ReadonlySet<string>, onPath: (id: string) => boolean): void
  hitId(target: EventTarget | null): string | undefined
  /** True when a click hit nothing but the sheet. */
  isSheet(target: EventTarget | null): boolean
  /** True when a click or key target is the project plate's pencil action. */
  isProjectEdit(target: EventTarget | null): boolean
  /** The point a pin's foot stands on: the roof of a building, the top of a slab or the surface of a system island, near its left corner. */
  anchorOf(id: string): Point | undefined
}

/** World pixels from a surface's westmost point to a pin's foot. */
const FOOT_INSET = 10

/**
 * The westmost point moved straight right on screen: the two edges meeting at a west corner both run rightwards, so
 * this heads into the surface and the pin stands near its left corner instead of on the edge.
 */
function onSurface(points: readonly Point[]): Point {
  const west = points.reduce((best, point) => (point.x < best.x ? point : best))
  return { x: west.x + FOOT_INSET, y: west.y }
}

/** One fixed grid and one SVG camera, with a temporary HTML motion layer only while the camera moves. */
export function createMap(host: HTMLElement): IsoMap {
  const root = document.createElement('div')
  root.className = 'map-surface'
  root.setAttribute('role', 'img')
  root.setAttribute('aria-label', 'Architecture map')
  root.tabIndex = 0
  const scene = svg('svg', { width: '100%', height: '100%', overflow: 'visible' }, 'scene')
  scene.innerHTML = `<defs>${mapDefs()}</defs>`
  const definitions = scene.querySelector('defs')!
  const grid = gridPattern()
  const fieldSurface = svg('svg', { width: '100%', height: '100%', 'aria-hidden': 'true' }, 'field-surface')
  const fieldDefinitions = svg('defs')
  fieldDefinitions.append(grid.pattern)
  const field = svg('rect', { width: '100%', height: '100%', fill: 'url(#grid)' }, 'field')
  fieldSurface.append(fieldDefinitions, field)
  const camera = document.createElement('div')
  camera.className = 'camera'
  const layers = {
    sheet: svg('g', {}, 'sheet'),
    islands: svg('g', {}, 'islands'),
    slabs: svg('g', {}, 'slabs'),
    routes: svg('g', {}, 'routes'),
    items: svg('g', {}, 'items'),
    layerLabels: svg('g', {}, 'layer-labels'),
  }
  /** Owns the complete settled camera; the surrounding HTML layer holds only the active motion delta. */
  const world = svg('g', {}, 'world')
  world.append(...Object.values(layers))
  scene.append(world)
  camera.append(scene)
  root.append(fieldSurface, camera)
  host.replaceChildren(root)

  let items = new Map<string, Element>()
  let painted: LayeredScene | undefined
  let routes = new Map<string, RouteNode>()
  let composed: Camera | undefined
  let composedZoomRatio: number | undefined
  let committed: Camera | undefined
  let cameraTimer: ReturnType<typeof setTimeout> | undefined
  let latestCamera: { current: Camera; zoomRatio: number; showGrid: boolean } | undefined
  let gridView: ProjectionView = DEFAULT_PROJECTION
  /** The slab or system island each building and slab stands on, by id. */
  let surfaces = new Map<string, string>()

  const clearCameraTimer = (): void => {
    if (cameraTimer !== undefined) clearTimeout(cameraTimer)
    cameraTimer = undefined
  }

  const commitCamera = (current: Camera, zoomRatio: number, showGrid: boolean): void => {
    world.setAttribute('transform', `translate(${current.x} ${current.y}) scale(${current.k})`)
    committed = current
    const weight = weightAt(zoomRatio)
    camera.style.setProperty('--weight', String(weight))
    camera.style.setProperty('--camera-scale', String(current.k))
    camera.toggleAttribute('data-facades-hidden', !facadeDetailsVisible(current.k))
    field.style.display = showGrid ? '' : 'none'
    root.toggleAttribute('data-minor-grid-hidden', !minorGridVisible(current.k))
    for (const line of grid.lines) line.style.strokeWidth = String(1 / current.k)
    camera.style.removeProperty('transform')
    camera.style.removeProperty('will-change')
  }

  const scheduleCameraCommit = (): void => {
    clearCameraTimer()
    cameraTimer = setTimeout(() => {
      cameraTimer = undefined
      const latest = latestCamera
      if (latest === undefined) camera.style.removeProperty('will-change')
      else commitCamera(latest.current, latest.zoomRatio, latest.showGrid)
    }, ZOOM_SETTLE_MS)
  }

  const startCameraMotion = (): void => {
    camera.style.willChange = 'transform'
    scheduleCameraCommit()
  }

  /** Capture wheel motion before the normal host handler schedules its camera frame, including over sibling overlays. */
  host.addEventListener('wheel', () => {
    startCameraMotion()
  }, { capture: true, passive: true })
  root.addEventListener('pointerdown', event => {
    if (event.button === 0) startCameraMotion()
  }, { capture: true, passive: true })

  return {
    svg: root,
    move(current, zoomRatio) {
      const showGrid = gridVisible(current.k)
      if (showGrid) {
        grid.pattern.setAttribute(
          'patternTransform',
          `translate(${current.x} ${current.y}) scale(${current.k}) ${planeMatrix('ground', undefined, gridView)}`,
        )
      }
      const scaleChanged = current.k !== composed?.k || zoomRatio !== composedZoomRatio
      const cameraChanged = current.x !== composed?.x || current.y !== composed?.y || current.k !== composed?.k
      if (!cameraChanged && !scaleChanged) return false
      composed = current
      composedZoomRatio = zoomRatio
      latestCamera = { current, zoomRatio, showGrid }
      if (committed === undefined || camera.style.willChange !== 'transform') {
        clearCameraTimer()
        commitCamera(current, zoomRatio, showGrid)
      } else {
        const ratio = current.k / committed.k
        const x = current.x - committed.x * ratio
        const y = current.y - committed.y * ratio
        camera.style.transform = `translate(${x}px, ${y}px) scale(${ratio})`
        scheduleCameraCommit()
      }
      return scaleChanged
    },
    paint(scene) {
      painted = scene
      gridView = scene.view
      definitions.innerHTML = mapDefs(scene.view)
      for (const layer of Object.values(layers)) layer.replaceChildren()
      paintLayerPlanes(layers.sheet, scene)
      paintSheet(layers.sheet, scene)
      items = new Map([
        ...paintIslands(layers.islands, scene),
        ...paintSlabs(layers.slabs, scene),
        ...paintBuildings(layers.items, scene),
      ])
      routes = paintRoutes(layers.routes, scene)
      paintLayerLabels(layers.layerLabels, scene)
      surfaces = new Map([
        ...scene.buildings.map(({ building }) => [building.representationId, building.surface] as const),
        ...scene.slabs.map(({ slab }) => [slab.representationId, slab.island] as const),
      ])
    },
    select(ids) {
      const directItems = new Set<string>()
      const selectedItems = new Set<string>()
      const selectedRoutes = new Set<string>()
      const contexts = new Set<string>()
      for (const id of ids) {
        const route = routes.get(id)
        if (route !== undefined) {
          selectedRoutes.add(id)
          selectedItems.add(route.source).add(route.target)
        } else {
          directItems.add(id)
          selectedItems.add(id)
          const context = surfaces.get(id)
          if (context !== undefined) contexts.add(context)
        }
      }
      for (const [itemId, node] of items) {
        node.classList.toggle('selected', selectedItems.has(itemId))
        node.classList.toggle('context', contexts.has(itemId))
      }
      for (const [routeId, node] of routes) {
        node.group.classList.toggle('selected', selectedRoutes.has(routeId))
        node.group.classList.toggle('endpoint', directItems.has(node.source) || directItems.has(node.target))
      }
    },
    mark(ids) {
      for (const [itemId, node] of items) node.classList.toggle('touched', ids.has(itemId))
      for (const route of routes.values()) {
        const leaving = ids.has(route.source)
        route.group.classList.toggle('touched', leaving)
        route.group.classList.toggle('half', leaving && !ids.has(route.target))
      }
    },
    setLitRoutes(litRouteIds, onPath) {
      const tracing = litRouteIds.size > 0
      const litEndpointIds = new Set<string>()
      camera.toggleAttribute('data-tracing', tracing)
      for (const [routeId, route] of routes) {
        const lit = litRouteIds.has(routeId)
        route.group.classList.toggle('lit', lit)
        if (lit) litEndpointIds.add(route.source).add(route.target)
      }
      for (const [itemId, node] of items) {
        node.classList.toggle('lit', litEndpointIds.has(itemId))
        node.classList.toggle('onpath', tracing && onPath(itemId))
      }
    },
    hitId(target) {
      if (!(target instanceof Element)) return undefined
      return target.closest<HTMLElement>('[data-id]')?.dataset.id
    },
    isSheet(target) {
      return target === root || target === camera || target === scene || target === field
    },
    isProjectEdit(target) {
      return target instanceof Element && target.closest('[data-project-edit]') !== null
    },
    anchorOf(id) {
      const building = painted?.buildings.find(item => item.building.representationId === id)
      if (building) return onSurface(building.floors.at(-1)!.find(face => face.side === 'top')!.points)
      const slab = painted?.slabs.find(item => item.slab.representationId === id)
      if (slab) return onSurface(slab.faces.find(face => face.side === 'top')!.points)
      const island = painted?.islands.find(item => item.island.element?.representationId === id)
      return island === undefined ? undefined : onSurface(island.polygon)
    },
  }
}
