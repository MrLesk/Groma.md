import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  SemanticEdge,
  SemanticItem,
  SemanticLevel,
  SemanticRole,
  SemanticView,
  SemanticViewOptions,
  WorldElement,
  WorldRelationship,
} from './types.ts'
import { promotedEndpoints, semanticRoutes } from './semantic-city.ts'

/** Same name room the world layout uses: three units per glyph plus a side margin. */
const NAME_UNIT = 3
const NAME_MARGIN = 6

const minimumSize: Record<C4Kind, Pick<Bounds, 'width' | 'height'>> = {
  component: { width: 34, height: 16 },
  container: { width: 42, height: 32 },
  actor: { width: 28, height: 40 },
  system: { width: 44, height: 40 },
}

const namedKindAt: Record<SemanticLevel, C4Kind> = {
  context: 'system',
  containers: 'container',
  components: 'component',
}

export function displaySize(
  name: string,
  kind: C4Kind,
): Pick<Bounds, 'width' | 'height'> {
  const minimum = minimumSize[kind]
  return {
    width: Math.max(minimum.width, name.length * NAME_UNIT + NAME_MARGIN),
    height: minimum.height,
  }
}

function byId(world: ArchitectureWorld): Map<string, WorldElement> {
  return new Map(world.elements.map(element => [element.representationId, element]))
}

function within(
  element: WorldElement | undefined,
  ancestorId: string,
  elements: Map<string, WorldElement>,
): boolean {
  let current = element
  while (current) {
    if (current.representationId === ancestorId) return true
    current = current.parent === null ? undefined : elements.get(current.parent)
  }
  return false
}

function isMark(element: WorldElement): boolean {
  return element.kind === 'actor' || element.external
}

function roleOf(
  element: WorldElement,
  level: SemanticLevel,
  focus: WorldElement | undefined,
  elements: Map<string, WorldElement>,
): SemanticRole | null {
  if (isMark(element)) return 'mark'

  if (level === 'context') {
    if (element.kind === 'system') return 'named'
    if (element.kind === 'container') {
      const parent = element.parent === null ? undefined : elements.get(element.parent)
      if (parent && parent.kind === 'system' && !parent.external) return 'underlay'
    }
    return null
  }

  if (!focus) return null

  if (level === 'containers') {
    if (element.kind === 'system') return 'campus'
    if (element.kind === 'container' && element.parent === focus.representationId) {
      return 'named'
    }
    if (element.kind === 'component') {
      const parent = element.parent === null ? undefined : elements.get(element.parent)
      if (parent?.parent === focus.representationId) return 'underlay'
    }
    return null
  }

  if (element.kind === 'system') return 'campus'
  if (element.kind === 'container' && element.representationId === focus.representationId) {
    return 'campus'
  }
  if (element.kind === 'component' && element.parent === focus.representationId) {
    return 'named'
  }
  return null
}

function touchesFocus(
  relationship: WorldRelationship,
  focusId: string,
  elements: Map<string, WorldElement>,
): boolean {
  const source = elements.get(relationship.source)
  const target = elements.get(relationship.target)
  return within(source, focusId, elements) || within(target, focusId, elements)
}

function toItem(
  element: WorldElement,
  role: SemanticRole,
  level: SemanticLevel,
): SemanticItem {
  const size = role === 'mark'
    ? displaySize(element.name, namedKindAt[level])
    : element.bounds
  return {
    representationId: element.representationId,
    id: element.id,
    kind: element.kind,
    name: element.name,
    role,
    bounds: {
      x: element.bounds.x,
      y: element.bounds.y,
      width: size.width,
      height: size.height,
    },
  }
}

export function semanticView(
  world: ArchitectureWorld,
  options: SemanticViewOptions,
): SemanticView {
  const { level, focusId } = options
  const elements = byId(world)
  const focus = focusId === undefined ? undefined : elements.get(focusId)
  const items: SemanticItem[] = []
  for (const element of world.elements) {
    const role = roleOf(element, level, focus, elements)
    if (!role) continue
    items.push(toItem(element, role, level))
  }

  const edges: SemanticEdge[] = []
  const seen = new Set<string>()
  for (const relationship of world.relationships) {
    if (level !== 'context' && (!focusId || !touchesFocus(relationship, focusId, elements))) {
      continue
    }
    const endpoints = promotedEndpoints(relationship, items, world.elements)
    if (!endpoints) continue
    const { source, target } = endpoints
    if (source.representationId === target.representationId) continue
    const pair = `${source.representationId}\0${target.representationId}`
    if (seen.has(pair)) continue
    seen.add(pair)
    edges.push({
      id: relationship.id,
      source: source.representationId,
      target: target.representationId,
      description: relationship.description,
    })
  }

  const selectionTargets = items
    .filter(item => item.role !== 'underlay')
    .map(({ representationId, id, role, bounds }) => ({
      representationId,
      id,
      role,
      bounds: { ...bounds },
    }))

  return {
    level,
    focusId: focusId ?? null,
    focusScope: {
      level,
      focusId: focusId ?? null,
    },
    items,
    edges,
    routes: semanticRoutes(world.relationships, edges, items),
    selectionTargets,
  }
}
