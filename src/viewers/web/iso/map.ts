import type { Comparison } from '../../../history/comparison.ts'
import type { Point } from '../../../types.ts'
import { paintLayerLabels, paintLayerPlanes } from '../layers/paint.ts'
import type { LayeredScene } from '../layers/separation.ts'
import type { Camera } from './camera.ts'
import { buildingsSvg, facadeDefs } from './paint-buildings.ts'
import { islandsSvg, sheetSvg, slabsSvg } from './paint-ground.ts'
import { routesSvg } from './paint-routes.ts'
import { gridPatternSvg, gridTransform } from './grid.ts'
import { boundsOf, DEFAULT_PROJECTION } from './project.ts'
import type { ProjectionView } from './project.ts'
import {
  facadeDetailsVisible,
  gridVisible,
  minorGridVisible,
  weightAt,
} from './scale.ts'
import { mapDefs } from './style.ts'
import { pointsAttribute, svg, svgMarkup } from './svg.ts'
import { layoutSurfaceLabels, surfaceLabelStep } from './text.ts'

/** Let zoom settle before committing its sharp SVG scale. Panning keeps the cached layer. */
const CAMERA_SETTLE_MS = 250

interface RouteNode {
  group: SVGGElement
  ids: string[]
  source: string
  target: string
}

export interface IsoMap {
  svg: HTMLElement
  /** Prepare the cached camera layer before the first movement frame. */
  prepareCamera(): void
  /** Applies the camera and reports whether its compositor scale changed. */
  move(camera: Camera, zoomRatio: number): boolean
  /** Rebuilds every layer after an architecture or project-profile change. */
  paint(scene: LayeredScene): void
  /** Unions the existing selected-element and selected-route treatments across an ordered selection. */
  select(ids: readonly string[]): void
  changes(comparison: Comparison | undefined): void
  /** Outlines the elements the active tasks touch and uniformly accents the routes leaving them; an empty set clears both. */
  mark(ids: ReadonlySet<string>): void
  /** Gives the inspected component a breathing glow and softly accents its direct component neighbors. */
  markNeighbors(selectedId: string | undefined, neighbors: ReadonlySet<string>): void
  /** Lights route ids and direct endpoints; contextual ancestors stay neutral while everything off the path dims. */
  setLitRoutes(litRouteIds: ReadonlySet<string>, onPath: (id: string) => boolean, focusedRouteId?: string): void
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

/** Separate SVG paint surfaces keep animated routes from repainting the ground and buildings in Safari. */
function paintSurface(name: string, layers: SVGGElement[]) {
  const surface = document.createElement('div')
  surface.className = `paint-surface ${name}`
  const scene = svg('svg', { width: '100%', height: '100%', overflow: 'visible' }, 'scene')
  const world = svg('g', {}, 'world')
  world.append(...layers)
  scene.append(world)
  surface.append(scene)
  return { surface, scene, world }
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
  drawing.innerHTML = svgMarkup('defs', {}, '',
    svgMarkup('filter', { id: filter, filterUnits: 'userSpaceOnUse', ...bounds }, '',
      svgMarkup('feGaussianBlur', { stdDeviation: blur })))
    + svgMarkup('g', { fill: 'var(--highlight)', filter: `url(#${filter})` }, '',
      shapes.map(points => svgMarkup('polygon', { points: pointsAttribute(points) })).join(''))
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

/** The glow follows the same projected geometry as the highlighted architecture body. */
function glowGeometry(scene: LayeredScene, id: string) {
  const source = scene.buildings.find(item => item.building.representationId === id)
    ?? scene.slabs.find(item => item.slab.representationId === id)
    ?? scene.islands.find(item => item.island.element?.representationId === id)
  if (source === undefined) return undefined
  if ('floors' in source) return { source, shapes: source.floors.flat().map(face => face.points) }
  if ('faces' in source) return { source, shapes: source.faces.map(face => face.points) }
  return { source, shapes: [source.polygon] }
}

/** One fixed grid and one shared camera across ground, routes and foreground paint surfaces. */
export function createMap(host: HTMLElement): IsoMap {
  const root = document.createElement('div')
  root.className = 'map-surface'
  root.setAttribute('role', 'img')
  root.setAttribute('aria-label', 'Architecture map')
  root.tabIndex = 0
  const fieldSurface = svg('svg', { width: '100%', height: '100%', 'aria-hidden': 'true' }, 'field-surface')
  const fieldDefinitions = svg('defs')
  fieldDefinitions.innerHTML = gridPatternSvg({ x: 0, y: 0, k: 1 })
  const grid = {
    pattern: fieldDefinitions.querySelector('pattern')!,
    lines: [...fieldDefinitions.querySelectorAll('path')],
  }
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
  const ground = paintSurface('ground-surface', [layers.sheet, layers.islands, layers.slabs])
  const routeSurface = paintSurface('route-surface', [layers.routes])
  const foreground = paintSurface('foreground-surface', [layers.items, layers.layerLabels])
  const glows = new Map<string, ReturnType<typeof highlightGlow> & { geometry: object }>()
  const definitions = svg('defs')
  definitions.innerHTML = mapDefs()
  foreground.scene.prepend(definitions)
  const paintSurfaces = [ground, routeSurface, foreground]
  camera.append(...paintSurfaces.map(({ surface }) => surface))
  root.append(fieldSurface, camera)
  host.replaceChildren(root)

  let items = new Map<string, Element>()
  let painted: LayeredScene | undefined
  let routes = new Map<string, RouteNode>()
  let composed: Camera | undefined
  let composedZoomRatio: number | undefined
  let committed: Camera | undefined
  let committedZoomRatio: number | undefined
  let cameraTimer: ReturnType<typeof setTimeout> | undefined
  let latestCamera: { current: Camera; zoomRatio: number; showGrid: boolean } | undefined
  let gridView: ProjectionView = DEFAULT_PROJECTION
  let labels: SVGGElement[] = []
  let labelStep = surfaceLabelStep(1)
  /** The slab or system island each building and slab stands on, by id. */
  let surfaces = new Map<string, string>()

  const showGlow = (id: string, geometry: NonNullable<ReturnType<typeof glowGeometry>>): void => {
    const previous = glows.get(id)
    if (previous?.geometry === geometry.source) return
    previous?.surface.remove()
    const glow = highlightGlow(id, geometry.shapes)
    camera.insertBefore(glow.surface, routeSurface.surface)
    if (committed !== undefined) glow.move(committed)
    glows.set(id, { ...glow, geometry: geometry.source })
  }

  /** Selection and flow focus share one glow per visible shape, including their overlapping endpoints. */
  const updateGlows = (): void => {
    if (painted === undefined) return
    const visible = new Set<string>()
    for (const node of root.querySelectorAll<SVGGElement>('.component-focus, :is(.building, .slab, .island).focused')) {
      const id = node.dataset.id!
      const geometry = glowGeometry(painted, id)
      if (geometry === undefined) continue
      visible.add(id)
      showGlow(id, geometry)
    }
    for (const [id, glow] of glows) {
      if (visible.has(id)) continue
      glow.surface.remove()
      glows.delete(id)
    }
  }

  const clearCameraTimer = (): void => {
    if (cameraTimer !== undefined) clearTimeout(cameraTimer)
    cameraTimer = undefined
  }

  /** Refresh scale-dependent SVG together; per-frame writes invalidate Safari's cached layer. */
  const commitCamera = (current: Camera, zoomRatio: number, showGrid: boolean): void => {
    const nextLabelStep = surfaceLabelStep(current.k)
    if (nextLabelStep !== labelStep) {
      layoutSurfaceLabels(labels, current.k, gridView)
      labelStep = nextLabelStep
    }
    for (const glow of glows.values()) glow.move(current)
    for (const { world } of paintSurfaces) {
      world.setAttribute('transform', `translate(${current.x} ${current.y}) scale(${current.k})`)
    }
    committed = current
    committedZoomRatio = zoomRatio
    const weight = weightAt(zoomRatio)
    camera.style.setProperty('--weight', String(weight))
    camera.style.setProperty('--camera-scale', String(current.k))
    camera.toggleAttribute('data-facades-hidden', !facadeDetailsVisible(current.k))
    field.style.display = showGrid ? '' : 'none'
    const gridScale = current.k
    root.toggleAttribute('data-minor-grid-hidden', !minorGridVisible(gridScale))
    for (const line of grid.lines) line.style.strokeWidth = String(1 / gridScale)
    camera.style.removeProperty('transform')
    camera.style.removeProperty('will-change')
    host.removeAttribute('data-camera-moving')
  }

  const scheduleCameraCommit = (): void => {
    clearCameraTimer()
    cameraTimer = setTimeout(() => {
      cameraTimer = undefined
      host.removeAttribute('data-camera-moving')
      const latest = latestCamera
      if (latest === undefined) camera.style.removeProperty('will-change')
      else if (latest.current.k !== committed?.k || latest.zoomRatio !== committedZoomRatio) {
        commitCamera(latest.current, latest.zoomRatio, latest.showGrid)
      }
    }, CAMERA_SETTLE_MS)
  }

  const startCameraMotion = (): void => {
    // Hover changes beneath a stationary pointer repaint Safari's cached SVG during inertia.
    host.toggleAttribute('data-camera-moving', true)
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
    prepareCamera: startCameraMotion,
    move(current, zoomRatio) {
      const gridScale = current.k
      const showGrid = gridVisible(gridScale)
      if (showGrid) {
        grid.pattern.setAttribute(
          'patternTransform',
          gridTransform(current, gridView),
        )
      }
      const scaleChanged = current.k !== composed?.k || zoomRatio !== composedZoomRatio
      const cameraChanged = current.x !== composed?.x || current.y !== composed?.y || current.k !== composed?.k
      if (!cameraChanged && !scaleChanged) return false
      composed = current
      composedZoomRatio = zoomRatio
      latestCamera = { current, zoomRatio, showGrid }
      if (committed !== undefined) camera.style.willChange = 'transform'
      if (committed === undefined) {
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
      const zoom = composed?.k ?? 1
      labelStep = surfaceLabelStep(zoom)
      definitions.innerHTML = mapDefs(scene.view) + facadeDefs(scene)
      for (const layer of Object.values(layers)) layer.replaceChildren()
      paintLayerPlanes(layers.sheet, scene)
      layers.sheet.insertAdjacentHTML('beforeend', sheetSvg(scene))
      layers.islands.innerHTML = islandsSvg(scene, zoom)
      layers.slabs.innerHTML = slabsSvg(scene, zoom)
      layers.items.innerHTML = buildingsSvg(scene)
      items = new Map([layers.islands, layers.slabs, layers.items].flatMap(layer =>
        [...layer.querySelectorAll<SVGGElement>('[data-id]')].map(node => [node.dataset.id!, node] as const)))
      layers.routes.innerHTML = routesSvg(scene)
      const groups = new Map([...layers.routes.querySelectorAll<SVGGElement>('g.route')]
        .map(group => [group.dataset.id!, group]))
      routes = new Map()
      for (const { route } of scene.routes) {
        const ids = route.relationshipIds ?? [route.id]
        const node = { group: groups.get(route.id)!, ids, source: route.source, target: route.target }
        for (const id of ids) routes.set(id, node)
      }
      paintLayerLabels(layers.layerLabels, scene)
      surfaces = new Map([
        ...scene.buildings.map(({ building }) => [building.representationId, building.surface] as const),
        ...scene.slabs.map(({ slab }) => [slab.representationId, slab.island] as const),
      ])
      labels = [...ground.world.querySelectorAll<SVGGElement>('.surface-label')]
    },
    changes(comparison) {
      const apply = (node: Element, status: string | undefined) => {
        if (status === undefined || status === 'unchanged') node.removeAttribute('data-change')
        else node.setAttribute('data-change', status)
      }
      for (const [id, node] of items) apply(node, comparison?.components[id]?.status)
      for (const route of new Set(routes.values())) {
        const statuses = new Set(route.ids.map(id => comparison?.relationships[id]).filter(status => status !== undefined && status !== 'unchanged'))
        apply(route.group, statuses.size > 1 ? 'modified' : [...statuses][0])
      }
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
      for (const node of new Set(routes.values())) {
        node.group.classList.toggle('selected', node.ids.some(id => selectedRoutes.has(id)))
        node.group.classList.toggle('endpoint', directItems.has(node.source) || directItems.has(node.target))
      }
    },
    markNeighbors(selectedId, neighbors) {
      for (const [itemId, node] of items) {
        node.classList.toggle('component-focus', itemId === selectedId)
        node.classList.toggle('neighbor', itemId !== selectedId && neighbors.has(itemId))
      }
      updateGlows()
    },
    mark(ids) {
      for (const [itemId, node] of items) node.classList.toggle('touched', ids.has(itemId))
      for (const route of new Set(routes.values())) {
        route.group.classList.toggle('touched', ids.has(route.source))
      }
    },
    setLitRoutes(litRouteIds, onPath, focusedRouteId) {
      const tracing = litRouteIds.size > 0
      const litEndpointIds = new Set<string>()
      const focused = focusedRouteId === undefined ? undefined : routes.get(focusedRouteId)
      camera.toggleAttribute('data-tracing', tracing)
      for (const route of new Set(routes.values())) {
        const lit = route.ids.some(id => litRouteIds.has(id))
        route.group.classList.toggle('lit', lit)
        route.group.classList.toggle('focused', lit && focusedRouteId !== undefined && route.ids.includes(focusedRouteId))
        if (lit) litEndpointIds.add(route.source).add(route.target)
      }
      for (const [itemId, node] of items) {
        node.classList.toggle('lit', litEndpointIds.has(itemId))
        node.classList.toggle('focused', litEndpointIds.has(itemId) && (itemId === focused?.source || itemId === focused?.target))
        node.classList.toggle('onpath', tracing && onPath(itemId))
      }
      updateGlows()
    },
    hitId(target) {
      if (!(target instanceof Element)) return undefined
      return target.closest<HTMLElement>('[data-id]')?.dataset.id
    },
    isSheet(target) {
      return target === root || target === camera || target === field
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
