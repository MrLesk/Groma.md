import type {
  ArchitectureWorld,
  Bounds,
  Point,
  SemanticItem,
  SemanticLevel,
  SemanticRoute,
  SemanticView,
  WorldElement,
} from '../../types.ts'
import { semanticView } from '../../semantic-view.ts'
import {
  canEnter,
  enterView,
} from '../tui/navigation-spatial.ts'
import { ancestorOfKind, defaultSelection } from '../tui/navigation.ts'
import {
  defaultProjection,
  project,
  type Projection,
} from './scene.ts'

export { defaultProjection }
export type { Projection }

export interface ProjectedItem {
  item: SemanticItem
  points: Point[]
  label: Point
}

export interface ProjectedRoute {
  route: SemanticRoute
  points: Point[]
  label: Bounds | null
}

export interface SvgScene {
  items: ProjectedItem[]
  routes: ProjectedRoute[]
  bounds: Bounds
}

export interface SvgCamera {
  center: Point
  zoom: number
  viewportWidth: number
  viewportHeight: number
  baseWidth: number
  baseHeight: number
}

export interface SemanticScope {
  level: SemanticLevel
  focusId: string | null
  selectedId: string | undefined
}

export type SemanticKeyTarget = 'hierarchy' | 'control' | 'text' | 'other'
export type SemanticKeyAction = 'enter' | 'leave' | 'clear'

/** Routes document keys without taking ownership of unrelated form controls. */
export function semanticKeyAction(
  key: string,
  target: SemanticKeyTarget,
): SemanticKeyAction | undefined {
  if (target === 'text') return undefined
  if (key === 'Enter') return target === 'control' ? undefined : 'enter'
  if (key === 'Backspace') return 'leave'
  if (key === 'x' || key === 'X') {
    return target === 'control' || target === 'hierarchy' ? undefined : 'clear'
  }
  return undefined
}

const CAMERA_MIN_ZOOM = 0.2
const CAMERA_MAX_ZOOM = 40
const CAMERA_MARGIN = 16
const MAX_ORBIT_ELEVATION = Math.PI / 2 - 0.02
const MIN_ORBIT_ELEVATION = 0.08

function finiteBounds(bounds: Bounds): Bounds {
  return Number.isFinite(bounds.x)
    && Number.isFinite(bounds.y)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    ? { ...bounds }
    : { x: 0, y: 0, width: 1, height: 1 }
}

function pointBounds(points: readonly Point[]): Bounds {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return finiteBounds({
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  })
}

function rectangle(bounds: Bounds, projection: Projection): Point[] {
  return [
    project(projection, bounds.x, bounds.y, 0),
    project(projection, bounds.x + bounds.width, bounds.y, 0),
    project(projection, bounds.x + bounds.width, bounds.y + bounds.height, 0),
    project(projection, bounds.x, bounds.y + bounds.height, 0),
  ]
}

function projectedLabel(item: SemanticItem, projection: Projection): Point {
  if (item.role === 'named' || item.role === 'campus') {
    return project(projection, item.bounds.x + 4, item.bounds.y + 6, 0)
  }
  return project(
    projection,
    item.bounds.x + item.bounds.width / 2,
    item.bounds.y + item.bounds.height / 2,
    0,
  )
}

function projectedLabelBounds(
  label: Bounds,
  projection: Projection,
): Bounds {
  return pointBounds(rectangle(label, projection))
}

function unionBounds(
  items: readonly ProjectedItem[],
  routes: readonly ProjectedRoute[],
): Bounds {
  const points: Point[] = []
  for (const item of items) points.push(...item.points, item.label)
  for (const route of routes) {
    points.push(...route.points)
    if (route.label) {
      const label = route.label
      points.push(
        { x: label.x, y: label.y },
        { x: label.x + label.width, y: label.y },
        { x: label.x + label.width, y: label.y + label.height },
        { x: label.x, y: label.y + label.height },
      )
    }
  }
  const bounds = pointBounds(points)
  return {
    x: bounds.x - CAMERA_MARGIN,
    y: bounds.y - CAMERA_MARGIN,
    width: bounds.width + CAMERA_MARGIN * 2,
    height: bounds.height + CAMERA_MARGIN * 2,
  }
}

/** Projects semantic boxes and authored semantic routes without reading raw world data. */
export function buildSvgScene(
  view: SemanticView,
  projection: Projection = defaultProjection,
): SvgScene {
  const items = view.items.map(item => ({
    item,
    points: rectangle(item.bounds, projection),
    label: projectedLabel(item, projection),
  }))
  const routes = view.routes.map(route => ({
    route,
    points: route.route.map(point => project(projection, point.x, point.y, 0)),
    label: route.label === null
      ? null
      : projectedLabelBounds(route.label, projection),
  }))
  return {
    items,
    routes,
    bounds: unionBounds(items, routes),
  }
}

function aspect(width: number, height: number): number {
  return Math.max(width, 1) / Math.max(height, 1)
}

/** Returns a camera whose zoom 1 view contains every projected item and route. */
export function fitCamera(
  scene: Pick<SvgScene, 'bounds'>,
  viewportWidth: number,
  viewportHeight: number,
): SvgCamera {
  const bounds = finiteBounds(scene.bounds)
  const width = Math.max(viewportWidth, 1)
  const height = Math.max(viewportHeight, 1)
  const baseHeight = Math.max(bounds.height, bounds.width / aspect(width, height))
  const baseWidth = baseHeight * aspect(width, height)
  return {
    center: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    },
    zoom: 1,
    viewportWidth: width,
    viewportHeight: height,
    baseWidth,
    baseHeight,
  }
}

export function cameraViewBox(camera: SvgCamera): Bounds {
  const width = camera.baseWidth / camera.zoom
  const height = camera.baseHeight / camera.zoom
  return {
    x: camera.center.x - width / 2,
    y: camera.center.y - height / 2,
    width,
    height,
  }
}

function clampZoom(zoom: number): number {
  return Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, zoom))
}

export function zoomAt(
  camera: SvgCamera,
  factor: number,
  anchor: Point,
): SvgCamera {
  const nextZoom = clampZoom(camera.zoom * factor)
  const ratio = camera.zoom / nextZoom
  return {
    ...camera,
    zoom: nextZoom,
    center: {
      x: anchor.x - (anchor.x - camera.center.x) * ratio,
      y: anchor.y - (anchor.y - camera.center.y) * ratio,
    },
  }
}

export function panCamera(
  camera: SvgCamera,
  deltaX: number,
  deltaY: number,
): SvgCamera {
  const view = cameraViewBox(camera)
  return {
    ...camera,
    center: {
      x: camera.center.x - deltaX * view.width / camera.viewportWidth,
      y: camera.center.y - deltaY * view.height / camera.viewportHeight,
    },
  }
}

export function resizeCamera(
  camera: SvgCamera,
  viewportWidth: number,
  viewportHeight: number,
): SvgCamera {
  const width = Math.max(viewportWidth, 1)
  const height = Math.max(viewportHeight, 1)
  return {
    ...camera,
    viewportWidth: width,
    viewportHeight: height,
    baseWidth: camera.baseHeight * aspect(width, height),
  }
}

export function orbitProjection(
  projection: Projection,
  deltaX: number,
  deltaY: number,
): Projection {
  return {
    rotation: projection.rotation - deltaX * 0.005,
    elevation: Math.min(
      MAX_ORBIT_ELEVATION,
      Math.max(MIN_ORBIT_ELEVATION, projection.elevation - deltaY * 0.005),
    ),
  }
}

function byId(world: ArchitectureWorld): Map<string, WorldElement> {
  return new Map(world.elements.map(element => [element.representationId, element]))
}

function selected(world: ArchitectureWorld, id: string | undefined): WorldElement | undefined {
  return id === undefined ? undefined : byId(world).get(id)
}

/** Maps any hierarchy/details pick to the smallest semantic city that can show it. */
export function selectionScope(
  world: ArchitectureWorld,
  id: string,
): SemanticScope | undefined {
  const element = selected(world, id)
  if (!element) return undefined
  if (element.external || element.kind === 'person' || element.kind === 'system') {
    return { level: 'context', focusId: null, selectedId: id }
  }
  const elements = byId(world)
  if (element.kind === 'container') {
    const system = ancestorOfKind(element, 'system', elements)
    return system === undefined
      ? { level: 'context', focusId: null, selectedId: defaultSelection(world, 'context')?.representationId }
      : { level: 'containers', focusId: system.representationId, selectedId: id }
  }
  const container = ancestorOfKind(element, 'container', elements)
  return container === undefined
    ? { level: 'context', focusId: null, selectedId: defaultSelection(world, 'context')?.representationId }
    : { level: 'components', focusId: container.representationId, selectedId: id }
}

function semanticForScope(world: ArchitectureWorld, scope: SemanticScope): SemanticView {
  return semanticView(world, {
    level: scope.level,
    ...(scope.focusId === null ? {} : { focusId: scope.focusId }),
  })
}

function validFocus(world: ArchitectureWorld, scope: SemanticScope): boolean {
  if (scope.level === 'context') return scope.focusId === null
  const focus = selected(world, scope.focusId ?? undefined)
  return focus !== undefined
    && !focus.external
    && ((scope.level === 'containers' && focus.kind === 'system')
      || (scope.level === 'components' && focus.kind === 'container'))
}

export interface SynchronizedSemanticScope {
  scope: SemanticScope
  view: SemanticView
}

/** Keeps selection inside the rebuilt semantic target set while preserving a valid scope. */
export function synchronizeSemanticScope(
  world: ArchitectureWorld,
  scope: SemanticScope,
): SynchronizedSemanticScope {
  let current: SemanticScope = {
    level: scope.level,
    focusId: scope.level === 'context' ? null : scope.focusId,
    selectedId: scope.selectedId,
  }
  let view = semanticForScope(world, current)
  if (!validFocus(world, current)) {
    current = { level: 'context', focusId: null, selectedId: current.selectedId }
    view = semanticForScope(world, current)
  }
  const targetIds = new Set(view.selectionTargets.map(target => target.representationId))
  if (current.selectedId !== undefined && targetIds.has(current.selectedId)) {
    return { scope: current, view }
  }
  const focusTarget = current.focusId !== null && targetIds.has(current.focusId)
    ? current.focusId
    : undefined
  return {
    scope: { ...current, selectedId: focusTarget ?? view.selectionTargets[0]?.representationId },
    view,
  }
}

/** The browser's Enter transition uses the same child choice as the TUI authority. */
export function enterSemanticScope(
  world: ArchitectureWorld,
  scope: SemanticScope,
): SemanticScope {
  const element = selected(world, scope.selectedId)
  if (!element || !canEnter(element)) return scope
  const entered = enterView(world, element)
  const focusId = element.kind === 'system' || element.kind === 'container'
    ? element.representationId
    : scope.focusId
  return {
    level: entered.level,
    focusId,
    selectedId: entered.currentId
      ?? defaultSelection(world, entered.level)?.representationId,
  }
}

/** Backspace leaves the currently entered boundary and selects that boundary. */
export function leaveSemanticScope(
  world: ArchitectureWorld,
  scope: SemanticScope,
): SemanticScope {
  if (scope.level === 'context') return scope
  const elements = byId(world)
  if (scope.level === 'containers') {
    const system = selected(world, scope.focusId ?? undefined)
      ?? ancestorOfKind(selected(world, scope.selectedId), 'system', elements)
    return {
      level: 'context',
      focusId: null,
      selectedId: system?.representationId
        ?? defaultSelection(world, 'context')?.representationId,
    }
  }
  const container = selected(world, scope.focusId ?? undefined)
    ?? ancestorOfKind(selected(world, scope.selectedId), 'container', elements)
  return {
    level: 'containers',
    focusId: container?.parent ?? null,
    selectedId: container?.representationId
      ?? defaultSelection(world, 'containers')?.representationId,
  }
}
