import type { Building, CellRect, Route, SheetItem } from '../../sheet/types.ts'
import type {
  AnnotatedElement,
  Bounds,
  C4Kind,
  Origin,
  Point,
  TerminalLevel,
} from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import {
  centeredCamera,
  projectBounds,
  projectPoint,
  reveal,
  type TerminalCamera,
} from './projection-camera.ts'
import { attachRoute, compactRoute, routeBetween } from './projection-routes.ts'

export type MapKind = C4Kind | 'group'
export type MapShape = 'boundary' | 'card' | 'group'

export interface ProjectedMapItem {
  key: string
  representationId?: string
  id?: string
  name: string
  kind: MapKind
  origin: Origin
  external: boolean
  shape: MapShape
  lines: string[]
  worldBounds: Bounds
  cellBounds: Bounds
}

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
  /** Exact flow endpoint the camera should reveal without changing selection. */
  attentionId?: string
  camera?: TerminalCamera
}

interface Scale {
  x: number
  y: number
}

const rootScale: Scale = { x: 1, y: 0.5 }
const componentScale: Scale = { x: 3, y: 1 }

function scaleFor(level: TerminalLevel): Scale {
  return level === 'context' ? rootScale : componentScale
}

function scaledPoint(point: { gx: number; gy: number }, scale: Scale): Point {
  return {
    x: Math.round(point.gx * scale.x),
    y: Math.round(point.gy * scale.y),
  }
}

function scaledRect(rect: CellRect, scale: Scale): Bounds {
  const start = scaledPoint(rect, scale)
  const end = scaledPoint({ gx: rect.gx + rect.w, gy: rect.gy + rect.d }, scale)
  return {
    ...start,
    width: Math.max(2, end.x - start.x),
    height: Math.max(2, end.y - start.y),
  }
}

function centered(bounds: Bounds, width: number, height: number): Bounds {
  return {
    x: Math.round(bounds.x + bounds.width / 2 - width / 2),
    y: Math.round(bounds.y + bounds.height / 2 - height / 2),
    width,
    height,
  }
}

function elementItem(
  item: SheetItem,
  element: AnnotatedElement,
  shape: MapShape,
  bounds: Bounds,
  lines = [item.name],
): Omit<ProjectedMapItem, 'cellBounds'> {
  return {
    key: item.representationId,
    representationId: item.representationId,
    id: item.id,
    name: item.name,
    kind: element.kind,
    origin: item.origin,
    external: element.external,
    shape,
    lines,
    worldBounds: bounds,
  }
}

function leafCards(
  buildings: readonly Building[],
  elements: ReadonlyMap<string, AnnotatedElement>,
  systemBounds: readonly Bounds[],
): Array<Omit<ProjectedMapItem, 'cellBounds'>> {
  const edge = systemBounds.length === 0
    ? { left: 4, right: 80 }
    : {
        left: Math.min(...systemBounds.map(bounds => bounds.x)),
        right: Math.max(...systemBounds.map(bounds => bounds.x + bounds.width)),
      }
  const cards = (side: 'left' | 'right') => {
    const members = buildings
      .filter(building => side === 'left' ? building.kind === 'actor' : building.external)
      .sort((left, right) => left.rect.gy - right.rect.gy || left.name.localeCompare(right.name))
    const heights = members.map(() => 5)
    const total = heights.reduce((sum, height) => sum + height, 0)
      + Math.max(0, members.length - 1) * 2
    const rawCentres = members.map(member => member.rect.gy * rootScale.y + member.rect.d * rootScale.y / 2)
    const middle = rawCentres.length === 0
      ? 0
      : rawCentres.reduce((sum, value) => sum + value, 0) / rawCentres.length
    let y = Math.round(middle - total / 2)
    return members.flatMap(member => {
      const element = elements.get(member.representationId)
      if (!element) return []
      const width = Math.max(15, member.name.length + 7)
      const bounds = {
        x: side === 'left' ? edge.left - width - 3 : edge.right + 3,
        y,
        width,
        height: 5,
      }
      y += 7
      return [elementItem(member, element, 'card', bounds)]
    })
  }
  return [...cards('left'), ...cards('right')]
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

function rootItems(model: TerminalViewModel): Array<Omit<ProjectedMapItem, 'cellBounds'>> {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  const systems = model.sheet.islands.flatMap(island => {
    if (island.kind !== 'system' || island.element === null) return []
    const element = byId.get(island.element.representationId)
    return element
      ? [elementItem(island.element, element, 'boundary', scaledRect(island.rect, rootScale))]
      : []
  })
  const systemBounds = systems.map(system => system.worldBounds)
  const minimumSlabWidth = new Map<string, number>()
  for (const zone of model.sheet.zones) {
    minimumSlabWidth.set(
      zone.parent,
      Math.max(minimumSlabWidth.get(zone.parent) ?? 0, zone.name.length + 6),
    )
  }
  const slabs = model.sheet.slabs.flatMap(slab => {
    const element = byId.get(slab.representationId)
    const raw = scaledRect(slab.rect, rootScale)
    const width = Math.max(
      raw.width,
      slab.name.length + 7,
      minimumSlabWidth.get(slab.representationId) ?? 0,
    )
    return element
      ? [elementItem(slab, element, 'boundary', centered(raw, width, raw.height))]
      : []
  })
  const slabsById = new Map(slabs.map(slab => [slab.representationId, slab]))
  const groups = model.sheet.zones.map(zone => {
    const raw = scaledRect(zone.rect, rootScale)
    const width = Math.max(raw.width, zone.name.length + 4)
    const parent = slabsById.get(zone.parent)?.worldBounds
    const proposed = centered(raw, width, raw.height)
    const x = parent === undefined
      ? proposed.x
      : Math.max(parent.x + 1, Math.min(proposed.x, parent.x + parent.width - width - 1))
    return {
      key: zone.key,
      name: zone.name,
      kind: 'group' as const,
      origin: 'observed' as const,
      external: false,
      shape: 'group' as const,
      lines: [zone.name],
      worldBounds: { ...proposed, x },
    }
  })
  return [
    ...systems,
    ...slabs,
    ...groups,
    ...leafCards(model.sheet.buildings, byId, systemBounds),
  ]
}

function componentItems(
  model: TerminalViewModel,
  container: AnnotatedElement,
): Array<Omit<ProjectedMapItem, 'cellBounds'>> {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  const slab = model.sheet.slabs.find(item => item.representationId === container.representationId)
  if (!slab) return []
  const boundary = elementItem(
    slab,
    container,
    'boundary',
    scaledRect(slab.rect, componentScale),
  )
  const groups = model.sheet.zones
    .filter(zone => zone.parent === container.representationId)
    .map(zone => ({
      key: zone.key,
      name: zone.name,
      kind: 'group' as const,
      origin: 'observed' as const,
      external: false,
      shape: 'group' as const,
      lines: [zone.name],
      worldBounds: scaledRect(zone.rect, componentScale),
    }))
  const components = model.sheet.buildings.flatMap(building => {
    if (building.surface !== container.representationId || building.kind !== 'component') return []
    const element = byId.get(building.representationId)
    if (!element) return []
    const raw = scaledRect(building.rect, componentScale)
    const width = Math.max(raw.width, ...building.lines.map(line => line.length + 7))
    const bounds = centered(raw, width, Math.max(4, raw.height))
    return [elementItem(building, element, 'card', bounds, building.lines)]
  })
  return [boundary, ...groups, ...components]
}

function unionBounds(items: readonly { worldBounds: Bounds }[]): Bounds {
  if (items.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  const left = Math.min(...items.map(item => item.worldBounds.x)) - 2
  const top = Math.min(...items.map(item => item.worldBounds.y)) - 2
  const right = Math.max(...items.map(item => item.worldBounds.x + item.worldBounds.width)) + 2
  const bottom = Math.max(...items.map(item => item.worldBounds.y + item.worldBounds.height)) + 2
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function visibleEndpointFor(
  id: string,
  visible: ReadonlyMap<string, Omit<ProjectedMapItem, 'cellBounds'>>,
  elements: ReadonlyMap<string, AnnotatedElement>,
  fallback: Omit<ProjectedMapItem, 'cellBounds'> | undefined,
): Omit<ProjectedMapItem, 'cellBounds'> | undefined {
  let current = elements.get(id)
  while (current) {
    const item = visible.get(current.representationId)
    if (item) return item
    current = current.parent === null ? undefined : elements.get(current.parent)
  }
  return fallback
}

function routePoints(route: Route, scale: Scale): Point[] {
  return compactRoute(route.points.map(point => scaledPoint(point, scale)))
}

function projectRelationships(
  model: TerminalViewModel,
  level: TerminalLevel,
  items: Array<Omit<ProjectedMapItem, 'cellBounds'>>,
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
    if (!relationship) continue
    const source = visibleEndpointFor(route.source, visible, elements, level === 'components' ? boundary : undefined)
    const target = visibleEndpointFor(route.target, visible, elements, level === 'components' ? boundary : undefined)
    if (!source || !target || source.key === target.key) continue
    if (level === 'components' && boundary) {
      const local = (id: string) => {
        let element = elements.get(id)
        while (element) {
          if (element.representationId === boundary.representationId) return true
          element = element.parent === null ? undefined : elements.get(element.parent)
        }
        return false
      }
      if (!local(route.source) && !local(route.target)) continue
    }
    const pair = `${source.key}\0${target.key}`
    const existing = pairs.get(pair)
    if (existing) {
      existing.ids.push(route.id)
      continue
    }
    const points = routePoints(route, scaleFor(level))
    const attached = attachRoute(points, source.worldBounds, target.worldBounds)
    const worldRoute = attached.length >= 2
      ? attached
      : routeBetween(source.worldBounds, target.worldBounds)
    if (worldRoute.length < 2) continue
    pairs.set(pair, {
      ids: [route.id],
      source: source.key,
      target: target.key,
      description: relationship.description,
      origin: relationship.origin,
      worldRoute,
      cellRoute: worldRoute.map(point => projectPoint(point, camera, viewport)),
    })
  }
  return [...pairs.values()]
}

/** Fixed world anchors used by arrow navigation; groups are not selectable. */
export function mapAnchors(
  model: TerminalViewModel,
  level: TerminalLevel,
  currentId: string | undefined,
): Map<string, Bounds> {
  const focus = level === 'components' ? focusContainer(model, currentId) : undefined
  const items = level === 'context'
    ? rootItems(model)
    : focus === undefined ? [] : componentItems(model, focus)
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
  const focus = level === 'components' ? focusContainer(model, options.currentId) : undefined
  const worldItems = level === 'context'
    ? rootItems(model)
    : focus === undefined ? [] : componentItems(model, focus)
  const worldBounds = unionBounds(worldItems)
  const selected = (options.currentId === undefined
    ? undefined
    : worldItems.find(item => item.representationId === options.currentId))
    ?? worldItems.find(item => item.kind === 'system')
    ?? worldItems.find(item => item.representationId !== undefined)
  const visible = new Map(worldItems.flatMap(item => {
    return item.representationId === undefined ? [] : [[item.representationId, item] as const]
  }))
  const elements = new Map(model.elements.map(element => [element.representationId, element]))
  const boundary = focus === undefined ? undefined : visible.get(focus.representationId)
  const attention = options.attentionId === undefined
    ? undefined
    : visibleEndpointFor(options.attentionId, visible, elements, boundary)
  const subject = level === 'components'
    ? attention?.worldBounds
      ?? worldItems.find(item => item.representationId === focus?.representationId)?.worldBounds
      ?? selected?.worldBounds
    : attention?.worldBounds ?? selected?.worldBounds
  let camera = options.camera
    ?? centeredCamera(worldBounds, subject ?? worldBounds, options.viewport)
  const revealItem = attention ?? selected
  if (revealItem) {
    camera = reveal(camera, revealItem.worldBounds, worldBounds, options.viewport)
  }
  const items = worldItems.map(item => ({
    ...item,
    cellBounds: projectBounds(item.worldBounds, camera, options.viewport),
  }))
  return {
    level,
    currentId: selected?.representationId ?? null,
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
