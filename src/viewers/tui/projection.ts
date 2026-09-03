import type {
  AnnotatedElement,
  Bounds,
  C4Kind,
  Origin,
  Point,
  TerminalLevel,
} from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import { encloses, projectBounds, projectPoint, type TerminalCamera } from './projection-camera.ts'
import { containerLayout } from './projection-container.ts'
import { rootLayout } from './projection-root.ts'
import { routeBetween } from './projection-routes.ts'

export type MapKind = C4Kind | 'group'
export type MapShape = 'slab' | 'card' | 'group' | 'island' | 'row'

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

/** The fitted camera: the subject centred, or the whole world when it fits; scrolled only as far as the selection needs. */
function fittedCamera(
  subject: Bounds,
  revealBounds: Bounds | undefined,
  world: Bounds,
  viewport: Bounds,
  previous: TerminalCamera | undefined,
): TerminalCamera {
  const x = world.width <= viewport.width
    ? world.x - Math.floor((viewport.width - world.width) / 2)
    : Math.round(subject.x + subject.width / 2 - viewport.width / 2)
  return { x, y: scrolledTo(previous?.y ?? world.y, revealBounds, world, viewport) }
}

/** Scrolls down or up only as far as the selection needs, never above the top of the world. */
function scrolledTo(y: number, selection: Bounds | undefined, world: Bounds, viewport: Bounds): number {
  if (selection === undefined) return Math.max(world.y, y)
  let next = y
  if (selection.y + selection.height > next + viewport.height - 1) next = selection.y + selection.height - viewport.height + 1
  // The top rule wins, so a selection taller than the viewport shows its title.
  if (selection.y < next + 1) next = selection.y - 1
  return Math.max(world.y, next)
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

/** The island a root item stands on, or the item itself when it is one. */
function islandOf(items: readonly WorldItem[], item: WorldItem): WorldItem | undefined {
  return items.find(candidate => candidate.shape === 'island' && encloses(candidate.worldBounds, item.worldBounds))
}

/** The visible shapes a sheet route joins at this level, or nothing when the level does not draw it. */
function routeEnds(
  route: { source: string; target: string },
  level: TerminalLevel,
  items: readonly WorldItem[],
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
  // Rows of one island sit line on line, so a route between them has no room; those wait for the container map.
  if (level === 'context' && islandOf(items, source) === islandOf(items, target)) return undefined
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
    const ends = relationship === undefined ? undefined : routeEnds(route, level, items, visible, elements, boundary)
    if (relationship === undefined || ends === undefined) continue
    const pair = `${ends.source.key}\0${ends.target.key}`
    const existing = pairs.get(pair)
    if (existing) {
      existing.ids.push(route.id)
      continue
    }
    // The fitted layouts are the terminal's own, so a route is the shortest bend between the shapes it joins.
    const worldRoute = routeBetween(ends.source.worldBounds, ends.target.worldBounds)
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

/** What a level shows: the root's islands and rows, or the container map around the selection. */
function levelItems(model: TerminalViewModel, level: TerminalLevel, currentId: string | undefined, mapWidth: number): { items: WorldItem[]; focus: AnnotatedElement | undefined } {
  const focus = level === 'components' ? focusContainer(model, currentId) : undefined
  const items = level === 'context'
    ? rootLayout(model, mapWidth)
    : focus === undefined ? [] : containerLayout(model, focus, mapWidth)
  return { items, focus }
}

export function mapAnchors(
  model: TerminalViewModel,
  level: TerminalLevel,
  currentId: string | undefined,
  mapWidth: number,
): Map<string, Bounds> {
  const { items } = levelItems(model, level, currentId, mapWidth)
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
  const { items: worldItems, focus } = levelItems(model, level, options.currentId, options.viewport.width)
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
  // The island or slab holding the selection is what the camera centres.
  const holder = selected === undefined
    ? undefined
    : worldItems.find(item => (item.shape === 'island' || item.shape === 'slab') && encloses(item.worldBounds, selected.worldBounds))
  const camera = fittedCamera(holder?.worldBounds ?? worldBounds, attentionBounds ?? selected?.worldBounds, worldBounds, options.viewport, options.camera)
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
