import type { Comparison } from '../../../history/comparison.ts'
import type { Point } from '../../../types.ts'
import { layerLabelsSvg, layerPlanesSvg } from '../layers/paint.ts'
import type { LayeredScene } from '../layers/separation.ts'
import type { Camera } from './camera.ts'
import { createGlows } from './glow.ts'
import { buildingsSvg, facadeDefs } from './paint-buildings.ts'
import { islandsSvg, sheetSvg, slabsSvg } from './paint-ground.ts'
import { routesSvg } from './paint-routes.ts'
import { gridPatternSvg, gridTransform } from './grid.ts'
import { DEFAULT_PROJECTION } from './project.ts'
import {
  facadeDetailsVisible,
  gridVisible,
  minorGridVisible,
  weightAt,
} from './scale.ts'
import { mapDefs } from './style.ts'
import { patch, svg } from './svg.ts'
import { surfaceLabelStep } from './text.ts'

/** The map settles this long after its camera last moved or it was last repainted: a zoom commits its sharp SVG scale, and glows return. Panning keeps the cached layer. */
const SETTLE_MS = 250

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
  /**
   * Draws the scene into the existing layers, reusing their elements; a repaint counts as map motion. Returns true
   * when the highlights must be applied again: elements were created or removed, or the routes and surfaces they
   * read changed.
   */
  paint(scene: LayeredScene): boolean
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

/** A camera with the zoom ratio its stroke weight follows. */
interface CameraView {
  camera: Camera
  zoomRatio: number
}

/** What the highlight setters read from the scene besides the drawn elements: each route's ids and ends, and the surface under each body. */
function highlightInputs(scene: LayeredScene) {
  return {
    routes: scene.routes.map(({ route }) => ({ id: route.id, ids: route.relationshipIds ?? [route.id], source: route.source, target: route.target })),
    surfaces: [
      ...scene.buildings.map(({ building }) => [building.representationId, building.surface] as const),
      ...scene.slabs.map(({ slab }) => [slab.representationId, slab.island] as const),
    ],
  }
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
  const definitions = svg('defs')
  foreground.scene.prepend(definitions)
  const paintSurfaces = [ground, routeSurface, foreground]
  camera.append(...paintSurfaces.map(({ surface }) => surface))
  const glows = createGlows(camera, routeSurface.surface)
  root.append(fieldSurface, camera)
  host.replaceChildren(root)

  let items = new Map<string, Element>()
  let painted: LayeredScene | undefined
  let routes = new Map<string, RouteNode>()
  /** The camera the map shows now, and the one last written into the SVG; between them the cached layer moves. */
  let latest: CameraView | undefined
  let committed: CameraView | undefined
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let movedAt = 0
  let labelStep = surfaceLabelStep(1)
  /** True from a repaint until the camera is next committed or the map settles: the cached layer no longer shows the picture. */
  let repainted = false
  /** The slab or system island each building and slab stands on, by id. */
  let surfaces = new Map<string, string>()
  /** The scene inputs the current highlights were applied with, as JSON. */
  let highlighted = ''

  /** Selection and flow focus share one glow per visible body, including their overlapping endpoints. Glows wait while the map moves. */
  const updateGlows = (): void => {
    if (painted === undefined || host.hasAttribute('data-map-moving')) return
    const focused = [...items].filter(([, item]) => item.matches('.component-focus, :is(.building, .slab, .island).focused'))
    glows.show(painted, focused.map(([id]) => id), committed?.camera)
  }

  /** Islands and slabs carry the surface titles, the only drawing that depends on the zoom's title step. */
  const drawSurfaces = (scene: LayeredScene, zoom: number): boolean => {
    labelStep = surfaceLabelStep(zoom)
    return [patch(layers.islands, islandsSvg(scene, zoom)), patch(layers.slabs, slabsSvg(scene, zoom))].some(Boolean)
  }

  /** Draws the scene at one zoom's title step; only values that changed are written. Reports whether elements were created or removed. */
  const draw = (scene: LayeredScene, zoom: number): boolean => [
    patch(definitions, [...mapDefs(scene.view), ...facadeDefs(scene)]),
    patch(layers.sheet, [...layerPlanesSvg(scene), ...sheetSvg(scene)]),
    drawSurfaces(scene, zoom),
    patch(layers.items, buildingsSvg(scene)),
    patch(layers.routes, routesSvg(scene)),
    patch(layers.layerLabels, layerLabelsSvg(scene)),
  ].some(Boolean)

  /** The drawn items and routes by id, and the surface under each body, as the highlight setters read them. */
  const index = (inputs: ReturnType<typeof highlightInputs>): void => {
    items = new Map([layers.islands, layers.slabs, layers.items].flatMap(layer =>
      [...layer.querySelectorAll<SVGGElement>('[data-id]')].map(item => [item.dataset.id!, item] as const)))
    const groups = new Map([...layers.routes.querySelectorAll<SVGGElement>('g.route')]
      .map(group => [group.dataset.id!, group]))
    routes = new Map()
    for (const route of inputs.routes) {
      const entry = { group: groups.get(route.id)!, ids: route.ids, source: route.source, target: route.target }
      for (const id of route.ids) routes.set(id, entry)
    }
    surfaces = new Map(inputs.surfaces)
  }

  /** Refresh scale-dependent SVG together; per-frame writes invalidate Safari's cached layer. */
  const commitCamera = (view: CameraView): void => {
    const current = view.camera
    // Surface titles move to the settled zoom's step through the same painters; only their attributes change.
    if (painted !== undefined && surfaceLabelStep(current.k) !== labelStep) drawSurfaces(painted, current.k)
    glows.move(current)
    for (const { world } of paintSurfaces) {
      world.setAttribute('transform', `translate(${current.x} ${current.y}) scale(${current.k})`)
    }
    committed = view
    camera.style.setProperty('--weight', String(weightAt(view.zoomRatio)))
    camera.style.setProperty('--camera-scale', String(current.k))
    camera.toggleAttribute('data-facades-hidden', !facadeDetailsVisible(current.k))
    field.style.display = gridVisible(current.k) ? '' : 'none'
    root.toggleAttribute('data-minor-grid-hidden', !minorGridVisible(current.k))
    for (const line of grid.lines) line.style.strokeWidth = String(1 / current.k)
    repainted = false
    camera.style.removeProperty('transform')
    camera.style.removeProperty('will-change')
  }

  /** The map settles once nothing has moved it for SETTLE_MS; one timer waits for that instead of restarting on every frame. */
  const settle = (): void => {
    const wait = movedAt + SETTLE_MS - performance.now()
    if (wait > 0) {
      settleTimer = setTimeout(settle, wait)
      return
    }
    settleTimer = undefined
    host.removeAttribute('data-map-moving')
    repainted = false
    if (latest === undefined) camera.style.removeProperty('will-change')
    else if (latest.camera.k !== committed?.camera.k || latest.zoomRatio !== committed?.zoomRatio) commitCamera(latest)
    updateGlows()
  }

  const scheduleSettle = (): void => {
    movedAt = performance.now()
    if (settleTimer === undefined) settleTimer = setTimeout(settle, SETTLE_MS)
  }

  /** A camera change or a repaint moves the map until it settles; hover highlights and glows wait for that. */
  const markMoving = (): void => {
    // Hover changes beneath a stationary pointer repaint Safari's cached SVG during inertia.
    host.toggleAttribute('data-map-moving', true)
    scheduleSettle()
  }

  /** Promotes the cached camera layer before a gesture or animation moves it; a committed zoom releases it, while a pan keeps it cached. */
  const startCameraMotion = (): void => {
    camera.style.willChange = 'transform'
    scheduleSettle()
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
      if (gridVisible(current.k)) grid.pattern.setAttribute('patternTransform', gridTransform(current, painted?.view ?? DEFAULT_PROJECTION))
      const scaleChanged = current.k !== latest?.camera.k || zoomRatio !== latest?.zoomRatio
      const cameraChanged = current.x !== latest?.camera.x || current.y !== latest?.camera.y || current.k !== latest?.camera.k
      if (!cameraChanged && !scaleChanged) return false
      latest = { camera: current, zoomRatio }
      markMoving()
      // A repainted picture has no cached layer worth moving, so the camera goes straight into the SVG.
      if (committed === undefined || repainted) commitCamera(latest)
      else {
        camera.style.willChange = 'transform'
        const ratio = current.k / committed.camera.k
        const x = current.x - committed.camera.x * ratio
        const y = current.y - committed.camera.y * ratio
        camera.style.transform = `translate(${x}px, ${y}px) scale(${ratio})`
      }
      return scaleChanged
    },
    paint(scene) {
      painted = scene
      const reshaped = draw(scene, latest?.camera.k ?? 1)
      repainted = true
      markMoving()
      const inputs = highlightInputs(scene)
      const key = JSON.stringify(inputs)
      if (!reshaped && key === highlighted) return false
      highlighted = key
      index(inputs)
      return true
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
