import type {
  AnnotatedElement,
  Bounds,
  C4Kind,
  Origin,
  Point,
  TerminalLevel,
} from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import { projectBounds, projectPoint, type TerminalCamera } from './projection-camera.ts'
import { containerLayout } from './projection-container.ts'
import { rootLayout } from './projection-root.ts'
import { attachRoute } from './projection-routes.ts'
import { terminalPoint } from './projection-sheet.ts'

export type MapKind = C4Kind | 'group'
export type MapShape = 'slab' | 'card' | 'group' | 'island'

export interface ProjectedMapItem {
  key: string
  representationId?: string
  id?: string
  title: string
  kind: MapKind
  origin: Origin
  external: boolean
  shape: MapShape
  lines: string[]
  worldBounds: Bounds
  cellBounds: Bounds
}

/** An item before the camera places it: everything but its cells. */
export type WorldItem = Omit<ProjectedMapItem, 'cellBounds'>

export interface ProjectedMapRoute {
  ids: string[]
  source: string
  target: string
  description: string
  origin: Origin
  worldRoute: Point[]
  cellRoute: Point[]
}

export interface TerminalProjection {
  level: TerminalLevel
  currentId: string | null
  /** The container whose map this is; null at root. */
  scope: string | null
  camera: TerminalCamera
  viewport: Bounds
  worldBounds: Bounds
  items: ProjectedMapItem[]
  relationships: ProjectedMapRoute[]
}

export interface TerminalProjectionOptions {
  viewport: Bounds
  level?: TerminalLevel
  currentId?: string
  /** Exact task or flow endpoints the camera should reveal without changing selection. */
  attentionIds?: readonly string[]
  camera?: TerminalCamera
}

function focusContainer(
  model: TerminalViewModel,
  currentId: string | undefined,
): AnnotatedElement | undefined {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  let current = currentId === undefined ? undefined : byId.get(currentId)
  while (current && current.kind !== 'container') {
    current = current.parent === null ? undefined : byId.get(current.parent)
  }
  return current
}

function unionBounds(items: readonly { worldBounds: Bounds }[], margin = 2): Bounds {
  if (items.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  const left = Math.min(...items.map(item => item.worldBounds.x)) - margin
  const top = Math.min(...items.map(item => item.worldBounds.y)) - margin
  const right = Math.max(...items.map(item => item.worldBounds.x + item.worldBounds.width)) + margin
  const bottom = Math.max(...items.map(item => item.worldBounds.y + item.worldBounds.height)) + margin
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function visibleEndpointFor(
  id: string,
  visible: ReadonlyMap<string, WorldItem>,
  elements: ReadonlyMap<string, AnnotatedElement>,
  fallback: WorldItem | undefined,
): WorldItem | undefined {
  let current = elements.get(id)
  while (current) {
    const item = visible.get(current.representationId)
    if (item) return item
    current = current.parent === null ? undefined : elements.get(current.parent)
  }
  return fallback
}

/** One camera axis: centre a small world; otherwise move only enough to reveal the selection. */
function revealedAxis(
  worldStart: number,
  worldSize: number,
  viewportSize: number,
  previous: number | undefined,
  selectionStart: number | undefined,
  selectionSize: number | undefined,
): number {
  if (worldSize <= viewportSize) return worldStart - Math.floor((viewportSize - worldSize) / 2)
  const last = worldStart + worldSize - viewportSize
  let next = Math.max(worldStart, Math.min(last, previous ?? worldStart))
  if (selectionStart === undefined || selectionSize === undefined) return next
  if (selectionSize >= viewportSize) {
    if (previous === undefined) {
      return Math.max(worldStart, Math.min(last, selectionStart + (selectionSize - viewportSize) / 2))
    }
    const selectionEnd = selectionStart + selectionSize
    if (selectionEnd <= next) next = selectionEnd - 1
    else if (selectionStart >= next + viewportSize) next = selectionStart - viewportSize + 1
    return Math.max(worldStart, Math.min(last, next))
  }
  if (selectionStart < next + 1) next = selectionStart - 1
  if (selectionStart + selectionSize > next + viewportSize - 1) {
    next = selectionStart + selectionSize - viewportSize + 1
  }
  return Math.max(worldStart, Math.min(last, next))
}

function fittedCamera(
  reveal: Bounds | undefined,
  world: Bounds,
  viewport: Bounds,
  previous: TerminalCamera | undefined,
): TerminalCamera {
  return {
    x: revealedAxis(world.x, world.width, viewport.width, previous?.x, reveal?.x, reveal?.width),
    y: revealedAxis(world.y, world.height, viewport.height, previous?.y, reveal?.y, reveal?.height),
  }
}

/** A large surface focuses its readable north-west label; a system initially opens over its first container. */
function selectionReveal(
  model: TerminalViewModel,
  selected: WorldItem | undefined,
  visible: ReadonlyMap<string, WorldItem>,
  viewport: Bounds,
): Bounds | undefined {
  if (selected === undefined) return undefined
  const firstSlab = selected.shape === 'island'
    ? model.sheet.slabs.find(slab => slab.island === selected.key)
    : undefined
  const item = firstSlab === undefined ? selected : visible.get(firstSlab.representationId) ?? selected
  if (item.shape !== 'island' && item.shape !== 'slab' && item.shape !== 'group') return item.worldBounds
  return {
    x: item.worldBounds.x,
    y: item.worldBounds.y,
    width: item.worldBounds.width < viewport.width - 2
      ? item.worldBounds.width
      : Math.min(item.worldBounds.width, item.title.length + 4),
    height: item.worldBounds.height < viewport.height - 2
      ? item.worldBounds.height
      : Math.min(item.worldBounds.height, 3),
  }
}

/** True when the element or one of its ancestors is the scope. */
function withinScope(elements: ReadonlyMap<string, AnnotatedElement>, scopeId: string, id: string): boolean {
  let element = elements.get(id)
  while (element) {
    if (element.representationId === scopeId) return true
    element = element.parent === null ? undefined : elements.get(element.parent)
  }
  return false
}

/** The visible shapes a sheet route joins at this level, or nothing when the level does not draw it. */
function routeEnds(
  route: { source: string; target: string },
  level: TerminalLevel,
  visible: ReadonlyMap<string, WorldItem>,
  elements: ReadonlyMap<string, AnnotatedElement>,
  boundary: WorldItem | undefined,
): { source: WorldItem; target: WorldItem } | undefined {
  const fallback = level === 'components' ? boundary : undefined
  const source = visibleEndpointFor(route.source, visible, elements, fallback)
  const target = visibleEndpointFor(route.target, visible, elements, fallback)
  if (!source || !target || source.key === target.key) return undefined
  const scopeId = boundary?.representationId
  if (level === 'components' && scopeId !== undefined && !withinScope(elements, scopeId, route.source) && !withinScope(elements, scopeId, route.target)) return undefined
  return { source, target }
}

function projectRelationships(
  model: TerminalViewModel,
  level: TerminalLevel,
  items: WorldItem[],
  camera: TerminalCamera,
  viewport: Bounds,
  focus: AnnotatedElement | undefined,
): ProjectedMapRoute[] {
  const visible = new Map(items.flatMap(item => {
    return item.representationId === undefined ? [] : [[item.representationId, item] as const]
  }))
  const elements = new Map(model.elements.map(element => [element.representationId, element]))
  const boundary = focus === undefined ? undefined : visible.get(focus.representationId)
  const authored = new Map(model.relationships.map(relationship => [relationship.id, relationship]))
  const pairs = new Map<string, ProjectedMapRoute>()
  for (const route of model.sheet.routes) {
    const relationship = authored.get(route.id)
    const ends = relationship === undefined ? undefined : routeEnds(route, level, visible, elements, boundary)
    if (relationship === undefined || ends === undefined) continue
    const pair = `${ends.source.key}\0${ends.target.key}`
    const existing = pairs.get(pair)
    if (existing) {
      existing.ids.push(route.id)
      continue
    }
    const worldRoute = attachRoute(
      route.points.map(terminalPoint),
      ends.source.worldBounds,
      ends.target.worldBounds,
    )
    if (worldRoute.length < 2) continue
    pairs.set(pair, {
      ids: [route.id],
      source: ends.source.key,
      target: ends.target.key,
      description: relationship.description,
      origin: relationship.origin,
      worldRoute,
      cellRoute: worldRoute.map(point => projectPoint(point, camera, viewport)),
    })
  }
  return [...pairs.values()]
}

/** What a level shows: the root sheet or one container's stable part of that sheet. */
function levelItems(model: TerminalViewModel, level: TerminalLevel, currentId: string | undefined): { items: WorldItem[]; focus: AnnotatedElement | undefined } {
  const focus = level === 'components' ? focusContainer(model, currentId) : undefined
  const items = level === 'context'
    ? rootLayout(model)
    : focus === undefined ? [] : containerLayout(model, focus)
  return { items, focus }
}

export function mapAnchors(
  model: TerminalViewModel,
  level: TerminalLevel,
  currentId: string | undefined,
): Map<string, Bounds> {
  const { items } = levelItems(model, level, currentId)
  return new Map(items.flatMap(item => {
    return item.representationId === undefined
      || (level === 'components' && item.kind !== 'component')
      ? []
      : [[item.representationId, item.worldBounds] as const]
  }))
}

export function projectWorld(
  model: TerminalViewModel,
  options: TerminalProjectionOptions,
): TerminalProjection {
  const level = options.level ?? 'context'
  const { items: worldItems, focus } = levelItems(model, level, options.currentId)
  const worldBounds = unionBounds(worldItems)
  const visible = new Map(worldItems.flatMap(item => {
    return item.representationId === undefined ? [] : [[item.representationId, item] as const]
  }))
  const elements = new Map(model.elements.map(element => [element.representationId, element]))
  // A selection the level does not show, such as a component at root, stands on its visible ancestor.
  const selected = (options.currentId === undefined ? undefined : visibleEndpointFor(options.currentId, visible, elements, undefined))
    ?? worldItems.find(item => item.kind === 'system')
    ?? worldItems.find(item => item.representationId !== undefined)
  const boundary = focus === undefined ? undefined : visible.get(focus.representationId)
  const attention = [...new Map((options.attentionIds ?? []).flatMap(id => {
    const item = visibleEndpointFor(id, visible, elements, boundary)
    return item === undefined ? [] : [[item.key, item] as const]
  })).values()]
  const attentionBounds = attention.length === 0 ? undefined : unionBounds(attention, 0)
  const camera = fittedCamera(
    attentionBounds ?? selectionReveal(model, selected, visible, options.viewport),
    worldBounds,
    options.viewport,
    options.camera,
  )
  const items = worldItems.map(item => ({
    ...item,
    cellBounds: projectBounds(item.worldBounds, camera, options.viewport),
  }))
  return {
    level,
    currentId: selected?.representationId ?? null,
    scope: focus?.representationId ?? null,
    camera,
    viewport: options.viewport,
    worldBounds,
    items,
    relationships: projectRelationships(
      model,
      level,
      worldItems,
      camera,
      options.viewport,
      focus,
    ),
  }
}

/** The topmost painted element under a map cell: items list outer before inner, so a container wins over its system. */
export function itemAt(items: readonly ProjectedMapItem[], x: number, y: number): ProjectedMapItem | undefined {
  return items.findLast(item => {
    const b = item.cellBounds
    return item.representationId !== undefined && x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height
  })
}
